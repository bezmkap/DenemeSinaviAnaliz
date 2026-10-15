import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireSession();
    const store = await getStore();
    const users = store.listDistrictUsers(session);
    if (store.hasPendingSave()) await persistStore();
    return NextResponse.json({ users });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const store = await getStore();
    const created = store.createDistrictUser(session, {
      email: body.email,
      fullName: body.fullName,
      password: body.password,
      city: body.city,
      district: body.district,
    });
    await persistStore({ required: true });
    return NextResponse.json(created);
  } catch (error) {
    return jsonError(error);
  }
}
