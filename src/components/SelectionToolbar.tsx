import React from 'react';
import {
  Copy,
  Trash2,
  Lock,
  Unlock,
  ArrowUpToLine,
  ArrowDownToLine,
  ThumbsUp,
  Eye,
  ExternalLink,
} from 'lucide-react';
import {
  AttachmentObject,
  BOARD_PALETTE,
  BoardColorKey,
  BoardObject,
  FontStyleType,
} from '../types/board';

interface SelectionToolbarProps {
  selectedObjects: BoardObject[];
  currentUserId: string;
  onUpdateSelectedColor: (color: BoardColorKey) => void;
  onUpdateSelectedFont: (font: FontStyleType) => void;
  onUpdateShapeFill: (fillStyle: 'solid' | 'tinted' | 'outline') => void;
  onUpdateConnectorStyle: (
    curveStyle?: 'curved' | 'straight' | 'elbow',
    lineStyle?: 'solid' | 'dashed'
  ) => void;
  onToggleVote: (stickyId: string) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReviewAttachment?: (attachment: AttachmentObject) => void;
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

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedObjects,
  currentUserId,
  onUpdateSelectedColor,
  onUpdateSelectedFont,
  onUpdateShapeFill,
  onUpdateConnectorStyle,
  onToggleVote,
  onBringToFront,
  onSendToBack,
  onToggleLock,
  onDuplicate,
  onDelete,
  onReviewAttachment,
}) => {
  if (selectedObjects.length === 0) return null;

  const first = selectedObjects[0];
  const allLocked = selectedObjects.every((o) => o.locked);
  const hasColor = selectedObjects.some((o) => 'color' in o);
  const hasFont = selectedObjects.some(
    (o) => o.type === 'sticky' || o.type === 'shape' || o.type === 'text'
  );
  const singleSticky =
    selectedObjects.length === 1 && first.type === 'sticky' ? first : null;
  const singleShape =
    selectedObjects.length === 1 && first.type === 'shape' ? first : null;
  const singleConnector =
    selectedObjects.length === 1 && first.type === 'connector' ? first : null;
  const singleAttachment =
    selectedObjects.length === 1 && first.type === 'attachment'
      ? (first as AttachmentObject)
      : null;

  return (
    <div className="fixed top-18 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-md px-3 py-1.5 flex items-center gap-2 select-none">
      <span className="text-xs font-medium text-slate-500 pr-1 border-r border-slate-200 whitespace-nowrap font-mono tabular-nums">
        {selectedObjects.length === 1
          ? first.type.charAt(0).toUpperCase() + first.type.slice(1)
          : `${selectedObjects.length} Selected`}
      </span>

      {/* Review / View button for attachments */}
      {singleAttachment && (
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
          <button
            type="button"
            onClick={() => onReviewAttachment?.(singleAttachment)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Review & View</span>
          </button>
          {singleAttachment.driveWebViewLink && (
            <a
              href={singleAttachment.driveWebViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              title="Open in Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            </a>
          )}
        </div>
      )}

      {/* Color Swatches */}
      {hasColor && !allLocked && (
        <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
          {COLOR_KEYS.map((ck) => {
            const isCurrent = 'color' in first && first.color === ck;
            return (
              <button
                key={ck}
                type="button"
                onClick={() => onUpdateSelectedColor(ck)}
                title={`Color: ${BOARD_PALETTE[ck].label}`}
                className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                  isCurrent ? 'scale-120 ring-2 ring-slate-900 ring-offset-1' : 'hover:scale-110'
                }`}
                style={{
                  backgroundColor: BOARD_PALETTE[ck].swatchHex,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Font Family Switcher */}
      {hasFont && !allLocked && (
        <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
          {(
            [
              { id: 'sans', label: 'Sans' },
              { id: 'hand', label: 'Hand' },
              { id: 'mono', label: 'Mono' },
            ] as { id: FontStyleType; label: string }[]
          ).map((f) => {
            const isCurrent = 'fontStyle' in first && first.fontStyle === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onUpdateSelectedFont(f.id)}
                className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Shape Fill Switcher */}
      {singleShape && !allLocked && (
        <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
          {(['tinted', 'solid', 'outline'] as const).map((fs) => (
            <button
              key={fs}
              type="button"
              onClick={() => onUpdateShapeFill(fs)}
              className={`px-2 py-1 text-xs rounded-md capitalize transition-colors whitespace-nowrap cursor-pointer ${
                singleShape.fillStyle === fs
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {fs}
            </button>
          ))}
        </div>
      )}

      {/* Connector Curve & Line Style */}
      {singleConnector && !allLocked && (
        <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
          {(['curved', 'elbow', 'straight'] as const).map((cs) => (
            <button
              key={cs}
              type="button"
              onClick={() => onUpdateConnectorStyle(cs, undefined)}
              className={`px-2 py-1 text-xs rounded-md capitalize transition-colors whitespace-nowrap cursor-pointer ${
                singleConnector.curveStyle === cs
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cs}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              onUpdateConnectorStyle(
                undefined,
                singleConnector.lineStyle === 'dashed' ? 'solid' : 'dashed'
              )
            }
            className={`px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              singleConnector.lineStyle === 'dashed'
                ? 'bg-slate-900 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Dashed
          </button>
        </div>
      )}

      {/* Sticky Note Dot Vote */}
      {singleSticky && (
        <button
          type="button"
          onClick={() => onToggleVote(singleSticky.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
            singleSticky.votes.includes(currentUserId)
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums">+1 Vote ({singleSticky.votes.length})</span>
        </button>
      )}

      {/* Z-Index & Actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBringToFront}
          title="Bring to Front"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowUpToLine className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onSendToBack}
          title="Send to Back"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleLock}
          title={allLocked ? 'Unlock Selection' : 'Lock Position'}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            allLocked
              ? 'bg-amber-100 text-amber-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          {allLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title="Duplicate (Cmd/Ctrl + D)"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete (Backspace / Delete)"
          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
