import { candidateIssues } from "@validation";
import type { Candidate } from "@/types/domain";

export type CandidateValues = Pick<Candidate, "fullName" | "idNumber" | "phone" | "email" | "linkedinUrl" | "githubUrl" | "photoUrl">;
export type CandidateFields = Required<Pick<CandidateValues, "fullName" | "idNumber" | "phone" | "email">> & Partial<Pick<CandidateValues, "linkedinUrl" | "githubUrl" | "photoUrl">>;

export function candidateFields(candidate?: Candidate): Required<CandidateValues> {
  return {
    fullName: candidate?.fullName ?? "",
    idNumber: candidate?.idNumber ?? "",
    phone: candidate?.phone ?? "",
    email: candidate?.email ?? "",
    linkedinUrl: candidate?.linkedinUrl ?? "",
    githubUrl: candidate?.githubUrl ?? "",
    photoUrl: candidate?.photoUrl ?? "",
  };
}

// Pick approved core fields and the three explicitly requested profile extensions.
// Empty strings in optional inputs are UI state, not schema defaults.
export function candidatePayload(fields: CandidateFields): CandidateValues {
  const errors = Object.values(candidateIssues(fields));
  if (errors.length) throw new Error(errors.join(" "));
  return {
    fullName: fields.fullName.trim(),
    idNumber: fields.idNumber.trim(),
    phone: fields.phone.trim(),
    email: fields.email.trim(),
    ...(fields.linkedinUrl !== undefined ? { linkedinUrl: fields.linkedinUrl.trim() } : {}),
    ...(fields.githubUrl !== undefined ? { githubUrl: fields.githubUrl.trim() } : {}),
    ...(fields.photoUrl !== undefined ? { photoUrl: fields.photoUrl.trim() } : {}),
  };
}

