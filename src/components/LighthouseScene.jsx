import { useEffect, useRef } from 'react';

// Lighthouse storm scene. Visual language copied from the 078-lighthouse-storm-night ref:
// night gradient, moon, drifting clouds, rotating lamp beam, SVG headland + tower, canvas rain.
export default function LighthouseScene({ storm = 0.55 }) {
  const canvasRef = useRef(null);
  const beamRef = useRef(null);
  const waveBackRef = useRef(null);
  const waveFrontRef = useRef(null);
  const foamRef = useRef(null);
  const lampRef = useRef(null);
  const stormRef = useRef(storm);
  stormRef.current = storm;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = 0; let H = 0;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    let angle = 0;
    const drops = [];
    const spray = [];

    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(d) {
      d.x = Math.random() * (W * 1.4) - W * 0.2;
      d.y = -Math.random() * H;
      d.len = 10 + Math.random() * 18;
      d.z = 0.4 + Math.random() * 0.6;
    }

    function wavePath(baseY, amp, tt, phase, segs) {
      let d = `M0 ${baseY.toFixed(1)}`;
      const step = 1600 / segs;
      for (let i = 0; i <= segs; i++) {
        const x = i * step;
        const y = baseY
          + Math.sin(x * 0.006 + tt * 1.3 + phase) * amp
          + Math.sin(x * 0.013 - tt * 2.1 + phase * 2) * amp * 0.5
          + Math.sin(x * 0.031 + tt * 3.7) * amp * 0.18;
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return d;
    }

    function tick(now) {
      const s = stormRef.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const waveSpeed = 0.6 + s * 1.6;
      t += dt * waveSpeed;
      const dropCount = reduce ? 120 : Math.round(60 + s * s * 900);
      const dropSpeed = 900 + s * 1600;
      const windA = 0.05 + s * 0.55;
      const amp = 6 + s * 40;

      if (!reduce) angle = (angle + dt * 38) % 360;
      if (beamRef.current) {
        beamRef.current.style.transform = `rotate(${angle}deg)`;
        const facing = 0.55 + 0.45 * Math.max(0, Math.sin((angle * Math.PI) / 180));
        beamRef.current.style.opacity = facing.toFixed(3);
      }

      if (waveBackRef.current) {
        waveBackRef.current.setAttribute('d', wavePath(650, amp * 0.6, t, 0, 32) + ' L1600 900 L0 900 Z');
      }
      if (waveFrontRef.current && foamRef.current) {
        const front = wavePath(712, amp, t, 1.7, 40);
        waveFrontRef.current.setAttribute('d', front + ' L1600 900 L0 900 Z');
        foamRef.current.setAttribute('d', front);
        foamRef.current.setAttribute('opacity', (0.25 + s * 0.45).toFixed(2));
      }

      while (drops.length < dropCount) { const d = {}; spawn(d); d.y = Math.random() * H; drops.push(d); }
      if (drops.length > dropCount) drops.length = dropCount;

      ctx.clearRect(0, 0, W, H);
      const sinA = Math.sin(windA); const cosA = Math.cos(windA);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of drops) {
        const v = dropSpeed * d.z * dt;
        d.x += sinA * v; d.y += cosA * v;
        if (d.y > H + 20 || d.x > W + 40) spawn(d);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - sinA * d.len * d.z, d.y - cosA * d.len * d.z);
      }
      ctx.strokeStyle = 'rgba(190,215,235,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (!reduce && Math.random() < s * s * 5 * dt * 8) {
        const scale = Math.max(W / 1600, H / 900);
        const offX = (W - 1600 * scale) / 2;
        const offY = H - 900 * scale;
        const cx = offX + (1080 + Math.random() * 120) * scale;
        const cy = offY + 700 * scale;
        for (let k = 0; k < 10; k++) spray.push({ x: cx, y: cy, vx: (Math.random() - 0.7) * 160, vy: -(120 + Math.random() * 260) * (0.6 + s), life: 1 });
      }
      ctx.fillStyle = 'rgba(220,240,245,0.75)';
      for (let i = spray.length - 1; i >= 0; i--) {
        const p = spray[i];
        p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.1;
        if (p.life <= 0) { spray.splice(i, 1); continue; }
        ctx.globalAlpha = p.life * 0.8;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <>
      <div className="moon" aria-hidden="true" />
      <svg className="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <filter id="bk-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18" /></filter>
        </defs>
        <g className="clouds far" fill="#1a2c44" filter="url(#bk-soft)">
          <ellipse cx="200" cy="140" rx="260" ry="60" />
          <ellipse cx="700" cy="90" rx="340" ry="70" />
          <ellipse cx="1250" cy="160" rx="380" ry="80" />
        </g>
      </svg>

      <div className="beam-wrap" style={{ left: '47.5%', top: '52%' }}>
        <div className="beam" ref={beamRef} />
        <div className="lamp-glow" />
      </div>

      <svg className="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs><filter id="bk-soft2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10" /></filter></defs>
        <g className="clouds" fill="#0f1d30" filter="url(#bk-soft2)" opacity="0.9">
          <ellipse cx="100" cy="250" rx="300" ry="55" />
          <ellipse cx="620" cy="210" rx="260" ry="50" />
          <ellipse cx="1100" cy="270" rx="320" ry="60" />
        </g>
      </svg>

      <svg className="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Striped lighthouse on a rocky headland, cottage window lit, waves below">
        <defs>
          <linearGradient id="bk-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d2632" /><stop offset="1" stopColor="#070b12" />
          </linearGradient>
          <linearGradient id="bk-tower" x1="0" x2="1">
            <stop offset="0" stopColor="#6c7480" /><stop offset="0.35" stopColor="#e8ebef" />
            <stop offset="0.7" stopColor="#b3bac4" /><stop offset="1" stopColor="#4c535d" />
          </linearGradient>
          <linearGradient id="bk-stripe" x1="0" x2="1">
            <stop offset="0" stopColor="#5a1c1c" /><stop offset="0.35" stopColor="#c13a34" />
            <stop offset="0.7" stopColor="#9a2c28" /><stop offset="1" stopColor="#3e1212" />
          </linearGradient>
          <linearGradient id="bk-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#10384a" /><stop offset="0.3" stopColor="#0a2a3a" /><stop offset="1" stopColor="#03111b" />
          </linearGradient>
          <linearGradient id="bk-sea2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b4c5e" /><stop offset="0.25" stopColor="#0d3345" /><stop offset="1" stopColor="#020a12" />
          </linearGradient>
          <radialGradient id="bk-win" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0" stopColor="#ffe7a8" /><stop offset="1" stopColor="#e59b2c" />
          </radialGradient>
        </defs>
        <path ref={waveBackRef} fill="url(#bk-sea)" d="M0 640 L1600 640 L1600 900 L0 900 Z" />
        <path fill="url(#bk-rock)" d="M-20 700 L120 690 L230 640 L330 600 L420 560 L520 520 L600 470 L700 430 L790 420 L860 440 L940 470 L1010 520 L1080 600 L1130 650 L1170 700 L1200 900 L-20 900 Z" />
        <g transform="translate(1000 520)">
          <path fill="#0b1119" d="M0 30 L0 -10 L28 -36 L56 -10 L56 30 Z" />
          <rect x="20" y="4" width="14" height="14" rx="1" fill="url(#bk-win)" />
        </g>
        <g transform="translate(760 0)">
          <rect x="-46" y="404" width="92" height="30" rx="3" fill="#1b232d" />
          <path fill="url(#bk-tower)" d="M-34 404 L-24 150 L24 150 L34 404 Z" />
          <clipPath id="bk-clip"><path d="M-34 404 L-24 150 L24 150 L34 404 Z" /></clipPath>
          <g clipPath="url(#bk-clip)" fill="url(#bk-stripe)">
            <rect x="-40" y="182" width="80" height="46" />
            <rect x="-40" y="262" width="80" height="46" />
            <rect x="-40" y="342" width="80" height="46" />
          </g>
          <rect x="-40" y="140" width="80" height="12" rx="2" fill="#2a313b" />
          <rect x="-22" y="86" width="44" height="54" fill="#ffe9b0" opacity="0.9" />
          <ellipse ref={lampRef} cx="0" cy="113" rx="9" ry="12" fill="#fff8e6" />
          <path d="M-26 86 L0 52 L26 86 Z" fill="#1f2730" />
        </g>
        <path ref={waveFrontRef} fill="url(#bk-sea2)" d="M0 700 L1600 700 L1600 900 L0 900 Z" />
        <path ref={foamRef} fill="none" stroke="#dff3f7" strokeWidth="2" opacity="0.5" strokeLinecap="round" d="M0 700 L1600 700" />
      </svg>

      <canvas className="layer" ref={canvasRef} aria-hidden="true" />
      <div className="flash" aria-hidden="true" />
    </>
  );
}
