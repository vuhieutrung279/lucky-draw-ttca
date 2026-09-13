import { useEffect } from 'react';
import logoGenesis from '../imports/logo-genesis.png';

import type { ScreenMode } from '../utils/syncManager';

interface HomePageProps {
  onStart: () => void;
  onViewResults?: () => void;
  hasWonAny?: boolean;
  screenMode?: ScreenMode;
}

// Stardust particles: Pure White & Radiant Gold
const PARTICLES = Array.from({ length: 36 }, (_, i) => {
  const isGold = i % 2 === 0;
  return {
    id: i,
    left: `${(i * 2.78 + 1.5) % 97}%`,
    size: `${0.14 + (i % 5) * 0.09}vw`,
    duration: `${6.5 + (i % 6) * 2.2}s`,
    delay: `${(i * 0.38) % 7.5}s`,
    opacity: 0.35 + (i % 4) * 0.18,
    glow: isGold ? '#f4cb66' : '#ffffff',
  };
});

// Star flare coordinates: Pure White & Warm Gold
const STAR_FLARES = [
  { top: '30%', left: '32%', delay: '0s', duration: '3.2s', size: '1.3vw', color: '#f4cb66' },
  { top: '27%', left: '67%', delay: '1.5s', duration: '4s', size: '1.5vw', color: '#ffffff' },
  { top: '68%', left: '29%', delay: '2.3s', duration: '3.6s', size: '1.2vw', color: '#ffdf79' },
  { top: '66%', left: '70%', delay: '0.8s', duration: '4.4s', size: '1.4vw', color: '#ffffff' },
  { top: '48%', left: '20%', delay: '3.0s', duration: '3.8s', size: '1.3vw', color: '#ffeed6' },
  { top: '47%', left: '78%', delay: '1.2s', duration: '4.2s', size: '1.3vw', color: '#f4cb66' },
];

export default function HomePage({ onStart, screenMode = 'left' }: HomePageProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        onStart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStart]);

  const centerTransform =
    screenMode === 'left'
      ? 'translateX(-11.5vw)'
      : screenMode === 'right'
      ? 'translateX(11.5vw)'
      : 'none';

  return (
    <div
      onClick={onStart}
      className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer bg-transparent"
    >
      {/* Subtle center ambient radial gradient for logo depth */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(244, 203, 102, 0.04) 0%, rgba(4, 7, 20, 0.25) 55%, rgba(4, 7, 20, 0.5) 100%)',
        }}
      />

      {/* Floating Golden/White Stardust Ambient Particle Field */}
      <div className="absolute inset-0 pointer-events-none z-1 overflow-hidden">
        {PARTICLES.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.left,
              bottom: '-5vh',
              width: p.size,
              height: p.size,
              backgroundColor: p.glow,
              boxShadow: `0 0 ${p.size} ${p.glow}`,
              opacity: p.opacity,
              animation: `floatDust ${p.duration} ease-in-out infinite ${p.delay}`,
            }}
          />
        ))}
      </div>

      {/* Central Composition (Centered, Logo stands still) */}
      <div
        className="relative z-10 flex flex-col items-center justify-center pointer-events-none transition-transform duration-500"
        style={{ transform: centerTransform }}
      >
        {/* Rotating Warm Gold & White Radiance Aura behind logo */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-2 animate-nebula-spin"
          style={{
            width: '54vw',
            height: '54vw',
            background: 'radial-gradient(circle, rgba(255, 238, 214, 0.28) 0%, rgba(244, 203, 102, 0.2) 36%, rgba(212, 160, 23, 0.08) 58%, transparent 75%)',
            borderRadius: '50%',
            filter: 'blur(3.5vw)',
          }}
        />

        {/* Expanding Concentric Energy Ripple Waves: White & Gold */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-3 flex items-center justify-center"
          style={{ width: '38vw', height: '18vw' }}
        >
          <div
            className="absolute inset-0 rounded-full border animate-ripple-1 pointer-events-none"
            style={{
              borderColor: 'rgba(244, 203, 102, 0.65)',
              boxShadow: '0 0 2.5vw rgba(244, 203, 102, 0.45), inset 0 0 1.2vw rgba(244, 203, 102, 0.3)',
            }}
          />
          <div
            className="absolute inset-0 rounded-full border animate-ripple-2 pointer-events-none"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.6)',
              boxShadow: '0 0 3vw rgba(255, 255, 255, 0.45), inset 0 0 1.5vw rgba(255, 255, 255, 0.3)',
            }}
          />
          <div
            className="absolute inset-0 rounded-full border animate-ripple-3 pointer-events-none"
            style={{
              borderColor: 'rgba(255, 238, 214, 0.55)',
              boxShadow: '0 0 3.5vw rgba(255, 238, 214, 0.35), inset 0 0 1.8vw rgba(255, 238, 214, 0.25)',
            }}
          />
        </div>

        {/* Orbiting Stardust Satellite Lights: White & Gold */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-4 w-0 h-0 flex items-center justify-center">
          <div
            className="animate-orbit-1"
            style={{
              width: '0.48vw',
              height: '0.48vw',
              borderRadius: '50%',
              backgroundColor: '#ffdf79',
              boxShadow: '0 0 1.2vw #ffdf79, 0 0 2.5vw #e5b324',
            }}
          />
          <div
            className="animate-orbit-2"
            style={{
              width: '0.42vw',
              height: '0.42vw',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 1.2vw #ffffff, 0 0 2.2vw rgba(255, 238, 214, 0.9)',
            }}
          />
        </div>

        {/* Star Flares Twinkling: White & Gold */}
        {STAR_FLARES.map((flare, idx) => (
          <div
            key={idx}
            className="absolute pointer-events-none z-5 flex items-center justify-center"
            style={{
              top: flare.top,
              left: flare.left,
              width: flare.size,
              height: flare.size,
              animation: `starFlare ${flare.duration} ease-in-out infinite ${flare.delay}`,
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: flare.color,
                boxShadow: `0 0 1.5vw ${flare.color}`,
              }}
            />
            {/* Horizontal Flare line */}
            <div
              className="absolute"
              style={{
                width: '280%',
                height: '0.08vw',
                backgroundColor: flare.color,
                boxShadow: `0 0 0.8vw ${flare.color}`,
              }}
            />
            {/* Vertical Flare line */}
            <div
              className="absolute"
              style={{
                height: '280%',
                width: '0.08vw',
                backgroundColor: flare.color,
                boxShadow: `0 0 0.8vw ${flare.color}`,
              }}
            />
          </div>
        ))}

        {/* Main Center Logo (Static, standing still, with Shimmer Sheen) */}
        <div className="relative flex items-center justify-center z-10">
          {/* Main Logo Image */}
          <img
            src={logoGenesis}
            alt="GENESIS"
            style={{
              width: '32vw',
              maxWidth: '980px',
              height: 'auto',
              maxHeight: '12vw',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 2.5vw rgba(255, 238, 214, 0.7)) drop-shadow(0 0 5vw rgba(244, 203, 102, 0.55))',
            }}
          />

          {/* Shimmer Light Sheen passing across logo */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{
              maskImage: `url(${logoGenesis})`,
              WebkitMaskImage: `url(${logoGenesis})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          >
            <div
              className="w-full h-full animate-logo-sheen"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 35%, rgba(255, 255, 255, 0.95) 50%, rgba(244, 203, 102, 0.5) 65%, transparent 100%)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
