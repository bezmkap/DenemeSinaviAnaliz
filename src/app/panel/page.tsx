import { PanelModuleScreen } from "@/components/panel-module-screen";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Okul özeti" };

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PanelModuleScreen searchParams={searchParams} moduleSlug="okul-ozeti" />;
}
