import {
  SUBJECTS_BY_EXAM,
  foldTr,
  type BookletLinkSet,
  type ExamType,
  type QuestionKeySet,
  type QuestionSpec,
  type ExamArea,
  EXAM_AREA_LABELS,
} from "@/lib/domain";

export type AnswerKeySet = Record<string, Record<string, string>>;

const VALID_MARK = /[ABCDE]/i;

export function normalizeExamArea(value: unknown): ExamArea | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  if (raw.includes("sayisal") || raw.includes("say") || raw === "s") return "sayisal";
  if (raw.includes("sozel") || raw.includes("soz") || raw === "z") return "sozel";
  if (raw.includes("esit") || raw.includes("ea") || raw === "e") return "esit_agirlik";
  
  return null;
}

export function normalizeBooklet(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I");
  if (!raw) return "A";
  const letter = raw.replace(/[^A-Z0-9]/g, "");
  return letter || "A";
}

export function normalizeAnswerString(value: unknown, questionCount: number): string {
  const raw = String(value ?? "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I");
  const chars: string[] = [];
  for (const ch of raw) {
    if (VALID_MARK.test(ch)) chars.push(ch);
    else if (ch === " " || ch === "." || ch === "-" || ch === "_" || ch === "*") chars.push(" ");
  }
  if (chars.length < questionCount) {
    while (chars.length < questionCount) chars.push(" ");
  }
  return chars.slice(0, questionCount).join("");
}

export function cancelledFlagsFromSpecs(specs?: QuestionSpec[]): boolean[] {
  return (specs ?? []).map((spec) => Boolean(spec.cancelled));
}

export function scoreAnswers(
  studentRaw: unknown,
  keyRaw: unknown,
  questionCount: number,
  cancelled?: boolean[],
): { correct: number; wrong: number; blank: number; answers: string } {
  const answers = normalizeAnswerString(studentRaw, questionCount);
  const key = normalizeAnswerString(keyRaw, questionCount);
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  for (let i = 0; i < questionCount; i += 1) {
    if (cancelled?.[i]) {
      correct += 1;
      continue;
    }
    const mark = answers[i] === " " ? "" : answers[i];
    const expected = key[i] === " " ? "" : key[i];
    if (!mark) {
      blank += 1;
      continue;
    }
    if (expected && mark === expected) correct += 1;
    else wrong += 1;
  }
  return { correct, wrong, blank, answers };
}

export function keyLengthOk(key: string, questionCount: number): boolean {
  const filled = normalizeAnswerString(key, questionCount).replace(/ /g, "");
  return filled.length === questionCount;
}

export function keyReadyForScoring(
  key: string,
  questionCount: number,
  cancelled?: boolean[],
): boolean {
  if (questionCount <= 0) return false;
  const normalized = normalizeAnswerString(key, questionCount);
  for (let i = 0; i < questionCount; i += 1) {
    if (cancelled?.[i]) continue;
    if (!normalized[i] || normalized[i] === " ") return false;
  }
  return true;
}

export function emptyAnswerKeys(): AnswerKeySet {
  return {};
}

export function mergeAnswerKeys(base: AnswerKeySet | undefined, extra: AnswerKeySet | undefined): AnswerKeySet {
  const out: AnswerKeySet = {};
  for (const source of [base, extra]) {
    if (!source) continue;
    for (const [booklet, subjects] of Object.entries(source)) {
      const code = normalizeBooklet(booklet);
      out[code] = { ...(out[code] ?? {}), ...subjects };
    }
  }
  return out;
}

export function requiredKeyIssues(
  examType: ExamType,
  booklets: string[],
  keys: AnswerKeySet | undefined,
  subjectCodes: string[],
): string[] {
  const issues: string[] = [];
  const subjects = SUBJECTS_BY_EXAM[examType];
  for (const booklet of booklets.length ? booklets : ["A"]) {
    const bySubject = keys?.[booklet] ?? {};
    for (const code of subjectCodes) {
      const def = subjects.find((row) => row.code === code);
      if (!def) continue;
      const key = bySubject[code] ?? "";
      if (!keyLengthOk(key, def.questionCount)) {
        issues.push(
          `${booklet} kitapçığı ${def.name} anahtarı ${def.questionCount} harf olmalı.`,
        );
      }
    }
  }
  return issues;
}

export function isKeySheetName(name: string): boolean {
  const folded = foldTr(name);
  return folded === "cevapanahtari" || folded === "anahtar" || folded === "kitapcikanahtari";
}

export function emptyQuestionSpecs(questionCount: number, answers = ""): QuestionSpec[] {
  const normalized = normalizeAnswerString(answers, questionCount);
  return Array.from({ length: questionCount }, (_, index) => ({
    answer: normalized[index] === " " ? "" : normalized[index] ?? "",
    outcome: "",
    cancelled: false,
  }));
}

export function answerKeysFromQuestionKeys(questionKeys: QuestionKeySet | undefined): AnswerKeySet {
  const out: AnswerKeySet = {};
  if (!questionKeys) return out;
  for (const [booklet, subjects] of Object.entries(questionKeys)) {
    out[booklet] = {};
    for (const [code, specs] of Object.entries(subjects)) {
      out[booklet][code] = specs.map((spec) => (spec.answer || " ").slice(0, 1).toUpperCase()).join("");
    }
  }
  return out;
}

export function questionKeysFromAnswerKeys(
  examType: ExamType,
  answerKeys: AnswerKeySet | undefined,
  previous?: QuestionKeySet,
  extraBooklets: string[] = [],
): QuestionKeySet {
  const out: QuestionKeySet = {};
  const subjects = SUBJECTS_BY_EXAM[examType];
  const booklets = new Set([
    ...Object.keys(answerKeys ?? {}),
    ...Object.keys(previous ?? {}),
    ...extraBooklets.map((code) => normalizeBooklet(code)),
    "A",
  ]);
  for (const booklet of booklets) {
    out[booklet] = {};
    for (const subject of subjects) {
      const prior = previous?.[booklet]?.[subject.code];
      const letters = answerKeys?.[booklet]?.[subject.code] ?? prior?.map((row) => row.answer).join("") ?? "";
      const specs = emptyQuestionSpecs(subject.questionCount, letters);
      if (prior) {
        for (let i = 0; i < specs.length; i += 1) {
          specs[i].outcome = prior[i]?.outcome ?? "";
          specs[i].cancelled = Boolean(prior[i]?.cancelled);
          if (!specs[i].answer && prior[i]?.answer) specs[i].answer = prior[i].answer;
        }
      }
      out[booklet][subject.code] = specs;
    }
  }
  return out;
}

export type QuestionOutcomeStatus = "correct" | "wrong" | "blank" | "cancelled";

export function questionStatus(
  studentMark: string,
  correctMark: string,
  cancelled?: boolean,
): QuestionOutcomeStatus {
  if (cancelled) return "cancelled";
  if (!studentMark.trim()) return "blank";
  if (correctMark && studentMark === correctMark) return "correct";
  return "wrong";
}

export function isMissedQuestionStatus(status: string): boolean {
  return status === "wrong" || status === "blank";
}

export function emptyQuestionMap(questionCount: number): number[] {
  return Array.from({ length: questionCount }, () => 0);
}

export function identityQuestionMap(questionCount: number): number[] {
  return Array.from({ length: questionCount }, (_, index) => index + 1);
}

export function normalizeQuestionNo(value: unknown, questionCount: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > questionCount) return 0;
  return parsed;
}

export function invertQuestionMap(links: number[]): number[] {
  const out = emptyQuestionMap(links.length);
  for (let index = 0; index < links.length; index += 1) {
    const target = links[index] ?? 0;
    if (target >= 1 && target <= links.length) out[target - 1] = index + 1;
  }
  return out;
}

export function deriveBookletSpecs(base: QuestionSpec[], links: number[]): QuestionSpec[] {
  const out = emptyQuestionSpecs(base.length);
  for (let index = 0; index < base.length; index += 1) {
    const target = links[index] ?? 0;
    if (target >= 1 && target <= base.length) {
      out[target - 1] = {
        answer: base[index]?.answer ?? "",
        outcome: base[index]?.outcome ?? "",
        cancelled: Boolean(base[index]?.cancelled),
      };
    }
  }
  return out;
}

export function hasMappedQuestions(links: number[] | undefined): boolean {
  return Boolean(links?.some((value) => value > 0));
}

export function applyBookletLinks(
  examType: ExamType,
  questionKeys: QuestionKeySet,
  bookletLinks: BookletLinkSet | undefined,
  baseBooklet = "A",
): QuestionKeySet {
  const next: QuestionKeySet = structuredClone(questionKeys);
  const base = next[baseBooklet] ? baseBooklet : Object.keys(next).sort()[0];
  if (!base || !bookletLinks) return next;
  for (const [booklet, subjects] of Object.entries(bookletLinks)) {
    const code = normalizeBooklet(booklet);
    if (code === base) continue;
    next[code] = next[code] ?? {};
    for (const subject of SUBJECTS_BY_EXAM[examType]) {
      const map = subjects[subject.code];
      if (!hasMappedQuestions(map)) continue;
      const baseSpecs = next[base]?.[subject.code] ?? emptyQuestionSpecs(subject.questionCount);
      next[code][subject.code] = deriveBookletSpecs(baseSpecs, map);
    }
  }
  return next;
}

export function duplicateLinkIssues(links: number[], questionCount: number): string[] {
  const seen = new Map<number, number>();
  const issues: string[] = [];
  for (let index = 0; index < links.length; index += 1) {
    const target = links[index] ?? 0;
    if (!target) continue;
    if (target < 1 || target > questionCount) {
      issues.push(`${index + 1}. sorunun karşılığı 1–${questionCount} arasında olmalı.`);
      continue;
    }
    const previous = seen.get(target);
    if (previous) issues.push(`${previous}. ve ${index + 1}. sorular aynı ${target}. soruya bağlandı.`);
    else seen.set(target, index + 1);
  }
  return issues;
}
