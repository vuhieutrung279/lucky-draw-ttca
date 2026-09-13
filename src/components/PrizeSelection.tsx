import { useEffect } from 'react';
import { PRIZE_CONFIGS, type PrizeKey } from '../data/participants';
import goldPodiumImg from '../imports/gold-podium.png';
import circleImg from '../imports/circle.png';
import ankerImg from '../imports/anker.png';
import airpodImg from '../imports/airpod.png';
import watchImg from '../imports/apple-watch.png';
import ipadImg from '../imports/ipad.png';
import iphoneImg from '../imports/iphone.png';
import type { WonRecord } from '../utils/exportExcel';
import type { ScreenMode } from '../utils/syncManager';

interface PrizeSelectionProps {
  onSelectPrize: (prizeKey: PrizeKey) => void;
  onBackToHome: () => void;
  onGoToSummary: () => void;
  allWinnersHistory: WonRecord[];
  screenMode?: ScreenMode;
}

const PRODUCT_IMAGES: Record<PrizeKey, string> = {
  consolation: ankerImg,
  third: airpodImg,
  second: watchImg,
  first: ipadImg,
  grand: iphoneImg,
};

// Visual ordering: [Giải Ba] -> [Giải Nhất] -> [Giải Đặc Biệt] -> [Giải Nhì] -> [Giải Khuyến Khích]
const DISPLAY_ORDER: PrizeKey[] = ['third', 'first', 'grand', 'second', 'consolation'];

// Stepped podium elevations: Grand (center) is highest, First (left) is 2nd, Second (right) is 3rd, Third & Consolation at base
const TIER_LAYOUT: Record<
  PrizeKey,
  {
    marginBottom: string;
    productHeight: string;
    productMaxW: string;
    cardWidth: string;
    podiumWidth: string;
    podiumHeight: string;
    auraSize: string;
    circleWidth: string;
    glowWidth: string;
  }
> = {
  grand: {
    marginBottom: '2.4vw',
    productHeight: '8.0vw',
    productMaxW: '8.2vw',
    cardWidth: '13.0vw',
    podiumWidth: '11.0vw',
    podiumHeight: '3.4vw',
    auraSize: '13.5vw',
    circleWidth: '12.2vw',
    glowWidth: '10.8vw',
  },
  first: {
    marginBottom: '1.2vw',
    productHeight: '7.4vw',
    productMaxW: '7.6vw',
    cardWidth: '12.4vw',
    podiumWidth: '10.4vw',
    podiumHeight: '3.1vw',
    auraSize: '12.8vw',
    circleWidth: '11.4vw',
    glowWidth: '10.0vw',
  },
  second: {
    marginBottom: '0.8vw',
    productHeight: '7.0vw',
    productMaxW: '7.2vw',
    cardWidth: '12.0vw',
    podiumWidth: '10.0vw',
    podiumHeight: '2.9vw',
    auraSize: '12.2vw',
    circleWidth: '11.0vw',
    glowWidth: '9.6vw',
  },
  third: {
    marginBottom: '0vw',
    productHeight: '6.6vw',
    productMaxW: '6.8vw',
    cardWidth: '11.4vw',
    podiumWidth: '9.5vw',
    podiumHeight: '2.7vw',
    auraSize: '11.5vw',
    circleWidth: '10.4vw',
    glowWidth: '9.0vw',
  },
  consolation: {
    marginBottom: '0vw',
    productHeight: '6.6vw',
    productMaxW: '6.8vw',
    cardWidth: '11.4vw',
    podiumWidth: '9.5vw',
    podiumHeight: '2.7vw',
    auraSize: '11.5vw',
    circleWidth: '10.4vw',
    glowWidth: '9.0vw',
  },
};

export default function PrizeSelection({
  onSelectPrize,
  onBackToHome,
  onGoToSummary,
  allWinnersHistory,
  screenMode = 'left',
}: PrizeSelectionProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') {
        onSelectPrize('grand');
      } else if (e.key === '2') {
        onSelectPrize('first');
      } else if (e.key === '3') {
        onSelectPrize('second');
      } else if (e.key === '4') {
        onSelectPrize('third');
      } else if (e.key === '5') {
        onSelectPrize('consolation');
      } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        const firstIncomplete = PRIZE_CONFIGS.find(cfg => {
          const wins = allWinnersHistory.filter(w => w.prizeKey === cfg.key);
          return wins.length < cfg.count;
        });
        if (firstIncomplete) {
          onSelectPrize(firstIncomplete.key);
        } else {
          onGoToSummary();
        }
      } else if (e.key === 'Backspace' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        onBackToHome();
      } else if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') {
        e.preventDefault();
        onGoToSummary();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectPrize, onGoToSummary, onBackToHome, allWinnersHistory]);

  const contentTransform =
    screenMode === 'left'
      ? 'translateX(-11.5vw)'
      : screenMode === 'right'
      ? 'translateX(11.5vw)'
      : 'none';

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none bg-transparent">
      {/* Top Header Spacer (Logo is rendered statically in App.tsx) */}
      <div
        className="relative z-20 w-full flex items-center justify-center pointer-events-none opacity-0 invisible"
        style={{
          paddingTop: '1.4vw',
          paddingBottom: '1.4vw',
          paddingLeft: '2.083vw',
          paddingRight: '2.083vw',
          minHeight: '5.2vw',
        }}
      >
        <div style={{ width: '14.84375vw', height: '4.5vw' }} />
      </div>

      {/* Ornate Main Title Section */}
      <div
        className="relative z-10 flex flex-col items-center text-center transition-transform duration-500"
        style={{
          marginTop: '0.1vw',
          marginBottom: '0.4vw',
          transform: contentTransform,
        }}
      >
        <div className="flex items-center justify-center" style={{ gap: '1.0vw' }}>
          {/* Left Decorative Wing */}
          <div
            style={{
              width: '4.0vw',
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(244, 203, 102, 0.85) 100%)',
            }}
          />
          <span style={{ color: '#f4cb66', fontSize: '0.6vw', opacity: 0.9 }}>◆</span>

          <h2
            style={{
              fontFamily: "'SF Pro Display', sans-serif",
              fontSize: '1.75vw',
              fontWeight: 700,
              letterSpacing: '0.14em',
              lineHeight: 1.15,
              background: 'linear-gradient(180deg, #ffffff 0%, #ffeed6 25%, #edd199 65%, #dabd81 85%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0.2vw 1.2vw rgba(244, 203, 102, 0.35))',
              textTransform: 'uppercase',
            }}
          >
            HỆ THỐNG GIẢI THƯỞNG VINH DANH
          </h2>

          <span style={{ color: '#f4cb66', fontSize: '0.6vw', opacity: 0.9 }}>◆</span>
          {/* Right Decorative Wing */}
          <div
            style={{
              width: '4.0vw',
              height: '1px',
              background: 'linear-gradient(270deg, transparent 0%, rgba(244, 203, 102, 0.85) 100%)',
            }}
          />
        </div>
      </div>

      {/* 5-Prize Showcase Cards Stage - 1 Single Stepped Row */}
      <div
        className="relative z-10 flex-1 w-full flex flex-col items-center justify-center transition-transform duration-500"
        style={{
          paddingLeft: '1.5vw',
          paddingRight: '1.5vw',
          paddingTop: '0.2vw',
          paddingBottom: '1.0vw',
          transform: contentTransform,
        }}
      >
        <div
          className="w-full flex items-end justify-center"
          style={{
            gap: '0.7vw',
            maxWidth: '92vw',
          }}
        >
          {DISPLAY_ORDER.map((key, idx) => {
            const config = PRIZE_CONFIGS.find(c => c.key === key)!;
            const wins = allWinnersHistory.filter(w => w.prizeKey === key);
            const isDone = wins.length >= config.count;
            const layout = TIER_LAYOUT[key];

            return (
              <div
                key={key}
                onClick={() => onSelectPrize(key)}
                className="group relative cursor-pointer flex flex-col items-center transition-all duration-300 hover:scale-105 active:scale-98 animate-slot-reveal"
                style={{
                  width: layout.cardWidth,
                  marginBottom: layout.marginBottom,
                  animationDelay: `${idx * 0.08}s`,
                  animationFillMode: 'both',
                }}
              >
                {/* Prize Title & Header */}
                <div className="flex flex-col items-center text-center z-10" style={{ marginBottom: '0.35vw' }}>
                  <h3
                    className="text-gold-gradient"
                    style={{
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontSize: key === 'grand' ? '1.3vw' : '1.18vw',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      lineHeight: 1.15,
                    }}
                  >
                    {config.tierTitle}
                  </h3>

                  {/* Dark Blue Pill Box with Border */}
                  <div
                    className="flex items-center justify-center transition-all duration-300 group-hover:border-gold-400 group-hover:shadow-gold-glow"
                    style={{
                      marginTop: '0.25vw',
                      padding: '0.18vw 0.75vw',
                      background: 'rgba(10, 20, 48, 0.85)',
                      border: '0.065vw solid rgba(244, 203, 102, 0.7)',
                      borderRadius: '1.3vw',
                      boxShadow: '0 0.13vw 0.65vw rgba(0,0,0,0.6), inset 0 0 0.39vw rgba(244,203,102,0.2)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'SF Pro Display', sans-serif",
                        fontSize: '0.72vw',
                        fontWeight: 700,
                        color: '#ffffff',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {config.productName}
                    </span>
                  </div>

                  {/* Product Subtitle */}
                  {config.productDetail && (
                    <p
                      style={{
                        fontFamily: "'SF Pro Display', sans-serif",
                        fontSize: '0.52vw',
                        fontWeight: 400,
                        color: '#94a3b8',
                        letterSpacing: '0.03em',
                        marginTop: '0.12vw',
                      }}
                    >
                      {config.productDetail}
                    </p>
                  )}
                </div>

                {/* Product & Gold Podium Container */}
                <div
                  className="relative z-10 flex flex-col items-center justify-end"
                  style={{
                    width: layout.cardWidth,
                    height: key === 'grand' ? '12.5vw' : '11.8vw',
                    marginTop: '0.2vw',
                  }}
                >
                  {/* Circular Amber-Orange Radiant Aura behind Circle (Unclipped) */}
                  <div
                    className={`absolute pointer-events-none z-0 ${isDone ? '' : 'animate-amber-aura'}`}
                    style={{
                      width: layout.auraSize,
                      height: layout.auraSize,
                      bottom: '-3.0vw',
                      left: '50%',
                      background: 'radial-gradient(circle at 50% 50%, rgba(255, 145, 0, 0.42) 0%, rgba(245, 158, 11, 0.2) 36%, rgba(217, 119, 6, 0.05) 58%, transparent 72%)',
                      borderRadius: '50%',
                      filter: 'blur(1.0vw)',
                      overflow: 'visible',
                    }}
                  />

                  {/* Golden Halo Arch (circle.png) behind product (Unclipped) */}
                  <div
                    className="absolute pointer-events-none z-0 flex items-center justify-center"
                    style={{
                      width: layout.circleWidth,
                      bottom: '-0.12vw',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      overflow: 'visible',
                    }}
                  >
                    <img
                      src={circleImg}
                      alt="Golden Halo Arch"
                      className={`w-full h-auto select-none ${isDone ? '' : 'animate-halo-arch'} transition-transform duration-300 group-hover:scale-105`}
                      style={{
                        maxWidth: 'none',
                      }}
                    />
                  </div>

                  {/* Golden Floor Glow / Shadow underneath podium base */}
                  <div
                    className="absolute pointer-events-none z-0"
                    style={{
                      width: layout.glowWidth,
                      height: '1.2vw',
                      bottom: '-0.3vw',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'radial-gradient(ellipse at 50% 50%, rgba(251, 191, 36, 0.75) 0%, rgba(245, 158, 11, 0.45) 35%, rgba(217, 119, 6, 0.15) 65%, transparent 80%)',
                      borderRadius: '50%',
                      filter: 'blur(0.25vw)',
                      boxShadow: '0 0.15vw 0.9vw rgba(245, 158, 11, 0.55), 0 0 1.4vw rgba(251, 191, 36, 0.35)',
                    }}
                  />

                  {/* Product Image - sits tightly directly on podium surface */}
                  <div
                    className="relative z-20 flex items-end justify-center transition-transform duration-300 group-hover:scale-105"
                    style={{
                      height: layout.productHeight,
                      width: '100%',
                      marginBottom: '-1.2vw',
                    }}
                  >
                    <img
                      src={PRODUCT_IMAGES[key]}
                      alt={config.productName}
                      style={{
                        height: '100%',
                        maxWidth: layout.productMaxW,
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 0.35vw 0.8vw rgba(0,0,0,0.6))',
                      }}
                    />
                  </div>

                  {/* Gold Podium underneath */}
                  <div
                    className="relative z-10 flex items-center justify-center"
                    style={{
                      width: layout.podiumWidth,
                      height: layout.podiumHeight,
                    }}
                  >
                    <img
                      src={goldPodiumImg}
                      alt="Gold Podium"
                      className="transition-transform duration-300 group-hover:scale-102"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
