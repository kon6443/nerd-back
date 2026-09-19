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

/**
 * 두 모드는 입력 칸이 같다(아이디·비밀번호뿐). 구조를 같게 두는 대신 상단 탭·문구·힌트·책등 색으로
 * 지금 어느 쪽인지 한눈에 구분되게 한다.
 */
const MODE_COPY: Record<
  Mode,
  {
    tab: string;
    title: string;
    lead: string;
    idLabel: string;
    passwordLabel: string;
    idHint?: string;
    passwordHint?: string;
    submit: string;
  }
> = {
  login: {
    tab: "로그인",
    title: "만나서 반가워요",
    lead: "가입할 때 정한 아이디와 비밀번호를 입력해 주세요.",
    idLabel: "아이디",
    passwordLabel: "비밀번호",
    submit: "로그인",
  },
  signup: {
    tab: "10초만에 가입하기",
    title: "10초면 가입 끝!",
    lead: "쓸 아이디와 비밀번호만 정하면 바로 시작해요. 이름·이메일은 받지 않아요.",
    idLabel: "사용할 아이디",
    passwordLabel: "사용할 비밀번호",
    // 문구는 공유 스키마(loginIdSchema·passwordSchema)의 규칙과 같다. 규칙이 바뀌면 함께 고친다.
    idHint: "영문 소문자·숫자·밑줄(_)로 4~20자",
    passwordHint: "8자 이상이면 돼요",
    submit: "가입하고 바로 시작하기",
  },
};

const MODES: Mode[] = ["login", "signup"];

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

  const copy = MODE_COPY[mode];

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setErrors({});
    setFormError("");
    setFormDetails([]);
  }

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
          data-mode={mode}
          onSubmit={handleSubmit}
          className={room.form}
          noValidate
          aria-busy={pending}
        >
          <div className={room.modeTabs} role="group" aria-label="로그인 또는 가입 선택">
            {MODES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                disabled={pending}
                onClick={() => switchMode(value)}
                className={`${room.modeTab} ${FOCUS_RING}`}
              >
                {MODE_COPY[value].tab}
              </button>
            ))}
          </div>

          <div className={room.formHeading}>
            <h1>{copy.title}</h1>
            <p>{copy.lead}</p>
          </div>

          <Field
            id="loginId"
            label={copy.idLabel}
            hint={copy.idHint}
            value={loginId}
            onChange={setLoginId}
            error={errors.loginId}
            autoComplete="username"
          />
          <Field
            id={mode === "signup" ? "new-password" : "current-password"}
            label={copy.passwordLabel}
            hint={copy.passwordHint}
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
            {pending ? "잠시만요…" : copy.submit}
          </button>

          <p className={room.modeSwitch}>
            {mode === "login" ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}{" "}
            <button
              type="button"
              className={`rounded-sm font-bold underline underline-offset-4 disabled:cursor-wait disabled:opacity-50 ${FOCUS_RING}`}
              disabled={pending}
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "10초 만에 가입하기" : "로그인하기"}
            </button>
          </p>
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
  /** 입력 전에 보여 주는 규칙 안내. 가입에서만 쓴다. */
  hint?: string;
  type?: string;
  autoComplete?: string;
}

function Field({ id, label, value, onChange, error, hint, type = "text", autoComplete }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // 오류가 있으면 힌트 자리를 오류가 대신한다.
  const describedBy = error ? errorId : hint ? hintId : undefined;

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
        aria-describedby={describedBy}
        className={`min-h-touch w-full min-w-0 rounded-xl border-2 px-4 text-lg text-ink aria-invalid:border-danger-strong ${room.input}`}
      />
      {hint && !error ? (
        <p id={hintId} className="text-sm leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm leading-relaxed text-danger-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
