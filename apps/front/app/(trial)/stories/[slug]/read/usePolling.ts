"use client";

import { useEffect, useRef, useState } from "react";
import { isPollDegraded, nextPollDelay, POLL_BASE_MS } from "./polling";

interface UsePollingOptions<T> {
  /** false 가 되면 즉시 중지하고 예약된 타이머를 버린다. */
  enabled: boolean;
  fetcher: () => Promise<T>;
  onData: (data: T) => void;
}

/**
 * 겹치지 않는 폴링.
 *
 * 🚫 `setInterval` 을 쓰지 않는다 — 응답이 간격보다 느리면 요청이 겹쳐 쌓이고, 늦게 도착한
 *    옛 응답이 최신 상태를 덮어써 진행률이 역행해 보인다. **다음 호출을 직전 응답이 끝난 뒤에
 *    예약**하는 `setTimeout` 재귀라 겹침이 구조적으로 불가능하다.
 *
 * 실패는 삼키지 않는다 — 연속 실패를 세어 간격을 늘리고(`nextPollDelay`), 임계치를 넘으면
 * `degraded` 로 알려 호출측이 사용자에게 표시하게 한다.
 */
export function usePolling<T>({ enabled, fetcher, onData }: UsePollingOptions<T>): {
  degraded: boolean;
} {
  const [degraded, setDegraded] = useState(false);

  // 최신 콜백을 ref 로 들고 폴링 effect 의존성에서 뺀다. 넣으면 인라인 함수 때문에 매 렌더마다
  // 폴링이 재시작되어 간격이 사실상 무시된다.
  // ⚠️ 대입은 렌더 중이 아니라 effect 에서 한다 — `react-hooks/refs` 가 렌더 중 ref 쓰기를 막는다.
  const fetcherRef = useRef(fetcher);
  const onDataRef = useRef(onData);

  useEffect(() => {
    fetcherRef.current = fetcher;
    onDataRef.current = onData;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failCount = 0;

    async function tick() {
      try {
        const data = await fetcherRef.current();
        if (cancelled) return;
        failCount = 0;
        setDegraded(false);
        onDataRef.current(data);
      } catch {
        if (cancelled) return;
        failCount += 1;
        setDegraded(isPollDegraded(failCount));
      }
      // 언마운트·비활성 후에는 다시 예약하지 않는다.
      if (!cancelled) {
        timer = setTimeout(() => void tick(), nextPollDelay(failCount));
      }
    }

    timer = setTimeout(() => void tick(), POLL_BASE_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // 다음에 다시 켜질 때 직전 사이클의 경고를 끌고 가지 않는다.
      setDegraded(false);
    };
  }, [enabled]);

  return { degraded };
}
