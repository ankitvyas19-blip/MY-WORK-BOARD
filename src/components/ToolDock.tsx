import React, { useState } from 'react';
import {
  MousePointer,
  Hand,
  StickyNote,
  Square,
  Circle,
  Diamond,
  Database,
  ArrowUpRight,
  PenTool,
  Type,
  Frame,
  Smile,
  Eraser,
  MessageSquare,
  Undo2,
  Redo2,
  HandMetal,
  ThumbsUp,
  Heart,
  Flame,
  Star,
  HelpCircle,
  CheckCircle2,
  Paperclip,
} from 'lucide-react';
import {
  BOARD_PALETTE,
  BoardColorKey,
  ShapeKind,
  StampKind,
  ToolType,
} from '../types/board';

interface ToolDockProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  activeColor: BoardColorKey;
  onSelectColor: (color: BoardColorKey) => void;
  activeShapeKind: ShapeKind;
  onSelectShapeKind: (kind: ShapeKind) => void;
  activeStampKind: StampKind;
  onSelectStampKind: (kind: StampKind) => void;
  penStrokeWidth: number;
  onSelectPenStrokeWidth: (w: number) => void;
  isHighlighter: boolean;
  onToggleHighlighter: () => void;
  onOpenCursorChat: () => void;
  highFiveMode: boolean;
  onToggleHighFive: () => void;
  onTriggerReactionBurst: (emoji: StampKind) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTriggerAttachFiles?: () => void;
}

const COLOR_KEYS: BoardColorKey[] = [
  'yellow',
  'orange',
  'rose',
  'violet',
  'blue',
  'teal',
  'emerald',
  'slate',
];

const STAMP_OPTIONS: { kind: StampKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'thumbsup', label: 'Thumbs Up', icon: <ThumbsUp className="w-4 h-4" /> },
  { kind: 'heart', label: 'Love It', icon: <Heart className="w-4 h-4" /> },
  { kind: 'fire', label: 'Ship It', icon: <Flame className="w-4 h-4" /> },
  { kind: 'star', label: 'Star Idea', icon: <Star className="w-4 h-4" /> },
  { kind: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" /> },
  { kind: 'check', label: 'Approved', icon: <CheckCircle2 className="w-4 h-4" /> },
];

export const ToolDock: React.FC<ToolDockProps> = ({
  activeTool,
  onSelectTool,
  activeColor,
  onSelectColor,
  activeShapeKind,
  onSelectShapeKind,
  activeStampKind,
  onSelectStampKind,
  penStrokeWidth,
  onSelectPenStrokeWidth,
  isHighlighter,
  onToggleHighlighter,
  onOpenCursorChat,
  highFiveMode,
  onToggleHighFive,
  onTriggerReactionBurst,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTriggerAttachFiles,
}) => {
  const [openSubmenu, setOpenSubmenu] = useState<'sticky' | 'shape' | 'pen' | 'stamp' | null>(null);

  const handleToolButtonClick = (
    tool: ToolType,
    submenu?: 'sticky' | 'shape' | 'pen' | 'stamp'
  ) => {
    onSelectTool(tool);
    if (submenu) {
      setOpenSubmenu((prev) => (prev === submenu && activeTool === tool ? null : submenu));
    } else {
      setOpenSubmenu(null);
    }
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2.5 select-none">
      {/* Contextual Submenu Popover above Dock */}
      {(openSubmenu === 'sticky' ||
        openSubmenu === 'shape' ||
        openSubmenu === 'pen' ||
        openSubmenu === 'stamp') && (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-4 py-2.5 flex items-center gap-3">
          {/* Shape Selector */}
          {openSubmenu === 'shape' && (
            <>
              <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
                {(
                  [
                    { kind: 'rect', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
                    {
                      kind: 'pill',
                      label: 'Rounded Pill',
                      icon: <div className="w-4 h-2.5 border-2 border-current rounded-full" />,
                    },
                    { kind: 'diamond', label: 'Diamond', icon: <Diamond className="w-4 h-4" /> },
                    { kind: 'circle', label: 'Circle', icon: <Circle className="w-4 h-4" /> },
                    { kind: 'cylinder', label: 'Database', icon: <Database className="w-4 h-4" /> },
                  ] as { kind: ShapeKind; label: string; icon: React.ReactNode }[]
                ).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => onSelectShapeKind(item.kind)}
                    title={item.label}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      activeShapeKind === item.kind
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Marker / Pen Settings */}
          {openSubmenu === 'pen' && (
            <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
              {[3, 6, 12].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onSelectPenStrokeWidth(w)}
                  title={`Stroke width ${w}px`}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    penStrokeWidth === w
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className="rounded-full bg-current block"
                    style={{ width: Math.min(14, w + 3), height: Math.min(14, w + 3) }}
                  />
                </button>
              ))}
              <button
                type="button"
                onClick={onToggleHighlighter}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  isHighlighter
                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Highlighter
              </button>
            </div>
          )}

          {/* Stamp / Live Reaction Selector */}
          {openSubmenu === 'stamp' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 mr-1 whitespace-nowrap">
                Place Stamp or Burst:
              </span>
              {STAMP_OPTIONS.map((st) => (
                <div key={st.kind} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStampKind(st.kind);
                      onTriggerReactionBurst(st.kind);
                    }}
                    title={`${st.label} (Click canvas to stamp, or click here for live reaction burst)`}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      activeStampKind === st.kind
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {st.icon}
                    <span>{st.label}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Color Palette Swatches for Sticky, Shape, or Pen */}
          {openSubmenu !== 'stamp' && (
            <div className="flex items-center gap-1.5">
              {COLOR_KEYS.map((colorKey) => {
                const pal = BOARD_PALETTE[colorKey];
                const isSelected = activeColor === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => onSelectColor(colorKey)}
                    title={pal.label}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                      isSelected ? 'scale-125 ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-110'
                    }`}
                    style={{
                      backgroundColor:
                        openSubmenu === 'sticky' ? pal.stickyBg : pal.swatchHex,
                      border: `1.5px solid ${
                        openSubmenu === 'sticky' ? pal.stickyBorder : pal.shapeStroke
                      }`,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main FigJam Floating Dock */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg px-2.5 py-1.5 flex items-center gap-1">
        {/* Select & Hand Pan */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('select')}
          title="Move & Select (V)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'select' && !highFiveMode
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => handleToolButtonClick('hand')}
          title="Hand Pan Tool (H or hold Spacebar)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'hand'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* Sticky Note */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('sticky', 'sticky')}
          title="Sticky Note (S)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer relative ${
            activeTool === 'sticky'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <StickyNote className="w-4 h-4" />
          <span
            className="w-2 h-2 rounded-full absolute bottom-1.5 right-1.5 border border-white"
            style={{ backgroundColor: BOARD_PALETTE[activeColor].swatchHex }}
          />
        </button>

        {/* Shape with Text */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('shape', 'shape')}
          title="Diagram Shape (R)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'shape'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Magnetic Connector */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('connector')}
          title="Magnetic Connector Line (C) — Drag between objects"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'connector'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>

        {/* Marker / Freehand Pen */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('pen', 'pen')}
          title="Marker & Highlighter (P)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'pen'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <PenTool className="w-4 h-4" />
        </button>

        {/* Text Block */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('text')}
          title="Text Label (T)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'text'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Section Container */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('section')}
          title="Section Frame (F) — Groups objects together"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'section'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Frame className="w-4 h-4" />
        </button>

        {/* Stamp & Reactions */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('stamp', 'stamp')}
          title="Stamps & Reactions (E)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'stamp'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Attach File (Image, PDF, Excel, PPT) */}
        <button
          type="button"
          onClick={() => onTriggerAttachFiles?.()}
          title="Attach Files (Screenshots, PDF, Excel, PowerPoint)"
          className="p-2.5 rounded-xl transition-colors cursor-pointer text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Paperclip className="w-4 h-4 text-indigo-600" />
        </button>

        {/* Eraser */}
        <button
          type="button"
          onClick={() => handleToolButtonClick('eraser')}
          title="Eraser Tool (Click any item to remove)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTool === 'eraser'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Eraser className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* FigJam Live Cursor Chat ("/") & High-Five Mode */}
        <button
          type="button"
          onClick={onOpenCursorChat}
          title="Live Cursor Chat (Press /)"
          className="px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Chat</span>
          <kbd className="text-[10px] font-mono bg-slate-100 border border-slate-200 rounded px-1 text-slate-500">
            /
          </kbd>
        </button>

        <button
          type="button"
          onClick={onToggleHighFive}
          title="High-Five Cursor Mode (H5)"
          className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
            highFiveMode
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <HandMetal className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd/Ctrl + Z)"
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd/Ctrl + Shift + Z)"
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
