// Single source of truth for the MAFAL matrix's columns, cell values and labels
// — shared by the on-screen TenderMatrix table and its Excel export, so the two
// can never drift apart. A helper returns `undefined` for "no evaluation yet";
// the screen renders that as "—" and the export leaves the cell empty.

import type { CriterionReference, StageReference } from "@scoring";
import type { XlsxSheet } from "@/shared/xlsx-export";
import type { TenderRow } from "./tender-rows";

export interface MatrixScore {
  criterionId: string;
  actualValue?: number | boolean;
  computedScore?: number;
  notes?: string;
}

export interface MatrixApplication {
  applicationId: string;
  idNumber?: string;
  companyId?: string;
  hourlyRateBid?: number;
  passedThreshold?: boolean;
  rejectionReason?: string;
  scores: MatrixScore[];
}

export interface TenderMatrixData {
  criteria: CriterionReference[];
  stages: StageReference[];
  applications: MatrixApplication[];
}

export function orderedColumns(data: TenderMatrixData): { stages: StageReference[]; criteria: CriterionReference[] } {
  const stages = [...data.stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const order = new Map(stages.map((stage, index) => [stage._id, index]));
  const criteria = [...data.criteria].sort((a, b) => (order.get(a.stageId ?? "") ?? -1) - (order.get(b.stageId ?? "") ?? -1));
  return { stages, criteria };
}

// A DIRECT score is only shown as a percent of maxScore when maxScore is a
// usable, positive, finite scale — never guessed from the data itself.
export function percentOfMax(score: number, maxScore?: number): number | undefined {
  if (maxScore === undefined || !Number.isFinite(maxScore) || !(maxScore > 0)) return undefined;
  return score / maxScore;
}

export function formatPercent(fraction: number): string {
  return Math.round(fraction * 100) + "%";
}

export function methodLabel(criterion: CriterionReference): string | undefined {
  if (criterion.type !== "SCORED") return undefined;
  if (criterion.scoringMethod === "RATIO") return "ערך / אחוז מהיעד";
  const maxScore = criterion.maxScore;
  return maxScore !== undefined && Number.isFinite(maxScore) && maxScore > 0
    ? "אחוז (ציון מתוך " + maxScore + ")"
    : "ציון ישיר (לא הוגדר ציון מרבי)";
}

export function thresholdLabel(detail: MatrixApplication | undefined): string {
  return detail?.passedThreshold === true ? "עבר" : detail?.passedThreshold === false ? "לא עבר" : "טרם אושר";
}

export function matchingScores(criterion: CriterionReference, detail: MatrixApplication | undefined): MatrixScore[] {
  return detail?.scores.filter((score) => score.criterionId === criterion._id) ?? [];
}

// undefined = no evaluation yet (screen shows "—", export leaves the cell empty).
// { percent } is a fraction (0.3, not 30) for the export to write as a real
// percent cell; criterionDisplay() turns it into on-screen text ("30%").
export function criterionCell(
  criterion: CriterionReference,
  detail: MatrixApplication | undefined,
): string | number | { percent: number } | undefined {
  const scores = matchingScores(criterion, detail);
  if (scores.length > 1) return "כמה הערכות — נדרש בירור";
  const score = scores.length === 1 ? scores[0] : undefined;
  if (score?.actualValue === undefined) return undefined;
  if (criterion.type === "BOOLEAN") return score.actualValue === true ? "עבר" : "לא עבר";
  if (criterion.scoringMethod === "RATIO") {
    // The server already computes actualValue / targetValue * 100 — a percent.
    // Round only for display; never divide it again, never cap it at 100%.
    const percentText = score.computedScore !== undefined ? Math.round(score.computedScore) + "%" : "—";
    return String(score.actualValue) + " / " + percentText;
  }
  // DIRECT: percent of the criterion's maxScore when one is defined; otherwise
  // the raw score, exactly as before.
  if (score.computedScore === undefined) return undefined;
  const fraction = percentOfMax(score.computedScore, criterion.maxScore);
  return fraction !== undefined ? { percent: fraction } : score.computedScore;
}

// Turns a criterionCell() result into on-screen text.
export function criterionDisplay(value: string | number | { percent: number } | undefined): string {
  if (value === undefined) return "—";
  if (typeof value === "object") return formatPercent(value.percent);
  return String(value);
}

export function criterionHeader(criterion: CriterionReference, stages: readonly StageReference[]): string {
  const stage = stages.find((candidate) => candidate._id === criterion.stageId);
  const stagePart = stage?.name ? stage.name + (stage.weightPercent !== undefined ? " · " + stage.weightPercent + "%" : "") : undefined;
  const namePart = criterion.name || criterion._id;
  const headline = stagePart ? stagePart + " — " + namePart : namePart;
  const method = methodLabel(criterion);
  // methodLabel() can itself include parentheses (e.g. "אחוז (ציון מתוך 10)"),
  // so it is appended, not re-wrapped in another pair.
  return method ? headline + " · " + method : headline;
}

// undefined = empty cell (application was rejected before a final score applied).
export function finalScoreCell(detail: MatrixApplication | undefined, row: TenderRow): string | number | undefined {
  if (detail?.rejectionReason) return undefined;
  return row.summary?.finalWeightedScore ?? "טרם חושב";
}

export function decisionCell(detail: MatrixApplication | undefined, row: TenderRow): string {
  if (detail?.rejectionReason) return detail.rejectionReason;
  if (row.summary?.isWinner) return "זוכה";
  return "טרם נקבעה";
}

export function buildMatrixSheet(
  data: TenderMatrixData,
  rows: readonly TenderRow[],
  companyLabel: (companyId: string | undefined) => string,
): XlsxSheet {
  const { stages, criteria } = orderedColumns(data);
  const header = [
    "חברה", "שם מועמד", "ת״ז", "עמידה בסף",
    ...criteria.map((criterion) => criterionHeader(criterion, stages)),
    "תעריף שעתי", "ציון סופי", "החלטה",
  ];
  const rowsOut = rows.map((row) => {
    const detail = data.applications.find((application) => application.applicationId === row.applicationId);
    return [
      companyLabel(detail?.companyId),
      row.candidate,
      detail?.idNumber,
      thresholdLabel(detail),
      ...criteria.map((criterion) => criterionCell(criterion, detail)),
      detail?.hourlyRateBid,
      finalScoreCell(detail, row),
      decisionCell(detail, row),
    ];
  });
  return { name: "מפ״ל מפורט", header, rows: rowsOut, rightToLeft: true };
}

export function buildSummarySheet(rows: readonly TenderRow[]): XlsxSheet {
  const header = ["דירוג", "מועמד", "ציון איכות", "ציון מחיר", "ציון משוקלל", "זכייה"];
  const rowsOut = rows.map((row) => [
    row.summary?.rankPosition,
    row.candidate,
    row.summary?.totalQualityScore,
    row.summary?.priceScore,
    row.summary?.finalWeightedScore,
    row.summary?.isWinner === true ? "זוכה" : row.summary?.isWinner === false ? "לא זוכה" : "טרם נקבע",
  ]);
  return { name: "מפ״ל", header, rows: rowsOut, rightToLeft: true };
}

export function tenderExportTitle(title?: string): string | undefined {
  const trimmed = title?.trim();
  return trimmed ? trimmed : undefined;
}
