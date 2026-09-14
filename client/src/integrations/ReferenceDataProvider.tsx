import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { usePermissions } from "@/auth/usePermissions";

// View options only: these are not additional Group A database models.
export type ReferenceResource = "Position" | "Company";
export interface ReferenceOption { id: string; label: string }
export type ReferenceLoader = (resource: ReferenceResource, signal: AbortSignal) => Promise<readonly ReferenceOption[]>;
const ReferenceContext = createContext<ReferenceLoader | undefined>(undefined);

export function ReferenceDataProvider({ loadOptions, children }: { loadOptions?: ReferenceLoader; children: ReactNode }) {
  return <ReferenceContext.Provider value={loadOptions}>{children}</ReferenceContext.Provider>;
}

type ReferenceState =
  | { status: "loading"; options: readonly ReferenceOption[] }
  | { status: "ready"; options: readonly ReferenceOption[] }
  | { status: "error"; options: readonly ReferenceOption[] };

export function useReferenceOptions(resource: ReferenceResource) {
  const loadOptions = useContext(ReferenceContext);
  const { can, session } = usePermissions();
  const allowed = can(resource, "READ");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const [result, setResult] = useState<ReferenceState & { resource?: ReferenceResource; source?: ReferenceLoader; owner?: typeof session }>({ status: "loading", options: [] });

  useEffect(() => {
    if (!loadOptions || !allowed) return;
    const controller = new AbortController();
    setResult({ status: "loading", options: [], resource, source: loadOptions, owner: session });
    Promise.resolve().then(() => loadOptions(resource, controller.signal)).then((options) => {
      if (!options.every((option) => /^[a-f\d]{24}$/i.test(option.id) && typeof option.label === "string")) throw new Error("Invalid reference response");
      if (!controller.signal.aborted) setResult({ status: "ready", options, resource, source: loadOptions, owner: session });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ status: "error", options: [], resource, source: loadOptions, owner: session });
    });
    return () => controller.abort();
  }, [loadOptions, allowed, resource, version, session]);

  if (!allowed) return { status: "denied" as const, options: [], reload };
  if (!loadOptions) return { status: "unavailable" as const, options: [], reload };
  if (result.resource !== resource || result.source !== loadOptions || result.owner !== session) return { status: "loading" as const, options: [], reload };
  return { ...result, reload };
}

