import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await getStore();
    return NextResponse.json({ uploads: store.listUploads(session) });
  } catch (error) {
    return jsonError(error);
  }
}
