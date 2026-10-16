import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Map as MapIcon } from 'lucide-react';
import {
  BOARD_PALETTE,
  BoardObject,
  CollaboratorPresence,
} from '../types/board';
import { getObjectBounds } from '../utils/geometry';

interface MinimapProps {
  objects: BoardObject[];
  peers: CollaboratorPresence[];
  viewport: { x: number; y: number; zoom: number };
  canvasWidth: number;
  canvasHeight: number;
  matchingObjectIds?: Set<string>;
  onPanToWorldCenter: (worldX: number, worldY: number) => void;
  onZoomStep: (delta: number) => void;
  onResetZoom: () => void;
  onFitToContent: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  objects,
  peers,
  viewport,
  canvasWidth,
  canvasHeight,
  matchingObjectIds,
  onPanToWorldCenter,
  onZoomStep,
  onResetZoom,
  onFitToContent,
}) => {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Compute world bounds for minimap projection
  const WORLD_MIN_X = -400;
  const WORLD_MAX_X = 2000;
  const WORLD_MIN_Y = -300;
  const WORLD_MAX_Y = 1300;
  const worldW = WORLD_MAX_X - WORLD_MIN_X;
  const worldH = WORLD_MAX_Y - WORLD_MIN_Y;

  const MAP_W = 192;
  const MAP_H = 128;

  const toMiniX = (wx: number) => ((wx - WORLD_MIN_X) / worldW) * MAP_W;
  const toMiniY = (wy: number) => ((wy - WORLD_MIN_Y) / worldH) * MAP_H;

  // Current viewport box in world space
  const viewWorldX = -viewport.x / viewport.zoom;
  const viewWorldY = -viewport.y / viewport.zoom;
  const viewWorldW = canvasWidth / viewport.zoom;
  const viewWorldH = canvasHeight / viewport.zoom;

  const handleMinimapPointer = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.buttons !== 1 && e.type !== 'click') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / MAP_W;
    const ry = (e.clientY - rect.top) / MAP_H;
    const targetWorldX = WORLD_MIN_X + rx * worldW;
    const targetWorldY = WORLD_MIN_Y + ry * worldH;
    onPanToWorldCenter(targetWorldX, targetWorldY);
  };

  return (
    <div className="fixed bottom-20 right-3 sm:bottom-5 sm:right-5 z-30 flex flex-col items-end gap-2 select-none">
      {/* Interactive Radar Minimap */}
      {!collapsed && (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-md p-2 overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 px-1">
            <span className="font-medium text-slate-700">Infinite Canvas Radar</span>
            <span className="font-mono tabular-nums">
              {Math.round(viewWorldX)}, {Math.round(viewWorldY)}
            </span>
          </div>
          <svg
            width={MAP_W}
            height={MAP_H}
            onClick={handleMinimapPointer}
            onMouseMove={handleMinimapPointer}
            className="bg-slate-50 rounded-lg border border-slate-200/70 cursor-crosshair block"
          >
            {objects.map((obj) => {
              const b = getObjectBounds(obj);
              const mx = toMiniX(b.x);
              const my = toMiniY(b.y);
              const mw = Math.max(3, (b.width / worldW) * MAP_W);
              const mh = Math.max(3, (b.height / worldH) * MAP_H);
              const isMatch = matchingObjectIds?.has(obj.id);
              const color = isMatch
                ? '#F59E0B'
                : 'color' in obj
                ? BOARD_PALETTE[obj.color].swatchHex
                : '#6366F1';
              return (
                <rect
                  key={obj.id}
                  x={mx}
                  y={my}
                  width={mw}
                  height={mh}
                  rx={obj.type === 'section' ? 2 : 1}
                  fill={color}
                  fillOpacity={isMatch ? 1 : obj.type === 'section' ? 0.22 : 0.75}
                  stroke={isMatch ? '#D97706' : color}
                  strokeWidth={isMatch ? 1.5 : 0.5}
                />
              );
            })}

            {/* Collaborator Live Dots */}
            {peers.map((peer) => (
              <circle
                key={peer.id}
                cx={toMiniX(peer.x)}
                cy={toMiniY(peer.y)}
                r={3.5}
                fill={peer.color}
                stroke="#FFFFFF"
                strokeWidth={1}
              />
            ))}

            {/* Current Viewport Indicator */}
            <rect
              x={toMiniX(viewWorldX)}
              y={toMiniY(viewWorldY)}
              width={Math.max(12, (viewWorldW / worldW) * MAP_W)}
              height={Math.max(10, (viewWorldH / worldH) * MAP_H)}
              fill="rgba(79, 70, 229, 0.08)"
              stroke="#4F46E5"
              strokeWidth={1.5}
              rx={2}
            />
          </svg>
        </div>
      )}

      {/* Zoom & Viewport HUD Bar */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-lg px-2 sm:px-2 py-1.5 sm:py-1 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'Show Minimap Radar' : 'Hide Minimap Radar'}
          className={`p-2 sm:p-1.5 rounded-lg transition-colors cursor-pointer touch-manipulation ${
            !collapsed
              ? 'text-indigo-600 bg-indigo-50'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>

        <div className="w-px h-5 sm:h-4 bg-slate-200 mx-0.5" />

        <button
          type="button"
          onClick={() => onZoomStep(-0.2)}
          title="Zoom Out (-)"
          className="p-2 sm:p-1.5 text-slate-700 hover:text-slate-900 active:bg-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer touch-manipulation active:scale-95"
        >
          <ZoomOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>

        <button
          type="button"
          onClick={onResetZoom}
          title="Reset Zoom to 100% (Cmd/Ctrl + 0)"
          className="px-2.5 py-1 text-xs font-mono tabular-nums font-bold text-slate-800 hover:bg-slate-100 active:bg-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer touch-manipulation"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <button
          type="button"
          onClick={() => onZoomStep(0.2)}
          title="Zoom In (+)"
          className="p-2 sm:p-1.5 text-slate-700 hover:text-slate-900 active:bg-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer touch-manipulation active:scale-95"
        >
          <ZoomIn className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>

        <button
          type="button"
          onClick={onFitToContent}
          title="Fit All Objects in Viewport"
          className="p-2 sm:p-1.5 text-slate-700 hover:text-slate-900 active:bg-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer touch-manipulation active:scale-95"
        >
          <Maximize2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
    </div>
  );
};
