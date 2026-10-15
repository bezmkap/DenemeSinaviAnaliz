import { createClient } from "@supabase/supabase-js";
import { parseRole, type AcademicYear, type Institution, type Role, type SessionUser } from "@/lib/domain";
import { AppError, ErrorCodes } from "@/lib/errors";
import {
  createSupabaseServiceClient,
  supabaseConfigured,
} from "@/lib/supabase/server";

export type SupabaseLoginBundle = {
  session: SessionUser;
  institutions: Institution[];
  years: AcademicYear[];
};

function mapInstitution(row: {
  id: string;
  code: string;
  name: string;
  city: string;
  district: string;
  type: Institution["type"];
  types?: Institution["types"];
  exam_type_permissions: Institution["examTypePermissions"];
  created_at: string;
}): Institution {
  const types = row.types?.length ? row.types : [row.type];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    city: row.city,
    district: row.district,
    type: types[0],
    types,
    examTypePermissions: row.exam_type_permissions ?? [],
    createdAt: row.created_at,
  };
}

function mapYear(row: {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
}): AcademicYear {
  return {
    id: row.id,
    label: row.label,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isActive: row.is_active,
  };
}

export async function loginWithSupabase(
  email: string,
  password: string,
): Promise<SupabaseLoginBundle | null> {
  if (!supabaseConfigured()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.user) {
    const message = (error?.message ?? "").toLocaleLowerCase("tr-TR");
    if (message.includes("email not confirmed") || message.includes("onay")) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED,
        "E-posta henüz onaylanmadı. Supabase Authentication → Users içinde kullanıcıyı onaylayın.",
        401,
      );
    }
    return null;
  }

  const userId = data.user.id;
  const userEmail = data.user.email ?? email.trim();
  const displayName =
    (typeof data.user.user_metadata?.full_name === "string" &&
      data.user.user_metadata.full_name) ||
    userEmail.split("@")[0];

  let service;
  try {
    service = createSupabaseServiceClient();
  } catch {
    return {
      session: {
        id: userId,
        email: userEmail,
        fullName: displayName,
        role: "system_admin",
        institutionIds: [],
      },
      institutions: [],
      years: [],
    };
  }

  const { data: existing } = await service
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  let profile = existing;
  if (!profile) {
    const { count } = await service.from("profiles").select("id", { count: "exact", head: true });
    const role: Role = (count ?? 0) === 0 ? "system_admin" : "school_user";
    const { data: inserted, error: insertError } = await service
      .from("profiles")
      .insert({
        id: userId,
        email: userEmail,
        full_name: displayName,
        role,
      })
      .select("id, email, full_name, role")
      .single();
    if (insertError || !inserted) {
      throw new AppError(
        ErrorCodes.UNAUTHORIZED,
        "Supabase kullanıcısı doğrulandı ama profiles kaydı oluşturulamadı.",
        401,
      );
    }
    profile = inserted;
  }

  const { data: membershipRows } = await service
    .from("memberships")
    .select("institution_id")
    .eq("user_id", userId);

  const { data: institutionRows } = await service.from("institutions").select("*");
  const { data: yearRows } = await service.from("academic_years").select("*");

  return {
    session: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      role: parseRole(profile.role),
      institutionIds:
        profile.role === "system_admin"
          ? []
          : (membershipRows ?? []).map((row) => String(row.institution_id)),
      city: "city" in profile && typeof profile.city === "string" ? profile.city : null,
      district:
        "district" in profile && typeof profile.district === "string" ? profile.district : null,
    },
    institutions: (institutionRows ?? []).map(mapInstitution),
    years: (yearRows ?? []).map(mapYear),
  };
}
