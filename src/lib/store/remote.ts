import type { AppState, PreviewSession } from "@/lib/store/app-store";
import { supabaseServiceConfigured } from "@/lib/auth/school-account";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  decodeRuntimePayload,
  encodeRuntimeRows,
  RUNTIME_STATE_ID,
  type RuntimeRow,
} from "@/lib/store/jsonb-payload";

const STATE_ID = RUNTIME_STATE_ID;
let loadedRevision: string | null = null;
let savedRevision: string | null = null;
let knownChunkCount = 0;

export function consumeLoadedRevision() {
  const value = loadedRevision;
  loadedRevision = null;
  return value;
}

export function consumeSavedRevision() {
  const value = savedRevision;
  savedRevision = null;
  return value;
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return Array.isArray(row.uploads) && Array.isArray(row.institutions);
}

export async function loadRemoteRevision(): Promise<string | null | undefined> {
  if (!supabaseServiceConfigured()) return null;
  try {
    const service = createSupabaseServiceClient();
    const { data, error } = await service
      .from("app_runtime_state")
      .select("updated_at")
      .eq("id", STATE_ID)
      .maybeSingle();
    if (error) return undefined;
    return data?.updated_at ? String(data.updated_at) : null;
  } catch {
    return undefined;
  }
}

export async function loadRemoteState(): Promise<AppState | null> {
  if (!supabaseServiceConfigured()) return null;
  try {
    const service = createSupabaseServiceClient();
    const { data, error } = await service
      .from("app_runtime_state")
      .select("id, payload, updated_at")
      .eq("id", STATE_ID)
      .maybeSingle();
    if (error) {
      console.error("Uzak durum okunamadı:", error.message);
      return null;
    }
    if (!data) return null;
    const main = data as RuntimeRow & { updated_at?: string };
    loadedRevision = main.updated_at ? String(main.updated_at) : null;
    const rows = [main];
    const encoded = main.payload as { __dsaEncoding?: string; parts?: number } | null;
    knownChunkCount = encoded?.__dsaEncoding === "gzip-chunks-v1" ? Number(encoded.parts) || 0 : 0;
    if (encoded && encoded.__dsaEncoding === "gzip-chunks-v1" && encoded.parts) {
      const partIds = Array.from({ length: encoded.parts }, (_, index) => `${STATE_ID}:${index}`);
      const parts = await service.from("app_runtime_state").select("id, payload").in("id", partIds);
      if (parts.error) {
        console.error("Uzak durum okunamadı:", parts.error.message);
        return null;
      }
      rows.push(...((parts.data ?? []) as RuntimeRow[]));
    }
    const payload = decodeRuntimePayload(rows);
    return isAppState(payload) ? payload : null;
  } catch (error) {
    console.error("Uzak durum okunamadı:", error);
    return null;
  }
}

export async function saveRemoteState(state: AppState): Promise<string | null> {
  if (!supabaseServiceConfigured()) return null;
  try {
    const service = createSupabaseServiceClient();
    const rows = encodeRuntimeRows(state);
    const updatedAt = new Date().toISOString();
    for (const row of rows) {
      const saved = await service
        .from("app_runtime_state")
        .upsert(
          { id: row.id, payload: row.payload, updated_at: updatedAt },
          { onConflict: "id" },
        )
        .select("id, updated_at");
      if (saved.error) {
        console.error("Uzak durum yazılamadı:", saved.error.message);
        return saved.error.message;
      }
      if (row.id === STATE_ID) {
        const stamp = saved.data?.[0]?.updated_at;
        if (stamp) savedRevision = String(stamp);
      }
    }
    const partCount = rows.filter((row) => row.id !== STATE_ID).length;
    if (knownChunkCount > 0) {
      await removeStaleRuntimeRows(
        service,
        new Set(rows.map((row) => row.id)),
        knownChunkCount,
      );
    }
    knownChunkCount = partCount;
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase kaydı tamamlanamadı.";
    console.error("Uzak durum yazılamadı:", message);
    return message;
  }
}

async function removeStaleRuntimeRows(
  service: ReturnType<typeof createSupabaseServiceClient>,
  keepIds: Set<string>,
  previousCount: number,
) {
  try {
    const stale = Array.from({ length: previousCount }, (_, index) => `${STATE_ID}:${index}`).filter(
      (id) => !keepIds.has(id),
    );
    if (!stale.length) return;
    await service.from("app_runtime_state").delete().in("id", stale);
  } catch (error) {
    console.error("Eski durum parçaları silinemedi:", error);
  }
}

export async function saveRemotePreview(preview: PreviewSession): Promise<void> {
  if (!supabaseServiceConfigured()) return;
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service.from("app_import_previews").upsert({
      id: preview.id,
      actor_id: preview.actorId,
      file_name: preview.fileName,
      file_hash: preview.fileHash,
      exam_type: preview.examType,
      created_at: preview.createdAt,
      buffer_base64: preview.buffer.toString("base64"),
    });
    if (error) console.error("Önizleme yazılamadı:", error.message);
  } catch (error) {
    console.error("Önizleme yazılamadı:", error);
  }
}

export async function loadRemotePreview(id: string): Promise<PreviewSession | null> {
  if (!supabaseServiceConfigured()) return null;
  try {
    const service = createSupabaseServiceClient();
    const { data, error } = await service
      .from("app_import_previews")
      .select("id, actor_id, file_name, file_hash, exam_type, created_at, buffer_base64")
      .eq("id", id)
      .maybeSingle();
    if (error || !data?.buffer_base64) return null;
    return {
      id: String(data.id),
      actorId: String(data.actor_id),
      fileName: String(data.file_name),
      fileHash: String(data.file_hash),
      examType: data.exam_type as PreviewSession["examType"],
      createdAt: String(data.created_at),
      buffer: Buffer.from(String(data.buffer_base64), "base64"),
    };
  } catch (error) {
    console.error("Önizleme okunamadı:", error);
    return null;
  }
}

export async function deleteRemotePreview(id: string): Promise<void> {
  if (!supabaseServiceConfigured()) return;
  try {
    const service = createSupabaseServiceClient();
    await service.from("app_import_previews").delete().eq("id", id);
  } catch (error) {
    console.error("Önizleme silinemedi:", error);
  }
}
