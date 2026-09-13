import { useEffect, useRef } from 'react';
import bgSpace from '../imports/bg.jpg';
import logoGenesis from '../imports/logo-genesis.png';
import { PRIZE_CONFIGS, type PrizeKey } from '../data/participants';
import { exportGenesisLuckyDrawToExcel, type WonRecord } from '../utils/exportExcel';
import type { ScreenMode } from '../utils/syncManager';

interface SummaryResultsProps {
  onBack: () => void;
  onGoToDraw: () => void;
  winnersHistory: WonRecord[];
  screenMode?: ScreenMode;
}

const HIGH_TO_LOW_ORDER: PrizeKey[] = ['grand', 'first', 'second', 'third', 'consolation'];

export default function SummaryResults({
  onBack,
  onGoToDraw,
  winnersHistory,
  screenMode = 'left',
}: SummaryResultsProps) {
  const autoExportTriggeredRef = useRef(false);

  // Auto export Excel when all 20 prizes are drawn
  useEffect(() => {
    if (!autoExportTriggeredRef.current && winnersHistory.length >= 20) {
      autoExportTriggeredRef.current = true;
      const timer = setTimeout(() => {
        exportGenesisLuckyDrawToExcel(winnersHistory);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [winnersHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Backspace' || e.key === 'h' || e.key === 'H' || e.key === 'Escape') {
        e.preventDefault();
        onBack();
      } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        onGoToDraw();
      } else if (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        exportGenesisLuckyDrawToExcel(winnersHistory);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, onGoToDraw, winnersHistory]);

  // Helper to render the entire vertical sequence of prizes and their winners
  const renderPrizeSequence = (keyPrefix: string) => {
    return (
      <div className="flex flex-col w-full" style={{ gap: '2.604vw' }}>
        {HIGH_TO_LOW_ORDER.map(prizeKey => {
          const tier = PRIZE_CONFIGS.find(cfg => cfg.key === prizeKey)!;
          const wins = winnersHistory.filter(w => w.prizeKey === prizeKey);
          const isGrand = prizeKey === 'grand';

          return (
            <div
              key={`${keyPrefix}-${tier.key}`}
              className="w-full flex flex-col items-center"
              style={{
                gap: '1.0416vw',
              }}
            >
              {/* Prize Header Box */}
              <div className="flex flex-col items-center text-center">
                <h3
                  className="text-gold-gradient"
                  style={{
                    fontFamily: "'SF Pro Display', sans-serif",
                    fontSize: isGrand ? '1.823vw' : '1.432vw',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    lineHeight: 1.15,
                  }}
                >
                  {tier.tierTitle}
                </h3>
                <div
                  style={{
                    marginTop: '0.325vw',
                    padding: '0.195vw 1.0416vw',
                    background: 'rgba(10, 20, 48, 0.9)',
                    border: '0.065vw solid #f4cb66',
                    borderRadius: '1.302vw',
                    boxShadow: '0 0.13vw 0.65vw rgba(0,0,0,0.6), inset 0 0 0.39vw rgba(244,203,102,0.25)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontSize: '0.91vw',
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {tier.productName}
                  </span>
                </div>
              </div>

              {/* Vertical list of guests (1 column) with increased gap */}
              <div className="flex flex-col w-full" style={{ gap: '0.9765vw' }}>
                {Array.from({ length: tier.count }).map((_, idx) => {
                  const record = wins[idx];

                  return (
                    <div
                      key={idx}
                      className="w-full flex flex-col items-center justify-center text-center"
                      style={{
                        height: isGrand ? '4.166vw' : '3.6458vw',
                        padding: '0.325vw 1.627vw',
                        background: record ? '#180c33' : 'rgba(24, 12, 51, 0.4)',
                        border: record
                          ? isGrand
                            ? '0.09765vw solid #f4cb66'
                            : '0.078vw solid #d4a017'
                          : '0.065vw dashed rgba(244, 203, 102, 0.35)',
                        borderRadius: '0.39vw',
                        boxShadow: record
                          ? isGrand
                            ? '0 0.26vw 1.302vw rgba(0, 0, 0, 0.8), inset 0 0 0.65vw rgba(244, 203, 102, 0.35), 0 0 0.9765vw rgba(244,203,102,0.25)'
                            : '0 0.2vw 0.9765vw rgba(0, 0, 0, 0.7), inset 0 0 0.52vw rgba(244, 203, 102, 0.2)'
                          : 'none',
                      }}
                    >
                      {record ? (
                        <>
                          <div
                            className="truncate w-full uppercase"
                            style={{
                              fontFamily: "'SF Pro Display', sans-serif",
                              fontSize: isGrand ? '1.497vw' : '1.302vw',
                              fontWeight: 700,
                              color: '#ffecd4',
                              letterSpacing: '0.05em',
                              lineHeight: 1.15,
                            }}
                          >
                            {record.winner.name}
                          </div>
                          <div
                            className="truncate w-full flex items-center justify-center"
                            style={{
                              fontFamily: "'SF Pro Display', sans-serif",
                              fontSize: isGrand ? '1.0416vw' : '0.9765vw',
                              fontWeight: 500,
                              color: '#eacc8e',
                              letterSpacing: '0.05em',
                              lineHeight: 1.15,
                              marginTop: '0.13vw',
                            }}
                          >
                            <span>{record.winner.code}</span>
                          </div>
                        </>
                      ) : (
                        <span
                          style={{
                            fontFamily: "'SF Pro Display', sans-serif",
                            fontSize: '0.846vw',
                            color: 'rgba(148, 163, 184, 0.45)',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Chưa quay #{idx + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const contentTransform =
    screenMode === 'left'
      ? 'translateX(-11.5vw)'
      : screenMode === 'right'
      ? 'translateX(11.5vw)'
      : 'none';

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none bg-transparent">
      {/* Top Header */}
      <div
        className="relative z-20 w-full flex items-center justify-center pointer-events-none"
        style={{
          paddingTop: '6.2vw',
          paddingBottom: '0.65vw',
          paddingLeft: '2.083vw',
          paddingRight: '2.083vw',
          background: 'linear-gradient(180deg, rgba(4,7,20,0.95) 0%, rgba(4,7,20,0.6) 80%, transparent 100%)',
        }}
      >
        <h1
          className="text-gold-gradient text-center transition-transform duration-500"
          style={{
            fontFamily: "'SF Pro Display', sans-serif",
            fontSize: '2.4739vw',
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1.15,
            transform: contentTransform,
          }}
        >
          TỔNG KẾT KẾT QUẢ LUCKY DRAW
        </h1>
      </div>

      {/* Main Continuous Seamless Infinite Vertical Scroll */}
      <div
        className="relative z-10 flex-1 w-full overflow-hidden flex justify-center items-start"
        style={{
          paddingTop: '0.651vw',
          paddingBottom: '0.651vw',
        }}
      >
        <div
          className="w-full flex justify-center items-start transition-transform duration-500"
          style={{ transform: contentTransform }}
        >
          <div
            className="relative flex flex-col items-center animate-infinite-scroll-vertical"
            style={{
              width: '46vw',
              maxWidth: '1450px',
              gap: '2.604vw',
            }}
          >
            {/* Copy 1 */}
            {renderPrizeSequence('copy1')}

            {/* Copy 2 (Enables seamless continuous loop) */}
            {renderPrizeSequence('copy2')}
          </div>
        </div>
      </div>
    </div>
  );
}
