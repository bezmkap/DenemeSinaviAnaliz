import type { Institution } from "@/lib/domain";
import { institutionCodesEqual, schoolLoginEmail } from "@/lib/domain";
import {
  createSupabaseServiceClient,
  supabaseConfigured,
} from "@/lib/supabase/server";

export function supabaseServiceConfigured() {
  return supabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function upsertInstitutionRow(
  service: ReturnType<typeof createSupabaseServiceClient>,
  institution: Institution,
) {
  const base = {
    id: institution.id,
    code: institution.code,
    name: institution.name,
    city: institution.city,
    district: institution.district,
    type: institution.type,
    exam_type_permissions: institution.examTypePermissions,
    created_at: institution.createdAt,
  };
  const { error } = await service.from("institutions").upsert(
    { ...base, types: institution.types },
    { onConflict: "id" },
  );
  if (!error) return true;
  if (/column .*types/i.test(error.message) || /types/i.test(error.message)) {
    const retry = await service.from("institutions").upsert(base, { onConflict: "id" });
    if (retry.error) {
      console.error("Supabase kurum kaydı yazılamadı:", retry.error.message);
      return false;
    }
    return true;
  }
  console.error("Supabase kurum kaydı yazılamadı:", error.message);
  return false;
}

export async function provisionSchoolAccount(institution: Institution, password: string) {
  if (!supabaseServiceConfigured()) return;
  const service = createSupabaseServiceClient();
  const email = schoolLoginEmail(institution.code);

  if (!(await upsertInstitutionRow(service, institution))) {
    return;
  }

  const { data: createdUser, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: institution.name },
  });
  let userId = createdUser.user?.id ?? null;
  if (!userId) {
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    userId = profile?.id ?? null;
    if (userId) {
      await service.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
    } else {
      console.error("Supabase okul kullanıcısı oluşturulamadı:", createError?.message);
      return;
    }
  }

  await service.from("profiles").upsert({
    id: userId,
    email,
    full_name: institution.name,
    role: "school_user",
  });
  await service.from("memberships").upsert(
    { user_id: userId, institution_id: institution.id },
    { onConflict: "user_id,institution_id" },
  );
}

export async function updateSupabasePassword(
  session: { id: string; email: string },
  password: string,
  extraEmails: string[] = [],
) {
  if (!supabaseServiceConfigured()) return;
  const service = createSupabaseServiceClient();
  const emails: string[] = [];
  const seen = new Set<string>();
  for (const value of [session.email, ...extraEmails]) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(trimmed);
  }
  const userIds = new Set<string>([session.id]);
  for (const email of emails) {
    const { data: profile } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
    if (profile?.id) userIds.add(profile.id);
  }
  for (const userId of userIds) {
    const { error } = await service.auth.admin.updateUserById(userId, { password });
    if (error) {
      console.error("Supabase parola güncellenemedi:", error.message);
    }
  }
}

export async function syncSchoolInstitution(institution: Institution, previousCode?: string) {
  if (!supabaseServiceConfigured()) return;
  const service = createSupabaseServiceClient();
  if (!(await upsertInstitutionRow(service, institution))) {
    return;
  }

  const previous = previousCode ?? institution.code;
  const oldEmail = schoolLoginEmail(previous);
  const nextEmail = schoolLoginEmail(institution.code);
  const lookupEmail =
    previousCode && !institutionCodesEqual(previous, institution.code) ? oldEmail : nextEmail;
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("email", lookupEmail)
    .maybeSingle();
  if (!profile?.id) return;

  if (oldEmail.toLocaleLowerCase("tr-TR") !== nextEmail.toLocaleLowerCase("tr-TR")) {
    const { error } = await service.auth.admin.updateUserById(profile.id, {
      email: nextEmail,
      email_confirm: true,
    });
    if (error) {
      console.error("Supabase okul e-postası güncellenemedi:", error.message);
    }
  }
  await service.from("profiles").upsert({
    id: profile.id,
    email: nextEmail,
    full_name: institution.name,
    role: "school_user",
  });
}

export async function deleteSchoolAccount(institution: { id: string; code: string }) {
  if (!supabaseServiceConfigured()) return;
  const service = createSupabaseServiceClient();
  const email = schoolLoginEmail(institution.code);
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  const { error: instError } = await service.from("institutions").delete().eq("id", institution.id);
  if (instError) {
    console.error("Supabase kurum kaydı silinemedi:", instError.message);
  }
  if (profile?.id) {
    const { error } = await service.auth.admin.deleteUser(profile.id);
    if (error) {
      console.error("Supabase okul hesabı silinemedi:", error.message);
    }
  }
}
