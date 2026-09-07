import assert = require("node:assert/strict");
import http = require("node:http");
import test = require("node:test");
import type { TestContext } from "node:test";
import express = require("express");
import mongoose = require("mongoose");
import GenericController = require("../src/controllers/generic.controller");
import createGenericRoutes = require("../src/routes/generic.routes");
import Repository = require("../src/repository/repository");
import Candidate = require("../src/models/candidate.model");
import EvaluationScore = require("../src/models/evaluation-score.model");

type PublicRepository<T> = Pick<Repository<T>, keyof Repository<T>>;

async function startTestServer<T extends object>(
  t: TestContext,
  overrides: Partial<PublicRepository<T>>
) {
  const unexpectedCall = async (): Promise<never> => {
    throw new Error("Unexpected repository call");
  };
  const repository: PublicRepository<T> = {
    add: unexpectedCall,
    getAll: unexpectedCall,
    getById: unexpectedCall,
    update: unexpectedCall,
    remove: unexpectedCall,
    ...overrides,
  };
  const controller = new GenericController<T>(repository);
  const errors: unknown[] = [];
  const app = express();

  // Let primitive JSON reach the controller so its body checks are exercised.
  app.use(express.json({ strict: false }));
  app.use("/records", createGenericRoutes(controller));
  app.get("/missing-id", controller.getById);

  const errorHandler: express.ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    errors.push(error);
    res.status(500).json({ message: "Test error handler" });
  };
  app.use(errorHandler);

  const server = http.createServer(app);
  t.after(async () => {
    if (!server.listening) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { url: `http://127.0.0.1:${address.port}`, errors };
}

const validId = new mongoose.Types.ObjectId().toHexString();

test("Controller handlers keep their repository binding and return success responses", async (t) => {
  const data = { idNumber: "000000001", fullName: "Test candidate" };
  const document = new Candidate({ ...data, _id: validId });
  const changes = { fullName: "Updated candidate" };
  const updated = new Candidate({ ...data, ...changes, _id: validId });
  const calls: string[] = [];
  const { url, errors } = await startTestServer<Candidate>(t, {
    add: async (body) => {
      calls.push("add");
      assert.deepEqual(body, data);
      return document;
    },
    getAll: async () => { calls.push("getAll"); return [document]; },
    getById: async (id) => {
      calls.push("getById");
      assert.equal(id, validId);
      return document;
    },
    update: async (id, body) => {
      calls.push("update");
      assert.equal(id, validId);
      assert.deepEqual(body, changes);
      return updated;
    },
    remove: async (id) => { calls.push("remove"); assert.equal(id, validId); },
  });

  const created = await fetch(`${url}/records`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { ...data, _id: validId });

  const all = await fetch(`${url}/records`);
  assert.equal(all.status, 200);
  assert.deepEqual(await all.json(), [{ ...data, _id: validId }]);

  const found = await fetch(`${url}/records/${validId}`);
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), { ...data, _id: validId });

  const changed = await fetch(`${url}/records/${validId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), { ...data, ...changes, _id: validId });

  const removed = await fetch(`${url}/records/${validId}`, { method: "DELETE" });
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), "");
  assert.deepEqual(calls, ["add", "getAll", "getById", "update", "remove"]);
  assert.deepEqual(errors, []);
});

test("An empty collection returns an empty array", async (t) => {
  const { url } = await startTestServer<Candidate>(t, { getAll: async () => [] });
  const response = await fetch(`${url}/records`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

test("The same generic controller supports EvaluationScore and preserves false and zero", async (t) => {
  const { url } = await startTestServer<EvaluationScore>(t, {
    add: async (body) => new EvaluationScore(body),
  });
  for (const actualValue of [false, 0]) {
    const response = await fetch(`${url}/records`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualValue }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).actualValue, actualValue);
  }
});

test("Missing records return 404 on get and update; removal remains 204", async (t) => {
  const { url } = await startTestServer<Candidate>(t, {
    getById: async () => null,
    update: async () => null,
    remove: async () => {},
  });
  const found = await fetch(`${url}/records/${validId}`);
  assert.equal(found.status, 404);
  assert.deepEqual(await found.json(), { message: "הרשומה לא נמצאה." });
  const changed = await fetch(`${url}/records/${validId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(changed.status, 404);
  const removed = await fetch(`${url}/records/${validId}`, { method: "DELETE" });
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), "");
});

test("Invalid or missing identifiers are rejected before calling the repository", async (t) => {
  const { url, errors } = await startTestServer<Candidate>(t, {});
  for (const id of ["not-an-id", "123456789012", "zzzzzzzzzzzzzzzzzzzzzzzz"]) {
    for (const method of ["GET", "PATCH", "DELETE"]) {
      const response = await fetch(`${url}/records/${id}`, { method });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { message: "מזהה הרשומה אינו תקין." });
    }
  }
  assert.equal((await fetch(`${url}/missing-id`)).status, 400);
  assert.deepEqual(errors, []);
});

test("Absent, null, array, and scalar bodies are rejected before repository calls", async (t) => {
  const { url, errors } = await startTestServer<Candidate>(t, {});
  for (const body of [undefined, null, [], "text", true, 42]) {
    for (const method of ["POST", "PATCH"]) {
      const path = method === "POST" ? "/records" : `/records/${validId}`;
      const response = await fetch(`${url}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      assert.equal(response.status, 400, `${method} with body ${JSON.stringify(body)}`);
      assert.deepEqual(await response.json(), { message: "יש לשלוח גוף בקשה כאובייקט JSON." });
    }
  }
  assert.deepEqual(errors, []);
});

test("An empty object is delegated so the model can validate its own fields", async (t) => {
  const document = new Candidate({ idNumber: "000000002" });
  const { url, errors } = await startTestServer<Candidate>(t, {
    add: async (body) => { assert.deepEqual(body, {}); return document; },
    update: async (_id, body) => { assert.deepEqual(body, {}); return document; },
  });
  for (const method of ["POST", "PATCH"]) {
    const path = method === "POST" ? "/records" : `/records/${validId}`;
    const response = await fetch(`${url}${path}`, {
      method, headers: { "Content-Type": "application/json" }, body: "{}",
    });
    assert.equal(response.status, method === "POST" ? 201 : 200);
  }
  assert.deepEqual(errors, []);
});

test("Express forwards repository failures from all five handlers to error middleware", async (t) => {
  const failure = new Error("Repository failure");
  const fail = async (): Promise<never> => { throw failure; };
  const { url, errors } = await startTestServer<Candidate>(t, {
    add: fail, getAll: fail, getById: fail, update: fail, remove: fail,
  });
  for (const [method, path] of [
    ["POST", "/records"], ["GET", "/records"], ["GET", `/records/${validId}`],
    ["PATCH", `/records/${validId}`], ["DELETE", `/records/${validId}`],
  ] as const) {
    const response = await fetch(`${url}${path}`, {
      method,
      ...(method === "POST" || method === "PATCH"
        ? { headers: { "Content-Type": "application/json" }, body: "{}" }
        : {}),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { message: "Test error handler" });
  }
  assert.equal(errors.length, 5);
  assert.ok(errors.every((error) => error === failure));
});
