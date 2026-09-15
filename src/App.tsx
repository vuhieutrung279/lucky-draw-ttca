import { useState, useEffect, useCallback, useRef } from 'react';
import bgSpace from './imports/bg.jpg';
import bgLeft from './imports/bg-left.png';
import bgRight from './imports/bg-right.png';
import logoGenesis from './imports/logo-genesis.png';
import HomePage from './components/HomePage';
import PrizeSelection from './components/PrizeSelection';
import LuckyDraw from './components/LuckyDraw';
import SummaryResults from './components/SummaryResults';
import ScreenGuideOverlay from './components/ScreenGuideOverlay';
import type { PrizeKey } from './data/participants';
import { exportGenesisLuckyDrawToExcel, type WonRecord } from './utils/exportExcel';
import { syncManager, type ScreenMode, type Page } from './utils/syncManager';

export default function App() {
  // Initialize screenMode from URL param ?screen=left | right | standard
  const [screenMode, setScreenMode] = useState<ScreenMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('screen');
      if (s === 'left' || s === 'right' || s === 'standard') {
        return s;
      }
      const saved = localStorage.getItem('__genesis_luckydraw_screen_mode__');
      if (saved === 'left' || saved === 'right' || saved === 'standard') {
        return saved;
      }
    }
    return 'left';
  });

  const [showGuide, setShowGuide] = useState(false);

  // Initialize state from persistent storage so ANY screen opening first/after gets identical state
  const [page, setPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('__genesis_luckydraw_app_state__');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.page) return parsed.page;
        }
      } catch {}
    }
    return 'home';
  });

  const [selectedPrizeKey, setSelectedPrizeKey] = useState<PrizeKey>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('__genesis_luckydraw_app_state__');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.selectedPrizeKey) return parsed.selectedPrizeKey;
        }
      } catch {}
    }
    return 'consolation';
  });

  const [winnersHistory, setWinnersHistory] = useState<WonRecord[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('__genesis_luckydraw_app_state__');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.winnersHistory)) return parsed.winnersHistory;
        }
      } catch {}
    }
    return [];
  });

  const [transitionKey, setTransitionKey] = useState(0);

  // Persist shared state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          '__genesis_luckydraw_app_state__',
          JSON.stringify({
            page,
            selectedPrizeKey,
            winnersHistory,
            updatedAt: Date.now(),
          })
        );
      } catch {}
    }
  }, [page, selectedPrizeKey, winnersHistory]);

  // Sync screenMode to syncManager and localStorage
  useEffect(() => {
    syncManager.setScreenMode(screenMode);
    localStorage.setItem('__genesis_luckydraw_screen_mode__', screenMode);
  }, [screenMode]);

  const navigateTo = useCallback((nextPage: Page) => {
    setPage(nextPage);
    setTransitionKey(k => k + 1);

    if (syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'NAVIGATE',
        page: nextPage,
      });
    }
  }, []);

  const handleSelectPrize = useCallback((key: PrizeKey) => {
    setSelectedPrizeKey(key);

    if (syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'SELECT_PRIZE',
        prizeKey: key,
      });
    }
  }, []);

  const stateRef = useRef({ page, selectedPrizeKey, winnersHistory });
  useEffect(() => {
    stateRef.current = { page, selectedPrizeKey, winnersHistory };
  }, [page, selectedPrizeKey, winnersHistory]);

  // Listen to remote actions from Master Screen + direct cross-tab storage sync
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((action) => {
      if (action.type === 'NAVIGATE') {
        setPage(prev => (prev !== action.page ? action.page : prev));
        setTransitionKey(k => k + 1);
      } else if (action.type === 'SELECT_PRIZE') {
        setSelectedPrizeKey(prev => (prev !== action.prizeKey ? action.prizeKey : prev));
      } else if (action.type === 'REQUEST_SYNC') {
        // If master receives REQUEST_SYNC, reply with full current state
        if (syncManager.isMaster()) {
          syncManager.broadcast({
            type: 'FULL_STATE_SYNC',
            page: stateRef.current.page,
            selectedPrizeKey: stateRef.current.selectedPrizeKey,
            isDrawReady: true,
            winnersHistory: stateRef.current.winnersHistory,
          });
        }
      } else if (action.type === 'FULL_STATE_SYNC') {
        setPage(prev => (prev !== action.page ? action.page : prev));
        setSelectedPrizeKey(prev => (prev !== action.selectedPrizeKey ? action.selectedPrizeKey : prev));
        setWinnersHistory(prev => {
          if (JSON.stringify(prev) === JSON.stringify(action.winnersHistory)) {
            return prev;
          }
          return action.winnersHistory;
        });
      } else if (action.type === 'CONFIRM_WINNER') {
        setWinnersHistory(prev => {
          if (JSON.stringify(prev) === JSON.stringify(action.winnersHistory)) {
            return prev;
          }
          return action.winnersHistory;
        });
      }
    });

    // Cross-tab direct storage listener for instantaneous same-origin sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === '__genesis_luckydraw_app_state__' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.page) {
            setPage(prev => (prev !== parsed.page ? parsed.page : prev));
          }
          if (parsed.selectedPrizeKey) {
            setSelectedPrizeKey(prev => (prev !== parsed.selectedPrizeKey ? parsed.selectedPrizeKey : prev));
          }
          if (Array.isArray(parsed.winnersHistory)) {
            setWinnersHistory(prev => {
              if (JSON.stringify(prev) === JSON.stringify(parsed.winnersHistory)) {
                return prev;
              }
              return parsed.winnersHistory;
            });
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Initial sync requests
    if (!syncManager.isMaster()) {
      syncManager.broadcast({
        type: 'REQUEST_SYNC',
        timestamp: Date.now(),
      });
    } else {
      // Master broadcasts initial state on startup
      syncManager.broadcast({
        type: 'FULL_STATE_SYNC',
        page: stateRef.current.page,
        selectedPrizeKey: stateRef.current.selectedPrizeKey,
        isDrawReady: true,
        winnersHistory: stateRef.current.winnersHistory,
      });
    }

    // Periodic Heartbeat Sync (every 1.5s from Master, or periodic check from Slave)
    const heartbeatInterval = setInterval(() => {
      if (syncManager.isMaster()) {
        syncManager.broadcast({
          type: 'FULL_STATE_SYNC',
          page: stateRef.current.page,
          selectedPrizeKey: stateRef.current.selectedPrizeKey,
          isDrawReady: true,
          winnersHistory: stateRef.current.winnersHistory,
        });
      } else {
        // If slave, ping request sync periodically to guarantee catching up if master opened later
        syncManager.broadcast({
          type: 'REQUEST_SYNC',
          timestamp: Date.now(),
        });
      }
    }, 1500);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(heartbeatInterval);
    };
  }, []);

  // Mode cycle helper
  const cycleScreenMode = useCallback(() => {
    setScreenMode(prev => {
      const next: ScreenMode = prev === 'left' ? 'right' : prev === 'right' ? 'standard' : 'left';
      const url = new URL(window.location.href);
      url.searchParams.set('screen', next);
      window.history.replaceState({}, '', url.toString());
      return next;
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
        }
      } else if (e.key === 'g' || e.key === 'G' || e.code === 'KeyG') {
        e.preventDefault();
        setShowGuide(prev => !prev);
      } else if (e.key === 'm' || e.key === 'M' || e.code === 'KeyM') {
        e.preventDefault();
        cycleScreenMode();
      } else if (e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        exportGenesisLuckyDrawToExcel(winnersHistory);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [winnersHistory, cycleScreenMode]);

  const logoTransform =
    screenMode === 'left'
      ? 'translateX(-11.5vw)'
      : screenMode === 'right'
      ? 'translateX(11.5vw)'
      : 'none';

  const currentBg =
    screenMode === 'left'
      ? bgLeft
      : screenMode === 'right'
      ? bgRight
      : bgSpace;

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        backgroundImage: `url(${currentBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#040714',
      }}
    >
      {/* Visual LED Trapezoid Cut Alignment Guide */}
      {showGuide && (
        <ScreenGuideOverlay
          screenMode={screenMode}
          onClose={() => setShowGuide(false)}
        />
      )}

      {/* Permanent Fixed Dark Backdrop Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
        }}
      />

      {/* Cinematic Flash Light Wash on Page Transition */}
      <div
        key={`flare-${transitionKey}`}
        className="absolute inset-0 z-50 pointer-events-none animate-flash-sweep"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(244, 203, 102, 0.4) 0%, rgba(56, 189, 248, 0.2) 35%, transparent 70%)',
        }}
      />

      {/* Permanent Fixed Top Header Logo on Sub-Pages */}
      {page !== 'home' && (
        <div
          className="absolute top-0 left-0 right-0 z-30 w-full flex items-center justify-center pointer-events-none transition-transform duration-500"
          style={{
            minHeight: '5.5vw',
            paddingTop: '1.4vw',
            paddingBottom: '1.4vw',
            paddingLeft: '2.083vw',
            paddingRight: '2.083vw',
            transform: logoTransform,
          }}
        >
          <img
            src={logoGenesis}
            alt="GENESIS"
            style={{
              width: '14.84375vw', // 456px (456 / 3072 * 100vw)
              height: 'auto',
              maxHeight: '4.5vw',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 0.8vw rgba(56, 189, 248, 0.45))',
            }}
          />
        </div>
      )}

      {/* Page Container with smooth scale/fade entry */}
      <div key={page} className="relative z-10 w-full h-full animate-page-transition">
        {page === 'home' && (
          <HomePage
            onStart={() => navigateTo('prize-selection')}
            onViewResults={() => navigateTo('summary')}
            hasWonAny={winnersHistory.length > 0}
            screenMode={screenMode}
          />
        )}

        {page === 'prize-selection' && (
          <PrizeSelection
            onSelectPrize={(key: PrizeKey) => {
              handleSelectPrize(key);
              navigateTo('draw');
            }}
            onBackToHome={() => navigateTo('home')}
            onGoToSummary={() => navigateTo('summary')}
            allWinnersHistory={winnersHistory}
            screenMode={screenMode}
          />
        )}

        {page === 'draw' && (
          <LuckyDraw
            initialPrizeKey={selectedPrizeKey}
            onBack={() => navigateTo('prize-selection')}
            onGoToSummary={() => navigateTo('summary')}
            allWinnersHistory={winnersHistory}
            onUpdateWinnersHistory={setWinnersHistory}
            screenMode={screenMode}
          />
        )}

        {page === 'summary' && (
          <SummaryResults
            onBack={() => navigateTo('home')}
            onGoToDraw={() => navigateTo('prize-selection')}
            winnersHistory={winnersHistory}
            screenMode={screenMode}
          />
        )}
      </div>
    </div>
  );
}
