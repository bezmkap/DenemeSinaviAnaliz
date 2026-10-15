import { ProvinceModuleScreen } from "@/components/province-module-screen";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "İl analizi" };

export default async function ProvinceAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProvinceModuleScreen searchParams={searchParams} moduleSlug="genel" />;
}
