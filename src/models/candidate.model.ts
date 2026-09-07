import mongoose = require("mongoose");

interface Candidate {
  fullName?: string;
  idNumber: string;
  phone?: string;
  email?: string;
}

const candidateSchema = new mongoose.Schema<Candidate>(
  {
    fullName: String,
    idNumber: {
      type: String,
      required: true,
    },
    phone: String,
    email: String,
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

const Candidate = mongoose.model<Candidate>("Candidate", candidateSchema);

export = Candidate;
