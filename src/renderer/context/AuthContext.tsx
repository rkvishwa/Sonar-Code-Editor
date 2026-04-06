import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getHackathonIdValidationError } from "../../shared/hackathonId";
import { Team } from "../../shared/types";
import {
  validateTeamCredentials,
  registerTeam,
  TeamLoginPayload,
  TeamRegistrationPayload,
  getHackathonById,
  getEffectiveHackathonRestrictions,
  resolveTeamByStudentId,
  getGlobalInternetRestriction,
  subscribeToSettings,
  checkLatestVersionGate,
  getLocalAppVersion,
  updateSessionLastSeen,
  getCurrentTeam,
  logoutTeam,
  closeSessionOnAppClose,
  resetSessionOnAppLaunch
} from "../services/appwrite";

interface AuthContextValue {
  user: Team | null;
  loading: boolean;
  internetBlocked: boolean;
  login: (payload: TeamLoginPayload) => Promise<{ success: boolean; error?: string }>;
  register: (payload: TeamRegistrationPayload) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [internetBlocked, setInternetBlocked] = useState(false);

  const refreshUser = async () => {
    try {
      const team = await getCurrentTeam();
      setUser(team);
    } catch (e) {
      console.error("Failed to refresh user:", e);
      setUser(null);
    }
  };

  useEffect(() => {
    resetSessionOnAppLaunch()
      .catch(() => {})
      .finally(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handleAppClose = () => {
      closeSessionOnAppClose();

      if (user && window.electronAPI?.security) {
        window.electronAPI.security
          .upsertSession(user.$id!, user.teamName, "offline", user.hackathonId)
          .catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleAppClose);
    window.addEventListener("unload", handleAppClose);

    return () => {
      window.removeEventListener("beforeunload", handleAppClose);
      window.removeEventListener("unload", handleAppClose);
    };
  }, [user?.$id, user?.teamName, user?.hackathonId]);

  // Subscribe to the global settings for internet restriction
  useEffect(() => {
    if (!user) {
      setInternetBlocked(false);
      return;
    }

    let isCancelled = false;
    let intervalId: number | null = null;

    const syncInternetRestriction = async () => {
      try {
        const restrictions = await getEffectiveHackathonRestrictions(user.hackathonId);
        if (!isCancelled) {
          setInternetBlocked(restrictions.blockInternetAccess);
        }
      } catch {
        if (!isCancelled) {
          setInternetBlocked(false);
        }
      }
    };

    if (user.hackathonId) {
      void syncInternetRestriction();
      intervalId = window.setInterval(() => {
        void syncInternetRestriction();
      }, 15_000);
    } else {
      getGlobalInternetRestriction(true).then((blocked) => {
        if (!isCancelled) {
          setInternetBlocked(blocked);
        }
      }).catch(() => {
        if (!isCancelled) {
          setInternetBlocked(false);
        }
      });
    }

    const unsub = user.hackathonId
      ? () => {}
      : subscribeToSettings((blocked) => {
          if (!isCancelled) {
            setInternetBlocked(blocked);
          }
        });

    return () => {
      isCancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      unsub();
    };
  }, [user?.$id, user?.hackathonId]);

  const login = async (
    payload: TeamLoginPayload,
  ): Promise<{ success: boolean; error?: string }> => {
    const isOnline = await window.electronAPI?.network?.getStatus?.().catch(() => navigator.onLine) ?? navigator.onLine;
    if (!isOnline) {
      return {
        success: false,
        error: 'No internet connection. Connect to the internet and try again.',
      };
    }

    try {
      const versionGate = await checkLatestVersionGate();
      if (!versionGate.upToDate) {
        window.dispatchEvent(
          new CustomEvent('version-gate-blocked', {
            detail: {
              message: versionGate.message || `Update required. Please install ${versionGate.latestVersion} to continue.`,
              currentVersion: versionGate.currentVersion,
              latestVersion: versionGate.latestVersion,
            },
          })
        );
        return {
          success: false,
          error: versionGate.message || `Update required. Please install ${versionGate.latestVersion} to continue.`,
        };
      }
    } catch {
      const onlineNow = await window.electronAPI?.network?.getStatus?.().catch(() => navigator.onLine) ?? navigator.onLine;
      if (!onlineNow) {
        return {
          success: false,
          error: 'No internet connection. Connect to the internet and try again.',
        };
      }

      const localVersion = await getLocalAppVersion();
      window.dispatchEvent(
        new CustomEvent('version-gate-blocked', {
          detail: {
            message: 'Unable to verify app version. Please update or try again later.',
            currentVersion: localVersion,
            latestVersion: '',
          },
        })
      );
      return {
        success: false,
        error: 'Unable to verify app version. Please update or try again later.',
      };
    }

    try {
      const hackathonIdError = getHackathonIdValidationError(payload.hackathonId);
      if (hackathonIdError) {
        return { success: false, error: hackathonIdError };
      }

      if (!payload.studentId.trim()) {
        return { success: false, error: 'Student ID is required for team sign in.' };
      }

      const hackathon = await getHackathonById(payload.hackathonId);
      if (!hackathon) {
        return { success: false, error: 'Hackathon ID not found.' };
      }

      if (hackathon.status === 'archived') {
        return { success: false, error: 'This hackathon is archived and no longer accepts team logins.' };
      }

      const participant = await resolveTeamByStudentId(payload.hackathonId, payload.studentId);
      if (!participant) {
        return { success: false, error: 'Student ID is not registered for this hackathon.' };
      }

      // Attestation checking moved to main process
      const team = await validateTeamCredentials(payload, participant);
      
      if (team) {
        setUser(team);
        setInternetBlocked(hackathon.settings.blockInternetAccess);
        try {
          // Use a timeout for the initial online status sync to prevent login hangs
          const syncPromise = updateSessionLastSeen(team.$id!, team.teamName, "online", team.hackathonId);
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
          await Promise.race([syncPromise, timeout]);
        } catch {
          // Fallback path or timeout: try local security sync without blocking
          if (window.electronAPI?.security) {
            window.electronAPI.security.upsertSession(team.$id!, team.teamName, "online", team.hackathonId).catch(() => {});
          }
        }
        return { success: true };
      }
      return {
        success: false,
        error: 'Invalid hackathon ID, student ID, or password',
      };
    } catch (err) {
      return { success: false, error: "Login failed. Check your connection or server status." };
    }
  };

  const logout = async (): Promise<void> => {
    // 1. Attempt offline sync (best effort, with timeout)
    if (user) {
      try {
        const syncPromise = updateSessionLastSeen(user.$id!, user.teamName, "offline", user.hackathonId);
        const timeout = new Promise(resolve => setTimeout(resolve, 800)); // 800ms max for sync
        await Promise.race([syncPromise, timeout]);
      } catch {
        // Ignore network errors
      }

      // Fallback to local security context if network fails (fire and forget)
      if (window.electronAPI?.security) {
        window.electronAPI.security.upsertSession(user.$id!, user.teamName, "offline", user.hackathonId).catch(() => {});
      }
    }

    // 2. Destroy session (with timeout)
    try {
      const logoutPromise = logoutTeam();
      const timeout = new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s max for logout
      await Promise.race([logoutPromise, timeout]);
    } catch {
      // Ignore logout errors, force local cleanup
    }

    // 3. Clear local state
    setUser(null);
  };

  const register = async (
    payload: TeamRegistrationPayload,
  ): Promise<{ success: boolean; error?: string }> => {
    const hackathonIdError = getHackathonIdValidationError(payload.hackathonId);
    if (hackathonIdError) {
      return { success: false, error: hackathonIdError };
    }

    return registerTeam(payload);
  };

  return (
    <AuthContext.Provider value={{ user, loading, internetBlocked, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
