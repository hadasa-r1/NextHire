import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import type { AuthSession } from "./permissions";

export type SessionLoader = (signal: AbortSignal) => Promise<AuthSession | null>;
export type AuthStatus = "unavailable" | "loading" | "ready" | "error";
export interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  reload: () => void;
}
export const AuthContext = createContext<AuthState>({
  status: "unavailable", session: null, reload: () => {},
});

// Supply Group C's authenticated session loader here once its API is agreed.
// No guessed endpoint, role mapping, localStorage permissions, or default grants.
export function AuthProvider({ children, loadSession }: {
  children: ReactNode;
  loadSession?: SessionLoader;
}) {
  const [state, setState] = useState<{
    source: SessionLoader | undefined; status: AuthStatus; session: AuthSession | null;
  }>({ source: undefined, status: "unavailable", session: null });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!loadSession) return;
    const controller = new AbortController();
    setState({ source: loadSession, status: "loading", session: null });
    Promise.resolve().then(() => loadSession(controller.signal))
      .then((session) => {
        if (!controller.signal.aborted) setState({ source: loadSession, status: "ready", session });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ source: loadSession, status: "error", session: null });
      });
    return () => controller.abort();
  }, [loadSession, version]);

  const current = !loadSession
    ? { status: "unavailable" as const, session: null }
    : state.source === loadSession ? state : { status: "loading" as const, session: null };
  return <AuthContext.Provider value={{ ...current, reload }}>{children}</AuthContext.Provider>;
}

