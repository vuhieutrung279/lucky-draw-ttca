import React from 'react';
import type { ScreenMode } from '../utils/syncManager';

interface ScreenGuideOverlayProps {
  screenMode: ScreenMode;
  onClose?: () => void;
}

export default function ScreenGuideOverlay({ screenMode }: ScreenGuideOverlayProps) {
  if (screenMode === 'standard') {
    return (
      <div className="absolute inset-0 pointer-events-none z-50 border-4 border-dashed border-emerald-500/70 select-none" />
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {/* SVG for exact border lines & cut caro pattern */}
      <svg className="w-full h-full absolute inset-0" viewBox="0 0 3072 1152" preserveAspectRatio="none">
        <defs>
          {/* Red Caro Cross-Hatch Pattern for cut area */}
          <pattern id="cut-caro" width="28" height="28" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="28" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="3" />
            <line x1="0" y1="0" x2="28" y2="0" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="3" />
          </pattern>
        </defs>

        {screenMode === 'left' && (
          <>
            {/* Safe Trapezoid Green Border (100% transparent interior, zero background layer) */}
            <polygon
              points="0,0 3072,0 2180,1152 0,1152"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray="16 8"
            />
            {/* Cut Triangle Area with Red Caro Pattern */}
            <polygon
              points="3072,0 3072,1152 2180,1152"
              fill="url(#cut-caro)"
              stroke="#ef4444"
              strokeWidth="4"
              strokeDasharray="12 6"
            />
          </>
        )}

        {screenMode === 'right' && (
          <>
            {/* Safe Trapezoid Green Border (100% transparent interior, zero background layer) */}
            <polygon
              points="0,0 3072,0 3072,1152 892,1152"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray="16 8"
            />
            {/* Cut Triangle Area with Red Caro Pattern */}
            <polygon
              points="0,0 892,1152 0,1152"
              fill="url(#cut-caro)"
              stroke="#ef4444"
              strokeWidth="4"
              strokeDasharray="12 6"
            />
          </>
        )}
      </svg>
    </div>
  );
}
