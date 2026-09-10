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
 * ⭐ **마지막으로 확인된 로그인 여부를 브라우저에 남긴다.** 새로고침마다 `GET /auth/me` 응답을
 * 기다려야 헤더 문구가 정해지면 「마이페이지」가 매번 비었다가 나타나 깜빡인다(2026-09-09 보고).
 *
 * **여기서는 쓰기만 한다.** 읽는 쪽은 `layout.tsx` 의 인라인 스크립트 하나뿐이고, 그것이 첫 페인트
 * 전에 `<html data-session>` 을 세운다. 🚫 이 값으로 React 상태를 채우지 않는다 — 화면이 그리는
 * 사용자 데이터의 근거는 서버 확인이어야 한다.
 *
 * ⚠️ 힌트일 뿐이다. 다른 탭에서 로그아웃했다면 잠깐 낡은 문구가 보이고 응답 뒤 바로 고쳐진다.
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

/**
 * 저장소 접근은 실패할 수 있다(사생활 모드·차단). 실패해도 화면은 정상이어야 하므로 전부 삼킨다.
 *
 * 🚫 **사용자 정보(`me`)를 넣지 않는다.** 넣으면 로그아웃 없이 브라우저를 닫았을 때, 다음 사람이
 * 마이페이지를 열자마자 **앞사람의 아이디가 먼저 그려진다**(2026-09-10 리뷰에서 잡혔다).
 * 저장하는 것은 로그인 여부 한 값뿐이고, 그것도 헤더 문구를 미리 고르는 데만 쓰인다.
 */
function writeCachedSession(state: SessionState): void {
  if (typeof window === "undefined" || state.status === "unknown") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: state.status }));
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

/**
 * 🚫 기억해 둔 값으로 여기를 채우지 않는다. 이 스냅숏은 **서버가 확인해 준 것만** 담는다 —
 * 화면이 사용자 데이터를 그리는 근거이기 때문이다. 기억해 둔 값은 `<html data-session>` 을 통해
 * 헤더 문구를 고르는 데만 쓰이고, 그 일은 `layout.tsx` 의 인라인 스크립트가 한다.
 */
let snapshot: SessionState = UNKNOWN;
/** 서버 확인이 끝났는가. ⚠️ 네트워크 오류로 못 끝냈으면 **false 로 남겨** 다음 마운트가 다시 시도한다. */
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
    .then((me) => {
      verified = true;
      publish({ status: "authenticated", me });
    })
    .catch((error: unknown) => {
      // 🚫 모든 실패를 "비로그인" 으로 뭉개지 않는다. 401 만 비로그인이다.
      if (error instanceof ApiError && error.isUnauthorized) {
        verified = true;
        publish({ status: "guest" });
        return;
      }
      // ⚠️ 네트워크·서버 오류는 **확인하지 못한 것**이다. `verified` 를 세우지 않아 다음 마운트가
      //    다시 시도한다. 세워 버리면 잠깐 끊겼다 복구돼도 인증 칸이 빈 채로 남는다(2026-09-10 리뷰).
    })
    .finally(() => {
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
