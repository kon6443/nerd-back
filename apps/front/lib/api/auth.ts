import {
  type LoginInput,
  type Me,
  type SignupInput,
  loginSchema,
  signupSchema,
} from "@nerd/contracts";
import { apiFetch } from "./client";

/**
 * 인증 호출.
 *
 * ⭐ 검증 스키마가 **백엔드와 같은 것**이다(`@nerd/contracts`). 프론트에서 통과한 입력이
 * 백엔드에서 400 이 되는 일이 구조적으로 생기지 않는다.
 */

/** 폼 검증 결과 — 필드별 첫 메시지만 남긴다. 화면은 입력칸 아래 한 줄씩 보여준다. */
export type FieldErrors = Partial<Record<"loginId" | "password", string>>;

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0]);
    if ((field === "loginId" || field === "password") && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

export function validateSignup(input: unknown): FieldErrors {
  const result = signupSchema.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error.issues);
}

/**
 * ⚠️ 로그인은 **가입 규칙으로 검증하지 않는다.** "형식이 틀렸다"는 표시가 곧 "그런 아이디는
 * 없다"는 신호가 되어 계정 존재 여부가 새어나간다. 비어 있는지만 본다 — 백엔드와 같은 규칙이다.
 */
export function validateLogin(input: unknown): FieldErrors {
  const result = loginSchema.safeParse(input);
  if (result.success) return {};

  // 검증 규칙은 공유 스키마를 따르고, 기본 영문 오류 문구만 화면 언어로 바꾼다.
  const errors = toFieldErrors(result.error.issues);
  if (errors.loginId) errors.loginId = "아이디를 입력해 주세요.";
  if (errors.password) errors.password = "비밀번호를 입력해 주세요.";
  return errors;
}

export function signup(input: SignupInput): Promise<Me> {
  return apiFetch<Me>("/auth/signup", { method: "POST", json: input });
}

export function login(input: LoginInput): Promise<Me> {
  return apiFetch<Me>("/auth/login", { method: "POST", json: input });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}
