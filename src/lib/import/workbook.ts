import ExcelJS from "exceljs";
import { AppError, ErrorCodes } from "@/lib/errors";
import { foldTr, type ExamType } from "@/lib/domain";
import {
  groupAnswerColumns,
  matchField,
  type HeaderCell,
} from "@/lib/import/headers";
import { isKeySheetName, mergeAnswerKeys, normalizeAnswerString, normalizeBooklet, type AnswerKeySet } from "@/lib/import/answers";
import { SUBJECTS_BY_EXAM } from "@/lib/domain";

export type RawRow = {
  excelRow: number;
  values: unknown[];
};

function resolvedCell(cell: ExcelJS.Cell): ExcelJS.Cell {
  try {
    if (cell.isMerged && cell.master) return cell.master;
  } catch {
    // bazı birleşik hücrelerde master yok
  }
  return cell;
}

function sheetLastRow(sheet: ExcelJS.Worksheet): number {
  const dim = sheet.dimensions as { bottom?: number } | undefined;
  const bottom = Number(dim?.bottom) || 0;
  return Math.max(sheet.rowCount ?? 0, sheet.actualRowCount ?? 0, bottom, 1);
}

function cellToValue(cell: ExcelJS.Cell): unknown {
  const v = resolvedCell(cell).value;
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((p: { text: string }) => p.text).join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return v.result ?? "";
    if ("hyperlink" in v && "text" in v) return String(v.text ?? "");
  }
  return String(v);
}

function readSheetTable(sheet: ExcelJS.Worksheet): { headers: HeaderCell[]; rows: RawRow[] } {
  const headerRow = sheet.getRow(1);
  const headers: HeaderCell[] = [];
  const colCount = Math.max(sheet.columnCount, headerRow.cellCount, sheet.actualColumnCount ?? 0);
  for (let i = 1; i <= colCount; i += 1) {
    const raw = String(cellToValue(headerRow.getCell(i)) ?? "").trim();
    if (!raw) continue;
    headers.push({ index: i, raw, folded: foldTr(raw) });
  }
  const lastRow = sheetLastRow(sheet);
  const rows: RawRow[] = [];
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values: unknown[] = [];
    let empty = true;
    for (let i = 1; i <= colCount; i += 1) {
      const value = cellToValue(row.getCell(i));
      values[i] = value;
      if (value !== "" && value != null) empty = false;
    }
    if (!empty) rows.push({ excelRow: rowNumber, values });
  }
  return { headers, rows };
}

export function parseAnswerKeySheet(
  headers: HeaderCell[],
  rows: RawRow[],
  examType: ExamType,
): AnswerKeySet {
  const bookletIndex = headers.find((header) => matchField(header.folded) === "booklet")?.index;
  const columns = groupAnswerColumns(headers, examType);
  const keys: AnswerKeySet = {};
  for (const row of rows) {
    const booklet = normalizeBooklet(bookletIndex != null ? row.values[bookletIndex] : "A");
    keys[booklet] = keys[booklet] ?? {};
    for (const column of columns) {
      const def = SUBJECTS_BY_EXAM[examType].find((subject) => subject.code === column.subjectCode);
      if (!def) continue;
      keys[booklet][column.subjectCode] = normalizeAnswerString(row.values[column.index], def.questionCount);
    }
  }
  return keys;
}

export async function readTopluSonucSheet(
  buffer: Buffer,
  examType: ExamType = "LGS",
): Promise<{
  sheetName: string;
  headers: HeaderCell[];
  rows: RawRow[];
  answerKeys: AnswerKeySet;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const dataSheet =
    workbook.worksheets.find((ws) => foldTr(ws.name) === "toplusonuc") ??
    workbook.worksheets.find((ws) => !isKeySheetName(ws.name)) ??
    workbook.worksheets[0] ??
    null;
  if (!dataSheet) {
    const names = workbook.worksheets.map((ws) => ws.name).join(", ");
    throw new AppError(
      ErrorCodes.VALIDATION,
      names
        ? `Öğrenci cevap sayfası bulunamadı. Dosyadaki sayfalar: ${names}`
        : "Excel dosyasında çalışma sayfası yok.",
    );
  }

  const { headers, rows } = readSheetTable(dataSheet);
  if (headers.length === 0) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      "Öğrenci sayfasının ilk satırında sütun başlığı yok.",
    );
  }
  let answerKeys: AnswerKeySet = {};
  for (const sheet of workbook.worksheets) {
    if (!isKeySheetName(sheet.name)) continue;
    const table = readSheetTable(sheet);
    answerKeys = mergeAnswerKeys(answerKeys, parseAnswerKeySheet(table.headers, table.rows, examType));
  }
  return { sheetName: dataSheet.name, headers, rows, answerKeys };
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
