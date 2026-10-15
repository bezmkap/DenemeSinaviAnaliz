import { redirect } from "next/navigation";

export default async function LegacyNetworkAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) next.set(key, single);
  }
  const query = next.toString();
  redirect(query ? `/il-analizi?${query}` : "/il-analizi");
}
