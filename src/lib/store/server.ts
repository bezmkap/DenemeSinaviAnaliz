import fs from "fs";
import path from "path";
import { AppError, ErrorCodes } from "@/lib/errors";
import {
  createAppStore,
  clearPreviewSessions,
  migrateAppState,
  type AppState,
  type AppStore,
} from "@/lib/store/app-store";
import { buildDemoState } from "@/lib/store/seed";
import {
  consumeLoadedRevision,
  consumeSavedRevision,
  loadRemoteRevision,
  loadRemoteState,
  saveRemoteState,
} from "@/lib/store/remote";
import { explainRemotePersistFailure, sanitizeJsonValue } from "@/lib/store/jsonb-payload";
import { supabaseServiceConfigured } from "@/lib/auth/school-account";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const REV_FILE = path.join(DATA_DIR, "store.rev");

function persistable(state: AppState): AppState {
  return sanitizeJsonValue(structuredClone(state)) as AppState;
}

function loadFileState(): AppState | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as AppState;
    }
  } catch {
    // demo fallback
  }
  return null;
}

function readFileRevision(): string | null {
  try {
    if (!fs.existsSync(REV_FILE)) return null;
    const value = fs.readFileSync(REV_FILE, "utf8").trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeFileRevision(revision: string | null) {
  try {
    if (!revision) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REV_FILE, revision);
  } catch {
    // read-only environments still run in memory
  }
}

function saveFileState(state: AppState) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state));
  } catch {
    // read-only environments still run in memory
  }
}

const globalForStore = globalThis as unknown as {
  __dsaStore?: AppStore;
  __dsaStoreCode?: number;
  __dsaRemoteRevision?: string | null;
};

const STORE_CODE = 39;

function isReadyStore(store: AppStore | undefined): store is AppStore {
  return Boolean(
    store &&
      typeof store.replaceState === "function" &&
      typeof store.listNetworkFilterOptions === "function" &&
      typeof store.changePassword === "function" &&
      typeof store.hasPreview === "function" &&
      typeof store.deleteInstitution === "function" &&
      typeof store.hasStoredPassword === "function" &&
      typeof store.listDistrictUsers === "function" &&
      typeof store.updateDistrictUser === "function" &&
      typeof store.hasPendingSave === "function" &&
      typeof store.buildStudentAveragesReport === "function" &&
      typeof store.listAnswerKeySittings === "function" &&
      typeof store.setAnswerKeyGrants === "function" &&
      typeof store.listClassReportCards === "function",
  );
}

async function hydrateStore(source: AppState): Promise<AppStore> {
  const { state, changed } = migrateAppState(structuredClone(source));
  if (isReadyStore(globalForStore.__dsaStore)) {
    globalForStore.__dsaStore.replaceState(state);
  } else {
    globalForStore.__dsaStore = createAppStore(state);
  }
  if (changed) await persistStore();
  return globalForStore.__dsaStore as AppStore;
}

function rememberRevision(revision: string | null | undefined) {
  if (!revision) return;
  globalForStore.__dsaRemoteRevision = revision;
  writeFileRevision(revision);
}

export async function getStore(): Promise<AppStore> {
  if (globalForStore.__dsaStoreCode !== STORE_CODE) {
    globalForStore.__dsaStore = undefined;
    globalForStore.__dsaRemoteRevision = null;
    globalForStore.__dsaStoreCode = STORE_CODE;
  }

  if (!supabaseServiceConfigured()) {
    if (isReadyStore(globalForStore.__dsaStore)) return globalForStore.__dsaStore;
    return hydrateStore(loadFileState() ?? buildDemoState());
  }

  const revision = await loadRemoteRevision();
  if (
    isReadyStore(globalForStore.__dsaStore) &&
    (revision === undefined || revision === globalForStore.__dsaRemoteRevision)
  ) {
    return globalForStore.__dsaStore;
  }

  const fileRevision = readFileRevision();
  if (revision && revision === fileRevision) {
    const file = loadFileState();
    if (file) {
      rememberRevision(revision);
      return hydrateStore(file);
    }
  }

  const remote = await loadRemoteState();
  if (remote) {
    rememberRevision(consumeLoadedRevision() ?? (typeof revision === "string" ? revision : null));
    const store = await hydrateStore(remote);
    saveFileState(persistable(store.getState()));
    return store;
  }

  if (isReadyStore(globalForStore.__dsaStore)) return globalForStore.__dsaStore;
  return hydrateStore(loadFileState() ?? buildDemoState());
}

export async function persistStore(options?: { required?: boolean }) {
  const store = globalForStore.__dsaStore;
  if (!store) return;
  const state = persistable(store.getState());
  saveFileState(state);
  const failure = await saveRemoteState(state);
  if (!failure) rememberRevision(consumeSavedRevision());
  if (options?.required && supabaseServiceConfigured() && failure) {
    throw new AppError(ErrorCodes.CONFLICT, explainRemotePersistFailure(failure), 503);
  }
}

export function resetStoreForTests(state?: AppState): AppStore {
  clearPreviewSessions();
  globalForStore.__dsaStore = createAppStore(state ?? buildDemoState());
  return globalForStore.__dsaStore;
}
