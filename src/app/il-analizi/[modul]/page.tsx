export const dynamic = "force-dynamic";

import { ProvinceModuleScreen } from "@/components/province-module-screen";
import { IL_ANALYSIS_MODULES } from "@/lib/domain";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ modul: string }>;
}): Promise<Metadata> {
  const { modul } = await params;
  const name = IL_ANALYSIS_MODULES.find((row) => row.slug === modul)?.name ?? "İl analizi";
  return { title: name };
}

export default async function ProvinceModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ modul: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { modul } = await params;
  if (modul === "genel") redirect("/il-analizi");
  return <ProvinceModuleScreen searchParams={searchParams} moduleSlug={modul} />;
}
