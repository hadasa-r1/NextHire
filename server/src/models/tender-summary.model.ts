import mongoose = require("mongoose");
import rules = require("../validation/field-rules.mjs");

interface TenderSummary {
  applicationId?: mongoose.Types.ObjectId;
  totalQualityScore?: number;
  priceScore?: number;
  finalWeightedScore?: number;
  rankPosition?: number;
  isWinner?: boolean;
  committeeApproverId?: mongoose.Types.ObjectId;
  awardLetterUrl?: string;
}

const tenderSummarySchema = new mongoose.Schema<TenderSummary>(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      unique: true,
    },
    totalQualityScore: { type: Number, cast: false, validate: { validator: rules.optional(rules.isFiniteNumber), message: rules.messages.finiteNumber } },
    priceScore: { type: Number, cast: false, validate: { validator: rules.optional(rules.isFiniteNumber), message: rules.messages.finiteNumber } },
    finalWeightedScore: { type: Number, cast: false, validate: { validator: rules.optional(rules.isFiniteNumber), message: rules.messages.finiteNumber } },
    rankPosition: { type: Number, cast: false, validate: { validator: rules.optional(rules.isRank), message: rules.messages.rankPosition } },
    isWinner: { type: Boolean, cast: false },
    committeeApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    awardLetterUrl: { type: String, cast: false, trim: true, validate: { validator: rules.optionalText(value => rules.webDocumentUrl(value) !== null), message: rules.messages.awardLetterUrl } },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const TenderSummary = mongoose.model<TenderSummary>(
  "TenderSummary",
  tenderSummarySchema
);

export = TenderSummary;
