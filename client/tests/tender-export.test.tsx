import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { unzipSync, strFromU8 } from "fflate";
import type { CriterionReference, StageReference } from "@scoring";
import {
  buildXlsx, columnName, sheetNames, xlsxFileName,
} from "../src/shared/xlsx-export";
import {
  buildMatrixSheet, buildSummarySheet, tenderExportTitle,
  type MatrixApplication, type TenderMatrixData,
} from "../src/features/tender-summary/tender-export";
import { TenderSummaryTable } from "../src/features/tender-summary/TenderSummaryTable";
import type { TenderRow } from "../src/features/tender-summary/tender-rows";

const posA = "507f1f77bcf86cd799439011";
const app1 = "507f1f77bcf86cd799439041";
const app2 = "507f1f77bcf86cd799439042";
const app3 = "507f1f77bcf86cd799439043";
const stageId = "507f1f77bcf86cd799439031";

const critBoolean: CriterionReference = { _id: "507f1f77bcf86cd799439021", type: "BOOLEAN", name: "תנאי סף", stageId };
const critRatio: CriterionReference = { _id: "507f1f77bcf86cd799439022", type: "SCORED", scoringMethod: "RATIO", name: "ראיון", stageId, targetValue: 10 };
const critDirect: CriterionReference = { _id: "507f1f77bcf86cd799439023", type: "SCORED", scoringMethod: "DIRECT", name: "מבחן" };
const stage: StageReference = { _id: stageId, positionId: posA, name: "ראיון טלפוני", order: 1, weightPercent: 30 };

const applications: MatrixApplication[] = [
  {
    applicationId: app1, idNumber: "123456789", companyId: "co1", hourlyRateBid: 0, passedThreshold: true,
    scores: [
      { criterionId: critBoolean._id, actualValue: true },
      { criterionId: critRatio._id, actualValue: 8, computedScore: 80 },
      { criterionId: critDirect._id, actualValue: 0, computedScore: 0 },
    ],
  },
  {
    // Leading zeros must survive the round trip; only the threshold criterion was evaluated.
    applicationId: app2, idNumber: "007123456", companyId: "co2", passedThreshold: false,
    scores: [{ criterionId: critBoolean._id, actualValue: false }],
  },
  {
    applicationId: app3, idNumber: "555555555", companyId: "co1", rejectionReason: "פסילה כפולה",
    scores: [
      { criterionId: critBoolean._id, actualValue: true },
      { criterionId: critRatio._id, actualValue: 5, computedScore: 50 },
      { criterionId: critRatio._id, actualValue: 6, computedScore: 60 },
    ],
  },
];

const data: TenderMatrixData = { criteria: [critBoolean, critRatio, critDirect], stages: [stage], applications };

const rows: TenderRow[] = [
  { applicationId: app1, candidate: "מועמד א", summary: { _id: "s1", applicationId: app1, finalWeightedScore: 0, isWinner: false } },
  { applicationId: app2, candidate: "מועמד ב" },
  { applicationId: app3, candidate: "מועמד ג", summary: { _id: "s3", applicationId: app3, finalWeightedScore: 99 } },
];

const companyLabel = (companyId: string | undefined) => (companyId === "co1" ? "חברה א" : companyId === "co2" ? "חברה ב" : (companyId ?? "—"));

test("The matrix export mirrors the screen's column order, including missing criteria that sort before a stage", () => {
  const sheet = buildMatrixSheet(data, rows, companyLabel);
  assert.equal(sheet.name, "מפ״ל מפורט");
  assert.deepEqual(sheet.header, [
    "חברה", "שם מועמד", "ת״ז", "עמידה בסף",
    "מבחן (ציון ישיר)",
    "ראיון טלפוני · 30% — תנאי סף",
    "ראיון טלפוני · 30% — ראיון (ערך / ציון מחושב)",
    "תעריף שעתי", "ציון סופי", "החלטה",
  ]);
});

test("Real zeros and false survive export; missing evaluations and a rejected final score become empty cells", () => {
  const sheet = buildMatrixSheet(data, rows, companyLabel);
  assert.deepEqual(sheet.rows[0], ["חברה א", "מועמד א", "123456789", "עבר", 0, "עבר", "8 / 80", 0, 0, "טרם נקבעה"]);
  assert.deepEqual(sheet.rows[1], ["חברה ב", "מועמד ב", "007123456", "לא עבר", undefined, "לא עבר", undefined, undefined, "טרם חושב", "טרם נקבעה"]);
  // app3 has a saved finalWeightedScore (99) but was rejected: the export must not leak it.
  assert.deepEqual(sheet.rows[2], ["חברה א", "מועמד ג", "555555555", "טרם אושר", undefined, "עבר", "כמה הערכות — נדרש בירור", undefined, undefined, "פסילה כפולה"]);
});

test("The summary sheet has no action column and still preserves zero scores", () => {
  const summaryRows: TenderRow[] = [
    { applicationId: app1, candidate: "מועמד א", summary: { _id: "s1", applicationId: app1, rankPosition: 1, totalQualityScore: 85, priceScore: 0, finalWeightedScore: 0, isWinner: true } },
    { applicationId: app2, candidate: "מועמד ב", summary: { _id: "s2", applicationId: app2, isWinner: false } },
    { applicationId: app3, candidate: "מועמד ג" },
  ];
  const sheet = buildSummarySheet(summaryRows);
  assert.equal(sheet.name, "מפ״ל");
  assert.deepEqual(sheet.header, ["דירוג", "מועמד", "ציון איכות", "ציון מחיר", "ציון משוקלל", "זכייה"]);
  assert.ok(!sheet.header.includes("פעולה"));
  assert.deepEqual(sheet.rows[0], [1, "מועמד א", 85, 0, 0, "זוכה"]);
  assert.deepEqual(sheet.rows[1], [undefined, "מועמד ב", undefined, undefined, undefined, "לא זוכה"]);
  assert.deepEqual(sheet.rows[2], [undefined, "מועמד ג", undefined, undefined, undefined, "טרם נקבע"]);
});

test("buildXlsx rejects an empty sheet list and an oversized sheet", () => {
  assert.throws(() => buildXlsx([]), /אין נתונים לייצוא/);
  assert.throws(
    () => buildXlsx([{ name: "x", header: ["a"], rows: Array.from({ length: 100_001 }, () => ["v"]) }]),
    /מספר השורות חורג/,
  );
});

test("The generated workbook is RTL, frozen, filterable, contains no formulas, and keeps ID leading zeros as text", () => {
  const sheet = buildMatrixSheet(data, rows, companyLabel);
  const bytes = buildXlsx([sheet]);
  const files = unzipSync(bytes);
  for (const part of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(files[part], part + " is missing from the workbook");
  }
  const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
  assert.match(worksheet, /rightToLeft="1"/);
  assert.match(worksheet, /state="frozen"/);
  assert.match(worksheet, /<autoFilter ref="A1:J4"\/>/);
  assert.doesNotMatch(worksheet, /<f[ >]/);
  assert.match(worksheet, /<t>007123456<\/t>/);
  assert.doesNotMatch(worksheet, /<v>007123456<\/v>/);
  const workbook = strFromU8(files["xl/workbook.xml"]!);
  assert.match(workbook, /_xlnm\._FilterDatabase/);
});

test("A formula-looking value is written as an escaped inline string, never a real formula", () => {
  const injected = '=HYPERLINK("http://evil.example")';
  const bytes = buildXlsx([{ name: "בדיקה", header: ["שדה"], rows: [[injected]], rightToLeft: true }]);
  const files = unzipSync(bytes);
  const worksheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
  assert.doesNotMatch(worksheet, /<f[ >]/);
  assert.match(worksheet, /t="inlineStr"/);
  assert.ok(worksheet.includes("<t>" + injected + "</t>"), "the formula text must appear verbatim inside an inline string");
});

test("XML control characters and markup are stripped or escaped, not left to break the document", () => {
  const bytes = buildXlsx([{ name: "בדיקה", header: ["שדה"], rows: [["<script>&\u0007bad</script>"]] }]);
  const worksheet = strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]!);
  assert.doesNotMatch(worksheet, /\u0007/);
  assert.match(worksheet, /&lt;script&gt;&amp;bad&lt;\/script&gt;/);
});

test("columnName is 0-indexed and wraps like spreadsheet columns", () => {
  assert.equal(columnName(0), "A");
  assert.equal(columnName(25), "Z");
  assert.equal(columnName(26), "AA");
  assert.equal(columnName(701), "ZZ");
});

test("sheetNames strips illegal characters, truncates to 31 characters and de-duplicates", () => {
  const [cleaned] = sheetNames(["A:B*C?/D\\E[F]G"]);
  assert.equal(cleaned, "ABCDEFG");
  const long = "א".repeat(40);
  const [truncated] = sheetNames([long]);
  assert.equal(truncated!.length, 31);
  const [first, second] = sheetNames(["מפ״ל", "מפ״ל"]);
  assert.equal(first, "מפ״ל");
  assert.equal(second, "מפ״ל (2)");
});

test("xlsxFileName includes the position title and date, or a generic name when the title is unknown", () => {
  const date = new Date("2026-10-07T00:00:00Z");
  assert.equal(xlsxFileName("מפתח תוכנה", date), "מפ״ל - מפתח תוכנה 2026-10-07.xlsx");
  assert.equal(xlsxFileName(undefined, date), "מפ״ל 2026-10-07.xlsx");
  assert.equal(xlsxFileName('A/B:C"D', date), "מפ״ל - ABCD 2026-10-07.xlsx");
  assert.equal(tenderExportTitle("  "), undefined);
  assert.equal(tenderExportTitle(" מפתח תוכנה "), "מפתח תוכנה");
});

test("The export button sits above the table and is disabled only when there are no rows", () => {
  const empty = renderToStaticMarkup(<TenderSummaryTable rows={[]} onDetails={() => {}} />);
  const emptyButton = empty.match(/<button[^>]*>ייצוא לאקסל<\/button>/)?.[0];
  assert.ok(emptyButton);
  assert.match(emptyButton, /aria-label="ייצוא טבלת המפ״ל לקובץ אקסל"/);
  assert.match(emptyButton, /disabled=""/);
  assert.ok(empty.indexOf("ייצוא לאקסל") < empty.indexOf("<table"));

  const filled = renderToStaticMarkup(<TenderSummaryTable rows={rows} onDetails={() => {}} exportTitle="מפתח תוכנה" />);
  const filledButton = filled.match(/<button[^>]*>ייצוא לאקסל<\/button>/)?.[0];
  assert.ok(filledButton);
  assert.doesNotMatch(filledButton, /disabled/);
  assert.ok(filled.indexOf("ייצוא לאקסל") < filled.indexOf("<table"));
});
