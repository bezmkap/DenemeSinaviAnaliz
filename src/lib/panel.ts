import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store/server";
import { resolveInstitutionId } from "@/lib/store/app-store";
import { AppError } from "@/lib/errors";
import { canOpenNetworkHome, type SessionUser } from "@/lib/domain";

export async function loadPanelContext(requestedInstitution?: string | null) {
  const raw = await getSession();
  if (!raw) redirect("/giris");
  const store = await getStore();
  let session: SessionUser;
  try {
    session = store.session(raw.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/api/auth/logout");
    throw error;
  }
  let institutionId: string;
  try {
    if (canOpenNetworkHome(session.role)) {
      const allInstitutions = store.listInstitutions(session);
      if (!requestedInstitution) {
        return {
          session,
          institution: null,
          modules: [],
          store,
          allInstitutions,
          canViewNetwork: true,
        };
      }
      institutionId = resolveInstitutionId(session, requestedInstitution);
    } else {
      institutionId = resolveInstitutionId(session, requestedInstitution);
    }
  } catch {
    institutionId = session.institutionIds[0];
  }
  if (!institutionId) {
    return {
      session,
      institution: null,
      modules: [],
      store,
      allInstitutions: [],
      canViewNetwork: store.canViewNetworkAnalysis(session),
    };
  }
  try {
    const institution = store.getInstitution(session, institutionId);
    const modules = store.enabledModules(institutionId);
    const allInstitutions = canOpenNetworkHome(session.role)
      ? store.listInstitutions(session)
      : [institution];
    return {
      session,
      institution,
      modules,
      store,
      allInstitutions,
      canViewNetwork: store.canViewNetworkAnalysis(session),
    };
  } catch (error) {
    if (error instanceof AppError && error.status === 403) {
      redirect(requestedInstitution ? `/panel?kurum=${requestedInstitution}` : "/panel");
    }
    throw error;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const raw = await getSession();
  if (!raw) redirect("/giris");
  try {
    const store = await getStore();
    return store.session(raw.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/api/auth/logout");
    return raw;
  }
}
