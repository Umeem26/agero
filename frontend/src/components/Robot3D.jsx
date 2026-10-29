import { useEffect, useRef } from 'react';

/* ── Logo SVG Component ── */
export function AgeroLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Hexagonal wire with inner node connections */}
      <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" stroke="var(--accent)" strokeWidth="1.8" fill="none" />
      <path d="M20 4 L20 36 M6 12 L34 28 M34 12 L6 28" stroke="var(--accent)" strokeWidth="0.8" opacity="0.4" />
      <circle cx="20" cy="4" r="2.5" fill="var(--accent)" />
      <circle cx="34" cy="12" r="2" fill="var(--text-dim)" />
      <circle cx="34" cy="28" r="2" fill="var(--text-dim)" />
      <circle cx="20" cy="36" r="2.5" fill="var(--rose)" />
      <circle cx="6" cy="28" r="2" fill="var(--text-dim)" />
      <circle cx="6" cy="12" r="2" fill="var(--text-dim)" />
      <circle cx="20" cy="20" r="3.5" fill="var(--accent)" />
    </svg>
  );
}
export function Robot3D() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 500 * dpr;
    canvas.height = 500 * dpr;
    canvas.style.width = '500px';
    canvas.style.height = '500px';
    ctx.scale(dpr, dpr);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseRef.current = {
        x: (e.clientX - cx) / (rect.width / 2),
        y: (e.clientY - cy) / (rect.height / 2)
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 3D wireframe head coordinates (scaled up by 1.5x for larger display)
    const baseVertices = [
      // Outer Ring / Shield
      { x: -75, y: -90, z: -30 }, { x: 75, y: -90, z: -30 },
      { x: 90, y: 45, z: -30 }, { x: 0, y: 105, z: -30 }, { x: -90, y: 45, z: -30 },
      // Inner face plate
      { x: -52, y: -52, z: 45 }, { x: 52, y: -52, z: 45 },
      { x: 60, y: 22, z: 52 }, { x: 0, y: 75, z: 60 }, { x: -60, y: 22, z: 52 },
      // Glowing Eye Nodes
      { x: -24, y: -18, z: 54 }, { x: 24, y: -18, z: 54 },
      // Top antenna / core transmitter
      { x: 0, y: -120, z: 0 }, { x: 0, y: -90, z: 0 }
    ];

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], // Outer head loop
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 5], // Inner face loop
      [0, 5], [1, 6], [2, 7], [3, 8], [4, 9], // Connection struts
      [12, 13] // Antenna
    ];

    // Orbiting particles (scaled outer orbit)
    const particles = Array.from({ length: 55 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 110 + Math.random() * 40,
      speed: 0.006 + Math.random() * 0.01,
      yOffset: -80 + Math.random() * 160,
      size: 1.2 + Math.random() * 2.0
    }));

    let rotX = 0;
    let rotY = 0;
    let animFrame;

    const render = () => {
      ctx.clearRect(0, 0, 500, 500);

      // Smoothly interpolate rotation to target mouse coordinates
      rotY += (mouseRef.current.x * 0.45 - rotY) * 0.08;
      rotX += (mouseRef.current.y * -0.45 - rotX) * 0.08;

      // Base auto-rotation offset
      const autoRot = Date.now() * 0.0003;
      const angleY = rotY + autoRot;
      const angleX = rotX;

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const project = (v) => {
        // Rotate Y
        let x1 = v.x * cosY - v.z * sinY;
        let z1 = v.x * sinY + v.z * cosY;
        // Rotate X
        let y2 = v.y * cosX - z1 * sinX;
        let z2 = v.y * sinX + z1 * cosX;

        // Perspective projection
        const dist = 320;
        const scale = dist / (dist + z2);
        return {
          x: 250 + x1 * scale,
          y: 250 + y2 * scale,
          depth: z2
        };
      };

      // Draw Orbiting Torus Rings
      ctx.strokeStyle = 'rgba(17, 100, 102, 0.22)';
      ctx.lineWidth = 1;
      for (let r = 0; r < 2; r++) {
        ctx.beginPath();
        const tilt = r === 0 ? 0.35 : -0.35;
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.15) {
          const pt = project({
            x: Math.cos(a) * 140,
            y: Math.sin(a) * tilt * 140,
            z: Math.sin(a) * 140
          });
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Draw projected edges
      edges.forEach(([u, v]) => {
        const p1 = project(baseVertices[u]);
        const p2 = project(baseVertices[v]);
        
        // Depth-aware coloring (Teal and warm peach highlights)
        const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
        grad.addColorStop(0, p1.depth > 0 ? 'rgba(17, 100, 102, 0.35)' : 'rgba(255, 203, 154, 0.7)');
        grad.addColorStop(1, p2.depth > 0 ? 'rgba(17, 100, 102, 0.35)' : 'rgba(255, 203, 154, 0.7)');
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = p1.depth > 0 ? 1.0 : 1.8;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw Face polygon sheets (semitransparent glass fill)
      ctx.fillStyle = 'rgba(17, 100, 102, 0.08)';
      ctx.beginPath();
      const faceVerts = [5, 6, 7, 8, 9].map(i => project(baseVertices[i]));
      ctx.moveTo(faceVerts[0].x, faceVerts[0].y);
      for (let i = 1; i < faceVerts.length; i++) ctx.lineTo(faceVerts[i].x, faceVerts[i].y);
      ctx.closePath();
      ctx.fill();

      // Draw Eyes (Glowing Core nodes)
      [10, 11].forEach(i => {
        const pt = project(baseVertices[i]);
        // Glow layer
        const glow = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 14);
        glow.addColorStop(0, '#FFCB9A');
        glow.addColorStop(0.3, 'rgba(255, 203, 154, 0.8)');
        glow.addColorStop(1, 'rgba(255, 203, 154, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Top Antenna Core node
      const ant = project(baseVertices[12]);
      const glowAnt = ctx.createRadialGradient(ant.x, ant.y, 1, ant.x, ant.y, 16);
      glowAnt.addColorStop(0, '#D1E8E2');
      glowAnt.addColorStop(0.4, 'rgba(209, 232, 226, 0.7)');
      glowAnt.addColorStop(1, 'rgba(209, 232, 226, 0)');
      ctx.fillStyle = glowAnt;
      ctx.beginPath();
      ctx.arc(ant.x, ant.y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Update and Draw revolving digital particles
      particles.forEach(p => {
        p.angle += p.speed;
        const pt = project({
          x: Math.cos(p.angle) * p.radius,
          y: p.yOffset,
          z: Math.sin(p.angle) * p.radius
        });

        ctx.fillStyle = pt.depth > 0 ? 'rgba(17, 100, 102, 0.35)' : 'rgba(209, 232, 226, 0.85)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Holographic scanlines overlay
      ctx.strokeStyle = 'rgba(23, 29, 27, 0.12)';
      ctx.lineWidth = 1;
      for (let y = 6; y < 500; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(500, y);
        ctx.stroke();
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '500px', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(17, 100, 102, 0.15) 0%, transparent 70%)', filter: 'blur(16px)', pointerEvents: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'auto' }} />
    </div>
  );
}
