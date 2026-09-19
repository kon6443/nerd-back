"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createBookWorld, type BookWorld } from "@/app/book-world";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";
import { fetchStories } from "@/lib/api/story";
import styles from "@/app/HomeWorld.module.css";

type Presentation = { renderer: "loading" | "ready" | "fallback"; entering: boolean };

export function HomeWorld({ children }: { children: ReactNode }) {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const graphicsRef = useRef<HTMLDivElement>(null);
  const startEntryRef = useRef<((href: string) => boolean) | null>(null);
  const presentationRef = useRef<Presentation>({ renderer: "loading", entering: false });
  const [presentation, setPresentation] = useState<Presentation>({ renderer: "loading", entering: false });

  useEffect(() => {
    // route prefetch는 이미지까지 받지 않는다. 첫 두 공개 표지는 홈/진입 연출 중 미리 준비한다.
    const controller = new AbortController();
    void fetchStories(controller.signal).then((stories) => {
      if (controller.signal.aborted) return;
      for (const story of stories.slice(0, 2)) preloadThumbnailImage(story.coverImageUrl);
    }).catch(() => {
      // 미리 받기는 선택적이다. 취소/네트워크 실패 시 서재의 정상 이미지 요청에 맡긴다.
    });
    return () => controller.abort();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const graphicsHost = graphicsRef.current;
    if (!root || !stage || !graphicsHost) return;
    // 각 effect가 자신의 canvas를 소유한다. Strict Mode에서도 이전 context와 공유하지 않는다.
    const canvas = document.createElement("canvas");
    canvas.className = styles.webgl;
    graphicsHost.appendChild(canvas);

    const header = document.querySelector<HTMLElement>("[data-app-header]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let graphics: BookWorld | null = null;
    let disposed = false;
    let frameId = 0;
    let width = 0;
    let height = 0;
    let pointer = { x: 0, y: 0 };
    let targetPointer = { x: 0, y: 0 };
    let finishNavigation: (() => void) | undefined;
    let entry: { href: string; startedAt: number; pointer: typeof pointer; navigated: boolean } | null = null;

    const navigate = (href: string) => {
      if (reducedMotion.matches || !document.startViewTransition) {
        router.push(href);
        return;
      }
      // 새 라우트가 실제로 commit된 뒤 캡처한다. 고정 시간으로 로딩 완료를 추측하지 않는다.
      document.documentElement.classList.add(styles.transition);
      const transition = document.startViewTransition(() => new Promise<void>((resolve) => {
        if (disposed) { resolve(); return; }
        finishNavigation = resolve;
        router.push(href);
      }));
      const clearTransition = () => document.documentElement.classList.remove(styles.transition);
      void transition.ready.catch(() => { /* 캡처를 지원하지 않아도 라우트 이동은 진행한다. */ });
      void transition.finished.then(clearTransition, clearTransition);
    };

    const update = () => {
      frameId = 0;
      if (disposed || document.hidden) return;
      if (reducedMotion.matches || !finePointer.matches) pointer = targetPointer = { x: 0, y: 0 };
      pointer.x += (targetPointer.x - pointer.x) * 0.12;
      pointer.y += (targetPointer.y - pointer.y) * 0.12;
      let progress = entry ? Math.min(1, (performance.now() - entry.startedAt) / 1450) : 0;
      if (entry && (reducedMotion.matches || !graphics)) progress = 1;
      let renderer: Presentation["renderer"] = "fallback";
      if (graphics) {
        try {
          if (graphics.render({ entry: progress, width, height, pointerX: entry?.pointer.x ?? pointer.x, pointerY: entry?.pointer.y ?? pointer.y })) renderer = "ready";
        } catch {
          graphics.dispose();
          graphics = null;
        }
      }
      if (entry && renderer !== "ready") progress = 1;
      const wash = Math.max(0, Math.min(1, (progress - 0.82) / 0.18));
      root.style.setProperty("--entry-wash", String(wash * wash * (3 - 2 * wash)));
      root.dataset.renderer = renderer;
      root.dataset.entering = String(entry !== null);
      const previous = presentationRef.current;
      if (previous.renderer !== renderer || previous.entering !== (entry !== null)) {
        presentationRef.current = { renderer, entering: entry !== null };
        setPresentation(presentationRef.current);
      }
      if (entry && !entry.navigated) {
        if (progress >= 1) {
          entry.navigated = true;
          navigate(entry.href);
        } else schedule();
      } else if (!entry && (Math.abs(targetPointer.x - pointer.x) > 0.001 || Math.abs(targetPointer.y - pointer.y) > 0.001)) {
        schedule();
      }
    };
    const schedule = () => {
      if (!disposed && !frameId && !document.hidden) frameId = window.requestAnimationFrame(update);
    };
    const resize = () => {
      root.style.setProperty("--header-height", `${header?.getBoundingClientRect().height ?? 0}px`);
      width = stage.clientWidth;
      height = stage.clientHeight;
      schedule();
    };
    const movePointer = (event: PointerEvent) => {
      if (entry || reducedMotion.matches || !finePointer.matches || event.pointerType === "touch") return;
      const bounds = stage.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      targetPointer = {
        x: Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)),
        y: Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)),
      };
      schedule();
    };
    const resetPointer = () => { targetPointer = { x: 0, y: 0 }; schedule(); };
    const visibilityChanged = () => {
      if (document.hidden) { window.cancelAnimationFrame(frameId); frameId = 0; }
      else schedule();
    };
    const contextLost = (event: Event) => { event.preventDefault(); schedule(); };
    const cancelEntry = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !entry || entry.navigated) return;
      entry = null;
      schedule();
    };
    startEntryRef.current = (href) => {
      if (entry) return true;
      if (reducedMotion.matches || !graphics || root.dataset.renderer !== "ready") return false;
      entry = { href, startedAt: performance.now(), pointer: { ...pointer }, navigated: false };
      router.prefetch(href);
      schedule();
      return true;
    };

    // 초기 client bundle과 함께 로드하고 첫 프레임 전에 준비한다. 이미지/스크롤 로딩 단계가 없다.
    try { graphics = createBookWorld(canvas); } catch { graphics = null; }
    const resizeObserver = new ResizeObserver(resize);
    if (header) resizeObserver.observe(header);
    resizeObserver.observe(stage);
    window.addEventListener("resize", resize);
    window.addEventListener("blur", resetPointer);
    window.addEventListener("keydown", cancelEntry);
    document.addEventListener("visibilitychange", visibilityChanged);
    reducedMotion.addEventListener("change", resetPointer);
    finePointer.addEventListener("change", resetPointer);
    stage.addEventListener("pointermove", movePointer, { passive: true });
    stage.addEventListener("pointerleave", resetPointer);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", schedule);
    resize();

    return () => {
      disposed = true;
      startEntryRef.current = null;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", resetPointer);
      window.removeEventListener("keydown", cancelEntry);
      document.removeEventListener("visibilitychange", visibilityChanged);
      reducedMotion.removeEventListener("change", resetPointer);
      finePointer.removeEventListener("change", resetPointer);
      stage.removeEventListener("pointermove", movePointer);
      stage.removeEventListener("pointerleave", resetPointer);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", schedule);
      graphics?.dispose();
      graphics = null;
      canvas.remove();
      entry = null;
      finishNavigation?.();
      finishNavigation = undefined;
    };
  }, [router]);

  function enterStory(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor || !event.currentTarget.contains(anchor) || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const destination = new URL(anchor.href);
    if (destination.origin !== window.location.origin || !["http:", "https:"].includes(destination.protocol)) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (startEntryRef.current?.(destination.href)) event.preventDefault();
  }

  return (
    <main ref={rootRef} className={styles.world} data-renderer={presentation.renderer} data-entering={presentation.entering} aria-label="베이비북스">
      <div ref={stageRef} className={styles.stage}>
        <div ref={graphicsRef} className={styles.graphics} aria-hidden="true" />
        <p className={styles.loading} aria-hidden="true">동화책을 펼치고 있어요</p>
        {presentation.renderer === "fallback" && (
          <div className={styles.fallback} aria-hidden="true">
            <Image src="/images/home-world/magic-book.webp" alt="" fill unoptimized loading="eager" sizes="100vw" className={styles.image} />
          </div>
        )}
        <div className={styles.content}>
          <div className={styles.copy}>
            <h1 className={styles.title}><span>한 권의 책에서,</span><span>커다란 모험으로.</span></h1>
            <p className={styles.description}><span>버튼을 눌러 책 속으로 들어가 보세요.</span> <span>내 사진 한 장이면 동화 속 주인공이 돼요.</span></p>
          </div>
          <div className={styles.actions} aria-busy={presentation.entering || undefined}>
            <div className={styles.actionLinks} onClickCapture={enterStory}>{children}</div>
          </div>
        </div>
        <div className={styles.entryWash} aria-hidden="true" />
      </div>
      <p className="sr-only" role="status">{presentation.entering ? "동화 속으로 들어가고 있어요." : ""}</p>
    </main>
  );
}
