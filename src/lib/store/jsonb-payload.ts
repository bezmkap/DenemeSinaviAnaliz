import { gunzipSync, gzipSync } from "node:zlib";

export const RUNTIME_STATE_ID = "singleton";

const PLAIN_LIMIT = 300_000;
const CHUNK_LIMIT = 400_000;

export type RuntimeRow = {
  id: string;
  payload: unknown;
};

type EncodeOptions = {
  plainLimit?: number;
  chunkLimit?: number;
};

export function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeStoredText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : sanitizeJsonValue(item)));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined || typeof item === "function" || typeof item === "symbol") continue;
      out[key] = sanitizeJsonValue(item);
    }
    return out;
  }
  if (value === undefined) return null;
  return value;
}

export function sanitizeStoredText(value: string): string {
  return value
    .replaceAll("\u0000", "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

export function encodeRuntimeRows(state: unknown, options?: EncodeOptions): RuntimeRow[] {
  const clean = sanitizeJsonValue(state);
  const json = JSON.stringify(clean);
  const plainLimit = options?.plainLimit ?? PLAIN_LIMIT;
  if (json.length <= plainLimit) {
    return [{ id: RUNTIME_STATE_ID, payload: clean }];
  }

  const body = gzipSync(Buffer.from(json, "utf8")).toString("base64");
  const chunkLimit = options?.chunkLimit ?? CHUNK_LIMIT;
  if (body.length <= chunkLimit) {
    return [{ id: RUNTIME_STATE_ID, payload: { __dsaEncoding: "gzip-json-v1", body } }];
  }

  const rows: RuntimeRow[] = [];
  let index = 0;
  for (let offset = 0; offset < body.length; offset += chunkLimit) {
    rows.push({
      id: `${RUNTIME_STATE_ID}:${index}`,
      payload: {
        __dsaEncoding: "gzip-part-v1",
        index,
        body: body.slice(offset, offset + chunkLimit),
      },
    });
    index += 1;
  }
  rows.push({
    id: RUNTIME_STATE_ID,
    payload: { __dsaEncoding: "gzip-chunks-v1", parts: index },
  });
  return rows;
}

export function decodeRuntimePayload(rows: RuntimeRow[]): unknown | null {
  const main = rows.find((row) => row.id === RUNTIME_STATE_ID);
  if (!main) return null;
  const payload = main.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload ?? null;
  const encoded = payload as { __dsaEncoding?: string; body?: string; parts?: number };
  if (!encoded.__dsaEncoding) return payload;
  if (encoded.__dsaEncoding === "gzip-json-v1" && encoded.body) {
    return JSON.parse(gunzipSync(Buffer.from(encoded.body, "base64")).toString("utf8"));
  }
  if (encoded.__dsaEncoding === "gzip-chunks-v1" && encoded.parts) {
    let packed = "";
    for (let index = 0; index < encoded.parts; index += 1) {
      const part = rows.find((row) => row.id === `${RUNTIME_STATE_ID}:${index}`);
      const body =
        part && part.payload && typeof part.payload === "object" && "body" in part.payload
          ? String((part.payload as { body?: unknown }).body ?? "")
          : "";
      if (!body) return null;
      packed += body;
    }
    return JSON.parse(gunzipSync(Buffer.from(packed, "base64")).toString("utf8"));
  }
  return null;
}

export function explainRemotePersistFailure(detail: string): string {
  if (/schema cache|does not exist|could not find the table|42P01|PGRST205/i.test(detail)) {
    return "Yükleme kaydı kalıcı olarak yazılamadı. Supabase SQL editöründe 0002_runtime_state.sql dosyasını çalıştırın.";
  }
  if (/row-level security|42501|permission denied|invalid api key|jwt/i.test(detail)) {
    return "Yükleme kaydı yazılamadı. Supabase service role anahtarı geçersiz veya tablo izni yok.";
  }
  const short = detail.replace(/\s+/g, " ").trim().slice(0, 160);
  return short
    ? `Yükleme kaydı kalıcı olarak yazılamadı. ${short}`
    : "Yükleme kaydı kalıcı olarak yazılamadı. Supabase kaydı tamamlanamadı.";
}
