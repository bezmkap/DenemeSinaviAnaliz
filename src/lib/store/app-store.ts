import { createHash, randomUUID } from "crypto";
import {
  ANALYSIS_MODULES,
  ANSWER_KEY_CAPABILITY,
  IL_ANALIZI_SLUG,
  EXAM_TYPES,
  type AcademicYear,
  type AnalysisFilters,
  type AnalysisModuleDef,
  type AuditLog,
  type BookletLinkSet,
  type CapabilityGrant,
  type ExamResult,
  type ExamSitting,
  type ExamType,
  type Institution,
  type InstitutionModulePermission,
  type InstitutionType,
  type Membership,
  type QuestionKeySet,
  type SessionUser,
  type Student,
  type SubjectResult,
  type UploadError,
  type UploadRecord,
  type UserAccount,
  SUBJECTS_BY_EXAM,
  calculateExamScore,
  calculateAytScores,
  bestAytScore,
  calculateNet,
  findInstitutionByCode,
  subjectNetsFromResults,
  institutionCodesEqual,
  institutionHasType,
  institutionInDistrict,
  institutionTypesOf,
  examTypeAllowedForInstitution,
  placesEqual,
  sanitizeExamTypes,
  sortAcademicYears,
  suggestedExamTypesFor,
  districtLoginEmail,
  normalizeInstitutionCode,
  normalizePlaceName,
  normalizeInstitutionTypes,
  parseClassPlacement,
  classKeyOf,
  normalizeStudentIdentity,
  isPlaceholderLabel,
  cleanImportText,
  schoolLoginEmail,
} from "@/lib/domain";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { ColumnMapping } from "@/lib/import/importers";
import { applyMappingToRow, buildPreview, hashBuffer } from "@/lib/import/pipeline";
import { computeAnalysis, computeClassReportCards, type AnalysisPayload } from "@/lib/analiz/compute";
import { computeNetworkAnalysis, type NetworkAnalysisPayload } from "@/lib/analiz/network";
import {
  computeStudentAveragesReport,
  reportScopeForSession,
  type StudentAveragesReport,
} from "@/lib/rapor/student-averages";
import {
  answerKeysFromQuestionKeys,
  applyBookletLinks,
  cancelledFlagsFromSpecs,
  keyReadyForScoring,
  questionKeysFromAnswerKeys,
  scoreAnswers,
} from "@/lib/import/answers";

export function hashPassword(password: string): string {
  return createHash("sha256").update(`dsa-demo:${password}`).digest("hex");
}

export type PreviewSession = {
  id: string;
  actorId: string;
  fileName: string;
  fileHash: string;
  examType: ExamType;
  createdAt: string;
  buffer: Buffer;
};

export type AppState = {
  schemaVersion?: number;
  institutions: Institution[];
  users: UserAccount[];
  memberships: Membership[];
  academicYears: AcademicYear[];
  permissions: InstitutionModulePermission[];
  capabilityGrants: CapabilityGrant[];
  sittings: ExamSitting[];
  students: Student[];
  results: ExamResult[];
  subjectResults: SubjectResult[];
  uploads: UploadRecord[];
  uploadErrors: UploadError[];
  auditLogs: AuditLog[];
};

export const APP_STATE_SCHEMA_VERSION = 24;

function ensurePermission(
  state: AppState,
  institutionId: string,
  moduleSlug: string,
  examType: ExamType,
  enabled: boolean,
): boolean {
  const row = state.permissions.find(
    (permission) =>
      permission.institutionId === institutionId &&
      permission.moduleSlug === moduleSlug &&
      permission.examType === examType,
  );
  if (!row) {
    state.permissions.push({
      id: randomUUID(),
      institutionId,
      moduleSlug,
      examType,
      enabled,
    });
    return true;
  }
  return false;
}

export function migrateAppState(state: AppState): { state: AppState; changed: boolean } {
  let changed = false;
  if ((state.schemaVersion ?? 0) < 2) {
    for (const inst of state.institutions) {
      for (const examType of inst.examTypePermissions) {
        for (const mod of ANALYSIS_MODULES) {
          const row = state.permissions.find(
            (permission) =>
              permission.institutionId === inst.id &&
              permission.moduleSlug === mod.slug &&
              permission.examType === examType,
          );
          if (!row) {
            state.permissions.push({
              id: randomUUID(),
              institutionId: inst.id,
              moduleSlug: mod.slug,
              examType,
              enabled: true,
            });
            changed = true;
          } else if (!row.enabled) {
            row.enabled = true;
            changed = true;
          }
        }
      }
    }
    state.schemaVersion = 2;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 3) {
    for (const inst of state.institutions) {
      for (const examType of inst.examTypePermissions) {
        if (ensurePermission(state, inst.id, IL_ANALIZI_SLUG, examType, false)) {
          changed = true;
        }
      }
    }
    state.schemaVersion = 3;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 4) {
    for (const inst of state.institutions) {
      for (const examType of inst.examTypePermissions) {
        if (ensurePermission(state, inst.id, "olcme-degerlendirme", examType, true)) {
          changed = true;
        }
      }
    }
    state.schemaVersion = 4;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 5) {
    if (ensureAdminUser(state, {
      id: "user-admin-bulent",
      email: "bulent@demo.okul",
      fullName: "Bülent",
      password: "20002020",
    })) {
      changed = true;
    }
    state.schemaVersion = 5;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 6) {
    for (const inst of state.institutions) {
      const types = normalizeInstitutionTypes(inst.types, inst.type);
      const nextTypes = types.length ? types : (["ortaokul"] as InstitutionType[]);
      if (
        inst.type !== nextTypes[0] ||
        !inst.types ||
        inst.types.length !== nextTypes.length ||
        nextTypes.some((value, index) => inst.types[index] !== value)
      ) {
        inst.types = nextTypes;
        inst.type = nextTypes[0];
        changed = true;
      }
    }
    state.schemaVersion = 6;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 7) {
    for (const result of state.results) {
      const sitting = state.sittings.find((row) => row.id === result.examSittingId);
      if (!sitting) continue;
      const nets = subjectNetsFromResults(
        state.subjectResults.filter((row) => row.resultId === result.id),
      );
      if (!Object.keys(nets).length) continue;
      const nextScore = calculateExamScore(sitting.examType, nets);
      if (result.score !== nextScore) {
        result.score = nextScore;
        changed = true;
      }
    }
    state.schemaVersion = 7;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 8) {
    for (const result of state.results) {
      const sitting = state.sittings.find((row) => row.id === result.examSittingId);
      if (!sitting) continue;
      const nets = subjectNetsFromResults(
        state.subjectResults.filter((row) => row.resultId === result.id),
      );
      if (!Object.keys(nets).length) continue;
      const nextScore = calculateExamScore(sitting.examType, nets);
      if (result.score !== nextScore) {
        result.score = nextScore;
        changed = true;
      }
    }
    state.schemaVersion = 8;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 9) {
    state.schemaVersion = 9;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 10) {
    state.schemaVersion = 10;
    changed = true;
  }
  if (ensureDistrictUsersFromInstitutions(state)) changed = true;
  if ((state.schemaVersion ?? 0) < 11) {
    state.schemaVersion = 11;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 12) {
    state.schemaVersion = 12;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 13) {
    for (const sitting of state.sittings) {
      if (!sitting.questionKeys && sitting.answerKeys) {
        sitting.questionKeys = questionKeysFromAnswerKeys(sitting.examType, sitting.answerKeys);
      }
    }
    state.schemaVersion = 13;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 14) {
    for (const sitting of state.sittings) {
      sitting.bookletLinks = sitting.bookletLinks ?? {};
    }
    state.schemaVersion = 14;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 15) {
    for (const inst of state.institutions) {
      for (const examType of inst.examTypePermissions) {
        if (ensurePermission(state, inst.id, "soru-analizi", examType, true)) {
          changed = true;
        }
      }
    }
    state.schemaVersion = 15;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 16) {
    for (const result of state.results) {
      const sitting = state.sittings.find((row) => row.id === result.examSittingId);
      if (!sitting || sitting.examType !== "TYT") continue;
      const nets = subjectNetsFromResults(
        state.subjectResults.filter((row) => row.resultId === result.id),
      );
      if (!Object.keys(nets).length) continue;
      const nextScore = calculateExamScore(sitting.examType, nets);
      if (result.score !== nextScore) {
        result.score = nextScore;
        changed = true;
      }
    }
    state.schemaVersion = 16;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 17) {
    for (const result of state.results) {
      result.scoreSay = result.scoreSay ?? null;
      result.scoreEa = result.scoreEa ?? null;
      result.scoreSoz = result.scoreSoz ?? null;
    }
    const ordered = [...state.sittings].sort((a, b) => a.examDate.localeCompare(b.examDate));
    for (const sitting of ordered.filter((row) => row.examType !== "AYT")) {
      applySittingScores(state, sitting);
    }
    for (const sitting of ordered.filter((row) => row.examType === "AYT")) {
      applySittingScores(state, sitting);
    }
    state.schemaVersion = 17;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 18) {
    for (const inst of state.institutions) {
      for (const examType of inst.examTypePermissions) {
        for (const mod of ANALYSIS_MODULES) {
          if (ensurePermission(state, inst.id, mod.slug, examType, true)) changed = true;
        }
        if (ensurePermission(state, inst.id, IL_ANALIZI_SLUG, examType, false)) changed = true;
      }
    }
    state.schemaVersion = 18;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 19) {
    for (const inst of state.institutions) {
      const types = institutionTypesOf(inst);
      const examTypes = sanitizeExamTypes(types, [
        ...inst.examTypePermissions,
        ...suggestedExamTypesFor(types),
      ]);
      if (examTypes.join() !== inst.examTypePermissions.join()) {
        inst.examTypePermissions = examTypes;
        changed = true;
      }
      for (const examType of examTypes) {
        for (const mod of ANALYSIS_MODULES) {
          if (ensurePermission(state, inst.id, mod.slug, examType, true)) changed = true;
        }
        if (ensurePermission(state, inst.id, IL_ANALIZI_SLUG, examType, false)) changed = true;
      }
    }
    state.schemaVersion = 19;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 20) {
    for (const student of state.students) {
      const placement = parseClassPlacement(student.grade, student.section);
      if (placement.grade && placement.grade !== student.grade) {
        student.grade = placement.grade;
        changed = true;
      }
      if (placement.section && placement.section !== student.section) {
        student.section = placement.section;
        changed = true;
      }
    }
    state.schemaVersion = 20;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 21) {
    for (const student of state.students) {
      const rawNo = cleanImportText(student.sourceStudentNo);
      const fallbackNo = isPlaceholderLabel(rawNo) ? student.id.slice(0, 8) : rawNo;
      const identity = normalizeStudentIdentity(fallbackNo, student.fullName, 1);
      if (identity.summary) continue;
      if (identity.fullName !== student.fullName) {
        student.fullName = identity.fullName;
        changed = true;
      }
    }
    state.schemaVersion = 21;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 22) {
    state.schemaVersion = 22;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 23) {
    for (const sitting of state.sittings) {
      const next = sitting.name
        .replace(/[Dd]eneme sınavı/g, "süreç değerlendirme")
        .replace(/Deneme Sınavı/g, "Süreç Değerlendirme")
        .replace(/Denemesi/g, "Süreç Değerlendirmesi")
        .replace(/denemesi/g, "süreç değerlendirmesi");
      if (next !== sitting.name) {
        sitting.name = next;
        changed = true;
      }
    }
    state.schemaVersion = 23;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 24) {
    state.capabilityGrants = Array.isArray(state.capabilityGrants) ? state.capabilityGrants : [];
    state.schemaVersion = 24;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 25) {
    const demoIds = new Set(
      state.users
        .filter((user) => {
          const email = user.email.toLocaleLowerCase("tr-TR");
          return email !== "bulent@demo.okul" && /@demo\.(okul|ilce)$/i.test(email);
        })
        .map((user) => user.id),
    );
    if (demoIds.size > 0) {
      state.users = state.users.filter((user) => !demoIds.has(user.id));
      state.memberships = state.memberships.filter((membership) => !demoIds.has(membership.userId));
    }
    state.schemaVersion = 25;
    changed = true;
  }
  if ((state.schemaVersion ?? 0) < 26) {
    if (
      ensureAdminUser(state, {
        id: "user-admin-bulent",
        email: "bulent@demo.okul",
        fullName: "Bülent",
        password: "20002020",
      })
    ) {
      changed = true;
    }
    state.schemaVersion = 26;
    changed = true;
  }
  return { state, changed };
}

function districtPlaceKey(city: string, district: string): string {
  return `${normalizePlaceName(city)}|${normalizePlaceName(district)}`;
}

function ensureDistrictUsersFromInstitutions(state: AppState): boolean {
  let changed = false;
  const covered = new Set(
    state.users
      .filter((user) => user.role === "district_admin")
      .map((user) => districtPlaceKey(user.city ?? "", user.district ?? "")),
  );
  const places = new Map<string, { city: string; district: string }>();
  for (const inst of state.institutions) {
    const city = String(inst.city ?? "").trim();
    const district = String(inst.district ?? "").trim();
    if (!city || !district) continue;
    const key = districtPlaceKey(city, district);
    if (!places.has(key)) places.set(key, { city, district });
  }
  for (const [key, place] of places) {
    if (covered.has(key)) continue;
    const email = districtLoginEmail(place.city, place.district);
    if (state.users.some((user) => user.email.toLocaleLowerCase("tr-TR") === email)) {
      covered.add(key);
      continue;
    }
    state.users.push({
      id: randomUUID(),
      email,
      fullName: `${place.district} İlçe Kullanıcısı`,
      role: "district_admin",
      passwordHash: hashPassword(place.district),
      city: place.city,
      district: place.district,
      createdAt: nowIso(),
    });
    covered.add(key);
    changed = true;
  }
  return changed;
}

export function canViewNetworkAnalysis(state: AppState, session: SessionUser): boolean {
  if (session.role === "system_admin" || session.role === "district_admin") return true;
  return session.institutionIds.some((institutionId) =>
    isModuleEnabled(state, institutionId, IL_ANALIZI_SLUG),
  );
}

function assertNetworkAccess(state: AppState, session: SessionUser) {
  if (!canViewNetworkAnalysis(state, session)) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "İl analizi kurumunuz için kapalı. Sistem yöneticisi bu yetkiyi açabilir.",
      403,
    );
  }
}

export type CreateInstitutionInput = {
  code: string;
  name: string;
  city: string;
  district: string;
  type?: InstitutionType;
  types?: InstitutionType[];
  examTypePermissions?: ExamType[];
};

function resolveInstitutionTypes(input: {
  type?: InstitutionType;
  types?: InstitutionType[];
}): InstitutionType[] {
  const types = normalizeInstitutionTypes(input.types, input.type);
  if (!types.length) {
    throw new AppError(ErrorCodes.VALIDATION, "En az bir kurum türü seçin.");
  }
  return types;
}

export type PermissionChangeInput = {
  institutionIds: string[] | "all";
  moduleSlugs: string[];
  examTypes: ExamType[];
  enabled: boolean;
};

export type AnswerKeyGrantInput = {
  schoolIds?: string[] | "all";
  districts?: Array<{ city: string; district: string }> | "all";
  enabled: boolean;
};

export type CommitUploadInput = {
  previewId: string;
  mapping: ColumnMapping;
  examName: string;
  examDate: string;
  academicYearId: string;
  publisher: string;
  examCode: string;
  tytSittingId?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function requireUser(state: AppState, userId: string): UserAccount {
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new AppError(ErrorCodes.UNAUTHORIZED, "Oturum geçersiz.", 401);
  return user;
}

function districtScopeOf(user: Pick<UserAccount, "city" | "district"> | SessionUser): {
  city: string;
  district: string;
} {
  return {
    city: (user.city ?? "").trim(),
    district: (user.district ?? "").trim(),
  };
}

export function institutionsForSession(state: AppState, session: SessionUser): Institution[] {
  if (session.role === "system_admin") return state.institutions;
  if (session.role === "district_admin") {
    const user = state.users.find((row) => row.id === session.id);
    const { city, district } = districtScopeOf(user ?? session);
    return state.institutions.filter((inst) => institutionInDistrict(inst, city, district));
  }
  return state.institutions.filter((inst) => session.institutionIds.includes(inst.id));
}

function sessionCanEditAnswerKeys(_state: AppState, session: SessionUser): boolean {
  return session.role === "system_admin";
}

function sittingHasSessionResults(state: AppState, session: SessionUser, sittingId: string): boolean {
  if (session.role === "system_admin") return true;
  const allowed = new Set(session.institutionIds);
  return state.results.some(
    (row) => row.examSittingId === sittingId && allowed.has(row.institutionId),
  );
}

export function toSession(state: AppState, user: UserAccount): SessionUser {
  if (user.role === "system_admin") {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      institutionIds: [],
      city: null,
      district: null,
      canEditAnswerKeys: true,
    };
  }
  if (user.role === "district_admin") {
    const { city, district } = districtScopeOf(user);
    const session: SessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      city,
      district,
      institutionIds: state.institutions
        .filter((inst) => institutionInDistrict(inst, city, district))
        .map((inst) => inst.id),
    };
    return { ...session, canEditAnswerKeys: sessionCanEditAnswerKeys(state, session) };
  }
  const session: SessionUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    institutionIds: state.memberships
      .filter((m) => m.userId === user.id)
      .map((m) => m.institutionId),
    city: null,
    district: null,
  };
  return { ...session, canEditAnswerKeys: sessionCanEditAnswerKeys(state, session) };
}

export function resolveInstitutionId(
  session: SessionUser,
  requestedId?: string | null,
): string {
  if (session.role === "system_admin") {
    if (requestedId) return requestedId;
    throw new AppError(
      ErrorCodes.VALIDATION,
      "Yönetici için kurum seçimi gerekli.",
    );
  }
  if (requestedId && !session.institutionIds.includes(requestedId)) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "Bu kuruma erişim yetkiniz yok.",
      403,
    );
  }
  const id = requestedId ?? session.institutionIds[0];
  if (!id) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "Kullanıcıya bağlı bir kurum yok.",
      403,
    );
  }
  return id;
}

function priorTytNets(
  state: AppState,
  studentId: string,
  aytSitting: ExamSitting,
): Record<string, number> | null {
  const sittingsById = new Map(state.sittings.map((row) => [row.id, row]));
  if (aytSitting.tytSittingId) {
    const linked = sittingsById.get(aytSitting.tytSittingId);
    if (!linked || linked.examType !== "TYT") return null;
    const result = state.results.find(
      (row) => row.studentId === studentId && row.examSittingId === linked.id,
    );
    if (!result) return null;
    const nets = subjectNetsFromResults(
      state.subjectResults.filter((row) => row.resultId === result.id),
    );
    return Object.keys(nets).length ? nets : null;
  }
  const candidates = state.results
    .filter((row) => row.studentId === studentId)
    .map((row) => ({ result: row, sitting: sittingsById.get(row.examSittingId) }))
    .filter(
      (
        row,
      ): row is { result: ExamResult; sitting: ExamSitting } =>
        Boolean(
          row.sitting &&
            row.sitting.examType === "TYT" &&
            row.sitting.academicYearId === aytSitting.academicYearId &&
            row.sitting.examDate <= aytSitting.examDate,
        ),
    )
    .sort(
      (a, b) =>
        a.sitting.examDate.localeCompare(b.sitting.examDate) || a.sitting.id.localeCompare(b.sitting.id),
    );
  const latest = candidates.at(-1);
  if (!latest) return null;
  const nets = subjectNetsFromResults(
    state.subjectResults.filter((row) => row.resultId === latest.result.id),
  );
  return Object.keys(nets).length ? nets : null;
}

function applyResultPlacementScore(state: AppState, result: ExamResult, sitting: ExamSitting) {
  const nets = subjectNetsFromResults(
    state.subjectResults.filter((row) => row.resultId === result.id),
  );
  if (sitting.examType === "AYT") {
    const tytNets = priorTytNets(state, result.studentId, sitting);
    if (!tytNets) {
      result.score = null;
      result.scoreSay = null;
      result.scoreEa = null;
      result.scoreSoz = null;
      return;
    }
    const scores = calculateAytScores(nets, tytNets);
    result.scoreSay = scores.say;
    result.scoreEa = scores.ea;
    result.scoreSoz = scores.soz;
    result.score = bestAytScore(scores);
    return;
  }
  result.score = calculateExamScore(sitting.examType, nets);
  result.scoreSay = null;
  result.scoreEa = null;
  result.scoreSoz = null;
}

function applySittingScores(state: AppState, sitting: ExamSitting) {
  for (const result of state.results.filter((row) => row.examSittingId === sitting.id)) {
    applyResultPlacementScore(state, result, sitting);
  }
}

function rescoreDependentAyt(state: AppState, tytSitting: ExamSitting) {
  if (tytSitting.examType !== "TYT") return;
  const studentIds = new Set(
    state.results.filter((row) => row.examSittingId === tytSitting.id).map((row) => row.studentId),
  );
  if (!studentIds.size) return;
  for (const sitting of state.sittings) {
    if (sitting.examType !== "AYT") continue;
    const linked = sitting.tytSittingId === tytSitting.id;
    const fallback =
      !sitting.tytSittingId &&
      sitting.academicYearId === tytSitting.academicYearId &&
      sitting.examDate >= tytSitting.examDate;
    if (!linked && !fallback) continue;
    for (const result of state.results.filter(
      (row) => row.examSittingId === sitting.id && studentIds.has(row.studentId),
    )) {
      applyResultPlacementScore(state, result, sitting);
    }
  }
}

function rescoreSitting(state: AppState, sitting: ExamSitting) {
  const keys = sitting.answerKeys ?? answerKeysFromQuestionKeys(sitting.questionKeys);
  const subjects = SUBJECTS_BY_EXAM[sitting.examType];
  for (const result of state.results.filter((row) => row.examSittingId === sitting.id)) {
    const booklet = result.booklet || "A";
    const bookletKeys = keys[booklet] ?? {};
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalBlank = 0;
    const nets: Record<string, number> = {};
    for (const subject of state.subjectResults.filter((row) => row.resultId === result.id)) {
      const def = subjects.find((row) => row.code === subject.subjectCode);
      if (!subject.answers || !def) continue;
      const specs = sitting.questionKeys?.[booklet]?.[subject.subjectCode];
      const cancelled = cancelledFlagsFromSpecs(specs);
      const key =
        bookletKeys[subject.subjectCode] ??
        specs?.map((spec) => (spec.answer || " ").slice(0, 1)).join("") ??
        "";
      if (!keyReadyForScoring(key, def.questionCount, cancelled)) continue;
      const scored = scoreAnswers(subject.answers, key, def.questionCount, cancelled);
      subject.correct = scored.correct;
      subject.wrong = scored.wrong;
      subject.blank = scored.blank;
      subject.calculatedNet = calculateNet(scored.correct, scored.wrong, sitting.examType);
      totalCorrect += scored.correct;
      totalWrong += scored.wrong;
      totalBlank += scored.blank;
      nets[subject.subjectCode] = subject.calculatedNet;
    }
    if (!Object.keys(nets).length) {
      applyResultPlacementScore(state, result, sitting);
      continue;
    }
    result.totalCorrect = totalCorrect;
    result.totalWrong = totalWrong;
    result.totalBlank = totalBlank;
    result.calculatedNet = calculateNet(totalCorrect, totalWrong, sitting.examType);
    applyResultPlacementScore(state, result, sitting);
  }
  rescoreDependentAyt(state, sitting);
}

export function assertInstitutionAccess(session: SessionUser, institutionId: string) {
  if (session.role === "system_admin") return;
  if (!session.institutionIds.includes(institutionId)) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "Bu kuruma ait verilere erişemezsiniz.",
      403,
    );
  }
}

function assertAdminUpload(session: SessionUser) {
  if (session.role !== "system_admin") {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "Sonuç yükleme yalnızca sistem yöneticisine açıktır.",
      403,
    );
  }
}

export function isModuleEnabled(
  state: AppState,
  institutionId: string,
  moduleSlug: string,
  examType?: ExamType,
): boolean {
  const rows = state.permissions.filter(
    (p) => p.institutionId === institutionId && p.moduleSlug === moduleSlug,
  );
  if (examType) return rows.some((p) => p.examType === examType && p.enabled);
  return rows.some((p) => p.enabled);
}

export function enabledModules(
  state: AppState,
  institutionId: string,
  examType?: ExamType,
): AnalysisModuleDef[] {
  return ANALYSIS_MODULES.filter((mod) =>
    isModuleEnabled(state, institutionId, mod.slug, examType),
  );
}

export function assertModuleAccess(
  state: AppState,
  session: SessionUser,
  institutionId: string,
  moduleSlug: string,
  examType?: ExamType,
) {
  assertInstitutionAccess(session, institutionId);
  if (!isModuleEnabled(state, institutionId, moduleSlug, examType)) {
    throw new AppError(
      ErrorCodes.MODULE_DISABLED,
      "Bu analiz modülü kurumunuz için kapalı.",
      403,
    );
  }
}

function ensureAdminUser(
  state: AppState,
  input: { id: string; email: string; fullName: string; password: string },
): boolean {
  const emailKey = input.email.toLocaleLowerCase("tr-TR");
  const existing = state.users.find(
    (user) =>
      user.id === input.id || user.email.toLocaleLowerCase("tr-TR") === emailKey,
  );
  if (existing) {
    let changed = false;
    if (existing.role !== "system_admin") {
      existing.role = "system_admin";
      changed = true;
    }
    if (existing.fullName !== input.fullName) {
      existing.fullName = input.fullName;
      changed = true;
    }
    return changed;
  }
  state.users.push({
    id: input.id,
    email: input.email,
    fullName: input.fullName,
    role: "system_admin",
    passwordHash: hashPassword(input.password),
    createdAt: nowIso(),
  });
  return true;
}

function findUserByLogin(state: AppState, login: string): UserAccount | undefined {
  const key = login.trim();
  if (!key) return undefined;
  const wanted = key.toLocaleLowerCase("tr-TR");
  const byEmail = state.users.find(
    (user) => user.email.toLocaleLowerCase("tr-TR") === wanted,
  );
  if (byEmail) return byEmail;
  const byLocalPart = state.users.find((user) => {
    const local = user.email.split("@")[0] ?? "";
    return local.toLocaleLowerCase("tr-TR") === wanted;
  });
  if (byLocalPart) return byLocalPart;
  const bySchoolEmail = state.users.find(
    (user) => user.email.toLocaleLowerCase("tr-TR") === schoolLoginEmail(key).toLocaleLowerCase("tr-TR"),
  );
  if (bySchoolEmail) return bySchoolEmail;
  const inst = findInstitutionByCode(state.institutions, key);
  if (!inst) return undefined;
  const memberIds = state.memberships
    .filter((membership) => membership.institutionId === inst.id)
    .map((membership) => membership.userId);
  return state.users.find((user) => memberIds.includes(user.id) && user.role === "school_user");
}

function findSchoolUser(state: AppState, institutionId: string): UserAccount | undefined {
  const memberIds = state.memberships
    .filter((membership) => membership.institutionId === institutionId)
    .map((membership) => membership.userId);
  return state.users.find((user) => memberIds.includes(user.id) && user.role === "school_user");
}

function ensureSchoolUser(
  state: AppState,
  inst: Institution,
  password: string,
): { code: string; password: string } {
  const existing = findSchoolUser(state, inst.id);
  if (existing) return { code: inst.code, password };
  const email = schoolLoginEmail(inst.code);
  if (state.users.some((user) => user.email.toLocaleLowerCase("tr-TR") === email)) {
    throw new AppError(ErrorCodes.CONFLICT, "Bu kurum kodu için giriş hesabı zaten var.");
  }
  const user: UserAccount = {
    id: randomUUID(),
    email,
    fullName: inst.name,
    role: "school_user",
    passwordHash: hashPassword(password),
    createdAt: nowIso(),
  };
  state.users.push(user);
  state.memberships.push({
    id: randomUUID(),
    userId: user.id,
    institutionId: inst.id,
  });
  return { code: inst.code, password };
}

function defaultPermissions(institutionId: string, examTypes: ExamType[]): InstitutionModulePermission[] {
  const rows: InstitutionModulePermission[] = [];
  for (const examType of examTypes) {
    for (const mod of ANALYSIS_MODULES) {
      rows.push({
        id: randomUUID(),
        institutionId,
        moduleSlug: mod.slug,
        examType,
        enabled: true,
      });
    }
    rows.push({
      id: randomUUID(),
      institutionId,
      moduleSlug: IL_ANALIZI_SLUG,
      examType,
      enabled: false,
    });
  }
  return rows;
}

const previewSessions = new Map<string, PreviewSession>();

export function clearPreviewSessions() {
  previewSessions.clear();
}

function assignState(target: AppState, source: AppState) {
  target.schemaVersion = source.schemaVersion;
  target.institutions = source.institutions;
  target.users = source.users;
  target.memberships = source.memberships;
  target.academicYears = source.academicYears;
  target.permissions = source.permissions;
  target.capabilityGrants = source.capabilityGrants ?? [];
  target.sittings = source.sittings;
  target.students = source.students;
  target.results = source.results;
  target.subjectResults = source.subjectResults;
  target.uploads = source.uploads;
  target.uploadErrors = source.uploadErrors;
  target.auditLogs = source.auditLogs;
}

function normalizeAcademicYearLabel(label: string): string {
  const compact = label.trim().replace(/\s+/g, "");
  const match = compact.match(/^(\d{4})[-/](\d{4})$/);
  if (!match) {
    throw new AppError(ErrorCodes.VALIDATION, "Akademik yılı 2026-2027 biçiminde yazın.");
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1 || start < 2000 || start > 2100) {
    throw new AppError(
      ErrorCodes.VALIDATION,
      "Akademik yıl ardışık iki yılı kapsamalıdır. Örnek: 2026-2027.",
    );
  }
  return `${start}-${end}`;
}

function assertAcademicYearDates(startsOn: string, endsOn: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    throw new AppError(ErrorCodes.VALIDATION, "Başlangıç ve bitiş tarihi zorunludur.");
  }
  if (endsOn <= startsOn) {
    throw new AppError(ErrorCodes.VALIDATION, "Bitiş tarihi başlangıçtan sonra olmalıdır.");
  }
}

function assertAcademicYearAdmin(session: SessionUser) {
  if (session.role !== "system_admin") {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      "Akademik yıl yalnızca yönetici ekler ve değiştirir.",
      403,
    );
  }
}

const SEEDED_DEMO_INSTITUTION_IDS = new Set(["inst-a", "inst-b", "inst-c"]);

function ensureSchoolLogins(state: AppState) {
  for (const inst of state.institutions) {
    if (SEEDED_DEMO_INSTITUTION_IDS.has(inst.id)) continue;
    try {
      ensureSchoolUser(state, inst, inst.code);
    } catch {
      // Mevcut okul hesabı korunur.
    }
  }
}

function ensureActiveAcademicYear(state: AppState, exceptId?: string) {
  if (state.academicYears.some((year) => year.isActive)) return;
  const fallback = sortAcademicYears(state.academicYears).find((year) => year.id !== exceptId);
  if (fallback) fallback.isActive = true;
  else if (state.academicYears[0]) state.academicYears[0].isActive = true;
}

export function createAppStore(initial: AppState) {
  const state: AppState = structuredClone(initial);
  if (!state.capabilityGrants) state.capabilityGrants = [];
  ensureSchoolLogins(state);
  let pendingSave = false;

  const getSession = (userId: string) => toSession(state, requireUser(state, userId));
  const liveSession = (session: SessionUser) => getSession(session.id);

  function addAudit(entry: Omit<AuditLog, "id" | "createdAt">) {
    state.auditLogs.unshift({
      ...entry,
      id: randomUUID(),
      createdAt: nowIso(),
    });
  }

  return {
    getState(): AppState {
      return state;
    },

    replaceState(next: AppState) {
      assignState(state, structuredClone(next));
      ensureSchoolLogins(state);
      pendingSave = false;
    },

    hasPreview(previewId: string) {
      return previewSessions.has(previewId);
    },

    attachPreview(preview: PreviewSession) {
      previewSessions.set(preview.id, preview);
    },

    authenticate(login: string, password: string): SessionUser | null {
      const user = findUserByLogin(state, login);
      if (!user) return null;
      if (!user.passwordHash || user.passwordHash !== hashPassword(password)) return null;
      return toSession(state, user);
    },

    hasStoredPassword(login: string): boolean {
      const user = findUserByLogin(state, login);
      return Boolean(user?.passwordHash);
    },

    adoptExternalUser(
      session: SessionUser,
      institutions: Institution[] = [],
      years: AcademicYear[] = [],
    ): SessionUser {
      const existing = state.users.find((u) => u.id === session.id || u.email === session.email);
      if (existing) {
        existing.id = session.id;
        existing.email = session.email;
        existing.fullName = session.fullName;
        existing.role = session.role;
        if (session.role === "district_admin") {
          existing.city = session.city ?? existing.city ?? null;
          existing.district = session.district ?? existing.district ?? null;
        }
      } else {
        state.users.push({
          id: session.id,
          email: session.email,
          fullName: session.fullName,
          role: session.role,
          passwordHash: "",
          city: session.city ?? null,
          district: session.district ?? null,
          createdAt: nowIso(),
        });
      }
      for (const inst of institutions) {
        if (!state.institutions.some((row) => row.id === inst.id)) {
          state.institutions.push(inst);
          state.permissions.push(...defaultPermissions(inst.id, inst.examTypePermissions));
        }
      }
      for (const year of years) {
        if (!state.academicYears.some((row) => row.id === year.id)) {
          state.academicYears.push(year);
        }
      }
      state.memberships = state.memberships.filter((m) => m.userId !== session.id);
      if (session.role === "school_user") {
        for (const institutionId of session.institutionIds) {
          state.memberships.push({
            id: randomUUID(),
            userId: session.id,
            institutionId,
          });
        }
      }
      return toSession(state, requireUser(state, session.id));
    },

    session(userId: string): SessionUser {
      return getSession(userId);
    },

    listInstitutions(
      session: SessionUser,
      filters?: {
        query?: string;
        city?: string;
        district?: string;
        type?: InstitutionType;
        examType?: ExamType;
      },
    ): Institution[] {
      session = liveSession(session);
      let rows = institutionsForSession(state, session);
      if (filters?.query) {
        const q = filters.query.trim().toLocaleLowerCase("tr-TR");
        rows = rows.filter(
          (i) =>
            i.code.toLocaleLowerCase("tr-TR").includes(q) ||
            i.name.toLocaleLowerCase("tr-TR").includes(q) ||
            i.city.toLocaleLowerCase("tr-TR").includes(q) ||
            i.district.toLocaleLowerCase("tr-TR").includes(q),
        );
      }
      if (filters?.city) rows = rows.filter((i) => i.city === filters.city);
      if (filters?.district) rows = rows.filter((i) => i.district === filters.district);
      if (filters?.type) rows = rows.filter((i) => institutionHasType(i, filters.type!));
      if (filters?.examType) {
        rows = rows.filter((i) => i.examTypePermissions.includes(filters.examType!));
      }
      return rows;
    },

    getInstitution(session: SessionUser, id: string): Institution {
      session = liveSession(session);
      assertInstitutionAccess(session, id);
      const inst = state.institutions.find((i) => i.id === id);
      if (!inst) throw new AppError(ErrorCodes.NOT_FOUND, "Kurum bulunamadı.", 404);
      return inst;
    },

    createInstitution(
      session: SessionUser,
      input: CreateInstitutionInput,
    ): { institution: Institution; login: { code: string; password: string } } {
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Kurum ekleme yetkisi yok.", 403);
      }
      const code = normalizeInstitutionCode(input.code);
      if (!code) throw new AppError(ErrorCodes.VALIDATION, "Kurum kodu zorunlu.");
      if (state.institutions.some((i) => institutionCodesEqual(i.code, code))) {
        throw new AppError(ErrorCodes.CONFLICT, "Bu kurum kodu zaten kayıtlı.");
      }
      const types = resolveInstitutionTypes(input);
      const examTypes = sanitizeExamTypes(types, input.examTypePermissions);
      const inst: Institution = {
        id: randomUUID(),
        code,
        name: input.name.trim(),
        city: input.city.trim(),
        district: input.district.trim(),
        type: types[0],
        types,
        examTypePermissions: examTypes,
        createdAt: nowIso(),
      };
      state.institutions.push(inst);
      state.permissions.push(...defaultPermissions(inst.id, examTypes));
      const login = ensureSchoolUser(state, inst, code);
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "institution.create",
        institutionId: inst.id,
        institutionName: inst.name,
        moduleSlug: null,
        examType: null,
        oldValue: null,
        newValue: inst.code,
        metadata: { name: inst.name, login: login.code },
      });
      ensureDistrictUsersFromInstitutions(state);
      return { institution: inst, login };
    },

    hasPendingSave(): boolean {
      const pending = pendingSave;
      pendingSave = false;
      return pending;
    },

    listDistrictUsers(session: SessionUser): UserAccount[] {
      session = liveSession(session);
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "İlçe kullanıcıları yalnızca yöneticidedir.", 403);
      }
      if (ensureDistrictUsersFromInstitutions(state)) pendingSave = true;
      return state.users
        .filter((user) => user.role === "district_admin")
        .map((user) => ({ ...user, passwordHash: "" }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
    },

    createDistrictUser(
      session: SessionUser,
      input: { email: string; fullName: string; password: string; city: string; district: string },
    ): { user: UserAccount; login: { email: string; password: string } } {
      session = liveSession(session);
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "İlçe hesabı yalnızca yönetici oluşturur.", 403);
      }
      const email = input.email.trim().toLocaleLowerCase("tr-TR");
      const fullName = input.fullName.trim();
      const password = input.password.trim();
      const city = input.city.trim();
      const district = input.district.trim();
      if (!email.includes("@")) throw new AppError(ErrorCodes.VALIDATION, "Geçerli bir e-posta girin.");
      if (!fullName) throw new AppError(ErrorCodes.VALIDATION, "Ad soyad zorunlu.");
      if (password.length < 6) throw new AppError(ErrorCodes.VALIDATION, "Şifre en az 6 karakter olmalı.");
      if (!city) throw new AppError(ErrorCodes.VALIDATION, "İl zorunlu.");
      if (!district) throw new AppError(ErrorCodes.VALIDATION, "İlçe zorunlu.");
      if (state.users.some((user) => user.email.toLocaleLowerCase("tr-TR") === email)) {
        throw new AppError(ErrorCodes.CONFLICT, "Bu e-posta ile kayıtlı bir hesap var.");
      }
      const user: UserAccount = {
        id: randomUUID(),
        email,
        fullName,
        role: "district_admin",
        passwordHash: hashPassword(password),
        city,
        district,
        createdAt: nowIso(),
      };
      state.users.push(user);
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "district_user.create",
        institutionId: null,
        institutionName: `${city} / ${district}`,
        moduleSlug: null,
        examType: null,
        oldValue: null,
        newValue: email,
        metadata: { city, district, fullName },
      });
      return { user: { ...user, passwordHash: "" }, login: { email, password } };
    },

    updateDistrictUser(
      session: SessionUser,
      userId: string,
      input: { email: string; fullName: string; city: string; district: string; password?: string },
    ): UserAccount {
      session = liveSession(session);
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "İlçe hesabı yalnızca yönetici düzenler.", 403);
      }
      const user = state.users.find((row) => row.id === userId);
      if (!user || user.role !== "district_admin") {
        throw new AppError(ErrorCodes.NOT_FOUND, "İlçe kullanıcısı bulunamadı.", 404);
      }
      const email = input.email.trim().toLocaleLowerCase("tr-TR");
      const fullName = input.fullName.trim();
      const city = input.city.trim();
      const district = input.district.trim();
      const password = input.password?.trim() ?? "";
      if (!email.includes("@")) throw new AppError(ErrorCodes.VALIDATION, "Geçerli bir e-posta girin.");
      if (!fullName) throw new AppError(ErrorCodes.VALIDATION, "Ad soyad zorunlu.");
      if (!city) throw new AppError(ErrorCodes.VALIDATION, "İl zorunlu.");
      if (!district) throw new AppError(ErrorCodes.VALIDATION, "İlçe zorunlu.");
      if (password && password.length < 6) {
        throw new AppError(ErrorCodes.VALIDATION, "Şifre en az 6 karakter olmalı.");
      }
      if (
        state.users.some(
          (row) => row.id !== userId && row.email.toLocaleLowerCase("tr-TR") === email,
        )
      ) {
        throw new AppError(ErrorCodes.CONFLICT, "Bu e-posta ile kayıtlı bir hesap var.");
      }
      const previous = user.email;
      user.email = email;
      user.fullName = fullName;
      user.city = city;
      user.district = district;
      if (password) user.passwordHash = hashPassword(password);
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "district_user.update",
        institutionId: null,
        institutionName: `${city} / ${district}`,
        moduleSlug: null,
        examType: null,
        oldValue: previous,
        newValue: email,
        metadata: { city, district, fullName, passwordChanged: Boolean(password) },
      });
      return { ...user, passwordHash: "" };
    },

    deleteDistrictUser(session: SessionUser, userId: string): { id: string; email: string } {
      session = liveSession(session);
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "İlçe hesabı yalnızca yönetici siler.", 403);
      }
      const user = state.users.find((row) => row.id === userId);
      if (!user || user.role !== "district_admin") {
        throw new AppError(ErrorCodes.NOT_FOUND, "İlçe kullanıcısı bulunamadı.", 404);
      }
      state.users = state.users.filter((row) => row.id !== userId);
      state.memberships = state.memberships.filter((row) => row.userId !== userId);
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "district_user.delete",
        institutionId: null,
        institutionName: `${user.city ?? ""} / ${user.district ?? ""}`.trim(),
        moduleSlug: null,
        examType: null,
        oldValue: user.email,
        newValue: null,
        metadata: { city: user.city, district: user.district },
      });
      return { id: user.id, email: user.email };
    },

    changePassword(session: SessionUser, currentPassword: string, newPassword: string): void {
      const user = requireUser(state, session.id);
      const next = newPassword.trim();
      if (next.length < 6) {
        throw new AppError(ErrorCodes.VALIDATION, "Yeni şifre en az 6 karakter olmalı.");
      }
      if (user.passwordHash && user.passwordHash !== hashPassword(currentPassword)) {
        throw new AppError(ErrorCodes.UNAUTHORIZED, "Mevcut şifre hatalı.", 401);
      }
      const nextHash = hashPassword(next);
      user.passwordHash = nextHash;
      if (user.role === "school_user") {
        const institutionIds = new Set(
          state.memberships
            .filter((membership) => membership.userId === user.id)
            .map((membership) => membership.institutionId),
        );
        const peerIds = new Set(
          state.memberships
            .filter((membership) => institutionIds.has(membership.institutionId))
            .map((membership) => membership.userId),
        );
        for (const peer of state.users) {
          if (peer.role === "school_user" && peerIds.has(peer.id)) {
            peer.passwordHash = nextHash;
          }
        }
      }
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "password.change",
        institutionId: session.institutionIds[0] ?? null,
        institutionName: null,
        moduleSlug: null,
        examType: null,
        oldValue: null,
        newValue: null,
        metadata: { selfService: true },
      });
    },

    updateInstitution(
      session: SessionUser,
      id: string,
      patch: Partial<CreateInstitutionInput>,
    ): Institution {
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Kurum güncelleme yetkisi yok.", 403);
      }
      const inst = state.institutions.find((i) => i.id === id);
      if (!inst) throw new AppError(ErrorCodes.NOT_FOUND, "Kurum bulunamadı.", 404);
      const previous = {
        code: inst.code,
        name: inst.name,
        city: inst.city,
        district: inst.district,
        type: inst.type,
        types: [...institutionTypesOf(inst)],
        examTypePermissions: [...inst.examTypePermissions],
      };

      if (patch.code != null) {
        const nextCode = normalizeInstitutionCode(patch.code);
        if (!nextCode) throw new AppError(ErrorCodes.VALIDATION, "Kurum kodu zorunlu.");
        if (!institutionCodesEqual(nextCode, inst.code) || nextCode !== inst.code) {
          if (
            state.institutions.some(
              (row) => row.id !== id && institutionCodesEqual(row.code, nextCode),
            )
          ) {
            throw new AppError(ErrorCodes.CONFLICT, "Bu kurum kodu zaten kayıtlı.");
          }
          const nextEmail = schoolLoginEmail(nextCode);
          const schoolUser = findSchoolUser(state, inst.id);
          if (
            schoolUser &&
            state.users.some(
              (user) =>
                user.id !== schoolUser.id &&
                user.email.toLocaleLowerCase("tr-TR") === nextEmail,
            )
          ) {
            throw new AppError(ErrorCodes.CONFLICT, "Bu kurum kodu için giriş hesabı zaten var.");
          }
          if (schoolUser) schoolUser.email = nextEmail;
          inst.code = nextCode;
        }
      }
      if (patch.name != null) {
        const name = patch.name.trim();
        if (!name) throw new AppError(ErrorCodes.VALIDATION, "Kurum adı zorunlu.");
        inst.name = name;
        const schoolUser = findSchoolUser(state, inst.id);
        if (schoolUser) schoolUser.fullName = name;
      }
      if (patch.city != null) {
        const city = patch.city.trim();
        if (!city) throw new AppError(ErrorCodes.VALIDATION, "İl zorunlu.");
        inst.city = city;
      }
      if (patch.district != null) {
        const district = patch.district.trim();
        if (!district) throw new AppError(ErrorCodes.VALIDATION, "İlçe zorunlu.");
        inst.district = district;
      }
      if (patch.types != null || patch.type != null) {
        const types = resolveInstitutionTypes(patch);
        inst.types = types;
        inst.type = types[0];
      }
      if (patch.examTypePermissions || patch.types != null || patch.type != null) {
        const examTypes = sanitizeExamTypes(
          institutionTypesOf(inst),
          patch.examTypePermissions ?? inst.examTypePermissions,
        );
        inst.examTypePermissions = examTypes;
        for (const examType of examTypes) {
          for (const mod of ANALYSIS_MODULES) {
            const exists = state.permissions.find(
              (p) =>
                p.institutionId === inst.id &&
                p.moduleSlug === mod.slug &&
                p.examType === examType,
            );
            if (!exists) {
              state.permissions.push({
                id: randomUUID(),
                institutionId: inst.id,
                moduleSlug: mod.slug,
                examType,
                enabled: true,
              });
            }
          }
          ensurePermission(state, inst.id, IL_ANALIZI_SLUG, examType, false);
        }
      }
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "institution.update",
        institutionId: inst.id,
        institutionName: inst.name,
        moduleSlug: null,
        examType: null,
        oldValue: previous.code,
        newValue: inst.code,
        metadata: { previous, next: { ...inst } },
      });
      ensureDistrictUsersFromInstitutions(state);
      return inst;
    },

    deleteInstitution(
      session: SessionUser,
      id: string,
    ): { id: string; name: string; code: string } {
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Kurum silme yetkisi yok.", 403);
      }
      const inst = state.institutions.find((i) => i.id === id);
      if (!inst) throw new AppError(ErrorCodes.NOT_FOUND, "Kurum bulunamadı.", 404);

      const resultIds = state.results
        .filter((result) => result.institutionId === id)
        .map((result) => result.id);
      state.subjectResults = state.subjectResults.filter(
        (row) => !resultIds.includes(row.resultId),
      );
      state.results = state.results.filter((result) => result.institutionId !== id);
      state.students = state.students.filter((student) => student.institutionId !== id);
      state.permissions = state.permissions.filter((row) => row.institutionId !== id);
      state.capabilityGrants = (state.capabilityGrants ?? []).filter(
        (grant) => grant.institutionId !== id,
      );

      const memberUserIds = [
        ...new Set(
          state.memberships
            .filter((membership) => membership.institutionId === id)
            .map((membership) => membership.userId),
        ),
      ];
      state.memberships = state.memberships.filter((membership) => membership.institutionId !== id);
      const orphanUserIds = new Set(
        memberUserIds.filter((userId) => {
          const user = state.users.find((row) => row.id === userId);
          return (
            user?.role === "school_user" &&
            !state.memberships.some((membership) => membership.userId === userId)
          );
        }),
      );
      state.users = state.users.filter((user) => !orphanUserIds.has(user.id));
      state.institutions = state.institutions.filter((row) => row.id !== id);

      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "institution.delete",
        institutionId: inst.id,
        institutionName: inst.name,
        moduleSlug: null,
        examType: null,
        oldValue: inst.code,
        newValue: null,
        metadata: {
          studentsRemoved: true,
          resultsRemoved: resultIds.length,
        },
      });
      return { id: inst.id, name: inst.name, code: inst.code };
    },

    setModulePermissions(session: SessionUser, input: PermissionChangeInput): AuditLog[] {
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Yetki değiştirme izniniz yok.", 403);
      }
      const targetIds =
        input.institutionIds === "all"
          ? state.institutions.map((i) => i.id)
          : input.institutionIds;
      const created: AuditLog[] = [];
      for (const institutionId of targetIds) {
        const inst = state.institutions.find((i) => i.id === institutionId);
        if (!inst) continue;
        for (const moduleSlug of input.moduleSlugs) {
          for (const examType of input.examTypes) {
            if (!examTypeAllowedForInstitution(inst, examType)) continue;
            let row = state.permissions.find(
              (p) =>
                p.institutionId === institutionId &&
                p.moduleSlug === moduleSlug &&
                p.examType === examType,
            );
            const oldValue = row ? String(row.enabled) : "false";
            if (!row) {
              row = {
                id: randomUUID(),
                institutionId,
                moduleSlug,
                examType,
                enabled: input.enabled,
              };
              state.permissions.push(row);
            } else {
              row.enabled = input.enabled;
            }
            const log: AuditLog = {
              id: randomUUID(),
              actorId: session.id,
              actorEmail: session.email,
              action: "module.permission",
              institutionId,
              institutionName: inst.name,
              moduleSlug,
              examType,
              oldValue,
              newValue: String(input.enabled),
              metadata: {},
              createdAt: nowIso(),
            };
            state.auditLogs.unshift(log);
            created.push(log);
          }
        }
      }
      return created;
    },

    listAnswerKeyGrants() {
      const grants = state.capabilityGrants ?? [];
      return {
        schoolIds: grants
          .filter((grant) => grant.capability === ANSWER_KEY_CAPABILITY && grant.kind === "school")
          .map((grant) => grant.institutionId)
          .filter((id): id is string => Boolean(id)),
        districts: grants
          .filter((grant) => grant.capability === ANSWER_KEY_CAPABILITY && grant.kind === "district")
          .map((grant) => ({ city: grant.city ?? "", district: grant.district ?? "" }))
          .filter((place) => place.city && place.district),
      };
    },

    setAnswerKeyGrants(session: SessionUser, input: AnswerKeyGrantInput): AuditLog[] {
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Yetki değiştirme izniniz yok.", 403);
      }
      if (!state.capabilityGrants) state.capabilityGrants = [];
      const created: AuditLog[] = [];
      const schoolIds =
        input.schoolIds === "all"
          ? state.institutions.map((inst) => inst.id)
          : (input.schoolIds ?? []);
      for (const institutionId of schoolIds) {
        const inst = state.institutions.find((row) => row.id === institutionId);
        if (!inst) continue;
        const existing = state.capabilityGrants.find(
          (grant) =>
            grant.capability === ANSWER_KEY_CAPABILITY &&
            grant.kind === "school" &&
            grant.institutionId === institutionId,
        );
        const hadGrant = Boolean(existing);
        if (input.enabled && !existing) {
          state.capabilityGrants.push({
            id: randomUUID(),
            capability: ANSWER_KEY_CAPABILITY,
            kind: "school",
            institutionId,
          });
        } else if (!input.enabled && existing) {
          state.capabilityGrants = state.capabilityGrants.filter((grant) => grant.id !== existing.id);
        }
        if (hadGrant === input.enabled) continue;
        const log: AuditLog = {
          id: randomUUID(),
          actorId: session.id,
          actorEmail: session.email,
          action: "capability.answer-keys",
          institutionId,
          institutionName: inst.name,
          moduleSlug: ANSWER_KEY_CAPABILITY,
          examType: null,
          oldValue: String(hadGrant),
          newValue: String(input.enabled),
          metadata: { kind: "school" },
          createdAt: nowIso(),
        };
        state.auditLogs.unshift(log);
        created.push(log);
      }

      const districtPlaces =
        input.districts === "all"
          ? [
              ...new Map(
                state.institutions.map((inst) => [
                  districtPlaceKey(inst.city, inst.district),
                  { city: inst.city, district: inst.district },
                ]),
              ).values(),
            ]
          : (input.districts ?? []);
      for (const place of districtPlaces) {
        const city = place.city.trim();
        const district = place.district.trim();
        if (!city || !district) continue;
        const existing = state.capabilityGrants.find(
          (grant) =>
            grant.capability === ANSWER_KEY_CAPABILITY &&
            grant.kind === "district" &&
            placesEqual(grant.city ?? "", city) &&
            placesEqual(grant.district ?? "", district),
        );
        const hadGrant = Boolean(existing);
        if (input.enabled && !existing) {
          state.capabilityGrants.push({
            id: randomUUID(),
            capability: ANSWER_KEY_CAPABILITY,
            kind: "district",
            city,
            district,
          });
        } else if (!input.enabled && existing) {
          state.capabilityGrants = state.capabilityGrants.filter((grant) => grant.id !== existing.id);
        }
        if (hadGrant === input.enabled) continue;
        const log: AuditLog = {
          id: randomUUID(),
          actorId: session.id,
          actorEmail: session.email,
          action: "capability.answer-keys",
          institutionId: null,
          institutionName: `${district} / ${city}`,
          moduleSlug: ANSWER_KEY_CAPABILITY,
          examType: null,
          oldValue: String(hadGrant),
          newValue: String(input.enabled),
          metadata: { kind: "district", city, district },
          createdAt: nowIso(),
        };
        state.auditLogs.unshift(log);
        created.push(log);
      }
      return created;
    },

    canEditAnswerKeys(session: SessionUser) {
      return sessionCanEditAnswerKeys(state, session);
    },

    listAudit(session: SessionUser): AuditLog[] {
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "İşlem geçmişi yalnızca yöneticidedir.", 403);
      }
      return state.auditLogs;
    },

    listAcademicYears(): AcademicYear[] {
      return sortAcademicYears(state.academicYears);
    },

    createAcademicYear(
      session: SessionUser,
      input: { label: string; startsOn: string; endsOn: string; isActive?: boolean },
    ): AcademicYear {
      assertAcademicYearAdmin(session);
      const label = normalizeAcademicYearLabel(input.label);
      assertAcademicYearDates(input.startsOn, input.endsOn);
      if (state.academicYears.some((year) => year.label === label)) {
        throw new AppError(ErrorCodes.CONFLICT, "Bu akademik yıl zaten kayıtlı.");
      }
      const year: AcademicYear = {
        id: randomUUID(),
        label,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        isActive: false,
      };
      state.academicYears.push(year);
      if (input.isActive || state.academicYears.length === 1) {
        for (const row of state.academicYears) row.isActive = row.id === year.id;
      }
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "year.create",
        institutionId: null,
        institutionName: null,
        moduleSlug: null,
        examType: null,
        oldValue: null,
        newValue: year.label,
        metadata: { startsOn: year.startsOn, endsOn: year.endsOn, isActive: year.isActive },
      });
      return year;
    },

    updateAcademicYear(
      session: SessionUser,
      id: string,
      input: { label: string; startsOn: string; endsOn: string; isActive?: boolean },
    ): AcademicYear {
      assertAcademicYearAdmin(session);
      const year = state.academicYears.find((row) => row.id === id);
      if (!year) throw new AppError(ErrorCodes.NOT_FOUND, "Akademik yıl bulunamadı.", 404);
      const label = normalizeAcademicYearLabel(input.label);
      assertAcademicYearDates(input.startsOn, input.endsOn);
      if (state.academicYears.some((row) => row.id !== id && row.label === label)) {
        throw new AppError(ErrorCodes.CONFLICT, "Bu akademik yıl zaten kayıtlı.");
      }
      const previous = year.label;
      year.label = label;
      year.startsOn = input.startsOn;
      year.endsOn = input.endsOn;
      if (input.isActive) {
        for (const row of state.academicYears) row.isActive = row.id === year.id;
      } else {
        year.isActive = false;
        ensureActiveAcademicYear(state, year.id);
      }
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "year.update",
        institutionId: null,
        institutionName: null,
        moduleSlug: null,
        examType: null,
        oldValue: previous,
        newValue: year.label,
        metadata: { startsOn: year.startsOn, endsOn: year.endsOn, isActive: year.isActive },
      });
      return year;
    },

    deleteAcademicYear(session: SessionUser, id: string): AcademicYear {
      assertAcademicYearAdmin(session);
      const year = state.academicYears.find((row) => row.id === id);
      if (!year) throw new AppError(ErrorCodes.NOT_FOUND, "Akademik yıl bulunamadı.", 404);
      if (state.academicYears.length <= 1) {
        throw new AppError(ErrorCodes.VALIDATION, "En az bir akademik yıl kalmalıdır.");
      }
      const used =
        state.sittings.some((row) => row.academicYearId === id) ||
        state.students.some((row) => row.academicYearId === id);
      if (used) {
        throw new AppError(
          ErrorCodes.CONFLICT,
          "Bu akademik yıla bağlı sınav veya öğrenci kaydı var. Yılı silemezsiniz; etiketini ve tarihlerini değiştirebilirsiniz.",
        );
      }
      const deleted = { ...year };
      state.academicYears = state.academicYears.filter((row) => row.id !== id);
      if (deleted.isActive) ensureActiveAcademicYear(state);
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "year.delete",
        institutionId: null,
        institutionName: null,
        moduleSlug: null,
        examType: null,
        oldValue: deleted.label,
        newValue: null,
        metadata: {},
      });
      return deleted;
    },

    listExamSittings() {
      return [...state.sittings].sort((a, b) => b.examDate.localeCompare(a.examDate) || a.name.localeCompare(b.name, "tr"));
    },

    listAnswerKeySittings(session: SessionUser) {
      return [...state.sittings]
        .sort((a, b) => b.examDate.localeCompare(a.examDate) || a.name.localeCompare(b.name, "tr"))
        .map((sitting) => {
          const results = state.results.filter((row) => row.examSittingId === sitting.id);
          const booklets = [
            ...new Set([
              ...results.map((row) => row.booklet || "A"),
              ...Object.keys(sitting.questionKeys ?? {}),
              ...Object.keys(sitting.answerKeys ?? {}),
              ...Object.keys(sitting.bookletLinks ?? {}),
              "A",
              "B",
            ]),
          ].sort();
          return {
            ...sitting,
            booklets: booklets.length ? booklets : ["A"],
            resultCount: results.length,
          };
        })
        .filter(
          (sitting) =>
            sitting.resultCount > 0 && sittingHasSessionResults(state, session, sitting.id),
        );
    },

    createExamSitting(
      session: SessionUser,
      input: {
        examType: ExamType;
        name: string;
        examDate: string;
        academicYearId: string;
        publisher: string;
        examCode: string;
      },
    ) {
      if (!input.name.trim() || !input.examDate || !input.academicYearId || !input.examCode.trim()) {
        throw new AppError(ErrorCodes.VALIDATION, "Sınav adı, tarihi, yılı ve kodu zorunludur.");
      }
      const examCode = input.examCode.trim();
      if (state.sittings.some((row) => row.examCode === examCode)) {
        throw new AppError(ErrorCodes.CONFLICT, "Bu sınav kodu zaten kayıtlı.");
      }
      const year = state.academicYears.find((row) => row.id === input.academicYearId);
      if (!year) throw new AppError(ErrorCodes.VALIDATION, "Akademik yıl bulunamadı.");
      const sitting: ExamSitting = {
        id: randomUUID(),
        examType: input.examType,
        name: input.name.trim(),
        examDate: input.examDate,
        academicYearId: input.academicYearId,
        publisher: input.publisher.trim() || "—",
        examCode,
        createdBy: session.id,
        createdAt: nowIso(),
        questionKeys: questionKeysFromAnswerKeys(input.examType, { A: {} }),
        answerKeys: {},
        bookletLinks: {},
      };
      state.sittings.push(sitting);
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "sitting.create",
        institutionId: null,
        institutionName: null,
        moduleSlug: null,
        examType: sitting.examType,
        oldValue: null,
        newValue: sitting.examCode,
        metadata: { name: sitting.name },
      });
      return sitting;
    },

    saveExamQuestionKeys(
      session: SessionUser,
      sittingId: string,
      questionKeys: QuestionKeySet,
      bookletLinks: BookletLinkSet = {},
    ) {
      if (!sessionCanEditAnswerKeys(state, session)) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          "Cevap anahtarını yalnızca sistem yöneticisi değiştirir.",
          403,
        );
      }
      const sitting = state.sittings.find((row) => row.id === sittingId);
      if (!sitting) throw new AppError(ErrorCodes.NOT_FOUND, "Sınav bulunamadı.", 404);
      if (!sittingHasSessionResults(state, session, sittingId)) {
        throw new AppError(ErrorCodes.FORBIDDEN, "Bu sınavın cevap anahtarına erişemezsiniz.", 403);
      }
      const baseBooklet = questionKeys.A ? "A" : Object.keys(questionKeys).sort()[0] ?? "A";
      const derived = applyBookletLinks(sitting.examType, questionKeys, bookletLinks, baseBooklet);
      sitting.questionKeys = derived;
      sitting.bookletLinks = bookletLinks;
      sitting.answerKeys = answerKeysFromQuestionKeys(derived);
      rescoreSitting(state, sitting);
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "sitting.answer-keys",
        institutionId: null,
        institutionName: null,
        moduleSlug: null,
        examType: sitting.examType,
        oldValue: null,
        newValue: sitting.examCode,
        metadata: { booklets: Object.keys(derived), linked: Object.keys(bookletLinks) },
      });
      return sitting;
    },

    enabledModules: (institutionId: string, examType?: ExamType) =>
      enabledModules(state, institutionId, examType),
    isModuleEnabled: (institutionId: string, slug: string, examType?: ExamType) =>
      isModuleEnabled(state, institutionId, slug, examType),
    canViewNetworkAnalysis: (session: SessionUser) => canViewNetworkAnalysis(state, session),

    async previewUpload(
      session: SessionUser,
      input: { buffer: Buffer; fileName: string; examType: ExamType },
    ) {
      assertAdminUpload(session);
      const preview = await buildPreview({
        buffer: input.buffer,
        examType: input.examType,
      });
      const id = randomUUID();
      previewSessions.set(id, {
        id,
        actorId: session.id,
        fileName: input.fileName,
        fileHash: preview.fileHash,
        examType: input.examType,
        createdAt: nowIso(),
        buffer: input.buffer,
      });
      return { previewId: id, ...preview };
    },

    async refreshPreview(
      session: SessionUser,
      input: { previewId: string; mapping: ColumnMapping },
    ) {
      assertAdminUpload(session);
      const preview = previewSessions.get(input.previewId);
      if (!preview || preview.actorId !== session.id) {
        throw new AppError(ErrorCodes.NOT_FOUND, "Önizleme oturumu bulunamadı.", 404);
      }
      const next = await buildPreview({
        buffer: preview.buffer,
        examType: preview.examType,
        mappingOverride: input.mapping,
      });
      return { previewId: preview.id, ...next };
    },

    async commitUpload(session: SessionUser, input: CommitUploadInput) {
      assertAdminUpload(session);
      const preview = previewSessions.get(input.previewId);
      if (!preview || preview.actorId !== session.id) {
        throw new AppError(ErrorCodes.NOT_FOUND, "Önizleme oturumu bulunamadı.", 404);
      }
      const { examName, examDate, academicYearId, publisher, examCode } = input;
      if (!examName?.trim() || !examDate || !academicYearId || !publisher?.trim() || !examCode?.trim()) {
        throw new AppError(
          ErrorCodes.VALIDATION,
          "Sınav adı, tarihi, akademik yıl, yayınevi ve sınav kodu zorunludur.",
        );
      }

      const parsed = await buildPreview({
        buffer: preview.buffer,
        examType: preview.examType,
        mappingOverride: input.mapping,
      });
      const blocking = parsed.mappingIssues.filter((i) => i.level === "error");
      if (blocking.length) {
        throw new AppError(
          ErrorCodes.VALIDATION,
          blocking[0].message,
          400,
          blocking,
        );
      }

      const existingUpload = state.uploads.find(
        (u) => u.fileHash === preview.fileHash && u.status === "committed",
      );
      if (existingUpload) {
        throw new AppError(
          ErrorCodes.DUPLICATE_UPLOAD,
          "Bu dosya daha önce yüklenmiş. Yüklemeler sayfasından geri almadan aynı dosya yeniden kaydedilmez.",
          409,
          {
            uploadId: existingUpload.id,
            fileName: existingUpload.fileName,
            examType: existingUpload.examType,
            examName: state.sittings.find((row) => row.id === existingUpload.examSittingId)?.name,
          },
        );
      }

      let sitting = state.sittings.find((s) => s.examCode === examCode.trim());
      if (sitting && sitting.examType !== preview.examType) {
        throw new AppError(
          ErrorCodes.CONFLICT,
          "Bu sınav kodu farklı bir sınav türü için kayıtlı.",
        );
      }

      const year = state.academicYears.find((y) => y.id === academicYearId);
      if (!year) throw new AppError(ErrorCodes.VALIDATION, "Akademik yıl bulunamadı.");

      let tytSittingId: string | null = null;
      if (preview.examType === "AYT") {
        const requested = input.tytSittingId?.trim();
        if (requested) {
          const tyt = state.sittings.find((row) => row.id === requested);
          if (!tyt || tyt.examType !== "TYT") {
            throw new AppError(ErrorCodes.VALIDATION, "Seçilen TYT oturumu bulunamadı.");
          }
          tytSittingId = tyt.id;
        }
      }

      const rowErrors: { rowNumber: number; message: string }[] = [];
      const accepted = [];

      for (const row of parsed.rows) {
        if (row.errors.length) {
          for (const message of row.errors) {
            rowErrors.push({ rowNumber: row.excelRow, message });
          }
          continue;
        }
        const inst = findInstitutionByCode(state.institutions, row.institutionCode);
        if (!inst) {
          rowErrors.push({
            rowNumber: row.excelRow,
            message: `Kurum kodu kayıtlı okullarda yok: ${row.institutionCode}`,
          });
          continue;
        }
        if (!examTypeAllowedForInstitution(inst, preview.examType)) {
          rowErrors.push({
            rowNumber: row.excelRow,
            message:
              preview.examType === "LGS"
                ? "LGS yalnızca ortaokullara yüklenir."
                : `${preview.examType} yalnızca liselere yüklenir.`,
          });
          continue;
        }
        accepted.push({ row, inst });
      }

      if (!sitting) {
        sitting = {
          id: randomUUID(),
          examType: preview.examType,
          name: examName.trim(),
          examDate,
          academicYearId,
          publisher: publisher.trim(),
          examCode: examCode.trim(),
          createdBy: session.id,
          createdAt: nowIso(),
          tytSittingId: preview.examType === "AYT" ? tytSittingId : null,
          answerKeys: parsed.mapping.answerKeys,
          questionKeys: questionKeysFromAnswerKeys(
            preview.examType,
            parsed.mapping.answerKeys,
            undefined,
            parsed.mapping.booklets,
          ),
          bookletLinks: {},
        };
        state.sittings.push(sitting);
      } else {
        sitting.questionKeys = questionKeysFromAnswerKeys(
          sitting.examType,
          parsed.mapping.answerKeys,
          sitting.questionKeys,
          parsed.mapping.booklets,
        );
        if (parsed.mapping.answerKeys && Object.keys(parsed.mapping.answerKeys).length) {
          sitting.answerKeys = {
            ...(sitting.answerKeys ?? {}),
            ...parsed.mapping.answerKeys,
          };
        }
        sitting.bookletLinks = sitting.bookletLinks ?? {};
        if (preview.examType === "AYT" && tytSittingId) {
          sitting.tytSittingId = tytSittingId;
        }
      }

      const upload: UploadRecord = {
        id: randomUUID(),
        examSittingId: sitting.id,
        uploadedBy: session.id,
        fileName: preview.fileName,
        fileHash: preview.fileHash,
        status: accepted.length ? "committed" : "rejected",
        examType: preview.examType,
        rowCount: parsed.rows.length,
        validCount: 0,
        errorCount: rowErrors.length,
        createdAt: nowIso(),
        committedAt: accepted.length ? nowIso() : null,
        rolledBackAt: null,
      };

      let imported = 0;
      for (const { row, inst } of accepted) {
        let student = state.students.find(
          (s) =>
            s.institutionId === inst.id &&
            s.academicYearId === academicYearId &&
            s.sourceStudentNo === row.studentNo,
        );
        if (!student) {
          student = {
            id: randomUUID(),
            institutionId: inst.id,
            academicYearId,
            sourceStudentNo: row.studentNo,
            fullName: row.fullName,
            grade: row.grade,
            section: row.section,
          };
          state.students.push(student);
        } else {
          student.fullName = row.fullName;
          student.grade = row.grade;
          student.section = row.section;
        }

        const duplicate = state.results.find(
          (r) => r.studentId === student.id && r.examSittingId === sitting.id,
        );
        if (duplicate) continue;

        const result: ExamResult = {
          id: randomUUID(),
          studentId: student.id,
          examSittingId: sitting.id,
          institutionId: inst.id,
          uploadId: upload.id,
          totalCorrect: row.totalCorrect,
          totalWrong: row.totalWrong,
          totalBlank: row.totalBlank,
          sourceNet: row.sourceNet,
          calculatedNet: row.calculatedNet,
          score: row.score,
          scoreSay: null,
          scoreEa: null,
          scoreSoz: null,
          rankGeneral: row.ranks.general,
          rankCity: row.ranks.city,
          rankDistrict: row.ranks.district,
          rankSchool: row.ranks.school,
          rankClass: row.ranks.class,
          countGeneral: row.ranks.countGeneral,
          countCity: row.ranks.countCity,
          countDistrict: row.ranks.countDistrict,
          countSchool: row.ranks.countSchool,
          countClass: row.ranks.countClass,
          booklet: row.booklet,
          examArea: row.examArea,
        };
        state.results.push(result);
        for (const [subjectCode, subject] of Object.entries(row.subjects)) {
          state.subjectResults.push({
            id: randomUUID(),
            resultId: result.id,
            subjectCode,
            correct: subject.correct,
            wrong: subject.wrong,
            blank: subject.blank,
            sourceNet: subject.sourceNet,
            calculatedNet: subject.calculatedNet,
            answers: subject.answers,
          });
        }
        applyResultPlacementScore(state, result, sitting);
        imported += 1;
      }

      if (preview.examType === "AYT") {
        applySittingScores(state, sitting);
      }

      if (preview.examType === "TYT") {
        rescoreDependentAyt(state, sitting);
      }

      upload.validCount = imported;
      state.uploads.unshift(upload);
      for (const err of rowErrors) {
        state.uploadErrors.push({
          id: randomUUID(),
          uploadId: upload.id,
          rowNumber: err.rowNumber,
          message: err.message,
        });
      }

      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "upload.commit",
        institutionId: accepted[0]?.inst.id ?? null,
        institutionName: accepted[0]?.inst.name ?? null,
        moduleSlug: null,
        examType: preview.examType,
        oldValue: null,
        newValue: upload.status,
        metadata: {
          fileName: preview.fileName,
          examCode: examCode.trim(),
          imported,
          errors: rowErrors.length,
        },
      });

      previewSessions.delete(input.previewId);
      return {
        upload,
        imported,
        errorCount: rowErrors.length,
        errors: rowErrors,
        sitting,
      };
    },

    rollbackUpload(session: SessionUser, uploadId: string) {
      if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Yükleme geri alma yetkisi yok.", 403);
      }
      const upload = state.uploads.find((u) => u.id === uploadId);
      if (!upload) throw new AppError(ErrorCodes.NOT_FOUND, "Yükleme bulunamadı.", 404);
      if (upload.status !== "committed") {
        throw new AppError(ErrorCodes.VALIDATION, "Yalnızca kaydedilmiş yüklemeler geri alınabilir.");
      }
      const resultIds = state.results.filter((r) => r.uploadId === uploadId).map((r) => r.id);
      state.subjectResults = state.subjectResults.filter((s) => !resultIds.includes(s.resultId));
      state.results = state.results.filter((r) => r.uploadId !== uploadId);
      upload.status = "rolled_back";
      upload.rolledBackAt = nowIso();
      addAudit({
        actorId: session.id,
        actorEmail: session.email,
        action: "upload.rollback",
        institutionId: null,
        institutionName: null,
        moduleSlug: null,
        examType: upload.examType,
        oldValue: "committed",
        newValue: "rolled_back",
        metadata: { uploadId, fileName: upload.fileName },
      });
      return upload;
    },

    listUploads(session: SessionUser): Array<
      UploadRecord & { errors: UploadError[]; examName: string; institutionNames: string[] }
    > {
      const rows =
        session.role === "system_admin"
          ? state.uploads
          : state.uploads.filter((u) => u.uploadedBy === session.id);
      return rows
        .map((u) => {
          const sitting = state.sittings.find((s) => s.id === u.examSittingId);
          const instIds = new Set(
            state.results
              .filter((r) => r.examSittingId === u.examSittingId)
              .map((r) => r.institutionId),
          );
          return {
            ...u,
            errors: state.uploadErrors.filter((e) => e.uploadId === u.id),
            examName: sitting?.name ?? "",
            institutionNames: [...instIds]
              .map((id) => state.institutions.find((i) => i.id === id)?.name)
              .filter((name): name is string => Boolean(name)),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    getAnalysis(
      session: SessionUser,
      institutionId: string,
      moduleSlug: string,
      filters: AnalysisFilters,
    ): AnalysisPayload {
      session = liveSession(session);
      assertModuleAccess(state, session, institutionId, moduleSlug, filters.examType);
      return computeAnalysis(state, institutionId, moduleSlug, filters);
    },

    listClassReportCards(
      session: SessionUser,
      institutionId: string,
      input: { sittingId: string; grade: string; section: string },
    ) {
      session = liveSession(session);
      assertInstitutionAccess(session, institutionId);
      if (!input.sittingId || !input.grade || !input.section) {
        throw new AppError(ErrorCodes.VALIDATION, "Sınav, sınıf ve şube seçin.");
      }
      return computeClassReportCards(state, institutionId, input);
    },

    getNetworkAnalysis(session: SessionUser, filters: AnalysisFilters): NetworkAnalysisPayload {
      session = liveSession(session);
      assertNetworkAccess(state, session);
      if (session.role === "district_admin") {
        filters = {
          ...filters,
          city: session.city || filters.city,
          district: session.district || filters.district,
        };
      }
      return computeNetworkAnalysis(state, filters);
    },

    listNetworkFilterOptions(session: SessionUser) {
      session = liveSession(session);
      assertNetworkAccess(state, session);
      const visible = institutionsForSession(state, session);
      const visibleIds = new Set(visible.map((inst) => inst.id));
      const sittings = state.sittings.filter((sitting) =>
        state.results.some(
          (r) => r.examSittingId === sitting.id && visibleIds.has(r.institutionId),
        ),
      );
      return {
        years: sortAcademicYears(state.academicYears),
        sittings,
        cities: [...new Set(visible.map((i) => i.city))].sort((a, b) => a.localeCompare(b, "tr")),
        districts: [...new Set(visible.map((i) => i.district))].sort((a, b) =>
          a.localeCompare(b, "tr"),
        ),
        scope:
          session.role === "district_admin"
            ? { city: session.city ?? "", district: session.district ?? "" }
            : null,
      };
    },

    listFilterOptions(session: SessionUser, institutionId: string) {
      session = liveSession(session);
      assertInstitutionAccess(session, institutionId);
      const students = state.students.filter((s) => s.institutionId === institutionId);
      const sittings = state.sittings.filter((sitting) =>
        state.results.some(
          (r) => r.examSittingId === sitting.id && r.institutionId === institutionId,
        ),
      );
      return {
        years: sortAcademicYears(state.academicYears),
        sittings,
        grades: [...new Set(students.map((s) => classKeyOf(s).grade || s.grade))].sort(),
        sections: [...new Set(students.map((s) => classKeyOf(s).section || s.section))].sort(),
        classes: [...new Map(
          students.map((student) => {
            const placement = classKeyOf(student);
            const grade = placement.grade || student.grade;
            const section = placement.section || student.section;
            return [`${grade}-${section}`, { grade, section }] as const;
          }),
        ).values()].sort(
          (a, b) =>
            a.grade.localeCompare(b.grade, "tr", { numeric: true }) ||
            a.section.localeCompare(b.section, "tr"),
        ),
        students: students.map((s) => ({
          id: s.id,
          sourceStudentNo: s.sourceStudentNo,
          fullName: s.fullName,
          grade: s.grade,
          section: s.section,
        })),
      };
    },

    buildStudentAveragesReport(
      session: SessionUser,
      input: {
        scope?: string | null;
        institutionId?: string | null;
        filters: AnalysisFilters;
      },
    ): StudentAveragesReport {
      session = liveSession(session);
      if (session.role === "district_admin" && input.scope === "il") {
        throw new AppError(ErrorCodes.FORBIDDEN, "İlçe kullanıcısı il raporu alamaz.", 403);
      }
      if (session.role === "school_user" && input.scope && input.scope !== "okul") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Okul kullanıcısı yalnızca okul raporu alabilir.", 403);
      }
      const scope = reportScopeForSession(session.role, input.scope);
      let institutionId = input.institutionId ?? null;
      let city = input.filters.city ?? session.city ?? null;
      let district = input.filters.district ?? session.district ?? null;

      if (session.role === "school_user") {
        institutionId = session.institutionIds[0] ?? institutionId;
        if (!institutionId) {
          throw new AppError(ErrorCodes.FORBIDDEN, "Okul raporu için kurum bulunamadı.", 403);
        }
      } else if (session.role === "district_admin") {
        city = session.city ?? city;
        district = session.district ?? district;
        if (scope === "okul") {
          const inst = institutionId ? state.institutions.find((row) => row.id === institutionId) : null;
          if (!inst || !institutionInDistrict(inst, city ?? "", district ?? "")) {
            throw new AppError(ErrorCodes.FORBIDDEN, "Bu okul ilçe kapsamınızda değil.", 403);
          }
        }
      } else if (session.role !== "system_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "Rapor yetkisi yok.", 403);
      }

      if (scope === "okul") {
        if (!institutionId) {
          throw new AppError(ErrorCodes.VALIDATION, "Okul raporu için kurum seçin.");
        }
        assertInstitutionAccess(session, institutionId);
      }
      if (scope === "ilce" && session.role === "system_admin" && (!city || !district)) {
        throw new AppError(ErrorCodes.VALIDATION, "İlçe raporu için il ve ilçe seçin.");
      }
      if (scope === "il" && session.role === "district_admin") {
        throw new AppError(ErrorCodes.FORBIDDEN, "İlçe kullanıcısı il raporu alamaz.", 403);
      }

      return computeStudentAveragesReport(state, {
        scope,
        institutionId,
        city,
        district,
        filters: input.filters,
      });
    },

    hashBuffer,
    applyMappingToRow,
  };
}

export type AppStore = ReturnType<typeof createAppStore>;
export { EXAM_TYPES };
