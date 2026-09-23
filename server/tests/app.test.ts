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

    await t.test("Generic data CRUD remains available while score mutations must use the guarded evaluation workflow", async () => {
      const candidateResponse = await request("/api/candidates", "POST", {
        idNumber: "000000018", fullName: "API test candidate",
        linkedinUrl: "https://www.linkedin.com/in/example", githubUrl: "https://github.com/example", photoUrl: "https://example.com/photo.png",
      });
      assert.equal(candidateResponse.status, 201);
      const candidate = await candidateResponse.json();
      assert.equal(candidate.linkedinUrl, "https://www.linkedin.com/in/example");
      assert.equal(candidate.githubUrl, "https://github.com/example");
      assert.equal(candidate.photoUrl, "https://example.com/photo.png");

      const applicationResponse = await request("/api/applications", "POST", {
        candidateId: candidate._id,
        resumeUrl: "https://example.test/resume.pdf",
      });
      assert.equal(applicationResponse.status, 201);
      const application = await applicationResponse.json();
      assert.equal(application.candidateId, candidate._id);
      assert.equal((await request("/api/applications/" + application._id, "PATCH", { candidateId: candidate._id, resumeUrl: "https://example.test/resume-updated.pdf" })).status, 200);
      assert.equal((await request("/api/applications/" + application._id, "PATCH", { passedThreshold: true })).status, 400);

      const evaluationResponse = await request("/api/evaluation-scores", "POST", {
        applicationId: application._id, actualValue: false,
      });
      assert.equal(evaluationResponse.status, 405);
      const evaluation = await repositories.evaluationScoreRepository.add({ applicationId: new mongoose.Types.ObjectId(application._id), actualValue: false });
      assert.equal((await request("/api/evaluation-scores/" + String(evaluation._id), "PATCH", { actualValue: 0 })).status, 405);
      assert.equal((await request("/api/evaluation-scores/" + String(evaluation._id), "DELETE")).status, 405);
      assert.equal((await (await request("/api/evaluation-scores/" + String(evaluation._id))).json()).actualValue, false);
      await repositories.evaluationScoreRepository.remove(String(evaluation._id));

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
        ["/api/candidates", candidate._id, { fullName: "Updated API candidate", linkedinUrl: "", githubUrl: "", photoUrl: "" }],
        ["/api/applications", application._id, { hourlyRateBid: 150 }],
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


    await t.test("Each position returns its own populated candidates before any tender summaries exist", async () => {
      const positionA = new mongoose.Types.ObjectId(), positionB = new mongoose.Types.ObjectId();
      const candidateA = await repositories.candidateRepository.add({ idNumber: "123456789", fullName: "Position A candidate" });
      const candidateB = await repositories.candidateRepository.add({ idNumber: "987654321", fullName: "Position B candidate" });
      const first = await repositories.applicationRepository.add({ positionId: positionA, candidateId: candidateA._id, resumeUrl: "https://example.com/a.pdf" });
      const second = await repositories.applicationRepository.add({ positionId: positionB, candidateId: candidateB._id, resumeUrl: "https://example.com/b.pdf" });
      try {
        for (const [position, application, candidate] of [[positionA, first, candidateA], [positionB, second, candidateB]] as const) {
          const response = await request("/api/applications?positionId=" + String(position) + "&populate=candidateId");
          assert.equal(response.status, 200);
          const rows = await response.json();
          assert.equal(rows.length, 1);
          assert.equal(rows[0]._id, String(application._id));
          assert.equal(rows[0].candidateId.fullName, candidate.fullName);
          const summaries = await request("/api/tender-summaries?applicationId=" + String(application._id));
          assert.deepEqual(await summaries.json(), []);
        }
      } finally {
        await repositories.applicationRepository.remove(String(first._id));
        await repositories.applicationRepository.remove(String(second._id));
        await repositories.candidateRepository.remove(String(candidateA._id));
        await repositories.candidateRepository.remove(String(candidateB._id));
      }
    });

    await t.test("Model validation and casting errors return 400", async () => {
      for (const path of ["/api/candidates", "/api/applications"]) {
        const response = await request(path, "POST", {});
        assert.equal(response.status, 400);
        const error = await response.json();
        assert.equal(typeof error.message, "string");
        assert.ok(error.fields[path.endsWith("candidates") ? "idNumber" : "resumeUrl"]);
      }

      const id = new mongoose.Types.ObjectId().toHexString();
      const castError = await request(`/api/applications/${id}`, "PATCH", {
        candidateId: "invalid-object-id",
      });
      assert.equal(castError.status, 400);
    });

    await t.test("Direct API writes cannot bypass field formats or change data on rejected updates", async () => {
      const badRequests = [
        ["/api/candidates", { idNumber: "12345678" }],
        ["/api/candidates", { idNumber: "000000018", phone: "123" }],
        ["/api/candidates", { idNumber: "000000018", email: "bad@" }],
        ["/api/applications", { resumeUrl: "javascript:alert(1)" }],
        ["/api/applications", { resumeUrl: "https://example.com/cv", hourlyRateBid: -1 }],
        ["/api/tender-summaries", { rankPosition: 1.5 }],
      ] as const;
      for (const [path, body] of badRequests) {
        const response = await request(path, "POST", body);
        assert.equal(response.status, 400, path);
        assert.ok(Object.keys((await response.json()).fields).length);
      }
      const candidate = await (await request("/api/candidates", "POST", { idNumber: "000000018" })).json();
      const rejected = await request("/api/candidates/" + candidate._id, "PATCH", { phone: "wrong" });
      assert.equal(rejected.status, 400);
      assert.ok((await rejected.json()).fields.phone);
      const stored = await (await request("/api/candidates/" + candidate._id)).json();
      assert.equal(stored.phone, undefined);
      assert.equal(stored.idNumber, "000000018");
      await request("/api/candidates/" + candidate._id, "DELETE");
    });

    await t.test("Candidate ID editing accepts nine-digit values without a checksum and preserves format validation", async () => {
      const created = await request("/api/candidates", "POST", { idNumber: "000000001" });
      assert.equal(created.status, 201);
      const candidate = await created.json();
      assert.equal(candidate.idNumber, "000000001");
      const path = "/api/candidates/" + candidate._id;
      const updated = await request(path, "PATCH", { idNumber: "123456789" });
      assert.equal(updated.status, 200);
      assert.equal((await updated.json()).idNumber, "123456789");
      for (const idNumber of ["", "12345678", "1234567890", "12345a789", 123456789]) {
        assert.equal((await request(path, "PATCH", { idNumber })).status, 400);
      }
      assert.equal((await (await request(path)).json()).idNumber, "123456789");
      await request(path, "DELETE");
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
