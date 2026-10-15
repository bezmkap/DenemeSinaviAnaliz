import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import type { ColumnMapping } from "@/lib/import/importers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as { previewId?: string; mapping?: ColumnMapping };
    if (!body.previewId || !body.mapping) {
      return NextResponse.json({ error: "Önizleme ve sütun eşlemesi gerekli." }, { status: 400 });
    }
    const store = await getStore();
    const preview = await store.refreshPreview(session, {
      previewId: body.previewId,
      mapping: body.mapping,
    });
    return NextResponse.json(preview);
  } catch (error) {
    return jsonError(error);
  }
}
