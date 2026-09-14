import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { hasPermission, type AuthSession } from "../src/auth/permissions";
import { AuthContext, type AuthState } from "../src/auth/AuthProvider";
import { PermissionGate } from "../src/auth/PermissionGate";
import { CandidateForm } from "../src/features/candidates/CandidateForm";
import { CandidateDetailsPage } from "../src/features/candidates/CandidateDetailsPage";
import { candidatePayload } from "../src/features/candidates/candidate-fields";
import { apiRequest, ApiError } from "../src/api/client";

const reader: AuthSession = { user: { _id: "test-user" }, permissions: [{ resource: "Candidate", actions: ["READ"] }] };

test("Permissions are exact, resource-specific, and deny missing sessions", () => {
  assert.equal(hasPermission(null, "Candidate", "READ"), false);
  assert.equal(hasPermission(reader, "Candidate", "READ"), true);
  assert.equal(hasPermission(reader, "Candidate", "WRITE"), false);
  assert.equal(hasPermission(reader, "Application", "READ"), false);
  assert.equal(hasPermission({ ...reader, permissions: [{ resource: "Candidate", actions: ["WRITE"] }] }, "Candidate", "READ"), false);
});

test("Permission gates withhold protected content until explicitly allowed", () => {
  const render = (auth: AuthState) => renderToStaticMarkup(
    <AuthContext.Provider value={auth}><PermissionGate resource="Candidate" action="WRITE">
      <div>protected-editor</div>
    </PermissionGate></AuthContext.Provider>,
  );
  for (const status of ["unavailable", "loading", "error"] as const) {
    assert.doesNotMatch(render({ status, session: reader, reload() {} }), /protected-editor/);
  }
  assert.doesNotMatch(render({ status: "ready", session: reader, reload() {} }), /protected-editor/);
  const writer = { ...reader, permissions: [{ resource: "Candidate", actions: ["WRITE"] }] };
  assert.match(render({ status: "ready", session: writer, reload() {} }), /protected-editor/);
});

test("Candidate details never render protected data without read permission", () => {
  const html = renderToStaticMarkup(<MemoryRouter><CandidateDetailsPage /></MemoryRouter>);
  assert.match(html, /הרשאותיו טרם התקבלו/);
  assert.doesNotMatch(html, /טוען את פרטי המועמד/);
});

test("Both form modes use only approved fields, preserve leading zeros, and disable unauthorized saving", () => {
  const candidate = { _id: "ignored", fullName: "Example", idNumber: "000000018", phone: "", email: "" };
  const html = renderToStaticMarkup(<CandidateForm initialCandidate={candidate} canSave={false} onSave={async () => {}} onCancel={() => {}} />);
  assert.match(html, /value="000000018"/);
  assert.match(html, /fieldset[^>]*disabled/);
  assert.deepEqual([...html.matchAll(/name="([^"]+)"/g)].map((match) => match[1]), ["fullName", "idNumber", "phone", "email"]);
  const payload = candidatePayload({ ...candidate, fullName: " Example " });
  assert.deepEqual(payload, { fullName: "Example", idNumber: "000000018", phone: "", email: "" });
  assert.equal("_id" in payload, false);
});

test("Shared API transport handles writes, empty responses, forbidden access and cancellation", async () => {
  const originalFetch = globalThis.fetch;
  const requests: RequestInit[] = [];
  try {
    globalThis.fetch = async (_url, init) => {
      requests.push(init ?? {});
      return new Response(JSON.stringify({ _id: "saved" }), { status: 201 });
    };
    const saved = await apiRequest<{ _id: string }>("/candidates", { method: "POST", body: { idNumber: "000000018" } });
    assert.equal(saved._id, "saved");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.body, '{"idNumber":"000000018"}');
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await apiRequest("/candidates/example", { method: "DELETE" }), undefined);
    globalThis.fetch = async () => new Response("Forbidden", { status: 403 });
    await assert.rejects(apiRequest("/candidates"), (error: unknown) => error instanceof ApiError && error.status === 403);
    globalThis.fetch = async () => { throw new DOMException("aborted", "AbortError"); };
    await assert.rejects(apiRequest("/candidates"), (error: unknown) => error instanceof Error && error.name === "AbortError");
  } finally { globalThis.fetch = originalFetch; }
});


test("Candidate payload rejects invalid identity/contact fields before any API call", () => {
  const fields = { idNumber: "000000018", fullName: "", phone: "", email: "" };
  for (const [name, value] of [["idNumber", "12345678"], ["phone", "123"], ["email", "a@@b.com"]]) {
    assert.throws(() => candidatePayload({ ...fields, [name!]: value! }));
  }
  assert.equal(candidatePayload({ ...fields, phone: "+972 50 1234567", email: "user+tag@example.com" }).idNumber, "000000018");
});

test("Editing candidates accepts simple phone formats and allows clearing the optional phone", () => {
  const fields = { idNumber: "000000018", fullName: "Edited candidate", phone: "", email: "" };
  for (const phone of ["0501234567", "(03) 123-4567", "0601234567", "000-000-0001", "+972 (0)50-1234567", ""]) {
    assert.equal(candidatePayload({ ...fields, phone }).phone, phone);
  }
  assert.throws(() => candidatePayload({ ...fields, phone: "call me" }));
});

test("Candidate ID fields accept nine digits without checksum calculations", () => {
  const fields = { idNumber: "", fullName: "Example", phone: "", email: "" };
  for (const idNumber of ["000000001", "123456789", "000000000"]) {
    assert.equal(candidatePayload({ ...fields, idNumber: " " + idNumber + " " }).idNumber, idNumber);
  }
  for (const idNumber of ["", "12345678", "1234567890", "12345a789", "123-45678"]) {
    assert.throws(() => candidatePayload({ ...fields, idNumber }));
  }
});
