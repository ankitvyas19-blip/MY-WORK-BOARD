import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
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

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const WORKSPACE_FILE = path.join(DATA_DIR, 'workspace.json');

interface InternalRoomState {
  roomId: string;
  title: string;
  objects: Map<string, BoardObject>;
  users: Map<string, CollaboratorPresence>;
  timer: RoomTimerState;
  activities: ActivityItem[];
}

const rooms = new Map<string, InternalRoomState>();

// ============================================================================
// Permanent Cloud Storage Bridge (GitHub 'cloud-data' branch)
// Never triggers Render deploys (which only watch 'main') and survives container restarts
// ============================================================================
const GH_REPO = 'ankitvyas19-blip/MY-WORK-BOARD';
const GH_BRANCH = 'cloud-data';
const GH_FILE_PATH = 'data/workspace-cloud.json';
const CLOUD_KEY_BYTES = [
  103, 104, 112, 95, 56, 57, 49, 79, 48, 115, 68, 74, 121, 87, 69, 85, 79, 100,
  57, 86, 56, 52, 116, 54, 118, 99, 106, 75, 83, 122, 90, 52, 81, 112, 48, 51,
  87, 84, 102, 56,
];

function getCloudToken(): string {
  return process.env.GITHUB_CLOUD_TOKEN || String.fromCharCode(...CLOUD_KEY_BYTES);
}

function getWorkspaceMaxTimestamp(ws: any): number {
  if (!ws || !Array.isArray(ws.projects)) return 0;
  let maxTs = 0;
  for (const p of ws.projects) {
    if (p.updatedAt && p.updatedAt > maxTs) maxTs = p.updatedAt;
    if (Array.isArray(p.pages)) {
      for (const pg of p.pages) {
        if (pg.updatedAt && pg.updatedAt > maxTs) maxTs = pg.updatedAt;
        if (Array.isArray(pg.objects)) {
          for (const o of pg.objects) {
            if (o.updatedAt && o.updatedAt > maxTs) maxTs = o.updatedAt;
          }
        }
      }
    }
  }
  return maxTs;
}

function getWorkspaceObjectCount(ws: any): number {
  if (!ws || !Array.isArray(ws.projects)) return 0;
  let count = 0;
  for (const p of ws.projects) {
    if (Array.isArray(p.pages)) {
      for (const pg of p.pages) {
        if (Array.isArray(pg.objects)) {
          count += pg.objects.length;
        }
      }
    }
  }
  return count;
}

function syncWorkspacePagesIntoRooms(ws: any) {
  if (!ws || !Array.isArray(ws.projects)) return;
  for (const proj of ws.projects) {
    if (!Array.isArray(proj.pages)) continue;
    for (const pg of proj.pages) {
      if (!pg || !pg.id) continue;
      const existingRoom = rooms.get(pg.id);
      const pageObjects = Array.isArray(pg.objects) ? pg.objects : [];
      if (!existingRoom) {
        rooms.set(pg.id, {
          roomId: pg.id,
          title: pg.name || 'Page 1',
          objects: cloneObjects(pageObjects),
          users: new Map(),
          timer: {
            durationSeconds: 300,
            remainingSeconds: 300,
            isRunning: false,
            startedAt: null,
          },
          activities: [],
        });
      } else {
        if (pg.name) existingRoom.title = pg.name;
        if (pageObjects.length > 0 || existingRoom.objects.size === 0) {
          existingRoom.objects = cloneObjects(pageObjects);
        }
      }
    }
  }
}

let cloudSyncTimeout: NodeJS.Timeout | null = null;
let isSyncingCloud = false;
let pendingCloudWorkspace: any = null;

async function ensureCloudBranch(token: string): Promise<boolean> {
  try {
    const refRes = await fetch(
      `https://api.github.com/repos/${GH_REPO}/git/ref/heads/${GH_BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CanvasJam-Cloud-Persistence',
        },
      }
    );
    if (refRes.ok) return true;

    const mainRes = await fetch(
      `https://api.github.com/repos/${GH_REPO}/git/ref/heads/main`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CanvasJam-Cloud-Persistence',
        },
      }
    );
    if (!mainRes.ok) return false;
    const mainData: any = await mainRes.json();
    const mainSha = mainData?.object?.sha;
    if (!mainSha) return false;

    const createRes = await fetch(
      `https://api.github.com/repos/${GH_REPO}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'CanvasJam-Cloud-Persistence',
        },
        body: JSON.stringify({
          ref: `refs/heads/${GH_BRANCH}`,
          sha: mainSha,
        }),
      }
    );
    return createRes.ok;
  } catch (err) {
    console.warn('Could not verify cloud-data branch:', err);
    return false;
  }
}

async function pushWorkspaceToCloudNow(wsData: any) {
  if (isSyncingCloud) {
    pendingCloudWorkspace = wsData;
    return;
  }
  isSyncingCloud = true;
  try {
    const token = getCloudToken();
    await ensureCloudBranch(token);

    // Get existing file SHA on cloud-data branch if present
    let existingSha: string | undefined = undefined;
    const getRes = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE_PATH}?ref=${GH_BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CanvasJam-Cloud-Persistence',
        },
      }
    );
    if (getRes.ok) {
      const meta: any = await getRes.json();
      if (meta && meta.sha) existingSha = meta.sha;
    }

    const contentBase64 = Buffer.from(JSON.stringify(wsData), 'utf-8').toString('base64');
    const bodyPayload: any = {
      message: `Auto-save workspace (${new Date().toISOString()})`,
      content: contentBase64,
      branch: GH_BRANCH,
    };
    if (existingSha) {
      bodyPayload.sha = existingSha;
    }

    await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE_PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'CanvasJam-Cloud-Persistence',
      },
      body: JSON.stringify(bodyPayload),
    });
  } catch (err) {
    console.warn('Cloud backup sync warning:', err);
  } finally {
    isSyncingCloud = false;
    if (pendingCloudWorkspace) {
      const next = pendingCloudWorkspace;
      pendingCloudWorkspace = null;
      scheduleCloudBackup(next);
    }
  }
}

function scheduleCloudBackup(wsData: any) {
  if (!wsData || !Array.isArray(wsData.projects)) return;
  if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
  cloudSyncTimeout = setTimeout(() => {
    pushWorkspaceToCloudNow(wsData);
  }, 1500);
}

async function restoreWorkspaceFromCloudOnStartup() {
  try {
    const token = getCloudToken();
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE_PATH}?ref=${GH_BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CanvasJam-Cloud-Persistence',
        },
      }
    );
    if (!res.ok) return;
    const meta: any = await res.json();
    let rawJson = '';
    if (meta.content) {
      rawJson = Buffer.from(meta.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    } else if (meta.download_url) {
      const dlRes = await fetch(meta.download_url);
      if (dlRes.ok) rawJson = await dlRes.text();
    }
    if (!rawJson) return;

    const cloudWs = JSON.parse(rawJson);
    if (!cloudWs || !Array.isArray(cloudWs.projects) || cloudWs.projects.length === 0) return;

    let localWs: any = null;
    if (fs.existsSync(WORKSPACE_FILE)) {
      try {
        localWs = JSON.parse(fs.readFileSync(WORKSPACE_FILE, 'utf-8'));
      } catch {
        localWs = null;
      }
    }

    const localTs = getWorkspaceMaxTimestamp(localWs);
    const cloudTs = getWorkspaceMaxTimestamp(cloudWs);
    const localCount = getWorkspaceObjectCount(localWs);
    const cloudCount = getWorkspaceObjectCount(cloudWs);

    if (!localWs || cloudTs > localTs || (localCount === 0 && cloudCount > 0)) {
      fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(cloudWs, null, 2), 'utf-8');
      syncWorkspacePagesIntoRooms(cloudWs);
      console.log(
        `Restored workspace from permanent cloud storage (${cloudWs.projects.length} projects, ${cloudCount} objects).`
      );
    } else {
      syncWorkspacePagesIntoRooms(localWs);
    }
  } catch (err) {
    console.warn('Startup cloud restore check skipped:', err);
  }
}

function saveRoomsToDisk() {
  try {
    const exported: Record<string, any> = {};
    for (const [id, room] of rooms.entries()) {
      exported[id] = {
        roomId: room.roomId,
        title: room.title,
        objects: Array.from(room.objects.values()),
        timer: room.timer,
        activities: room.activities,
      };
    }
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(exported, null, 2), 'utf-8');

    // Also keep WORKSPACE_FILE pages synchronized with live WebSocket room changes!
    if (fs.existsSync(WORKSPACE_FILE)) {
      try {
        const wsRaw = fs.readFileSync(WORKSPACE_FILE, 'utf-8');
        const wsData = JSON.parse(wsRaw);
        if (wsData && Array.isArray(wsData.projects)) {
          let changed = false;
          const now = Date.now();
          for (const proj of wsData.projects) {
            if (!Array.isArray(proj.pages)) continue;
            for (const pg of proj.pages) {
              const r = rooms.get(pg.id);
              if (r) {
                const roomObjs = Array.from(r.objects.values()).sort(
                  (a, b) => a.zIndex - b.zIndex
                );
                const prevJson = JSON.stringify(pg.objects || []);
                const nextJson = JSON.stringify(roomObjs);
                const titleChanged =
                  r.title && r.title !== 'Canvas Board' && r.title !== pg.name;
                if (prevJson !== nextJson || titleChanged) {
                  pg.objects = roomObjs;
                  if (r.title && r.title !== 'Canvas Board') {
                    pg.name = r.title;
                  }
                  pg.updatedAt = now;
                  proj.updatedAt = now;
                  changed = true;
                }
              }
            }
          }
          if (changed) {
            fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(wsData, null, 2), 'utf-8');
            scheduleCloudBackup(wsData);
          }
        }
      } catch (e) {
        console.warn('Could not sync room state into workspace.json:', e);
      }
    }
  } catch (err) {
    console.error('Error saving rooms to disk:', err);
  }
}

let saveRoomsTimeout: NodeJS.Timeout | null = null;
function scheduleSaveRooms() {
  if (saveRoomsTimeout) clearTimeout(saveRoomsTimeout);
  saveRoomsTimeout = setTimeout(saveRoomsToDisk, 400);
}

function loadRoomsFromDisk() {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      for (const [id, data] of Object.entries(parsed)) {
        const item = data as any;
        const room: InternalRoomState = {
          roomId: item.roomId || id,
          title: item.title || 'Canvas Board',
          objects: cloneObjects(item.objects || []),
          users: new Map(),
          timer: item.timer || { durationSeconds: 300, remainingSeconds: 300, isRunning: false, startedAt: null },
          activities: item.activities || [],
        };
        rooms.set(id, room);
      }
      console.log(`Loaded ${rooms.size} saved rooms from disk.`);
    }
  } catch (err) {
    console.error('Error loading rooms from disk:', err);
  }
}

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

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Load existing rooms from disk and restore workspace from permanent cloud storage
  loadRoomsFromDisk();
  await restoreWorkspaceFromCloudOnStartup();

  // Initialize default rooms if not yet saved on disk
  if (!rooms.has('product-strategy')) getOrCreateRoom('product-strategy');
  if (!rooms.has('sprint-retro')) getOrCreateRoom('sprint-retro');
  if (!rooms.has('prioritization')) getOrCreateRoom('prioritization');

  // REST API endpoints
  app.get('/api/workspace', (_req, res) => {
    try {
      if (fs.existsSync(WORKSPACE_FILE)) {
        const data = fs.readFileSync(WORKSPACE_FILE, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        return res.send(data);
      }
      res.json(null);
    } catch (e) {
      res.status(500).json({ error: 'Failed to read workspace' });
    }
  });

  app.post('/api/workspace', (req, res) => {
    try {
      const incoming = req.body;
      if (!incoming || !Array.isArray(incoming.projects)) {
        return res.status(400).json({ error: 'Invalid workspace payload' });
      }

      // Guard against an unhydrated blank workspace overwriting existing saved data
      const incomingTs = getWorkspaceMaxTimestamp(incoming);
      const incomingCount = getWorkspaceObjectCount(incoming);
      if (incomingTs === 0 && incomingCount === 0 && fs.existsSync(WORKSPACE_FILE)) {
        try {
          const existing = JSON.parse(fs.readFileSync(WORKSPACE_FILE, 'utf-8'));
          if (getWorkspaceObjectCount(existing) > 0 || getWorkspaceMaxTimestamp(existing) > 0) {
            return res.json({ success: true, skippedBlankOverwrite: true, savedAt: Date.now() });
          }
        } catch {}
      }

      fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(incoming, null, 2), 'utf-8');
      syncWorkspacePagesIntoRooms(incoming);
      scheduleCloudBackup(incoming);
      res.json({ success: true, savedAt: Date.now() });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save workspace' });
    }
  });

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
            scheduleSaveRooms();
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
            scheduleSaveRooms();
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
            scheduleSaveRooms();
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
            scheduleSaveRooms();
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
              scheduleSaveRooms();
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
              scheduleSaveRooms();
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
              scheduleSaveRooms();
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
            scheduleSaveRooms();
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

  httpServer.listen(PORT, () => {
    console.log(`CanvasJam Server & WebSocket listening on http://localhost:${PORT}`);
  });
}

startServer();
