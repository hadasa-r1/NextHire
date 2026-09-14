import mongoose = require("mongoose");
import rules = require("../validation/field-rules.mjs");

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
      validate: { validator: rules.optional(rules.isActualValue), message: rules.messages.actualValue },
    },
    computedScore: { type: Number, cast: false, validate: { validator: rules.optional(rules.isFiniteNumber), message: rules.messages.finiteNumber } },
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
