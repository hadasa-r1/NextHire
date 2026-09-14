import assert = require("node:assert/strict");
import crypto = require("node:crypto");
import test = require("node:test");
import mongoose = require("mongoose");
import connectDatabase = require("../src/config/database");
import Repository = require("../src/repository/repository");
import Candidate = require("../src/models/candidate.model");
import Application = require("../src/models/application.model");
import EvaluationScore = require("../src/models/evaluation-score.model");
import TenderSummary = require("../src/models/tender-summary.model");

async function verifyCrud<T>(
  repository: Repository<T>,
  initial: Partial<T>,
  changes: Partial<T>
): Promise<void> {
  const created = await repository.add(initial);
  const id = String(created._id);

  assert.deepEqual(
    (await repository.getAll()).map((document) => String(document._id)),
    [id]
  );

  const found = await repository.getById(id);
  assert.ok(found);

  for (const [field, value] of Object.entries(initial)) {
    assert.deepEqual(found.get(field), value);
  }

  const updated = await repository.update(id, changes);
  assert.ok(updated);

  const persisted = await repository.getById(id);
  assert.ok(persisted);

  for (const [field, value] of Object.entries({ ...initial, ...changes })) {
    assert.deepEqual(updated.get(field), value);
    assert.deepEqual(persisted.get(field), value);
  }

  await repository.remove(id);
  assert.equal(await repository.getById(id), null);
  assert.equal(await repository.update(id, changes), null);
  assert.equal(await repository.remove(id), undefined);
  assert.deepEqual(await repository.getAll(), []);
}

test("Generic Repository against MongoDB", async (t) => {
  const testDatabaseName = `nexthire_group_b_test_${crypto.randomUUID().replaceAll("-", "")}`;
  let testConnection: mongoose.Connection | undefined;

  try {
    await connectDatabase();
    assert.notEqual(mongoose.connection.name, testDatabaseName);

    // All test records belong to this newly named database, never the project database.
    testConnection = mongoose.connection.useDb(testDatabaseName);

    const candidateModel = testConnection.model<Candidate>("Candidate", Candidate.schema);
    const applicationModel = testConnection.model<Application>("Application", Application.schema);
    const evaluationScoreModel = testConnection.model<EvaluationScore>(
      "EvaluationScore",
      EvaluationScore.schema
    );
    const tenderSummaryModel = testConnection.model<TenderSummary>(
      "TenderSummary",
      TenderSummary.schema
    );

    await Promise.all([
      candidateModel.init(),
      applicationModel.init(),
      evaluationScoreModel.init(),
      tenderSummaryModel.init(),
    ]);

    const candidates = new Repository<Candidate>(candidateModel);
    const applications = new Repository<Application>(applicationModel);
    const evaluations = new Repository<EvaluationScore>(evaluationScoreModel);
    const summaries = new Repository<TenderSummary>(tenderSummaryModel);

    await t.test("Candidate CRUD preserves the identifier while updating the name", async () => {
      await verifyCrud(
        candidates,
        { idNumber: "000000018", fullName: "Test candidate" },
        { fullName: "Updated candidate" }
      );
    });

    await t.test("Application CRUD preserves references and false values", async () => {
      await verifyCrud(
        applications,
        {
          candidateId: new mongoose.Types.ObjectId(),
          positionId: new mongoose.Types.ObjectId(),
          companyId: new mongoose.Types.ObjectId(),
          resumeUrl: "https://example.test/resume.pdf",
          hourlyRateBid: 150,
          passedThreshold: false,
        },
        { hourlyRateBid: 175 }
      );
    });

    await t.test("EvaluationScore CRUD stores both false and zero", async () => {
      await verifyCrud(
        evaluations,
        {
          applicationId: new mongoose.Types.ObjectId(),
          criterionId: new mongoose.Types.ObjectId(),
          interviewerId: new mongoose.Types.ObjectId(),
          actualValue: false,
          computedScore: 0,
        },
        { actualValue: 0 }
      );
    });

    await t.test("TenderSummary CRUD saves updated ranking and score", async () => {
      await verifyCrud(
        summaries,
        {
          applicationId: new mongoose.Types.ObjectId(),
          finalWeightedScore: 0,
          isWinner: false,
        },
        { rankPosition: 1, finalWeightedScore: 88 }
      );
    });

    await t.test("Required fields are validated on add and update", async () => {
      await assert.rejects(candidates.add({}), mongoose.Error.ValidationError);
      await assert.rejects(applications.add({}), mongoose.Error.ValidationError);

      const candidate = await candidates.add({ idNumber: "000000026" });
      const application = await applications.add({
        resumeUrl: "https://example.test/required-resume.pdf",
      });

      await assert.rejects(
        candidates.update(String(candidate._id), { idNumber: "" }),
        mongoose.Error.ValidationError
      );
      await assert.rejects(
        applications.update(String(application._id), { resumeUrl: "" }),
        mongoose.Error.ValidationError
      );

      assert.equal(
        (await candidates.getById(String(candidate._id)))?.idNumber,
        "000000026"
      );
      assert.equal(
        (await applications.getById(String(application._id)))?.resumeUrl,
        "https://example.test/required-resume.pdf"
      );
    });

    await t.test("Invalid format updates are rejected and stored data stays unchanged", async () => {
      const candidate = await candidates.add({ idNumber: "000000018", phone: "0501234567", email: "test@example.com" });
      for (const patch of [{ idNumber: "12345678" }, { phone: "123" }, { email: "invalid" }]) {
        await assert.rejects(candidates.update(String(candidate._id), patch), mongoose.Error.ValidationError);
      }
      const stored = await candidates.getById(String(candidate._id));
      assert.equal(stored?.idNumber, "000000018");
      assert.equal(stored?.phone, "0501234567");
      const evaluation = await evaluations.add({ actualValue: false });
      await assert.rejects(evaluations.update(String(evaluation._id), { actualValue: {} } as never), mongoose.Error.ValidationError);
      assert.equal((await evaluations.getById(String(evaluation._id)))?.actualValue, false);
    });

    await t.test("Candidate editing accepts simple phone formats and clearing without changing identity", async () => {
      const candidate = await candidates.add({ idNumber: "000000018", phone: "000-000-0001" });
      for (const phone of ["(03) 123-4567", "0601234567", "+972 (0)50-1234567", ""]) {
        await candidates.update(String(candidate._id), { fullName: "Edited", phone });
        const saved = await candidates.getById(String(candidate._id));
        assert.equal(saved?.phone, phone);
        assert.equal(saved?.idNumber, "000000018");
        assert.equal(saved?.fullName, "Edited");
      }
      await candidates.remove(String(candidate._id));
    });

    await t.test("Candidate identifiers are not unique", async () => {
      const first = await candidates.add({ idNumber: "000000034" });
      const second = await candidates.add({ idNumber: "000000034" });
      assert.notEqual(String(first._id), String(second._id));
    });

    await t.test("A second summary for the same application is rejected", async () => {
      const applicationId = new mongoose.Types.ObjectId();
      await summaries.add({ applicationId });
      await assert.rejects(summaries.add({ applicationId }), { code: 11000 });
    });
  } finally {
    try {
      if (testConnection) {
        // Only remove the exact temporary database created for this test run.
        assert.equal(testConnection.name, testDatabaseName);
        assert.notEqual(testConnection.name, mongoose.connection.name);
        await testConnection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect();
    }
  }
});
