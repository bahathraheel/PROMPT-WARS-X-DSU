'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * 3D Globe intro animation using Three.js via canvas.
 * Renders a wireframe sphere with animated particles that
 * spins for 3 seconds before the main app appears.
 */
export default function GlobeIntro() {
  const canvasRef = useRef(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Size canvas
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    };
    resize();

    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.25;

    // Generate globe wireframe points
    const points = [];
    const numLat = 18;
    const numLng = 36;

    for (let i = 0; i <= numLat; i++) {
      const phi = (Math.PI * i) / numLat;
      for (let j = 0; j <= numLng; j++) {
        const theta = (2 * Math.PI * j) / numLng;
        points.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.cos(phi),
          z: radius * Math.sin(phi) * Math.sin(theta),
        });
      }
    }

    // Floating particles
    const particles = Array.from({ length: 80 }, () => ({
      x: (Math.random() - 0.5) * W,
      y: (Math.random() - 0.5) * H,
      z: Math.random() * 400 - 200,
      speed: Math.random() * 0.3 + 0.1,
      size: Math.random() * 2 + 0.5,
    }));

    let rotation = 0;
    let animId;

    const project = (x, y, z) => {
      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);
      const rx = x * cosR - z * sinR;
      const rz = x * sinR + z * cosR;
      const scale = 800 / (800 + rz);
      return {
        px: cx + rx * scale,
        py: cy + y * scale,
        scale,
        z: rz,
      };
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Draw floating particles
      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < -H / 2) p.y = H / 2;

        const proj = project(p.x, p.y, p.z);
        const alpha = Math.max(0, Math.min(0.6, (proj.z + 200) / 400));
        ctx.beginPath();
        ctx.arc(proj.px, proj.py, p.size * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
        ctx.fill();
      }

      // Draw globe wireframe
      for (const p of points) {
        const proj = project(p.x, p.y, p.z);
        if (proj.z > -radius * 0.3) {
          const alpha = Math.max(0.05, Math.min(0.5, (proj.z + radius) / (2 * radius)));
          ctx.beginPath();
          ctx.arc(proj.px, proj.py, 1.2 * proj.scale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
          ctx.fill();
        }
      }

      // Draw connecting lines for nearby points (visible half)
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.06)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < points.length; i += 3) {
        const p1 = project(points[i].x, points[i].y, points[i].z);
        if (p1.z < 0) continue;
        for (let j = i + 1; j < Math.min(i + 4, points.length); j++) {
          const p2 = project(points[j].x, points[j].y, points[j].z);
          if (p2.z < 0) continue;
          ctx.beginPath();
          ctx.moveTo(p1.px, p1.py);
          ctx.lineTo(p2.px, p2.py);
          ctx.stroke();
        }
      }

      // Glow at center
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0.05)');
      gradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.02)');
      gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      rotation += 0.008;
      animId = requestAnimationFrame(draw);
    };

    draw();

    // Trigger fade out before unmount
    const fadeTimer = setTimeout(() => setFadeOut(true), 2800);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div className={`globe-container ${fadeOut ? 'fade-out' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="globe-branding">
        <h1 className="globe-title">SICHER</h1>
        <p className="globe-subtitle">Safety-First Navigation</p>
      </div>
    </div>
  );
}
