"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { actionClass } from "@/components/ui/actionStyles";
import { ApiError } from "@/lib/api";
import { type FieldErrors, login, signup, validateLogin, validateSignup } from "@/lib/api/auth";

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

  const label = MODE_LABEL[mode];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    const input = { loginId, password };
    // ⭐ 백엔드와 **같은 스키마**로 검증한다. 로그인은 가입 규칙을 적용하지 않는다 —
    //    형식 오류 표시가 곧 계정 존재 여부의 신호가 되기 때문이다.
    const fieldErrors = mode === "signup" ? validateSignup(input) : validateLogin(input);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setPending(true);
    try {
      await (mode === "signup" ? signup(input) : login(input));
      router.push("/library");
    } catch (error) {
      // 서버가 준 메시지를 그대로 쓴다. 로그인 실패는 사유를 구분하지 않는 한 문장이다.
      setFormError(
        error instanceof ApiError ? error.message : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-8">
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <h1 className="text-2xl font-bold text-ink">{label.title}</h1>

          <Field
            id="loginId"
            label="아이디"
            value={loginId}
            onChange={setLoginId}
            error={errors.loginId}
            autoComplete="username"
          />
          <Field
            id="password"
            label="비밀번호"
            type="password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {formError ? (
            // role="alert" 이라 스크린리더가 즉시 읽는다. 실패를 조용히 두지 않는다.
            <p role="alert" className="text-sm font-bold text-accent-b">
              {formError}
            </p>
          ) : null}

          <button type="submit" className={actionClass("primary")} disabled={pending}>
            {pending ? "잠시만요…" : label.submit}
          </button>

          <button
            type="button"
            className="min-h-touch text-sm font-bold text-ink-muted underline"
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        // 오류를 색으로만 알리지 않는다 — aria 로도 연결한다.
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-touch rounded-card border-2 border-primary-soft px-4 text-lg text-ink outline-none focus:border-primary"
      />
      {error ? (
        <p id={errorId} className="text-sm text-accent-b">
          {error}
        </p>
      ) : null}
    </div>
  );
}
