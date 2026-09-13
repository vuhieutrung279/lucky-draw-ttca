import { useState, useCallback, useEffect, useRef } from 'react';
import { PARTICIPANTS, ROUND_CONFIGS, GIFT_INVENTORY, TOTAL_LD1_WINNERS, type Participant } from '../data/participants';
import logoImg from '../imports/logo.png';
import logoMecImg from '../imports/logo-mec.png';
import bgLd1Img from '../imports/background-ld1.png';
import { exportLuckyDraw1ToExcel } from '../utils/exportExcel';

export interface ConfirmedWinnerRecord {
  participant: Participant;
  round: number;
  gift: string;
}

interface DrawnItem {
  participant: Participant;
  gift: string;
}

interface LuckyDraw1Props {
  onBack: () => void;
  onComplete: (winnerIds: number[]) => void;
  onGoToDraw2?: () => void;
  confirmedHistory?: ConfirmedWinnerRecord[];
  onHistoryUpdate?: (history: ConfirmedWinnerRecord[]) => void;
  excludedIds?: number[];
}

type Phase = 'intro' | 'ready' | 'spinning' | 'drawn';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_GIFT_NAMES = GIFT_INVENTORY.map(g => g.name);

function SlotCard({
  item,
  isSpinning,
  isDrawn,
  pool,
  staggerIndex,
}: {
  item: DrawnItem | null;
  isSpinning: boolean;
  isDrawn: boolean;
  pool: Participant[];
  staggerIndex: number;
}) {
  const [locked, setLocked] = useState(false);
  const [currentRollingPerson, setCurrentRollingPerson] = useState<Participant | null>(null);
  const [currentRollingGift, setCurrentRollingGift] = useState<string>('');

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    if (isSpinning && item) {
      setLocked(false);

      intervalId = setInterval(() => {
        const randomP = pool[Math.floor(Math.random() * pool.length)];
        const randomGift = ALL_GIFT_NAMES[Math.floor(Math.random() * ALL_GIFT_NAMES.length)];
        setCurrentRollingPerson(randomP || item.participant);
        setCurrentRollingGift(randomGift);
      }, 60);

      const baseDelay = 2800;
      const staggerDelay = (staggerIndex * 50) % 1000;
      const stopTime = baseDelay + staggerDelay;

      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        setCurrentRollingPerson(item.participant);
        setCurrentRollingGift(item.gift);
        setLocked(true);
      }, stopTime);
    } else if (isDrawn && item) {
      setLocked(true);
      setCurrentRollingPerson(item.participant);
      setCurrentRollingGift(item.gift);
    } else {
      setLocked(false);
      setCurrentRollingPerson(null);
      setCurrentRollingGift('');
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [isSpinning, isDrawn, item, pool, staggerIndex]);

  const displayPerson = isDrawn || locked ? item?.participant : currentRollingPerson;
  const displayGift = isDrawn || locked ? item?.gift : currentRollingGift;

  return (
    <div
      style={{
        width: '21.9921875vw',
        height: '2.5390625vw',
        border: isSpinning && !locked ? '0.15625vw solid #f0d060' : '0.15625vw solid #cbbe9c',
        background: 'linear-gradient(90deg, #0e1f55 0%, #0e1532 100%)',
        boxShadow: isSpinning && !locked 
          ? '0 0 0.78125vw rgba(240, 208, 96, 0.4), inset 0 0 0.5859vw rgba(240, 208, 96, 0.2)' 
          : '0 0.15625vw 0.5859vw rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 0.39vw',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {isSpinning && !locked && (
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(240,208,96,0.35) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.2s infinite linear',
          }}
        />
      )}

      <div
        className="w-full text-center truncate z-10 select-none"
        style={{
          fontFamily: "'MBCorpoATitleCondOfcVI', sans-serif",
          fontSize: '0.859375vw',
          fontWeight: 700,
          letterSpacing: '0.01em',
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: '1.2',
          whiteSpace: 'nowrap',
          padding: '0 0.039vw',
        }}
      >
        {displayPerson ? (
          <span>
            <span style={{ color: '#ffffff', textTransform: 'uppercase', fontWeight: 800 }}>
              {displayPerson.name}
            </span>
            <span style={{ color: '#c8d8f0', margin: '0 0.234vw', fontWeight: 400 }}>-</span>
            <span style={{ color: '#c8d8f0', fontWeight: 600 }}>
              {displayPerson.department}
            </span>
            {displayGift && (
              <>
                <span style={{ color: '#c8d8f0', margin: '0 0.234vw', fontWeight: 400 }}>-</span>
                <span style={{ color: '#f0d060', fontWeight: 700 }}>
                  {displayGift}
                </span>
              </>
            )}
          </span>
        ) : (
          <span style={{ color: 'rgba(203, 190, 156, 0.4)', letterSpacing: '0.2em' }}>
            
          </span>
        )}
      </div>
    </div>
  );
}

export default function LuckyDraw1({
  onBack,
  onComplete,
  onGoToDraw2,
  confirmedHistory = [],
  onHistoryUpdate,
  excludedIds = [],
}: LuckyDraw1Props) {
  const [currentRound, setCurrentRound] = useState(() => {
    return Math.min(
      confirmedHistory.length > 0
        ? Math.max(...confirmedHistory.map(h => h.round))
        : 0,
      ROUND_CONFIGS.length - 1
    );
  });
  const [phase, setPhase] = useState<Phase>(() => {
    return confirmedHistory.length > 0 ? 'ready' : 'intro';
  });
  const [currentDrawnItems, setCurrentDrawnItems] = useState<DrawnItem[]>([]);
  const [confirmedWinnersHistory, setConfirmedWinnersHistory] = useState<ConfirmedWinnerRecord[]>(confirmedHistory);
  const [allDone, setAllDone] = useState(confirmedHistory.length >= TOTAL_LD1_WINNERS);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const roundConfig = ROUND_CONFIGS[currentRound];
  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);

  const confirmedWinnerIds = confirmedWinnersHistory.map(w => w.participant.id);

  const getPool = useCallback(() => {
    const used = new Set([...excludedIds, ...confirmedWinnerIds]);
    return PARTICIPANTS.filter(p => !used.has(p.id));
  }, [excludedIds, confirmedWinnerIds]);

  const getRemainingGifts = useCallback(() => {
    const giftCounts: Record<string, number> = {};
    for (const g of GIFT_INVENTORY) {
      giftCounts[g.name] = g.quantity;
    }
    for (const record of confirmedWinnersHistory) {
      if (giftCounts[record.gift] !== undefined && giftCounts[record.gift] > 0) {
        giftCounts[record.gift]--;
      }
    }
    const deck: string[] = [];
    for (const [name, count] of Object.entries(giftCounts)) {
      for (let i = 0; i < count; i++) {
        deck.push(name);
      }
    }
    return shuffle(deck);
  }, [confirmedWinnersHistory]);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!allDone) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let lastTime: number | null = null;
    let delayTimeout: NodeJS.Timeout;
    let isRunning = true;
    let currentScrollY = container.scrollTop;

    const scrollSpeed = Math.max(45, (window.innerWidth / 2560) * 65);

    if (isAutoScrolling) {
      delayTimeout = setTimeout(() => {
        currentScrollY = container.scrollTop;

        const scrollStep = (time: number) => {
          if (!isRunning || !isAutoScrolling) return;
          if (!lastTime) {
            lastTime = time;
            animationFrameId = requestAnimationFrame(scrollStep);
            return;
          }

          const delta = Math.min((time - lastTime) / 1000, 0.1);
          lastTime = time;

          if (container) {
            const singleHeight = contentRef.current ? contentRef.current.offsetHeight : 0;
            currentScrollY += delta * scrollSpeed;
            if (singleHeight > 0 && currentScrollY >= singleHeight) {
              currentScrollY -= singleHeight;
            }
            container.scrollTop = currentScrollY;
          }

          animationFrameId = requestAnimationFrame(scrollStep);
        };

        animationFrameId = requestAnimationFrame(scrollStep);
      }, 1200);
    }

    let allowUserInterruption = false;
    const graceTimer = setTimeout(() => {
      allowUserInterruption = true;
    }, 600);

    const stopAutoScroll = () => {
      if (!allowUserInterruption) return;
      if (container && contentRef.current) {
        const singleHeight = contentRef.current.offsetHeight;
        if (singleHeight > 0 && container.scrollTop >= singleHeight) {
          container.scrollTop = container.scrollTop % singleHeight;
        }
      }
      setIsAutoScrolling(false);
    };

    const handleWheel = (e: WheelEvent) => {
      if (!allowUserInterruption) return;
      if (Math.abs(e.deltaY) > 2) {
        stopAutoScroll();
      }
    };

    const handleTouchMove = () => {
      if (!allowUserInterruption) return;
      stopAutoScroll();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!allowUserInterruption) return;
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
        stopAutoScroll();
      }
    };

    const handleScroll = () => {
      if (!allowUserInterruption) return;
      if (Math.abs(container.scrollTop - currentScrollY) > 8) {
        stopAutoScroll();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(delayTimeout);
      clearTimeout(graceTimer);
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      if (container) {
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [allDone, isAutoScrolling]);

  const startSpin = useCallback(() => {
    const pool = getPool();
    if (pool.length === 0) return;

    const remainingGifts = getRemainingGifts();
    const count = Math.min(roundConfig.count, pool.length, remainingGifts.length);

    const chosenParticipants = shuffle(pool).slice(0, count);
    const chosenGifts = remainingGifts.slice(0, count);

    const items: DrawnItem[] = chosenParticipants.map((p, idx) => ({
      participant: p,
      gift: chosenGifts[idx] || 'Themos 140Y',
    }));

    setCurrentDrawnItems(items);
    setPhase('spinning');

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);

    spinTimerRef.current = setTimeout(() => {
      setPhase('drawn');
    }, 4200);
  }, [getPool, getRemainingGifts, roundConfig]);

  const confirm = useCallback(() => {
    const newRecords: ConfirmedWinnerRecord[] = currentDrawnItems.map(item => ({
      participant: item.participant,
      round: roundConfig.round,
      gift: item.gift,
    }));
    const updatedHistory = [...confirmedWinnersHistory, ...newRecords];
    setConfirmedWinnersHistory(updatedHistory);
    onHistoryUpdate?.(updatedHistory);

    if (currentRound + 1 >= ROUND_CONFIGS.length) {
      setAllDone(true);
      exportLuckyDraw1ToExcel(updatedHistory);
      onComplete(updatedHistory.map(h => h.participant.id));
    } else {
      setCurrentRound(r => r + 1);
      setPhase('ready');
      setCurrentDrawnItems([]);
    }
  }, [currentDrawnItems, confirmedWinnersHistory, currentRound, roundConfig, onComplete, onHistoryUpdate]);

  const redraw = useCallback(() => {
    startSpin();
  }, [startSpin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (allDone) {
        if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2' || e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (onGoToDraw2) {
            onGoToDraw2();
          } else {
            onBack();
          }
        } else if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'Backspace' || e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          onBack();
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          exportLuckyDraw1ToExcel(confirmedWinnersHistory);
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          setIsAutoScrolling(prev => !prev);
        }
        return;
      }

      if (phase === 'intro') {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          setPhase('ready');
        } else if (e.code === 'Backspace' || e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          onBack();
        }
      } else if (phase === 'ready') {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          startSpin();
        } else if (e.code === 'Backspace' || e.key === 'h' || e.key === 'H' || e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          if (confirmedWinnersHistory.length === 0) {
            setPhase('intro');
          } else {
            onBack();
          }
        }
      } else if (phase === 'drawn') {
        if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          confirm();
        } else if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR' || e.key === 'Delete') {
          e.preventDefault();
          redraw();
        } else if (e.code === 'Backspace' || e.key === 'h' || e.key === 'H' || e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          if (confirmedWinnersHistory.length === 0) {
            setPhase('intro');
          } else {
            onBack();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allDone, phase, confirmedWinnersHistory, startSpin, confirm, redraw, onBack, onGoToDraw2]);

  if (allDone) {
    const groupedRounds = ROUND_CONFIGS.map(cfg => {
      const winnersInRound = confirmedWinnersHistory.filter(w => w.round === cfg.round);
      return {
        round: cfg.round,
        count: cfg.count,
        winners: winnersInRound,
      };
    });

    const renderRounds = (keyPrefix: string) => {
      let count = 0;
      return groupedRounds.map((r) => {
        const startIdx = count;
        count += r.winners.length;

        return (
          <div key={`${keyPrefix}-${r.round}`} className="w-full" style={{ marginBottom: '1.5625vw' }}>
            <div className="flex items-center justify-center" style={{ margin: '0.625vw 0' }}>
              <h3
                style={{
                  fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                  fontSize: '0.9375vw',
                  fontWeight: 700,
                  color: '#f0d060',
                  letterSpacing: '0.08em',
                  textShadow: '0 0.078vw 0.39vw rgba(0,0,0,0.8), 0 0 0.586vw rgba(240, 208, 96, 0.3)',
                  textAlign: 'center',
                }}
              >
                LƯỢT {r.round}
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridTemplateRows: `repeat(${Math.ceil(r.winners.length / 4)}, 2.5390625vw)`,
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                columnGap: '1.09375vw',
                rowGap: '0.703125vw',
                width: '100%',
              }}
            >
              {r.winners.map((w, idx) => {
                const globalIdx = startIdx + idx + 1;
                return (
                  <div
                    key={`${keyPrefix}-${w.participant.id}-${idx}`}
                    style={{
                      height: '2.5390625vw',
                      border: '0.15625vw solid #cbbe9c',
                      background: 'linear-gradient(90deg, #0e1f55 0%, #0e1532 100%)',
                      boxShadow: '0 0.15625vw 0.5859vw rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 0.39vw',
                      position: 'relative',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className="absolute flex items-center justify-center pointer-events-none select-none"
                      style={{
                        left: '0.546875vw',
                        top: 0,
                        bottom: 0,
                        color: '#f0d060',
                        fontSize: '0.625vw',
                        fontFamily: "'MBCorpoATitleCondOfcVI', sans-serif",
                        fontWeight: 800,
                        letterSpacing: '0.02em',
                        opacity: 0.95,
                      }}
                    >
                      #{globalIdx}
                    </div>

                    <div
                      className="w-full text-center truncate z-10 select-none"
                      style={{
                        fontFamily: "'MBCorpoATitleCondOfcVI', sans-serif",
                        fontSize: '0.859375vw',
                        fontWeight: 700,
                        letterSpacing: '0.01em',
                        color: '#ffffff',
                        textAlign: 'center',
                        lineHeight: '1.2',
                        whiteSpace: 'nowrap',
                        padding: '0 1.875vw',
                      }}
                    >
                      <span>
                        <span style={{ color: '#ffffff', textTransform: 'uppercase', fontWeight: 800 }}>
                          {w.participant.name}
                        </span>
                        <span style={{ color: '#c8d8f0', margin: '0 0.234vw', fontWeight: 400 }}>-</span>
                        <span style={{ color: '#c8d8f0', fontWeight: 600 }}>
                          {w.participant.department}
                        </span>
                        <span style={{ color: '#c8d8f0', margin: '0 0.234vw', fontWeight: 400 }}>-</span>
                        <span style={{ color: '#f0d060', fontWeight: 700 }}>
                          {w.gift}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      });
    };

    return (
      <div
        className="w-full h-full flex flex-col items-center justify-between overflow-hidden select-none relative"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(13,30,61,0.95) 0%, rgba(8,18,34,0.98) 100%)',
        }}
      >
        <button
          onClick={onBack}
          className="absolute cursor-pointer z-30 flex items-center gap-2"
          style={{
            top: '0.78125vw',
            left: '0.9375vw',
            background: 'rgba(8, 18, 34, 0.65)',
            color: 'rgba(201, 162, 39, 0.85)',
            fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
            fontSize: '0.546875vw',
            letterSpacing: '0.15em',
            padding: '0.2734375vw 0.703125vw',
            border: '0.039vw solid rgba(201, 162, 39, 0.35)',
            borderRadius: '0.078vw',
            backdropFilter: 'blur(6px)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#f0d060';
            e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.7)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(201, 162, 39, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.35)';
          }}
        >
          ← TRANG CHỦ
        </button>

        <div
          className="w-full flex flex-col items-center z-20 shrink-0 bg-gradient-to-b from-[#081222]/90 via-[#081222]/60 to-transparent"
          style={{ paddingTop: '0.78125vw', paddingBottom: '0.46875vw', paddingLeft: '1.25vw', paddingRight: '1.25vw' }}
        >
          <div className="flex flex-col items-center">
            <img
              src={logoMecImg}
              alt="Mercedes-Benz"
              style={{
                height: '4.6875vw',
                objectFit: 'contain',
                marginBottom: '1.171875vw',
                filter: 'drop-shadow(0 0 0.9765vw rgba(255,255,255,0.35))',
              }}
            />
            <img
              src={logoImg}
              alt="Lucky Draw"
              style={{
                width: '23.984375vw',
                height: '3.0078125vw',
                objectFit: 'contain',
                marginBottom: '0.625vw',
                filter: 'drop-shadow(0 0 1.367vw rgba(201,162,39,0.5))',
              }}
            />
          </div>

          <h2
            className="text-gold-gradient text-center"
            style={{
              fontFamily: "'MBCorpoATitleCondOfcVI', sans-serif",
              fontSize: '1.71875vw',
              fontWeight: 900,
              letterSpacing: '0.06em',
              textShadow: '0 0.156vw 0.781vw rgba(0,0,0,0.6)',
              lineHeight: 1.1,
              marginBottom: '0.234vw',
            }}
          >
            KẾT QUẢ LUCKY DRAW 1
          </h2>

          <div className="flex items-center justify-center gap-6 flex-wrap">
            <p
              style={{
                fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                color: '#fff5d4',
                fontSize: '0.859375vw',
                fontWeight: 400,
                letterSpacing: '0.04em',
                textShadow: '0 0.078vw 0.39vw rgba(0,0,0,0.6), 0 0 0.586vw rgba(255,245,212,0.25)',
              }}
            >
              Đã trao tặng thành công <span style={{ color: '#f0d060', fontWeight: 700 }}>{confirmedWinnersHistory.length}</span> phần quà qua 7 lượt quay
            </p>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="w-full flex-1 overflow-y-auto"
          style={{
            paddingLeft: '2.5vw',
            paddingRight: '2.5vw',
            paddingTop: '0.625vw',
            paddingBottom: '0.625vw',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div ref={contentRef} className="w-full" style={{ paddingBottom: '1.5625vw' }}>
            {renderRounds('list1')}
          </div>
          {isAutoScrolling && (
            <div className="w-full" style={{ paddingBottom: '1.5625vw' }}>
              {renderRounds('list2')}
            </div>
          )}
        </div>

        <div
          className="w-full flex items-center justify-center z-20 shrink-0 bg-gradient-to-t from-[#081222]/95 via-[#081222]/85 to-transparent border-t border-[#cbbe9c]/20"
          style={{ paddingTop: '0.625vw', paddingBottom: '0.625vw' }}
        >
          <button
            onClick={() => {
              if (onGoToDraw2) onGoToDraw2();
              else onBack();
            }}
            className="cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95"
            style={{
              padding: '0.46875vw 2.1875vw',
              background: 'linear-gradient(90deg, #cbbe9c 0%, #f0d060 50%, #cbbe9c 100%)',
              border: '0.078vw solid #ffffff',
              borderRadius: '0.078vw',
              boxShadow: '0 0.156vw 1.17vw rgba(240, 208, 96, 0.5), inset 0 0.039vw 0.078vw rgba(255, 255, 255, 0.8)',
              color: '#081222',
              fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
              fontSize: '0.859375vw',
              fontWeight: 800,
              letterSpacing: '0.08em',
            }}
          >
            LUCKY DRAW 2
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div
        className="relative w-full h-full flex flex-col items-center justify-between overflow-hidden select-none"
        style={{
          backgroundImage: `url(${bgLd1Img})`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          paddingTop: '0.625vw',
          paddingBottom: '0.625vw',
          paddingLeft: '0.9375vw',
          paddingRight: '0.9375vw',
        }}
      >
        <button
          onClick={onBack}
          className="absolute cursor-pointer z-30 flex items-center gap-2"
          style={{
            top: '0.78125vw',
            left: '0.9375vw',
            background: 'rgba(8, 18, 34, 0.6)',
            color: 'rgba(201, 162, 39, 0.85)',
            fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
            fontSize: '0.546875vw',
            letterSpacing: '0.15em',
            padding: '0.2734375vw 0.703125vw',
            border: '0.039vw solid rgba(201, 162, 39, 0.35)',
            borderRadius: '0.078vw',
            backdropFilter: 'blur(6px)',
          }}
        >
          ← TRANG CHỦ
        </button>

        <div className="flex flex-col items-center z-10 flex-shrink-0" style={{ paddingTop: '0.39vw' }}>
          <img
            src={logoMecImg}
            alt="Mercedes-Benz"
            style={{
              height: '4.6875vw',
              objectFit: 'contain',
              marginBottom: '1.171875vw',
              filter: 'drop-shadow(0 0 0.9765vw rgba(255,255,255,0.35))',
            }}
          />

          <img
            src={logoImg}
            alt="Lucky Draw"
            style={{
              width: '23.984375vw',
              height: '3.0078125vw',
              objectFit: 'contain',
              marginBottom: '0.625vw',
              filter: 'drop-shadow(0 0 1.367vw rgba(201,162,39,0.5))',
            }}
          />

          <h2
            className="text-center"
            style={{
              fontFamily: "'MBCorpoSTextOfcVI', sans-serif",
              fontSize: '0.9375vw',
              fontWeight: 400,
              color: '#fff5d4',
              letterSpacing: '0.03em',
              textShadow: '0 0.078vw 0.468vw rgba(0,0,0,0.7), 0 0 0.781vw rgba(255,245,212,0.25)',
              margin: 0,
            }}
          >
            Bộ sưu tập và phụ kiện Mercedes-Benz 140 năm
          </h2>

          <button
            onClick={() => setPhase('ready')}
            className="cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95"
            style={{
              marginTop: '1.2vw',
              padding: '0.39vw 2.5vw',
              background: 'linear-gradient(90deg, #0f1533 0%, #0e1635 100%)',
              border: '0.0586vw solid #cbbe9c',
              borderRadius: '0.078vw',
              boxShadow: '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)',
              color: '#fff5d4',
              fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
              fontSize: '1.640625vw',
              fontWeight: 700,
              letterSpacing: '0.15em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#f0d060';
              e.currentTarget.style.boxShadow = '0 0.234vw 1.17vw rgba(240, 208, 96, 0.4), inset 0 0.039vw 0.078vw rgba(255, 255, 255, 0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#cbbe9c';
              e.currentTarget.style.boxShadow = '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)';
            }}
          >
            BẮT ĐẦU
          </button>
        </div>

        <div className="flex-1 w-full" />
      </div>
    );
  }

  const pool = getPool();
  const cardCount = roundConfig.count;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between overflow-hidden select-none"
      style={{
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(201,162,39,0.08) 0%, transparent 60%)',
        paddingTop: '0.46875vw',
        paddingBottom: '0.46875vw',
        paddingLeft: '0.9375vw',
        paddingRight: '0.9375vw',
      }}
    >
      <button
        onClick={() => {
          if (confirmedWinnersHistory.length === 0) {
            setPhase('intro');
          } else {
            onBack();
          }
        }}
        className="absolute cursor-pointer z-30 flex items-center gap-2"
        style={{
          top: '0.78125vw',
          left: '0.9375vw',
          background: 'rgba(8, 18, 34, 0.65)',
          color: 'rgba(201, 162, 39, 0.85)',
          fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
          fontSize: '0.546875vw',
          letterSpacing: '0.15em',
          padding: '0.2734375vw 0.703125vw',
          border: '0.039vw solid rgba(201, 162, 39, 0.35)',
          borderRadius: '0.078vw',
          backdropFilter: 'blur(6px)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#f0d060';
          e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.7)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'rgba(201, 162, 39, 0.85)';
          e.currentTarget.style.borderColor = 'rgba(201, 162, 39, 0.35)';
        }}
      >
        {confirmedWinnersHistory.length === 0 ? '← MÀN HÌNH CHỜ' : '← TRANG CHỦ'}
      </button>

      <div className="flex flex-col items-center flex-shrink-0 z-20" style={{ paddingTop: '0.39vw' }}>
        <img
          src={logoMecImg}
          alt="Mercedes-Benz"
          style={{
            height: '4.6875vw',
            objectFit: 'contain',
            marginBottom: '1.171875vw',
            filter: 'drop-shadow(0 0 0.9765vw rgba(255,255,255,0.35))',
          }}
        />

        <img
          src={logoImg}
          alt="Lucky Draw"
          style={{
            width: '23.984375vw',
            height: '3.0078125vw',
            objectFit: 'contain',
            marginBottom: '0.625vw',
            filter: 'drop-shadow(0 0 1.367vw rgba(201,162,39,0.5))',
          }}
        />

        <h2
          className="text-center"
          style={{
            fontFamily: "'MBCorpoSTextOfcVI', sans-serif",
            fontSize: '0.9375vw',
            fontWeight: 400,
            color: '#fff5d4',
            letterSpacing: '0.03em',
            textShadow: '0 0.078vw 0.468vw rgba(0,0,0,0.7), 0 0 0.781vw rgba(255,245,212,0.25)',
            margin: 0,
          }}
        >
          Bộ sưu tập và phụ kiện Mercedes-Benz 140 năm
        </h2>

        <div
          style={{
            height: '2.34375vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(90deg, #f4e8d9 0%, #ac9c74 100%)',
            padding: '0 2.03125vw',
            borderRadius: '0.078vw',
            marginTop: '1.953125vw',
            marginBottom: '1.171875vw',
            boxShadow: '0 0.156vw 0.5859vw rgba(0,0,0,0.35)',
          }}
        >
          <span
            style={{
              fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
              fontSize: '1.3671875vw',
              fontWeight: 800,
              color: '#081222',
            }}
          >
            {roundConfig.label}
          </span>
        </div>

        <div
          className="flex items-center"
          style={{
            gap: '1.5625vw',
          }}
        >
          {phase === 'ready' && (
            <button
              onClick={startSpin}
              className="cursor-pointer"
              style={{
                height: '2.34375vw',
                padding: '0 1.875vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, #e4eaf4 0%, #a2b4cb 100%)',
                color: '#081222',
                fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                fontSize: '0.78125vw',
                fontWeight: 800,
                letterSpacing: '0.15em',
                border: '0.0586vw solid #7c91a8',
                borderRadius: '0.078vw',
                boxShadow: '0 0.156vw 0.5859vw rgba(0,0,0,0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
            >
              BẮT ĐẦU
            </button>
          )}

          {phase === 'spinning' && (
            <div
              className="flex items-center justify-center rounded-sm"
              style={{
                height: '2.34375vw',
                padding: '0 1.875vw',
                gap: '0.46875vw',
                background: 'rgba(201, 162, 39, 0.2)',
                border: '0.0586vw solid #f0d060',
                color: '#f0d060',
                fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                fontSize: '0.78125vw',
                letterSpacing: '0.15em',
                fontWeight: 700,
                boxShadow: '0 0 0.781vw rgba(240,208,96,0.35)',
              }}
            >
              <span className="inline-block animate-spin">⚙</span> ĐANG QUAY SỐ...
            </div>
          )}

          {phase === 'drawn' && (
            <>
              <button
                onClick={confirm}
                className="cursor-pointer"
                style={{
                  height: '2.34375vw',
                  padding: '0 1.875vw',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(180deg, #e4eaf4 0%, #a2b4cb 100%)',
                  color: '#081222',
                  fontFamily: "'MBCorpoATitleCondOfcVI', sans-serif",
                  fontSize: '0.78125vw',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  border: '0.0586vw solid #7c91a8',
                  borderRadius: '0.078vw',
                  boxShadow: '0 0.156vw 0.5859vw rgba(0,0,0,0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
              >
                XÁC NHẬN
              </button>
              <button
                onClick={redraw}
                className="cursor-pointer"
                style={{
                  height: '2.34375vw',
                  padding: '0 1.875vw',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(180deg, #e4eaf4 0%, #a2b4cb 100%)',
                  color: '#081222',
                  fontFamily: "'MBCorpoATitleCondOfcVI', sans-serif",
                  fontSize: '0.78125vw',
                  fontWeight: 800,
                  letterSpacing: '0.15em',
                  border: '0.0586vw solid #7c91a8',
                  borderRadius: '0.078vw',
                  boxShadow: '0 0.156vw 0.5859vw rgba(0,0,0,0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
              >
                QUAY LẠI
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className="flex-1 w-full flex items-center justify-center overflow-hidden"
        style={{ minHeight: 0 }}
      >
        <div
          style={{
            width: '93.2421875vw',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridTemplateRows: 'repeat(5, 2.5390625vw)',
              gridTemplateColumns: 'repeat(4, 21.9921875vw)',
              columnGap: '1.7578125vw',
              rowGap: '0.9765625vw',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            {Array.from({ length: cardCount }).map((_, idx) => (
              <SlotCard
                key={idx}
                item={currentDrawnItems[idx] || null}
                isSpinning={phase === 'spinning'}
                isDrawn={phase === 'drawn'}
                pool={pool}
                staggerIndex={idx}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center z-20" style={{ gap: '0.078vw', paddingBottom: '0.039vw' }}>
        {ROUND_CONFIGS.map((r, i) => (
          <div
            key={r.round}
            style={{
              width: i < currentRound ? '0.859375vw' : '0.2734375vw',
              height: '0.1171875vw',
              borderRadius: '0.078vw',
              background: i < currentRound
                ? 'linear-gradient(90deg, #c9a227, #f0d060)'
                : i === currentRound
                ? 'rgba(201,162,39,0.8)'
                : 'rgba(201,162,39,0.2)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
        <span
          style={{
            fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
            fontSize: '0.4296875vw',
            color: 'rgba(201,162,39,0.8)',
            letterSpacing: '0.1em',
            marginLeft: '0.234vw',
          }}
        >
          {currentRound + 1} / {ROUND_CONFIGS.length}
        </span>
      </div>
    </div>
  );
}
