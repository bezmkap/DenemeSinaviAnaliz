import ExcelJS from "exceljs";
import { workbookToBuffer } from "@/lib/import/workbook";
import type { StudentAveragesReport } from "@/lib/rapor/student-averages";

const HEADER_YELLOW = "F4C542";
const TITLE_FILL = "1F4E3D";
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
};

function shortNetHeader(code: string, name: string): string {
  const labels: Record<string, string> = {
    turkce: "TÜRKÇE NET",
    inkilap: "SOSYAL NET",
    sosyal: "SOSYAL NET",
    din: "DİN K. NET",
    ingilizce: "İNG NET",
    matematik: "MAT NET",
    fen: "FEN B. NET",
    turkdili: "TDE NET",
    tarih1: "TARİH-1 NET",
    cografya1: "COĞ-1 NET",
    tarih2: "TARİH-2 NET",
    cografya2: "COĞ-2 NET",
    felsefe: "FEL NET",
    fizik: "FİZİK NET",
    kimya: "KİMYA NET",
    biyoloji: "BİYO NET",
  };
  return labels[code] ?? `${name.split(" ")[0].toLocaleUpperCase("tr-TR")} NET`;
}

function styleHeader(row: ExcelJS.Row, from: number, to: number) {
  for (let col = from; col <= to; col += 1) {
    const cell = row.getCell(col);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_YELLOW } };
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER;
  }
  row.height = 28;
}

function cellValue(value: string | number | null | undefined): string | number {
  return value == null ? "" : value;
}

function groupValues(group: StudentAveragesReport["summaries"][number], subjects: StudentAveragesReport["subjects"]) {
  return [
    group.label,
    group.participants,
    cellValue(group.placeRank),
    cellValue(group.avgScore),
    ...subjects.map((subject) => cellValue(group.avgNets[subject.code])),
    cellValue(group.avgTotalNet),
  ];
}

function paintRow(row: ExcelJS.Row, from: number, to: number) {
  for (let col = from; col <= to; col += 1) {
    row.getCell(col).border = BORDER;
    row.getCell(col).alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "center" };
  }
}

export async function buildStudentAveragesWorkbook(report: StudentAveragesReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rize ili süreç izleme sistemi";
  const sheet = workbook.addWorksheet("Öğrenci Ortalamaları", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const netHeaders = report.subjects.map((subject) => shortNetHeader(subject.code, subject.name));
  const scoreLabel =
    report.examType === "AYT" && report.scoreTrackLabel
      ? report.scoreTrackLabel.toLocaleUpperCase("tr-TR")
      : "";
  const scoreOrtHeader = scoreLabel ? `${scoreLabel} PUAN ORT.` : "PUAN ORT.";
  const scoreHeader = scoreLabel ? `${scoreLabel} PUAN` : "PUAN";
  const summaryHeaders = ["", "GİREN ÖĞRENCİ", "İL SIRASI", scoreOrtHeader, ...netHeaders, "TOP NET"];
  const lastCol = summaryHeaders.length;

  sheet.mergeCells(1, 1, 1, lastCol);
  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.mergeCells(3, 1, 3, lastCol);
  const title = sheet.getRow(1);
  title.getCell(1).value = report.title || "SÜREÇ DEĞERLENDİRME";
  title.getCell(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  title.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TITLE_FILL } };
  title.height = 24;
  const subtitle = sheet.getRow(2);
  subtitle.getCell(1).value = report.subtitle;
  subtitle.getCell(1).font = { bold: true, size: 14 };
  subtitle.getCell(1).alignment = { horizontal: "center" };
  subtitle.height = 20;
  const section = sheet.getRow(3);
  section.getCell(1).value = "ÖĞRENCİ ORTALAMALARI";
  section.getCell(1).font = { bold: true, size: 12 };
  section.getCell(1).alignment = { horizontal: "center" };

  const headerRow = sheet.getRow(4);
  headerRow.values = summaryHeaders;
  styleHeader(headerRow, 1, lastCol);

  let cursor = 5;
  for (const group of report.summaries) {
    const row = sheet.getRow(cursor);
    row.values = groupValues(group, report.subjects);
    paintRow(row, 1, lastCol);
    row.getCell(1).font = { bold: true };
    cursor += 1;
  }

  if (report.scope === "il" && report.districts.length) {
    cursor += 1;
    sheet.mergeCells(cursor, 1, cursor, lastCol);
    sheet.getRow(cursor).getCell(1).value = "İLÇE ORTALAMALARI";
    sheet.getRow(cursor).getCell(1).font = { bold: true };
    cursor += 1;
    const districtHeader = sheet.getRow(cursor);
    districtHeader.values = summaryHeaders;
    styleHeader(districtHeader, 1, lastCol);
    cursor += 1;
    for (const group of report.districts) {
      const row = sheet.getRow(cursor);
      row.values = groupValues(group, report.subjects);
      paintRow(row, 1, lastCol);
      cursor += 1;
    }
  }

  if (report.scope !== "okul" && report.schools.length) {
    cursor += 1;
    sheet.mergeCells(cursor, 1, cursor, lastCol);
    sheet.getRow(cursor).getCell(1).value = "OKUL ORTALAMALARI";
    sheet.getRow(cursor).getCell(1).font = { bold: true };
    cursor += 1;
    const schoolHeader = sheet.getRow(cursor);
    schoolHeader.values = summaryHeaders;
    styleHeader(schoolHeader, 1, lastCol);
    cursor += 1;
    for (const group of report.schools) {
      const row = sheet.getRow(cursor);
      row.values = groupValues(group, report.subjects);
      paintRow(row, 1, lastCol);
      cursor += 1;
    }
  }

  cursor += 1;
  const studentHeaders =
    report.scope === "okul"
      ? ["OKUL SIRA", "SINIFI", "ŞUBE", "ÖĞRENCİ NO", "ÖĞRENCİ ADI", "İL SIRA", "İLÇE SIRA", scoreHeader, ...netHeaders, "TOP NET"]
      : report.scope === "ilce"
        ? ["İLÇE SIRA", "OKUL", "SINIFI", "ŞUBE", "ÖĞRENCİ NO", "ÖĞRENCİ ADI", "İL SIRA", scoreHeader, ...netHeaders, "TOP NET"]
        : ["İL SIRA", "İLÇE", "OKUL", "SINIFI", "ŞUBE", "ÖĞRENCİ NO", "ÖĞRENCİ ADI", "İLÇE SIRA", scoreHeader, ...netHeaders, "TOP NET"];
  const studentLast = studentHeaders.length;
  sheet.mergeCells(cursor, 1, cursor, studentLast);
  sheet.getRow(cursor).getCell(1).value = "ÖĞRENCİ LİSTESİ";
  sheet.getRow(cursor).getCell(1).font = { bold: true };
  cursor += 1;
  const studentHeader = sheet.getRow(cursor);
  studentHeader.values = studentHeaders;
  styleHeader(studentHeader, 1, studentLast);
  cursor += 1;

  for (const student of report.students) {
    const nets = report.subjects.map((subject) => student.nets[subject.code] ?? null);
    const values =
      report.scope === "okul"
        ? [
            student.schoolRank,
            student.grade,
            student.section,
            student.studentNo,
            student.name,
            student.cityRank,
            student.districtRank,
            student.score,
            ...nets,
            student.totalNet,
          ]
        : report.scope === "ilce"
          ? [
              student.districtRank,
              student.schoolName,
              student.grade,
              student.section,
              student.studentNo,
              student.name,
              student.cityRank,
              student.score,
              ...nets,
              student.totalNet,
            ]
          : [
              student.cityRank,
              student.district,
              student.schoolName,
              student.grade,
              student.section,
              student.studentNo,
              student.name,
              student.districtRank,
              student.score,
              ...nets,
              student.totalNet,
            ];
    const row = sheet.getRow(cursor);
    row.values = values;
    paintRow(row, 1, studentLast);
    cursor += 1;
  }

  sheet.columns = Array.from({ length: Math.max(lastCol, studentLast) }, (_, index) => ({
    width: index === 0 || index === 4 || index === 5 ? 22 : 12,
  }));
  return workbookToBuffer(workbook);
}

export function reportFileName(report: StudentAveragesReport): string {
  const slug = [report.examType, report.scope, report.subtitle]
    .join("-")
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "ogrenci-ortalamalari"}.xlsx`;
}
