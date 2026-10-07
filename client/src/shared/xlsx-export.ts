// Minimal, dependency-free .xlsx writer. Builds the small subset of OOXML that
// Excel/LibreOffice need (no sharedStrings, no formulas) using fflate, which is
// already a client dependency (see features/applications/import-workbook.ts for
// the matching reader). Every text value is written as an inline string, never
// a formula, so a cell that looks like "=HYPERLINK(...)" stays inert text.

import { zipSync, strToU8 } from "fflate";

// { percent } holds a fraction (0.3, not 30) written as a real percent-formatted
// numeric cell, so Excel keeps full precision while displaying "30%".
export type XlsxCell = string | number | boolean | { percent: number } | null | undefined;

export interface XlsxSheet {
  name: string;
  header: readonly string[];
  rows: readonly (readonly XlsxCell[])[];
  rightToLeft?: boolean;
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const MAX_ROWS = 100_000;
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// 0 -> A, 25 -> Z, 26 -> AA (bijective base-26, matches spreadsheet columns).
export function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name || "A";
}

// Excel sheet-name rules: <=31 chars, none of []:*?/\, unique (case-insensitive).
export function sheetNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    let base = raw.replace(/[[\]:*?/\\]/g, "").trim();
    if (base === "") base = "Sheet";
    base = base.slice(0, 31);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      const tag = " (" + suffix + ")";
      candidate = base.slice(0, Math.max(0, 31 - tag.length)) + tag;
      suffix++;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

// Characters illegal in Windows/macOS file names, plus control characters.
export function xlsxFileName(title: string | undefined, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const base = title && title.trim() !== "" ? "מפ״ל - " + title.trim() : "מפ״ל";
  const cleaned = base.replace(/[\\/:*?"<>|\x00-\x1F]/g, "").trim();
  return (cleaned === "" ? "מפ״ל" : cleaned) + " " + day + ".xlsx";
}

export function downloadXlsx(fileName: string, sheets: readonly XlsxSheet[]): void {
  const bytes = buildXlsx(sheets);
  // zipSync's result is typed over ArrayBufferLike (SharedArrayBuffer included);
  // Blob only accepts a view over a concrete ArrayBuffer, hence the copy.
  const blob = new Blob([new Uint8Array(bytes)], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function buildXlsx(sheets: readonly XlsxSheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error("אין נתונים לייצוא.");
  for (const sheet of sheets) {
    if (sheet.rows.length > MAX_ROWS) throw new Error("מספר השורות חורג מהמותר לייצוא.");
  }
  const names = sheetNames(sheets.map((sheet) => sheet.name));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypesXml(sheets.length)),
    "_rels/.rels": strToU8(ROOT_RELS),
    "xl/workbook.xml": strToU8(workbookXml(names, sheets)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml(sheets.length)),
    "xl/styles.xml": strToU8(STYLES_XML),
  };
  sheets.forEach((sheet, index) => {
    files["xl/worksheets/sheet" + (index + 1) + ".xml"] = strToU8(sheetXml(sheet));
  });
  return zipSync(files);
}

// ---------- XML escaping ----------

// XML 1.0 forbids these control characters outright, even escaped.
function stripIllegalXmlChars(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function escapeXmlText(text: string): string {
  return stripIllegalXmlChars(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeXmlAttr(text: string): string {
  return escapeXmlText(text).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ---------- [Content_Types].xml / _rels ----------

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return (
    XML_DECL +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    overrides +
    "</Types>"
  );
}

const ROOT_RELS =
  XML_DECL +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";

function workbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  const stylesRel = `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheetRels +
    stylesRel +
    "</Relationships>"
  );
}

// ---------- xl/workbook.xml ----------

function workbookXml(names: readonly string[], sheets: readonly XlsxSheet[]): string {
  const sheetEls = names
    .map((name, index) => `<sheet name="${escapeXmlAttr(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  // Hidden autoFilter defined names, one per sheet that actually has a header
  // to filter on. A sheet writer reused with no columns gets no entry at all.
  const definedNames = names
    .map((name, index) => {
      const sheet = sheets[index];
      if (!sheet || sheet.header.length === 0) return "";
      const lastCol = columnName(sheet.header.length - 1);
      const lastRow = 1 + sheet.rows.length;
      const quotedName = "'" + name.replace(/'/g, "''") + "'";
      const ref = quotedName + "!$A$1:$" + lastCol + "$" + lastRow;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${escapeXmlText(ref)}</definedName>`;
    })
    .filter((entry) => entry !== "")
    .join("");
  const definedNamesBlock = definedNames === "" ? "" : "<definedNames>" + definedNames + "</definedNames>";
  return (
    XML_DECL +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}">` +
    "<sheets>" +
    sheetEls +
    "</sheets>" +
    definedNamesBlock +
    "</workbook>"
  );
}

// ---------- xl/styles.xml ----------
// Style 0: default. Style 1: bold header with a light fill and wrapped text.
// Style 2: percent (built-in numFmtId 9 = "0%"), used for { percent } cells.

const PERCENT_STYLE = 2;

const STYLES_XML =
  XML_DECL +
  `<styleSheet xmlns="${NS_MAIN}">` +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  "</fonts>" +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE7EAF0"/><bgColor indexed="64"/></patternFill></fill>' +
  "</fills>" +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1"/></xf>' +
  '<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

// ---------- xl/worksheets/sheetN.xml ----------

// Text used only to size the column; the percent cell itself keeps its exact fraction.
function cellText(value: XlsxCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return Math.round(value.percent * 100) + "%";
  return String(value);
}

function columnWidths(sheet: XlsxSheet): number[] {
  return sheet.header.map((label, column) => {
    let widest = displayWidth(label);
    for (const row of sheet.rows) {
      const value = row[column];
      if (value === null || value === undefined || value === "") continue;
      widest = Math.max(widest, displayWidth(cellText(value)));
    }
    return Math.min(60, Math.max(10, widest + 2));
  });
}

function displayWidth(text: string): number {
  return [...text].length;
}

function cellXml(ref: string, value: XlsxCell, headerStyle?: 1): string {
  if (value === null || value === undefined || value === "") return "";
  const styleAttr = headerStyle ? ` s="${headerStyle}"` : "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}"${styleAttr} t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  if (typeof value === "object") {
    if (!Number.isFinite(value.percent)) return "";
    return `<c r="${ref}" s="${PERCENT_STYLE}"><v>${value.percent}</v></c>`;
  }
  const text = stripIllegalXmlChars(value);
  if (text === "") return "";
  const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : "";
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t${preserve}>${escapeXmlText(text)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const lastCol = columnName(Math.max(0, sheet.header.length - 1));
  const lastRow = 1 + sheet.rows.length;
  const dimension = "A1:" + lastCol + lastRow;
  const widths = columnWidths(sheet);
  const colsXml =
    sheet.header.length === 0
      ? ""
      : "<cols>" +
        widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("") +
        "</cols>";
  const headerRow =
    "<row r=\"1\">" +
    sheet.header.map((label, column) => cellXml(columnName(column) + "1", label, 1)).join("") +
    "</row>";
  const dataRows = sheet.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = sheet.header.map((_, column) => cellXml(columnName(column) + r, row[column])).join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  const rtl = sheet.rightToLeft ? ' rightToLeft="1"' : "";
  const sheetViews =
    "<sheetViews>" +
    `<sheetView${rtl} workbookViewId="0">` +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    "</sheetView>" +
    "</sheetViews>";
  const autoFilter = sheet.header.length === 0 ? "" : `<autoFilter ref="${dimension}"/>`;
  return (
    XML_DECL +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">` +
    `<dimension ref="${dimension}"/>` +
    sheetViews +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    colsXml +
    "<sheetData>" +
    headerRow +
    dataRows +
    "</sheetData>" +
    autoFilter +
    "</worksheet>"
  );
}
