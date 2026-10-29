/**
 * Animazione coriandoli su canvas, leggera e senza dipendenze esterne.
 * Si autodistrugge al termine dell'animazione e rispetta le impostazioni di accessibilità di sistema.
 */

const COLORS = ['#fbbf24', '#f59e0b', '#34d399', '#38bdf8', '#f472b6', '#fb923c', '#a78bfa'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  color: string;
  shape: 'rect' | 'circle';
}

export function fireConfetti(options: { particles?: number; duration?: number } = {}) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const count = options.particles ?? 100;
  const duration = options.duration ?? 2500;

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const particles: Particle[] = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
    const speed = 10 + Math.random() * 8;
    return {
      x: fromLeft ? width * 0.15 : width * 0.85,
      y: height * 0.85,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
    };
  });

  const startTime = performance.now();

  function render(now: number) {
    const elapsed = now - startTime;
    const progress = elapsed / duration;

    if (progress >= 1 || !ctx) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, width, height);
    const gravity = 0.32;
    const drag = 0.985;
    const opacity = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

    for (const p of particles) {
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

/**
 * Lancia 2 raffiche di coriandoli intervallate (doppia celebrazione), poi si ferma.
 */
export function fireDoubleConfetti() {
  fireConfetti({ particles: 75, duration: 2400 });
  setTimeout(() => {
    fireConfetti({ particles: 75, duration: 2400 });
  }, 450);
}
