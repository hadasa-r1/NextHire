import assert = require("node:assert/strict");
import http = require("node:http");
import test = require("node:test");
import express = require("express");
import repositories = require("../src/repository");
import routes = require("../src/routes");
import Candidate = require("../src/models/candidate.model");
import Application = require("../src/models/application.model");
import EvaluationScore = require("../src/models/evaluation-score.model");
import TenderSummary = require("../src/models/tender-summary.model");

test("Each public API path reaches the repository for its own entity", async (t) => {
  // Test routing with in-memory documents, without opening a MongoDB connection.
  const candidate = new Candidate({ idNumber: "000000001" });
  const application = new Application({ resumeUrl: "https://example.test/resume.pdf" });
  const evaluation = new EvaluationScore({ actualValue: false });
  const summary = new TenderSummary({ rankPosition: 1 });

  const candidateCalls = t.mock.method(
    repositories.candidateRepository, "getAll", async () => [candidate]
  );
  const applicationCalls = t.mock.method(
    repositories.applicationRepository, "getAll", async () => [application]
  );
  const evaluationCalls = t.mock.method(
    repositories.evaluationScoreRepository, "getAll", async () => [evaluation]
  );
  const summaryCalls = t.mock.method(
    repositories.tenderSummaryRepository, "getAll", async () => [summary]
  );

  const app = express();
  app.use(express.json());
  app.use(routes);

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
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const [path, document] of [
    ["/api/candidates", candidate],
    ["/api/applications", application],
    ["/api/evaluation-scores", evaluation],
    ["/api/tender-summaries", summary],
  ] as const) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, path);
    assert.deepEqual(await response.json(), JSON.parse(JSON.stringify([document])));
  }

  for (const calls of [candidateCalls, applicationCalls, evaluationCalls, summaryCalls]) {
    assert.equal(calls.mock.callCount(), 1);
  }

  const unknownPath = await fetch(`${baseUrl}/api/unknown`);
  assert.equal(unknownPath.status, 404);
});
