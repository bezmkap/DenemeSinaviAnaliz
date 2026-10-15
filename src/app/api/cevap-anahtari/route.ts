import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requireSession } from "@/lib/auth/session";
import { getStore, persistStore } from "@/lib/store/server";
import type { BookletLinkSet, QuestionKeySet } from "@/lib/domain";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      sittingId?: string;
      questionKeys?: QuestionKeySet;
      bookletLinks?: BookletLinkSet;
    };
    if (!body.sittingId || !body.questionKeys) {
      return NextResponse.json({ error: "Sınav ve cevap anahtarı gerekli." }, { status: 400 });
    }
    const store = await getStore();
    const sitting = store.saveExamQuestionKeys(
      session,
      body.sittingId,
      body.questionKeys,
      body.bookletLinks ?? {},
    );
    await persistStore({ required: true });
    return NextResponse.json({ sitting });
  } catch (error) {
    return jsonError(error);
  }
}
