import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Send, HandMetal } from 'lucide-react';
import { StickyNoteObject } from '../types/board';

interface LivePeerWindowProps {
  roomId: string;
  onClose: () => void;
}

export const LivePeerWindow: React.FC<LivePeerWindowProps> = ({
  roomId,
  onClose,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [peerName, setPeerName] = useState('Sora Takahashi');
  const [peerPos, setPeerPos] = useState({ x: 520, y: 260 });
  const [chatMessage, setChatMessage] = useState('');
  const [highFive, setHighFive] = useState(false);
  const peerIdRef = useRef(`peer-live-${Math.random().toString(36).slice(2, 8)}`);
  const peerColor = '#0D9488';

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(
        JSON.stringify({
          type: 'room:join',
          roomId,
          user: {
            id: peerIdRef.current,
            name: peerName,
            color: peerColor,
            x: 520,
            y: 260,
            activeTool: 'select',
            selectedIds: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        })
      );
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  const handlePadMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const worldX = Math.round(80 + rx * 1350);
    const worldY = Math.round(80 + ry * 620);
    setPeerPos({ x: worldX, y: worldY });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'cursor:move',
          x: worldX,
          y: worldY,
          highFiveActive: highFive,
        })
      );
    }
  };

  const handleSendCursorChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'cursor:chat',
          message: chatMessage.trim(),
        })
      );
    }
  };

  const handleAddPeerSticky = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const newSticky: StickyNoteObject = {
      id: `sticky-peer-${Date.now()}`,
      type: 'sticky',
      x: peerPos.x - 110,
      y: peerPos.y - 80,
      width: 220,
      height: 175,
      text: `Live note from ${peerName} at (${peerPos.x}, ${peerPos.y})`,
      color: 'teal',
      authorName: peerName,
      authorColor: peerColor,
      votes: [peerIdRef.current],
      fontStyle: 'hand',
      fontSize: 'md',
      zIndex: Date.now() % 10000,
      updatedAt: Date.now(),
    };
    wsRef.current.send(
      JSON.stringify({
        type: 'object:create',
        object: newSticky,
      })
    );
  };

  const toggleHighFive = () => {
    const next = !highFive;
    setHighFive(next);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'cursor:move',
          x: peerPos.x,
          y: peerPos.y,
          highFiveActive: next,
        })
      );
    }
  };

  return (
    <div className="fixed bottom-20 left-5 z-40 w-76 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-3.5 select-none">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: connected ? peerColor : '#94A3B8' }}
          />
          <span className="text-xs font-bold text-slate-900">
            2nd WebSocket Client ({peerName})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-800 rounded-md cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interactive Trackpad that streams real WebSocket cursor coordinates */}
      <div
        onMouseMove={handlePadMouseMove}
        onClick={handleAddPeerSticky}
        className="h-28 bg-slate-50 border border-dashed border-teal-300 rounded-xl relative overflow-hidden cursor-crosshair flex flex-col items-center justify-center text-center p-2 mb-2.5"
      >
        <span className="text-[11px] font-medium text-teal-800 pointer-events-none">
          Move pointer here to stream live WebSocket cursor ({peerPos.x}, {peerPos.y})
        </span>
        <span className="text-[10px] text-slate-500 mt-0.5 pointer-events-none">
          Click anywhere in pad to drop a sticky note
        </span>
      </div>

      {/* Peer Cursor Chat & High-Five Controls */}
      <form onSubmit={handleSendCursorChat} className="flex items-center gap-1.5 mb-2">
        <input
          type="text"
          value={chatMessage}
          onChange={(e) => {
            setChatMessage(e.target.value);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'cursor:chat',
                  message: e.target.value,
                })
              );
            }
          }}
          placeholder="Type live peer cursor chat..."
          className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          title="Broadcast Cursor Chat"
          className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleAddPeerSticky}
          className="flex-1 py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Drop Peer Sticky</span>
        </button>
        <button
          type="button"
          onClick={toggleHighFive}
          className={`py-1.5 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap ${
            highFive
              ? 'bg-amber-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <HandMetal className="w-3.5 h-3.5" />
          <span>High-Five</span>
        </button>
      </div>
    </div>
  );
};
