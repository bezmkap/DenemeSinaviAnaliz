import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
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
    const user = store.updateDistrictUser(session, id, {
      email: body.email,
      fullName: body.fullName,
      city: body.city,
      district: body.district,
      password: body.password,
    });
    await persistStore({ required: true });
    return NextResponse.json({ user });
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
    const deleted = store.deleteDistrictUser(session, id);
    await persistStore();
    return NextResponse.json(deleted);
  } catch (error) {
    return jsonError(error);
  }
}
