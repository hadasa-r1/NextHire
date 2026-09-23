import mongoose = require("mongoose");
import rules = require("../validation/field-rules.mjs");

interface Candidate {
  fullName?: string;
  idNumber: string;
  phone?: string;
  email?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  photoUrl?: string;
}

const candidateSchema = new mongoose.Schema<Candidate>(
  {
    fullName: { type: String, cast: false, trim: true, validate: { validator: rules.optional(value => typeof value === "string"), message: "שם המועמד חייב להיות טקסט." } },
    idNumber: {
      type: String,
      required: true,
      cast: false,
      trim: true,
      validate: { validator: rules.isIsraeliId, message: rules.messages.idNumber },
    },
    phone: { type: String, cast: false, trim: true, validate: { validator: rules.optionalText(rules.isPhone), message: rules.messages.phone } },
    email: { type: String, cast: false, trim: true, validate: { validator: rules.optionalText(rules.isEmail), message: rules.messages.email } },
    linkedinUrl: { type: String, cast: false, trim: true, validate: { validator: rules.optionalText(rules.isLinkedInProfileUrl), message: "יש להזין קישור HTTPS לפרופיל LinkedIn." } },
    githubUrl: { type: String, cast: false, trim: true, validate: { validator: rules.optionalText(rules.isGitHubProfileUrl), message: "יש להזין קישור HTTPS לפרופיל GitHub." } },
    photoUrl: { type: String, cast: false, trim: true, validate: { validator: rules.optionalText(value => rules.webDocumentUrl(value) !== null), message: "קישור התמונה אינו תקין." } },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const Candidate = mongoose.model<Candidate>("Candidate", candidateSchema);

export = Candidate;
