import { useState, useCallback, useEffect, useRef } from 'react';
import {
  PARTICIPANTS,
  PRIZE_CONFIGS,
  PRIZE_DRAW_ORDER,
  type Participant,
  type PrizeKey,
} from '../data/participants';
import bgSpace from '../imports/bg.jpg';
import logoGenesis from '../imports/logo-genesis.png';
import goldPodiumImg from '../imports/gold-podium.png';
import circleImg from '../imports/circle.png';
import ankerImg from '../imports/anker.png';
import airpodImg from '../imports/airpod.png';
import watchImg from '../imports/apple-watch.png';
import ipadImg from '../imports/ipad.png';
import iphoneImg from '../imports/iphone.png';
import fireworkImg from '../imports/firework.png';
import { exportGenesisLuckyDrawToExcel, getPrizeExcelFileName, type WonRecord } from '../utils/exportExcel';
import { syncManager, type ScreenMode } from '../utils/syncManager';

interface LuckyDrawProps {
  initialPrizeKey?: PrizeKey;
  onBack: () => void;
  onGoToSummary: () => void;
  allWinnersHistory: WonRecord[];
  onUpdateWinnersHistory: (history: WonRecord[]) => void;
  screenMode?: ScreenMode;
}

const PRODUCT_IMAGES: Record<PrizeKey, string> = {
  consolation: ankerImg,
  third: airpodImg,
  second: watchImg,
  first: ipadImg,
  grand: iphoneImg,
};

function AutoTeletext({
  children,
  enabled = true,
  className = '',
  style = {},
  duration = 8,
}: {
  children: React.ReactNode;
  enabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current && probeRef.current) {
        const cWidth = containerRef.current.clientWidth;
        const tWidth = probeRef.current.scrollWidth || probeRef.current.offsetWidth;
        setIsOverflowing(tWidth > cWidth + 1);
      }
    };

    measure();
    const t1 = setTimeout(measure, 30);
    const t2 = setTimeout(measure, 120);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, [children, enabled]);

  const shouldAnimate = enabled && isOverflowing;

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden flex items-center min-w-0 ${className}`}
      style={{
        position: 'relative',
        whiteSpace: 'nowrap',
        justifyContent: shouldAnimate ? 'flex-start' : 'center',
        textAlign: shouldAnimate ? 'left' : 'center',
        maskImage: shouldAnimate
          ? 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)'
          : 'none',
        WebkitMaskImage: shouldAnimate
          ? 'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)'
          : 'none',
      }}
    >
      {/* Invisible measurement probe without trailing padding to ensure 100% exact overflow detection */}
      <span
        ref={probeRef}
        aria-hidden="true"
        className="absolute pointer-events-none opacity-0 invisible shrink-0"
        style={{
          whiteSpace: 'nowrap',
          fontFamily: style?.fontFamily,
          fontSize: style?.fontSize,
          fontWeight: style?.fontWeight,
          letterSpacing: style?.letterSpacing,
        }}
      >
        {children}
      </span>

      {shouldAnimate ? (
        <div
          className="flex items-center shrink-0 animate-teletext-infinite"
          style={{
            animationDuration: `${duration}s`,
            willChange: 'transform',
            whiteSpace: 'nowrap',
            justifyContent: 'flex-start',
          }}
        >
          <span
            className="shrink-0 inline-flex items-center"
            style={{ whiteSpace: 'nowrap', paddingRight: '2.5vw', ...style }}
          >
            {children}
          </span>
          <span
            className="shrink-0 inline-flex items-center"
            style={{ whiteSpace: 'nowrap', paddingRight: '2.5vw', ...style }}
          >
            {children}
          </span>
        </div>
      ) : (
        <span
          className="shrink-0 inline-flex items-center justify-center text-center"
          style={{ whiteSpace: 'nowrap', ...style }}
        >
          {children}
        </span>
      )}
    </div>
  );
}

type SpinPhase = 'ready' | 'spinning' | 'drawn';

export default function LuckyDraw({
  initialPrizeKey = 'consolation',
  onBack,
  onGoToSummary,
  allWinnersHistory,
  onUpdateWinnersHistory,
  screenMode = 'left',
}: LuckyDrawProps) {
  const [selectedPrizeKey, setSelectedPrizeKey] = useState<PrizeKey>(initialPrizeKey);
  const initialTierWins = allWinnersHistory.filter(w => w.prizeKey === initialPrizeKey).length;
  const [isDrawReady, setIsDrawReady] = useState<boolean>(initialTierWins > 0);
  const [phase, setPhase] = useState<SpinPhase>('ready');
  const [currentRollingWinner, setCurrentRollingWinner] = useState<Participant | null>(null);
  const [pendingWinner, setPendingWinner] = useState<Participant | null>(null);
  const [fireworkKey, setFireworkKey] = useState(0);

  const spinIntervalRef = useRef<number | null>(null);
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentPrizeConfig = PRIZE_CONFIGS.find(p => p.key === selectedPrizeKey) || PRIZE_CONFIGS[0];

  // Only confirmed/committed winners for current prize tier
  const currentTierWinners = allWinnersHistory.filter(w => w.prizeKey === selectedPrizeKey);

  // Total won including pending unpinned winner
  const totalDrawnInTier = currentTierWinners.length + (pendingWinner ? 1 : 0);
  const isCurrentTierFullyDrawn = totalDrawnInTier >= currentPrizeConfig.count;

  // Pool excludes all committed winners
  const wonParticipantIds = new Set(allWinnersHistory.map(w => w.winner.id));
  if (pendingWinner) {
    wonParticipantIds.add(pendingWinner.id);
  }

  // Tier completion indicator
  const isTierCompleted = currentTierWinners.length >= currentPrizeConfig.count && !pendingWinner;

  const currPrizeIdx = PRIZE_DRAW_ORDER.indexOf(selectedPrizeKey);
  const isLastTier = currPrizeIdx >= PRIZE_DRAW_ORDER.length - 1;

  // Commit pending winner if one exists
  const commitPendingWinner = useCallback(() => {
    if (!pendingWinner) return allWinnersHistory;

    const record: WonRecord = {
      prizeKey: currentPrizeConfig.key,
      prizeLabel: currentPrizeConfig.label,
      productName: currentPrizeConfig.productName,
      productDetail: currentPrizeConfig.productDetail,
      slotIndex: currentTierWinners.length,
      winner: pendingWinner,
    };

    const updated = [...allWinnersHistory, record];
    onUpdateWinnersHistory(updated);
    setPendingWinner(null);

    // Broadcast confirmed winner to slave screens
    if (syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'CONFIRM_WINNER',
        winnersHistory: updated,
      });
    }

    // Only auto-download Excel when the entire prize tier is fully completed
    const tierWinsCount = updated.filter(w => w.prizeKey === currentPrizeConfig.key).length;
    if (tierWinsCount >= currentPrizeConfig.count && syncManager.isMaster()) {
      const fileName = getPrizeExcelFileName(currentPrizeConfig.tierTitle, currentPrizeConfig.productName);
      exportGenesisLuckyDrawToExcel(updated, fileName);
    }

    return updated;
  }, [pendingWinner, currentPrizeConfig, currentTierWinners.length, allWinnersHistory, onUpdateWinnersHistory]);

  // Confirm winner button handler
  const confirmWinner = useCallback(() => {
    if (!pendingWinner) return;
    commitPendingWinner();
    setCurrentRollingWinner(null);
    setPhase('ready');
  }, [pendingWinner, commitPendingWinner]);

  const executeSpin = useCallback((pool: Participant[], preselectedWinner?: Participant, duration = 4200) => {
    if (pool.length === 0) return;

    if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);

    setPhase('spinning');

    const poolSize = pool.length;
    const TOTAL_DURATION = duration;
    const startTime = performance.now();
    let lastTime = 0;
    let lastIdx = -1;

    // Pick final winning participant (or use synced winner)
    const winningParticipant = preselectedWinner || pool[Math.floor(Math.random() * poolSize)];

    // Broadcast to slaves if master initiated spin
    if (!preselectedWinner && syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'START_SPIN',
        winningParticipant,
        timestamp: Date.now(),
        duration: TOTAL_DURATION,
      });
    }

    const spinStep = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / TOTAL_DURATION, 1);

      // Fast continuous rolling (~40ms) throughout the entire spin for a dynamic blur effect
      const currentInterval = 40;

      if (!lastTime || time - lastTime >= currentInterval) {
        lastTime = time;

        if (progress >= 1) {
          if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
          setPendingWinner(winningParticipant);
          setCurrentRollingWinner(winningParticipant);
          setPhase('drawn');
          setFireworkKey(k => k + 1);
          return;
        }

        let randIdx = Math.floor(Math.random() * poolSize);
        if (randIdx === lastIdx) randIdx = (randIdx + 1) % poolSize;
        lastIdx = randIdx;
        setCurrentRollingWinner(pool[randIdx]);
      }

      spinIntervalRef.current = requestAnimationFrame(spinStep);
    };

    spinIntervalRef.current = requestAnimationFrame(spinStep);
  }, []);

  const startSpin = useCallback(() => {
    if (phase === 'spinning') return;

    const activeHistory = commitPendingWinner();
    const currentWinsCount = activeHistory.filter(w => w.prizeKey === selectedPrizeKey).length;
    if (currentWinsCount >= currentPrizeConfig.count) return;

    const activeWonIds = new Set(activeHistory.map(w => w.winner.id));
    const pool = PARTICIPANTS.filter(p => !activeWonIds.has(p.id));
    executeSpin(pool);
  }, [phase, commitPendingWinner, selectedPrizeKey, currentPrizeConfig, executeSpin]);

  const redrawCurrent = useCallback(() => {
    if (phase === 'spinning') return;

    if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);

    // Discard pending winner without committing to history
    setPendingWinner(null);
    setCurrentRollingWinner(null);

    if (syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'REDRAW',
        timestamp: Date.now(),
      });
    }

    // Immediately start spinning again with available pool
    const activeWonIds = new Set(allWinnersHistory.map(w => w.winner.id));
    const pool = PARTICIPANTS.filter(p => !activeWonIds.has(p.id));
    executeSpin(pool);
  }, [phase, allWinnersHistory, executeSpin]);

  const handleSetDrawReady = useCallback((ready: boolean) => {
    setIsDrawReady(ready);
    if (syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'SET_DRAW_READY',
        isDrawReady: ready,
      });
    }
  }, []);

  // Listen for sync events from Master
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((action) => {
      if (action.type === 'START_SPIN') {
        const activeWonIds = new Set(allWinnersHistory.map(w => w.winner.id));
        const pool = PARTICIPANTS.filter(p => !activeWonIds.has(p.id));
        setIsDrawReady(true);
        executeSpin(pool, action.winningParticipant, action.duration);
      } else if (action.type === 'CONFIRM_WINNER') {
        if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        setPendingWinner(null);
        setCurrentRollingWinner(null);
        setPhase('ready');
      } else if (action.type === 'SET_DRAW_READY') {
        setIsDrawReady(action.isDrawReady);
      } else if (action.type === 'REDRAW') {
        if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        setPendingWinner(null);
        setCurrentRollingWinner(null);
      } else if (action.type === 'SELECT_PRIZE') {
        if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        setPendingWinner(null);
        setCurrentRollingWinner(null);
        setPhase('ready');
        setSelectedPrizeKey(action.prizeKey);
      } else if (action.type === 'NAVIGATE') {
        if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        setPendingWinner(null);
        setCurrentRollingWinner(null);
        setPhase('ready');
      }
    });

    return unsubscribe;
  }, [allWinnersHistory, executeSpin]);

  const switchPrizeTier = useCallback((nextTierKey: PrizeKey) => {
    if (phase === 'spinning') return;

    if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);

    // Commit current pending winner if one exists
    const updatedHistory = commitPendingWinner();

    // Clear spinning frame so it doesn't show old winner
    setCurrentRollingWinner(null);
    setPendingWinner(null);
    setPhase('ready');
    setSelectedPrizeKey(nextTierKey);
    const nextTierWins = updatedHistory.filter(w => w.prizeKey === nextTierKey).length;
    const isReady = nextTierWins > 0;
    setIsDrawReady(isReady);

    if (syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'SELECT_PRIZE',
        prizeKey: nextTierKey,
      });
      syncManager.broadcast({
        type: 'SET_DRAW_READY',
        isDrawReady: isReady,
      });
    }
  }, [phase, commitPendingWinner]);

  const goToNextPrizeOrSummary = useCallback(() => {
    const updatedHistory = commitPendingWinner();
    setCurrentRollingWinner(null);
    setPendingWinner(null);
    setPhase('ready');

    const currIdx = PRIZE_DRAW_ORDER.indexOf(selectedPrizeKey);
    if (currIdx < PRIZE_DRAW_ORDER.length - 1) {
      const nextTierKey = PRIZE_DRAW_ORDER[currIdx + 1];
      setSelectedPrizeKey(nextTierKey);
      const nextTierWins = updatedHistory.filter(w => w.prizeKey === nextTierKey).length;
      const isReady = nextTierWins > 0;
      setIsDrawReady(isReady);

      if (syncManager.isMaster()) {
        syncManager.broadcast({
          type: 'SELECT_PRIZE',
          prizeKey: nextTierKey,
        });
        syncManager.broadcast({
          type: 'SET_DRAW_READY',
          isDrawReady: isReady,
        });
      }
    } else {
      if (syncManager.isMaster()) {
        syncManager.broadcast({
          type: 'NAVIGATE',
          page: 'summary',
        });
      }
      onGoToSummary();
    }
  }, [commitPendingWinner, selectedPrizeKey, onGoToSummary]);

  const handleBack = useCallback(() => {
    if (phase === 'spinning') return;
    commitPendingWinner();
    setCurrentRollingWinner(null);
    setPendingWinner(null);
    setPhase('ready');
    setIsDrawReady(false);

    if (syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'NAVIGATE',
        page: 'prize-selection',
      });
    }
    onBack();
  }, [phase, commitPendingWinner, onBack]);

  useEffect(() => {
    setSelectedPrizeKey(initialPrizeKey);
    setPendingWinner(null);
    setCurrentRollingWinner(null);
    setPhase('ready');
  }, [initialPrizeKey]);

  useEffect(() => {
    const tierWins = allWinnersHistory.filter(w => w.prizeKey === selectedPrizeKey).length;
    if (tierWins > 0) {
      setIsDrawReady(true);
    }
  }, [selectedPrizeKey, allWinnersHistory]);

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) cancelAnimationFrame(spinIntervalRef.current);
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') {
        e.preventDefault();
        switchPrizeTier('grand');
      } else if (e.key === '2') {
        e.preventDefault();
        switchPrizeTier('first');
      } else if (e.key === '3') {
        e.preventDefault();
        switchPrizeTier('second');
      } else if (e.key === '4') {
        e.preventDefault();
        switchPrizeTier('third');
      } else if (e.key === '5') {
        e.preventDefault();
        switchPrizeTier('consolation');
      } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (isTierCompleted) {
          goToNextPrizeOrSummary();
          return;
        }
        if (!isDrawReady) {
          handleSetDrawReady(true);
          return;
        }
        if (phase === 'drawn') {
          confirmWinner();
          return;
        }
        if (phase === 'ready') {
          startSpin();
        }
      } else if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') {
        e.preventDefault();
        commitPendingWinner();
        onGoToSummary();
      } else if (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        let activeHistory = allWinnersHistory;
        if (pendingWinner) {
          const record: WonRecord = {
            prizeKey: currentPrizeConfig.key,
            prizeLabel: currentPrizeConfig.label,
            productName: currentPrizeConfig.productName,
            productDetail: currentPrizeConfig.productDetail,
            slotIndex: currentTierWinners.length,
            winner: pendingWinner,
          };
          activeHistory = [...allWinnersHistory, record];
        }
        const fileName = getPrizeExcelFileName(currentPrizeConfig.tierTitle, currentPrizeConfig.productName);
        exportGenesisLuckyDrawToExcel(activeHistory, fileName);
      } else if (e.key === 'u' || e.key === 'U' || e.key === 'Delete') {
        e.preventDefault();
        if (phase === 'drawn') {
          redrawCurrent();
        }
      } else if (e.key === 'd' || e.key === 'D' || e.code === 'KeyD') {
        e.preventDefault();
        goToNextPrizeOrSummary();
      } else if (e.code === 'Backspace' || e.key === 'h' || e.key === 'H' || e.key === 'Escape') {
        e.preventDefault();
        handleBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isTierCompleted, isCurrentTierFullyDrawn, isDrawReady, pendingWinner, currentPrizeConfig, currentTierWinners.length, allWinnersHistory, startSpin, confirmWinner, redrawCurrent, goToNextPrizeOrSummary, handleBack, switchPrizeTier, commitPendingWinner, onGoToSummary, handleSetDrawReady]);

  const displayWinner = phase === 'spinning' ? currentRollingWinner : (phase === 'drawn' ? pendingWinner : null);

  const isAllTotalFinished = PRIZE_CONFIGS.every(cfg => {
    const wins = allWinnersHistory.filter(w => w.prizeKey === cfg.key);
    return wins.length >= cfg.count;
  });

  const HIGH_TO_LOW_ORDER: PrizeKey[] = ['grand', 'first', 'second', 'third', 'consolation'];

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
          minHeight: '5.5vw',
          paddingTop: '1.4vw',
          paddingBottom: '1.4vw',
          paddingLeft: '2.083vw',
          paddingRight: '2.083vw',
        }}
      >
        <div style={{ width: '14.84375vw', height: '4.5vw' }} />
      </div>

      {/* Main Content: Left Product (1200px / 39.0625vw) & Right Draw Info (1000px / 32.5521vw) - Switched on Right Screen */}
      <div
        className={`relative z-10 flex-1 w-full flex ${
          screenMode === 'right' ? 'flex-row-reverse' : 'flex-row'
        } items-center justify-center transition-all duration-500`}
        style={{
          paddingLeft: '2.083vw',
          paddingRight: '2.083vw',
          paddingTop: '0.52vw',
          paddingBottom: '0.52vw',
          gap: '3.90625vw',
          transform: contentTransform,
        }}
      >
        {/* Left Column: Product Showcase (1200px / 39.0625vw) */}
        <div
          className="relative flex flex-col items-center justify-center shrink-0 animate-slide-in-left"
          style={{
            width: '39.0625vw',
            maxWidth: '39.0625vw',
            height: '100%',
          }}
        >
          {/* Stage: Floating Product, Golden Halo Arch & Gold Podium */}
          <div
            className="relative flex flex-col items-center justify-end"
            style={{
              width: '34.3424vw',
              height: '26vw',
              overflow: 'visible',
            }}
          >
            {/* Circular Amber-Orange Radiant Aura behind Circle (Unclipped) */}
            <div
              className="absolute pointer-events-none z-0 animate-amber-aura"
              style={{
                width: '38vw',
                height: '38vw',
                bottom: '-8vw',
                left: '50%',
                background: 'radial-gradient(circle at 50% 50%, rgba(255, 145, 0, 0.45) 0%, rgba(245, 158, 11, 0.22) 36%, rgba(217, 119, 6, 0.06) 58%, transparent 72%)',
                borderRadius: '50%',
                filter: 'blur(2vw)',
                overflow: 'visible',
              }}
            />

            {/* Golden Halo Arch (circle.png) behind product, standing on podium (Unclipped) */}
            <div
              className="absolute pointer-events-none z-0 flex items-center justify-center"
              style={{
                width: '38vw',
                bottom: '-0.3724vw',
                left: '50%',
                transform: 'translateX(-50%)',
                overflow: 'visible',
              }}
            >
              <img
                src={circleImg}
                alt="Golden Halo Arch"
                className="w-full h-auto select-none animate-halo-arch"
                style={{
                  maxWidth: 'none',
                }}
              />
            </div>

            {/* Golden Floor Glow / Shadow underneath podium base */}
            <div
              className="absolute pointer-events-none z-0"
              style={{
                width: '32vw',
                height: '3.6vw',
                bottom: '-0.8vw',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'radial-gradient(ellipse at 50% 50%, rgba(251, 191, 36, 0.75) 0%, rgba(245, 158, 11, 0.45) 35%, rgba(217, 119, 6, 0.15) 65%, transparent 80%)',
                borderRadius: '50%',
                filter: 'blur(0.6vw)',
                boxShadow: '0 0.4vw 2.5vw rgba(245, 158, 11, 0.55), 0 0 4vw rgba(251, 191, 36, 0.35)',
              }}
            />

            {/* Floating Product Image - height 568px / 18.4896vw */}
            <div
              className="relative z-20 animate-float-slow flex items-end justify-center"
              style={{
                height: '18.4896vw',
                width: '100%',
                marginBottom: '-1.5vw',
              }}
            >
              <img
                key={selectedPrizeKey}
                src={PRODUCT_IMAGES[selectedPrizeKey]}
                alt={currentPrizeConfig.productName}
                style={{
                  height: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0.8vw 1.6vw rgba(0, 0, 0, 0.65))',
                }}
              />
            </div>

            {/* Gold Podium underneath - width 1055px / 34.3424vw */}
            <div
              className="relative z-10 flex items-center justify-center"
              style={{
                width: '34.3424vw',
                height: '10.97vw',
              }}
            >
              <img
                src={goldPodiumImg}
                alt="Gold Podium"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Draw Info, Spinning Box, Pinned List, Controls (970px / 31.5755vw) */}
        <div
          className="relative flex flex-col justify-center items-center shrink-0 animate-slide-in-right"
          style={{
            width: '31.57552vw',
            maxWidth: '31.57552vw',
            height: '100%',
          }}
        >
          {!isDrawReady && currentTierWinners.length === 0 ? (
            /* Prep / Pre-draw State: Large H2, Boxed Product Name (border-radius 70px), Subname */
            <div className="flex flex-col items-center text-center animate-fade-in-up w-full">
              {/* h2 size adjusted for perfect single-line fitting across all tiers */}
              <h2
                style={{
                  fontFamily: "'SF Pro Display', sans-serif",
                  fontSize: selectedPrizeKey === 'consolation' ? '2.4vw' : '2.85vw',
                  letterSpacing: '0.04em',
                  lineHeight: 1.1,
                  display: 'inline-block',
                  background: 'linear-gradient(180deg, #ffeed6 25%, #edd199 65%, #dabd81 80%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  marginBottom: '1.790365vw', // 55px
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontWeight: 500, marginRight: '0.55vw' }}>
                  {currentPrizeConfig.tierNumber}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {currentPrizeConfig.tierTitle}
                </span>
              </h2>

              {/* Tên quà: box 970x120, border 1px #f5cf81, background #04162d, border-radius 70px, color text #fff, margin bottom 37px */}
              <div
                className="w-full flex items-center justify-center relative"
                style={{
                  width: '31.57552vw', // 970px
                  height: '3.90625vw', // 120px
                  background: '#04162d',
                  border: '1px solid #f5cf81',
                  borderRadius: '2.278646vw', // 70px (70/3072*100vw)
                  boxShadow: '0 0.26vw 1.302vw rgba(0,0,0,0.6), inset 0 0 0.65vw rgba(245, 207, 129, 0.2)',
                  paddingTop: '0.9765625vw',
                  paddingBottom: '0.9765625vw',
                  paddingLeft: '1.302vw',
                  paddingRight: '1.302vw',
                  marginBottom: currentPrizeConfig.productDetail ? '1.204427vw' : '0', // 37px
                  overflow: 'visible',
                }}
              >
                {/* Soft ambient radiating aura overlay */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: '-14vw',
                    bottom: '-6.5vw',
                    left: '-7.5vw',
                    right: '-7.5vw',
                    background: 'radial-gradient(ellipse at 50% 60%, rgba(24, 12, 51, 0.82) 0%, rgba(24, 12, 51, 0.5) 38%, rgba(24, 12, 51, 0.18) 68%, transparent 88%)',
                    borderRadius: '50%',
                    filter: 'blur(2vw)',
                    zIndex: -1,
                  }}
                />

                <span
                  style={{
                    fontFamily: "'SF Pro Display', sans-serif",
                    fontSize: selectedPrizeKey === 'consolation' ? '1.95vw' : '2.3vw',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.02em',
                    lineHeight: 1.15,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentPrizeConfig.productName}
                </span>
              </div>

              {/* Subname font size adjusted to avoid wrapping */}
              {currentPrizeConfig.productDetail && (
                <p
                  style={{
                    fontFamily: "'SF Pro Display', sans-serif",
                    fontSize: selectedPrizeKey === 'consolation' ? '1.45vw' : '1.75vw',
                    fontWeight: 500,
                    color: '#ffffff',
                    letterSpacing: '0.02em',
                    lineHeight: 1.15,
                    textAlign: 'center',
                    opacity: 0.9,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentPrizeConfig.productDetail}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Header Title */}
              <div className="flex flex-col items-center text-center">
                {/* h2: linear top-to-bottom ffeed6 -> dabd81 */}
                <h2
                  style={{
                    fontFamily: "'SF Pro Display', sans-serif",
                    fontSize: selectedPrizeKey === 'consolation' ? '2.25vw' : '2.604167vw',
                    letterSpacing: '0.04em',
                    lineHeight: 1.1,
                    display: 'inline-block',
                    background: 'linear-gradient(180deg, #ffeed6 25%, #edd199 65%, #dabd81 80%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '1.497395vw',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontWeight: 500, marginRight: '0.45vw' }}>
                    {currentPrizeConfig.tierNumber}
                  </span>
                  <span style={{ fontWeight: 700 }}>
                    {currentPrizeConfig.tierTitle}
                  </span>
                </h2>

                {/* Tên quà: color #fff, size 70px (adjusted for consolation), margin bottom 50px */}
                <p
                  style={{
                    fontFamily: "'SF Pro Display', sans-serif",
                    fontSize: selectedPrizeKey === 'consolation' ? '1.95vw' : '2.278645vw',
                    fontWeight: 500,
                    color: '#ffffff',
                    letterSpacing: '0.02em',
                    lineHeight: 1.15,
                    marginBottom: '1.627604vw',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentPrizeConfig.productName}
                </p>
              </div>

              {/* Tên người trúng giải: box 970x120, border 1px f5cf81, background 04162d, border-radius 35px, padding y 30px, margin bottom 65px */}
              <div
                className={`w-full flex items-center justify-center relative transition-all duration-500 ${
                  isTierCompleted
                    ? 'animate-celebrate-box'
                    : phase === 'spinning'
                    ? 'animate-pulse-gold'
                    : ''
                }`}
                style={{
                  width: '31.57552vw',
                  height: '3.90625vw',
                  background: '#04162d',
                  border: isTierCompleted ? '1.5px solid #ffe699' : '1px solid #f5cf81',
                  borderRadius: '1.13932vw', // 35px (35/3072*100vw)
                  boxShadow: isTierCompleted
                    ? '0 0 3.2vw rgba(255, 215, 0, 0.85), inset 0 0 1.2vw rgba(255, 242, 190, 0.4)'
                    : phase === 'spinning'
                    ? '0 0 2.6vw rgba(244, 203, 102, 0.7), inset 0 0 1.3vw rgba(244, 203, 102, 0.4)'
                    : '0 0.26vw 1.302vw rgba(0,0,0,0.6), inset 0 0 0.65vw rgba(245, 207, 129, 0.2)',
                  paddingTop: '0.9765625vw',
                  paddingBottom: '0.9765625vw',
                  paddingLeft: '1.302vw',
                  paddingRight: '1.302vw',
                  marginBottom: '2.115885vw',
                  overflow: 'visible',
                }}
              >
                {/* Soft ambient radiating aura overlay reaching up to title area (#180c33 base) */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: '-14vw',
                    bottom: '-6.5vw',
                    left: '-7.5vw',
                    right: '-7.5vw',
                    background: isTierCompleted
                      ? 'radial-gradient(ellipse at 50% 60%, rgba(212, 160, 23, 0.35) 0%, rgba(24, 12, 51, 0.6) 45%, transparent 88%)'
                      : 'radial-gradient(ellipse at 50% 60%, rgba(24, 12, 51, 0.82) 0%, rgba(24, 12, 51, 0.5) 38%, rgba(24, 12, 51, 0.18) 68%, transparent 88%)',
                    borderRadius: '50%',
                    filter: 'blur(2vw)',
                    zIndex: -1,
                  }}
                />

                {isTierCompleted ? (
                  <div className="z-10 flex items-center justify-center gap-[0.8vw] animate-congrats-text select-none">
                    <span className="text-[1.2vw] select-none">✨</span>
                    <span
                      style={{
                        fontFamily: "'SF Pro Display', sans-serif",
                        fontSize: '1.95vw',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                      }}
                    >
                      CONGRATULATIONS
                    </span>
                    <span className="text-[1.2vw] select-none">✨</span>
                  </div>
                ) : displayWinner ? (
                  <AutoTeletext
                    enabled={phase === 'drawn'}
                    duration={8}
                    className="z-10"
                    style={{
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontSize: '1.790364vw',
                      letterSpacing: '0.04em',
                      background: 'linear-gradient(180deg, #ffeed6 25%, #edd199 65%, #dabd81 80%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    <span style={{ textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {displayWinner.name}
                    </span>
                    <span style={{ margin: '0 0.651vw', fontWeight: 500, opacity: 0.8, whiteSpace: 'nowrap' }}>
                      |
                    </span>
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {displayWinner.code}
                    </span>
                  </AutoTeletext>
                ) : (
                  <span
                    className="z-10 text-center"
                    style={{
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontSize: '1.171875vw',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textAlign: 'center',
                      background: 'linear-gradient(180deg, #ffeed6 25%, #edd199 65%, #dabd81 80%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      opacity: 0.7,
                    }}
                  >
                    SẴN SÀNG QUAY THƯỞNG
                  </span>
                )}

                {/* Firework Burst Directly from the Winner Name Box Center */}
                {phase === 'drawn' && (
                  <img
                    key={fireworkKey}
                    src={fireworkImg}
                    alt="Firework"
                    className="pointer-events-none z-50 animate-firework-zoom"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: '75vw',
                      maxWidth: '2400px',
                      height: 'auto',
                      transformOrigin: 'center center',
                      filter: 'drop-shadow(0 0 2.5vw rgba(255, 255, 255, 0.95)) brightness(1.25)',
                    }}
                  />
                )}
              </div>

              {/* Pinned Winner Slots Grid / Flex Layout */}
              {(() => {
                const isConsolation = selectedPrizeKey === 'consolation';
                const isThird = selectedPrizeKey === 'third';
                const isSingleCol = !isConsolation && !isThird;

                // Giải 3: layout 3 item row 1, 2 item row 2, gap y 41px, font 29px, name SF Bold, sub SF Medium, padding y 12px, x 65px
                if (isThird) {
                  const gapX = '0.651vw'; // 20px
                  const gapY = '1.334635vw'; // 41px (gap y 41px)
                  const itemWidth = `calc((100% - 2 * ${gapX}) / 3)`;

                  return (
                    <div
                      className="w-full flex flex-wrap justify-center"
                      style={{
                        rowGap: gapY,
                        columnGap: gapX,
                        marginBottom: '1.4vw',
                        minHeight: '7.8vw',
                      }}
                    >
                      {Array.from({ length: 5 }).map((_, slotIdx) => {
                        const wonRecord = currentTierWinners[slotIdx];

                        if (!wonRecord) {
                          return (
                            <div
                              key={slotIdx}
                              style={{
                                width: itemWidth,
                                height: '2.4414vw',
                              }}
                            />
                          );
                        }

                        return (
                          <div
                            key={slotIdx}
                            className="flex flex-col items-center justify-center text-center animate-slot-reveal min-w-0"
                            style={{
                              width: itemWidth,
                              height: '2.4414vw',
                              padding: '0.2vw 0.8vw',
                              background: 'linear-gradient(90deg, rgba(24, 12, 51, 0) 0%, rgba(24, 12, 51, 0.95) 10%, #180c33 22%, #180c33 78%, rgba(24, 12, 51, 0.95) 90%, rgba(24, 12, 51, 0.100%)',
                              borderRadius: '0.26vw',
                              overflow: 'hidden',
                            }}
                          >
                            <AutoTeletext
                              enabled={true}
                              duration={7}
                              style={{
                                fontFamily: "'SF Pro Display', sans-serif",
                                fontSize: '0.944vw',
                                fontWeight: 700,
                                color: '#ffecd4',
                                letterSpacing: '0.04em',
                                lineHeight: 1.15,
                              }}
                            >
                              <span className="uppercase" style={{ whiteSpace: 'nowrap' }}>{wonRecord.winner.name}</span>
                            </AutoTeletext>
                            <div
                              className="truncate w-full flex items-center justify-center"
                              style={{
                                fontFamily: "'SF Pro Display', sans-serif",
                                fontSize: '0.78vw',
                                fontWeight: 500,
                                color: '#eacc8e',
                                letterSpacing: '0.04em',
                                lineHeight: 1.15,
                                marginTop: '0.065vw',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span>{wonRecord.winner.code}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Standard Grid for Grand (1), First (2), Second (3), Consolation (9)
                const columnGap = isConsolation ? '0.45vw' : '0.651vw';
                const rowGap = isConsolation
                  ? '0.45vw'
                  : selectedPrizeKey === 'second'
                  ? '0.7vw'
                  : '0.85vw';

                const slotHeight = isConsolation
                  ? '2.4vw'
                  : selectedPrizeKey === 'second'
                  ? '3.0vw'
                  : selectedPrizeKey === 'first'
                  ? '3.2vw'
                  : '3.8vw';

                const nameFontSize = isConsolation
                  ? '0.944vw'
                  : selectedPrizeKey === 'second'
                  ? '1.25vw'
                  : selectedPrizeKey === 'first'
                  ? '1.35vw'
                  : '1.45vw';

                const codeFontSize = isConsolation
                  ? '0.75vw'
                  : selectedPrizeKey === 'second'
                  ? '0.95vw'
                  : selectedPrizeKey === 'first'
                  ? '1.0vw'
                  : '1.05vw';

                const slotPadding = isConsolation
                  ? '0.2vw 0.5vw'
                  : isSingleCol
                  ? '0.35vw 2vw'
                  : '0.2vw 1.2vw';

                const minHeight = isConsolation
                  ? '8.95vw'
                  : selectedPrizeKey === 'second'
                  ? '10.9vw'
                  : selectedPrizeKey === 'first'
                  ? '7.75vw'
                  : '3.8vw';

                return (
                  <div
                    className="w-full grid"
                    style={{
                      gridTemplateColumns: `repeat(${currentPrizeConfig.gridCols}, minmax(0, 1fr))`,
                      columnGap,
                      rowGap,
                      marginBottom: '1.4vw',
                      minHeight,
                    }}
                  >
                    {Array.from({ length: currentPrizeConfig.count }).map((_, slotIdx) => {
                      const wonRecord = currentTierWinners[slotIdx];

                      if (!wonRecord) {
                        return (
                          <div
                            key={slotIdx}
                            style={{
                              height: slotHeight,
                            }}
                          />
                        );
                      }

                      return (
                        <div
                          key={slotIdx}
                          className="flex flex-col items-center justify-center text-center animate-slot-reveal min-w-0"
                          style={{
                            height: slotHeight,
                            padding: slotPadding,
                            background: 'linear-gradient(90deg, rgba(24, 12, 51, 0) 0%, rgba(24, 12, 51, 0.95) 10%, #180c33 22%, #180c33 78%, rgba(24, 12, 51, 0.95) 90%, rgba(24, 12, 51, 100%)',
                            borderRadius: isSingleCol ? '0.35vw' : '0.26vw',
                            overflow: 'hidden',
                          }}
                        >
                          <AutoTeletext
                            enabled={true}
                            duration={7}
                            style={{
                              fontFamily: "'SF Pro Display', sans-serif",
                              fontSize: nameFontSize,
                              fontWeight: 700,
                              color: '#ffecd4',
                              letterSpacing: '0.04em',
                              lineHeight: 1.15,
                            }}
                          >
                            <span className="uppercase" style={{ whiteSpace: 'nowrap' }}>{wonRecord.winner.name}</span>
                          </AutoTeletext>
                          <div
                            className="truncate w-full flex items-center justify-center"
                            style={{
                              fontFamily: "'SF Pro Display', sans-serif",
                              fontSize: codeFontSize,
                              fontWeight: 500,
                              color: '#eacc8e',
                              letterSpacing: '0.04em',
                              lineHeight: 1.15,
                              marginTop: isSingleCol ? '0.08vw' : '0.065vw',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span>{wonRecord.winner.code}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Bottom Action Controls Area */}
              <div
                className="w-full flex items-center justify-center z-20"
                style={{ minHeight: '3.125vw', marginTop: '0.2vw' }}
              >
                {/* Case 1: Active Spinning Indicator */}
                {phase === 'spinning' && (
                  <div
                    className="flex items-center justify-center rounded-full animate-pulse select-none"
                    style={{
                      height: '2.86vw',
                      padding: '0 2.2vw',
                      gap: '0.6vw',
                      background: 'rgba(212, 160, 23, 0.22)',
                      border: '0.08vw solid #f4cb66',
                      color: '#f4cb66',
                      fontFamily: "'SF Pro Display', sans-serif",
                      fontSize: '0.92vw',
                      letterSpacing: '0.14em',
                      fontWeight: 700,
                      boxShadow: '0 0 1.2vw rgba(244,203,102,0.4)',
                    }}
                  >
                    <span className="inline-block animate-spin text-[1.1vw]">⚙</span>
                    <span>ĐANG QUAY...</span>
                  </div>
                )}

                {/* Case 2: Drawn Winner - Action Button to Pin / Confirm Winner */}
                {phase === 'drawn' && (
                  <div className="flex items-center gap-[1.2vw] animate-slide-in-up">
                    <button
                      type="button"
                      onClick={redrawCurrent}
                      className="cursor-pointer group flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
                      style={{
                        height: '2.86vw',
                        padding: '0 1.8vw',
                        borderRadius: '1.43vw',
                        background: 'rgba(10, 20, 48, 0.85)',
                        border: '1px solid rgba(244, 203, 102, 0.5)',
                        color: '#f4cb66',
                        fontFamily: "'SF Pro Display', sans-serif",
                        fontSize: '0.85vw',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                      }}
                    >
                      <span>🔄 QUAY LẠI</span>
                    </button>

                    <button
                      type="button"
                      onClick={confirmWinner}
                      className="cursor-pointer group relative flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 animate-celebrate-box"
                      style={{
                        height: '2.86vw',
                        padding: '0 2.4vw',
                        borderRadius: '1.43vw',
                        background: 'linear-gradient(135deg, #ffe082 0%, #d4a017 50%, #b8860b 100%)',
                        border: '1px solid #ffffff',
                        boxShadow: '0 0 2vw rgba(244, 203, 102, 0.8), inset 0 0 0.8vw rgba(255,255,255,0.6)',
                        color: '#0d051c',
                        fontFamily: "'SF Pro Display', sans-serif",
                        fontSize: '0.92vw',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                      }}
                    >
                      <span className="flex items-center gap-[0.5vw]">
                        <span className="text-[1.1vw]">✓</span>
                        XÁC NHẬN
                      </span>
                    </button>
                  </div>
                )}

                {/* Case 3: Tier Completed - Move to Next Tier or Summary */}
                {phase === 'ready' && isTierCompleted && (
                  <div className="flex items-center justify-center animate-slide-in-up">
                    <button
                      type="button"
                      onClick={goToNextPrizeOrSummary}
                      className="cursor-pointer group relative flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 animate-pulse-gold"
                      style={{
                        height: '2.95vw',
                        padding: '0 2.6vw',
                        borderRadius: '1.475vw',
                        background: isLastTier
                          ? 'linear-gradient(135deg, #ffd54f 0%, #ffb300 50%, #ff8f00 100%)'
                          : 'linear-gradient(135deg, #fff3b0 0%, #ffd700 50%, #e6a800 100%)',
                        border: '0.08vw solid #ffffff',
                        boxShadow: '0 0 2.2vw rgba(255, 215, 0, 0.75), inset 0 0 0.8vw rgba(255,255,255,0.7)',
                        color: '#0d051c',
                        fontFamily: "'SF Pro Display', sans-serif",
                        fontSize: '0.96vw',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                      }}
                    >
                      <span className="flex items-center gap-[0.6vw]">
                        {isLastTier ? (
                          <>
                            <span>🏆</span>
                            XEM TỔNG KẾT
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-[1.05vw] h-[1.05vw]"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
                            </svg>
                            GIẢI TIẾP THEO
                            <svg className="w-[1.1vw] h-[1.1vw] transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </>
                        )}
                      </span>
                    </button>
                  </div>
                )}

                {/* Case 4: Ready to spin initial or next slot */}
                {phase === 'ready' && !isTierCompleted && (
                  <div className="flex items-center justify-center animate-slide-in-up">
                    <button
                      type="button"
                      onClick={startSpin}
                      className="cursor-pointer group relative flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
                      style={{
                        height: '2.86vw',
                        padding: '0 2.4vw',
                        borderRadius: '1.43vw',
                        background: 'linear-gradient(135deg, #ffe082 0%, #d4a017 50%, #b8860b 100%)',
                        border: '1px solid #ffffff',
                        boxShadow: '0 0 1.6vw rgba(244, 203, 102, 0.6), inset 0 0 0.6vw rgba(255,255,255,0.4)',
                        color: '#180c33',
                        fontFamily: "'SF Pro Display', sans-serif",
                        fontSize: '0.92vw',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                      }}
                    >
                      <span className="flex items-center gap-[0.55vw]">
                        <svg
                          className="w-[1.1vw] h-[1.1vw]"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
                        </svg>
                        {currentTierWinners.length === 0 ? 'BẮT ĐẦU QUAY' : 'QUAY LƯỢT TIẾP THEO'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
