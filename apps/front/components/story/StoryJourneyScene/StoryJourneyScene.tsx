"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createJourneyWorld, type JourneyWorld } from "./journeyWorld";
import styles from "./StoryJourneyScene.module.css";

interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  shape: string;
}

const SPARKLE_COLORS = ["#fde047", "#f472b6", "#a78bfa", "#67e8f9", "#ffffff"];
const SPARKLE_SHAPES = ["✨", "⭐", "🌟", "💫", "🪄"];

export function StoryJourneyScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [flash, setFlash] = useState(false);
  const [sparkles, setSparkles] = useState<SparkleParticle[]>([]);

  // 포인터 좌표 정규화 (-1 ~ 1)
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let world: JourneyWorld | null = null;
    let animId = 0;

    try {
      world = createJourneyWorld(canvas, (active) => setFlash(active));
    } catch (err) {
      console.warn("WebGL 초기화 실패:", err);
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      world?.resize(width, height);
    });
    resizeObserver.observe(container);

    // 렌더 루프
    const loop = () => {
      world?.render(pointerRef.current.x, pointerRef.current.y);
      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      world?.dispose();
    };
  }, []);

  // 마우스/터치 이동에 따른 시점 반응
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointerRef.current = { x, y };
  };

  // 화면 터치/클릭 시 손가락 끝에서 퐁퐁 터지는 별가루 인터랙션
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const newSparkles: SparkleParticle[] = Array.from({ length: 6 }).map((_, i) => {
      const angle = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 30 + Math.random() * 45;
      return {
        id: Date.now() + Math.random() + i,
        x: clickX,
        y: clickY,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        shape: SPARKLE_SHAPES[Math.floor(Math.random() * SPARKLE_SHAPES.length)],
      };
    });

    setSparkles((prev) => [...prev.slice(-18), ...newSparkles]);
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* 찰칵 플래시 화이트아웃 */}
      <div className={`${styles.flashOverlay} ${flash ? styles.flashActive : ""}`} />

      {/* 터치 별가루 파티클 */}
      {sparkles.map((sp) => (
        <span
          key={sp.id}
          className={styles.sparklePop}
          style={
            {
              left: `${sp.x}px`,
              top: `${sp.y}px`,
              "--dx": `${sp.dx}px`,
              "--dy": `${sp.dy}px`,
              color: sp.color,
            } as React.CSSProperties
          }
        >
          {sp.shape}
        </span>
      ))}
    </div>
  );
}
