# Evaluation and application workflow integration

Group B implements the business commands in server/src/services/evaluation.service.ts.
Persistence uses the one generic Repository. No models or fields of Groups A/C are created.

## Trusted adapters

Construct EvaluationService with the Application/EvaluationScore repositories and:
- resolveSession(req): verified Group C user and resource/actions permissions, or null.
- loadCriteria(positionId): Group A criteria belonging to that position.

Pass the service to createApp(service). Never derive user identity, permissions or criterion
definitions from request JSON. The default local adapter requires NEXTHIRE_LOCAL_WORKFLOW=true,
a loopback connection, and NODE_ENV other than production; otherwise it does not grant access.
The browser demo also requires VITE_LOCAL_DEMO=true in development.
General CRUD endpoints still need Group C authentication and authorization before deployment.

## Commands

| Method | Path under /api/workflow | Required WRITE permission |
| --- | --- | --- |
| GET | /applications/:id/evaluation-context | EvaluationScore |
| POST | /applications/:id/evaluations | EvaluationScore |
| POST | /applications/:id/pass-threshold | Application |
| POST | /applications/:id/reject | Application |

Context returns only criteria and the current interviewer's editable values. It does not
require general Application READ or Criterion READ and does not return candidate contact
details or other interviewers' evaluations. No assignment entity or role-name check is added.

Each evaluation POST accepts criterionId, actualValue and optional notes only.
The server verifies the criterion belongs to the application's position, derives interviewerId
from the trusted session, sets evaluatedAt, and calculates computedScore:
- BOOLEAN: boolean actualValue, no fabricated numeric score.
- RATIO: actualValue / positive targetValue * 100, as described on lecturer pages 3–4.
- DIRECT: actualValue itself; maxScore is enforced when supplied by the criterion.
Stored results are not rounded or automatically capped. The UI displays at most two decimals.
Final weighting, price formula, ties, and handling multiple interviewers in a tender remain unresolved.

Saving again updates the same interviewer's evaluation of that criterion for that application.
A deterministic technical MongoDB _id protects concurrent initial saves and retries; existing
single records retain their IDs. Existing duplicates return 409 and are not deleted automatically.
Blank notes remove notes; zero and false are preserved. There is no draft or new history field.

The client sends changed criteria sequentially. Each criterion is saved atomically, but the
whole form is NOT a transaction. A failure reports how many criteria succeeded; retry updates
those records instead of duplicating them. The client never sends computedScore, interviewerId
or evaluatedAt. WRITE-only users remain on the evaluation screen after saving.

Passing threshold sets passedThreshold=true. Rejection requires a nonempty rejectionReason.
Rejection does not rewrite a historical passedThreshold result or infer currentStage.
StatusLog integration belongs to Group C and remains to be connected.

## Client and tender summary

EvaluationProvider receives loadContext(applicationId, signal), optional previewScore and
saveEvaluations; the API adapter is client/src/api/evaluations.ts.
No session picker, timestamp field, browser draft storage or interviewer-assignment screen is added.

The tender page reads applications for the selected position, then their saved TenderSummary
records. Missing summaries remain uncalculated. No frontend score fallback or tie-break is used.
Calculation, winner approval/reversal and promotion remain disabled until the missing formulas,
decision rules and permissions are agreed. Existing awardLetterUrl can be opened; letter
generation belongs to Group C. currentStage remains a TODO pending an approved type.

Criterion validation is shared between server and client in scoring.mts. Malformed types,
non-finite numeric definitions, missing/nonpositive RATIO targets and duplicate canonical
ObjectIds fail before accepting input. Context includes only the approved reference fields.
ObjectId letter case is normalized before matching criteria and hashing evaluation identity,
so equivalent IDs cannot produce distinct records during concurrent initial saves.
