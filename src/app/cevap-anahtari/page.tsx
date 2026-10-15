import { AppShell } from "@/components/app-shell";
import { AnswerKeyScreen } from "@/components/answer-key-screen";
import { loadPanelContext } from "@/lib/panel";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cevap anahtarı" };

export default async function AnswerKeyPage() {
  const ctx = await loadPanelContext();
  return (
    <AppShell
      user={ctx.session}
      institution={ctx.institution}
      modules={ctx.modules}
      institutions={ctx.allInstitutions}
      canViewNetwork={ctx.canViewNetwork}
    >
      <AnswerKeyScreen
        sittings={ctx.store.listAnswerKeySittings(ctx.session)}
        readOnly={!ctx.store.canEditAnswerKeys(ctx.session)}
      />
    </AppShell>
  );
}
