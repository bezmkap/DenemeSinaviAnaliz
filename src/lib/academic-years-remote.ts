import type { AcademicYear } from "@/lib/domain";
import { supabaseServiceConfigured } from "@/lib/auth/school-account";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function remoteRow(year: AcademicYear) {
  return {
    id: year.id,
    label: year.label,
    starts_on: year.startsOn,
    ends_on: year.endsOn,
    is_active: year.isActive,
  };
}

export async function syncAcademicYears(years: AcademicYear[]) {
  const rows = years.filter((year) => UUID.test(year.id)).map(remoteRow);
  if (!rows.length || !supabaseServiceConfigured()) return;
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service.from("academic_years").upsert(rows, { onConflict: "id" });
    if (error) console.error("Akademik yıl yazılamadı:", error.message);
  } catch (error) {
    console.error("Akademik yıl yazılamadı:", error);
  }
}

export async function deleteRemoteAcademicYear(id: string) {
  if (!UUID.test(id) || !supabaseServiceConfigured()) return;
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service.from("academic_years").delete().eq("id", id);
    if (error) console.error("Akademik yıl silinemedi:", error.message);
  } catch (error) {
    console.error("Akademik yıl silinemedi:", error);
  }
}
