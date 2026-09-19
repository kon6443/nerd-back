"use client";

import { memo, useEffect, useRef } from "react";
import { StoryBookScene } from "@/components/story/StoryBookScene";
import type { JourneyWorld } from "./journeyWorld";
import { JOURNEY_CAPTIONS, type JourneyStage } from "./journeyTimeline";
import styles from "./StoryJourneyScene.module.css";

export const StoryJourneyScene = memo(function StoryJourneyScene({ paused = false }: { paused?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const detailRef = useRef<HTMLParagraphElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const syncMotionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let world: JourneyWorld | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let disposed = false;
    let visible = true;
    let frameId = 0;
    let previousTime = 0;
    let lastRender = 0;
    let elapsed = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let stage: JourneyStage | null = null;
    let flash = -1;
    let pointerDown: { x: number; y: number; id: number } | null = null;

    const stop = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previousTime = 0;
      lastRender = 0;
    };
    const fallback = () => {
      stop();
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      world?.dispose();
      world = null;
      canvas?.remove();
      container.dataset.renderer = "fallback";
      if (flashRef.current) flashRef.current.style.opacity = "0";
      if (captionRef.current) captionRef.current.textContent = "동화나라로 가는 길";
      if (detailRef.current) detailRef.current.textContent = "잠시만 기다려 주세요. 이야기를 준비하고 있어요.";
    };
    const draw = () => {
      try {
        const pose = world?.render(reducedMotion.matches ? 18 : elapsed, pointerX, pointerY);
        if (!pose) return;
        if (stage !== pose.stage) {
          stage = pose.stage;
          container.dataset.stage = stage;
          if (captionRef.current) captionRef.current.textContent = JOURNEY_CAPTIONS[stage].title;
          if (detailRef.current) detailRef.current.textContent = JOURNEY_CAPTIONS[stage].detail;
        }
        const nextFlash = reducedMotion.matches || pausedRef.current ? 0 : pose.flash;
        if (flash !== nextFlash && flashRef.current) {
          flash = nextFlash;
          flashRef.current.style.opacity = String(flash);
        }
      } catch {
        fallback();
      }
    };
    const canAnimate = () => !disposed && !!world && visible && !document.hidden && !pausedRef.current && !reducedMotion.matches;
    const frame = (time: number) => {
      frameId = 0;
      if (!canAnimate()) return;
      if (previousTime) elapsed += Math.min(time - previousTime, 100) / 1000;
      previousTime = time;
      if (time - lastRender >= 1000 / 60 - 0.5) {
        pointerX += (targetX - pointerX) * 0.12;
        pointerY += (targetY - pointerY) * 0.12;
        draw();
        lastRender = time;
      }
      if (canAnimate()) frameId = requestAnimationFrame(frame);
    };
    const syncMotion = () => {
      stop();
      if (disposed || !world || !visible || document.hidden) return;
      if (reducedMotion.matches || pausedRef.current) {
        pointerX = pointerY = targetX = targetY = 0;
      }
      draw();
      if (canAnimate()) frameId = requestAnimationFrame(frame);
    };
    syncMotionRef.current = syncMotion;
    const resize = () => {
      if (!world || disposed) return;
      world.resize(container.clientWidth, container.clientHeight);
      syncMotion();
    };
    const onPointerMove = (event: PointerEvent) => {
      if ((!finePointer.matches && !pointerDown) || reducedMotion.matches || pausedRef.current) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onPointerLeave = () => { targetX = targetY = 0; };
    const onPointerDown = (event: PointerEvent) => {
      if (reducedMotion.matches || pausedRef.current) return;
      pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (pointerDown?.id === event.pointerId && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 10
        && !reducedMotion.matches && !pausedRef.current) world?.burst();
      pointerDown = null;
      if (!finePointer.matches) onPointerLeave();
    };
    const onPointerCancel = () => { pointerDown = null; onPointerLeave(); };
    function onContextLost(event: Event) {
      event.preventDefault();
      fallback();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncMotion();
    });
    visibility.observe(container);
    document.addEventListener("visibilitychange", syncMotion);
    reducedMotion.addEventListener("change", syncMotion);
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerCancel, { passive: true });

    // The reader itself does not need Three.js; load it only while this scene is mounted.
    void import("./journeyWorld").then(({ createJourneyWorld }) => {
      if (disposed) return;
      canvas = document.createElement("canvas");
      canvas.className = styles.canvas;
      canvas.dataset.scene = "story-journey-cinematic";
      container.appendChild(canvas);
      try {
        world = createJourneyWorld(canvas);
        canvas.addEventListener("webglcontextlost", onContextLost);
        resize();
        if (world) container.dataset.renderer = "ready";
      } catch {
        fallback();
      }
    }).catch(() => { if (!disposed) fallback(); });

    return () => {
      disposed = true;
      syncMotionRef.current = null;
      stop();
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", syncMotion);
      reducedMotion.removeEventListener("change", syncMotion);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      world?.dispose();
      canvas?.remove();
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    syncMotionRef.current?.();
  }, [paused]);

  return (
    <div ref={containerRef} className={styles.container} aria-hidden="true">
      <div className={styles.fallback}><StoryBookScene /></div>
      <div ref={flashRef} className={styles.flash} />
      <div className={styles.caption}>
        <p ref={captionRef} className={styles.captionTitle}>{JOURNEY_CAPTIONS.selfie.title}</p>
        <p ref={detailRef} className={styles.captionDetail}>{JOURNEY_CAPTIONS.selfie.detail}</p>
      </div>
    </div>
  );
});
