import { describe, expect, it } from "vitest";
import {
  decodeRuntimePayload,
  encodeRuntimeRows,
  explainRemotePersistFailure,
  sanitizeJsonValue,
} from "@/lib/store/jsonb-payload";

describe("supabase durum kaydı", () => {
  it("postgres jsonb'nin reddettiği karakterleri temizler", () => {
    const clean = sanitizeJsonValue({
      name: "A\u0000B",
      lone: "ok\uD800",
      n: Number.NaN,
      items: [undefined, "tamam"],
    });
    expect(clean).toEqual({
      name: "AB",
      lone: "ok",
      n: null,
      items: [null, "tamam"],
    });
  });

  it("küçük durumu düz, büyüğünü sıkıştırılmış ve parçalı yazar, sonra aynı okur", () => {
    const small = { uploads: [], institutions: [{ name: "Okul" }] };
    expect(encodeRuntimeRows(small, { plainLimit: 1000 })).toEqual([
      { id: "singleton", payload: small },
    ]);

    const bulky = {
      uploads: [],
      institutions: [{ note: Array.from({ length: 400 }, (_, index) => String.fromCharCode(33 + (index % 80))).join("") }],
    };
    const gzipped = encodeRuntimeRows(bulky, { plainLimit: 40, chunkLimit: 1_000_000 });
    expect(gzipped).toHaveLength(1);
    expect(gzipped[0]?.payload).toMatchObject({ __dsaEncoding: "gzip-json-v1" });
    expect(decodeRuntimePayload(gzipped)).toEqual(bulky);

    const chunked = encodeRuntimeRows(bulky, { plainLimit: 40, chunkLimit: 80 });
    expect(chunked.at(-1)?.payload).toMatchObject({ __dsaEncoding: "gzip-chunks-v1" });
    expect(chunked.length).toBeGreaterThan(2);
    expect(decodeRuntimePayload(chunked)).toEqual(bulky);
  });

  it("eksik tablo ile diğer yazma hatalarını ayırır", () => {
    expect(explainRemotePersistFailure("Could not find the table 'public.app_runtime_state' in the schema cache")).toMatch(
      /0002_runtime_state\.sql/,
    );
    expect(explainRemotePersistFailure("new row violates row-level security policy")).toMatch(/service role/);
    expect(explainRemotePersistFailure("request entity too large")).toMatch(/too large/);
  });
});
