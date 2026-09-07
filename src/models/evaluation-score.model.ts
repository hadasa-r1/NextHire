import mongoose = require("mongoose");

interface EvaluationScore {
  applicationId?: mongoose.Types.ObjectId;
  criterionId?: mongoose.Types.ObjectId;
  interviewerId?: mongoose.Types.ObjectId;
  actualValue?: number | boolean;
  computedScore?: number;
  notes?: string;
  evaluatedAt?: Date;
}

const evaluationScoreSchema = new mongoose.Schema<EvaluationScore>(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
    },
    criterionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Criterion",
    },
    interviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    actualValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    computedScore: Number,
    notes: String,
    evaluatedAt: Date,
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const EvaluationScore = mongoose.model<EvaluationScore>(
  "EvaluationScore",
  evaluationScoreSchema
);

export = EvaluationScore;
