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
    // Session is no longer cached locally across restarts for security.
    setLoading(false);
  }, []);

  // Subscribe to the global settings for internet restriction
  useEffect(() => {
    if (!user || user.role === 'admin') {
      setInternetBlocked(false);
      return;
    }

    // Fetch initial value
    getGlobalInternetRestriction().then(setInternetBlocked).catch(() => setInternetBlocked(false));

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
        if (window.electronAPI?.security) {
          await window.electronAPI.security.upsertSession(team.$id!, teamName, "online");
        } else {
          console.warn("Desktop app required to update session");
        }
        return { success: true };
      }
      return { success: false, error: "Invalid credentials" };
    } catch (err) {
      return { success: false, error: "Login failed. Check your connection or server status." };
    }
  };

  const logout = () => {
    if (user) {
      if (window.electronAPI?.security) {
        window.electronAPI.security.upsertSession(user.$id!, user.teamName, "offline").catch(() => {});
      } else {
        console.warn("Desktop app required to update session");
      }
    }
    setUser(null);
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
