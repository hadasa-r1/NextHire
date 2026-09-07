import dotenv = require("dotenv");
import mongoose = require("mongoose");
import path = require("node:path");
import process = require("node:process");

async function connectDatabase(): Promise<void> {
  dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
    quiet: true,
  });

  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error("MONGODB_URI is missing. Set it in the project .env file.");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
}

export = connectDatabase;
