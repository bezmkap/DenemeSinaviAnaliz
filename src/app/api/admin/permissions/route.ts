import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const store = await getStore();
    const logs = store.setModulePermissions(session, {
      institutionIds: body.institutionIds,
      moduleSlugs: body.moduleSlugs,
      examTypes: body.examTypes,
      enabled: Boolean(body.enabled),
    });
    await persistStore();
    return NextResponse.json({ logs });
  } catch (error) {
    return jsonError(error);
  }
}
