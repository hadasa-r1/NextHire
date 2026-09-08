// Mirrors the Group B backend models in ../../src/models/*.ts.
//
// Over the wire: ObjectId fields are 24-char hex strings, `_id` is always
// present on stored documents, and Date fields arrive as ISO strings. Keep this
// file in step with the backend interfaces — there is no shared package yet.

export interface Candidate {
  _id: string;
  fullName?: string;
  idNumber: string;
  phone?: string;
  email?: string;
}

export interface Application {
  _id: string;
  positionId?: string;
  candidateId?: string;
  companyId?: string;
  hourlyRateBid?: number;
  resumeUrl: string;
  passedThreshold?: boolean;
  rejectionReason?: string;

  // NOTE: `currentStage` is in the approved data model but is NOT implemented on
  // the backend yet — it is an explicit TODO in src/models/application.model.ts,
  // deferred by Group B until its type is decided. The API never sends it today.
  // Typed here so the stub in ../features/candidate-pool/stage.ts stays honest.
  currentStage?: string;
}

// Shape of an Application returned with `?populate=candidateId`.
export interface ApplicationWithCandidate extends Omit<Application, "candidateId"> {
  candidateId?: Candidate | string;
}

export interface EvaluationScore {
  _id: string;
  applicationId?: string;
  criterionId?: string;
  interviewerId?: string;
  actualValue?: number | boolean;
  computedScore?: number;
  notes?: string;
  evaluatedAt?: string;
}

export interface TenderSummary {
  _id: string;
  applicationId?: string;
  totalQualityScore?: number;
  priceScore?: number;
  finalWeightedScore?: number;
  rankPosition?: number;
  isWinner?: boolean;
  committeeApproverId?: string;
  awardLetterUrl?: string;
}
