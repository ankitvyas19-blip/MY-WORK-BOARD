import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ActivityItem,
  BoardObject,
  CollaboratorPresence,
  RoomStatePayload,
  RoomTimerState,
} from './src/types/board';
import { JAM_TEMPLATES } from './src/data/templates';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface InternalRoomState {
  roomId: string;
  title: string;
  objects: Map<string, BoardObject>;
  users: Map<string, CollaboratorPresence>;
  timer: RoomTimerState;
  activities: ActivityItem[];
}

const rooms = new Map<string, InternalRoomState>();

function cloneObjects(objs: BoardObject[]): Map<string, BoardObject> {
  const map = new Map<string, BoardObject>();
  for (const item of objs) {
    map.set(item.id, JSON.parse(JSON.stringify(item)));
  }
  return map;
}

function getOrCreateRoom(roomId: string): InternalRoomState {
  const cleanId = roomId.trim() || 'product-strategy';
  let room = rooms.get(cleanId);
  if (!room) {
    let initialObjects: BoardObject[] = [];
    let title = 'Canvas Board';

    if (cleanId === 'product-strategy') {
      initialObjects = JAM_TEMPLATES[0].objects;
      title = 'Q4 Product Strategy & Architecture Jam';
    } else if (cleanId === 'sprint-retro') {
      initialObjects = JAM_TEMPLATES[1].objects;
      title = 'Sprint 24 Team Retrospective';
    } else if (cleanId === 'prioritization') {
      initialObjects = JAM_TEMPLATES[2].objects;
      title = '2x2 Impact vs. Effort Prioritization';
    } else {
      // Dynamic user-created pages and project boards start with a clean blank canvas
      initialObjects = [];
      title = cleanId
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    room = {
      roomId: cleanId,
      title,
      objects: cloneObjects(initialObjects),
      users: new Map<string, CollaboratorPresence>(),
      timer: {
        durationSeconds: 300,
        remainingSeconds: 300,
        isRunning: false,
        startedAt: null,
      },
      activities: [
        {
          id: `act-init-${Date.now()}`,
          userName: 'Workspace',
          userColor: '#6366F1',
          action: `Initialized "${title}" board`,
          timestamp: Date.now(),
        },
      ],
    };
    rooms.set(cleanId, room);
  }
  return room;
}

function pushActivity(
  room: InternalRoomState,
  userName: string,
  userColor: string,
  action: string
): ActivityItem {
  const entry: ActivityItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userName,
    userColor,
    action,
    timestamp: Date.now(),
  };
  room.activities = [entry, ...room.activities.slice(0, 39)];
  return entry;
}

function serializeRoom(room: InternalRoomState): RoomStatePayload {
  // Compute dynamic remaining timer if running
  let remaining = room.timer.remainingSeconds;
  if (room.timer.isRunning && room.timer.startedAt) {
    const elapsed = Math.floor((Date.now() - room.timer.startedAt) / 1000);
    remaining = Math.max(0, room.timer.remainingSeconds - elapsed);
  }

  return {
    roomId: room.roomId,
    title: room.title,
    objects: Array.from(room.objects.values()).sort((a, b) => a.zIndex - b.zIndex),
    users: Array.from(room.users.values()),
    timer: {
      ...room.timer,
      remainingSeconds: remaining,
    },
    activities: room.activities,
  };
}

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  roomId: string;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '5mb' }));

  // Initialize default rooms
  getOrCreateRoom('product-strategy');
  getOrCreateRoom('sprint-retro');
  getOrCreateRoom('prioritization');

  // REST API endpoints
  app.get('/api/rooms', (_req, res) => {
    const list = Array.from(rooms.values()).map((r) => ({
      roomId: r.roomId,
      title: r.title,
      objectCount: r.objects.size,
      activeUsers: r.users.size,
    }));
    res.json({ rooms: list });
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const room = getOrCreateRoom(req.params.roomId);
    res.json(serializeRoom(room));
  });

  app.post('/api/auth/login', (req, res) => {
    const { loginId, password } = req.body;
    if (String(loginId).trim() === '1234' && String(password).trim() === '4321') {
      res.json({
        success: true,
        token: `cj_session_${Date.now()}`,
        user: { id: 'user_1234', name: 'Authorized User', loginId: '1234' },
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid Login ID or Password' });
    }
  });

  const httpServer = createServer(app);

  // Attach WebSocketServer on /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<WebSocket, ClientConnection>();

  function broadcastToRoom(
    roomId: string,
    payload: unknown,
    excludeWs?: WebSocket
  ) {
    const msg = JSON.stringify(payload);
    for (const [clientWs, meta] of clients.entries()) {
      if (
        meta.roomId === roomId &&
        clientWs !== excludeWs &&
        clientWs.readyState === WebSocket.OPEN
      ) {
        clientWs.send(msg);
      }
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const { type } = data;

        if (type === 'room:join') {
          const roomId = (data.roomId || 'product-strategy').trim();
          const user: CollaboratorPresence = {
            id: data.user.id,
            name: data.user.name || 'Collaborator',
            color: data.user.color || '#6366F1',
            x: typeof data.user.x === 'number' ? data.user.x : 420,
            y: typeof data.user.y === 'number' ? data.user.y : 280,
            activeTool: data.user.activeTool || 'select',
            selectedIds: data.user.selectedIds || [],
            viewport: data.user.viewport || { x: 0, y: 0, zoom: 1 },
            lastSeen: Date.now(),
          };

          // Remove from previous room if switching
          const existing = clients.get(ws);
          if (existing && existing.roomId !== roomId) {
            const oldRoom = rooms.get(existing.roomId);
            if (oldRoom) {
              oldRoom.users.delete(existing.userId);
              broadcastToRoom(
                existing.roomId,
                { type: 'user:left', userId: existing.userId },
                ws
              );
            }
          }

          clients.set(ws, { ws, userId: user.id, roomId });
          const room = getOrCreateRoom(roomId);
          room.users.set(user.id, user);

          // Send full state to joining client
          ws.send(
            JSON.stringify({
              type: 'room:init',
              state: serializeRoom(room),
            })
          );

          // Broadcast join to other room members
          broadcastToRoom(
            roomId,
            {
              type: 'user:joined',
              user,
            },
            ws
          );
          return;
        }

        const conn = clients.get(ws);
        if (!conn) return;
        const room = getOrCreateRoom(conn.roomId);
        const currentUser = room.users.get(conn.userId);

        switch (type) {
          case 'cursor:move': {
            if (currentUser) {
              currentUser.x = data.x;
              currentUser.y = data.y;
              if (data.activeTool) currentUser.activeTool = data.activeTool;
              if (Array.isArray(data.selectedIds)) {
                currentUser.selectedIds = data.selectedIds;
              }
              if (data.viewport) {
                currentUser.viewport = data.viewport;
              }
              if (typeof data.highFiveActive === 'boolean') {
                currentUser.highFiveActive = data.highFiveActive;
              }
              currentUser.lastSeen = Date.now();
              broadcastToRoom(
                conn.roomId,
                {
                  type: 'cursor:updated',
                  user: currentUser,
                },
                ws
              );
            }
            break;
          }

          case 'cursor:chat': {
            if (currentUser) {
              currentUser.cursorChat = data.message || '';
              currentUser.cursorChatUpdatedAt = Date.now();
              broadcastToRoom(
                conn.roomId,
                {
                  type: 'cursor:updated',
                  user: currentUser,
                },
                ws
              );
            }
            break;
          }

          case 'user:profile': {
            if (currentUser) {
              currentUser.name = data.name || currentUser.name;
              currentUser.color = data.color || currentUser.color;
              broadcastToRoom(conn.roomId, {
                type: 'cursor:updated',
                user: currentUser,
              });
            }
            break;
          }

          case 'object:create': {
            const obj: BoardObject = data.object;
            if (!obj || !obj.id) break;
            // Idempotent check: store or overwrite cleanly
            room.objects.set(obj.id, { ...obj, updatedAt: Date.now() });
            const act = pushActivity(
              room,
              currentUser?.name || 'Collaborator',
              currentUser?.color || '#6366F1',
              `Added ${obj.type}`
            );
            broadcastToRoom(
              conn.roomId,
              {
                type: 'object:created',
                object: room.objects.get(obj.id),
                activity: act,
              },
              ws
            );
            break;
          }

          case 'object:update': {
            const obj: BoardObject = data.object;
            if (!obj || !obj.id) break;
            const existingObj = room.objects.get(obj.id);
            const merged = existingObj
              ? ({ ...existingObj, ...obj, updatedAt: Date.now() } as BoardObject)
              : ({ ...obj, updatedAt: Date.now() } as BoardObject);
            room.objects.set(obj.id, merged);
            broadcastToRoom(
              conn.roomId,
              {
                type: 'object:updated',
                object: merged,
              },
              ws
            );
            break;
          }

          case 'object:batch_update': {
            const objectsList: BoardObject[] = data.objects;
            if (!Array.isArray(objectsList)) break;
            const updated: BoardObject[] = [];
            for (const item of objectsList) {
              if (!item || !item.id) continue;
              const existingObj = room.objects.get(item.id);
              const merged = existingObj
                ? ({ ...existingObj, ...item, updatedAt: Date.now() } as BoardObject)
                : ({ ...item, updatedAt: Date.now() } as BoardObject);
              room.objects.set(item.id, merged);
              updated.push(merged);
            }
            broadcastToRoom(
              conn.roomId,
              {
                type: 'object:batch_updated',
                objects: updated,
              },
              ws
            );
            break;
          }

          case 'object:delete': {
            const ids: string[] = Array.isArray(data.ids)
              ? data.ids
              : data.id
              ? [data.id]
              : [];
            if (ids.length === 0) break;
            for (const id of ids) {
              room.objects.delete(id);
            }
            const act = pushActivity(
              room,
              currentUser?.name || 'Collaborator',
              currentUser?.color || '#6366F1',
              `Removed ${ids.length} item${ids.length > 1 ? 's' : ''}`
            );
            broadcastToRoom(
              conn.roomId,
              {
                type: 'object:deleted',
                ids,
                activity: act,
              },
              ws
            );
            break;
          }

          case 'board:title': {
            if (typeof data.title === 'string' && data.title.trim()) {
              room.title = data.title.trim();
              const act = pushActivity(
                room,
                currentUser?.name || 'Collaborator',
                currentUser?.color || '#6366F1',
                `Renamed board to "${room.title}"`
              );
              broadcastToRoom(conn.roomId, {
                type: 'board:title_updated',
                title: room.title,
                activity: act,
              });
            }
            break;
          }

          case 'template:load': {
            const tpl = JAM_TEMPLATES.find((t) => t.id === data.templateId);
            if (tpl) {
              room.objects = cloneObjects(tpl.objects);
              const act = pushActivity(
                room,
                currentUser?.name || 'Collaborator',
                currentUser?.color || '#6366F1',
                `Loaded template "${tpl.name}"`
              );
              const fullState = serializeRoom(room);
              broadcastToRoom(conn.roomId, {
                type: 'room:sync',
                state: fullState,
                activity: act,
              });
            }
            break;
          }

          case 'board:replace_all': {
            if (Array.isArray(data.objects)) {
              room.objects = cloneObjects(data.objects);
              const fullState = serializeRoom(room);
              broadcastToRoom(
                conn.roomId,
                {
                  type: 'room:sync',
                  state: fullState,
                },
                ws
              );
            }
            break;
          }

          case 'board:clear': {
            room.objects.clear();
            const act = pushActivity(
              room,
              currentUser?.name || 'Collaborator',
              currentUser?.color || '#6366F1',
              'Cleared all board objects'
            );
            broadcastToRoom(conn.roomId, {
              type: 'room:sync',
              state: serializeRoom(room),
              activity: act,
            });
            break;
          }

          case 'timer:action': {
            const action = data.action as 'start' | 'pause' | 'reset' | 'set';
            if (action === 'set' && typeof data.durationSeconds === 'number') {
              room.timer = {
                durationSeconds: data.durationSeconds,
                remainingSeconds: data.durationSeconds,
                isRunning: false,
                startedAt: null,
              };
            } else if (action === 'start') {
              room.timer.isRunning = true;
              room.timer.startedAt = Date.now();
            } else if (action === 'pause') {
              if (room.timer.isRunning && room.timer.startedAt) {
                const elapsed = Math.floor(
                  (Date.now() - room.timer.startedAt) / 1000
                );
                room.timer.remainingSeconds = Math.max(
                  0,
                  room.timer.remainingSeconds - elapsed
                );
              }
              room.timer.isRunning = false;
              room.timer.startedAt = null;
            } else if (action === 'reset') {
              room.timer.isRunning = false;
              room.timer.startedAt = null;
              room.timer.remainingSeconds = room.timer.durationSeconds;
            }
            broadcastToRoom(conn.roomId, {
              type: 'timer:updated',
              timer: serializeRoom(room).timer,
            });
            break;
          }

          case 'reaction:send': {
            broadcastToRoom(conn.roomId, {
              type: 'reaction:burst',
              reaction: {
                id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                emoji: data.emoji || 'heart',
                x: data.x || currentUser?.x || 400,
                y: data.y || currentUser?.y || 300,
                userName: currentUser?.name || 'Collaborator',
                userColor: currentUser?.color || '#6366F1',
                createdAt: Date.now(),
              },
            });
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      const conn = clients.get(ws);
      if (conn) {
        clients.delete(ws);
        const room = rooms.get(conn.roomId);
        if (room) {
          room.users.delete(conn.userId);
          broadcastToRoom(conn.roomId, {
            type: 'user:left',
            userId: conn.userId,
          });
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CanvasJam Server & WebSocket listening on http://localhost:${PORT}`);
  });
}

startServer();
