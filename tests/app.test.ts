import assert = require("node:assert/strict");
import crypto = require("node:crypto");
import http = require("node:http");
import process = require("node:process");
import test = require("node:test");
import mongoose = require("mongoose");
import startServer = require("../src/server");
import repositories = require("../src/repository");

test("The application serves HTTP requests backed by local MongoDB", async (t) => {
  const databaseName = `nexthire_group_b_http_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const previousEnvironment = {
    MONGODB_URI: process.env.MONGODB_URI,
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };
  let server: http.Server | undefined;

  // This suite uses a dedicated local database and an OS-assigned port.
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${databaseName}`;
  process.env.PORT = "0";
  process.env.CORS_ORIGIN = "http://localhost:5173";

  try {
    server = await startServer();
    assert.equal(mongoose.connection.readyState, 1);
    assert.equal(mongoose.connection.name, databaseName);
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const request = (path: string, method = "GET", body?: object) => fetch(`${baseUrl}${path}`, {
      method,
      ...(body === undefined ? {} : {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });

    await t.test("All four entities can be created, read, updated, and removed through the API", async () => {
      const candidateResponse = await request("/api/candidates", "POST", {
        idNumber: "000000001", fullName: "API test candidate",
      });
      assert.equal(candidateResponse.status, 201);
      const candidate = await candidateResponse.json();

      const applicationResponse = await request("/api/applications", "POST", {
        candidateId: candidate._id,
        resumeUrl: "https://example.test/resume.pdf",
      });
      assert.equal(applicationResponse.status, 201);
      const application = await applicationResponse.json();
      assert.equal(application.candidateId, candidate._id);

      const evaluationResponse = await request("/api/evaluation-scores", "POST", {
        applicationId: application._id, actualValue: false,
      });
      assert.equal(evaluationResponse.status, 201);
      const evaluation = await evaluationResponse.json();
      assert.equal(evaluation.actualValue, false);

      const summaryResponse = await request("/api/tender-summaries", "POST", {
        applicationId: application._id,
      });
      assert.equal(summaryResponse.status, 201);
      const summary = await summaryResponse.json();

      // The unique index must already exist when the server starts accepting writes.
      const duplicate = await request("/api/tender-summaries", "POST", {
        applicationId: application._id,
      });
      assert.equal(duplicate.status, 409);
      assert.deepEqual(await duplicate.json(), { message: "כבר קיימת רשומה עם אותו ערך ייחודי." });

      const cases = [
        ["/api/candidates", candidate._id, { fullName: "Updated API candidate" }],
        ["/api/applications", application._id, { hourlyRateBid: 150 }],
        ["/api/evaluation-scores", evaluation._id, { actualValue: 0 }],
        ["/api/tender-summaries", summary._id, { rankPosition: 1 }],
      ] as const;

      for (const [path, id, changes] of cases) {
        const list = await request(path);
        assert.equal(list.status, 200);
        assert.equal((await list.json()).length, 1);

        const updated = await request(`${path}/${id}`, "PATCH", changes);
        assert.equal(updated.status, 200);
        const updatedBody = await updated.json();
        const persisted = await request(`${path}/${id}`);
        assert.equal(persisted.status, 200);
        const persistedBody = await persisted.json();
        for (const [field, value] of Object.entries(changes)) {
          assert.equal(updatedBody[field], value);
          assert.equal(persistedBody[field], value);
        }
      }

      for (const [path, id] of [...cases].reverse()) {
        const removed = await request(`${path}/${id}`, "DELETE");
        assert.equal(removed.status, 204);
        assert.equal(await removed.text(), "");
        assert.equal((await request(`${path}/${id}`)).status, 404);
      }
    });

    await t.test("Model validation and casting errors return 400", async () => {
      for (const path of ["/api/candidates", "/api/applications"]) {
        const response = await request(path, "POST", {});
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { message: "נתוני הבקשה אינם תקינים." });
      }

      const id = new mongoose.Types.ObjectId().toHexString();
      const castError = await request(`/api/applications/${id}`, "PATCH", {
        candidateId: "invalid-object-id",
      });
      assert.equal(castError.status, 400);
    });

    await t.test("Malformed JSON, oversized bodies, and unsupported charsets have JSON errors", async () => {
      const malformed = await fetch(`${baseUrl}/api/candidates`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: '{"idNumber":',
      });
      assert.equal(malformed.status, 400);
      assert.deepEqual(await malformed.json(), { message: "גוף הבקשה אינו JSON תקין." });

      const oversized = await request("/api/candidates", "POST", {
        fullName: "a".repeat(110 * 1024),
      });
      assert.equal(oversized.status, 413);
      assert.deepEqual(await oversized.json(), { message: "גוף הבקשה גדול מדי." });

      const unsupported = await fetch(`${baseUrl}/api/candidates`, {
        method: "POST", headers: { "Content-Type": "application/json; charset=iso-8859-1" }, body: "{}",
      });
      assert.equal(unsupported.status, 415);
      assert.deepEqual(await unsupported.json(), { message: "קידוד הבקשה אינו נתמך." });
    });

    await t.test("Unknown routes and unknown records return distinct JSON 404 responses", async () => {
      const route = await request("/api/unknown");
      assert.equal(route.status, 404);
      assert.deepEqual(await route.json(), { message: "הנתיב לא נמצא." });
      const record = await request(`/api/candidates/${new mongoose.Types.ObjectId()}`);
      assert.equal(record.status, 404);
      assert.deepEqual(await record.json(), { message: "הרשומה לא נמצאה." });
    });

    await t.test("CORS permits the configured frontend origin", async () => {
      const allowed = await fetch(`${baseUrl}/api/candidates`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });
      assert.equal(allowed.status, 204);
      assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");

      const otherOrigin = await fetch(`${baseUrl}/api/candidates`, {
        headers: { Origin: "https://other.example.test" },
      });
      assert.equal(otherOrigin.headers.get("access-control-allow-origin"), null);
    });

    await t.test("Unexpected errors do not expose internal details", async (subtest) => {
      subtest.mock.method(repositories.candidateRepository, "getAll", async () => {
        throw new Error("private-internal-details");
      });
      const response = await request("/api/candidates");
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { message: "אירעה שגיאה פנימית בשרת." });
    });
  } finally {
    try {
      if (server?.listening) {
        const activeServer = server;
        await new Promise<void>((resolve, reject) => {
          activeServer.close((error) => error ? reject(error) : resolve());
          activeServer.closeAllConnections();
        });
      }
    } finally {
      try {
        if (mongoose.connection.readyState === 1) {
          assert.equal(mongoose.connection.name, databaseName);
          await mongoose.connection.dropDatabase();
        }
      } finally {
        await mongoose.disconnect();
        for (const [name, value] of Object.entries(previousEnvironment)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    }
  }
});
