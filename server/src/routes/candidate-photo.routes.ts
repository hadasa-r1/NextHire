import path = require("node:path");
import rules = require("../validation/field-rules.mjs");
import createFileUploadRoutes = require("./file-upload.routes");

function createCandidatePhotoRoutes(directory = path.resolve(__dirname, "../../uploads/candidate-photos")) {
  return createFileUploadRoutes({
    directory, prefix: "/api/candidate-photos", maxBytes: rules.MAX_PHOTO_BYTES,
    formats: {
      png: { contentType: "image/png", disposition: "inline" },
      jpg: { contentType: "image/jpeg", disposition: "inline" },
    },
    validate(name, bytes) {
      const issue = rules.photoFileIssue(name, bytes.length);
      if (issue) return { status: 400, message: issue };
      const extension = /\.png$/i.test(name) ? "png" : "jpg";
      // Signature checks are format screening, not a full image decoder.
      const valid = extension === "png"
        ? bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
          bytes.toString("ascii", 12, 16) === "IHDR" && bytes.toString("ascii", bytes.length - 8, bytes.length - 4) === "IEND"
        : bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 &&
          bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
      if (!valid) return { status: 415, message: "תוכן הקובץ אינו תואם לתמונת JPG או PNG." };
      return { extension };
    },
  });
}
export = createCandidatePhotoRoutes;
