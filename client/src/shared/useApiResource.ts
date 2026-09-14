import { useCallback, useEffect, useState } from "react";
import { ApiError, apiGet } from "@/api/client";

type Result<T> =
  | { path: string | null; status: "loading" }
  | { path: string | null; status: "idle" }
  | { path: string; status: "ready"; data: T }
  | { path: string; status: "error"; error: ApiError };

export function useApiResource<T>(path: string | null) {
  const [result, setResult] = useState<Result<T>>({ path: null, status: "idle" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    setResult({ path, status: "loading" });
    apiGet<T>(path, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ path, status: "ready", data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({
        path, status: "error",
        error: error instanceof ApiError ? error : new ApiError(0, "אירעה שגיאה בטעינת הנתונים."),
      });
    });
    return () => controller.abort();
  }, [path, version]);

  const current: Result<T> = path === null ? { path, status: "idle" }
    : result.path === path ? result : { path, status: "loading" };
  return { ...current, reload };
}

