import { AppError } from "@/lib/errors";
import { NextResponse } from "next/server";

function isAppError(error: unknown): error is AppError {
  return (
    error instanceof AppError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AppError" &&
      "status" in error &&
      "code" in error)
  );
}

export function jsonError(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details ?? null },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: "Beklenmeyen bir hata oluştu.", code: "INTERNAL" },
    { status: 500 },
  );
}
