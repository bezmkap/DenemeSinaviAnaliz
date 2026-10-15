import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { parseRole, type SessionUser } from "@/lib/domain";
import { AppError, ErrorCodes } from "@/lib/errors";

const COOKIE = "dsa_session";

function secret() {
  const raw = process.env.SESSION_SECRET ?? "demo-deneme-sinavi-analiz-secret-key-32";
  return new TextEncoder().encode(raw);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    institutionIds: user.institutionIds,
    city: user.city ?? null,
    district: user.district ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, secret());
  const role = parseRole(payload.role);
  return {
    id: String(payload.sub),
    email: String(payload.email),
    fullName: String(payload.fullName),
    role,
    institutionIds:
      role === "system_admin"
        ? []
        : Array.isArray(payload.institutionIds)
          ? payload.institutionIds.map(String)
          : [],
    city: typeof payload.city === "string" ? payload.city : null,
    district: typeof payload.district === "string" ? payload.district : null,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    return await readSessionToken(token);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Giriş yapmanız gerekiyor.", 401);
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "system_admin") {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "Sonuç yükleme yalnızca sistem yöneticisine açıktır.",
      403,
    );
  }
  return session;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE, await signSession(user), sessionCookieOptions());
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export { COOKIE as SESSION_COOKIE };
