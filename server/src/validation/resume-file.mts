// Upload policy shared by the file picker and the server; not model fields.
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const RESUME_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export function resumeFileIssue(name: string, size: number): string | undefined {
  if (!/\.(pdf|docx)$/i.test(name)) return "יש לבחור קובץ PDF או Word מסוג DOCX.";
  if (!Number.isFinite(size) || size <= 0) return "הקובץ ריק. יש לבחור קובץ קורות חיים אחר.";
  if (size > MAX_RESUME_BYTES) return "גודל הקובץ המרבי הוא 10MB.";
  return undefined;
}
