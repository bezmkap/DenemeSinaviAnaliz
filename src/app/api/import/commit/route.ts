import { jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import { deleteRemotePreview, loadRemotePreview } from "@/lib/store/remote";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const store = await getStore();
    if (!store.hasPreview(body.previewId)) {
      const remotePreview = await loadRemotePreview(body.previewId);
      if (remotePreview) store.attachPreview(remotePreview);
    }
    const result = await store.commitUpload(session, {
      previewId: body.previewId,
      mapping: body.mapping,
      examName: body.examName,
      examDate: body.examDate,
      academicYearId: body.academicYearId,
      publisher: body.publisher,
      examCode: body.examCode,
      tytSittingId: body.tytSittingId ?? null,
    });
    await persistStore({ required: true });
    await deleteRemotePreview(body.previewId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
