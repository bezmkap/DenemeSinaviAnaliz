import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import { saveRemotePreview } from "@/lib/store/remote";
import type { ExamType } from "@/lib/domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    const examType = String(form.get("examType") ?? "") as ExamType;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });
    }
    if (!["LGS", "TYT", "AYT"].includes(examType)) {
      return NextResponse.json({ error: "Sınav türü seçilmedi." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const store = await getStore();
    const preview = await store.previewUpload(session, {
      buffer,
      fileName: file.name,
      examType,
    });
    await saveRemotePreview({
      id: preview.previewId,
      actorId: session.id,
      fileName: file.name,
      fileHash: preview.fileHash,
      examType,
      createdAt: new Date().toISOString(),
      buffer,
    });
    return NextResponse.json(preview);
  } catch (error) {
    return jsonError(error);
  }
}
