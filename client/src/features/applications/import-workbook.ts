import { unzip, strFromU8 } from "fflate";
export interface ImportRow {
  fullName: string; idNumber: string; phone?: string; email?: string; linkedinUrl?: string; githubUrl?: string; photoUrl?: string;
  resumeUrl?: string; hourlyRateBid?: number; candidateId?: string;
}
export interface ImportSheet { name: string; rows: ImportRow[]; issues: string[]; supported: boolean }
const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s"'׳״:._-]/g, "");
const aliases: Record<string, keyof ImportRow> = {};
for (const [key, labels] of Object.entries({
  fullName: ["fullName", "שם", "שם מלא", "שם מועמד"], idNumber: ["idNumber", "תז", "תז מועמד", "תעודת זהות", "מספר זהות"],
  phone: ["phone", "טלפון", "נייד"], email: ["email", "דואל", "אימייל"],
  linkedinUrl: ["linkedinUrl", "LinkedIn", "לינקדאין"], githubUrl: ["githubUrl", "GitHub", "גיטהאב"],
  photoUrl: ["photoUrl", "קישור לתמונה"], resumeUrl: ["resumeUrl", "קוח", "קורות חיים", "קישור לקורות חיים"],
  hourlyRateBid: ["hourlyRateBid", "שכר שעתי", "תעריף שעתי", "תעריף שעתי מוצע"],
})) for (const label of labels) aliases[normalize(label)] = key as keyof ImportRow;

export function rowsFromCells(rows: readonly { row: number; cells: Record<number, { text: string; formula?: boolean; numeric?: boolean }> }[], name: string): ImportSheet {
  let header: { row: number; columns: [number, keyof ImportRow][] } | undefined;
  const issues: string[] = [], result: ImportRow[] = [];
  for (const row of rows) {
    if (!header) {
      if (row.row > 50) break;
      const columns = Object.entries(row.cells).flatMap(([column, cell]) => aliases[normalize(cell.text)] ? [[Number(column), aliases[normalize(cell.text)]!] as [number, keyof ImportRow]] : []);
      if (columns.some(([, field]) => field === "fullName") && columns.some(([, field]) => field === "idNumber")) {
        if (new Set(columns.map(([, field]) => field)).size !== columns.length) issues.push("יש עמודות כפולות עם אותה משמעות.");
        header = { row: row.row, columns };
      }
      continue;
    }
    // The supplied MAFAL has explanatory education notes below its candidate table.
    if (name === "מועמדים" && normalize(row.cells[0]?.text ?? "") === "השכלה") break;
    const raw = Object.fromEntries(header.columns.map(([column, field]) => [field, row.cells[column]?.text.trim() ?? ""]));
    if (!raw.idNumber && !raw.fullName) continue;
    if (header.columns.some(([column]) => row.cells[column]?.formula)) issues.push("שורה " + row.row + ": נוסחאות אינן נתוני הגשה. יש להזין ערכים בלבד.");
    const idCell = row.cells[header.columns.find(([, field]) => field === "idNumber")![0]];
    if (idCell?.numeric && /^\d{1,9}$/.test(raw.idNumber!)) raw.idNumber = raw.idNumber!.padStart(9, "0");
    const rate = raw.hourlyRateBid;
    if (rate && (!Number.isFinite(Number(rate)) || Number(rate) < 0)) issues.push("שורה " + row.row + ": תעריף לא תקין.");
    const parsed: ImportRow = { fullName: raw.fullName ?? "", idNumber: raw.idNumber ?? "" };
    for (const key of ["phone", "email", "linkedinUrl", "githubUrl", "photoUrl", "resumeUrl"] as const)
      if (raw[key]) parsed[key] = raw[key]!;
    if (rate && Number.isFinite(Number(rate))) parsed.hourlyRateBid = Number(rate);
    result.push(parsed);
  }
  if (result.length > 100) issues.push("יש יותר מ־100 מועמדים. יש לפצל את הקובץ.");
  return { name, rows: result, issues, supported: Boolean(header) };
}
export async function readImportWorkbook(file: File): Promise<ImportSheet[]> {
  if (!/\.xlsx$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) throw new Error("יש לבחור קובץ XLSX עד 5MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let total = 0, count = 0;
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => unzip(bytes, {
    filter: entry => {
      if (++count > 500) throw new Error("הקובץ מורכב מדי לייבוא.");
      if (!/^xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml)$/.test(entry.name)) return false;
      total += entry.originalSize;
      if (entry.originalSize > 5 * 1024 * 1024 || total > 15 * 1024 * 1024) throw new Error("הקובץ גדול מדי לאחר פתיחה.");
      return true;
    },
  }, (error, data) => error ? reject(error) : resolve(data)));
  function xml(path: string) {
    if (!entries[path]) throw new Error("מבנה קובץ האקסל אינו נתמך.");
    const text = strFromU8(entries[path]);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("הקובץ כולל הגדרות XML שאינן נתמכות.");
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("תוכן האקסל אינו תקין.");
    return doc;
  }
  const descendants = (element: Document | Element, name: string) => [...element.getElementsByTagNameNS("*", name)];
  const strings = entries["xl/sharedStrings.xml"] ? descendants(xml("xl/sharedStrings.xml"), "si").map(si => descendants(si, "t").map(t => t.textContent ?? "").join("")) : [];
  const relationships = new Map(descendants(xml("xl/_rels/workbook.xml.rels"), "Relationship").filter(r => r.getAttribute("TargetMode") !== "External").map(r => [r.getAttribute("Id"), r.getAttribute("Target")!]));
  const sheets = descendants(xml("xl/workbook.xml"), "sheet");
  if (sheets.length > 30) throw new Error("ניתן לקרוא עד 30 גיליונות.");
  return sheets.map(sheet => {
    const target = relationships.get(sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
    if (!target) throw new Error("גיליון מפנה לנתיב שאינו נתמך.");
    const path = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    if (!/^xl\/worksheets\/sheet\d+.xml$/.test(path)) throw new Error("נתיב גיליון אינו נתמך.");
    const rows = descendants(xml(path), "row");
    if (rows.length > 5000) throw new Error("הגיליון גדול מדי לייבוא.");
    let cellsRead = 0;
    const parsed = rows.map(row => {
      const cells: Record<number, { text: string; formula?: boolean; numeric?: boolean }> = {};
      for (const cell of descendants(row, "c")) {
        if (++cellsRead > 50000) throw new Error("הגיליון גדול מדי.");
        const reference = cell.getAttribute("r") ?? "";
        const letters = reference.match(/^[A-Z]+/)?.[0];
        if (!letters) continue;
        const col = [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        const type = cell.getAttribute("t"), raw = descendants(cell, "v")[0]?.textContent ?? "";
        const text = type === "s" ? strings[Number(raw)] ?? "" : type === "inlineStr" ? descendants(cell, "t").map(t => t.textContent ?? "").join("") : raw;
        cells[col] = { text, formula: descendants(cell, "f").length > 0, numeric: !type || type === "n" };
      }
      return { row: Number(row.getAttribute("r")), cells };
    });
    return rowsFromCells(parsed, sheet.getAttribute("name") ?? "גיליון");
  });
}
