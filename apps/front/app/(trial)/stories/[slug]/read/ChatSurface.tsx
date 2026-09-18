"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { SPREAD_QUERY } from "@/components/story/readerNav";
import { FOCUS_RING } from "@/components/ui/actionStyles";
import type { ChatSurfaceKind } from "./readerOptions";

/**
 * 대화를 담는 **껍데기**. 내용은 `CharacterChat` 이고 세 후보가 그것을 공유한다.
 *
 * ⭐ **`sheet` 와 `modal` 은 네이티브 `<dialog showModal()>` 이다.** 포커스 트랩·Esc 닫기·top-layer·
 * 배경 inert 를 브라우저가 처리한다 — 직접 구현하면 반드시 한 가지를 빠뜨리고, 라이브러리를 넣으면
 * 새 의존성이 된다(승인 대상). 둘의 차이는 **클래스 문자열뿐이다.**
 *
 * ⚠️ **`dock` 만 문서 흐름 안에 있다.** 책 옆에 나란히 놓이므로 열고 닫을 때 책 폭이 변한다.
 * 좁은 화면에서는 나란히 놓을 자리가 없어 `sheet` 와 같은 바텀 시트로 떨어진다.
 *
 * ⏳ 후보가 정해지면 고르지 않은 클래스와 분기를 지운다(Slice 7 회수 조건).
 */
const CHAT_TITLE = "등장인물에게 물어봐요";

/**
 * ⚠️ **배경을 어둡게 덮지 않는다**(`backdrop:bg-transparent`, 2026-09-14 요청). 대화하면서도 책이 그대로
 * 보여야 한다. 배경은 여전히 inert 라 누르면 닫힌다(아래 `onClick`) — 딤이 없어도 닫힘 경로는 같다.
 */
const DIALOG_BASE =
  "m-0 border border-paper-edge bg-paper p-0 text-ink shadow-xl backdrop:bg-transparent open:flex open:flex-col";

/** 🚫 클래스를 컴포넌트 안에 흩지 않는다 — 후보를 지울 때 한 줄씩 찾아다니게 된다. */
const DIALOG_CLASS: Record<"sheet" | "modal", string> = {
  sheet:
    "fixed inset-x-0 bottom-0 top-auto max-h-[85dvh] w-full max-w-none rounded-t-3xl " +
    // 넓은 화면: 화면 가장자리에 붙이지 않고 위·아래·오른쪽을 32px 띄운 **떠 있는 패널**(R 20).
    "md:inset-y-8 md:left-auto md:right-8 md:h-auto md:max-h-none md:w-[26rem] md:max-w-[calc(100vw-4rem)] md:rounded-[1.25rem]",
  modal: "fixed inset-0 max-h-[85dvh] w-[min(36rem,92vw)] rounded-3xl",
};

/**
 * 지금 화면이 펼침면인가. `dock` 을 나란히 놓을 수 있는지가 여기서 갈린다.
 *
 * ⚠️ 서버 스냅샷은 `true` 다 — 기준 뷰포트가 태블릿 가로이기 때문이다. 하이드레이션 시점에는
 * 대화가 **닫혀 있어** 양쪽이 아무것도 그리지 않으므로 값이 갈려도 화면 차이가 없다.
 */
function useIsSpread(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia(SPREAD_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SPREAD_QUERY).matches,
    () => true,
  );
}

function CloseButton({ onClose, disabled }: { onClose: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClose}
      // 🚫 눌러도 조용히 무시하지 않는다 — 반응이 없으면 고장으로 읽힌다(`ChatLauncher` 와 같은 규칙).
      disabled={disabled}
      // ⚠️ 56px 규약을 지킨다 — 아이가 누르는 버튼이다.
      className={`grid size-touch shrink-0 place-items-center rounded-full text-ink-muted hover:bg-primary-tint hover:text-ink disabled:pointer-events-none disabled:opacity-40 ${FOCUS_RING}`}
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        ✕
      </span>
      <span className="sr-only">대화 닫기</span>
    </button>
  );
}

function SurfaceBody({
  titleId,
  onClose,
  closeDisabled,
  children,
}: {
  titleId: string;
  onClose: () => void;
  closeDisabled: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 id={titleId} className="text-xl font-bold text-ink">
          {CHAT_TITLE}
        </h2>
        <CloseButton onClose={onClose} disabled={closeDisabled} />
      </header>
      {/* 넘치는 대화만 이 안에서 흐른다 — 껍데기가 화면 밖으로 자라지 않는다. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </>
  );
}

export function ChatSurface({
  kind,
  open,
  onClose,
  closeDisabled = false,
  titleId,
  children,
}: {
  kind: ChatSurfaceKind;
  open: boolean;
  onClose: () => void;
  /** 넘김이 도는 동안 `dock` 을 닫으면 책 폭이 변해 종이가 튄다 — 그때만 잠근다. */
  closeDisabled?: boolean;
  titleId: string;
  children: ReactNode;
}) {
  const isSpread = useIsSpread();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // `dock` 은 나란히 놓이므로 dialog 가 아니다. 좁은 화면에서는 자리가 없어 시트로 떨어진다.
  const asDock = kind === "dock" && isSpread;
  const dialogKind: "sheet" | "modal" = kind === "modal" ? "modal" : "sheet";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || asDock) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, asDock]);

  if (asDock) {
    if (!open) return null;
    return (
      <aside
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 shrink-0 flex-col rounded-card border border-paper-edge bg-surface-raised md:sticky md:top-4 md:w-[24rem]"
      >
        <SurfaceBody titleId={titleId} onClose={onClose} closeDisabled={closeDisabled}>
          {children}
        </SurfaceBody>
      </aside>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`${DIALOG_BASE} ${DIALOG_CLASS[dialogKind]}`}
      // Esc 와 바깥 클릭 모두 여기로 모인다 — 닫힘 경로가 하나여야 상태가 어긋나지 않는다.
      onClose={onClose}
      onClick={(event) => {
        // 배경(backdrop)을 누르면 dialog 자신이 대상이 된다. 내용 클릭은 자식이 대상이다.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <SurfaceBody titleId={titleId} onClose={onClose} closeDisabled={closeDisabled}>
        {children}
      </SurfaceBody>
    </dialog>
  );
}
