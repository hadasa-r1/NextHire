import path = require("node:path");
import policy = require("../validation/resume-file.mjs");
import matchesResumeFormat = require("../services/resume-format");
import createFileUploadRoutes = require("./file-upload.routes");

function createResumeUploadRoutes(directory = path.resolve(__dirname, "../../uploads/resumes")) {
  return createFileUploadRoutes({
    directory, prefix: "/api/resumes", maxBytes: policy.MAX_RESUME_BYTES,
    formats: {
      pdf: { contentType: "application/pdf", disposition: "inline" },
      docx: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", disposition: "attachment" },
    },
    validate(name, bytes) {
      const issue = policy.resumeFileIssue(name, bytes.length);
      if (issue) return { status: 400, message: issue };
      const extension = name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
      if (!matchesResumeFormat(bytes, extension))
        return { status: 415, message: "תוכן הקובץ אינו תואם לקובץ PDF או DOCX תקין." };
      return { extension };
    },
  });
}
export = createResumeUploadRoutes;
