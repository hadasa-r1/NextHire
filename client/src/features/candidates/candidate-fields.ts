import { candidateIssues } from "@validation";
import type { Candidate } from "@/types/domain";

export type CandidateValues = Pick<Candidate, "fullName" | "idNumber" | "phone" | "email">;
export type CandidateFields = Required<CandidateValues>;

export function candidateFields(candidate?: Candidate): CandidateFields {
  return {
    fullName: candidate?.fullName ?? "",
    idNumber: candidate?.idNumber ?? "",
    phone: candidate?.phone ?? "",
    email: candidate?.email ?? "",
  };
}

// Pick exactly the four approved fields, never _id or additional form properties.
// Empty strings in optional inputs are UI state, not schema defaults.
export function candidatePayload(fields: CandidateFields): CandidateValues {
  const errors = Object.values(candidateIssues(fields));
  if (errors.length) throw new Error(errors.join(" "));
  return {
    fullName: fields.fullName.trim(),
    idNumber: fields.idNumber.trim(),
    phone: fields.phone.trim(),
    email: fields.email.trim(),
  };
}

