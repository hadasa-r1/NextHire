import type { Candidate } from "@/types/domain";
import { useApiResource } from "@/shared/useApiResource";

export function useCandidates() {
  return useApiResource<Candidate[]>("/candidates");
}

