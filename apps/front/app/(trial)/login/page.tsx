"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass, FOCUS_RING } from "@/components/ui/actionStyles";
import { ApiError } from "@/lib/api";
import { type FieldErrors, fetchMe, login, signup, validateLogin, validateSignup } from "@/lib/api/auth";

type Mode = "login" | "signup";

const MODE_LABEL: Record<Mode, { title: string; submit: string; switchTo: string }> = {
  login: { title: "로그인", submit: "로그인", switchTo: "처음이신가요? 가입하기" },
  signup: { title: "가입하기", submit: "가입하고 시작", switchTo: "이미 계정이 있어요" },
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  // 이미 로그인되어 있으면 서재 또는 이전 목적지로 리다이렉트
  useEffect(() => {
    let active = true;
    fetchMe()
      .then(() => {
        if (!active) return;
        const search = typeof window !== "undefined" ? window.location.search : "";
        const params = new URLSearchParams(search);
        const redirect = params.get("redirect");
        router.replace(redirect && redirect.startsWith("/") ? redirect : "/library");
      })
      .catch(() => {
        // 미인증 상태이므로 로그인 폼 표시 유지
      });
    return () => {
      active = false;
    };
  }, [router]);

  const label = MODE_LABEL[mode];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const input = { loginId, password };
    // ⭐ 백엔드와 **같은 스키마**로 검증한다. 로그인은 가입 규칙을 적용하지 않는다 —
    //    형식 오류 표시가 곧 계정 존재 여부의 신호가 되기 때문이다.
    const fieldErrors = mode === "signup" ? validateSignup(input) : validateLogin(input);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      const firstInvalid = fieldErrors.loginId ? "#loginId" : 'input[type="password"]';
      event.currentTarget.querySelector<HTMLInputElement>(firstInvalid)?.focus();
      return;
    }

    setPending(true);
    try {
      await (mode === "signup" ? signup(input) : login(input));
      const search = typeof window !== "undefined" ? window.location.search : "";
      const params = new URLSearchParams(search);
      const redirect = params.get("redirect");
      router.push(redirect && redirect.startsWith("/") ? redirect : "/library");
    } catch (error) {
      // 서버가 준 메시지를 그대로 쓴다. 로그인 실패는 사유를 구분하지 않는 한 문장이다.
      setFormError(error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-5 py-8 md:py-10">
      <Card className="px-6 py-8 md:px-10">
        <form
          method="post"
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
          noValidate
          aria-busy={pending}
        >
          <div className="mb-1 text-center">
            <h1 className="text-3xl font-bold text-ink">{label.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {mode === "signup"
                ? "아이디와 비밀번호로 동화나라에 가입해요."
                : "동화나라에 다시 오신 걸 환영해요."}
            </p>
          </div>

          <Field
            id="loginId"
            label="아이디"
            value={loginId}
            onChange={setLoginId}
            error={errors.loginId}
            autoComplete="username"
          />
          <Field
            id={mode === "signup" ? "new-password" : "current-password"}
            label="비밀번호"
            type="password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {formError ? (
            // role="alert" 이라 스크린리더가 즉시 읽는다. 실패를 조용히 두지 않는다.
            <p
              role="alert"
              className="rounded-xl bg-accent-b-soft px-4 py-3 text-sm leading-relaxed font-bold text-accent-b-strong"
            >
              {formError}
            </p>
          ) : null}

          <button type="submit" className={actionClass("primary")} disabled={pending}>
            {pending ? "잠시만요…" : label.submit}
          </button>

          <button
            type="button"
            className={`min-h-touch rounded-pill px-4 text-sm font-bold text-ink-muted underline underline-offset-4 disabled:cursor-wait disabled:opacity-50 ${FOCUS_RING}`}
            disabled={pending}
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setErrors({});
              setFormError("");
            }}
          >
            {label.switchTo}
          </button>
        </form>
      </Card>
      <ActionLink href="/library" variant="ghost" size="compact" className="self-center">
        로그인 없이 동화 보기
      </ActionLink>
    </main>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}

function Field({ id, label, value, onChange, error, type = "text", autoComplete }: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        required
        onChange={(event) => onChange(event.target.value)}
        // 오류를 색으로만 알리지 않는다 — aria 로도 연결한다.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-touch w-full min-w-0 rounded-xl border-2 border-primary bg-surface-raised px-4 text-lg text-ink outline-none focus:border-primary-strong aria-invalid:border-accent-b-strong"
      />
      {error ? (
        <p id={errorId} className="text-sm leading-relaxed text-accent-b-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
