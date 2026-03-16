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
  upsertSession,
  registerTeam,
  getGlobalInternetRestriction,
  getGlobalWorkspaceRestriction,
  subscribeToSettings,
} from "../services/appwrite";
import {
  cacheCredentials,
  validateCachedAuth,
  clearCache,
} from "../services/localStore";

interface AuthContextValue {
  user: Team | null;
  loading: boolean;
  internetBlocked: boolean;
  blockNonEmptyWorkspace: boolean;
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
  const [blockNonEmptyWorkspace, setBlockNonEmptyWorkspace] = useState(false);

  useEffect(() => {
    // Attempt to restore session from cache
    const cached = JSON.parse(localStorage.getItem("sonar_session") || "null");
    if (cached) {
      setUser(cached);
      // Mark session as online in DB on restore (fire-and-forget)
      if (cached.$id && cached.teamName) {
        upsertSession(cached.$id, cached.teamName, "online").catch(() => {});
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user || user.role === 'admin') {
      setInternetBlocked(false);
      setBlockNonEmptyWorkspace(false);
      return;
    }

    // Fetch initial value
    Promise.all([
      getGlobalInternetRestriction().then(setInternetBlocked).catch(() => setInternetBlocked(false)),
      getGlobalWorkspaceRestriction().then(setBlockNonEmptyWorkspace).catch(() => setBlockNonEmptyWorkspace(false))
    ]);

    // Subscribe to realtime changes
    const unsub = subscribeToSettings((type, value) => {
      if (type === 'blockInternetAccess') {
        setInternetBlocked(value);
      } else if (type === 'blockNonEmptyWorkspace') {
        setBlockNonEmptyWorkspace(value);
      }
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
      // Try online auth first
      const team = await validateTeamCredentials(teamName, password);
      if (team) {
        setUser(team);
        localStorage.setItem("sonar_session", JSON.stringify(team));
        cacheCredentials(teamName, password, team.$id!, team.role);
        await upsertSession(team.$id!, teamName, "online");
        return { success: true };
      }
      // Online auth returned null = invalid credentials (server reachable)
      return { success: false, error: "Invalid credentials" };
    } catch (err) {
      // Network error - try cached login
      const cached = validateCachedAuth(teamName, password);
      if (cached) {
        const offlineUser: Team = {
          $id: cached.teamId,
          teamName: cached.teamName,
          role: cached.role,
        };
        setUser(offlineUser);
        localStorage.setItem("sonar_session", JSON.stringify(offlineUser));
        return { success: true };
      }
      return { success: false, error: "Login failed. Check your connection." };
    }
  };

  const logout = () => {
    if (user) {
      upsertSession(user.$id!, user.teamName, "offline").catch(() => {});
    }
    setUser(null);
    localStorage.removeItem("sonar_session");
  };

  const register = async (
    teamName: string,
    password: string,
    studentIds: string[],
  ): Promise<{ success: boolean; error?: string }> => {
    return registerTeam(teamName, password, studentIds);
  };

  return (
    <AuthContext.Provider value={{ user, loading, internetBlocked, blockNonEmptyWorkspace, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
