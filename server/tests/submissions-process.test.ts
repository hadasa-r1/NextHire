import assert = require("node:assert/strict");
import test = require("node:test");
import crypto = require("node:crypto");
import mongoose = require("mongoose");
import type { Request } from "express";
import Repository = require("../src/repository/repository");
import Candidate = require("../src/models/candidate.model");
import Application = require("../src/models/application.model");
import EvaluationScore = require("../src/models/evaluation-score.model");
import SubmissionService = require("../src/services/submission.service");
import EvaluationService = require("../src/services/evaluation.service");
import demo = require("../src/demo/evaluation-data.mjs");
import processRules = require("../src/validation/process.mjs");

test("Imports reuse identities, retry safely, reject cross-company duplicates and enforce interview order", async t => {
  const database = "nexthire_import_test_" + crypto.randomUUID().replaceAll("-", "");
  await mongoose.connect("mongodb://127.0.0.1:27017/" + database);
  const candidates = new Repository(Candidate), applications = new Repository(Application), scores = new Repository(EvaluationScore);
  const positionId = demo.DEMO_POSITION_IDS[0], otherPosition = demo.DEMO_POSITION_IDS[1];
  const companyId = "de0000000000000000000011", otherCompany = "de0000000000000000000012", interviewerId = "de0000000000000000000099";
  let authorized = true;
  const dependencies = {
    async resolveSession() { return authorized ? { user: { _id: interviewerId }, permissions: ["Candidate", "Application", "EvaluationScore", "TenderSummary"].map(resource => ({ resource, actions: ["READ", "WRITE"] })) } : null; },
    async authorizeSubmission(_req: Request, position: string, company: string) { return [positionId, otherPosition].includes(position as typeof positionId) && [companyId, otherCompany].includes(company); },
    async loadCriteria(position: string) { return demo.demoCriteria(position); },
    async loadStages(position: string) { return demo.demoStages(position); },
  };
  const service = new SubmissionService(candidates, applications, dependencies);
  const workflow = new EvaluationService(applications, scores, dependencies), req = {} as Request;
  const person = { fullName: "Import fixture", idNumber: "123456789", phone: "050-1234567", linkedinUrl: "https://linkedin.com/in/example", githubUrl: "https://github.com/example", resumeUrl: "https://example.com/cv.pdf", hourlyRateBid: 150 };
  let applicationId = "", candidateId = "";
  try {
    await t.test("Preflight rejects missing resume and writes nothing, even when another row is valid", async () => {
      const body = { positionId, companyId, rows: [person, { fullName: "Missing CV", idNumber: "987654321" }] };
      const preview = await service.preview(req, body);
      assert.ok(preview.rows[1]!.errors.length);
      await assert.rejects(service.commit(req, body));
      assert.equal((await candidates.getAll()).length, 0);
      assert.equal((await applications.getAll()).length, 0);
    });
    await t.test("Malformed URLs, invalid IDs, numeric resume fields and duplicate input rows are rejected", async () => {
      for (const row of [{ ...person, idNumber: "bad" }, { ...person, resumeUrl: 123 }, { ...person, linkedinUrl: "javascript:alert(1)" }]) {
        await assert.rejects(service.commit(req, { positionId, companyId, rows: [row] }));
      }
      await assert.rejects(service.commit(req, { positionId, companyId, rows: [person, person] }));
      assert.equal((await candidates.getAll()).length, 0);
    });
    await t.test("Unauthorized company and session cannot submit", async () => {
      await assert.rejects(service.commit(req, { positionId, companyId: interviewerId, rows: [person] }));
      authorized = false;
      await assert.rejects(service.commit(req, { positionId, companyId, rows: [person] }));
      authorized = true;
    });
    await t.test("Concurrent retries create one candidate and one application with optional profile data", async () => {
      const results = await Promise.all([service.commit(req, { positionId, companyId, rows: [person] }), service.commit(req, { positionId, companyId, rows: [person] })]);
      assert.ok(results.every(result => result.complete));
      assert.equal((await candidates.getAll()).length, 1);
      assert.equal((await applications.getAll()).length, 1);
      applicationId = results[0]!.results[0]!.applicationId!;
      candidateId = results[0]!.results[0]!.candidateId!;
      assert.equal((await candidates.getById(candidateId))?.githubUrl, person.githubUrl);
      assert.equal((await applications.getById(applicationId))?.hourlyRateBid, 150);
      const retried = await service.commit(req, { positionId, companyId, rows: [{ idNumber: person.idNumber, fullName: "Do not overwrite" }] });
      assert.equal(retried.results[0]!.applicationId, applicationId);
      assert.equal((await candidates.getById(candidateId))?.fullName, person.fullName);
    });
    await t.test("Phone interview requires threshold approval and frontal interview requires every phone criterion", async () => {
      const criteria = demo.demoCriteria(positionId), stages = demo.demoStages(positionId);
      const threshold = criteria.find(c => c.type === "BOOLEAN")!;
      const phone = criteria.filter(c => c.stageId === stages[1]!._id);
      const frontal = criteria.find(c => c.stageId === stages[2]!._id)!;
      await assert.rejects(workflow.save(req, applicationId, { criterionId: frontal._id, actualValue: 3 }));
      await assert.rejects(workflow.passThreshold(req, applicationId));
      await workflow.save(req, applicationId, { criterionId: threshold._id, actualValue: true });
      await assert.rejects(workflow.save(req, applicationId, { criterionId: phone[0]!._id, actualValue: 3 }));
      await workflow.passThreshold(req, applicationId);
      for (const criterion of phone) {
        await assert.rejects(workflow.save(req, applicationId, { criterionId: frontal._id, actualValue: 3 }));
        await workflow.save(req, applicationId, { criterionId: criterion._id, actualValue: 3 });
      }
      await workflow.save(req, applicationId, { criterionId: frontal._id, actualValue: 4 });
      const process = await workflow.process(req, applicationId);
      assert.equal(process.steps[1]?.state, "complete");
      assert.equal(process.steps[2]?.state, "available");
      await workflow.save(req, applicationId, { criterionId: threshold._id, actualValue: false });
      await assert.rejects(workflow.save(req, applicationId, { criterionId: frontal._id, actualValue: 5 }));
      await workflow.save(req, applicationId, { criterionId: threshold._id, actualValue: true });
    });
    await t.test("The same candidate can be submitted to a different position without disqualification", async () => {
      const result = await service.commit(req, { positionId: otherPosition, companyId: otherCompany, rows: [person] });
      assert.equal(result.complete, true);
      assert.equal(result.results[0]!.rejected, false);
      assert.equal(result.results[0]!.candidateId, candidateId);
    });
    await t.test("Submitting the same identity through another company disqualifies both applications and blocks all further scoring", async () => {
      const result = await service.commit(req, { positionId, companyId: otherCompany, rows: [person] });
      assert.equal(result.complete, true);
      assert.equal(result.results[0]!.rejected, true);
      const both = await applications.getAll({ positionId });
      assert.equal(both.length, 2);
      assert.ok(both.every(application => application.rejectionReason?.includes("יותר מחברה")));
      await assert.rejects(workflow.passThreshold(req, applicationId));
      await assert.rejects(workflow.save(req, applicationId, { criterionId: demo.demoCriteria(positionId)[0]!._id, actualValue: true }));
      const matrix = await workflow.matrix(req, positionId);
      assert.equal(matrix.applications.length, 2);
      assert.ok(matrix.applications.every(row => row.rejectionReason));
    });
    await t.test("Nonunique identity records require explicit matching; duplicate detection also crosses distinct Candidate IDs", async () => {
      const second = await candidates.add({ idNumber: person.idNumber, fullName: "Legacy duplicate" });
      const preview = await service.preview(req, { positionId, companyId, rows: [person] });
      assert.ok(preview.rows[0]!.errors.some(message => message.includes("כמה רשומות")));
      const result = await service.commit(req, { positionId, companyId, rows: [{ candidateId: String(second._id), resumeUrl: person.resumeUrl }] });
      assert.equal(result.complete, true);
      assert.equal(result.results[0]!.rejected, true);
    });
  } finally {
    assert.equal(mongoose.connection.name, database);
    assert.ok(database.startsWith("nexthire_import_test_"));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
test("Stage progression fails closed for absent, stale, duplicate or unordered prerequisites and quotas", () => {
  const position = demo.DEMO_POSITION_IDS[0], criteria = demo.demoCriteria(position), stages = demo.demoStages(position);
  const values = criteria.map(c => ({ criterionId: c._id, actualValue: c.type === "BOOLEAN" ? true : 0, ...(c.type === "SCORED" ? { computedScore: 0 } : {}) }));
  assert.ok(processRules.stageProgress(criteria, stages, values, true).steps.every(step => step.state === "complete"));
  const phone = criteria.find(c => c.stageId === stages[1]!._id)!;
  const partial = values.filter(v => v.criterionId !== phone._id);
  assert.equal(processRules.stageProgress(criteria, stages, partial, true).steps[2]?.state, "blocked");
  assert.equal(processRules.stageProgress(criteria, stages, [...values, values.find(v => v.criterionId === phone._id)!], true).steps[2]?.state, "blocked");
  assert.equal(processRules.stageProgress(criteria, stages.map(stage => ({ ...stage, order: 1 })), values, true).steps[0]?.state, "blocked");
  assert.equal(processRules.stageProgress(criteria, stages.map((stage, index) => index === 1 ? { ...stage, quota: 2 } : stage), values, true).steps[2]?.state, "blocked");
});
