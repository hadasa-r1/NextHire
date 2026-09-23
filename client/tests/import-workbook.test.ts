import assert from "node:assert/strict";
import { test } from "node:test";
import { rowsFromCells } from "../src/features/applications/import-workbook";
test("MAFAL import reads only candidate rows, ignores explanation/footer and does not import score columns", () => {
  const result = rowsFromCells([
    { row: 1, cells: { 1: { text: "חברה" }, 2: { text: "תז מועמד" }, 3: { text: "שם מועמד" }, 7: { text: "ציון: ראיון 30%" } } },
    { row: 2, cells: { 2: { text: "12345678", numeric: true }, 3: { text: "מועמד לבדיקה" }, 7: { text: "100", formula: true } } },
    { row: 3, cells: { 7: { text: "0.000 " } } },
    { row: 18, cells: { 0: { text: "השכלה " }, 2: { text: "ניסיון נדרש" }, 3: { text: "אין חובה בניסיון" } } },
  ], "מועמדים");
  assert.equal(result.supported, true);
  assert.deepEqual(result.rows, [{ fullName: "מועמד לבדיקה", idNumber: "012345678" }]);
  assert.deepEqual(result.issues, []);
});
test("Import recognizes complete candidate columns, retains zero prices and rejects formulas or invalid prices", () => {
  const header = { row: 1, cells: { 0: { text: "fullName" }, 1: { text: "idNumber" }, 2: { text: "hourlyRateBid" }, 3: { text: "LinkedIn" }, 4: { text: "קורות חיים" } } };
  const result = rowsFromCells([header, { row: 2, cells: { 0: { text: "Name" }, 1: { text: "000000001" }, 2: { text: "0" }, 3: { text: "https://linkedin.com/in/example" }, 4: { text: "https://example.com/cv.pdf" } } }], "Candidates");
  assert.equal(result.rows[0]?.hourlyRateBid, 0);
  assert.equal(result.rows[0]?.idNumber, "000000001");
  assert.equal(result.rows[0]?.linkedinUrl, "https://linkedin.com/in/example");
  assert.ok(rowsFromCells([header, { row: 2, cells: { 0: { text: "Name", formula: true }, 1: { text: "123456789" }, 2: { text: "-2" } } }], "Candidates").issues.length === 2);
  assert.equal(rowsFromCells([{ row: 1, cells: { 0: { text: "תנאי סף" } } }], "ראיון").supported, false);
});
