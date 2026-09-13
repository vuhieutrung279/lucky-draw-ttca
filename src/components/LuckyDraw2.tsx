import { useState, useCallback, useEffect, useRef } from 'react';
import { PARTICIPANTS, PRIZE_CONFIGS, type Participant } from '../data/participants';
import logoImg from '../imports/logo.png';
import logoMecImg from '../imports/logo-mec.png';
import bg2Img from '../imports/background2.png';
import bgIntroImg from '../imports/background-intro.png';
import bgRollImg from '../imports/background-roll.png';
import productImg from '../imports/product.png';
import { exportLuckyDraw2ToExcel } from '../utils/exportExcel';

export type PrizeKey = 'third' | 'second' | 'first';

interface LuckyDraw2Props {
  onBack: () => void;
  excludedIds: number[];
  confirmedWinnersHistory?: Record<PrizeKey, Participant | null>;
  onWinnersUpdate?: (winners: Record<PrizeKey, Participant | null>) => void;
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

const DRAW_PRIZE_ORDER: PrizeKey[] = ['third', 'second', 'first'];
const RESULT_PRIZE_ORDER: PrizeKey[] = ['first', 'second', 'third'];

export default function LuckyDraw2({
  onBack,
  excludedIds,
  confirmedWinnersHistory = { third: null, second: null, first: null },
  onWinnersUpdate,
}: LuckyDraw2Props) {
  const isAlreadyAllDone = RESULT_PRIZE_ORDER.every(k => Boolean(confirmedWinnersHistory[k]));

  const [phase, setPhase] = useState<Phase>('intro');
  const [selectedPrizeKey, setSelectedPrizeKey] = useState<PrizeKey>('third');
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null);
  const [displayRollingWinner, setDisplayRollingWinner] = useState<Participant | null>(null);
  const [confirmedWinners, setConfirmedWinners] = useState<Record<PrizeKey, Participant | null>>(confirmedWinnersHistory);
  const [allDone, setAllDone] = useState(isAlreadyAllDone);

  const currentPrizeConfig = PRIZE_CONFIGS.find(p => p.key === selectedPrizeKey)!;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getPool = useCallback(() => {
    const otherWinners = Object.entries(confirmedWinners)
      .filter(([k, p]) => k !== selectedPrizeKey && Boolean(p))
      .map(([_, p]) => p!.id);
    const used = new Set([...excludedIds, ...otherWinners]);
    return PARTICIPANTS.filter(p => !used.has(p.id));
  }, [excludedIds, confirmedWinners, selectedPrizeKey]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleSelectPrize = useCallback((key: PrizeKey) => {
    setSelectedPrizeKey(key);
    const existing = confirmedWinners[key];
    if (existing) {
      setCurrentWinner(existing);
      setDisplayRollingWinner(existing);
      setPhase('drawn');
    } else {
      setCurrentWinner(null);
      setDisplayRollingWinner(null);
      setPhase('ready');
    }
  }, [confirmedWinners]);

  const startDrawFromIntro = useCallback(() => {
    const nextUnconfirmed = DRAW_PRIZE_ORDER.find(k => !confirmedWinners[k]);
    if (nextUnconfirmed) {
      handleSelectPrize(nextUnconfirmed);
    } else {
      setAllDone(true);
    }
  }, [confirmedWinners, handleSelectPrize]);

  const draw = useCallback(() => {
    const pool = getPool();
    if (pool.length === 0) return;

    const winner = shuffle(pool)[0];
    setPhase('spinning');

    const totalDuration = 4500;
    const startTime = Date.now();

    const roll = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < totalDuration) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        setDisplayRollingWinner(pool[randomIndex]);

        const progress = elapsed / totalDuration;
        const currentInterval = 60 + Math.pow(progress, 3) * 300;

        intervalRef.current = setTimeout(roll, currentInterval);
      } else {
        setDisplayRollingWinner(winner);
        setCurrentWinner(winner);
        setPhase('drawn');
      }
    };

    roll();
  }, [getPool]);

  const confirm = useCallback(() => {
    if (!currentWinner) return;
    const newConfirmed = { ...confirmedWinners, [selectedPrizeKey]: currentWinner };
    setConfirmedWinners(newConfirmed);
    onWinnersUpdate?.(newConfirmed);

    const allCompleted = RESULT_PRIZE_ORDER.every(k => Boolean(newConfirmed[k]));
    if (allCompleted) {
      setAllDone(true);
      const exportList = RESULT_PRIZE_ORDER.map(k => {
        const cfg = PRIZE_CONFIGS.find(p => p.key === k)!;
        const w = newConfirmed[k]!;
        return {
          prizeLabel: cfg.label,
          prizeValue: cfg.value,
          participant: w,
          prizes: cfg.prizes,
        };
      });
      exportLuckyDraw2ToExcel(exportList);
    } else {
      setPhase('intro');
      setCurrentWinner(null);
      setDisplayRollingWinner(null);
    }
  }, [currentWinner, confirmedWinners, selectedPrizeKey, onWinnersUpdate]);

  const redraw = useCallback(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (allDone) {
        if (e.key === 'Enter' || e.code === 'Space' || e.code === 'Backspace' || e.key === 'h' || e.key === 'H' || e.key === '1') {
          e.preventDefault();
          onBack();
        }
        return;
      }

      if (phase === 'intro') {
        if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3' || e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          handleSelectPrize('third');
        } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2' || e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          handleSelectPrize('second');
        } else if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          handleSelectPrize('first');
        } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          startDrawFromIntro();
        } else if (e.code === 'Backspace' || e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          onBack();
        }
      } else if (phase === 'ready') {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          draw();
        } else if (e.code === 'Backspace' || e.key === 'h' || e.key === 'H' || e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          setPhase('intro');
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
          setPhase('intro');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allDone, phase, selectedPrizeKey, confirmedWinners, handleSelectPrize, startDrawFromIntro, draw, confirm, redraw, onBack]);

  const getBadgeStyle = (key: PrizeKey) => {
    if (key === 'first') {
      return {
        background: 'linear-gradient(180deg, #fff275 0%, #ffd028 50%, #f5a600 100%)',
        color: '#081222',
      };
    }
    if (key === 'second') {
      return {
        background: 'linear-gradient(180deg, #ffffff 0%, #e4ecf4 50%, #9cb0c8 100%)',
        color: '#081222',
      };
    }
    return {
      background: 'linear-gradient(180deg, #ffe0c0 0%, #e8a068 50%, #b86028 100%)',
      color: '#081222',
    };
  };

  const getWinnerBarStyle = (key: PrizeKey) => {
    if (key === 'first') {
      return {
        background: 'linear-gradient(180deg, #fff7c0 0%, #fcd653 30%, #e6b224 70%, #ffec95 100%)',
        boxShadow: '0 0 35px rgba(240, 208, 96, 0.55), 0 8px 25px rgba(0, 0, 0, 0.6)',
      };
    }
    if (key === 'second') {
      return {
        background: 'linear-gradient(180deg, #ffffff 0%, #e4ecf4 30%, #9cb0c8 70%, #e8f0f8 100%)',
        boxShadow: '0 0 35px rgba(200, 220, 245, 0.6), 0 8px 25px rgba(0, 0, 0, 0.6)',
      };
    }
    return {
      background: 'linear-gradient(180deg, #ffe0c0 0%, #e8a068 30%, #b86028 70%, #f7cbb0 100%)',
      boxShadow: '0 0 35px rgba(232, 160, 104, 0.6), 0 8px 25px rgba(0, 0, 0, 0.6)',
    };
  };

  if (allDone) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-between overflow-hidden select-none"
        style={{
          backgroundImage: `url(${bg2Img})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          padding: '1.25vw',
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
            fontSize: '0.46875vw',
            letterSpacing: '0.15em',
            padding: '0.2734vw 0.625vw',
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

        <div className="flex flex-col items-center z-10 flex-shrink-0" style={{ paddingTop: '0.3906vw' }}>
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
              height: '4.6875vw',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 1.367vw rgba(201,162,39,0.5))',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center w-fit max-w-[95vw] px-4 my-auto">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(9.375vw, max-content) minmax(12.5vw, max-content) minmax(9.375vw, max-content)',
              gap: '0.9375vw',
              width: '100%',
            }}
          >
            {RESULT_PRIZE_ORDER.map((key, index) => {
              const cfg = PRIZE_CONFIGS.find(p => p.key === key)!;
              const winner = confirmedWinners[key];
              const delay = index * 0.25;

              return (
                <div
                  key={cfg.key}
                  className="backdrop-blur-md"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'subgrid',
                    gridColumn: '1 / -1',
                    gap: '1.875vw',
                    alignItems: 'center',
                    background: 'rgba(9, 24, 52, 0.85)',
                    border: `0.0586vw solid ${cfg.color}`,
                    boxShadow: `0 0.234vw 0.9765vw ${cfg.color}35`,
                    padding: '0.9375vw 1.875vw',
                    borderRadius: '0.156vw',
                    whiteSpace: 'nowrap',
                    animation: `cardSlideIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s both, cardPulseGlow 3.5s ease-in-out infinite ${delay + 0.8}s`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'MBCorpoATitleOfcVI', serif",
                      fontSize: '1.25vw',
                      fontWeight: 700,
                      color: cfg.color,
                      letterSpacing: '0.04em',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                      animation: `winnerReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay + 0.15}s both`,
                    }}
                  >
                    {cfg.label}
                  </span>

                  <span
                    style={{
                      fontFamily: "'MBCorpoATitleOfcVI', serif",
                      fontSize: '1.484vw',
                      fontWeight: 800,
                      color: '#ffffff',
                      letterSpacing: '0.04em',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      padding: '0 0.46875vw',
                      animation: `winnerReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay + 0.25}s both, goldGlowText 3s ease-in-out infinite ${delay + 0.95}s`,
                    }}
                  >
                    {winner ? (
                      <span style={{ textTransform: 'uppercase' }}>{winner.name}</span>
                    ) : (
                      '—'
                    )}
                  </span>

                  <span
                    style={{
                      fontFamily: "'MBCorpoSTextOfcVI', sans-serif",
                      fontSize: '0.9375vw',
                      fontWeight: 600,
                      color: 'rgba(215, 230, 255, 0.95)',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      animation: `winnerReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay + 0.35}s both`,
                    }}
                  >
                    {winner ? winner.department : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: '0.625vw' }} className="flex-shrink-0" />
      </div>
    );
  }

  if (phase === 'intro') {
    const introPrizeOrder: PrizeKey[] = ['third', 'first', 'second'];

    return (
      <div
        className="relative w-full h-full flex flex-col items-center justify-between overflow-hidden select-none"
        style={{
          backgroundImage: `url(${bgIntroImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          paddingTop: '0.9375vw',
          paddingBottom: '0.9375vw',
          paddingLeft: '0.625vw',
          paddingRight: '0.625vw',
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
            fontSize: '0.46875vw',
            letterSpacing: '0.15em',
            padding: '0.2734vw 0.625vw',
            border: '0.039vw solid rgba(201, 162, 39, 0.35)',
            borderRadius: '0.078vw',
            backdropFilter: 'blur(6px)',
          }}
        >
          ← TRANG CHỦ
        </button>

        <div className="flex flex-col items-center z-10 flex-shrink-0" style={{ paddingTop: '0.3906vw' }}>
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
              height: '4.6875vw',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 1.367vw rgba(201,162,39,0.5))',
            }}
          />

          <button
            onClick={startDrawFromIntro}
            className="cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95"
            style={{
              marginTop: '1.171875vw',
              marginBottom: '1.171875vw',
              padding: '0.39vw 2.5vw',
              background: 'linear-gradient(90deg, #0f1533 0%, #0e1635 100%)',
              border: '0.0586vw solid #cbbe9c',
              borderRadius: '0.078vw',
              boxShadow: '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)',
              color: '#fff5d4',
              fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
              fontSize: '1.6406vw',
              fontWeight: 700,
              letterSpacing: '0.15em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#f0d060';
              e.currentTarget.style.boxShadow = '0 0.234vw 1.1718vw rgba(240, 208, 96, 0.4), inset 0 0.039vw 0.078vw rgba(255, 255, 255, 0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#cbbe9c';
              e.currentTarget.style.boxShadow = '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)';
            }}
          >
            {RESULT_PRIZE_ORDER.every(k => Boolean(confirmedWinners[k]))
              ? 'XEM KẾT QUẢ'
              : Object.values(confirmedWinners).some(Boolean)
              ? 'QUAY TIẾP'
              : 'BẮT ĐẦU'}
          </button>
        </div>

        <div
          className="flex-1 w-full max-w-full flex items-center justify-center z-10 my-auto"
          style={{ gap: '9.7656vw', paddingLeft: '0.625vw', paddingRight: '0.625vw' }}
        >
          {introPrizeOrder.map((key, index) => {
            const cfg = PRIZE_CONFIGS.find(p => p.key === key)!;
            const badge = getBadgeStyle(key);
            const winner = confirmedWinners[key];

            return (
              <div
                key={key}
                onClick={() => handleSelectPrize(key)}
                className="group cursor-pointer flex flex-col items-center flex-1 transition-all duration-300 hover:scale-[1.03]"
                style={{
                  width: '100%',
                  maxWidth: '33.203vw',
                  padding: '0.625vw 0.46875vw 2.734vw 0.46875vw',
                  animation: `cardSlideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.18}s both`,
                }}
              >
                <img
                  src={productImg}
                  alt={cfg.label}
                  style={{ height: '9.1796875vw' }}
                  className="w-full object-contain filter drop-shadow-[0_0.468vw_0.937vw_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-105"
                />

                <div
                  style={{
                    width: '17.1875vw',
                    height: '3.59375vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    clipPath: 'polygon(1.0156vw 0, 100% 0, 100% calc(100% - 1.0156vw), calc(100% - 1.0156vw) 100%, 0 100%, 0 1.0156vw)',
                    ...badge,
                    boxShadow: '0 0.234vw 0.781vw rgba(0,0,0,0.4)',
                    marginBottom: '0.625vw',
                  }}
                >
                  {winner ? (
                    <div className="flex flex-col items-center justify-center w-full" style={{ paddingLeft: '0.625vw', paddingRight: '0.625vw' }}>
                      <span
                        style={{
                          fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                          fontSize: winner.name.length > 22 ? '0.9375vw' : '1.09375vw',
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: '#081222',
                          textAlign: 'center',
                          lineHeight: 1.15,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '15.625vw',
                        }}
                      >
                        {winner.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                          fontSize: '0.703vw',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'rgba(8, 18, 34, 0.85)',
                          textAlign: 'center',
                          marginTop: '0.078vw',
                        }}
                      >
                        {winner.department}
                      </span>
                    </div>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'MBCorpoATitleOfcVI', serif",
                        fontSize: '2.1875vw',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#081222',
                      }}
                    >
                      {cfg.label}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontFamily: "'MBCorpoATitleOfcVI', serif",
                    fontSize: '1.0156vw',
                    fontWeight: 700,
                    color: '#ffffff',
                    textAlign: 'center',
                    letterSpacing: '0.05em',
                    lineHeight: 1,
                    marginBottom: '0.546875vw',
                    textShadow: '0 0.078vw 0.3125vw rgba(0,0,0,0.6)',
                  }}
                >
                  TỔNG GIÁ TRỊ LÊN ĐẾN {cfg.value}
                </p>

                <div className="flex flex-col text-center" style={{ gap: '0.46875vw' }}>
                  {cfg.prizes.map((prize, i) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: "'MBCorpoATitleOfcVI', serif",
                        fontSize: '0.82vw',
                        fontWeight: 600,
                        color: 'rgba(240, 248, 255, 0.95)',
                        letterSpacing: '0.02em',
                        lineHeight: 1,
                        textShadow: '0 0.078vw 0.234vw rgba(0,0,0,0.6)',
                      }}
                    >
                      {prize}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ height: '0.625vw' }} className="flex-shrink-0" />
      </div>
    );
  }

  const currentBadgeStyle = getBadgeStyle(selectedPrizeKey);
  const currentWinnerBarStyle = getWinnerBarStyle(selectedPrizeKey);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between overflow-hidden select-none"
      style={{
        backgroundImage: `url(${bgRollImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        paddingTop: '0.9375vw',
        paddingBottom: '0.9375vw',
        paddingLeft: '1.5625vw',
        paddingRight: '1.5625vw',
      }}
    >
      <button
        onClick={() => setPhase('intro')}
        className="absolute cursor-pointer z-30 flex items-center gap-2"
        style={{
          top: '0.78125vw',
          left: '0.9375vw',
          background: 'rgba(8, 18, 34, 0.65)',
          color: 'rgba(201, 162, 39, 0.85)',
          fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
          fontSize: '0.46875vw',
          letterSpacing: '0.15em',
          padding: '0.2734vw 0.625vw',
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
        ← MÀN HÌNH CHỜ
      </button>

      <div className="flex flex-col items-center z-10 flex-shrink-0" style={{ paddingTop: '0.3906vw' }}>
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
            height: '4.6875vw',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 1.367vw rgba(201,162,39,0.5))',
          }}
        />
      </div>

      <div
        className="flex-1 w-full flex items-center justify-center z-10 my-auto"
        style={{ gap: '5.46875vw', paddingLeft: '0.9375vw', paddingRight: '0.9375vw' }}
      >
        <div
          className="flex flex-col items-center flex-shrink-0"
          style={{
            width: '21.484375vw',
            padding: '0.625vw 0.781vw 1.1718vw 0.781vw',
          }}
        >
          <img
            src={productImg}
            alt={currentPrizeConfig.label}
            className="w-full h-auto object-contain filter drop-shadow-[0_0.468vw_0.937vw_rgba(0,0,0,0.6)]"
          />

          <div
            style={{
              width: '17.1875vw',
              height: '3.59375vw',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              clipPath: 'polygon(1.0156vw 0, 100% 0, 100% calc(100% - 1.0156vw), calc(100% - 1.0156vw) 100%, 0 100%, 0 1.0156vw)',
              ...currentBadgeStyle,
              boxShadow: '0 0.234vw 0.781vw rgba(0,0,0,0.4)',
              marginBottom: '0.625vw',
            }}
          >
            <span
              style={{
                fontFamily: "'MBCorpoATitleOfcVI', serif",
                fontSize: '2.1875vw',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#081222',
              }}
            >
              {currentPrizeConfig.label}
            </span>
          </div>

          <div
            style={{
              width: '100%',
              background: 'linear-gradient(90deg, rgba(15, 21, 51, 0.75) 0%, rgba(14, 22, 53, 0.75) 100%)',
              border: '0.0586vw solid #cbbe9c',
              borderRadius: '0.078vw',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)',
              padding: '0.625vw 0.781vw',
            }}
          >
            <p
              style={{
                fontFamily: "'MBCorpoATitleOfcVI', serif",
                fontSize: '1.0156vw',
                fontWeight: 700,
                color: '#ffffff',
                textAlign: 'center',
                letterSpacing: '0.05em',
                lineHeight: 1,
                marginBottom: '0.46875vw',
                textShadow: '0 0.078vw 0.3125vw rgba(0,0,0,0.6)',
              }}
            >
              TỔNG GIÁ TRỊ LÊN ĐẾN {currentPrizeConfig.value}
            </p>

            <div className="flex flex-col text-center" style={{ gap: '0.46875vw' }}>
              {currentPrizeConfig.prizes.map((prize, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: "'MBCorpoATitleOfcVI', serif",
                    fontSize: '0.82vw',
                    fontWeight: 600,
                    color: '#ffffff',
                    letterSpacing: '0.02em',
                    lineHeight: 1,
                    textShadow: '0 0.078vw 0.234vw rgba(0,0,0,0.6)',
                  }}
                >
                  {prize}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center" style={{ width: '41.015625vw' }}>
          <div
            style={{
              width: '41.015625vw',
              height: '4.6875vw',
              ...currentWinnerBarStyle,
              borderRadius: '0.078vw',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: '1.953125vw',
            }}
          >
            {phase === 'spinning' && (
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1s infinite linear',
                }}
              />
            )}

            {phase === 'spinning' && displayRollingWinner ? (
              <div className="flex items-center justify-center animate-pulse z-10" style={{ paddingLeft: '0.9375vw', paddingRight: '0.9375vw' }}>
                <span
                  style={{
                    fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                    fontSize: '1.5625vw',
                    fontWeight: 800,
                    color: '#081222',
                    letterSpacing: '0.06em',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ textTransform: 'uppercase' }}>{displayRollingWinner.name}</span>
                  <span style={{ margin: '0 0.625vw', opacity: 0.6, fontWeight: 400 }}>-</span>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{displayRollingWinner.department}</span>
                </span>
              </div>
            ) : currentWinner ? (
              <div className="flex items-center justify-center z-10 animate-fade-in" style={{ paddingLeft: '0.9375vw', paddingRight: '0.9375vw' }}>
                <span
                  style={{
                    fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                    fontSize: '1.5625vw',
                    fontWeight: 800,
                    color: '#081222',
                    letterSpacing: '0.06em',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ textTransform: 'uppercase' }}>{currentWinner.name}</span>
                  <span style={{ margin: '0 0.625vw', opacity: 0.6, fontWeight: 400 }}>-</span>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{currentWinner.department}</span>
                </span>
              </div>
            ) : (
              <span
                style={{
                  fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                  fontSize: '1.5625vw',
                  color: 'rgba(8, 18, 34, 0.4)',
                  letterSpacing: '0.3em',
                }}
              >
                
              </span>
            )}
          </div>

          <div className="flex items-center" style={{ width: '41.015625vw', gap: '1.953125vw' }}>
            {phase === 'ready' && (
              <button
                onClick={draw}
                className="cursor-pointer w-full transition-all duration-300 transform hover:scale-105 active:scale-95"
                style={{
                  width: '41.015625vw',
                  height: '3.515625vw',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(90deg, #0f1533 0%, #0e1635 100%)',
                  border: '0.0586vw solid #cbbe9c',
                  borderRadius: '0.078vw',
                  boxShadow: '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)',
                  color: '#fff5d4',
                  fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                  fontSize: '1.5625vw',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#f0d060';
                  e.currentTarget.style.boxShadow = '0 0.234vw 1.1718vw rgba(240, 208, 96, 0.4), inset 0 0.039vw 0.078vw rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbbe9c';
                  e.currentTarget.style.boxShadow = '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)';
                }}
              >
                BẮT ĐẦU
              </button>
            )}

            {phase === 'spinning' && (
              <div
                className="flex items-center justify-center rounded-sm w-full"
                style={{
                  width: '41.015625vw',
                  height: '3.515625vw',
                  gap: '0.625vw',
                  background: 'rgba(201, 162, 39, 0.2)',
                  border: '0.0586vw solid #f0d060',
                  color: '#f0d060',
                  fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                  fontSize: '1.5625vw',
                  letterSpacing: '0.15em',
                  fontWeight: 700,
                  boxShadow: '0 0 0.9765vw rgba(240,208,96,0.4)',
                }}
              >
                <span className="inline-block animate-spin">⚙</span> ĐANG QUAY SỐ...
              </div>
            )}

            {phase === 'drawn' && (
              <>
                <button
                  onClick={confirm}
                  className="flex-1 cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95"
                  style={{
                    height: '3.515625vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(90deg, #0f1533 0%, #0e1635 100%)',
                    border: '0.0586vw solid #cbbe9c',
                    borderRadius: '0.078vw',
                    boxShadow: '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)',
                    color: '#fff5d4',
                    fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                    fontSize: '1.5625vw',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#f0d060';
                    e.currentTarget.style.boxShadow = '0 0.234vw 1.1718vw rgba(240, 208, 96, 0.4), inset 0 0.039vw 0.078vw rgba(255, 255, 255, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#cbbe9c';
                    e.currentTarget.style.boxShadow = '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)';
                  }}
                >
                  XÁC NHẬN
                </button>
                <button
                  onClick={redraw}
                  className="flex-1 cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95"
                  style={{
                    height: '3.515625vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(90deg, #0f1533 0%, #0e1635 100%)',
                    border: '0.0586vw solid #cbbe9c',
                    borderRadius: '0.078vw',
                    boxShadow: '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)',
                    color: '#fff5d4',
                    fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
                    fontSize: '1.5625vw',
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#f0d060';
                    e.currentTarget.style.boxShadow = '0 0.234vw 1.1718vw rgba(240, 208, 96, 0.4), inset 0 0.039vw 0.078vw rgba(255, 255, 255, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#cbbe9c';
                    e.currentTarget.style.boxShadow = '0 0.156vw 0.9765vw rgba(0, 0, 0, 0.6), inset 0 0.039vw 0.078vw rgba(203, 190, 156, 0.4), 0 0 0.781vw rgba(203, 190, 156, 0.2)';
                  }}
                >
                  QUAY LẠI
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-center z-10 flex-shrink-0" style={{ paddingTop: '0.078vw' }}>
        <div className="flex items-center" style={{ gap: '0.46875vw' }}>
          {DRAW_PRIZE_ORDER.map(key => {
            const cfg = PRIZE_CONFIGS.find(p => p.key === key)!;
            const isConfirmed = Boolean(confirmedWinners[key]);
            const isCurrent = key === selectedPrizeKey;
            return (
              <div
                key={cfg.key}
                style={{
                  width: isConfirmed ? '1.25vw' : isCurrent ? '0.9375vw' : '0.46875vw',
                  height: '0.156vw',
                  borderRadius: '0.078vw',
                  background: isConfirmed
                    ? cfg.color
                    : isCurrent
                    ? '#f0d060'
                    : 'rgba(201,162,39,0.2)',
                  transition: 'all 0.3s ease',
                }}
              />
            );
          })}
          <span
            style={{
              fontFamily: "'MBCorpoATitleOfcVI', sans-serif",
              fontSize: '0.43vw',
              color: '#f0d060',
              letterSpacing: '0.1em',
              marginLeft: '0.234vw',
            }}
          >
            {currentPrizeConfig.label}
          </span>
        </div>
      </div>
    </div>
  );
}
