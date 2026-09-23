import { apiRequest } from "./client";
import { photoFileIssue } from "@validation";

export async function uploadCandidatePhoto(file: File): Promise<string> {
  const issue = photoFileIssue(file.name, file.size);
  if (issue) throw new Error(issue);
  const response = await apiRequest<{ path: string }>("/candidate-photos", { method: "POST", file });
  if (!/^\/api\/candidate-photos\/[0-9a-f-]+\.(png|jpg)$/.test(response.path))
    throw new Error("השרת לא החזיר קישור תקין לתמונה.");
  return new URL(response.path, window.location.origin).href;
}
