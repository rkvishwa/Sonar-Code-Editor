import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Team } from "../../shared/types";
import {
  validateTeamCredentials,
  registerTeam,
  getGlobalInternetRestriction,
  subscribeToSettings,
  updateSessionLastSeen,
  getCurrentTeam,
  logoutTeam
} from "../services/appwrite";

interface AuthContextValue {
  user: Team | null;
  loading: boolean;
  internetBlocked: boolean;
  login: (
    teamName: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    teamName: string,
    password: string,
    studentIds: string[],
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [internetBlocked, setInternetBlocked] = useState(false);

  useEffect(() => {
    getCurrentTeam().then((team) => {
      if (team) setUser(team);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Subscribe to the global settings for internet restriction
  useEffect(() => {
    if (!user || user.role === 'admin') {
      setInternetBlocked(false);
      return;
    }

    // Fetch initial value
    getGlobalInternetRestriction(true).then(setInternetBlocked).catch(() => setInternetBlocked(false));

    // Subscribe to realtime changes
    const unsub = subscribeToSettings((blocked) => {
      setInternetBlocked(blocked);
    });

    return () => {
      unsub();
    };
  }, [user?.$id, user?.role]);

  const login = async (
    teamName: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Attestation checking moved to main process
      const team = await validateTeamCredentials(teamName, password);
      
      if (team) {
        setUser(team);
        try {
          // Use a timeout for the initial online status sync to prevent login hangs
          const syncPromise = updateSessionLastSeen(team.$id!, team.teamName, "online");
          const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
          await Promise.race([syncPromise, timeout]);
        } catch {
          // Fallback path or timeout: try local security sync without blocking
          if (window.electronAPI?.security) {
            window.electronAPI.security.upsertSession(team.$id!, team.teamName, "online").catch(() => {});
          }
        }
        return { success: true };
      }
      return { success: false, error: "Invalid credentials" };
    } catch (err) {
      return { success: false, error: "Login failed. Check your connection or server status." };
    }
  };

  const logout = () => {
    // Wrap in an async function to use await, but execute it immediately
    const performLogout = async () => {
      // 1. Attempt offline sync (best effort, with timeout)
      if (user) {
        try {
          const syncPromise = updateSessionLastSeen(user.$id!, user.teamName, "offline");
          const timeout = new Promise(resolve => setTimeout(resolve, 800)); // 800ms max for sync
          await Promise.race([syncPromise, timeout]);
        } catch {
          // Ignore network errors
        }

        // Fallback to local security context if network fails (fire and forget)
        if (window.electronAPI?.security) {
          window.electronAPI.security.upsertSession(user.$id!, user.teamName, "offline").catch(() => {});
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

    performLogout();
  };

  const register = async (
    teamName: string,
    password: string,
    studentIds: string[],
  ): Promise<{ success: boolean; error?: string }> => {
    return registerTeam(teamName, password, studentIds);
  };

  return (
    <AuthContext.Provider value={{ user, loading, internetBlocked, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
