import { apiRequest } from "./client";
import { resumeFileIssue } from "@resume-policy";

export async function uploadResume(file: File): Promise<string> {
  const issue = resumeFileIssue(file.name, file.size);
  if (issue) throw new Error(issue);
  const response = await apiRequest<{ path: string }>("/resumes", { method: "POST", file });
  if (!/^\/api\/resumes\/[0-9a-f-]+\.(pdf|docx)$/.test(response.path)) throw new Error("השרת לא החזיר קישור תקין לקובץ.");
  return new URL(response.path, window.location.origin).href;
}
