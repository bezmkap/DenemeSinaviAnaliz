import { deleteRemoteAcademicYear, syncAcademicYears } from "@/lib/academic-years-remote";
import { requireSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { getStore, persistStore } from "@/lib/store/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = await request.json();
    const store = await getStore();
    const year = store.updateAcademicYear(session, id, {
      label: body.label,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      isActive: Boolean(body.isActive),
    });
    await persistStore();
    await syncAcademicYears(store.listAcademicYears());
    return NextResponse.json({ year });
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
    const deleted = store.deleteAcademicYear(session, id);
    await persistStore();
    await deleteRemoteAcademicYear(deleted.id);
    await syncAcademicYears(store.listAcademicYears());
    return NextResponse.json({ deleted });
  } catch (error) {
    return jsonError(error);
  }
}
