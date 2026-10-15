import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import { NextResponse } from "next/server";
import { deleteSchoolAccount, syncSchoolInstitution } from "@/lib/auth/school-account";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await request.json();
    const store = await getStore();
    const previous = store.getInstitution(session, id);
    const institution = store.updateInstitution(session, id, {
      code: body.code,
      name: body.name,
      city: body.city,
      district: body.district,
      type: body.type,
      types: body.types,
      examTypePermissions: body.examTypePermissions,
    });
    await persistStore();
    try {
      await syncSchoolInstitution(institution, previous.code);
    } catch (error) {
      console.error("Okul hesabı Supabase'te güncellenemedi:", error);
    }
    return NextResponse.json({ institution });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const store = await getStore();
    const previous = store.getInstitution(session, id);
    const deleted = store.deleteInstitution(session, id);
    await persistStore();
    try {
      await deleteSchoolAccount(previous);
    } catch (error) {
      console.error("Okul hesabı Supabase'ten silinemedi:", error);
    }
    return NextResponse.json({ deleted });
  } catch (error) {
    return jsonError(error);
  }
}
