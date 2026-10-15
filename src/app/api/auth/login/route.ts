import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { loginWithSupabase } from "@/lib/auth/supabase-login";
import { getStore, persistStore } from "@/lib/store/server";
import { supabaseConfigured } from "@/lib/supabase/server";
import { schoolLoginEmail, type SessionUser } from "@/lib/domain";

function isBuiltInDemoUser(user: SessionUser) {
  const email = user.email.toLocaleLowerCase("tr-TR");
  if (email === "bulent@demo.okul") return false;
  return /@demo\.(okul|ilce)$/i.test(email);
}

async function sessionResponse(user: SessionUser) {
  const response = NextResponse.json({ user });
  response.cookies.set(SESSION_COOKIE, await signSession(user), sessionCookieOptions());
  return response;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      login?: string;
      password?: string;
    };
    const login = (body.login ?? body.email ?? "").trim();
    const password = body.password ?? "";
    const store = await getStore();
    const demoUser = store.authenticate(login, password);
    if (demoUser && !isBuiltInDemoUser(demoUser)) {
      return sessionResponse(demoUser);
    }
    if (store.hasStoredPassword(login)) {
      return NextResponse.json(
        { error: "Kurum kodu, e-posta veya şifre hatalı.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    if (supabaseConfigured()) {
      const candidates = login.includes("@")
        ? [login]
        : [schoolLoginEmail(login), login];
      for (const identifier of candidates) {
        const bundle = await loginWithSupabase(identifier, password);
        if (!bundle) continue;
        const user = store.adoptExternalUser(
          bundle.session,
          bundle.institutions,
          bundle.years,
        );
        await persistStore();
        return sessionResponse(user);
      }
    }
    return NextResponse.json(
      { error: "Kurum kodu, e-posta veya şifre hatalı.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
