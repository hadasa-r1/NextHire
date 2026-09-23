import assert = require("node:assert/strict");
import test = require("node:test");
import crypto = require("node:crypto");
import mongoose = require("mongoose");
import express = require("express");
import process = require("node:process");
import type { Request } from "express";
import Repository = require("../src/repository/repository");
import Application = require("../src/models/application.model");
import EvaluationScore = require("../src/models/evaluation-score.model");
import EvaluationService = require("../src/services/evaluation.service");
import createRoutes = require("../src/routes/workflow.routes");
import errorHandler = require("../src/middleware/error-handler");
import scoring = require("../src/validation/scoring.mjs");
import demo = require("../src/demo/evaluation-data.mjs");
import localWorkflow = require("../src/demo/workflow");

test("Lecturer scoring calculates raw ratio and direct score without inventing weights or caps", () => {
  const criteria = demo.demoCriteria(demo.DEMO_POSITION_IDS[1]).map(({ stageId: _stageId, ...criterion }) => criterion);
  assert.equal(scoring.calculateScore(criteria[0]!, false), undefined);
  assert.ok(Math.abs(scoring.calculateScore(criteria[1]!, 5)! - 83.3333333333) < 1e-8);
  assert.equal(scoring.calculateScore(criteria[1]!, 0), 0);
  assert.ok(scoring.calculateScore(criteria[1]!, 7)! > 100);
  assert.equal(scoring.calculateScore(criteria[2]!, 0), 0);
  assert.throws(() => scoring.calculateScore({ ...criteria[2]!, type: "UNKNOWN" } as unknown as scoring.CriterionReference, 5));
  assert.throws(() => scoring.calculateScore({ ...criteria[1]!, targetValue: 0 }, 5));
  assert.throws(() => scoring.calculateScore(criteria[1]!, true));
  assert.throws(() => scoring.calculateScore(criteria[0]!, 1));
  assert.throws(() => scoring.calculateScore({ ...criteria[2]!, maxScore: 10 }, 11));
});

test("Evaluation workflow persists trusted scores and supports WRITE-only interviewers", async (t) => {
  const database = "nexthire_workflow_test_" + crypto.randomUUID().replaceAll("-", "");
  await mongoose.connect("mongodb://127.0.0.1:27017/" + database);
  const applications = new Repository<Application>(Application);
  const evaluations = new Repository<EvaluationScore>(EvaluationScore);
  const writer = "de0000000000000000000099", other = "de0000000000000000000098";
  let suppliedCriteria: unknown = demo.demoCriteria(demo.DEMO_POSITION_IDS[1]).map(({ stageId: _stageId, ...criterion }) => criterion);
  const integrations = {
    async resolveSession(req: Request) {
      const who = req.get("X-Test-Session");
      if (!["writer", "writer-upper", "other", "operator", "reviewer"].includes(who ?? "")) return null;
      return { user: { _id: who === "other" ? other : who === "writer-upper" ? writer.toUpperCase() : writer }, permissions: who === "reviewer" ? ["TenderSummary", "Application", "EvaluationScore"].map(resource => ({ resource, actions: ["READ"] })) : [
        { resource: who === "operator" ? "Application" : "EvaluationScore", actions: ["WRITE"] },
      ] };
    },
    async loadCriteria(_positionId: string) { return suppliedCriteria as readonly scoring.CriterionReference[]; },
  };
  const app = express();
  app.use(express.json());
  app.use("/api/workflow", createRoutes(new EvaluationService(applications, evaluations, integrations)));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port + "/api/workflow";
  const application = await applications.add({ positionId: new mongoose.Types.ObjectId(demo.DEMO_POSITION_IDS[0]), resumeUrl: "https://example.com/cv.pdf" });
  const id = String(application._id), path = "/applications/" + id;
  const criteria = demo.demoCriteria(demo.DEMO_POSITION_IDS[1]).map(({ stageId: _stageId, ...criterion }) => criterion);
  const request = (suffix: string, who = "writer", body?: object) => fetch(base + suffix, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-Test-Session": who, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    await t.test("Authentication, minimal context and forged metadata are enforced", async () => {
      assert.equal((await request(path + "/evaluation-context", "unknown")).status, 401);
      const context = await request(path + "/evaluation-context");
      assert.equal(context.status, 200);
      assert.deepEqual(Object.keys(await context.json()).sort(), ["criteria", "evaluations"]);
      for (const body of [
        { criterionId: criteria[1]!._id, actualValue: 5, interviewerId: other },
        { criterionId: criteria[1]!._id, actualValue: 5, computedScore: 100 },
        { criterionId: criteria[1]!._id, actualValue: 5, evaluatedAt: "2000-01-01" },
        { criterionId: "de0000000000000000000088", actualValue: 5 },
        { criterionId: criteria[0]!._id, actualValue: 1 },
      ]) assert.equal((await request(path + "/evaluations", "writer", body)).status, 400);
      assert.equal((await evaluations.getAll()).length, 0);
    });
    await t.test("Invalid upstream definitions fail before writes and context normalizes identifiers", async () => {
      try {
        for (const invalid of [
          null, [null], [{ ...criteria[1], type: "UNKNOWN" }],
          [{ ...criteria[1], targetValue: 0 }], [{ ...criteria[1], targetValue: "6" }],
          [{ ...criteria[2], maxScore: Number.NaN }],
          [criteria[0], { ...criteria[0], _id: criteria[0]!._id.toUpperCase() }],
        ]) {
          suppliedCriteria = invalid;
          assert.equal((await request(path + "/evaluation-context")).status, 502);
          assert.equal((await request(path + "/evaluations", "writer", { criterionId: criteria[1]!._id, actualValue: 5 })).status, 502);
          assert.equal((await evaluations.getAll()).length, 0);
        }
        suppliedCriteria = criteria.map(item => ({ ...item, _id: item._id.toUpperCase(), integrationSecret: "not-context-data" }));
        const context = await (await request(path + "/evaluation-context")).json();
        assert.equal(context.criteria[0]._id, criteria[0]!._id);
        assert.equal("integrationSecret" in context.criteria[0], false);
      } finally { suppliedCriteria = criteria; }
    });
    await t.test("Server computes score and identity/time; concurrent retries update one record", async () => {
      const responses = await Promise.all(Array.from({ length: 8 }, (_, index) =>
        request("/applications/" + (index % 2 ? id.toUpperCase() : id) + "/evaluations", index % 3 ? "writer" : "writer-upper",
          { criterionId: index % 2 ? criteria[1]!._id.toUpperCase() : criteria[1]!._id, actualValue: 5, notes: "note" })));
      for (const response of responses) assert.equal(response.status, 200);
      const records = await evaluations.getAll();
      assert.equal(records.length, 1);
      assert.equal(String(records[0]!.interviewerId), writer);
      assert.ok(records[0]!.evaluatedAt instanceof Date);
      assert.ok(Math.abs(records[0]!.computedScore! - 83.3333333333) < 1e-8);
      const updated = await request(path + "/evaluations", "writer", { criterionId: criteria[1]!._id, actualValue: 0 });
      assert.equal(updated.status, 200);
      const body = await updated.json();
      assert.equal(body.actualValue, 0); assert.equal(body.computedScore, 0);
      assert.equal("notes" in body, false);
      assert.equal((await evaluations.getAll()).length, 1);
    });
    await t.test("A different interviewer has a separate evaluation that is absent from own context", async () => {
      assert.equal((await request(path + "/evaluations", "other", { criterionId: criteria[1]!._id, actualValue: 6 })).status, 200);
      assert.equal((await evaluations.getAll()).length, 2);
      const context = await (await request(path + "/evaluation-context")).json();
      assert.equal(context.evaluations.length, 1);
      assert.equal(context.evaluations[0].actualValue, 0);
      const boolean = await request(path + "/evaluations", "writer", { criterionId: criteria[0]!._id, actualValue: false });
      const body = await boolean.json();
      assert.equal(boolean.status, 200); assert.equal(body.actualValue, false);
      assert.equal("computedScore" in body, false);
    });
    await t.test("Threshold and rejection commands check permission and require a reason", async () => {
      assert.equal((await request(path + "/pass-threshold", "writer", {})).status, 403);
      assert.equal((await request(path + "/pass-threshold", "operator", {})).status, 409);
      const before = await evaluations.getAll();
      assert.equal((await request(path + "/evaluations", "writer", { criterionId: criteria[2]!._id, actualValue: 7 })).status, 409);
      assert.equal((await evaluations.getAll()).length, before.length);
      assert.notEqual((await applications.getById(id))?.passedThreshold, true);
      // The responsible interviewer can correct their own result without erasing history.
      assert.equal((await request(path + "/evaluations", "writer", { criterionId: criteria[0]!._id, actualValue: true })).status, 200);
      assert.equal((await request(path + "/pass-threshold", "operator", {})).status, 200);
      assert.equal((await request(path + "/evaluations", "writer", { criterionId: criteria[2]!._id, actualValue: 0 })).status, 200);
      assert.equal((await request(path + "/reject", "operator", { rejectionReason: " " })).status, 400);
      assert.equal((await request(path + "/reject", "operator", { rejectionReason: " test reason " })).status, 200);
      const result = await applications.getById(id);
      assert.equal(result?.passedThreshold, true); assert.equal(result?.rejectionReason, "test reason");
      assert.equal(result?.get("currentStage"), undefined);
      assert.equal((await request(path + "/pass-threshold", "operator", {})).status, 409);
      assert.equal((await request(path + "/evaluations", "writer", { criterionId: criteria[0]!._id, actualValue: true })).status, 409);
      assert.equal((await request(path + "/evaluations", "writer", { criterionId: criteria[2]!._id, actualValue: 8 })).status, 409);
      assert.equal((await applications.getById(id))?.rejectionReason, "test reason");
    });
    await t.test("Review is permission checked, isolated to one position and never treats complete values as locked", async () => {
      const reviewPath = "/positions/" + demo.DEMO_POSITION_IDS[0] + "/evaluation-review";
      assert.equal((await request(reviewPath, "unknown")).status, 401);
      assert.equal((await request(reviewPath, "writer")).status, 403);
      assert.equal((await request(reviewPath, "operator")).status, 403);
      assert.equal((await request("/positions/not-an-id/evaluation-review", "reviewer")).status, 400);
      await applications.add({ positionId: new mongoose.Types.ObjectId(demo.DEMO_POSITION_IDS[1]), resumeUrl: "https://example.com/other.pdf" });
      const response = await request(reviewPath, "reviewer");
      assert.equal(response.status, 200);
      const report = await response.json();
      assert.equal(report.applications.length, 1);
      assert.equal(report.applications[0].applicationId, id);
      assert.ok(report.applications[0].issues.some((message: string) => message.includes("נדחתה")));
      assert.ok(report.applications[0].issues.some((message: string) => message.includes("כמה הערכות")));
      assert.equal(report.limitations.length, 3);
      assert.match(report.limitations[0], /אינה נעילת/);
      assert.equal("finalWeightedScore" in report.applications[0], false);
      const empty = await request("/positions/de0000000000000000000003/evaluation-review", "reviewer");
      assert.equal(empty.status, 200);
      assert.deepEqual((await empty.json()).applications, []);
    });
    await t.test("An explicit failed application threshold blocks scored updates but allows BOOLEAN correction", async () => {
      const failed = await applications.add({ positionId: new mongoose.Types.ObjectId(demo.DEMO_POSITION_IDS[0]),
        resumeUrl: "https://example.com/failed.pdf", passedThreshold: false });
      const failedPath = "/applications/" + String(failed._id);
      assert.equal((await request(failedPath + "/evaluations", "writer", { criterionId: criteria[2]!._id, actualValue: 0 })).status, 409);
      assert.equal((await request(failedPath + "/evaluations", "writer", { criterionId: criteria[0]!._id, actualValue: true })).status, 200);
      assert.equal((await applications.getById(String(failed._id)))?.passedThreshold, false);
    });
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    assert.equal(mongoose.connection.name, database);
    assert.ok(database.startsWith("nexthire_workflow_test_"));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
test("Local workflow cannot grant a demo session in production", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try { await assert.rejects(localWorkflow().resolveSession({ socket: { remoteAddress: "127.0.0.1" } } as Request)); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("Review distinguishes missing values from zero and BOOLEAN from quality", () => {
  const criteria = demo.demoCriteria(demo.DEMO_POSITION_IDS[1]).map(({ stageId: _stageId, ...criterion }) => criterion);
  const result = scoring.reviewEvaluations(criteria, [
    { criterionId: criteria[0]!._id, actualValue: false, computedScore: 100 },
    { criterionId: criteria[2]!._id, actualValue: 0, computedScore: 0 },
  ]);
  assert.equal(result.evaluatedCriteria, 2);
  assert.equal(result.issues.length, criteria.length - 2 + 1);
  assert.ok(result.issues.some(message => message.includes("לא עבר")));
  assert.ok(result.issues.some(message => message.includes("חסרה הערכה")));
  assert.equal("totalQualityScore" in result, false);
  assert.ok(scoring.reviewEvaluations([], []).issues.length > 0);
});
test("Review catches stale scores, absent values, duplicate evaluations and foreign criteria", () => {
  const criteria = demo.demoCriteria(demo.DEMO_POSITION_IDS[1]).map(({ stageId: _stageId, ...criterion }) => criterion);
  for (const value of [
    { criterionId: criteria[1]!._id, actualValue: 5, computedScore: 90 },
    { criterionId: criteria[1]!._id, actualValue: 5 },
    { criterionId: criteria[1]!._id, computedScore: 0 },
  ]) {
    const result = scoring.reviewEvaluations([criteria[1]!], [value]);
    assert.equal(result.evaluatedCriteria, 0);
    assert.equal(result.issues.length, 1);
  }
  const valid = { criterionId: criteria[1]!._id, actualValue: 5, computedScore: 5 / 6 * 100 };
  assert.deepEqual(scoring.reviewEvaluations([criteria[1]!], [valid]), { evaluatedCriteria: 1, issues: [] });
  assert.equal(scoring.reviewEvaluations([criteria[1]!], [valid, valid]).evaluatedCriteria, 0);
  assert.ok(scoring.reviewEvaluations([criteria[1]!], [valid, { ...valid, criterionId: criteria[2]!._id }]).issues.length);
});
