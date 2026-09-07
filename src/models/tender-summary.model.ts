import mongoose = require("mongoose");

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
    totalQualityScore: Number,
    priceScore: Number,
    finalWeightedScore: Number,
    rankPosition: Number,
    isWinner: Boolean,
    committeeApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    awardLetterUrl: String,
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
