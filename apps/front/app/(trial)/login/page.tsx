"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookStack, StoryRoom } from "@/components/layout/StoryRoom";
import room from "@/components/layout/StoryRoom.module.css";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass, FOCUS_RING } from "@/components/ui/actionStyles";
import { type FieldErrors, fetchMe, login, signup, validateLogin, validateSignup } from "@/lib/api/auth";
import { errorMessage, validationDetails } from "@/lib/api/errorPresentation";
import { safeRedirectPath } from "./redirectTarget";

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
  /** 백엔드가 `details` 로 주는 필드별 사유. 가입에서만 쓴다. */
  const [formDetails, setFormDetails] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  // 이미 로그인되어 있으면 서재 또는 이전 목적지로 리다이렉트
  useEffect(() => {
    let active = true;
    fetchMe()
      .then(() => {
        if (!active) return;
        const search = typeof window !== "undefined" ? window.location.search : "";
        const params = new URLSearchParams(search);
        router.replace(safeRedirectPath(params.get("redirect")));
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
    setFormDetails([]);

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
      // 로그인 화면을 히스토리에 남기지 않는다 — 남기면 뒤로가기가 이 화면으로 돌아왔다가
      // 위 effect 의 자동 리다이렉트로 다시 앞으로 튕겨 "뒤로 갈 수 없는" 것처럼 보인다.
      router.replace(safeRedirectPath(params.get("redirect")));
    } catch (error) {
      // 서버가 준 메시지를 그대로 쓴다. 로그인 실패는 사유를 구분하지 않는 한 문장이다.
      setFormError(errorMessage(error, "잠시 후 다시 시도해 주세요."));
      // ⚠️ 필드별 사유는 **가입에서만** 보여 준다. 로그인에서 "아이디 형식이 틀렸다" 를
      //    알리면 그 표시가 곧 계정 존재 여부의 신호가 된다(§9 폼 검증 규칙).
      setFormDetails(mode === "signup" ? validationDetails(error) : []);
    } finally {
      setPending(false);
    }
  }

  return (
    <StoryRoom className={room.login}>
      <div className={room.welcome} aria-hidden="true">
        <BookStack />
        <p><span>한 권의 책에서,</span><span>커다란 모험으로.</span></p>
      </div>
      <div className={room.loginPanel}>
        <form
          method="post"
          onSubmit={handleSubmit}
          className={room.form}
          noValidate
          aria-busy={pending}
        >
          <div className={room.formHeading}>
            <h1>{label.title}</h1>
            <p>
              {mode === "signup"
                ? "아이디와 비밀번호로 베이비북스에 가입해요."
                : "베이비북스에 다시 오신 걸 환영해요."}
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
            <div
              role="alert"
              className="rounded-xl bg-danger-soft px-4 py-3 text-sm leading-relaxed font-bold text-danger-strong"
            >
              {formError}
              {/* 백엔드가 `details` 로 필드별 사유를 주는데 쓰는 곳이 없어, 가입 실패에도
                  "요청 값이 올바르지 않습니다." 한 줄만 보였다. */}
              {formDetails.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 font-normal">
                  {formDetails.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
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
              setFormDetails([]);
            }}
          >
            {label.switchTo}
          </button>
        </form>
        <div className={room.guestLink}>
          <ActionLink href="/library" variant="secondary" size="compact">
            로그인 없이 동화 보기
          </ActionLink>
        </div>
      </div>
    </StoryRoom>
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
        className={`min-h-touch w-full min-w-0 rounded-xl border-2 px-4 text-lg text-ink aria-invalid:border-danger-strong ${room.input}`}
      />
      {error ? (
        <p id={errorId} className="text-sm leading-relaxed text-danger-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
