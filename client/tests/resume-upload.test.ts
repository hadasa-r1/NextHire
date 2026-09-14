import assert from "node:assert/strict";
import { test } from "node:test";
import { apiRequest, ApiError } from "../src/api/client";
import { resumeFileIssue, MAX_RESUME_BYTES } from "../../server/src/validation/resume-file.mjs";

test("File policy accepts PDF/DOCX, rejects empty/oversized/unsupported selections", () => {
  assert.equal(resumeFileIssue("קורות חיים.PDF", 100), undefined);
  assert.equal(resumeFileIssue("resume.docx", MAX_RESUME_BYTES), undefined);
  assert.ok(resumeFileIssue("resume.doc", 10));
  assert.ok(resumeFileIssue("resume.pdf", 0));
  assert.ok(resumeFileIssue("resume.pdf", MAX_RESUME_BYTES + 1));
});
test("Shared API uploads file bytes with encoded filename and retains error handling", async () => {
  const original = globalThis.fetch;
  const file = new File(["PDF content"], "קורות חיים.pdf", { type: "application/pdf" });
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.body, file);
      assert.equal(new Headers(init?.headers).get("Content-Type"), "application/octet-stream");
      assert.equal(decodeURIComponent(new Headers(init?.headers).get("X-File-Name")!), file.name);
      return new Response(JSON.stringify({ path: "/api/resumes/example.pdf" }), { status: 201 });
    };
    assert.deepEqual(await apiRequest("/resumes", { method: "POST", file }), { path: "/api/resumes/example.pdf" });
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "הקובץ אינו תקין." }), { status: 415 });
    await assert.rejects(apiRequest("/resumes", { method: "POST", file }), (error: unknown) => error instanceof ApiError && error.status === 415);
  } finally { globalThis.fetch = original; }
});
