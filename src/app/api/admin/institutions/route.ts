import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import { NextResponse } from "next/server";
import type { ExamType, InstitutionType } from "@/lib/domain";
import { provisionSchoolAccount } from "@/lib/auth/school-account";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const store = await getStore();
    const rows = store.listInstitutions(session, {
      query: url.searchParams.get("q") ?? undefined,
      city: url.searchParams.get("il") ?? undefined,
      district: url.searchParams.get("ilce") ?? undefined,
      type: (url.searchParams.get("tur") as InstitutionType) || undefined,
      examType: (url.searchParams.get("sinav") as ExamType) || undefined,
    });
    return NextResponse.json({ institutions: rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const store = await getStore();
    const created = store.createInstitution(session, {
      code: body.code,
      name: body.name,
      city: body.city,
      district: body.district,
      type: body.type,
      types: body.types,
      examTypePermissions: body.examTypePermissions ?? [],
    });
    await persistStore();
    try {
      await provisionSchoolAccount(created.institution, created.login.password);
    } catch (error) {
      console.error("Okul hesabı Supabase'e yazılamadı:", error);
    }
    return NextResponse.json({
      institution: created.institution,
      login: created.login,
    });
  } catch (error) {
    return jsonError(error);
  }
}
