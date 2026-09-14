"use client";

import { useState } from "react";
import { actionClass } from "@/components/ui/actionStyles";
import {
  CHAT_SURFACES,
  CHAT_SURFACE_LABEL,
  withReaderOptions,
  type ChatSurfaceKind,
  type ReaderOptions,
} from "./readerOptions";

/**
 * ⏳ **한시적 위젯.** 디자인 후보를 화면에서 바꿔 가며 고르기 위한 것이다(2026-09-14 요청).
 * 조합이 정해지면 이 파일과 `readerOptions.ts` 를 지우고 선택값을 상수로 굳힌다
 * (`docs/tasks/tasks-my-story.md` Slice 7 회수 조건).
 *
 * ⭐ **주소만 바꾼다.** `history.replaceState` 는 Next 라우터에 동기화되므로 `useSearchParams` 가
 * 곧바로 새 값을 읽는다 — 리로드도, 별도 상태도 필요 없다(`BookReader` 가 쪽 이동에 쓰는 것과 같은 수단).
 *
 * 🚫 노출 조건을 두지 않는다. `?preview=1` 같은 분기는 "테스트할 때만 켜진다"는 또 하나의
 * 예외를 만들고, 정작 비교해야 할 때 켜는 법을 잊는다.
 */
const SETTINGS_TITLE_ID = "reader-preview-settings-title";

function OptionRow({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-btn px-3 text-sm text-ink has-checked:bg-accent-a-soft has-checked:font-bold has-focus-visible:ring-4 has-focus-visible:ring-magic-strong">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="size-4 shrink-0 accent-accent-a"
      />
      <span className="break-keep">{label}</span>
    </label>
  );
}

export function ReaderPreviewSettings({ options }: { options: ReaderOptions }) {
  const [open, setOpen] = useState(false);

  function apply(patch: Partial<ReaderOptions>) {
    const query = withReaderOptions(window.location.search, patch);
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
  }

  return (
    // 🚫 자기 좌표를 갖지 않는다 — 리더의 하단 바가 위치를 소유한다(`ChatLauncher` 와 같은 이유).
    //    패널은 버튼 **위로** 뜬다(`bottom-full`). 흐름 안에 두면 열 때마다 하단바 높이가 커진다.
    <div className="relative">
      {open ? (
        <div
          aria-labelledby={SETTINGS_TITLE_ID}
          role="group"
          className="absolute bottom-full left-0 mb-3 max-h-[70dvh] w-[17rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card border-2 border-line bg-surface-raised p-4 text-left shadow-xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <p id={SETTINGS_TITLE_ID} className="mb-1 font-bold text-ink">
            보기 설정
          </p>
          <p className="mb-3 text-xs text-ink-muted">
            디자인 후보를 비교하는 임시 도구예요. 고르고 나면 사라집니다.
          </p>

          <fieldset className="mb-3">
            <legend className="mb-1 text-xs font-bold tracking-wider text-ink-muted uppercase">
              대화 표면
            </legend>
            {CHAT_SURFACES.map((surface: ChatSurfaceKind) => (
              <OptionRow
                key={surface}
                name="preview-chat"
                label={CHAT_SURFACE_LABEL[surface]}
                checked={options.chat === surface}
                onSelect={() => apply({ chat: surface })}
              />
            ))}
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-xs font-bold tracking-wider text-ink-muted uppercase">
              몰입 화면
            </legend>
            <OptionRow
              name="preview-immersive"
              label="켬 (헤더 숨김 · 책이 화면을 채움)"
              checked={options.immersive}
              onSelect={() => apply({ immersive: true })}
            />
            <OptionRow
              name="preview-immersive"
              label="끔 (헤더 유지)"
              checked={!options.immersive}
              onSelect={() => apply({ immersive: false })}
            />
          </fieldset>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        // 임시 도구라 **텍스트 버튼(tertiary)** — 읽기 조작보다 눈에 띄면 안 된다.
        className={actionClass("tertiary", "gap-2 px-3", "compact")}
      >
        <span aria-hidden="true">⚙️</span>
        {/* 좁은 화면에서는 하단바 한 줄에 서지 못한다 — 글자를 접고 아이콘만 남긴다. */}
        <span className="hidden sm:inline">보기 설정</span>
        <span className="sr-only sm:hidden">보기 설정</span>
      </button>
    </div>
  );
}
