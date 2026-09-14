import assert = require("node:assert/strict");
import test = require("node:test");
import Candidate = require("../src/models/candidate.model");
import Application = require("../src/models/application.model");
import EvaluationScore = require("../src/models/evaluation-score.model");
import TenderSummary = require("../src/models/tender-summary.model");
import rules = require("../src/validation/field-rules.mjs");

test("ID format requires exactly nine digits without checksum validation, preserving leading zeros", async () => {
  for (const id of ["000000018", "000000026", "123456782", "000000000", "000000001", "123456783", "123456789"]) assert.equal(rules.isIsraeliId(id), true, id);
  for (const id of ["", "12345678", "1234567820", "12345a782", "123-45678", "123456789\n", 123456782, null]) {
    assert.equal(rules.isIsraeliId(id), false, String(id));
  }
});
test("Phone format accepts 9–10 digits and familiar separators without prefix restrictions", () => {
  for (const phone of [
    "0501234567", "050-123-4567", "02 1234567", "(03) 123-4567",
    "0771234567", "0601234567", "501234567", "000-000-0001",
    "+972 50 1234567", "+972-2-1234567", "+972 (0)50-1234567", " 0501234567 ",
  ]) assert.equal(rules.isPhone(phone), true, phone);
  for (const phone of ["123", "12345678", "05012345678", "abc0501234567", "++972501234567",
    "+123456789", "050+1234567", "0501234567 ext 2", "050\n1234567", "----------", "", 501234567, null]) {
    assert.equal(rules.isPhone(phone), false, String(phone));
  }
});
test("Email and document formats reject malformed values and unsafe URL schemes", async () => {
  for (const email of ["user@example.com", "a.b+tag@example.co.il", "o'neil@example.com"]) assert.equal(rules.isEmail(email), true);
  for (const email of ["a@", "a@@example.com", "a@example", ".a@example.com", "a..b@example.com", "a@-example.com", "a b@example.com"]) assert.equal(rules.isEmail(email), false);
  for (const url of ["javascript:alert(1)", "file:///cv.pdf", "https:example.com", "https://user:secret@example.com", "https://example.com/a b", "https://example.com\\path"]) assert.equal(rules.webDocumentUrl(url), null);
  assert.equal(rules.webDocumentUrl(" https://example.com/cv.pdf "), "https://example.com/cv.pdf");
});
test("Candidate schema validates fields independently and keeps optional fields optional", async () => {
  await assert.doesNotReject(new Candidate({ idNumber: "000000018" }).validate());
  await assert.doesNotReject(new Candidate({ idNumber: " 000000018 ", phone: " ", email: "" }).validate());
  for (const fields of [
    { idNumber: "12345678" }, { idNumber: 123456782 }, { phone: "000123" },
    { phone: 501234567 }, { phone: null }, { email: "invalid" }, { fullName: 123 },
  ]) await assert.rejects(new Candidate({ idNumber: "000000018", ...fields }).validate());
  const candidate = new Candidate({ idNumber: "000000018", phone: "+972 50 1234567", email: "a+tag@example.com" });
  await assert.doesNotReject(candidate.validate());
  assert.equal(candidate.idNumber, "000000018");
  assert.equal(Candidate.schema.path("idNumber").options.unique, undefined);
});
test("Application, evaluation and summary enforce numeric and URL formats, not invented scoring limits", async () => {
  await assert.doesNotReject(new Application({ resumeUrl: "https://example.com/cv", hourlyRateBid: 0 }).validate());
  for (const fields of [{ resumeUrl: "javascript:alert(1)" }, { hourlyRateBid: -1 }, { hourlyRateBid: Infinity }, { hourlyRateBid: true }, { hourlyRateBid: "12" }]) {
    await assert.rejects(new Application({ resumeUrl: "https://example.com/cv", ...fields }).validate());
  }
  for (const actualValue of [false, true, 0, 6.5]) await assert.doesNotReject(new EvaluationScore({ actualValue }).validate());
  for (const actualValue of ["true", "2", {}, [], null, Infinity, NaN]) await assert.rejects(new EvaluationScore({ actualValue }).validate());
  for (const rankPosition of [0, -1, 1.5, Infinity]) await assert.rejects(new TenderSummary({ rankPosition }).validate());
  await assert.doesNotReject(new TenderSummary({ rankPosition: 1, finalWeightedScore: 120 }).validate());
  await assert.rejects(new TenderSummary({ awardLetterUrl: "file:///award.pdf" }).validate());
  await assert.doesNotReject(new TenderSummary({}).validate());
});
