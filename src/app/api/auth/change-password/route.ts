import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import { updateSupabasePassword } from "@/lib/auth/school-account";
import { schoolLoginEmail } from "@/lib/domain";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const store = await getStore();
    const nextPassword = (body.newPassword ?? "").trim();
    store.changePassword(session, body.currentPassword ?? "", nextPassword);
    await persistStore();
    const extraEmails = session.institutionIds
      .map((institutionId) => store.getState().institutions.find((row) => row.id === institutionId))
      .filter((institution): institution is NonNullable<typeof institution> => Boolean(institution))
      .map((institution) => schoolLoginEmail(institution.code));
    await updateSupabasePassword(session, nextPassword, extraEmails);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
