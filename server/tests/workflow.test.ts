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
  const criteria = demo.demoCriteria(demo.DEMO_POSITION_IDS[0]);
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
  let suppliedCriteria: unknown = demo.demoCriteria(demo.DEMO_POSITION_IDS[0]);
  const integrations = {
    async resolveSession(req: Request) {
      const who = req.get("X-Test-Session");
      if (!["writer", "writer-upper", "other", "operator"].includes(who ?? "")) return null;
      return { user: { _id: who === "other" ? other : who === "writer-upper" ? writer.toUpperCase() : writer }, permissions: [
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
  const criteria = demo.demoCriteria(demo.DEMO_POSITION_IDS[0]);
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
      assert.equal((await request(path + "/pass-threshold", "operator", {})).status, 200);
      assert.equal((await request(path + "/reject", "operator", { rejectionReason: " " })).status, 400);
      assert.equal((await request(path + "/reject", "operator", { rejectionReason: " test reason " })).status, 200);
      const result = await applications.getById(id);
      assert.equal(result?.passedThreshold, true); assert.equal(result?.rejectionReason, "test reason");
      assert.equal(result?.get("currentStage"), undefined);
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
