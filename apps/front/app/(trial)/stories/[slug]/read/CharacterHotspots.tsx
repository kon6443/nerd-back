"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { StoryPageCharacter } from "@nerd/contracts";
import styles from "./CharacterHotspots.module.css";
import {
  ensureMinimumTarget,
  projectCoverHitbox,
  type Size,
} from "./characterHotspotGeometry";

const MINIMUM_TARGET_SIZE = 56;

interface HotspotLayout {
  image: Size;
  container: Size;
}

function sameLayout(left: HotspotLayout | null, right: HotspotLayout): boolean {
  return (
    left?.image.width === right.image.width &&
    left.image.height === right.image.height &&
    left.container.width === right.container.width &&
    left.container.height === right.container.height
  );
}

export function CharacterHotspots({
  imageUrl,
  characters,
  selectedRole,
  chatOpen,
  onSelect,
}: {
  imageUrl?: string;
  characters: StoryPageCharacter[];
  selectedRole: string;
  chatOpen: boolean;
  onSelect: (role: string, trigger: HTMLButtonElement) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<HotspotLayout | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !imageUrl) {
      setLayout(null);
      return;
    }

    // 가장 가까운 부모 중 img를 포함한 요소를 안전하게 상향 탐색 (Loose Coupling)
    //
    // 🚫 **첫 `<img>` 를 그냥 집지 않는다.** 넘김 잔상을 없애려고 `BookPager` 가 직전 쪽 삽화를
    //    밑장(`data-art-hold`)으로 깔아 두는데, 그것이 문서 순서상 `.art` 안 첫 번째다. 집으면
    //    **직전 쪽의 원본 해상도**로 좌표를 계산해 말풍선이 통째로 어긋나고, 새 삽화가 아직
    //    로드 중이면 `load` 리스너까지 엉뚱한 요소에 붙어 영영 다시 재지 않는다.
    let current = layer.parentElement;
    let image: HTMLImageElement | null = null;
    while (current) {
      const candidates = Array.from(current.querySelectorAll<HTMLImageElement>("img"));
      image = candidates.find((candidate) => !candidate.closest("[data-art-hold]")) ?? null;
      if (image) break;
      current = current.parentElement;
    }

    if (!image) {
      setLayout(null);
      return;
    }

    const sync = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
      const next = {
        image: { width: image.naturalWidth, height: image.naturalHeight },
        container: { width: layer.clientWidth, height: layer.clientHeight },
      };
      if (next.container.width <= 0 || next.container.height <= 0) return;
      setLayout((current) => (sameLayout(current, next) ? current : next));
    };

    sync();
    if (!image.complete) {
      image.addEventListener("load", sync);
    }
    const resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(layer);
    return () => {
      image.removeEventListener("load", sync);
      resizeObserver.disconnect();
    };
  }, [imageUrl]);

  const hotspots = useMemo(() => {
    if (!layout) return [];
    return characters.flatMap((character) => {
      if (!character.hitbox) return [];
      const projected = projectCoverHitbox(character.hitbox, layout.image, layout.container);
      if (!projected) return [];
      return [
        {
          character,
          rect: ensureMinimumTarget(projected, layout.container, MINIMUM_TARGET_SIZE),
        },
      ];
    });
  }, [characters, layout]);

  return (
    <div ref={layerRef} className={styles.hotspotLayer}>
      {hotspots.map(({ character, rect }) => (
        <HotspotPin
          key={character.role}
          character={character}
          rect={rect}
          isSelected={selectedRole === character.role}
          isChatOpen={chatOpen}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function HotspotPin({
  character,
  rect,
  isSelected,
  isChatOpen,
  onSelect,
}: {
  character: StoryPageCharacter;
  rect: { left: number; top: number; width: number; height: number };
  isSelected: boolean;
  isChatOpen: boolean;
  onSelect: (role: string, trigger: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${character.displayName}와 대화하기`}
      aria-pressed={isSelected}
      aria-expanded={isSelected && isChatOpen}
      className={styles.hotspot}
      style={
        {
          insetInlineStart: rect.left,
          insetBlockStart: rect.top,
          inlineSize: rect.width,
          blockSize: rect.height,
        } as CSSProperties
      }
      onClick={(event) => onSelect(character.role, event.currentTarget)}
    >
      <span aria-hidden="true" className={styles.hotspotBubble}>
        <span className={styles.hotspotIcon}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-5a7.5 7.5 0 0 1 7.5-13h1A7.5 7.5 0 0 1 20 11.5Z" strokeLinejoin="round" />
          </svg>
        </span>
        <span className={styles.hotspotNameWrapper}>
          <span className={styles.hotspotName}>{character.displayName}</span>
        </span>
      </span>
    </button>
  );
}
