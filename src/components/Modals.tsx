import React, { useState } from 'react';
import {
  X,
  Check,
  Copy,
  ThumbsUp,
  Trash2,
  LayoutTemplate,
  Columns2,
  ArrowUpRight,
} from 'lucide-react';
import {
  ActivityItem,
  BOARD_PALETTE,
  BoardObject,
  CollaboratorPresence,
  StickyNoteObject,
} from '../types/board';
import { JAM_TEMPLATES } from '../data/templates';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadTemplate: (templateId: string) => void;
  onClearBoard: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onLoadTemplate,
  onClearBoard,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Workshop & Brainstorming Templates
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Load a structured FigJam canvas for all connected room collaborators
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
          {JAM_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-400 transition-colors"
            >
              <div>
                <div className="text-xs text-indigo-600 font-medium mb-1">
                  {tpl.category} · {tpl.objects.length} items
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                  {tpl.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {tpl.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLoadTemplate(tpl.id);
                  onClose();
                }}
                className="mt-4 w-full py-2 px-3 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Load Template
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Want to start from scratch on an empty infinite canvas?
          </div>
          <button
            type="button"
            onClick={() => {
              onClearBoard();
              onClose();
            }}
            className="px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Board</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ActivityAndVotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  objects: BoardObject[];
  activities: ActivityItem[];
  onFocusObject: (obj: BoardObject) => void;
  onToggleVote: (stickyId: string) => void;
  currentUserId: string;
}

export const ActivityAndVotesDrawer: React.FC<ActivityAndVotesDrawerProps> = ({
  isOpen,
  onClose,
  objects,
  activities,
  onFocusObject,
  onToggleVote,
  currentUserId,
}) => {
  const [tab, setTab] = useState<'votes' | 'activity'>('votes');

  if (!isOpen) return null;

  const stickyNotes = objects
    .filter((o): o is StickyNoteObject => o.type === 'sticky')
    .sort((a, b) => b.votes.length - a.votes.length);

  return (
    <div className="fixed top-14 right-0 bottom-0 w-84 bg-white/95 backdrop-blur-md border-l border-slate-200 shadow-xl z-40 flex flex-col select-none">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('votes')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'votes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dot Votes ({stickyNotes.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'activity'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Activity
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {tab === 'votes' ? (
          stickyNotes.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No sticky notes on the board yet. Press <kbd className="font-mono">S</kbd> to place a sticky note and start voting.
            </div>
          ) : (
            stickyNotes.map((sticky, idx) => {
              const pal = BOARD_PALETTE[sticky.color];
              const voted = sticky.votes.includes(currentUserId);
              return (
                <div
                  key={sticky.id}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col gap-2"
                  style={{ backgroundColor: `${pal.stickyBg}55` }}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono tabular-nums font-semibold text-slate-700">
                      #{idx + 1} · {sticky.authorName}
                    </span>
                    <button
                      type="button"
                      onClick={() => onFocusObject(sticky)}
                      className="text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Locate</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 line-clamp-3 leading-relaxed">
                    {sticky.text || 'Untitled note'}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-mono tabular-nums text-slate-600">
                      {sticky.votes.length} vote{sticky.votes.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleVote(sticky.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                        voted
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{voted ? 'Voted' : '+1 Vote'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : (
          <div className="space-y-3">
            {activities.map((act) => (
              <div
                key={act.id}
                className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs"
              >
                <div className="min-w-0">
                  <span
                    className="font-semibold mr-1.5"
                    style={{ color: act.userColor }}
                  >
                    {act.userName}
                  </span>
                  <span className="text-slate-600">{act.action}</span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                  {new Date(act.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ShareAndProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onChangeRoom: (newRoomId: string) => void;
  currentUser: CollaboratorPresence;
  peers: CollaboratorPresence[];
  onUpdateProfile: (name: string, color: string) => void;
  splitPeerOpen: boolean;
  onToggleSplitPeer: () => void;
}

const CURSOR_COLORS = [
  '#4F46E5',
  '#7C3AED',
  '#E11D48',
  '#EA580C',
  '#0D9488',
  '#16A34A',
  '#2563EB',
  '#9333EA',
];

export const ShareAndProfileModal: React.FC<ShareAndProfileModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onChangeRoom,
  currentUser,
  peers,
  onUpdateProfile,
  splitPeerOpen,
  onToggleSplitPeer,
}) => {
  const [nameInput, setNameInput] = useState(currentUser.name);
  const [colorInput, setColorInput] = useState(currentUser.color);
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
    roomId
  )}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateProfile(nameInput.trim(), colorInput);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Live Collaboration & Room Presence
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time WebSocket cursor sync and room sharing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Your Collaborator Identity */}
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Your Cursor Identity
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your display name"
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Update Profile
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {CURSOR_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  setColorInput(hex);
                  onUpdateProfile(nameInput.trim() || currentUser.name, hex);
                }}
                className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                  colorInput === hex
                    ? 'scale-120 ring-2 ring-slate-900 ring-offset-2'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </form>

        {/* Share Room Link */}
        <div className="space-y-2 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700">
              Share Room Link (Permanent Hosted Link)
            </label>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200">
              Usable on Any System
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy URL'}</span>
            </button>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>
              Login on any device: ID <strong className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">1234</strong> / Password <strong className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">4321</strong>
            </span>
          </div>
        </div>

        {/* Instant Picture-in-Picture Live WebSocket Peer Tester */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-900">
              Interactive Second WebSocket Client (Picture-in-Picture)
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Connect a real 2nd WebSocket collaborator window inside the viewport to test live cursor tracking & sticky sync side-by-side.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onToggleSplitPeer();
              onClose();
            }}
            className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              splitPeerOpen
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>{splitPeerOpen ? 'Close Peer Window' : 'Open Peer Window'}</span>
          </button>
        </div>

        {/* Create or Switch Custom Room */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="block text-xs font-semibold text-slate-700">
            Create or Join Custom Room ID
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customRoomInput}
              onChange={(e) => setCustomRoomInput(e.target.value)}
              placeholder="e.g. design-system-sprint"
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => {
                if (customRoomInput.trim()) {
                  onChangeRoom(
                    customRoomInput
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9-_]/g, '-')
                  );
                  setCustomRoomInput('');
                  onClose();
                }
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Switch Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
