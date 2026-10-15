import { PanelModuleScreen } from "@/components/panel-module-screen";
import { ANALYSIS_MODULES } from "@/lib/domain";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ modul: string }>;
}): Promise<Metadata> {
  const { modul } = await params;
  const name = ANALYSIS_MODULES.find((row) => row.slug === modul)?.name ?? "Analiz";
  return { title: name };
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ modul: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { modul } = await params;
  return <PanelModuleScreen searchParams={searchParams} moduleSlug={modul} />;
}
