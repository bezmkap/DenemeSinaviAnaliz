import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const store = await getStore();
    const upload = store.rollbackUpload(session, body.uploadId);
    await persistStore({ required: true });
    return NextResponse.json({ upload });
  } catch (error) {
    return jsonError(error);
  }
}
