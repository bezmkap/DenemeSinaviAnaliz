import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    name: "DenemeSinaviAnaliz",
    demo: !process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
