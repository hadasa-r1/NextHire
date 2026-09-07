import mongoose = require("mongoose");
import process = require("node:process");
import connectDatabase = require("../config/database");
import Candidate = require("../models/candidate.model");
import Application = require("../models/application.model");
import EvaluationScore = require("../models/evaluation-score.model");
import TenderSummary = require("../models/tender-summary.model");

async function checkDatabase(): Promise<void> {
  try {
    await connectDatabase();

    const database = mongoose.connection.db;

    if (!database) {
      throw new Error("MongoDB connection is not available.");
    }

    await database.command({ ping: 1 });

    const models = [Candidate, Application, EvaluationScore, TenderSummary];
    await Promise.all(models.map((model) => model.init()));

    console.log(`Connected to MongoDB database: ${database.databaseName}`);
    console.log(
      `Collections ready: ${models.map((model) => model.collection.name).join(", ")}`
    );
  } finally {
    await mongoose.disconnect();
  }
}

checkDatabase().catch(() => {
  console.error(
    "Database check failed. Check MONGODB_URI in .env and that MongoDB is running."
  );
  process.exitCode = 1;
});
