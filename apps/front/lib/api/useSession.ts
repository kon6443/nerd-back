"use client";

import type { Me } from "@nerd/contracts";
import { useEffect, useSyncExternalStore } from "react";
import { ApiError, SESSION_CHANGED_EVENT } from "./client";
import { fetchMe } from "./auth";
import { SESSION_STORAGE_KEY } from "./sessionStorageKey";

/**
 * 로그인 상태 — **모듈 하나가 들고 모든 컴포넌트가 나눠 쓴다.**
 *
 * ⚠️ 이건 보안 장치가 아니라 화면 표시용이다. 실제 보호는 백엔드가 401 을 주는 것이고,
 * 여기서 하는 일은 "무엇을 보여줄지" 뿐이다.
 * 🚫 이 값으로 민감한 데이터를 감추는 설계를 하지 않는다 — 데이터를 안 주는 쪽이 방어다.
 *
 * ⭐ **컴포넌트마다 상태를 갖지 않는 이유**: 헤더·헤더 안의 CTA·화면의 CTA 가 동시에 붙으면
 * 각자 조회해 **한 페이지에 `GET /auth/me` 가 3번** 나간다(2026-09-09 실제로 그랬다).
 * 모듈 스코프에 두고 `useSyncExternalStore` 로 구독하면 요청은 **한 번**이다.
 */
export type SessionState =
  | { status: "unknown" }
  | { status: "guest" }
  | { status: "authenticated"; me: Me };

/** 🚫 매번 새 객체를 만들지 않는다 — `useSyncExternalStore` 가 무한 렌더로 판단한다. */
const UNKNOWN: SessionState = { status: "unknown" };

/**
 * ⭐ **마지막으로 확인된 상태를 브라우저에 남긴다.** 새로고침마다 `GET /auth/me` 응답을 기다려야
 * 로그인 칸이 채워지면, 헤더의 「마이페이지」가 매번 비었다가 나타나 깜빡인다(2026-09-09 배포
 * 환경 보고). 기억해 둔 상태를 **먼저 그리고**, 응답이 오면 진짜 상태로 바꾼다.
 *
 * ⚠️ 힌트일 뿐이다. 다른 탭에서 로그아웃했다면 잠깐 낡은 문구가 보이고 응답 뒤 바로 고쳐진다.
 * 🚫 여기 값으로 무엇을 보호하지 않는다 — 어차피 데이터는 백엔드가 401 로 막는다.
 */
const STORAGE_KEY = SESSION_STORAGE_KEY;

/**
 * 문구 선택은 CSS 가 `<html data-session>` 으로 한다(`globals.css`). 확인된 상태를 그 속성에 옮긴다.
 * `layout.tsx` 의 인라인 스크립트가 첫 페인트 전에 기억해 둔 값으로 먼저 채우고, 여기서 진짜 값으로 맞춘다.
 */
function syncDocument(state: SessionState): void {
  if (typeof document === "undefined") return;
  if (state.status === "unknown") delete document.documentElement.dataset.session;
  else document.documentElement.dataset.session = state.status;
}

/** 저장된 문자열 → 상태. 형식이 어긋나면 `null` — 낡은 버전이 남긴 값을 그대로 믿지 않는다. */
export function parseCachedSession(raw: string | null): SessionState | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { status, me } = value as { status?: unknown; me?: unknown };
    if (status === "guest") return { status: "guest" };
    if (
      status === "authenticated" &&
      typeof me === "object" &&
      me !== null &&
      typeof (me as { loginId?: unknown }).loginId === "string"
    ) {
      return { status: "authenticated", me: { loginId: (me as { loginId: string }).loginId } };
    }
    return null;
  } catch {
    return null;
  }
}

/** 저장소 접근은 실패할 수 있다(사생활 모드·차단). 실패해도 화면은 정상이어야 하므로 전부 삼킨다. */
function readCachedSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCachedSession(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeCachedSession(state: SessionState): void {
  if (typeof window === "undefined" || state.status === "unknown") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 다음 새로고침이 한 번 더 깜빡이는 것뿐이다.
  }
}

function clearCachedSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 위와 같다 — 지우지 못해도 다음 확인이 덮어쓴다.
  }
}

let snapshot: SessionState = readCachedSession() ?? UNKNOWN;
/** 이번 페이지 수명 안에서 서버에 한 번이라도 확인했는가. 기억해 둔 상태는 확인을 대신하지 않는다. */
let verified = false;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function publish(next: SessionState): void {
  snapshot = next;
  writeCachedSession(next);
  syncDocument(next);
  for (const notify of subscribers) notify();
}

/** 이미 조회 중이면 그 약속을 그대로 돌려준다 — 동시에 붙은 컴포넌트들이 요청을 공유한다. */
function load(): Promise<void> {
  inFlight ??= fetchMe()
    .then((me) => publish({ status: "authenticated", me }))
    .catch((error: unknown) => {
      // 🚫 모든 실패를 "비로그인" 으로 뭉개지 않는다. 401 만 비로그인이다. 네트워크·서버 오류는
      //    상태를 모르는 것이라 지금 스냅숏(기억해 둔 힌트 또는 `unknown`)을 그대로 둔다 —
      //    잘못된 화면을 새로 그리지 않기 위해서다.
      if (error instanceof ApiError && error.isUnauthorized) publish({ status: "guest" });
    })
    .finally(() => {
      verified = true;
      inFlight = null;
    });

  return inFlight;
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

/**
 * ⚠️ 서버 렌더에서는 **항상 `unknown`** 이다. 쿠키를 읽어 인증 상태를 SSR 에 넣으면 그 HTML 이
 * 사용자마다 달라져 캐시할 수 없게 된다. 브라우저는 하이드레이션 직후(첫 페인트 전) 기억해 둔
 * 상태로 바꿔 그린다 — `useSyncExternalStore` 가 두 스냅숏이 다르면 동기적으로 다시 렌더한다.
 */
function getServerSnapshot(): SessionState {
  return UNKNOWN;
}

export function useSession(): SessionState {
  const state = useSyncExternalStore(subscribe, () => snapshot, getServerSnapshot);

  useEffect(() => {
    // 기억해 둔 상태가 있어도 페이지당 한 번은 서버에 확인한다. 화면 이동마다는 아니다.
    if (!verified) void load();

    // 로그아웃처럼 상태가 바뀌는 사건에만 다시 확인한다.
    // 🚫 매 화면 이동마다 재조회하지 않는다 — 요청이 화면 수만큼 는다.
    function recheck() {
      // 로그아웃 직후에는 기억해 둔 값도 지운다 — 재확인이 실패해도 낡은 「마이페이지」가 남지 않게.
      clearCachedSession();
      publish(UNKNOWN);
      void load();
    }

    window.addEventListener(SESSION_CHANGED_EVENT, recheck);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, recheck);
    };
  }, []);

  return state;
}

/**
 * 🚫 프로덕션 코드가 쓰지 않는다 — **테스트 전용 출입구**다.
 * 요청 합치기는 훅 밖의 모듈 상태에서 일어나는데, 그걸 렌더 없이 검증하려면 이 경로가 필요하다.
 */
export const __loadForTest = load;
