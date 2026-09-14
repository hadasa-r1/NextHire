import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { isLocalDemo } from "../src/demo/demo-mode";
import { loadDemoSession, loadDemoOptions, demoEvaluationServices, DEMO_POSITION_IDS } from "../src/demo/local-demo";
import { DemoBanner } from "../src/demo/DemoBanner";
import { demoCriteria } from "@evaluation-demo";
import { hasPermission } from "../src/auth/permissions";
import { AuthContext } from "../src/auth/AuthProvider";
import { PermissionGate } from "../src/auth/PermissionGate";
import { CandidateForm } from "../src/features/candidates/CandidateForm";
import { ApplicationForm } from "../src/features/applications/ApplicationForm";

test("Demo can only be enabled explicitly in development on loopback", () => {
  assert.equal(isLocalDemo(true, "true", "localhost"), true);
  assert.equal(isLocalDemo(true, "true", "127.0.0.1"), true);
  assert.equal(isLocalDemo(false, "true", "localhost"), false);
  assert.equal(isLocalDemo(true, undefined, "localhost"), false);
  assert.equal(isLocalDemo(true, "false", "localhost"), false);
  assert.equal(isLocalDemo(true, "true", "nexthire.example"), false);
  assert.equal(isLocalDemo(true, "true", "localhost.example"), false);
});
test("Demo session enables candidate and application CRUD through the existing permission checks", async () => {
  const session = await loadDemoSession(new AbortController().signal);
  assert.equal(hasPermission(session, "Candidate", "READ"), true);
  assert.equal(hasPermission(session, "Candidate", "WRITE"), true);
  assert.equal(hasPermission(session, "Application", "WRITE"), true);
  assert.equal(hasPermission(session, "Position", "WRITE"), false);
  const html = renderToStaticMarkup(<MemoryRouter><AuthContext.Provider value={{ status: "ready", session, reload() {} }}>
    <PermissionGate resource="Candidate" action="WRITE"><CandidateForm canSave onSave={async () => {}} onCancel={() => {}} /></PermissionGate>
  </AuthContext.Provider></MemoryRouter>);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /type="submit" disabled/);
  assert.doesNotMatch(html, /הרשאותיו טרם התקבלו/);
});
test("Demo supplies selectable reference IDs without creating Group A models", async () => {
  const signal = new AbortController().signal;
  const positions = await loadDemoOptions("Position", signal);
  const companies = await loadDemoOptions("Company", signal);
  assert.ok(positions.length && companies.length);
  for (const option of [...positions, ...companies]) {
    assert.match(option.id, /^[a-f\d]{24}$/i);
    assert.match(option.label, /הדגמה/);
  }
  const html = renderToStaticMarkup(<ApplicationForm positions={positions} companies={companies}
    candidates={[{ _id: "507f1f77bcf86cd799439011", idNumber: "000000001" }]} canSave onSave={async () => {}} onCancel={() => {}} />);
  assert.match(html, /משרת פיתוח/);
  assert.doesNotMatch(html, /type="submit" disabled/);
  assert.equal(demoCriteria(DEMO_POSITION_IDS[0]).length, 3);
  assert.equal(typeof demoEvaluationServices.saveEvaluations, "function");
  assert.equal(typeof demoEvaluationServices.previewScore, "function");
});
test("Demo banner always identifies the mode and is absent otherwise", () => {
  assert.match(renderToStaticMarkup(<DemoBanner enabled />), /מצב הדגמה מקומי/);
  assert.equal(renderToStaticMarkup(<DemoBanner enabled={false} />), "");
});

