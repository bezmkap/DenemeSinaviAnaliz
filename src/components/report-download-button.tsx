"use client";

import { useSearchParams } from "next/navigation";
import type { ReportScope } from "@/lib/rapor/student-averages";
import { useIsClient } from "@/lib/utils";

export function ReportDownloadButton({
  scope,
  institutionId,
}: {
  scope: ReportScope;
  institutionId?: string;
}) {
  const params = useSearchParams();
  const isClient = useIsClient();
  const query = new URLSearchParams();
  query.set("kapsam", scope);
  if (institutionId) query.set("kurum", institutionId);
  if (isClient) {
    for (const key of ["yil", "tur", "sinav", "puan", "alan", "baslangic", "il", "ilce"] as const) {
      const value = params.get(key);
      if (value) query.set(key, value);
    }
  }
  const label =
    scope === "okul" ? "Okul raporu indir" : scope === "ilce" ? "İlçe raporu indir" : "İl raporu indir";

  return (
    <a
      href={`/api/rapor?${query.toString()}`}
      className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
    >
      {label}
    </a>
  );
}
