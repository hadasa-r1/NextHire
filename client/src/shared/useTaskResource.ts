import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";

type Result<T> =
  | { status: "idle"; key: string | null }
  | { status: "loading"; key: string | null }
  | { status: "error"; key: string; error: ApiError }
  | { status: "ready"; key: string; data: T };

// For a screen that combines several existing API reads. No CRUD is implemented here.
export function useTaskResource<T>(key: string | null, task: (signal: AbortSignal) => Promise<T>) {
  const [stored, setStored] = useState<{ task: typeof task; result: Result<T> }>({ task, result: { status: "idle", key: null } });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    setStored({ task, result: { status: "loading", key } });
    Promise.resolve().then(() => task(controller.signal)).then((data) => {
      if (!controller.signal.aborted) setStored({ task, result: { status: "ready", key, data } });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setStored({ task, result: {
        status: "error", key, error: error instanceof ApiError ? error : new ApiError(0, "אירעה שגיאה בטעינת הנתונים."),
      } });
    });
    return () => controller.abort();
  }, [key, task, version]);
  const result: Result<T> = key === null ? { status: "idle", key }
    : stored.task === task && stored.result.key === key ? stored.result : { status: "loading", key };
  return { ...result, reload };
}

