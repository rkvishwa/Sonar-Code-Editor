import React, { useState, useEffect, useCallback, useRef } from "react";
import { Eye, EyeOff, Radar, Sun, Moon, Zap } from "lucide-react";
import {
  HACKATHON_ID_LENGTH,
  getHackathonIdValidationError,
  normalizeHackathonId,
} from "../../shared/hackathonId";
import { LoginInvitePrefill } from "../../shared/types";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

type Tab = "login" | "register";

interface LoginProps {
  invitePrefill?: LoginInvitePrefill | null;
  inviteNotice?: {
    message: string;
    type: "error" | "success";
  } | null;
}

export default function Login({
  invitePrefill = null,
  inviteNotice = null,
}: LoginProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const handledInviteKeyRef = useRef("");

  const [loginHackathonId, setLoginHackathonId] = useState("");
  const [loginStudentId, setLoginStudentId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regHackathonId, setRegHackathonId] = useState("");
  const [regTeam, setRegTeam] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regStudentIds, setRegStudentIds] = useState<string[]>([""]);

  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  const resolveTheme = (saved: string | null): "light" | "dark" => {
    if (saved === "light") return "light";
    if (saved === "dark") return "dark";
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  };

  const [theme, setTheme] = useState<"light" | "dark">(() =>
    resolveTheme(localStorage.getItem("ide-theme")),
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleIdeThemeChanged = () => {
      setTheme(resolveTheme(localStorage.getItem("ide-theme")));
    };
    window.addEventListener("ide-theme-changed", handleIdeThemeChanged);
    return () =>
      window.removeEventListener("ide-theme-changed", handleIdeThemeChanged);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (event: MediaQueryListEvent) => {
      const saved = localStorage.getItem("ide-theme");
      if (!saved || saved === "system") {
        setTheme(event.matches ? "light" : "dark");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme((previous) => {
      const next = previous === "light" ? "dark" : "light";
      localStorage.setItem("ide-theme", next);
      return next;
    });
  };

  const showToast = useCallback(
    (message: string, type: "error" | "success") => {
      setToast({ message, type });
    },
    [],
  );

  const sanitizeHackathonIdInput = (value: string) =>
    normalizeHackathonId(value).slice(0, HACKATHON_ID_LENGTH);

  const submitInviteLogin = useCallback(
    async (invite: LoginInvitePrefill) => {
      if (invite.kind !== "team") {
        return;
      }

      setLoading(true);
      const result = await login({
        hackathonId: sanitizeHackathonIdInput(invite.hackathonId),
        studentId: invite.studentId.trim(),
        password: invite.password,
      });
      setLoading(false);

      if (!result.success) {
        showToast(result.error || "Unable to sign in from this invite", "error");
      }
    },
    [login, showToast],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!inviteNotice) return;
    showToast(inviteNotice.message, inviteNotice.type);
  }, [inviteNotice, showToast]);

  useEffect(() => {
    if (!invitePrefill) return;
    if (handledInviteKeyRef.current === invitePrefill.inviteKey) return;

    handledInviteKeyRef.current = invitePrefill.inviteKey;
    setTab("login");
    setLoginHackathonId(sanitizeHackathonIdInput(invitePrefill.hackathonId));
    setLoginStudentId(
      invitePrefill.kind === "team"
        ? invitePrefill.studentId
        : invitePrefill.studentId || "",
    );
    setLoginPassword(invitePrefill.kind === "team" ? invitePrefill.password : "");

    if (invitePrefill.kind === "team" && invitePrefill.autoSubmit) {
      void submitInviteLogin(invitePrefill);
    }
  }, [invitePrefill, submitInviteLogin]);

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    setToast(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (
      !loginHackathonId.trim() ||
      !loginStudentId.trim() ||
      !loginPassword.trim()
    ) {
      showToast("Hackathon ID, student ID, and password are required", "error");
      return;
    }

    const normalizedHackathonId = sanitizeHackathonIdInput(loginHackathonId);
    const hackathonIdError = getHackathonIdValidationError(normalizedHackathonId);
    if (hackathonIdError) {
      showToast(hackathonIdError, "error");
      return;
    }

    setLoading(true);
    const result = await login({
      hackathonId: normalizedHackathonId,
      studentId: loginStudentId.trim(),
      password: loginPassword,
    });
    setLoading(false);

    if (!result.success) {
      showToast(result.error || "Unable to sign in", "error");
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    const hackathonId = sanitizeHackathonIdInput(regHackathonId);
    const teamName = regTeam.trim();
    const password = regPassword.trim();
    const confirmPassword = regConfirmPassword.trim();
    const studentIds = regStudentIds.map((value) => value.trim()).filter(Boolean);

    if (!hackathonId || !teamName || !password || !confirmPassword || studentIds.length === 0) {
      showToast(
        "Hackathon ID, team name, at least one student ID, password, and confirm password are required",
        "error",
      );
      return;
    }

    const hackathonIdError = getHackathonIdValidationError(hackathonId);
    if (hackathonIdError) {
      showToast(hackathonIdError, "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Password and confirm password must match", "error");
      return;
    }

    const normalizedIds = studentIds.map((value) => value.toUpperCase());
    const uniqueIds = new Set(normalizedIds);
    if (uniqueIds.size !== normalizedIds.length) {
      showToast("Duplicate student IDs are not allowed", "error");
      return;
    }

    if (studentIds.length > 5) {
      showToast("A team can include at most 5 student IDs", "error");
      return;
    }

    setLoading(true);
    const result = await register({
      hackathonId,
      teamName,
      password,
      studentIds,
    });
    setLoading(false);

    if (result.success) {
      showToast(
        "Registration successful. Sign in with your hackathon ID and one of the registered student IDs.",
        "success",
      );
      setLoginHackathonId(hackathonId);
      setLoginStudentId("");
      setLoginPassword("");
      setRegHackathonId("");
      setRegTeam("");
      setRegPassword("");
      setRegConfirmPassword("");
      setRegStudentIds([""]);
      setTab("login");
    } else {
      showToast(result.error || "Registration failed", "error");
    }
  };

  const addStudentId = () => {
    if (regStudentIds.length < 5) {
      setRegStudentIds([...regStudentIds, ""]);
    }
  };

  const removeStudentId = (index: number) => {
    if (regStudentIds.length > 1) {
      setRegStudentIds(regStudentIds.filter((_, position) => position !== index));
    } else {
      setRegStudentIds([""]);
    }
  };

  const updateStudentId = (index: number, value: string) => {
    const updated = [...regStudentIds];
    updated[index] = value;
    setRegStudentIds(updated);
  };

  const totalStudentCount = regStudentIds.map((value) => value.trim()).filter(Boolean).length;

  return (
    <div className="login-layout">
      <button
        className="theme-toggle-btn"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          onClick={() => setToast(null)}
        >
          <span className="toast-icon">
            {toast.type === "error" ? "✕" : "✓"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="login-hero">
        <div className="hero-content">
          <div className="hero-icon">
            <Radar size={120} className="radar-icon" />
          </div>
          <h1>Sonar Code Editor</h1>
          <p>
            A dedicated workspace for supervised exams, featuring real-time
            collaborative coding.
          </p>
        </div>
        <div className="hero-decoration"></div>
      </div>

      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-header">
            <div className="login-logo-mobile">
              <Radar size={32} className="radar-icon" />
            </div>
            <h2>{tab === "login" ? "Access your workspace" : "Register your team"}</h2>
            <p>
              {tab === "login"
                ? "Sign in with your hackathon ID, student ID, and password."
                : "Register a team for a specific hackathon with one or more student IDs."}
            </p>
          </div>

          <div className="login-tab-bar">
            <button
              className={`login-tab-btn ${tab === "login" ? "active" : ""}`}
              onClick={() => switchTab("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`login-tab-btn ${tab === "register" ? "active" : ""}`}
              onClick={() => switchTab("register")}
              type="button"
            >
              Register Team
            </button>
          </div>

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="loginHackathonId">Hackathon ID</label>
                <input
                  id="loginHackathonId"
                  type="text"
                  value={loginHackathonId}
                  onChange={(event) =>
                    setLoginHackathonId(sanitizeHackathonIdInput(event.target.value))
                  }
                  placeholder="Enter the 12-digit hackathon ID"
                  autoComplete="off"
                  autoFocus
                  inputMode="numeric"
                  maxLength={HACKATHON_ID_LENGTH}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="loginStudentId">Student ID</label>
                <input
                  id="loginStudentId"
                  type="text"
                  value={loginStudentId}
                  onChange={(event) => setLoginStudentId(event.target.value)}
                  placeholder="Enter a registered student ID"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="loginPassword">Password</label>
                <div className="password-wrapper">
                  <input
                    id="loginPassword"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    tabIndex={-1}
                    aria-label={
                      showLoginPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Signing in..." : "Sign In to Hackathon"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="login-form">
              <div className="form-group">
                <label htmlFor="regHackathonId">Hackathon ID</label>
                <input
                  id="regHackathonId"
                  type="text"
                  value={regHackathonId}
                  onChange={(event) =>
                    setRegHackathonId(sanitizeHackathonIdInput(event.target.value))
                  }
                  placeholder="Enter the 12-digit hackathon ID"
                  autoComplete="off"
                  autoFocus
                  inputMode="numeric"
                  maxLength={HACKATHON_ID_LENGTH}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="regTeam">Team Name</label>
                <input
                  id="regTeam"
                  type="text"
                  value={regTeam}
                  onChange={(event) => setRegTeam(event.target.value)}
                  placeholder="Choose a team name"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>

              <div className="field-row">
                <div className="form-group">
                  <label htmlFor="regPassword">Password</label>
                  <div className="password-wrapper">
                    <input
                      id="regPassword"
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(event) => setRegPassword(event.target.value)}
                      placeholder="Choose a password"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      tabIndex={-1}
                      aria-label={
                        showRegPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="regConfirmPassword">Confirm Password</label>
                  <div className="password-wrapper">
                    <input
                      id="regConfirmPassword"
                      type={showRegConfirmPassword ? "text" : "password"}
                      value={regConfirmPassword}
                      onChange={(event) => setRegConfirmPassword(event.target.value)}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      tabIndex={-1}
                      aria-label={
                        showRegConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <div className="student-ids-header">
                  <label>Student IDs</label>
                  <span className="student-ids-count">{totalStudentCount}/5 total students</span>
                </div>

                <div className="student-ids-list">
                  {regStudentIds.map((id, index) => (
                    <div className="student-id-row" key={index}>
                      <input
                        type="text"
                        value={id}
                        onChange={(event) => updateStudentId(index, event.target.value)}
                        placeholder={`Student ID #${index + 1}`}
                        autoComplete="off"
                        disabled={loading}
                      />
                      {(regStudentIds.length > 1 || id) && (
                        <button
                          type="button"
                          className="id-remove-btn"
                          onClick={() => removeStudentId(index)}
                          disabled={loading}
                          title="Remove"
                        >
                          −
                        </button>
                      )}
                    </div>
                  ))}

                  {regStudentIds.length < 5 && (
                    <button
                      type="button"
                      className="id-add-btn"
                      onClick={addStudentId}
                      disabled={loading}
                    >
                      <span className="plus-icon">+</span> Add Student ID
                    </button>
                  )}
                </div>
              </div>

              <p className="form-hint">
                Add every student ID on the team, including the student who is
                registering. You can add up to five total.
              </p>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? "Registering..." : "Register for Hackathon"}
              </button>
            </form>
          )}

          <div className="login-footer">
            <a
              href="https://knurdz.org"
              target="_blank"
              rel="noopener noreferrer"
              className="powered-by-link"
            >
              <Zap className="knurdz-icon" size={14} strokeWidth={2.5} />
              <span className="powered-text">Powered by</span>
              <span className="knurdz-brand">Knurdz</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
