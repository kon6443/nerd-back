"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { BookVolume } from "./BookFrame";
import styles from "./BookFrame.module.css";
import { SPREAD_QUERY, stackWidths, turnDirection, type TurnDirection } from "./readerNav";

/**
 * 펼친 책과 쪽 넘김 — **쪽 데이터가 어디서 오는지 모른다.**
 *
 * ⭐ **이 컴포넌트를 만든 이유가 그것이다.** 시연 리더는 서버가 전 쪽을 한 번에 주고, 체험 리더는
 * 본문·삽화·비하인드가 각각 다른 API 에서 온디맨드로 온다. 넘김 모양을 두 벌로 적으면 한쪽만
 * 바뀐다. 그래서 여기는 **쪽 번호 → 내용**(`renderArt` / `renderText`)만 받고, 그 내용을 어떻게
 * 구해 오는지는 부르는 쪽이 정한다.
 *
 * ⭐ **보이는 쪽(`shownPageNo`)과 요청된 쪽(`pageNo` prop)을 따로 둔다.** 둘이 다르면 넘김을
 * 시작하고, 종이가 다 넘어가야 보이는 쪽이 따라간다. 넘기는 중에 또 요청이 오면 한 장이 끝나는
 * 대로 다음 장이 이어서 넘어간다 — 연타가 씹히지 않는다.
 *
 * ⚠️ **도착 쪽 내용이 넘김 시작 시점에 있어야 한다.** 넘어가는 종이의 뒷면이 곧 도착 쪽이라,
 * 그때 없으면 넘김이 끝날 때까지 빈 종이가 돈다. 부르는 쪽이 인접 쪽을 미리 받아 둘 책임을 진다.
 */
interface Turn {
  from: number;
  to: number;
  direction: TurnDirection;
  /** 넘김 시작 시점의 화면 폭으로 정한다. 넘기는 도중 창 크기가 바뀌어도 한 장은 같은 모양으로 끝낸다. */
  layout: "spread" | "single";
}

/** `animationend` 가 오지 않는 경우(탭 전환 등)의 안전장치. CSS 넘김 시간(820ms)보다 넉넉히 길다. */
const TURN_FALLBACK_MS = 1400;

/**
 * 넘어가는 종이를 몇 마디로 접을지.
 *
 * ⚠️ **늘리면 곡선이 매끄러워지는 대신 내용이 그만큼 더 렌더된다**(마디 × 앞뒤 면).
 * 10 이면 활이 매끄럽다 — 8 이하에서는 휨을 키우는 순간 마디마다 꺾인 자국이 드러난다. 바꾸려면 `SEGMENT_BEND` 의 길이도 함께 맞춘다(명암은 마디 수와 무관하다 — `BookFrame.module.css`).
 */
const LEAF_SEGMENTS = 10;

/**
 * 마디가 몸통 회전에 **더 얹는** 휨(도). 앞이 책등 쪽이다.
 *
 * ⭐ **값은 사인 활에서 나왔다.** 누적 각도가 `-22° × sin(π·x)` 를 그리도록 이웃과의 차이를 적어
 * 둔 것이라, 마디가 균등하게 휘어 **꺾인 자국 없이 둥근 배**가 된다. 🚫 손으로 값을 흩뜨리지 않는다 —
 * 이웃 간 차이가 들쭉날쭉해지는 순간 그 자리가 접힌 자국으로 보인다.
 *
 * ⭐ **합이 0 이다.** 앞쪽에서 벌어졌다가 뒤쪽에서 되감겨야 종이 끝이 몸통과 같은 방향을 향한다 —
 * 그래야 넘어간 뒤 평평하게 눕는다. 합이 0 이 아니면 종이가 끝까지 말린 채 착지한다.
 *
 * ⚠️ **부호가 곧 불룩한 방향이다.** 넘기는 손은 종이 뒤에서 미므로 가운데가 **보는 사람 쪽으로**
 * 부풀어야 한다 — 반대로 두면 종이가 책 안쪽으로 꺼져 어색하다(2026-09-14 지적).
 *
 * ⚠️ 진폭이 곧 "얼마나 종이 같은가" 다. 14° 는 **판때기**였고, 28° 는 종이가 너무 말려 **폭이 줄고**
 * 90° 부근에서 앞뒤 면이 오래 섞였다. 18° 가 그 사이다 (2026-09-14 실측).
 */
const SEGMENT_BEND = [
  "-6.8deg",
  "-6.1deg",
  "-4.9deg",
  "-3.1deg",
  "-1.1deg",
  "1.1deg",
  "3.1deg",
  "4.9deg",
  "6.1deg",
  "6.8deg",
] as const;

/**
 * 마디가 보여 줄 조각의 번호.
 *
 * 앞면은 축에서 센 순서 그대로이고, 뒷면은 종이가 뒤집혀 **좌우가 반대**가 된다.
 * `prev` 는 축이 오른쪽이라 축에서 센 순서 자체가 뒤집힌다.
 */
function sliceIndex(depth: number, direction: TurnDirection, side: "front" | "back"): number {
  const fromAxis = direction === "next" ? depth : LEAF_SEGMENTS - 1 - depth;
  return side === "front" ? fromAxis : LEAF_SEGMENTS - 1 - fromAxis;
}

/** 내용을 통째로 담고 자기 구간만 내보인다 — 마디를 나눠도 글자가 잘리거나 어긋나지 않는다. */
function LeafSlice({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className={styles.slice}>
      <div
        className={styles.sliceInner}
        style={{
          // ⚠️ `.slice` 가 좌우로 1px 씩 넓다(이음새를 덮으려고). 그만큼 빼야 조각이 제자리에 온다 —
          //    `100%` 그대로 두면 마디마다 2px 씩 밀려 글자가 어긋난다.
          inlineSize: `calc((100% - 2px) * ${LEAF_SEGMENTS})`,
          transform: `translateX(${(-index * 100) / LEAF_SEGMENTS}%)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * 마디를 **중첩**해 회전을 누적시킨다 — 자식이 부모의 끝에 붙으므로 각도가 저절로 이어져 곡선이 된다.
 * 🚫 형제로 늘어놓지 않는다. 좌표를 직접 계산해야 하고 한 마디만 틀려도 종이가 찢어진다.
 */
function LeafSegments({
  depth,
  direction,
  front,
  back,
}: {
  depth: number;
  direction: TurnDirection;
  front: ReactNode;
  /** 1단 화면에는 뒷면이 없다 — 떠나는 쪽이 들려 사라지면 끝이다. */
  back: ReactNode | null;
}) {
  if (depth >= LEAF_SEGMENTS) return null;
  // 책 모서리를 물려받아야 하는 것은 **바깥 끝 마디**뿐이다.
  const isTip = depth === LEAF_SEGMENTS - 1;

  return (
    <div
      className={`${styles.seg} ${isTip ? styles.segTip : ""}`}
      style={
{ "--bend": SEGMENT_BEND[depth], "--depth": depth } as CSSProperties
      }
    >
      <div className={styles.segFace}>
        <LeafSlice index={sliceIndex(depth, direction, "front")}>{front}</LeafSlice>
      </div>
      {back ? (
        <div className={`${styles.segFace} ${styles.segBack}`}>
          <LeafSlice index={sliceIndex(depth, direction, "back")}>{back}</LeafSlice>
        </div>
      ) : null}
      <LeafSegments depth={depth + 1} direction={direction} front={front} back={back} />
    </div>
  );
}

/**
 * 책 위아래에 붙는 줄(제목·쪽 표시·조작 버튼)의 공통 클래스.
 *
 * ⚠️ **`relative` 가 핵심이다.** 넘어가는 종이는 책 밖으로 솟는데(`.leaf`), 책이 positioned 라
 * static 인 형제는 그 아래로 깔린다 — 빼면 종이가 조작줄을 덮는다(2026-09-14 실측).
 * 🚫 화면마다 이 문자열을 다시 적지 않는다. 한 곳이라야 `relative` 를 빠뜨릴 수 없다.
 */
export const READER_BAR = "relative flex flex-wrap items-center justify-between gap-3";

export interface BookPagerProps {
  /** 보여야 할 쪽. 값이 바뀌면 넘김이 시작된다(제어형). */
  pageNo: number;
  /** 단면 두께 계산과 방향키 범위에 쓴다. */
  pageCount: number;
  renderArt: (pageNo: number) => ReactNode;
  renderText: (pageNo: number) => ReactNode;
  /**
   * 좌우 방향키가 쪽을 요청한다.
   * 🚫 여기서 쪽을 직접 바꾸지 않는다 — 주소로 옮길지(시연) 상태로 옮길지(체험)는 부르는 쪽이 정한다.
   */
  onRequestPage: (pageNo: number) => void;
  /**
   * 넘기는 중인지 알린다. 넘김 도중 책 **폭이 바뀌는** 조작(대화 dock 열고 닫기)을 막는 데 쓴다.
   * ⚠️ 매 렌더 새로 만든 함수를 넘기지 않는다 — `useCallback` 으로 고정한다.
   */
  onTurningChange?: (turning: boolean) => void;
  /** 부모가 준 높이를 꽉 채운다(몰입 화면). 끄면 자연 높이로 흐른다. */
  fill?: boolean;
}

export function BookPager({
  pageNo,
  pageCount,
  renderArt,
  renderText,
  onRequestPage,
  onTurningChange,
  fill = true,
}: BookPagerProps) {
  const [shownPageNo, setShownPageNo] = useState(pageNo);
  const [turn, setTurn] = useState<Turn | null>(null);

  // 렌더 중 상태 조정 — 요청된 쪽이 앞서 가 있고 넘기는 중이 아니면 한 장을 시작한다.
  // 이펙트로 옮기면 한 프레임 동안 옛 쪽이 그대로 그려진 뒤 넘김이 시작된다.
  if (!turn && pageNo !== shownPageNo) {
    setTurn({
      from: shownPageNo,
      to: pageNo,
      direction: turnDirection(shownPageNo, pageNo),
      layout: window.matchMedia(SPREAD_QUERY).matches ? "spread" : "single",
    });
  }

  function finishTurn() {
    if (!turn) return;
    setShownPageNo(turn.to);
    setTurn(null);
  }

  useEffect(() => {
    if (!turn) return;
    const timer = window.setTimeout(() => {
      setShownPageNo(turn.to);
      setTurn(null);
    }, TURN_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [turn]);

  useEffect(() => {
    onTurningChange?.(turn !== null);
  }, [turn, onTurningChange]);

  // 좌우 방향키로도 넘긴다.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      const next =
        event.key === "ArrowRight" ? pageNo + 1 : event.key === "ArrowLeft" ? pageNo - 1 : null;
      if (next === null || next < 1 || next > pageCount) return;
      event.preventDefault();
      onRequestPage(next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageNo, pageCount, onRequestPage]);

  // 밑에 깔리는 펼침면. 넘기는 중에는 종이가 아직 덮지 않은 면에 떠나는 쪽이, 드러난 면에 도착 쪽이 있다.
  let baseArt = shownPageNo;
  let baseText = shownPageNo;
  if (turn) {
    const nextSpread = turn.layout === "spread" && turn.direction === "next";
    const prevSpread = turn.layout === "spread" && turn.direction === "prev";
    baseArt = nextSpread ? turn.from : turn.to;
    baseText = prevSpread ? turn.from : turn.to;
  }

  // 단면 두께는 **요청된** 쪽을 따른다 — CSS 전환이 넘김과 같은 시간 동안 두께를 옮긴다.
  const stack = stackWidths(pageNo, pageCount);
  const volumeStyle = {
    "--stack-left": `${stack.left}px`,
    "--stack-right": `${stack.right}px`,
  } as CSSProperties;

  return (
    <BookVolume style={volumeStyle}>
      <div className={`${styles.book} ${fill ? styles.fill : ""}`}>
        {/* 정적인 내용은 여기서 둥근 모서리로 잘린다. 넘어가는 종이는 이 밖에 둬야 안 잘린다. */}
        <div className={styles.surface}>
          <div className={styles.spread}>
            <div className={styles.art}>{renderArt(baseArt)}</div>
            <div className={styles.page}>{renderText(baseText)}</div>
          </div>
        </div>

        {turn ? (
          <div
              // 쪽 조합이 바뀌면 새 종이로 애니메이션을 처음부터 돌린다.
              key={`${turn.from}-${turn.to}`}
              aria-hidden="true"
              data-turn={turn.direction}
              className={styles.leaf}
              style={{ "--seg-count": LEAF_SEGMENTS } as CSSProperties}
              onAnimationEnd={(event) => {
                // ⚠️ 마디(`seg-curl`)의 것도 버블링되어 온다. 종이 자신의 회전이 끝났을 때만 닫는다.
                if (event.target === event.currentTarget) finishTurn();
              }}
            >
              {turn.layout === "single" ? (
                <LeafSegments
                  depth={0}
                  direction={turn.direction}
                  front={
                    <div className={styles.faceStack}>
                      <div className={styles.art}>{renderArt(turn.from)}</div>
                      <div className={styles.page}>{renderText(turn.from)}</div>
                    </div>
                  }
                  back={null}
                />
              ) : turn.direction === "next" ? (
                <LeafSegments
                  depth={0}
                  direction="next"
                  front={<div className={styles.page}>{renderText(turn.from)}</div>}
                  back={<div className={styles.art}>{renderArt(turn.to)}</div>}
                />
              ) : (
                <LeafSegments
                  depth={0}
                  direction="prev"
                  front={<div className={styles.art}>{renderArt(turn.from)}</div>}
                  back={<div className={styles.page}>{renderText(turn.to)}</div>}
                />
              )}
            </div>
        ) : null}
      </div>
    </BookVolume>
  );
}
