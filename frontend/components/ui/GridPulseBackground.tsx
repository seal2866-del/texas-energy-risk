"use client";
import { useEffect, useRef } from "react";

interface Pulse {
  x: number;
  y: number;
  progress: number;
  speed: number;
  axis: "h" | "v";
  length: number;
  opacity: number;
}

export default function GridPulseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Capture as non-null locals so closures satisfy TypeScript strict null checks
    const cv: HTMLCanvasElement = canvas;
    const cx: CanvasRenderingContext2D = ctx;

    let animId: number;
    const pulses: Pulse[] = [];
    const GRID = 90;

    function resize() {
      cv.width  = window.innerWidth;
      cv.height = document.documentElement.scrollHeight;
    }

    function spawnPulse() {
      const cols = Math.floor(cv.width  / GRID);
      const rows = Math.floor(cv.height / GRID);
      const axis = Math.random() > 0.5 ? "h" : "v";
      if (axis === "h") {
        const row = (Math.floor(Math.random() * rows) + 1) * GRID;
        pulses.push({ x: -20, y: row, progress: -20, speed: 0.4 + Math.random() * 0.5, axis, length: cv.width + 40, opacity: 0.5 + Math.random() * 0.5 });
      } else {
        const col = (Math.floor(Math.random() * cols) + 1) * GRID;
        pulses.push({ x: col, y: -20, progress: -20, speed: 0.3 + Math.random() * 0.4, axis, length: cv.height + 40, opacity: 0.5 + Math.random() * 0.5 });
      }
    }

    function draw() {
      cx.clearRect(0, 0, cv.width, cv.height);

      const cols = Math.ceil(cv.width  / GRID);
      const rows = Math.ceil(cv.height / GRID);

      // Grid lines
      cx.strokeStyle = "rgba(30, 58, 138, 0.18)";
      cx.lineWidth = 0.5;
      for (let c = 1; c <= cols; c++) {
        cx.beginPath();
        cx.moveTo(c * GRID, 0);
        cx.lineTo(c * GRID, cv.height);
        cx.stroke();
      }
      for (let r = 1; r <= rows; r++) {
        cx.beginPath();
        cx.moveTo(0, r * GRID);
        cx.lineTo(cv.width, r * GRID);
        cx.stroke();
      }

      // Glowing nodes at intersections
      for (let c = 1; c <= cols; c++) {
        for (let r = 1; r <= rows; r++) {
          const nx = c * GRID;
          const ny = r * GRID;
          const grd = cx.createRadialGradient(nx, ny, 0, nx, ny, 4);
          grd.addColorStop(0, "rgba(59, 130, 246, 0.35)");
          grd.addColorStop(1, "rgba(59, 130, 246, 0)");
          cx.fillStyle = grd;
          cx.beginPath();
          cx.arc(nx, ny, 4, 0, Math.PI * 2);
          cx.fill();
        }
      }

      // Pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.progress += p.speed;

        const px = p.axis === "h" ? p.progress : p.x;
        const py = p.axis === "v" ? p.progress : p.y;

        // Trail
        const trailLen = 60;
        const trailGrad = p.axis === "h"
          ? cx.createLinearGradient(px - trailLen, py, px, py)
          : cx.createLinearGradient(px, py - trailLen, px, py);
        trailGrad.addColorStop(0, "rgba(59, 130, 246, 0)");
        trailGrad.addColorStop(1, `rgba(96, 165, 250, ${0.35 * p.opacity})`);
        cx.strokeStyle = trailGrad;
        cx.lineWidth = 1.2;
        cx.beginPath();
        if (p.axis === "h") { cx.moveTo(px - trailLen, py); cx.lineTo(px, py); }
        else                 { cx.moveTo(px, py - trailLen); cx.lineTo(px, py); }
        cx.stroke();

        // Glow halo
        const halo = cx.createRadialGradient(px, py, 0, px, py, 14);
        halo.addColorStop(0, `rgba(147, 197, 253, ${0.5  * p.opacity})`);
        halo.addColorStop(0.5, `rgba(59, 130, 246, ${0.15 * p.opacity})`);
        halo.addColorStop(1,  "rgba(59, 130, 246, 0)");
        cx.fillStyle = halo;
        cx.beginPath();
        cx.arc(px, py, 14, 0, Math.PI * 2);
        cx.fill();

        // Core dot
        cx.fillStyle = `rgba(186, 230, 253, ${0.85 * p.opacity})`;
        cx.beginPath();
        cx.arc(px, py, 1.8, 0, Math.PI * 2);
        cx.fill();

        if (p.progress > p.length) pulses.splice(i, 1);
      }

      if (Math.random() < 0.006 && pulses.length < 7) spawnPulse();
      animId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 4; i++) spawnPulse();
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0, opacity: 0.55,
      }}
    />
  );
}
