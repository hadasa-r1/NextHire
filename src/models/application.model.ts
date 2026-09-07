import mongoose = require("mongoose");

interface Application {
  positionId?: mongoose.Types.ObjectId;
  candidateId?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  hourlyRateBid?: number;
  resumeUrl: string;
  passedThreshold?: boolean;

  // TODO: currentStage — סוג השדה ממתין לאישור.
  // אין להגדיר שדה פעיל או קשר ל-Stage בשלב זה.

  rejectionReason?: string;
}

const applicationSchema = new mongoose.Schema<Application>(
  {
    positionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    hourlyRateBid: Number,
    resumeUrl: {
      type: String,
      required: true,
    },
    passedThreshold: Boolean,

    // TODO: currentStage — להוסיף רק לאחר אישור סוג השדה.
    // המסמך אינו מגדיר אותו כקשר ל-Stage.

    rejectionReason: String,
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const Application = mongoose.model<Application>("Application", applicationSchema);

export = Application;
