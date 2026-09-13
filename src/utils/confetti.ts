interface Particle {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  rotation3D: number;
  rotation3DSpeed: number;
  color: string;
  alpha: number;
  decay: number;
  wobble: number;
  wobbleSpeed: number;
}

export function fireWhitePaperConfetti(canvas: HTMLCanvasElement | null, durationMs = 3500) {
  if (!canvas) return () => {};

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const particles: Particle[] = [];
  const count = 180;

  const WHITE_SHADES = [
    '#ffffff',
    '#f8f9fa',
    '#f1f3f5',
    '#ffffff',
    '#e9ecef',
    '#fffdfa',
    '#fefae0',
    '#ffffff',
    '#f3f0ff',
    '#fafafa'
  ];

  const origins = [
    { x: width * 0.15, y: height * 0.95, angleMin: -80, angleMax: -40, speedMin: 18, speedMax: 32 },
    { x: width * 0.5, y: height * 0.98, angleMin: -110, angleMax: -70, speedMin: 20, speedMax: 36 },
    { x: width * 0.85, y: height * 0.95, angleMin: -140, angleMax: -100, speedMin: 18, speedMax: 32 },
  ];

  origins.forEach(origin => {
    const pCount = Math.floor(count / origins.length);
    for (let i = 0; i < pCount; i++) {
      const angleDeg = origin.angleMin + Math.random() * (origin.angleMax - origin.angleMin);
      const angleRad = (angleDeg * Math.PI) / 180;
      const speed = origin.speedMin + Math.random() * (origin.speedMax - origin.speedMin);

      const pWidth = 8 + Math.random() * 12;
      const pHeight = 14 + Math.random() * 18;

      particles.push({
        x: origin.x + (Math.random() - 0.5) * 40,
        y: origin.y,
        width: pWidth,
        height: pHeight,
        vx: Math.cos(angleRad) * speed,
        vy: Math.sin(angleRad) * speed,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        rotation3D: Math.random() * Math.PI * 2,
        rotation3DSpeed: 0.05 + Math.random() * 0.1,
        color: WHITE_SHADES[Math.floor(Math.random() * WHITE_SHADES.length)],
        alpha: 1,
        decay: 0.003 + Math.random() * 0.004,
        wobble: Math.random() * 10,
        wobbleSpeed: 0.04 + Math.random() * 0.06,
      });
    }
  });

  let animationId: number;
  const startTime = performance.now();
  let isRunning = true;

  const render = (now: number) => {
    if (!isRunning) return;

    ctx.clearRect(0, 0, width, height);

    const elapsed = now - startTime;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      p.vy += 0.42;
      p.vx *= 0.985;
      p.vy *= 0.985;

      p.wobble += p.wobbleSpeed;
      p.x += p.vx + Math.sin(p.wobble) * 1.2;
      p.y += p.vy;

      p.rotation += p.rotationSpeed;
      p.rotation3D += p.rotation3DSpeed;

      if (elapsed > durationMs * 0.6) {
        p.alpha -= p.decay * 2.2;
      }

      if (p.alpha <= 0 || p.y > height + 50) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(Math.cos(p.rotation3D), 1);

      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;

      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 4;

      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);

      ctx.restore();
    }

    if (elapsed < durationMs) {
      animationId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  };

  animationId = requestAnimationFrame(render);

  return () => {
    isRunning = false;
    cancelAnimationFrame(animationId);
    if (ctx) ctx.clearRect(0, 0, width, height);
  };
}
