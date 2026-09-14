import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { applicationFields, applicationPayload, candidateLabel } from "../src/features/applications/application-fields";
import { ApplicationForm } from "../src/features/applications/ApplicationForm";
import { ApplicationsPage } from "../src/features/applications/ApplicationsPage";
import { ApplicationDetailsPage } from "../src/features/applications/ApplicationDetailsPage";
import { webDocumentUrl } from "../src/shared/DocumentButton";

const id = "507f1f77bcf86cd799439011";
test("Application payload contains only five approved fields and preserves zero", () => {
  const input = {
    positionId: id, candidateId: id, companyId: id, hourlyRateBid: "0", resumeUrl: " https://example.com/resume.pdf ",
    status: "invented", currentStage: "invented", passedThreshold: true, rejectionReason: "hidden",
  };
  assert.deepEqual(applicationPayload(input), {
    positionId: id, candidateId: id, companyId: id, hourlyRateBid: 0, resumeUrl: "https://example.com/resume.pdf",
  });
});
test("Missing optional values are omitted, never defaulted or set to null", () => {
  assert.deepEqual(applicationPayload({ positionId: "", candidateId: "", companyId: "", hourlyRateBid: "", resumeUrl: "https://example.com/cv" }), {
    resumeUrl: "https://example.com/cv",
  });
  assert.throws(() => applicationPayload(applicationFields()), /קישור לקורות חיים/);
});
test("Invalid IDs and nonfinite numbers are rejected, and clearing existing values is not silently ignored", () => {
  const initial = { _id: id, positionId: id, hourlyRateBid: 0, resumeUrl: "https://example.com/cv" };
  const fields = applicationFields(initial);
  assert.throws(() => applicationPayload({ ...fields, candidateId: "bad-id" }), /ערך תקין/);
  assert.throws(() => applicationPayload({ ...fields, hourlyRateBid: "Infinity" }), /מספר תקין/);
  assert.throws(() => applicationPayload({ ...fields, positionId: "" }, initial), /מחיקת קשר/);
  assert.throws(() => applicationPayload({ ...fields, hourlyRateBid: "" }, initial), /מחיקת תעריף/);
  assert.equal(applicationPayload(fields, initial).hourlyRateBid, 0);
});
test("New application form exposes only submission controls and requires a resume file", () => {
  const html = renderToStaticMarkup(<ApplicationForm canSave={false} positions={[]} companies={[]} candidates={[]}
    prefill={{ candidateId: id }} onSave={async () => {}} onCancel={() => {}} />);
  assert.deepEqual([...html.matchAll(/name="([^"]+)"/g)].map((match) => match[1]), [
    "positionId", "candidateId", "companyId", "hourlyRateBid", "resumeFile",
  ]);
  assert.equal([...html.matchAll(/ required=/g)].length, 1);
  assert.match(html, /fieldset[^>]*disabled/);
  assert.match(html, /type="file"/);
  assert.match(html, /accept="[^"]*\.docx/);
  assert.doesNotMatch(html, /type="url"/);
  assert.doesNotMatch(html, /name="(status|currentStage|passedThreshold|rejectionReason)"/);
});
test("Document opening rejects executable, local and credential-bearing links", () => {
  assert.equal(webDocumentUrl("javascript:alert(1)"), null);
  assert.equal(webDocumentUrl("data:text/html,test"), null);
  assert.equal(webDocumentUrl("file:///C:/resume.pdf"), null);
  assert.equal(webDocumentUrl("https://name:password@example.com/cv"), null);
  assert.equal(webDocumentUrl(" /resume.pdf "), null);
  assert.equal(webDocumentUrl(" https://example.com/cv "), "https://example.com/cv");
});
test("Application screens retain fail-closed access until Group C is connected", () => {
  for (const page of [<ApplicationsPage />, <ApplicationDetailsPage />]) {
    const html = renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>);
    assert.match(html, /הרשאותיו טרם התקבלו/);
    assert.doesNotMatch(html, /name="resumeUrl"/);
  }
});
test("Candidate labels distinguish populated candidates from references and missing records", () => {
  assert.equal(candidateLabel({ _id: id, resumeUrl: "x", candidateId: null }), "—");
  assert.equal(candidateLabel({ _id: id, resumeUrl: "x", candidateId: id }), "מזהה מועמד: " + id);
  assert.equal(candidateLabel({ _id: id, resumeUrl: "x", candidateId: { _id: id, idNumber: "0001", fullName: "Example" } }), "Example");
});


test("Application payload rejects negative prices and malformed document URLs", () => {
  const fields = { positionId: "", candidateId: "", companyId: "", hourlyRateBid: "0", resumeUrl: "https://example.com/cv" };
  assert.throws(() => applicationPayload({ ...fields, hourlyRateBid: "-0.01" }), /שלילי/);
  assert.throws(() => applicationPayload({ ...fields, resumeUrl: "javascript:alert(1)" }), /קישור/);
  assert.throws(() => applicationPayload({ ...fields, resumeUrl: "https:example.com" }), /קישור/);
});

test("Editing keeps the existing resume unless a replacement file is selected", () => {
  const html = renderToStaticMarkup(<ApplicationForm initialApplication={{ _id: id, resumeUrl: "https://example.com/existing.pdf" }}
    canSave positions={[]} companies={[]} candidates={[]} onSave={async () => {}} onCancel={() => {}} />);
  assert.match(html, /type="file"/);
  assert.doesNotMatch(html, / required=/);
  assert.match(html, /פתיחת קורות החיים הקיימים/);
  assert.doesNotMatch(html, /type="url"/);
});
