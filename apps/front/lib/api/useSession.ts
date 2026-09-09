"use client";

import type { Me } from "@nerd/contracts";
import { useEffect, useSyncExternalStore } from "react";
import { ApiError, SESSION_CHANGED_EVENT } from "./client";
import { fetchMe } from "./auth";

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

let snapshot: SessionState = UNKNOWN;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function publish(next: SessionState): void {
  snapshot = next;
  for (const notify of subscribers) notify();
}

/** 이미 조회 중이면 그 약속을 그대로 돌려준다 — 동시에 붙은 컴포넌트들이 요청을 공유한다. */
function load(): Promise<void> {
  inFlight ??= fetchMe()
    .then((me) => publish({ status: "authenticated", me }))
    .catch((error: unknown) => {
      // 🚫 모든 실패를 "비로그인" 으로 뭉개지 않는다. 401 만 비로그인이고, 네트워크·서버
      //    오류는 상태를 모르는 것이라 `unknown` 으로 남긴다 — 잘못된 화면을 안 그리기 위해서다.
      publish(error instanceof ApiError && error.isUnauthorized ? { status: "guest" } : UNKNOWN);
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
 * 사용자마다 달라져 캐시할 수 없게 된다. 확인 전 화면은 인증 칸을 비운다.
 */
function getServerSnapshot(): SessionState {
  return UNKNOWN;
}

export function useSession(): SessionState {
  const state = useSyncExternalStore(subscribe, () => snapshot, getServerSnapshot);

  useEffect(() => {
    if (snapshot.status === "unknown") void load();

    // 로그아웃처럼 상태가 바뀌는 사건에만 다시 확인한다.
    // 🚫 매 화면 이동마다 재조회하지 않는다 — 요청이 화면 수만큼 는다.
    function recheck() {
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
