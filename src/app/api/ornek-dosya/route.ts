import { jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import { NextResponse } from "next/server";
import {
  anonymousAytStudent,
  anonymousLgsStudent,
  anonymousTytStudent,
  buildAnswerSheetSample,
} from "@/lib/import/sample-files";
import type { ExamType } from "@/lib/domain";
import { institutionHasType } from "@/lib/domain";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();
    const url = new URL(request.url);
    const tur = (url.searchParams.get("tur") ?? "LGS") as ExamType;
    const store = await getStore();
    const schools = store.listInstitutions(session);
    const preferred =
      tur === "LGS"
        ? schools.find((row) => row.examTypePermissions.includes("LGS") || institutionHasType(row, "ortaokul"))
        : schools.find((row) => row.examTypePermissions.includes(tur) || institutionHasType(row, "lise"));
    const institutionCode = preferred?.code ?? (tur === "LGS" ? "000101" : "000202");

    const buffer =
      tur === "AYT"
        ? await buildAnswerSheetSample("AYT", [
            anonymousAytStudent({
              studentNo: "00021",
              institutionCode,
              fullName: "Anonim 12A-01",
            }),
            anonymousAytStudent({
              studentNo: "00022",
              institutionCode,
              fullName: "Anonim 12A-02",
              section: "B",
            }),
          ])
        : tur === "TYT"
          ? await buildAnswerSheetSample("TYT", [
              anonymousTytStudent({
                studentNo: "00011",
                institutionCode,
                fullName: "Anonim 12A-01",
              }),
              anonymousTytStudent({
                studentNo: "00012",
                institutionCode,
                fullName: "Anonim 12A-02",
                section: "A",
              }),
            ])
          : await buildAnswerSheetSample("LGS", [
              anonymousLgsStudent({
                studentNo: "00001",
                institutionCode,
                fullName: "Anonim 8A-01",
              }),
              anonymousLgsStudent({
                studentNo: "00004",
                institutionCode,
                fullName: "Anonim 8B-01",
                section: "B",
              }),
            ]);
    const filename =
      tur === "AYT"
        ? "ornek-ayt-anonim.xlsx"
        : tur === "TYT"
          ? "ornek-tyt-anonim.xlsx"
          : "ornek-lgs-anonim.xlsx";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
