import { syncAcademicYears } from "@/lib/academic-years-remote";
import { requireSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { getStore, persistStore } from "@/lib/store/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const store = await getStore();
    const year = store.createAcademicYear(session, {
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
