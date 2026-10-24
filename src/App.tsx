import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  ThumbsUp,
  Heart,
  Flame,
  Star,
  HelpCircle,
  CheckCircle2,
  Lock,
  HandMetal,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  File,
  Eye,
  ExternalLink,
  Cloud,
  Paperclip,
  Download,
  Trash2,
  ShieldCheck,
  RotateCcw,
  Edit2,
  Move,
  Check,
} from 'lucide-react';
import {
  ActivityItem,
  AnchorPort,
  AttachmentKind,
  AttachmentObject,
  BOARD_PALETTE,
  BoardColorKey,
  BoardObject,
  CollaboratorPresence,
  ConnectorObject,
  DriveQuotaInfo,
  FloatingReaction,
  FontStyleType,
  PathObject,
  Point,
  RoomStatePayload,
  RoomTimerState,
  SectionObject,
  ShapeKind,
  ShapeObject,
  StampKind,
  StampObject,
  StickyNoteObject,
  TextObject,
  ToolType,
  BoardPage,
  BoardProject,
  WorkspaceState,
} from './types/board';
import {
  boxesIntersect,
  buildConnectorGeometry,
  buildSmoothSvgPath,
  findNearestAnchor,
  getAnchorPoint,
  getObjectBounds,
  resolveConnectorEndpoints,
  screenToWorld,
} from './utils/geometry';
import { TopBar } from './components/TopBar';
import { ToolDock } from './components/ToolDock';
import { SelectionToolbar } from './components/SelectionToolbar';
import { Minimap } from './components/Minimap';
import {
  ActivityAndVotesDrawer,
  ShareAndProfileModal,
  TemplatesModal,
} from './components/Modals';
import { LivePeerWindow } from './components/LivePeerWindow';
import { FilePreviewModal } from './components/FilePreviewModal';
import { DriveBackupModal } from './components/DriveBackupModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { LoginGate } from './components/LoginGate';
import {
  googleSignIn,
  initAuth,
  logout as googleLogout,
} from './services/firebaseAuth';
import {
  deleteDriveFile,
  formatBytes,
  getDriveStorageQuota,
  listBoardBackups,
  loadBoardBackup,
  saveBoardBackupToDrive,
  saveWorkspaceBackupToDrive,
  uploadAttachmentToDrive,
} from './services/driveService';
import {
  loadWorkspaceFromStorage,
  loadWorkspaceFromIndexedDB,
  saveWorkspaceToStorage,
  fetchWorkspaceFromServer,
  mergeAndResolveWorkspaces,
  createBlankPage,
  createNewProject,
} from './services/workspaceService';

const COLLABORATOR_NAMES = [
  'Aria Vance',
  'Kieran Patel',
  'Nadia Lindqvist',
  'Julian Mercer',
  'Zoe Alverez',
  'Marcus Sterling',
];

const COLLABORATOR_COLORS = [
  '#4F46E5',
  '#7C3AED',
  '#E11D48',
  '#EA580C',
  '#0D9488',
  '#2563EB',
];

function getInitialUser(): CollaboratorPresence {
  const savedId = sessionStorage.getItem('cj_user_id');
  const savedName = localStorage.getItem('cj_user_name');
  const savedColor = localStorage.getItem('cj_user_color');

  const id = savedId || `u-${Math.random().toString(36).slice(2, 9)}`;
  const idx = Math.floor(Math.random() * COLLABORATOR_NAMES.length);
  const name = savedName || COLLABORATOR_NAMES[idx];
  const color = savedColor || COLLABORATOR_COLORS[idx];

  sessionStorage.setItem('cj_user_id', id);
  return {
    id,
    name,
    color,
    x: 450,
    y: 300,
    activeTool: 'select',
    selectedIds: [],
    viewport: { x: 40, y: 20, zoom: 0.92 },
    lastSeen: Date.now(),
  };
}

function getFontClass(fontStyle?: FontStyleType) {
  if (fontStyle === 'hand') return 'font-handwritten';
  if (fontStyle === 'mono') return 'font-mono-code';
  return 'font-sans-ui';
}

function renderStampIcon(kind: StampKind, className = 'w-6 h-6') {
  switch (kind) {
    case 'thumbsup':
      return <ThumbsUp className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'fire':
      return <Flame className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'question':
      return <HelpCircle className={className} />;
    case 'check':
      return <CheckCircle2 className={className} />;
  }
}

function detectAttachmentKind(file: File): AttachmentKind {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type === 'text/csv' ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  ) {
    return 'excel';
  }
  if (
    type.includes('presentation') ||
    type.includes('powerpoint') ||
    name.endsWith('.pptx') ||
    name.endsWith('.ppt')
  ) {
    return 'powerpoint';
  }
  return 'file';
}

export default function App() {
  // System Authentication Gate (Login ID: 1234, Password: 4321)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!(
      localStorage.getItem('cj_auth_token') ||
      sessionStorage.getItem('cj_auth_token')
    );
  });

  // Multi-Project Workspace State with Dual Persistence (Local Storage + Google Drive)
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => {
    return loadWorkspaceFromStorage();
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlProj = params.get('project');
    const ws = loadWorkspaceFromStorage();
    if (urlProj && ws.projects.some((p) => p.id === urlProj)) {
      return urlProj;
    }
    return ws.activeProjectId || ws.projects[0]?.id || 'proj-default';
  });

  const currentProject = useMemo(() => {
    return (
      workspace.projects.find((p) => p.id === activeProjectId) ||
      workspace.projects[0] ||
      createNewProject('Main Project')
    );
  }, [workspace.projects, activeProjectId]);

  const [activePageId, setActivePageId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPage = params.get('page');
    const ws = loadWorkspaceFromStorage();
    const proj =
      ws.projects.find((p) => p.id === ws.activeProjectId) || ws.projects[0];
    if (urlPage && proj?.pages.some((pg) => pg.id === urlPage)) {
      return urlPage;
    }
    return proj?.activePageId || proj?.pages[0]?.id || 'page-1';
  });

  const currentPage = useMemo(() => {
    return (
      currentProject.pages.find((pg) => pg.id === activePageId) ||
      currentProject.pages[0] ||
      createBlankPage('Page 1')
    );
  }, [currentProject.pages, activePageId]);

  // Collaborative Room ID tied to current page
  const [roomId, setRoomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || currentPage.id;
  });

  const [boardTitle, setBoardTitle] = useState<string>(() => {
    return currentPage.name || 'Page 1';
  });
  const [objects, setObjects] = useState<BoardObject[]>(() => {
    return currentPage.objects || [];
  });
  const objectsRef = useRef<BoardObject[]>(objects);
  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  const [peers, setPeers] = useState<CollaboratorPresence[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [timer, setTimer] = useState<RoomTimerState>({
    durationSeconds: 300,
    remainingSeconds: 300,
    isRunning: false,
    startedAt: null,
  });

  // Current User & Viewport State
  const [currentUser, setCurrentUser] = useState<CollaboratorPresence>(getInitialUser);
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>(() => {
    return currentPage.viewport || {
      x: 40,
      y: 20,
      zoom: 0.92,
    };
  });

  const workspaceRef = useRef<WorkspaceState>(workspace);
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  const isWorkspaceHydratedRef = useRef<boolean>(false);

  // Helper to build and persist the current live snapshot immediately
  const handleSaveWorkspaceNow = useCallback(() => {
    const curObjects = objectsRef.current;
    const curVp = viewportRef.current;
    const now = Date.now();
    setWorkspace((prevWs) => {
      const nextProjects = prevWs.projects.map((proj) => {
        if (proj.id !== activeProjectId) return proj;
        const nextPages = proj.pages.map((pg) => {
          if (pg.id !== activePageId) return pg;
          return {
            ...pg,
            name: boardTitle || pg.name,
            objects: curObjects,
            viewport: curVp,
            updatedAt: now,
          };
        });
        return {
          ...proj,
          activePageId,
          pages: nextPages,
          updatedAt: now,
        };
      });
      const updatedState: WorkspaceState = {
        ...prevWs,
        activeProjectId,
        projects: nextProjects,
      };
      workspaceRef.current = updatedState;
      saveWorkspaceToStorage(updatedState, true);
      return updatedState;
    });
  }, [activePageId, activeProjectId, boardTitle]);

  // Debounced auto-save of current page canvas objects & viewport to Local Storage, IndexedDB & Server
  useEffect(() => {
    if (!isWorkspaceHydratedRef.current && objects.length === 0) {
      return;
    }
    const timeout = setTimeout(() => {
      const now = Date.now();
      setWorkspace((prevWs) => {
        const nextProjects = prevWs.projects.map((proj) => {
          if (proj.id !== activeProjectId) return proj;
          const nextPages = proj.pages.map((pg) => {
            if (pg.id !== activePageId) return pg;
            return {
              ...pg,
              name: boardTitle || pg.name,
              objects,
              viewport,
              updatedAt: now,
            };
          });
          return {
            ...proj,
            activePageId,
            pages: nextPages,
            updatedAt: now,
          };
        });
        const updatedState: WorkspaceState = {
          ...prevWs,
          activeProjectId,
          projects: nextProjects,
        };
        workspaceRef.current = updatedState;
        saveWorkspaceToStorage(updatedState);
        return updatedState;
      });
    }, 200);

    return () => clearTimeout(timeout);
  }, [objects, viewport, activeProjectId, activePageId, boardTitle]);

  // Hydrate workspace from LocalStorage + IndexedDB + Server Cloud on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadWorkspaceFromIndexedDB(), fetchWorkspaceFromServer()]).then(
      ([idbWs, serverWs]) => {
        if (cancelled) return;
        const localWs = loadWorkspaceFromStorage();
        const bestWs = mergeAndResolveWorkspaces([localWs, idbWs, serverWs]);
        isWorkspaceHydratedRef.current = true;

        setWorkspace(bestWs);
        workspaceRef.current = bestWs;
        saveWorkspaceToStorage(bestWs, true);

        const params = new URLSearchParams(window.location.search);
        const urlProjId = params.get('project');
        const urlPageId = params.get('page');

        const activeProj =
          (urlProjId && bestWs.projects.find((p) => p.id === urlProjId)) ||
          bestWs.projects.find((p) => p.id === bestWs.activeProjectId) ||
          bestWs.projects[0];

        if (activeProj) {
          const activePg =
            (urlPageId && activeProj.pages.find((pg) => pg.id === urlPageId)) ||
            activeProj.pages.find((pg) => pg.id === activeProj.activePageId) ||
            activeProj.pages[0];

          if (activePg) {
            setActiveProjectId(activeProj.id);
            setActivePageId(activePg.id);
            setRoomId(activePg.id);
            setBoardTitle(activePg.name || 'Page 1');
            const restoredObjects = Array.isArray(activePg.objects) ? activePg.objects : [];
            setObjects(restoredObjects);
            objectsRef.current = restoredObjects;
            if (activePg.viewport) {
              setViewport(activePg.viewport);
              viewportRef.current = activePg.viewport;
            }
            if (
              restoredObjects.length > 0 &&
              wsRef.current &&
              wsRef.current.readyState === WebSocket.OPEN
            ) {
              wsRef.current.send(
                JSON.stringify({ type: 'board:replace_all', objects: restoredObjects })
              );
            }
          }
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExportWorkspaceBackup = useCallback(() => {
    const curObjects = objectsRef.current;
    const curVp = viewportRef.current;
    const updatedProjects = workspace.projects.map((proj) => {
      if (proj.id !== activeProjectId) return proj;
      const updatedPages = proj.pages.map((pg) => {
        if (pg.id !== activePageId) return pg;
        return {
          ...pg,
          name: boardTitle,
          objects: curObjects,
          viewport: curVp,
          updatedAt: Date.now(),
        };
      });
      return {
        ...proj,
        pages: updatedPages,
        updatedAt: Date.now(),
      };
    });
    const currentWorkspaceSnapshot: WorkspaceState = {
      ...workspace,
      activeProjectId,
      projects: updatedProjects,
    };

    saveWorkspaceToStorage(currentWorkspaceSnapshot);

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(currentWorkspaceSnapshot, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute(
      'download',
      `canvasjam-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    dlAnchorElem.click();
  }, [activePageId, activeProjectId, boardTitle, workspace]);

  const handleImportWorkspaceBackup = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const imported = JSON.parse(text);
        if (
          imported &&
          Array.isArray(imported.projects) &&
          imported.projects.length > 0
        ) {
          setWorkspace(imported);
          saveWorkspaceToStorage(imported);
          const activeProj =
            imported.projects.find((p: any) => p.id === imported.activeProjectId) ||
            imported.projects[0];
          const activePg =
            activeProj.pages.find((pg: any) => pg.id === activeProj.activePageId) ||
            activeProj.pages[0];
          if (activePg) {
            setActiveProjectId(activeProj.id);
            setActivePageId(activePg.id);
            setRoomId(activePg.id);
            setBoardTitle(activePg.name || 'Page 1');
            if (activePg.objects) {
              setObjects(activePg.objects);
              objectsRef.current = activePg.objects;
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({ type: 'board:replace_all', objects: activePg.objects })
                );
              }
            }
            if (activePg.viewport) {
              setViewport(activePg.viewport);
              viewportRef.current = activePg.viewport;
            }
          }
          alert('Backup restored successfully! All canvas drawings, files, and notes are loaded.');
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        console.error('Failed to parse backup file', err);
        alert('Could not parse backup file.');
      }
    };
    reader.readAsText(file);
  }, []);

  const [canvasSize, setCanvasSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 56,
  });

  // Active Tool & Creation Settings
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeColor, setActiveColor] = useState<BoardColorKey>('yellow');
  const [activeShapeKind, setActiveShapeKind] = useState<ShapeKind>('rect');
  const [activeStampKind, setActiveStampKind] = useState<StampKind>('thumbsup');
  const [penStrokeWidth, setPenStrokeWidth] = useState<number>(4);
  const [isHighlighter, setIsHighlighter] = useState<boolean>(false);
  const [highFiveMode, setHighFiveMode] = useState<boolean>(false);
  const [gridMode, setGridMode] = useState<'dots' | 'lines' | 'none'>('dots');

  // Selection & Editing States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

  // Search Query & Match Indexing
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);

  // Cursor Chat ("/") State
  const [cursorChatOpen, setCursorChatOpen] = useState(false);
  const [cursorChatText, setCursorChatText] = useState('');
  const [screenCursorPos, setScreenCursorPos] = useState({ x: 500, y: 360 });
  const [worldCursorPos, setWorldCursorPos] = useState({ x: 450, y: 300 });

  // Floating Reactions
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  // Modals & Drawers
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [splitPeerOpen, setSplitPeerOpen] = useState(false);

  // Google Drive & Attachment Features
  const [isDriveSignedIn, setIsDriveSignedIn] = useState(false);
  const [driveQuota, setDriveQuota] = useState<DriveQuotaInfo | null>(null);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentObject | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<number | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [cloudBackupNotification, setCloudBackupNotification] = useState<{
    id: string;
    title: string;
    savedAt: number;
    itemCount: number;
  } | null>(null);

  // Confirmation Modal for Destructive Operations (Workspace requirement)
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Undo / Redo History Stack
  const [undoStack, setUndoStack] = useState<BoardObject[][]>([]);
  const [redoStack, setRedoStack] = useState<BoardObject[][]>([]);

  // WebSocket & Interaction Refs
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastCursorEmitRef = useRef<number>(0);
  const lastHighFiveRef = useRef<number>(0);
  const isSpacePressedRef = useRef<boolean>(false);
  const autosaveTimerRef = useRef<number | null>(null);

  // Sync refs for high-performance mobile touch and gesture handlers
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);


  // Pointer Interaction State Machine
  const interactionRef = useRef<{
    mode:
      | 'none'
      | 'panning'
      | 'marquee'
      | 'dragging_objects'
      | 'resizing_object'
      | 'drawing_path'
      | 'drawing_connector'
      | 'creating_box';
    startScreen: Point;
    startWorld: Point;
    startViewport: { x: number; y: number; zoom: number };
    dragSnapshots: Map<string, BoardObject>;
    resizeTargetId?: string;
    resizeStartBounds?: { x: number; y: number; width: number; height: number };
    activePathId?: string;
    activeConnectorId?: string;
    activeBoxId?: string;
  }>({
    mode: 'none',
    startScreen: { x: 0, y: 0 },
    startWorld: { x: 0, y: 0 },
    startViewport: { x: 0, y: 0, zoom: 1 },
    dragSnapshots: new Map(),
  });

  const [marqueeBox, setMarqueeBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [snapCandidate, setSnapCandidate] = useState<{
    objectId: string;
    port: AnchorPort;
    point: Point;
  } | null>(null);

  // Map of objects for fast connector endpoint lookup
  const objectsMap = useMemo(() => {
    const map = new Map<string, BoardObject>();
    for (const obj of objects) {
      map.set(obj.id, obj);
    }
    return map;
  }, [objects]);

  const objectsMapRef = useRef(objectsMap);
  useEffect(() => {
    objectsMapRef.current = objectsMap;
  }, [objectsMap]);

  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const selectedObjects = useMemo(
    () => objects.filter((o) => selectedIds.includes(o.id)),
    [objects, selectedIds]
  );

  // Search Matches Calculation (Sticky notes, Text blocks, Section titles, Attachment fileNames)
  const matchingObjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return objects.filter((obj) => {
      if (obj.type === 'sticky') {
        return (
          obj.text?.toLowerCase().includes(q) ||
          obj.authorName?.toLowerCase().includes(q)
        );
      }
      if (obj.type === 'text') {
        return obj.text?.toLowerCase().includes(q);
      }
      if (obj.type === 'section') {
        return obj.title?.toLowerCase().includes(q);
      }
      if (obj.type === 'shape') {
        return obj.text?.toLowerCase().includes(q);
      }
      if (obj.type === 'attachment') {
        return (
          obj.fileName?.toLowerCase().includes(q) ||
          obj.textContent?.toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [objects, searchQuery]);

  const matchingObjectIds = useMemo(() => {
    return new Set(matchingObjects.map((o) => o.id));
  }, [matchingObjects]);

  // Center viewport on given board object
  const focusOnObject = useCallback(
    (obj: BoardObject) => {
      const bounds = getObjectBounds(obj);
      const targetZoom = Math.max(0.75, Math.min(1.2, viewport.zoom));
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      setViewport({
        x: canvasSize.width / 2 - centerX * targetZoom,
        y: canvasSize.height / 2 - centerY * targetZoom,
        zoom: targetZoom,
      });
      setSelectedIds([obj.id]);
    },
    [canvasSize.height, canvasSize.width, viewport.zoom]
  );

  // Search Navigation: Next match
  const handleNextSearchMatch = useCallback(() => {
    if (matchingObjects.length === 0) return;
    const nextIdx = (searchCurrentIndex + 1) % matchingObjects.length;
    setSearchCurrentIndex(nextIdx);
    focusOnObject(matchingObjects[nextIdx]);
  }, [focusOnObject, matchingObjects, searchCurrentIndex]);

  // Search Navigation: Previous match
  const handlePrevSearchMatch = useCallback(() => {
    if (matchingObjects.length === 0) return;
    const prevIdx =
      (searchCurrentIndex - 1 + matchingObjects.length) %
      matchingObjects.length;
    setSearchCurrentIndex(prevIdx);
    focusOnObject(matchingObjects[prevIdx]);
  }, [focusOnObject, matchingObjects, searchCurrentIndex]);

  // When search query changes, reset index and focus on first match if found
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSearchCurrentIndex(0);
      const q = query.trim().toLowerCase();
      if (q) {
        const firstMatch = objects.find((obj) => {
          if (obj.type === 'sticky') {
            return (
              obj.text?.toLowerCase().includes(q) ||
              obj.authorName?.toLowerCase().includes(q)
            );
          }
          if (obj.type === 'text') {
            return obj.text?.toLowerCase().includes(q);
          }
          if (obj.type === 'section') {
            return obj.title?.toLowerCase().includes(q);
          }
          if (obj.type === 'shape') {
            return obj.text?.toLowerCase().includes(q);
          }
          if (obj.type === 'attachment') {
            return (
              obj.fileName?.toLowerCase().includes(q) ||
              obj.textContent?.toLowerCase().includes(q)
            );
          }
          return false;
        });
        if (firstMatch) {
          focusOnObject(firstMatch);
        }
      }
    },
    [focusOnObject, objects]
  );

  // Save Undo Snapshot helper
  const pushUndoSnapshot = useCallback((currentObjs: BoardObject[]) => {
    setUndoStack((prev) => [
      ...prev.slice(-24),
      JSON.parse(JSON.stringify(currentObjs)),
    ]);
    setRedoStack([]);
  }, []);

  // Send WebSocket message helper
  const sendWs = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Initialize Firebase Auth & Check Google Drive status
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user) => {
        setIsDriveSignedIn(true);
        try {
          const quota = await getDriveStorageQuota();
          setDriveQuota(quota);
          // Check if there are backups in Google Drive
          const backups = await listBoardBackups(roomId);
          if (backups.length > 0) {
            const latest = backups[0];
            setCloudBackupNotification({
              id: latest.id,
              title: latest.name,
              savedAt: new Date(latest.modifiedTime).getTime(),
              itemCount: latest.itemCount || 0,
            });
          }
        } catch (e) {
          console.error('Failed to load Google Drive quota:', e);
        }
      },
      () => {
        setIsDriveSignedIn(false);
        setDriveQuota(null);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [roomId]);

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setIsDriveSignedIn(true);
        const quota = await getDriveStorageQuota();
        setDriveQuota(quota);
      }
    } catch (e) {
      console.error('Google Sign-in failed:', e);
      alert(
        "Google Sign-In Notice: Google OAuth popup is restricted by Google on custom preview domains unless authorized in Google Cloud Console.\n\nRest assured: All your canvas objects, drawings, sticky notes, and attached files are ALREADY 100% auto-saved directly to your computer disk in real-time! You can also click the 'Backup' button in the top bar to save a backup file anytime."
      );
    }
  };

  // Google Logout Handler
  const handleGoogleLogout = async () => {
    await googleLogout();
    setIsDriveSignedIn(false);
    setDriveQuota(null);
  };

  // Continuous Autosave to Google Drive (Debounced 4 seconds)
  useEffect(() => {
    if (!isDriveSignedIn || !autosaveEnabled || objects.length === 0) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        setIsAutosaving(true);
        const result = await saveBoardBackupToDrive(roomId, boardTitle, objects);
        setLastAutosaveTime(result.savedAt);
      } catch (e) {
        console.error('Google Drive Autosave error:', e);
      } finally {
        setIsAutosaving(false);
      }
    }, 4500);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [objects, boardTitle, roomId, isDriveSignedIn, autosaveEnabled]);

  // Manual Backup Now action (Saves both current board and full workspace to Google Drive)
  const handleManualBackup = async () => {
    if (!isDriveSignedIn) {
      setDriveModalOpen(true);
      return;
    }
    try {
      setIsAutosaving(true);
      const result = await saveBoardBackupToDrive(roomId, boardTitle, objects);
      setLastAutosaveTime(result.savedAt);
      await saveWorkspaceBackupToDrive(workspace);
    } catch (e) {
      console.error('Manual Google Drive backup failed:', e);
    } finally {
      setIsAutosaving(false);
    }
  };

  // Attach Files Handler: processes images, PDFs, Excel sheets, and PowerPoint decks
  const handleAttachFiles = useCallback(
    async (fileList: FileList | File[], targetWorldPos?: Point) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      pushUndoSnapshot(objects);

      const baseCenter = targetWorldPos || {
        x: -viewport.x / viewport.zoom + canvasSize.width / (2 * viewport.zoom),
        y: -viewport.y / viewport.zoom + canvasSize.height / (2 * viewport.zoom),
      };

      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const kind = detectAttachmentKind(file);
        const attachmentId = `attach-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const offset = idx * 36;

        let dataUrl: string | undefined = undefined;
        let textContent: string | undefined = undefined;

        // Extract data URL or text content for immediate inline preview & permanent cloud persistence
        if (kind === 'image') {
          try {
            const rawDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
            // Optimize large phone camera photos (>300KB) so they save instantly in localStorage, IndexedDB, & Cloud
            if (file.size > 300 * 1024 && !file.type.includes('svg')) {
              dataUrl = await new Promise<string>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const maxDim = 1400;
                  let w = img.width;
                  let h = img.height;
                  if (w > maxDim || h > maxDim) {
                    if (w > h) {
                      h = Math.round((h * maxDim) / w);
                      w = maxDim;
                    } else {
                      w = Math.round((w * maxDim) / h);
                      h = maxDim;
                    }
                  }
                  const offCanvas = document.createElement('canvas');
                  offCanvas.width = w;
                  offCanvas.height = h;
                  const ctx = offCanvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(offCanvas.toDataURL('image/jpeg', 0.84));
                  } else {
                    resolve(rawDataUrl);
                  }
                };
                img.onerror = () => resolve(rawDataUrl);
                img.src = rawDataUrl;
              });
            } else {
              dataUrl = rawDataUrl;
            }
          } catch (e) {
            console.error('Failed to read image as DataURL', e);
          }
        } else if (kind === 'pdf') {
          try {
            dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          } catch (e) {
            console.error('Failed to read PDF as DataURL', e);
          }
        } else if (kind === 'excel' && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
          try {
            textContent = await file.text();
          } catch (e) {
            console.error('Failed to read CSV text', e);
          }
        }

        // Determine initial card geometry
        let width = 280;
        let height = 240;
        if (kind === 'image') {
          width = 320;
          height = 260;
        } else if (kind === 'excel') {
          width = 340;
          height = 220;
        } else if (kind === 'powerpoint') {
          width = 320;
          height = 210;
        }

        const newAttachment: AttachmentObject = {
          id: attachmentId,
          type: 'attachment',
          x: Math.round(baseCenter.x - width / 2 + offset),
          y: Math.round(baseCenter.y - height / 2 + offset),
          width,
          height,
          attachmentKind: kind,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
          textContent,
          authorName: currentUser.name,
          authorColor: currentUser.color,
          zIndex: Date.now() % 100000,
          updatedAt: Date.now(),
        };

        // Add to local state & broadcast over WebSockets
        setObjects((prev) => {
          const next = [...prev, newAttachment].sort((a, b) => a.zIndex - b.zIndex);
          objectsRef.current = next;
          return next;
        });
        sendWs({ type: 'object:create', object: newAttachment });

        // If Google Drive is signed in, upload file to user's 5 TB Drive in background!
        if (isDriveSignedIn) {
          uploadAttachmentToDrive(file, file.name, file.type || 'application/octet-stream')
            .then((driveRes) => {
              const updated: AttachmentObject = {
                ...newAttachment,
                driveFileId: driveRes.id,
                driveWebViewLink: driveRes.webViewLink,
                driveThumbnailLink: driveRes.thumbnailLink,
              };
              setObjects((prev) =>
                prev.map((o) => (o.id === attachmentId ? updated : o))
              );
              sendWs({ type: 'object:update', object: updated });
            })
            .catch((err) => {
              console.error('Failed to upload attachment to Google Drive:', err);
            });
        }
      }
    },
    [canvasSize.height, canvasSize.width, currentUser.color, currentUser.name, isDriveSignedIn, objects, pushUndoSnapshot, sendWs, viewport.x, viewport.y, viewport.zoom]
  );

  // Paste listener: paste screenshots directly from clipboard with Ctrl+V / Cmd+V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        handleAttachFiles(files, worldCursorPos);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAttachFiles, worldCursorPos]);

  // Connect WebSocket & handle real-time room synchronization
  useEffect(() => {
    let reconnectTimer: number | null = null;
    let isUnmounted = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        setWsConnected(true);
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomId,
            user: {
              id: currentUser.id,
              name: currentUser.name,
              color: currentUser.color,
              x: worldCursorPos.x,
              y: worldCursorPos.y,
              activeTool,
              selectedIds,
              viewport,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'room:init':
            case 'room:sync': {
              const state: RoomStatePayload = msg.state;
              if (state.title && state.title !== 'Canvas Board') {
                setBoardTitle(state.title);
              }
              if (state.objects && state.objects.length > 0) {
                if (objectsRef.current && objectsRef.current.length > 0) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'board:replace_all', objects: objectsRef.current }));
                  }
                } else {
                  setObjects(state.objects);
                }
              } else if (objectsRef.current && objectsRef.current.length > 0) {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'board:replace_all', objects: objectsRef.current }));
                }
              }
              setPeers(state.users.filter((u) => u.id !== currentUser.id));
              setTimer(state.timer);
              setActivities(state.activities || []);
              break;
            }
            case 'user:joined': {
              const joined: CollaboratorPresence = msg.user;
              if (joined.id !== currentUser.id) {
                setPeers((prev) => {
                  const filtered = prev.filter((p) => p.id !== joined.id);
                  return [...filtered, joined];
                });
              }
              break;
            }
            case 'user:left': {
              setPeers((prev) => prev.filter((p) => p.id !== msg.userId));
              setFollowingUserId((prev) => (prev === msg.userId ? null : prev));
              break;
            }
            case 'cursor:updated': {
              const updatedPeer: CollaboratorPresence = msg.user;
              if (updatedPeer.id === currentUser.id) break;
              setPeers((prev) => {
                const exists = prev.some((p) => p.id === updatedPeer.id);
                if (!exists) return [...prev, updatedPeer];
                return prev.map((p) => (p.id === updatedPeer.id ? updatedPeer : p));
              });
              break;
            }
            case 'object:created': {
              const created: BoardObject = msg.object;
              setObjects((prev) => {
                const exists = prev.some((o) => o.id === created.id);
                if (exists) {
                  return prev.map((o) => (o.id === created.id ? created : o));
                }
                return [...prev, created].sort((a, b) => a.zIndex - b.zIndex);
              });
              if (msg.activity) {
                setActivities((prev) => [msg.activity, ...prev.slice(0, 39)]);
              }
              break;
            }
            case 'object:updated': {
              const updated: BoardObject = msg.object;
              setObjects((prev) =>
                prev
                  .map((o) => (o.id === updated.id ? updated : o))
                  .sort((a, b) => a.zIndex - b.zIndex)
              );
              break;
            }
            case 'object:batch_updated': {
              const batch: BoardObject[] = msg.objects;
              const batchMap = new Map(batch.map((b) => [b.id, b]));
              setObjects((prev) =>
                prev
                  .map((o) => batchMap.get(o.id) || o)
                  .sort((a, b) => a.zIndex - b.zIndex)
              );
              break;
            }
            case 'object:deleted': {
              const ids: string[] = msg.ids || [];
              setObjects((prev) => prev.filter((o) => !ids.includes(o.id)));
              setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
              if (msg.activity) {
                setActivities((prev) => [msg.activity, ...prev.slice(0, 39)]);
              }
              break;
            }
            case 'board:title_updated': {
              setBoardTitle(msg.title);
              if (msg.activity) {
                setActivities((prev) => [msg.activity, ...prev.slice(0, 39)]);
              }
              break;
            }
            case 'timer:updated': {
              setTimer(msg.timer);
              break;
            }
            case 'reaction:burst': {
              const rx: FloatingReaction = msg.reaction;
              setReactions((prev) => [...prev, rx]);
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== rx.id));
              }, 1900);
              break;
            }
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connect, 1800);
      };
    }

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [roomId, currentUser.id]);

  // Follow Peer Viewport Effect
  useEffect(() => {
    if (!followingUserId) return;
    const targetPeer = peers.find((p) => p.id === followingUserId);
    if (targetPeer && targetPeer.viewport) {
      setViewport(targetPeer.viewport);
    }
  }, [peers, followingUserId]);

  // Track Window Resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight - 56,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Emit Cursor & Viewport Throttled (30Hz)
  const emitCursorTelemetry = useCallback(
    (
      worldPt: Point,
      overrideHighFive?: boolean,
      overrideViewport?: { x: number; y: number; zoom: number }
    ) => {
      const now = Date.now();
      if (now - lastCursorEmitRef.current < 32) return;
      lastCursorEmitRef.current = now;

      const hf =
        typeof overrideHighFive === 'boolean' ? overrideHighFive : highFiveMode;
      sendWs({
        type: 'cursor:move',
        x: Math.round(worldPt.x),
        y: Math.round(worldPt.y),
        activeTool,
        selectedIds,
        viewport: overrideViewport || viewport,
        highFiveActive: hf,
      });

      // Check High-Five proximity with any peer
      if (hf && now - lastHighFiveRef.current > 1200) {
        for (const peer of peers) {
          const dist = Math.hypot(peer.x - worldPt.x, peer.y - worldPt.y);
          if (dist < 75) {
            lastHighFiveRef.current = now;
            const burst: FloatingReaction = {
              id: `hf-${now}`,
              emoji: 'star',
              x: (peer.x + worldPt.x) / 2,
              y: (peer.y + worldPt.y) / 2,
              userName: `High-Five with ${peer.name}!`,
              userColor: '#F59E0B',
              createdAt: now,
            };
            setReactions((prev) => [...prev, burst]);
            sendWs({
              type: 'reaction:send',
              emoji: 'star',
              x: burst.x,
              y: burst.y,
            });
            setTimeout(() => {
              setReactions((prev) => prev.filter((r) => r.id !== burst.id));
            }, 1900);
            break;
          }
        }
      }
    },
    [activeTool, highFiveMode, peers, selectedIds, sendWs, viewport]
  );

  // Mutate Object Locally & Broadcast
  const createBoardObject = useCallback(
    (newObj: BoardObject, recordUndo = true) => {
      if (recordUndo) pushUndoSnapshot(objectsRef.current);
      const stamped = { ...newObj, updatedAt: Date.now() };
      setObjects((prev) => {
        const next = [...prev, stamped].sort((a, b) => a.zIndex - b.zIndex);
        objectsRef.current = next;
        return next;
      });
      sendWs({ type: 'object:create', object: stamped });
    },
    [pushUndoSnapshot, sendWs]
  );

  const updateBoardObject = useCallback(
    (updatedObj: BoardObject, emit = true) => {
      const stamped = { ...updatedObj, updatedAt: Date.now() };
      setObjects((prev) => {
        const next = prev
          .map((o) => (o.id === stamped.id ? stamped : o))
          .sort((a, b) => a.zIndex - b.zIndex);
        objectsRef.current = next;
        return next;
      });
      if (emit) {
        sendWs({ type: 'object:update', object: stamped });
      }
    },
    [sendWs]
  );

  const batchUpdateBoardObjects = useCallback(
    (updatedList: BoardObject[], emit = true) => {
      const now = Date.now();
      const stampedList = updatedList.map((u) => ({ ...u, updatedAt: now }));
      const map = new Map(stampedList.map((u) => [u.id, u]));
      setObjects((prev) => {
        const next = prev
          .map((o) => map.get(o.id) || o)
          .sort((a, b) => a.zIndex - b.zIndex);
        objectsRef.current = next;
        return next;
      });
      if (emit) {
        sendWs({ type: 'object:batch_update', objects: stampedList });
      }
    },
    [sendWs]
  );

  // Safe delete with Google Drive destructive operation confirmation
  const requestDeleteObjects = useCallback(
    (targetIds?: string[]) => {
      const idsToRemove = targetIds || selectedIdsRef.current;
      if (idsToRemove.length === 0) return;

      const driveAttachments = objectsRef.current.filter(
        (o): o is AttachmentObject =>
          idsToRemove.includes(o.id) && o.type === 'attachment' && !!o.driveFileId
      );

      if (driveAttachments.length > 0) {
        const fileNames = driveAttachments.map((a) => `"${a.fileName}"`).join(', ');
        setConfirmationState({
          isOpen: true,
          title: 'Delete from Google Drive?',
          message: `Are you sure you want to delete ${fileNames} from your Google Drive and the canvas? This will permanently remove the file(s) from your 5 TB cloud storage.`,
          confirmLabel: 'Delete from Drive',
          onConfirm: async () => {
            setConfirmationState((prev) => ({ ...prev, isOpen: false }));
            // Delete from Google Drive
            for (const att of driveAttachments) {
              if (att.driveFileId) {
                try {
                  await deleteDriveFile(att.driveFileId);
                } catch (e) {
                  console.error('Failed to delete Drive file:', e);
                }
              }
            }
            // Delete from canvas
            pushUndoSnapshot(objectsRef.current);
            setObjects((prev) => {
              const next = prev.filter((o) => !idsToRemove.includes(o.id));
              objectsRef.current = next;
              return next;
            });
            setSelectedIds((prev) => prev.filter((id) => !idsToRemove.includes(id)));
            sendWs({ type: 'object:delete', ids: idsToRemove });
          },
        });
        return;
      }

      // No drive files affected, delete directly
      pushUndoSnapshot(objectsRef.current);
      setObjects((prev) => {
        const next = prev.filter((o) => !idsToRemove.includes(o.id));
        objectsRef.current = next;
        return next;
      });
      setSelectedIds((prev) => prev.filter((id) => !idsToRemove.includes(id)));
      sendWs({ type: 'object:delete', ids: idsToRemove });
    },
    [pushUndoSnapshot, sendWs]
  );

  const duplicateSelectedObjects = useCallback(() => {
    if (selectedObjects.length === 0) return;
    pushUndoSnapshot(objects);
    const newIds: string[] = [];
    const createdList: BoardObject[] = [];

    for (const orig of selectedObjects) {
      const copy: BoardObject = JSON.parse(JSON.stringify(orig));
      copy.id = `${orig.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      copy.zIndex = Date.now() % 100000;
      copy.updatedAt = Date.now();
      if ('x' in copy && 'y' in copy) {
        copy.x += 28;
        copy.y += 28;
      } else if (copy.type === 'path') {
        copy.points = copy.points.map((p) => ({ x: p.x + 28, y: p.y + 28 }));
      }
      newIds.push(copy.id);
      createdList.push(copy);
      sendWs({ type: 'object:create', object: copy });
    }

    setObjects((prev) =>
      [...prev, ...createdList].sort((a, b) => a.zIndex - b.zIndex)
    );
    setSelectedIds(newIds);
  }, [objects, pushUndoSnapshot, selectedObjects, sendWs]);

  // Undo & Redo handlers
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(objects))]);
    setUndoStack((prev) => prev.slice(0, -1));
    setObjects(previous);
    sendWs({ type: 'board:replace_all', objects: previous });
  }, [objects, sendWs, undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(objects))]);
    setRedoStack((prev) => prev.slice(0, -1));
    setObjects(next);
    sendWs({ type: 'board:replace_all', objects: next });
  }, [objects, redoStack, sendWs]);

  // Fit All Objects in Viewport
  const handleFitToContent = useCallback(() => {
    setFollowingUserId(null);
    if (objects.length === 0) {
      setViewport({ x: 100, y: 80, zoom: 1 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const obj of objects) {
      const b = getObjectBounds(obj);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    const contentW = Math.max(400, maxX - minX);
    const contentH = Math.max(300, maxY - minY);
    const pad = 120;
    const scaleX = (canvasSize.width - pad * 2) / contentW;
    const scaleY = (canvasSize.height - pad * 2) / contentH;
    const nextZoom = Math.min(1.25, Math.max(0.25, Math.min(scaleX, scaleY)));
    const centerX = minX + contentW / 2;
    const centerY = minY + contentH / 2;

    setViewport({
      x: canvasSize.width / 2 - centerX * nextZoom,
      y: canvasSize.height / 2 - centerY * nextZoom,
      zoom: nextZoom,
    });
  }, [canvasSize.height, canvasSize.width, objects]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.code === 'Space' && !isInputFocused) {
        isSpacePressedRef.current = true;
      }

      if (isInputFocused) {
        if (e.key === 'Escape') {
          setEditingId(null);
          setCursorChatOpen(false);
        }
        return;
      }

      // Undo / Redo / Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedObjects();
        return;
      }

      // Search Shortcut (Cmd+F / Ctrl+F)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search notes"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          setHighFiveMode(false);
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case 's':
          setActiveTool('sticky');
          break;
        case 'r':
          setActiveTool('shape');
          break;
        case 'c':
          setActiveTool('connector');
          break;
        case 'p':
          setActiveTool('pen');
          break;
        case 't':
          setActiveTool('text');
          break;
        case 'f':
          setActiveTool('section');
          break;
        case 'e':
          setActiveTool('stamp');
          break;
        case '/':
          e.preventDefault();
          setCursorChatOpen(true);
          setCursorChatText('');
          break;
        case 'escape':
          setSelectedIds([]);
          setEditingId(null);
          setCursorChatOpen(false);
          setHighFiveMode(false);
          setActiveTool('select');
          break;
        case 'backspace':
        case 'delete':
          requestDeleteObjects();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    duplicateSelectedObjects,
    handleRedo,
    handleUndo,
    requestDeleteObjects,
  ]);

  // High-performance object drag & resize functions shared across mouse and mobile touch
  const startObjectDrag = useCallback(
    (obj: BoardObject, screenPt: Point, isShift: boolean = false) => {
      if (activeToolRef.current === 'eraser') {
        requestDeleteObjects([obj.id]);
        return;
      }
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const worldPt = screenToWorld(screenPt.x, screenPt.y, viewportRef.current, rect);

      let nextSelected = selectedIdsRef.current;
      if (isShift) {
        nextSelected = nextSelected.includes(obj.id)
          ? nextSelected.filter((id) => id !== obj.id)
          : [...nextSelected, obj.id];
        setSelectedIds(nextSelected);
      } else if (!nextSelected.includes(obj.id)) {
        nextSelected = [obj.id];
        setSelectedIds(nextSelected);
      }

      if (obj.locked) return;

      // If dragging a Section Frame, also include all unlocked objects inside its bounds!
      const curObjects = objectsRef.current;
      const curMap = objectsMapRef.current;
      const dragIds = new Set(nextSelected);
      for (const id of nextSelected) {
        const item = curMap.get(id);
        if (item && item.type === 'section') {
          const secBounds = getObjectBounds(item);
          for (const candidate of curObjects) {
            if (candidate.id !== item.id && !candidate.locked && candidate.type !== 'section') {
              const cb = getObjectBounds(candidate);
              if (boxesIntersect(secBounds, cb)) {
                dragIds.add(candidate.id);
              }
            }
          }
        }
      }

      const snapshots = new Map<string, BoardObject>();
      for (const id of dragIds) {
        const target = curMap.get(id);
        if (target && !target.locked) {
          snapshots.set(id, JSON.parse(JSON.stringify(target)));
        }
      }

      pushUndoSnapshot(curObjects);
      interactionRef.current = {
        mode: 'dragging_objects',
        startScreen: screenPt,
        startWorld: worldPt,
        startViewport: viewportRef.current,
        dragSnapshots: snapshots,
      };
    },
    [pushUndoSnapshot, requestDeleteObjects]
  );

  const startObjectResize = useCallback(
    (obj: BoardObject, screenPt: Point) => {
      if (obj.locked || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const worldPt = screenToWorld(screenPt.x, screenPt.y, viewportRef.current, rect);
      const bounds = getObjectBounds(obj);

      pushUndoSnapshot(objectsRef.current);
      interactionRef.current = {
        mode: 'resizing_object',
        startScreen: screenPt,
        startWorld: worldPt,
        startViewport: viewportRef.current,
        dragSnapshots: new Map([[obj.id, JSON.parse(JSON.stringify(obj))]]),
        resizeTargetId: obj.id,
        resizeStartBounds: bounds,
      };
    },
    [pushUndoSnapshot]
  );

  const editingIdRef = useRef<string | null>(editingId);
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  const startObjectDragRef = useRef(startObjectDrag);
  useEffect(() => {
    startObjectDragRef.current = startObjectDrag;
  }, [startObjectDrag]);

  const startObjectResizeRef = useRef(startObjectResize);
  useEffect(() => {
    startObjectResizeRef.current = startObjectResize;
  }, [startObjectResize]);

  const batchUpdateBoardObjectsRef = useRef(batchUpdateBoardObjects);
  useEffect(() => {
    batchUpdateBoardObjectsRef.current = batchUpdateBoardObjects;
  }, [batchUpdateBoardObjects]);

  const updateBoardObjectRef = useRef(updateBoardObject);
  useEffect(() => {
    updateBoardObjectRef.current = updateBoardObject;
  }, [updateBoardObject]);

  // Helper to create tool objects on mobile touch or mouse click at a given screen point
  const handleTouchCreateAtScreenPoint = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (!canvasRef.current) return false;
      const tool = activeToolRef.current;
      if (
        tool !== 'sticky' &&
        tool !== 'shape' &&
        tool !== 'text' &&
        tool !== 'stamp' &&
        tool !== 'section' &&
        tool !== 'pen'
      ) {
        return false;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const worldPt = screenToWorld(clientX, clientY, viewportRef.current, rect);

      if (tool === 'sticky') {
        const id = `sticky-${Date.now()}`;
        const newSticky: StickyNoteObject = {
          id,
          type: 'sticky',
          x: Math.round(worldPt.x - 115),
          y: Math.round(worldPt.y - 95),
          width: 230,
          height: 190,
          text: '',
          color: activeColor,
          authorName: currentUser.name,
          authorColor: currentUser.color,
          votes: [],
          fontStyle: 'hand',
          fontSize: 'md',
          zIndex: Date.now() % 100000,
          updatedAt: Date.now(),
        };
        createBoardObject(newSticky);
        setSelectedIds([id]);
        setEditingId(id);
        setActiveTool('select');
        return true;
      }

      if (tool === 'shape') {
        const id = `shape-${Date.now()}`;
        const newShape: ShapeObject = {
          id,
          type: 'shape',
          shapeKind: activeShapeKind,
          x: Math.round(worldPt.x - 95),
          y: Math.round(worldPt.y - 50),
          width: 190,
          height: 100,
          text: 'New Step',
          color: activeColor,
          fillStyle: 'tinted',
          fontStyle: 'sans',
          zIndex: Date.now() % 100000,
          updatedAt: Date.now(),
        };
        createBoardObject(newShape);
        setSelectedIds([id]);
        setEditingId(id);
        setActiveTool('select');
        return true;
      }

      if (tool === 'text') {
        const id = `text-${Date.now()}`;
        const newText: TextObject = {
          id,
          type: 'text',
          x: Math.round(worldPt.x - 120),
          y: Math.round(worldPt.y - 24),
          width: 320,
          height: 54,
          text: 'Heading or Note',
          color: activeColor === 'yellow' ? 'slate' : activeColor,
          fontStyle: 'sans',
          fontSize: 'lg',
          zIndex: Date.now() % 100000,
          updatedAt: Date.now(),
        };
        createBoardObject(newText);
        setSelectedIds([id]);
        setEditingId(id);
        setActiveTool('select');
        return true;
      }

      if (tool === 'stamp') {
        const id = `stamp-${Date.now()}`;
        const newStamp: StampObject = {
          id,
          type: 'stamp',
          stampKind: activeStampKind,
          x: Math.round(worldPt.x),
          y: Math.round(worldPt.y),
          scale: 1,
          rotation: Math.round((Math.random() - 0.5) * 22),
          authorName: currentUser.name,
          authorColor: currentUser.color,
          zIndex: Date.now() % 100000,
          updatedAt: Date.now(),
        };
        createBoardObject(newStamp);
        sendWs({
          type: 'reaction:send',
          emoji: activeStampKind,
          x: worldPt.x,
          y: worldPt.y,
        });
        setActiveTool('select');
        return true;
      }

      if (tool === 'section') {
        pushUndoSnapshot(objectsRef.current);
        const id = `sec-${Date.now()}`;
        const newSection: SectionObject = {
          id,
          type: 'section',
          x: Math.round(worldPt.x),
          y: Math.round(worldPt.y),
          width: 420,
          height: 320,
          title: 'New Workshop Section',
          color: activeColor,
          zIndex: 1,
          updatedAt: Date.now(),
        };
        createBoardObject(newSection, false);
        setSelectedIds([id]);
        setActiveTool('select');
        return true;
      }

      if (tool === 'pen') {
        pushUndoSnapshot(objectsRef.current);
        const id = `path-${Date.now()}`;
        const newPath: PathObject = {
          id,
          type: 'path',
          points: [worldPt],
          color: activeColor === 'yellow' && !isHighlighter ? 'slate' : activeColor,
          strokeWidth: isHighlighter ? 22 : penStrokeWidth,
          isHighlighter,
          zIndex: Date.now() % 100000,
          updatedAt: Date.now(),
        };
        setObjects((prev) => {
          const next = [...prev, newPath];
          objectsRef.current = next;
          return next;
        });
        interactionRef.current = {
          mode: 'drawing_path',
          startScreen: { x: clientX, y: clientY },
          startWorld: worldPt,
          startViewport: viewportRef.current,
          dragSnapshots: new Map(),
          activePathId: id,
        };
        return true;
      }

      return false;
    },
    [
      activeColor,
      activeShapeKind,
      activeStampKind,
      createBoardObject,
      currentUser.color,
      currentUser.name,
      isHighlighter,
      penStrokeWidth,
      pushUndoSnapshot,
      sendWs,
    ]
  );

  const handleTouchCreateRef = useRef(handleTouchCreateAtScreenPoint);
  useEffect(() => {
    handleTouchCreateRef.current = handleTouchCreateAtScreenPoint;
  }, [handleTouchCreateAtScreenPoint]);

  // Native non-passive touch listeners on canvas for smooth mobile pinch-to-zoom, pan & object dragging
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    // Prevent default iOS Safari pinch-to-zoom on the webpage
    const preventSafariGesture = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    document.addEventListener('gesturechange', preventSafariGesture, { passive: false });
    document.addEventListener('gestureend', preventSafariGesture, { passive: false });

    let lastPinchDist = 0;
    let lastPinchCenter = { x: 0, y: 0 };
    let isPinching = false;
    let lastSingleTouch = { x: 0, y: 0 };
    let isSinglePanning = false;
    let pendingInputDragObj: BoardObject | null = null;
    let pendingInputStartScreen = { x: 0, y: 0 };

    const onTouchStart = (e: TouchEvent) => {
      setFollowingUserId(null);

      if (e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        pendingInputDragObj = null;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        lastPinchCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        isPinching = true;
        isSinglePanning = false;

        // Cancel any active drag/marquee interaction
        interactionRef.current = {
          mode: 'none',
          startScreen: { x: 0, y: 0 },
          startWorld: { x: 0, y: 0 },
          startViewport: viewportRef.current,
          dragSnapshots: new Map(),
        };
        setMarqueeBox(null);
      } else if (e.touches.length === 1) {
        isPinching = false;
        lastPinchDist = 0;
        pendingInputDragObj = null;
        const t = e.touches[0];
        lastSingleTouch = { x: t.clientX, y: t.clientY };

        const target = e.target as HTMLElement | null;

        // 1. Check explicit Drag Handle ("Move" bar on Text / Sticky) first!
        const dragHandleEl = target?.closest('[data-drag-handle-id]') as HTMLElement | null;
        if (dragHandleEl) {
          const dragId = dragHandleEl.getAttribute('data-drag-handle-id');
          const obj = dragId ? objectsMapRef.current.get(dragId) : null;
          if (obj) {
            if (e.cancelable) e.preventDefault();
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            setEditingId(null);
            isSinglePanning = false;
            startObjectDragRef.current(obj, { x: t.clientX, y: t.clientY }, false);
            return;
          }
        }

        // 2. Check Corner Resize Handle
        const resizeEl = target?.closest('[data-resize-id]') as HTMLElement | null;
        if (resizeEl) {
          const resizeId = resizeEl.getAttribute('data-resize-id');
          const obj = resizeId ? objectsMapRef.current.get(resizeId) : null;
          if (obj) {
            if (e.cancelable) e.preventDefault();
            isSinglePanning = false;
            startObjectResizeRef.current(obj, { x: t.clientX, y: t.clientY });
            return;
          }
        }

        // 3. Allow normal buttons & links to receive taps
        const isButton = target?.closest('button') !== null || target?.closest('a') !== null;
        if (isButton) {
          return;
        }

        // 4. If touching inside an active <textarea> or <input> on a board object:
        // Allow typing if it's a tap, OR automatically switch to dragging the text box if the user slides their finger!
        const isInput =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        const objectEl = target?.closest('[data-object-id]') as HTMLElement | null;

        if (isInput) {
          if (objectEl && activeToolRef.current !== 'hand') {
            const objId = objectEl.getAttribute('data-object-id');
            const obj = objId ? objectsMapRef.current.get(objId) : null;
            if (obj && !obj.locked) {
              pendingInputDragObj = obj;
              pendingInputStartScreen = { x: t.clientX, y: t.clientY };
            }
          }
          return;
        }

        // 5. Touching any Board Object (Text, Sticky, Shape, Photo/Attachment, Stamp, Section)
        if (objectEl && activeToolRef.current !== 'hand' && !isSpacePressedRef.current) {
          const objId = objectEl.getAttribute('data-object-id');
          const obj = objId ? objectsMapRef.current.get(objId) : null;
          if (obj) {
            if (editingIdRef.current && editingIdRef.current !== obj.id) {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              setEditingId(null);
            }
            if (activeToolRef.current === 'eraser') {
              if (e.cancelable) e.preventDefault();
              requestDeleteObjects([obj.id]);
              return;
            }
            if (e.cancelable) e.preventDefault();
            isSinglePanning = false;
            if (activeToolRef.current !== 'select') {
              setActiveTool('select');
            }
            startObjectDragRef.current(obj, { x: t.clientX, y: t.clientY }, false);
            return;
          }
        }

        // 6. Touching empty canvas: close any active text editing & handle tool creation or panning
        if (editingIdRef.current) {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          setEditingId(null);
        }

        const isCanvas =
          e.target === canvasEl || (e.target as HTMLElement).id === 'canvas' || !objectEl;

        if (isCanvas && handleTouchCreateRef.current(t.clientX, t.clientY)) {
          if (e.cancelable && activeToolRef.current === 'pen') {
            e.preventDefault();
          }
          isSinglePanning = false;
          return;
        }

        if (
          activeToolRef.current === 'hand' ||
          isSpacePressedRef.current ||
          (activeToolRef.current === 'select' && isCanvas)
        ) {
          isSinglePanning = true;
        } else {
          isSinglePanning = false;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        pendingInputDragObj = null;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const currentCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };

        if (!isPinching || lastPinchDist <= 0) {
          isPinching = true;
          isSinglePanning = false;
          lastPinchDist = currentDist;
          lastPinchCenter = currentCenter;
          return;
        }

        if (lastPinchDist > 0 && currentDist > 0) {
          const scale = currentDist / lastPinchDist;
          const dx = currentCenter.x - lastPinchCenter.x;
          const dy = currentCenter.y - lastPinchCenter.y;

          const rect = canvasEl.getBoundingClientRect();
          const focalX = currentCenter.x - rect.left;
          const focalY = currentCenter.y - rect.top;

          const prevVp = viewportRef.current;
          const nextZoom = Math.min(4, Math.max(0.15, prevVp.zoom * scale));

          // Focal zoom around center of two fingers + translation
          const nextX = focalX - ((focalX - prevVp.x) / prevVp.zoom) * nextZoom + dx;
          const nextY = focalY - ((focalY - prevVp.y) / prevVp.zoom) * nextZoom + dy;

          const nextVp = { x: nextX, y: nextY, zoom: nextZoom };
          setViewport(nextVp);
          viewportRef.current = nextVp;

          lastPinchDist = currentDist;
          lastPinchCenter = currentCenter;
        }
      } else if (e.touches.length === 1) {
        const t = e.touches[0];

        // If user started touch on a <textarea> (written text) and slid finger > 7px, convert to object drag!
        if (pendingInputDragObj && interactionRef.current.mode === 'none') {
          const moveDist = Math.hypot(
            t.clientX - pendingInputStartScreen.x,
            t.clientY - pendingInputStartScreen.y
          );
          if (moveDist > 7) {
            if (e.cancelable) e.preventDefault();
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            setEditingId(null);
            const objToDrag = pendingInputDragObj;
            pendingInputDragObj = null;
            startObjectDragRef.current(objToDrag, pendingInputStartScreen, false);
          }
        }

        const state = interactionRef.current;
        if (state.mode === 'dragging_objects') {
          if (e.cancelable) e.preventDefault();
          const rect = canvasEl.getBoundingClientRect();
          const worldPt = screenToWorld(t.clientX, t.clientY, viewportRef.current, rect);
          const dx = Math.round(worldPt.x - state.startWorld.x);
          const dy = Math.round(worldPt.y - state.startWorld.y);
          if (dx === 0 && dy === 0) return;

          const updatedBatch: BoardObject[] = [];
          for (const [, orig] of state.dragSnapshots.entries()) {
            const copy: BoardObject = JSON.parse(JSON.stringify(orig));
            if ('x' in copy && 'y' in copy) {
              copy.x = orig.type !== 'path' && orig.type !== 'connector' ? (orig as StickyNoteObject).x + dx : 0;
              copy.y = orig.type !== 'path' && orig.type !== 'connector' ? (orig as StickyNoteObject).y + dy : 0;
            } else if (copy.type === 'path') {
              copy.points = copy.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            } else if (copy.type === 'connector') {
              copy.fromPoint = {
                x: copy.fromPoint.x + dx,
                y: copy.fromPoint.y + dy,
              };
              copy.toPoint = {
                x: copy.toPoint.x + dx,
                y: copy.toPoint.y + dy,
              };
            }
            updatedBatch.push(copy);
          }
          batchUpdateBoardObjectsRef.current(updatedBatch, true);
          return;
        }

        if (state.mode === 'resizing_object' && state.resizeTargetId && state.resizeStartBounds) {
          if (e.cancelable) e.preventDefault();
          const rect = canvasEl.getBoundingClientRect();
          const worldPt = screenToWorld(t.clientX, t.clientY, viewportRef.current, rect);
          const orig = state.dragSnapshots.get(state.resizeTargetId);
          if (orig) {
            const dx = Math.round(worldPt.x - state.startWorld.x);
            const dy = Math.round(worldPt.y - state.startWorld.y);
            if (
              orig.type === 'sticky' ||
              orig.type === 'shape' ||
              orig.type === 'section' ||
              orig.type === 'text' ||
              orig.type === 'attachment'
            ) {
              const minW = orig.type === 'section' ? 200 : 120;
              const minH = orig.type === 'text' ? 38 : 80;
              const updated: BoardObject = {
                ...orig,
                width: Math.max(minW, state.resizeStartBounds.width + dx),
                height: Math.max(minH, state.resizeStartBounds.height + dy),
              };
              updateBoardObjectRef.current(updated, true);
            }
          }
          return;
        }

        if (state.mode === 'drawing_path' && state.activePathId) {
          if (e.cancelable) e.preventDefault();
          const rect = canvasEl.getBoundingClientRect();
          const worldPt = screenToWorld(t.clientX, t.clientY, viewportRef.current, rect);
          const target = objectsMapRef.current.get(state.activePathId);
          if (target && target.type === 'path') {
            const lastPt = target.points[target.points.length - 1];
            if (!lastPt || Math.hypot(worldPt.x - lastPt.x, worldPt.y - lastPt.y) > 3) {
              const updated: PathObject = {
                ...target,
                points: [...target.points, { x: Math.round(worldPt.x), y: Math.round(worldPt.y) }],
              };
              updateBoardObjectRef.current(updated, false);
            }
          }
          return;
        }

        if (isSinglePanning) {
          if (e.cancelable) e.preventDefault();
          const dx = t.clientX - lastSingleTouch.x;
          const dy = t.clientY - lastSingleTouch.y;
          lastSingleTouch = { x: t.clientX, y: t.clientY };
          setViewport((prev) => {
            const nextVp = {
              ...prev,
              x: prev.x + dx,
              y: prev.y + dy,
            };
            viewportRef.current = nextVp;
            return nextVp;
          });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      pendingInputDragObj = null;
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        lastPinchCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        isPinching = true;
        isSinglePanning = false;
      } else if (e.touches.length === 1) {
        isPinching = false;
        lastPinchDist = 0;
        const t = e.touches[0];
        lastSingleTouch = { x: t.clientX, y: t.clientY };
        isSinglePanning = false;
      } else {
        isPinching = false;
        lastPinchDist = 0;
        isSinglePanning = false;
        const curState = interactionRef.current;
        if (curState.mode === 'drawing_path' && curState.activePathId) {
          const finishedPath = objectsMapRef.current.get(curState.activePathId);
          if (finishedPath && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'object:create', object: finishedPath }));
          }
        }
        if (
          curState.mode === 'dragging_objects' ||
          curState.mode === 'resizing_object' ||
          curState.mode === 'drawing_path'
        ) {
          interactionRef.current = {
            mode: 'none',
            startScreen: { x: 0, y: 0 },
            startWorld: { x: 0, y: 0 },
            startViewport: viewportRef.current,
            dragSnapshots: new Map(),
          };
        }
      }
    };

    canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventSafariGesture);
      document.removeEventListener('gesturechange', preventSafariGesture);
      document.removeEventListener('gestureend', preventSafariGesture);
      canvasEl.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isAuthenticated]);

  // Wheel Zoom & Two-Finger Pan on Infinite Canvas
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setFollowingUserId(null);

    if (e.ctrlKey || e.metaKey) {
      // Focal-point zoom around cursor
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.min(4, Math.max(0.15, viewport.zoom * zoomFactor));

      const nextX = mouseX - ((mouseX - viewport.x) / viewport.zoom) * nextZoom;
      const nextY = mouseY - ((mouseY - viewport.y) / viewport.zoom) * nextZoom;

      const nextVp = { x: nextX, y: nextY, zoom: nextZoom };
      setViewport(nextVp);
      emitCursorTelemetry(worldCursorPos, undefined, nextVp);
    } else {
      // Pan canvas
      const nextVp = {
        ...viewport,
        x: viewport.x - e.deltaX,
        y: viewport.y - e.deltaY,
      };
      setViewport(nextVp);
      emitCursorTelemetry(worldCursorPos, undefined, nextVp);
    }
  };

  // Start Connector Drag from a Specific Anchor Port
  const handleStartConnectorFromPort = (
    e: React.MouseEvent,
    sourceObj: BoardObject,
    port: AnchorPort
  ) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    pushUndoSnapshot(objects);
    const startPt = getAnchorPoint(sourceObj, port);
    const connId = `conn-${Date.now()}`;
    const newConn: ConnectorObject = {
      id: connId,
      type: 'connector',
      fromId: sourceObj.id,
      fromPort: port,
      fromPoint: startPt,
      toId: null,
      toPort: 'left',
      toPoint: startPt,
      label: '',
      color: 'color' in sourceObj ? sourceObj.color : activeColor,
      lineStyle: 'solid',
      curveStyle: 'curved',
      zIndex: Date.now() % 100000,
      updatedAt: Date.now(),
    };
    setObjects((prev) => [...prev, newConn]);
    setSelectedIds([connId]);
    interactionRef.current = {
      mode: 'drawing_connector',
      startScreen: { x: e.clientX, y: e.clientY },
      startWorld: startPt,
      startViewport: viewport,
      dragSnapshots: new Map(),
      activeConnectorId: connId,
    };
  };

  // Canvas Pointer Down
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldPt = screenToWorld(e.clientX, e.clientY, viewport, rect);

    // Middle click, Spacebar, or Hand tool -> Panning
    if (
      e.button === 1 ||
      isSpacePressedRef.current ||
      activeTool === 'hand'
    ) {
      setFollowingUserId(null);
      interactionRef.current = {
        mode: 'panning',
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: worldPt,
        startViewport: { ...viewport },
        dragSnapshots: new Map(),
      };
      return;
    }

    if (e.button !== 0) return;

    if (editingId) {
      setEditingId(null);
    }

    // Tool-specific creation on canvas click/drag
    if (activeTool === 'sticky') {
      const id = `sticky-${Date.now()}`;
      const newSticky: StickyNoteObject = {
        id,
        type: 'sticky',
        x: Math.round(worldPt.x - 115),
        y: Math.round(worldPt.y - 95),
        width: 230,
        height: 190,
        text: '',
        color: activeColor,
        authorName: currentUser.name,
        authorColor: currentUser.color,
        votes: [],
        fontStyle: 'hand',
        fontSize: 'md',
        zIndex: Date.now() % 100000,
        updatedAt: Date.now(),
      };
      createBoardObject(newSticky);
      setSelectedIds([id]);
      setEditingId(id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'shape') {
      const id = `shape-${Date.now()}`;
      const newShape: ShapeObject = {
        id,
        type: 'shape',
        shapeKind: activeShapeKind,
        x: Math.round(worldPt.x - 95),
        y: Math.round(worldPt.y - 50),
        width: 190,
        height: 100,
        text: 'New Step',
        color: activeColor,
        fillStyle: 'tinted',
        fontStyle: 'sans',
        zIndex: Date.now() % 100000,
        updatedAt: Date.now(),
      };
      createBoardObject(newShape);
      setSelectedIds([id]);
      setEditingId(id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'text') {
      const id = `text-${Date.now()}`;
      const newText: TextObject = {
        id,
        type: 'text',
        x: Math.round(worldPt.x - 120),
        y: Math.round(worldPt.y - 24),
        width: 320,
        height: 54,
        text: 'Heading or Note',
        color: activeColor === 'yellow' ? 'slate' : activeColor,
        fontStyle: 'sans',
        fontSize: 'lg',
        zIndex: Date.now() % 100000,
        updatedAt: Date.now(),
      };
      createBoardObject(newText);
      setSelectedIds([id]);
      setEditingId(id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'section') {
      pushUndoSnapshot(objects);
      const id = `sec-${Date.now()}`;
      const newSection: SectionObject = {
        id,
        type: 'section',
        x: Math.round(worldPt.x),
        y: Math.round(worldPt.y),
        width: 420,
        height: 320,
        title: 'New Workshop Section',
        color: activeColor,
        zIndex: 1,
        updatedAt: Date.now(),
      };
      createBoardObject(newSection, false);
      setSelectedIds([id]);
      interactionRef.current = {
        mode: 'creating_box',
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: worldPt,
        startViewport: viewport,
        dragSnapshots: new Map(),
        activeBoxId: id,
      };
      return;
    }

    if (activeTool === 'stamp') {
      const id = `stamp-${Date.now()}`;
      const newStamp: StampObject = {
        id,
        type: 'stamp',
        stampKind: activeStampKind,
        x: Math.round(worldPt.x),
        y: Math.round(worldPt.y),
        scale: 1,
        rotation: Math.round((Math.random() - 0.5) * 22),
        authorName: currentUser.name,
        authorColor: currentUser.color,
        zIndex: Date.now() % 100000,
        updatedAt: Date.now(),
      };
      createBoardObject(newStamp);
      sendWs({
        type: 'reaction:send',
        emoji: activeStampKind,
        x: worldPt.x,
        y: worldPt.y,
      });
      return;
    }

    if (activeTool === 'pen') {
      pushUndoSnapshot(objects);
      const id = `path-${Date.now()}`;
      const newPath: PathObject = {
        id,
        type: 'path',
        points: [worldPt],
        color: activeColor === 'yellow' && !isHighlighter ? 'slate' : activeColor,
        strokeWidth: isHighlighter ? 22 : penStrokeWidth,
        isHighlighter,
        zIndex: Date.now() % 100000,
        updatedAt: Date.now(),
      };
      setObjects((prev) => [...prev, newPath]);
      interactionRef.current = {
        mode: 'drawing_path',
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: worldPt,
        startViewport: viewport,
        dragSnapshots: new Map(),
        activePathId: id,
      };
      return;
    }

    if (activeTool === 'connector') {
      pushUndoSnapshot(objects);
      const nearest = findNearestAnchor(worldPt, objects, undefined, 48);
      const id = `conn-${Date.now()}`;
      const newConn: ConnectorObject = {
        id,
        type: 'connector',
        fromId: nearest ? nearest.objectId : null,
        fromPort: nearest ? nearest.port : 'right',
        fromPoint: nearest ? nearest.point : worldPt,
        toId: null,
        toPort: 'left',
        toPoint: worldPt,
        label: '',
        color: activeColor === 'yellow' ? 'violet' : activeColor,
        lineStyle: 'solid',
        curveStyle: 'curved',
        zIndex: Date.now() % 100000,
        updatedAt: Date.now(),
      };
      setObjects((prev) => [...prev, newConn]);
      setSelectedIds([id]);
      interactionRef.current = {
        mode: 'drawing_connector',
        startScreen: { x: e.clientX, y: e.clientY },
        startWorld: worldPt,
        startViewport: viewport,
        dragSnapshots: new Map(),
        activeConnectorId: id,
      };
      return;
    }

    // Default Select Tool on empty canvas -> Start Marquee Selection Box
    setSelectedIds([]);
    interactionRef.current = {
      mode: 'marquee',
      startScreen: { x: e.clientX, y: e.clientY },
      startWorld: worldPt,
      startViewport: viewport,
      dragSnapshots: new Map(),
    };
    setMarqueeBox({ x: worldPt.x, y: worldPt.y, width: 0, height: 0 });
  };

  // Object Pointer Down (Selecting / Dragging Objects)
  const handleObjectMouseDown = (e: React.MouseEvent, obj: BoardObject) => {
    if (
      e.button === 1 ||
      isSpacePressedRef.current ||
      activeTool === 'hand'
    ) {
      return;
    }
    e.stopPropagation();

    if (activeTool === 'eraser') {
      requestDeleteObjects([obj.id]);
      return;
    }

    if (activeTool === 'connector') {
      handleStartConnectorFromPort(e, obj, 'right');
      return;
    }

    startObjectDrag(obj, { x: e.clientX, y: e.clientY }, e.shiftKey);
  };

  // Object Touch Down (Touch Dragging on Mobile Phone)
  const handleObjectTouchStart = (e: React.TouchEvent, obj: BoardObject) => {
    if (e.touches.length !== 1) return;
    if (activeToolRef.current === 'hand' || isSpacePressedRef.current) return;
    const target = e.target as HTMLElement;
    if (
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.closest('button') ||
      target?.closest('a')
    ) {
      return;
    }
    const t = e.touches[0];
    startObjectDrag(obj, { x: t.clientX, y: t.clientY }, false);
  };

  // Start Object Corner Resize
  const handleStartResize = (e: React.MouseEvent, obj: BoardObject) => {
    e.stopPropagation();
    startObjectResize(obj, { x: e.clientX, y: e.clientY });
  };

  // Start Object Corner Resize via Mobile Touch
  const handleStartResizeTouch = (e: React.TouchEvent, obj: BoardObject) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startObjectResize(obj, { x: t.clientX, y: t.clientY });
  };

  // Canvas Pointer Move
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldPt = screenToWorld(e.clientX, e.clientY, viewport, rect);

    setScreenCursorPos({ x: e.clientX, y: e.clientY });
    setWorldCursorPos(worldPt);
    emitCursorTelemetry(worldPt);

    const state = interactionRef.current;
    if (state.mode === 'none') return;

    if (state.mode === 'panning') {
      const dx = e.clientX - state.startScreen.x;
      const dy = e.clientY - state.startScreen.y;
      setViewport({
        ...state.startViewport,
        x: state.startViewport.x + dx,
        y: state.startViewport.y + dy,
      });
      return;
    }

    if (state.mode === 'marquee') {
      const x = Math.min(state.startWorld.x, worldPt.x);
      const y = Math.min(state.startWorld.y, worldPt.y);
      const width = Math.abs(worldPt.x - state.startWorld.x);
      const height = Math.abs(worldPt.y - state.startWorld.y);
      const box = { x, y, width, height };
      setMarqueeBox(box);

      const hitIds = objects
        .filter((obj) => boxesIntersect(box, getObjectBounds(obj)))
        .map((o) => o.id);
      setSelectedIds(hitIds);
      return;
    }

    if (state.mode === 'dragging_objects') {
      const dx = Math.round(worldPt.x - state.startWorld.x);
      const dy = Math.round(worldPt.y - state.startWorld.y);
      if (dx === 0 && dy === 0) return;

      const updatedBatch: BoardObject[] = [];
      for (const [, orig] of state.dragSnapshots.entries()) {
        const copy: BoardObject = JSON.parse(JSON.stringify(orig));
        if ('x' in copy && 'y' in copy) {
          copy.x = orig.type !== 'path' && orig.type !== 'connector' ? (orig as StickyNoteObject).x + dx : 0;
          copy.y = orig.type !== 'path' && orig.type !== 'connector' ? (orig as StickyNoteObject).y + dy : 0;
        } else if (copy.type === 'path') {
          copy.points = copy.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        } else if (copy.type === 'connector') {
          copy.fromPoint = {
            x: copy.fromPoint.x + dx,
            y: copy.fromPoint.y + dy,
          };
          copy.toPoint = {
            x: copy.toPoint.x + dx,
            y: copy.toPoint.y + dy,
          };
        }
        updatedBatch.push(copy);
      }
      batchUpdateBoardObjects(updatedBatch, true);
      return;
    }

    if (
      state.mode === 'resizing_object' &&
      state.resizeTargetId &&
      state.resizeStartBounds
    ) {
      const orig = state.dragSnapshots.get(state.resizeTargetId);
      if (!orig) return;
      const dx = Math.round(worldPt.x - state.startWorld.x);
      const dy = Math.round(worldPt.y - state.startWorld.y);

      if (
        orig.type === 'sticky' ||
        orig.type === 'shape' ||
        orig.type === 'section' ||
        orig.type === 'text' ||
        orig.type === 'attachment'
      ) {
        const minW = orig.type === 'section' ? 200 : 120;
        const minH = orig.type === 'text' ? 38 : 80;
        const updated: BoardObject = {
          ...orig,
          width: Math.max(minW, state.resizeStartBounds.width + dx),
          height: Math.max(minH, state.resizeStartBounds.height + dy),
        };
        updateBoardObject(updated, true);
      }
      return;
    }

    if (state.mode === 'creating_box' && state.activeBoxId) {
      const target = objectsMap.get(state.activeBoxId);
      if (target && target.type === 'section') {
        const w = Math.max(260, Math.round(worldPt.x - state.startWorld.x));
        const h = Math.max(200, Math.round(worldPt.y - state.startWorld.y));
        updateBoardObject({ ...target, width: w, height: h }, true);
      }
      return;
    }

    if (state.mode === 'drawing_path' && state.activePathId) {
      const target = objectsMap.get(state.activePathId);
      if (target && target.type === 'path') {
        const lastPt = target.points[target.points.length - 1];
        if (!lastPt || Math.hypot(worldPt.x - lastPt.x, worldPt.y - lastPt.y) > 3) {
          const updated: PathObject = {
            ...target,
            points: [...target.points, { x: Math.round(worldPt.x), y: Math.round(worldPt.y) }],
          };
          updateBoardObject(updated, false);
        }
      }
      return;
    }

    if (state.mode === 'drawing_connector' && state.activeConnectorId) {
      const target = objectsMap.get(state.activeConnectorId);
      if (target && target.type === 'connector') {
        const nearest = findNearestAnchor(
          worldPt,
          objects,
          target.fromId || undefined,
          44
        );
        setSnapCandidate(nearest);
        const updated: ConnectorObject = {
          ...target,
          toId: nearest ? nearest.objectId : null,
          toPort: nearest ? nearest.port : 'left',
          toPoint: nearest ? nearest.point : { x: Math.round(worldPt.x), y: Math.round(worldPt.y) },
        };
        updateBoardObject(updated, true);
      }
      return;
    }
  };

  // Canvas Pointer Up
  const handleCanvasMouseUp = () => {
    const state = interactionRef.current;
    if (state.mode === 'drawing_path' && state.activePathId) {
      const finishedPath = objectsMap.get(state.activePathId);
      if (finishedPath) {
        sendWs({ type: 'object:create', object: finishedPath });
      }
    } else if (state.mode === 'drawing_connector' && state.activeConnectorId) {
      const finishedConn = objectsMap.get(state.activeConnectorId);
      if (finishedConn) {
        sendWs({ type: 'object:create', object: finishedConn });
      }
      setActiveTool('select');
    } else if (state.mode === 'creating_box') {
      setActiveTool('select');
    }

    interactionRef.current = {
      mode: 'none',
      startScreen: { x: 0, y: 0 },
      startWorld: { x: 0, y: 0 },
      startViewport: viewport,
      dragSnapshots: new Map(),
    };
    setMarqueeBox(null);
    setSnapCandidate(null);
  };

  // Toggle Dot-Vote on a Sticky Note
  const handleToggleVote = useCallback(
    (stickyId: string) => {
      const target = objectsMap.get(stickyId);
      if (!target || target.type !== 'sticky') return;
      const hasVoted = target.votes.includes(currentUser.id);
      const nextVotes = hasVoted
        ? target.votes.filter((id) => id !== currentUser.id)
        : [...target.votes, currentUser.id];
      updateBoardObject({ ...target, votes: nextVotes }, true);
    },
    [currentUser.id, objectsMap, updateBoardObject]
  );

  // Workspace Projects & Pages Handlers
  const handleSelectProject = useCallback(
    (newProjId: string) => {
      if (newProjId === activeProjectId) return;

      const now = Date.now();
      const curObjects = objectsRef.current;
      const curViewport = viewportRef.current;

      // 1. Immediately sync current page canvas state into workspace & switch activeProjectId
      setWorkspace((prevWs) => {
        const updated: WorkspaceState = {
          ...prevWs,
          activeProjectId: newProjId,
          projects: prevWs.projects.map((p) => {
            if (p.id !== activeProjectId) return p;
            return {
              ...p,
              activePageId,
              pages: p.pages.map((pg) =>
                pg.id === activePageId
                  ? { ...pg, objects: curObjects, viewport: curViewport, updatedAt: now }
                  : pg
              ),
              updatedAt: now,
            };
          }),
        };
        workspaceRef.current = updated;
        saveWorkspaceToStorage(updated, true);
        return updated;
      });

      // 2. Resolve destination project & page
      const targetProj = workspaceRef.current.projects.find((p) => p.id === newProjId);
      if (!targetProj) return;

      const targetPageId =
        targetProj.activePageId || targetProj.pages[0]?.id || 'page-1';
      const targetPage =
        targetProj.pages.find((pg) => pg.id === targetPageId) ||
        targetProj.pages[0];

      setActiveProjectId(newProjId);
      setActivePageId(targetPageId);
      setRoomId(targetPageId);
      setSelectedIds([]);
      setEditingId(null);
      setFollowingUserId(null);

      if (targetPage) {
        const pageObjs = targetPage.objects || [];
        setObjects(pageObjs);
        objectsRef.current = pageObjs;
        setBoardTitle(targetPage.name);
        const pageVp = targetPage.viewport || { x: 60, y: 40, zoom: 1 };
        setViewport(pageVp);
        viewportRef.current = pageVp;
      }

      const url = new URL(window.location.href);
      url.searchParams.set('project', newProjId);
      url.searchParams.set('page', targetPageId);
      window.history.pushState({}, '', url.toString());
    },
    [activeProjectId, activePageId]
  );

  const handleCreateProject = useCallback(
    (customName?: string) => {
      const curWs = workspaceRef.current;
      const name = customName?.trim() || `Project ${curWs.projects.length + 1}`;
      const newProj = createNewProject(name);
      const now = Date.now();
      const curObjects = objectsRef.current;
      const curViewport = viewportRef.current;

      setWorkspace((prevWs) => {
        const savedExisting = prevWs.projects.map((p) => {
          if (p.id !== activeProjectId) return p;
          return {
            ...p,
            activePageId,
            pages: p.pages.map((pg) =>
              pg.id === activePageId
                ? { ...pg, objects: curObjects, viewport: curViewport, updatedAt: now }
                : pg
            ),
            updatedAt: now,
          };
        });
        const updatedWs: WorkspaceState = {
          ...prevWs,
          activeProjectId: newProj.id,
          projects: [...savedExisting, newProj],
        };
        workspaceRef.current = updatedWs;
        saveWorkspaceToStorage(updatedWs, true);
        return updatedWs;
      });

      setActiveProjectId(newProj.id);
      setActivePageId(newProj.activePageId);
      setRoomId(newProj.activePageId);
      setObjects([]);
      objectsRef.current = [];
      setBoardTitle('Page 1');
      setViewport({ x: 60, y: 40, zoom: 1 });
      viewportRef.current = { x: 60, y: 40, zoom: 1 };
      setSelectedIds([]);
      setEditingId(null);
      setFollowingUserId(null);

      const url = new URL(window.location.href);
      url.searchParams.set('project', newProj.id);
      url.searchParams.set('page', newProj.activePageId);
      window.history.pushState({}, '', url.toString());
    },
    [activeProjectId, activePageId]
  );

  const handleRenameProject = useCallback(
    (projectId: string, newName: string) => {
      const clean = newName.trim();
      if (!clean) return;
      const now = Date.now();
      setWorkspace((prevWs) => {
        const updated: WorkspaceState = {
          ...prevWs,
          projects: prevWs.projects.map((p) =>
            p.id === projectId ? { ...p, name: clean, updatedAt: now } : p
          ),
        };
        workspaceRef.current = updated;
        saveWorkspaceToStorage(updated, true);
        return updated;
      });
    },
    []
  );

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      if (workspace.projects.length <= 1) return;
      const proj = workspace.projects.find((p) => p.id === projectId);
      if (!proj) return;

      setConfirmationState({
        isOpen: true,
        title: `Delete project "${proj.name}"?`,
        message: `Are you sure you want to delete "${proj.name}" and all of its ${proj.pages.length} page(s)? This action cannot be undone.`,
        confirmLabel: 'Delete Project',
        onConfirm: () => {
          setConfirmationState((prev) => ({ ...prev, isOpen: false }));
          const remaining = workspace.projects.filter((p) => p.id !== projectId);
          const nextActiveProj = remaining[0];
          const nextActivePageId =
            nextActiveProj.activePageId || nextActiveProj.pages[0]?.id || 'page-1';
          const nextActivePage =
            nextActiveProj.pages.find((pg) => pg.id === nextActivePageId) ||
            nextActiveProj.pages[0];

          const updatedWs: WorkspaceState = {
            ...workspace,
            activeProjectId: nextActiveProj.id,
            projects: remaining,
          };
          setWorkspace(updatedWs);
          saveWorkspaceToStorage(updatedWs);

          setActiveProjectId(nextActiveProj.id);
          setActivePageId(nextActivePageId);
          setRoomId(nextActivePageId);
          const objs = nextActivePage ? nextActivePage.objects : [];
          setObjects(objs);
          objectsRef.current = objs;
          setBoardTitle(nextActivePage ? nextActivePage.name : 'Page 1');
          const vp = nextActivePage?.viewport || { x: 60, y: 40, zoom: 1 };
          setViewport(vp);
          viewportRef.current = vp;

          const url = new URL(window.location.href);
          url.searchParams.set('project', nextActiveProj.id);
          url.searchParams.set('page', nextActivePageId);
          window.history.pushState({}, '', url.toString());
        },
      });
    },
    [workspace]
  );

  const handleSelectPage = useCallback(
    (newPageId: string) => {
      if (newPageId === activePageId) return;

      const now = Date.now();
      const curObjects = objectsRef.current;
      const curViewport = viewportRef.current;

      // 1. Save current page state
      setWorkspace((prevWs) => {
        const updated: WorkspaceState = {
          ...prevWs,
          projects: prevWs.projects.map((p) => {
            if (p.id !== activeProjectId) return p;
            return {
              ...p,
              activePageId: newPageId,
              pages: p.pages.map((pg) =>
                pg.id === activePageId
                  ? { ...pg, objects: curObjects, viewport: curViewport, updatedAt: now }
                  : pg
              ),
              updatedAt: now,
            };
          }),
        };
        workspaceRef.current = updated;
        saveWorkspaceToStorage(updated, true);
        return updated;
      });

      // 2. Switch to target page
      const targetPage = currentProject.pages.find((pg) => pg.id === newPageId);
      if (!targetPage) return;

      setActivePageId(newPageId);
      setRoomId(newPageId);
      setSelectedIds([]);
      setEditingId(null);
      setFollowingUserId(null);
      const pageObjs = targetPage.objects || [];
      setObjects(pageObjs);
      objectsRef.current = pageObjs;
      setBoardTitle(targetPage.name);
      const pageVp = targetPage.viewport || { x: 60, y: 40, zoom: 1 };
      setViewport(pageVp);
      viewportRef.current = pageVp;

      const url = new URL(window.location.href);
      url.searchParams.set('project', activeProjectId);
      url.searchParams.set('page', newPageId);
      window.history.pushState({}, '', url.toString());
    },
    [activeProjectId, activePageId, currentProject.pages]
  );

  const handleCreatePage = useCallback(
    (customName?: string) => {
      const pageName = customName?.trim() || `Page ${currentProject.pages.length + 1}`;
      const newPage = createBlankPage(pageName);
      const now = Date.now();
      const curObjects = objectsRef.current;
      const curViewport = viewportRef.current;

      setWorkspace((prevWs) => {
        const updated: WorkspaceState = {
          ...prevWs,
          projects: prevWs.projects.map((p) => {
            if (p.id !== activeProjectId) return p;
            const updatedPages = p.pages.map((pg) =>
              pg.id === activePageId
                ? { ...pg, objects: curObjects, viewport: curViewport, updatedAt: now }
                : pg
            );
            return {
              ...p,
              activePageId: newPage.id,
              pages: [...updatedPages, newPage],
              updatedAt: now,
            };
          }),
        };
        workspaceRef.current = updated;
        saveWorkspaceToStorage(updated, true);
        return updated;
      });

      setActivePageId(newPage.id);
      setRoomId(newPage.id);
      setObjects([]);
      objectsRef.current = [];
      setBoardTitle(newPage.name);
      setViewport({ x: 60, y: 40, zoom: 1 });
      viewportRef.current = { x: 60, y: 40, zoom: 1 };
      setSelectedIds([]);
      setEditingId(null);
      setFollowingUserId(null);

      const url = new URL(window.location.href);
      url.searchParams.set('project', activeProjectId);
      url.searchParams.set('page', newPage.id);
      window.history.pushState({}, '', url.toString());
    },
    [activeProjectId, activePageId, currentProject.pages.length]
  );

  const handleRenamePage = useCallback(
    (pageId: string, newName: string) => {
      const clean = newName.trim();
      if (!clean) return;
      const now = Date.now();

      if (pageId === activePageId) {
        setBoardTitle(clean);
        sendWs({ type: 'board:title', title: clean });
      }

      setWorkspace((prevWs) => {
        const updated: WorkspaceState = {
          ...prevWs,
          projects: prevWs.projects.map((p) => {
            if (p.id !== activeProjectId) return p;
            return {
              ...p,
              pages: p.pages.map((pg) =>
                pg.id === pageId
                  ? { ...pg, name: clean, updatedAt: now }
                  : pg
              ),
              updatedAt: now,
            };
          }),
        };
        workspaceRef.current = updated;
        saveWorkspaceToStorage(updated, true);
        return updated;
      });
    },
    [activeProjectId, activePageId, sendWs]
  );

  const handleDeletePage = useCallback(
    (pageId: string) => {
      if (currentProject.pages.length <= 1) return;
      const page = currentProject.pages.find((pg) => pg.id === pageId);
      if (!page) return;

      setConfirmationState({
        isOpen: true,
        title: `Delete page "${page.name}"?`,
        message: `Are you sure you want to delete "${page.name}" and its ${page.objects.length} item(s)? This action cannot be undone.`,
        confirmLabel: 'Delete Page',
        onConfirm: () => {
          setConfirmationState((prev) => ({ ...prev, isOpen: false }));
          const remainingPages = currentProject.pages.filter((pg) => pg.id !== pageId);
          const nextActivePage = remainingPages[0];

          setWorkspace((prevWs) => {
            const updated: WorkspaceState = {
              ...prevWs,
              projects: prevWs.projects.map((p) => {
                if (p.id !== activeProjectId) return p;
                return {
                  ...p,
                  activePageId: nextActivePage.id,
                  pages: remainingPages,
                  updatedAt: Date.now(),
                };
              }),
            };
            saveWorkspaceToStorage(updated);
            return updated;
          });

          if (pageId === activePageId) {
            setActivePageId(nextActivePage.id);
            setRoomId(nextActivePage.id);
            setObjects(nextActivePage.objects || []);
            setBoardTitle(nextActivePage.name);
            if (nextActivePage.viewport) setViewport(nextActivePage.viewport);
            setSelectedIds([]);
            setEditingId(null);

            const url = new URL(window.location.href);
            url.searchParams.set('project', activeProjectId);
            url.searchParams.set('page', nextActivePage.id);
            window.history.pushState({}, '', url.toString());
          }
        },
      });
    },
    [activeProjectId, activePageId, currentProject.pages]
  );

  // Switch Collaborative Room (compatibility proxy)
  const handleChangeRoom = (newRoomId: string) => {
    handleSelectPage(newRoomId);
  };

  // Go to Main Project & Page 1 (Home) and reset/fit viewport
  const handleGoToHomePage = useCallback(() => {
    const curWs = workspaceRef.current;
    const firstProj = curWs.projects[0];
    if (!firstProj) return;
    const firstPage = firstProj.pages[0];
    if (!firstPage) return;

    if (firstProj.id !== activeProjectId) {
      handleSelectProject(firstProj.id);
    }
    if (firstPage.id !== activePageId) {
      handleSelectPage(firstPage.id);
    }
    setTimeout(() => {
      handleFitToContent();
    }, 60);
  }, [activePageId, activeProjectId, handleFitToContent, handleSelectPage, handleSelectProject]);

  // Export Board as Crisp Vector SVG File
  const handleExportSvg = () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000" style="background:#F8F9FA;font-family:sans-serif">
      <text x="40" y="45" font-size="22" font-weight="bold" fill="#0F172A">${boardTitle.replace(/[<>&"]/g, '')}</text>
      ${objects
        .map((obj) => {
          if (obj.type === 'section') {
            const pal = BOARD_PALETTE[obj.color];
            return `<g><rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" rx="16" fill="${pal.sectionHeaderBg}" fill-opacity="0.35" stroke="${pal.sectionBorder}" stroke-width="2" stroke-dasharray="6 4"/><text x="${obj.x + 16}" y="${obj.y + 28}" font-size="14" font-weight="bold" fill="${pal.textHex}">${obj.title.replace(/[<>&"]/g, '')}</text></g>`;
          }
          if (obj.type === 'sticky') {
            const pal = BOARD_PALETTE[obj.color];
            return `<g><rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" rx="12" fill="${pal.stickyBg}" stroke="${pal.stickyBorder}" stroke-width="1.5"/><text x="${obj.x + 18}" y="${obj.y + 38}" font-size="14" fill="#1E293B">${obj.text.slice(0, 90).replace(/[<>&"]/g, '')}</text><text x="${obj.x + 18}" y="${obj.y + obj.height - 16}" font-size="11" fill="#64748B">${obj.authorName.replace(/[<>&"]/g, '')} (${obj.votes.length} votes)</text></g>`;
          }
          if (obj.type === 'shape') {
            const pal = BOARD_PALETTE[obj.color];
            return `<g><rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" rx="${obj.shapeKind === 'pill' ? 45 : 12}" fill="${pal.shapeTinted}" stroke="${pal.shapeStroke}" stroke-width="2"/><text x="${obj.x + obj.width / 2}" y="${obj.y + obj.height / 2 + 5}" text-anchor="middle" font-size="13" font-weight="bold" fill="${pal.textHex}">${obj.text.replace(/[<>&"]/g, '')}</text></g>`;
          }
          if (obj.type === 'path') {
            const pal = BOARD_PALETTE[obj.color];
            return `<path d="${buildSmoothSvgPath(obj.points)}" fill="none" stroke="${pal.strokeHex}" stroke-width="${obj.strokeWidth}" stroke-linecap="round"/>`;
          }
          if (obj.type === 'attachment') {
            return `<g><rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/><text x="${obj.x + 16}" y="${obj.y + 28}" font-size="12" font-weight="bold" fill="#0F172A">${obj.fileName.replace(/[<>&"]/g, '')}</text><text x="${obj.x + 16}" y="${obj.y + 48}" font-size="10" fill="#64748B">${obj.attachmentKind.toUpperCase()}</text></g>`;
          }
          return '';
        })
        .join('\n')}
    </svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${roomId}-canvasjam.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Separate objects by layer type for clean rendering
  const sections = useMemo(
    () => objects.filter((o): o is SectionObject => o.type === 'section'),
    [objects]
  );
  const connectors = useMemo(
    () => objects.filter((o): o is ConnectorObject => o.type === 'connector'),
    [objects]
  );
  const paths = useMemo(
    () => objects.filter((o): o is PathObject => o.type === 'path'),
    [objects]
  );
  const foregroundItems = useMemo(
    () =>
      objects.filter(
        (o): o is StickyNoteObject | ShapeObject | TextObject | StampObject | AttachmentObject =>
          o.type === 'sticky' ||
          o.type === 'shape' ||
          o.type === 'text' ||
          o.type === 'stamp' ||
          o.type === 'attachment'
      ),
    [objects]
  );

  // Compute dynamic CSS background grid matching infinite canvas pan & zoom
  const gridSpacing = 24 * viewport.zoom;
  const bgStyle: React.CSSProperties =
    gridMode === 'dots'
      ? {
          backgroundImage: `radial-gradient(circle, #CBD5E1 ${Math.max(
            1,
            1.35 * viewport.zoom
          )}px, transparent ${Math.max(1, 1.35 * viewport.zoom)}px)`,
          backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }
      : gridMode === 'lines'
      ? {
          backgroundImage: `linear-gradient(to right, rgba(203, 213, 225, 0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(203, 213, 225, 0.45) 1px, transparent 1px)`,
          backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }
      : {};

  const permanentUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${encodeURIComponent(roomId)}`
      : 'https://ais-pre-adylaxlu37jeunjyn6wad4-718588674544.asia-southeast1.run.app';

  if (!isAuthenticated) {
    return (
      <LoginGate
        permanentUrl={permanentUrl}
        onSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col bg-[#F8F9FA] overflow-hidden select-none"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          if (!canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const dropWorldPt = screenToWorld(e.clientX, e.clientY, viewport, rect);
          handleAttachFiles(e.dataTransfer.files, dropWorldPt);
        }
      }}
    >
      <TopBar
        projects={workspace.projects}
        activeProjectId={activeProjectId}
        activePageId={activePageId}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        onRenamePage={handleRenamePage}
        onDeletePage={handleDeletePage}
        roomId={roomId}
        boardTitle={boardTitle}
        onUpdateTitle={(newTitle) => handleRenamePage(activePageId, newTitle)}
        currentUser={currentUser}
        peers={peers}
        followingUserId={followingUserId}
        onToggleFollowUser={(uid) =>
          setFollowingUserId((prev) => (prev === uid ? null : uid))
        }
        timer={timer}
        onTimerAction={(action, durationSeconds) =>
          sendWs({ type: 'timer:action', action, durationSeconds })
        }
        gridMode={gridMode}
        onCycleGridMode={() =>
          setGridMode((prev) =>
            prev === 'dots' ? 'lines' : prev === 'lines' ? 'none' : 'dots'
          )
        }
        onFitToContent={handleFitToContent}
        onOpenTemplates={() => setTemplatesModalOpen(true)}
        onOpenActivityAndVotes={() => setActivityDrawerOpen((prev) => !prev)}
        onOpenShareModal={() => setShareModalOpen(true)}
        onExportSvg={handleExportSvg}
        wsConnected={wsConnected}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchMatchCount={matchingObjects.length}
        searchCurrentIndex={searchCurrentIndex}
        onNextSearchMatch={handleNextSearchMatch}
        onPrevSearchMatch={handlePrevSearchMatch}
        isDriveSignedIn={isDriveSignedIn}
        driveQuota={driveQuota}
        isAutosaving={isAutosaving}
        lastAutosaveTime={lastAutosaveTime}
        onGoogleSignIn={handleGoogleSignIn}
        onOpenDriveModal={() => setDriveModalOpen(true)}
        onAttachFiles={(files) => handleAttachFiles(files)}
        onExportWorkspaceBackup={handleExportWorkspaceBackup}
        onImportWorkspaceBackup={handleImportWorkspaceBackup}
        onSaveWorkspaceNow={handleSaveWorkspaceNow}
        onGoToHomePage={handleGoToHomePage}
        onLockWorkspace={() => {
          localStorage.removeItem('cj_auth_token');
          sessionStorage.removeItem('cj_auth_token');
          setIsAuthenticated(false);
        }}
      />

      {/* Cloud Backup Notification Banner if an autosaved version exists in Drive */}
      {cloudBackupNotification && isDriveSignedIn && (
        <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs flex items-center justify-between z-30 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              Google Drive cloud backup available from{' '}
              {new Date(cloudBackupNotification.savedAt).toLocaleTimeString()} (prevents any data loss).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const data = await loadBoardBackup(cloudBackupNotification.id);
                  pushUndoSnapshot(objects);
                  setBoardTitle(data.title);
                  setObjects(data.objects);
                  sendWs({ type: 'board:replace_all', objects: data.objects });
                  setCloudBackupNotification(null);
                } catch (e) {
                  console.error('Failed to restore cloud backup:', e);
                }
              }}
              className="px-2.5 py-0.5 bg-white text-emerald-800 rounded font-bold hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              Restore from Drive
            </button>
            <button
              type="button"
              onClick={() => setCloudBackupNotification(null)}
              className="text-white/80 hover:text-white underline cursor-pointer ml-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Contextual Selection Toolbar */}
      <SelectionToolbar
        selectedObjects={selectedObjects}
        currentUserId={currentUser.id}
        onUpdateSelectedColor={(color) => {
          pushUndoSnapshot(objects);
          const updated = selectedObjects.map((o) =>
            'color' in o ? ({ ...o, color } as BoardObject) : o
          );
          batchUpdateBoardObjects(updated, true);
          setActiveColor(color);
        }}
        onUpdateSelectedFont={(fontStyle) => {
          pushUndoSnapshot(objects);
          const updated = selectedObjects.map((o) =>
            o.type === 'sticky' || o.type === 'shape' || o.type === 'text'
              ? ({ ...o, fontStyle } as BoardObject)
              : o
          );
          batchUpdateBoardObjects(updated, true);
        }}
        onUpdateShapeFill={(fillStyle) => {
          pushUndoSnapshot(objects);
          const updated = selectedObjects.map((o) =>
            o.type === 'shape' ? ({ ...o, fillStyle } as BoardObject) : o
          );
          batchUpdateBoardObjects(updated, true);
        }}
        onUpdateConnectorStyle={(curveStyle, lineStyle) => {
          pushUndoSnapshot(objects);
          const updated = selectedObjects.map((o) => {
            if (o.type !== 'connector') return o;
            return {
              ...o,
              curveStyle: curveStyle || o.curveStyle,
              lineStyle: lineStyle || o.lineStyle,
            };
          });
          batchUpdateBoardObjects(updated, true);
        }}
        onToggleVote={handleToggleVote}
        onBringToFront={() => {
          const maxZ = objects.reduce((acc, o) => Math.max(acc, o.zIndex), 10);
          const updated = selectedObjects.map((o, idx) => ({
            ...o,
            zIndex: maxZ + 1 + idx,
          }));
          batchUpdateBoardObjects(updated, true);
        }}
        onSendToBack={() => {
          const minZ = objects.reduce((acc, o) => Math.min(acc, o.zIndex), 10);
          const updated = selectedObjects.map((o, idx) => ({
            ...o,
            zIndex: Math.max(1, minZ - 1 - idx),
          }));
          batchUpdateBoardObjects(updated, true);
        }}
        onToggleLock={() => {
          const allLocked = selectedObjects.every((o) => o.locked);
          const updated = selectedObjects.map((o) => ({
            ...o,
            locked: !allLocked,
          }));
          batchUpdateBoardObjects(updated, true);
        }}
        onDuplicate={duplicateSelectedObjects}
        onDelete={() => requestDeleteObjects()}
        onReviewAttachment={(att) => setPreviewAttachment(att)}
      />

      {/* Following Peer Banner */}
      {followingUserId && (
        <div className="fixed top-18 right-6 z-30 bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl shadow-md text-xs font-medium flex items-center gap-2">
          <span>
            Following{' '}
            {peers.find((p) => p.id === followingUserId)?.name || 'Collaborator'}
          </span>
          <button
            type="button"
            onClick={() => setFollowingUserId(null)}
            className="underline hover:text-indigo-100 cursor-pointer ml-1"
          >
            Stop
          </button>
        </div>
      )}

      {/* Main Infinite Canvas Surface */}
      <main
        id="canvas"
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={handleWheel}
        style={bgStyle}
        className={`flex-1 relative overflow-hidden touch-none select-none ${
          activeTool === 'hand' || isSpacePressedRef.current
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'pen' ||
              activeTool === 'connector' ||
              activeTool === 'section'
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
      >
        {/* World Transform Container */}
        <div
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute top-0 left-0 w-0 h-0"
        >
          {/* Layer 1: Section Frames (Background) */}
          {sections.map((sec) => {
            const pal = BOARD_PALETTE[sec.color];
            const isSelected = selectedIds.includes(sec.id);
            const isEditing = editingId === sec.id;
            const isSearchMatch = matchingObjectIds.has(sec.id);
            return (
              <div
                key={sec.id}
                data-object-id={sec.id}
                onMouseDown={(e) => handleObjectMouseDown(e, sec)}
                onTouchStart={(e) => handleObjectTouchStart(e, sec)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!sec.locked) setEditingId(sec.id);
                }}
                style={{
                  left: sec.x,
                  top: sec.y,
                  width: sec.width,
                  height: sec.height,
                  backgroundColor: pal.sectionBg,
                  borderColor: isSelected
                    ? '#4F46E5'
                    : isSearchMatch
                    ? '#F59E0B'
                    : pal.sectionBorder,
                  touchAction: 'none',
                }}
                className={`absolute rounded-2xl border-2 transition-shadow ${
                  isSearchMatch
                    ? 'search-match-highlight ring-4 ring-amber-400'
                    : isSelected
                    ? 'ring-2 ring-indigo-500/40'
                    : ''
                }`}
              >
                {/* Section Header Bar */}
                <div
                  style={{
                    backgroundColor: isSearchMatch ? '#FEF3C7' : pal.sectionHeaderBg,
                    color: isSearchMatch ? '#92400E' : pal.textHex,
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-tl-xl rounded-br-xl text-xs font-bold tracking-tight select-none ${
                    isSearchMatch ? 'ring-2 ring-amber-400 shadow-sm' : ''
                  }`}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) =>
                        updateBoardObject(
                          { ...sec, title: e.target.value },
                          true
                        )
                      }
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      autoFocus
                      className="bg-white/90 px-1.5 py-0.5 rounded text-xs font-bold focus:outline-none"
                    />
                  ) : (
                    <span>{sec.title}</span>
                  )}
                  {sec.locked && <Lock className="w-3 h-3 opacity-65" />}
                </div>

                {/* Resize Handle */}
                {isSelected && !sec.locked && (
                  <div
                    data-resize-id={sec.id}
                    onMouseDown={(e) => handleStartResize(e, sec)}
                    onTouchStart={(e) => handleStartResizeTouch(e, sec)}
                    className="w-5 h-5 md:w-3.5 md:h-3.5 bg-white border-2 border-indigo-600 rounded-sm absolute -bottom-2 -right-2 md:-bottom-1.5 md:-right-1.5 cursor-nwse-resize z-20"
                  />
                )}
              </div>
            );
          })}

          {/* Layer 2: Vector SVG Layer for Connectors & Freehand Marker Paths */}
          <svg
            className="overflow-visible absolute top-0 left-0 pointer-events-none"
            width={1}
            height={1}
          >
            {/* Connectors */}
            {connectors.map((conn) => {
              const { from, to } = resolveConnectorEndpoints(conn, objectsMap);
              const geom = buildConnectorGeometry(
                from,
                conn.fromPort,
                to,
                conn.toPort,
                conn.curveStyle
              );
              const pal = BOARD_PALETTE[conn.color];
              const isSelected = selectedIds.includes(conn.id);
              const strokeColor = isSelected ? '#4F46E5' : pal.strokeHex;

              return (
                <g key={conn.id} className="pointer-events-auto">
                  {/* Invisible wider hit target for easy clicking / touching */}
                  <path
                    d={geom.pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={24}
                    className="cursor-pointer"
                    data-object-id={conn.id}
                    onMouseDown={(e) => handleObjectMouseDown(e, conn)}
                    onTouchStart={(e) => handleObjectTouchStart(e as unknown as React.TouchEvent, conn)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(conn.id);
                    }}
                  />
                  {/* Visible Connector Path */}
                  <path
                    d={geom.pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 3.5 : 2.5}
                    strokeDasharray={
                      conn.lineStyle === 'dashed' ? '7 5' : undefined
                    }
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                  {/* Origin Dot */}
                  <circle
                    cx={from.x}
                    cy={from.y}
                    r={4}
                    fill="#FFFFFF"
                    stroke={strokeColor}
                    strokeWidth={2}
                  />
                  {/* Directional Arrowhead at target */}
                  <g
                    transform={`translate(${to.x}, ${to.y}) rotate(${geom.endAngleDeg})`}
                  >
                    <polygon
                      points="0,0 -11,-5.5 -8.5,0 -11,5.5"
                      fill={strokeColor}
                    />
                  </g>
                </g>
              );
            })}

            {/* Freehand Marker & Highlighter Strokes */}
            {paths.map((p) => {
              const pal = BOARD_PALETTE[p.color];
              const isSelected = selectedIds.includes(p.id);
              const d = buildSmoothSvgPath(p.points);
              return (
                <g key={p.id} className="pointer-events-auto">
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(18, p.strokeWidth + 12)}
                    className="cursor-pointer"
                    data-object-id={p.id}
                    onMouseDown={(e) => handleObjectMouseDown(e, p)}
                    onTouchStart={(e) => handleObjectTouchStart(e as unknown as React.TouchEvent, p)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={isSelected ? '#4F46E5' : pal.strokeHex}
                    strokeWidth={p.strokeWidth}
                    strokeOpacity={p.isHighlighter ? 0.42 : 0.95}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  />
                </g>
              );
            })}

            {/* Magnetic Anchor Snap Ring Preview */}
            {snapCandidate && (
              <circle
                cx={snapCandidate.point.x}
                cy={snapCandidate.point.y}
                r={9}
                fill="rgba(79, 70, 229, 0.22)"
                stroke="#4F46E5"
                strokeWidth={2.5}
              />
            )}
          </svg>

          {/* Connector Midpoint Labels */}
          {connectors.map((conn) => {
            const { from, to } = resolveConnectorEndpoints(conn, objectsMap);
            const geom = buildConnectorGeometry(
              from,
              conn.fromPort,
              to,
              conn.toPort,
              conn.curveStyle
            );
            const isEditing = editingId === conn.id;
            if (!conn.label && !isEditing) return null;
            const pal = BOARD_PALETTE[conn.color];

            return (
              <div
                key={`lbl-${conn.id}`}
                data-object-id={conn.id}
                style={{
                  left: geom.midPoint.x,
                  top: geom.midPoint.y,
                  transform: 'translate(-50%, -50%)',
                  touchAction: 'none',
                }}
                onMouseDown={(e) => handleObjectMouseDown(e, conn)}
                onTouchStart={(e) => handleObjectTouchStart(e, conn)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(conn.id);
                }}
                className="absolute z-20 bg-white border border-slate-200 shadow-xs px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer select-none"
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={conn.label}
                    onChange={(e) =>
                      updateBoardObject({ ...conn, label: e.target.value }, true)
                    }
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    placeholder="Connector label..."
                    autoFocus
                    className="w-28 text-[11px] focus:outline-none text-slate-900"
                  />
                ) : (
                  <span style={{ color: pal.textHex }}>{conn.label}</span>
                )}
              </div>
            );
          })}

          {/* Layer 3: Foreground Sticky Notes, Shapes, Text Blocks, Stamps, & Attachments */}
          {foregroundItems.map((obj) => {
            const isSelected = selectedIds.includes(obj.id);
            const isEditing = editingId === obj.id;
            const isHovered = hoveredObjectId === obj.id;
            const showPorts =
              (isHovered || isSelected || activeTool === 'connector') &&
              (obj.type === 'sticky' || obj.type === 'shape' || obj.type === 'attachment');

            const selectingPeer = peers.find((p) =>
              p.selectedIds?.includes(obj.id)
            );

            // 1. Sticky Note
            if (obj.type === 'sticky') {
              const pal = BOARD_PALETTE[obj.color];
              const hasVoted = obj.votes.includes(currentUser.id);
              const isSearchMatch = matchingObjectIds.has(obj.id);
              return (
                <div
                  key={obj.id}
                  data-object-id={obj.id}
                  onMouseEnter={() => setHoveredObjectId(obj.id)}
                  onMouseLeave={() => setHoveredObjectId(null)}
                  onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                  onTouchStart={(e) => handleObjectTouchStart(e, obj)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!obj.locked) setEditingId(obj.id);
                  }}
                  style={{
                    left: obj.x,
                    top: obj.y,
                    width: obj.width,
                    height: obj.height,
                    backgroundColor: pal.stickyBg,
                    borderColor: isSelected
                      ? '#4F46E5'
                      : isSearchMatch
                      ? '#F59E0B'
                      : selectingPeer
                      ? selectingPeer.color
                      : pal.stickyBorder,
                    boxShadow: `0 10px 24px -6px ${pal.stickyShadow}, 0 2px 6px -1px rgba(0,0,0,0.05)`,
                    touchAction: 'none',
                  }}
                  className={`absolute rounded-xl border-2 p-4 flex flex-col justify-between transition-transform ${
                    isSearchMatch
                      ? 'search-match-highlight ring-4 ring-amber-400'
                      : isSelected
                      ? 'ring-2 ring-indigo-500/30'
                      : ''
                  }`}
                >
                  {/* Floating Drag Handle + Edit/Done Bar on mobile/desktop when selected or editing */}
                  {(isSelected || isEditing) && !obj.locked && (
                    <div className="absolute -top-9 left-0 flex items-center gap-1.5 z-30 select-none">
                      <div
                        data-drag-handle-id={obj.id}
                        onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md cursor-grab active:cursor-grabbing touch-none"
                        title="Hold and drag with finger or mouse to move"
                      >
                        <Move className="w-3 h-3" />
                        <span>Move</span>
                      </div>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
                          title="Finish editing text"
                        >
                          <Check className="w-3 h-3" />
                          <span>Done</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(obj.id);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                          title="Tap to edit note"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-h-0 flex flex-col">
                    {isEditing ? (
                      <textarea
                        value={obj.text}
                        onChange={(e) =>
                          updateBoardObject(
                            { ...obj, text: e.target.value },
                            true
                          )
                        }
                        onBlur={() => setEditingId(null)}
                        placeholder="Type an idea..."
                        autoFocus
                        className={`w-full h-full bg-transparent resize-none focus:outline-none text-slate-900 leading-snug ${getFontClass(
                          obj.fontStyle
                        )} ${
                          obj.fontStyle === 'hand' ? 'text-xl' : 'text-sm font-medium'
                        }`}
                      />
                    ) : (
                      <p
                        className={`w-full h-full overflow-hidden whitespace-pre-wrap break-words text-slate-900 leading-snug select-none ${getFontClass(
                          obj.fontStyle
                        )} ${
                          obj.fontStyle === 'hand'
                            ? 'text-xl'
                            : 'text-sm font-medium'
                        }`}
                      >
                        {obj.text || (
                          <span className="opacity-40">
                            Double-click or tap Edit to write...
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 mt-1 border-t border-black/8 flex items-center justify-between text-[11px] text-slate-700/80">
                    <span className="font-medium truncate max-w-[120px]">
                      {obj.authorName}
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVote(obj.id);
                      }}
                      title="Click to vote on this sticky note"
                      className={`px-2 py-0.5 rounded-md font-mono tabular-nums text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        hasVoted
                          ? 'bg-slate-900 text-white'
                          : 'bg-black/8 hover:bg-black/15 text-slate-800'
                      }`}
                    >
                      <ThumbsUp className="w-2.5 h-2.5" />
                      <span>{obj.votes.length}</span>
                    </button>
                  </div>

                  {showPorts &&
                    (['top', 'right', 'bottom', 'left'] as AnchorPort[]).map(
                      (port) => (
                        <button
                          key={port}
                          type="button"
                          onMouseDown={(e) =>
                            handleStartConnectorFromPort(e, obj, port)
                          }
                          title={`Drag to connect (${port})`}
                          className={`w-3 h-3 rounded-full bg-white border-2 border-indigo-600 hover:scale-125 transition-transform absolute cursor-crosshair z-20 ${
                            port === 'top'
                              ? '-top-1.5 left-1/2 -translate-x-1/2'
                              : port === 'right'
                              ? 'top-1/2 -right-1.5 -translate-y-1/2'
                              : port === 'bottom'
                              ? '-bottom-1.5 left-1/2 -translate-x-1/2'
                              : 'top-1/2 -left-1.5 -translate-y-1/2'
                          }`}
                        />
                      )
                    )}

                  {isSelected && !obj.locked && (
                    <div
                      data-resize-id={obj.id}
                      onMouseDown={(e) => handleStartResize(e, obj)}
                      onTouchStart={(e) => handleStartResizeTouch(e, obj)}
                      className="w-5 h-5 md:w-3.5 md:h-3.5 bg-white border-2 border-indigo-600 rounded-sm absolute -bottom-2 -right-2 md:-bottom-1.5 md:-right-1.5 cursor-nwse-resize z-20"
                    />
                  )}
                </div>
              );
            }

            // 2. Diagram Shape
            if (obj.type === 'shape') {
              const pal = BOARD_PALETTE[obj.color];
              const isSearchMatch = matchingObjectIds.has(obj.id);
              const bgHex =
                obj.fillStyle === 'solid'
                  ? pal.shapeFill
                  : obj.fillStyle === 'tinted'
                  ? pal.shapeTinted
                  : '#FFFFFF';
              const textColor =
                obj.fillStyle === 'solid' && obj.color !== 'yellow'
                  ? '#FFFFFF'
                  : pal.textHex;

              return (
                <div
                  key={obj.id}
                  data-object-id={obj.id}
                  onMouseEnter={() => setHoveredObjectId(obj.id)}
                  onMouseLeave={() => setHoveredObjectId(null)}
                  onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                  onTouchStart={(e) => handleObjectTouchStart(e, obj)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!obj.locked) setEditingId(obj.id);
                  }}
                  style={{
                    left: obj.x,
                    top: obj.y,
                    width: obj.width,
                    height: obj.height,
                    touchAction: 'none',
                  }}
                  className={`absolute flex items-center justify-center p-3 transition-shadow ${
                    isSearchMatch
                      ? 'search-match-highlight ring-4 ring-amber-400 rounded-xl'
                      : isSelected
                      ? 'ring-2 ring-indigo-500 rounded-xl'
                      : ''
                  }`}
                >
                  <svg
                    className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                    viewBox={`0 0 ${obj.width} ${obj.height}`}
                  >
                    {obj.shapeKind === 'diamond' ? (
                      <polygon
                        points={`${obj.width / 2},2 ${obj.width - 2},${
                          obj.height / 2
                        } ${obj.width / 2},${obj.height - 2} 2,${obj.height / 2}`}
                        fill={bgHex}
                        stroke={isSelected ? '#4F46E5' : pal.shapeStroke}
                        strokeWidth={2.2}
                        strokeLinejoin="round"
                      />
                    ) : obj.shapeKind === 'circle' ? (
                      <ellipse
                        cx={obj.width / 2}
                        cy={obj.height / 2}
                        rx={obj.width / 2 - 2}
                        ry={obj.height / 2 - 2}
                        fill={bgHex}
                        stroke={isSelected ? '#4F46E5' : pal.shapeStroke}
                        strokeWidth={2.2}
                      />
                    ) : obj.shapeKind === 'cylinder' ? (
                      <g>
                        <path
                          d={`M 3,16 L 3,${obj.height - 14} A ${
                            obj.width / 2 - 3
                          } 12 0 0 0 ${obj.width - 3},${obj.height - 14} L ${
                            obj.width - 3
                          },16 Z`}
                          fill={bgHex}
                          stroke={isSelected ? '#4F46E5' : pal.shapeStroke}
                          strokeWidth={2.2}
                        />
                        <ellipse
                          cx={obj.width / 2}
                          cy={16}
                          rx={obj.width / 2 - 3}
                          ry={12}
                          fill={bgHex}
                          stroke={isSelected ? '#4F46E5' : pal.shapeStroke}
                          strokeWidth={2.2}
                        />
                      </g>
                    ) : (
                      <rect
                        x={2}
                        y={2}
                        width={obj.width - 4}
                        height={obj.height - 4}
                        rx={
                          obj.shapeKind === 'pill'
                            ? Math.min(obj.width, obj.height) / 2
                            : 14
                        }
                        fill={bgHex}
                        stroke={isSelected ? '#4F46E5' : pal.shapeStroke}
                        strokeWidth={2.2}
                      />
                    )}
                  </svg>

                  <div className="relative z-10 w-full text-center px-2 select-none">
                    {isEditing ? (
                      <textarea
                        value={obj.text}
                        onChange={(e) =>
                          updateBoardObject(
                            { ...obj, text: e.target.value },
                            true
                          )
                        }
                        onBlur={() => setEditingId(null)}
                        autoFocus
                        style={{ color: textColor }}
                        className={`w-full bg-transparent resize-none text-center text-xs font-semibold focus:outline-none ${getFontClass(
                          obj.fontStyle
                        )}`}
                        rows={2}
                      />
                    ) : (
                      <div
                        style={{ color: textColor }}
                        className={`text-xs font-semibold whitespace-pre-wrap leading-snug ${getFontClass(
                          obj.fontStyle
                        )}`}
                      >
                        {obj.text}
                      </div>
                    )}
                  </div>

                  {showPorts &&
                    (['top', 'right', 'bottom', 'left'] as AnchorPort[]).map(
                      (port) => (
                        <button
                          key={port}
                          type="button"
                          onMouseDown={(e) =>
                            handleStartConnectorFromPort(e, obj, port)
                          }
                          title={`Drag to connect (${port})`}
                          className={`w-3 h-3 rounded-full bg-white border-2 border-indigo-600 hover:scale-125 transition-transform absolute cursor-crosshair z-20 ${
                            port === 'top'
                              ? '-top-1.5 left-1/2 -translate-x-1/2'
                              : port === 'right'
                              ? 'top-1/2 -right-1.5 -translate-y-1/2'
                              : port === 'bottom'
                              ? '-bottom-1.5 left-1/2 -translate-x-1/2'
                              : 'top-1/2 -left-1.5 -translate-y-1/2'
                          }`}
                        />
                      )
                    )}

                  {isSelected && !obj.locked && (
                    <div
                      data-resize-id={obj.id}
                      onMouseDown={(e) => handleStartResize(e, obj)}
                      onTouchStart={(e) => handleStartResizeTouch(e, obj)}
                      className="w-5 h-5 md:w-3.5 md:h-3.5 bg-white border-2 border-indigo-600 rounded-sm absolute -bottom-2 -right-2 md:-bottom-1.5 md:-right-1.5 cursor-nwse-resize z-20"
                    />
                  )}
                </div>
              );
            }

            // 3. Text Block
            if (obj.type === 'text') {
              const pal = BOARD_PALETTE[obj.color];
              const isSearchMatch = matchingObjectIds.has(obj.id);
              return (
                <div
                  key={obj.id}
                  data-object-id={obj.id}
                  onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                  onTouchStart={(e) => handleObjectTouchStart(e, obj)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!obj.locked) setEditingId(obj.id);
                  }}
                  style={{
                    left: obj.x,
                    top: obj.y,
                    width: obj.width,
                    minHeight: obj.height,
                    color: pal.textHex,
                    touchAction: 'none',
                  }}
                  className={`absolute p-1.5 rounded-lg transition-all ${
                    isSearchMatch
                      ? 'search-match-highlight ring-4 ring-amber-400 bg-amber-50/70'
                      : isSelected
                      ? 'ring-2 ring-indigo-500 bg-white/50'
                      : 'hover:bg-black/3'
                  }`}
                >
                  {/* Floating Mobile/Touch Move Handle + Edit/Done Button when selected or editing */}
                  {(isSelected || isEditing) && !obj.locked && (
                    <div className="absolute -top-9 left-0 flex items-center gap-1.5 z-30 select-none">
                      <div
                        data-drag-handle-id={obj.id}
                        onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md cursor-grab active:cursor-grabbing touch-none"
                        title="Hold and drag with finger or mouse to move text"
                      >
                        <Move className="w-3 h-3" />
                        <span>Move</span>
                      </div>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
                          title="Finish typing so you can drag text"
                        >
                          <Check className="w-3 h-3" />
                          <span>Done</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(obj.id);
                          }}
                          className="px-2.5 py-1 bg-indigo-600 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-md hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                          title="Tap to edit text"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Text</span>
                        </button>
                      )}
                    </div>
                  )}

                  {isEditing ? (
                    <textarea
                      value={obj.text}
                      onChange={(e) =>
                        updateBoardObject(
                          { ...obj, text: e.target.value },
                          true
                        )
                      }
                      onBlur={() => setEditingId(null)}
                      autoFocus
                      className={`w-full bg-transparent resize-none focus:outline-none font-bold text-xl leading-tight ${getFontClass(
                        obj.fontStyle
                      )}`}
                      rows={2}
                    />
                  ) : (
                    <div
                      className={`font-bold text-xl leading-tight whitespace-pre-wrap select-none ${getFontClass(
                        obj.fontStyle
                      )}`}
                    >
                      {obj.text}
                    </div>
                  )}

                  {isSelected && !obj.locked && (
                    <div
                      data-resize-id={obj.id}
                      onMouseDown={(e) => handleStartResize(e, obj)}
                      onTouchStart={(e) => handleStartResizeTouch(e, obj)}
                      className="w-5 h-5 md:w-3.5 md:h-3.5 bg-white border-2 border-indigo-600 rounded-sm absolute -bottom-2 -right-2 md:-bottom-1.5 md:-right-1.5 cursor-nwse-resize z-20"
                    />
                  )}
                </div>
              );
            }

            // 4. FigJam Stamp Sticker
            if (obj.type === 'stamp') {
              return (
                <div
                  key={obj.id}
                  data-object-id={obj.id}
                  onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                  onTouchStart={(e) => handleObjectTouchStart(e, obj)}
                  style={{
                    left: obj.x,
                    top: obj.y,
                    transform: `translate(-50%, -50%) rotate(${obj.rotation}deg) scale(${obj.scale})`,
                    borderColor: isSelected ? '#4F46E5' : obj.authorColor,
                    touchAction: 'none',
                  }}
                  title={`Stamped by ${obj.authorName}`}
                  className="absolute w-13 h-13 rounded-full bg-white shadow-md border-2 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 select-none"
                >
                  <div style={{ color: obj.authorColor }}>
                    {renderStampIcon(obj.stampKind, 'w-6 h-6')}
                  </div>
                </div>
              );
            }

            // 5. Attached File (Screenshot, PDF, Excel, PowerPoint)
            if (obj.type === 'attachment') {
              const isSearchMatch = matchingObjectIds.has(obj.id);
              return (
                <div
                  key={obj.id}
                  data-object-id={obj.id}
                  onMouseEnter={() => setHoveredObjectId(obj.id)}
                  onMouseLeave={() => setHoveredObjectId(null)}
                  onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                  onTouchStart={(e) => handleObjectTouchStart(e, obj)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setPreviewAttachment(obj);
                  }}
                  style={{
                    left: obj.x,
                    top: obj.y,
                    width: obj.width,
                    height: obj.height,
                    touchAction: 'none',
                  }}
                  className={`absolute bg-white rounded-2xl border-2 shadow-md hover:shadow-xl transition-all flex flex-col overflow-hidden ${
                    isSearchMatch
                      ? 'search-match-highlight ring-4 ring-amber-400 border-amber-500'
                      : isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Attachment Card Header */}
                  <div className="h-10 px-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {obj.attachmentKind === 'image' ? (
                        <ImageIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                      ) : obj.attachmentKind === 'pdf' ? (
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : obj.attachmentKind === 'excel' ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : obj.attachmentKind === 'powerpoint' ? (
                        <Presentation className="w-4 h-4 text-orange-500 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-800 truncate" title={obj.fileName}>
                        {obj.fileName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {obj.driveFileId && (
                        <span
                          className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.2 font-semibold flex items-center gap-0.5"
                          title="Hosted on your Google Drive"
                        >
                          <Cloud className="w-2.5 h-2.5" />
                          <span className="hidden sm:inline">Drive</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attachment Card Body / Preview */}
                  <div className="flex-1 min-h-0 bg-slate-50/50 p-2 flex items-center justify-center overflow-hidden relative">
                    {obj.attachmentKind === 'image' && obj.dataUrl ? (
                      <img
                        src={obj.dataUrl}
                        alt={obj.fileName}
                        className="w-full h-full object-cover rounded-xl shadow-xs"
                      />
                    ) : obj.attachmentKind === 'pdf' ? (
                      <div className="w-full h-full rounded-xl bg-rose-50/70 border border-rose-100 p-3 flex flex-col items-center justify-center text-center space-y-1.5">
                        <FileText className="w-8 h-8 text-rose-500" />
                        <span className="text-[11px] font-bold text-rose-900 line-clamp-1">
                          PDF Document
                        </span>
                        <span className="text-[10px] text-rose-600 font-mono">
                          {formatBytes(obj.fileSize)}
                        </span>
                      </div>
                    ) : obj.attachmentKind === 'excel' ? (
                      <div className="w-full h-full rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 flex flex-col items-center justify-center text-center space-y-1.5">
                        <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                        <span className="text-[11px] font-bold text-emerald-900 line-clamp-1">
                          Excel Spreadsheet
                        </span>
                        <span className="text-[10px] text-emerald-600 font-mono">
                          {formatBytes(obj.fileSize)}
                        </span>
                      </div>
                    ) : obj.attachmentKind === 'powerpoint' ? (
                      <div className="w-full h-full rounded-xl bg-orange-50/70 border border-orange-100 p-3 flex flex-col items-center justify-center text-center space-y-1.5">
                        <Presentation className="w-8 h-8 text-orange-500" />
                        <span className="text-[11px] font-bold text-orange-900 line-clamp-1">
                          PowerPoint Presentation
                        </span>
                        <span className="text-[10px] text-orange-600 font-mono">
                          {formatBytes(obj.fileSize)}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full rounded-xl bg-slate-100 p-3 flex flex-col items-center justify-center text-center space-y-1.5">
                        <File className="w-8 h-8 text-slate-500" />
                        <span className="text-[11px] font-bold text-slate-800 line-clamp-1">
                          {obj.fileName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatBytes(obj.fileSize)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Attachment Card Footer with Review & Drive links */}
                  <div className="h-9 px-3 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewAttachment(obj);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review & View</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {obj.driveWebViewLink ? (
                        <a
                          href={obj.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onMouseDown={(e) => e.stopPropagation()}
                          className="px-2 py-0.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors flex items-center gap-1 border border-indigo-200"
                          title="Open directly in Google Drive"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open in Drive</span>
                        </a>
                      ) : obj.attachmentKind === 'pdf' && obj.dataUrl ? (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              const parts = obj.dataUrl!.split(';base64,');
                              const raw = window.atob(parts[1]);
                              const arr = new Uint8Array(raw.length);
                              for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
                              const blob = new Blob([arr], { type: 'application/pdf' });
                              const blobUrl = URL.createObjectURL(blob);
                              window.open(blobUrl, '_blank');
                            } catch {
                              setPreviewAttachment(obj);
                            }
                          }}
                          className="px-2 py-0.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors flex items-center gap-1 border border-rose-200 cursor-pointer"
                          title="Open PDF directly in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open PDF</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteObjects([obj.id]);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Magnetic Connector Ports */}
                  {showPorts &&
                    (['top', 'right', 'bottom', 'left'] as AnchorPort[]).map(
                      (port) => (
                        <button
                          key={port}
                          type="button"
                          onMouseDown={(e) =>
                            handleStartConnectorFromPort(e, obj, port)
                          }
                          title={`Drag to connect (${port})`}
                          className={`w-3 h-3 rounded-full bg-white border-2 border-indigo-600 hover:scale-125 transition-transform absolute cursor-crosshair z-20 ${
                            port === 'top'
                              ? '-top-1.5 left-1/2 -translate-x-1/2'
                              : port === 'right'
                              ? 'top-1/2 -right-1.5 -translate-y-1/2'
                              : port === 'bottom'
                              ? '-bottom-1.5 left-1/2 -translate-x-1/2'
                              : 'top-1/2 -left-1.5 -translate-y-1/2'
                          }`}
                        />
                      )
                    )}

                  {/* Resize Handle */}
                  {isSelected && !obj.locked && (
                    <div
                      data-resize-id={obj.id}
                      onMouseDown={(e) => handleStartResize(e, obj)}
                      onTouchStart={(e) => handleStartResizeTouch(e, obj)}
                      className="w-5 h-5 md:w-3.5 md:h-3.5 bg-white border-2 border-indigo-600 rounded-sm absolute -bottom-2 -right-2 md:-bottom-1.5 md:-right-1.5 cursor-nwse-resize z-20"
                    />
                  )}
                </div>
              );
            }

            return null;
          })}

          {/* Marquee Box Overlay */}
          {marqueeBox && (
            <div
              style={{
                left: marqueeBox.x,
                top: marqueeBox.y,
                width: marqueeBox.width,
                height: marqueeBox.height,
              }}
              className="absolute bg-indigo-500/10 border border-indigo-600 rounded pointer-events-none z-40"
            />
          )}

          {/* Floating Ephemeral Reaction Bursts */}
          {reactions.map((rx) => (
            <div
              key={rx.id}
              style={{ left: rx.x, top: rx.y }}
              className="absolute z-50 pointer-events-none animate-reaction-float flex flex-col items-center"
            >
              <div
                style={{ backgroundColor: rx.userColor }}
                className="w-11 h-11 rounded-full text-white shadow-lg flex items-center justify-center border-2 border-white"
              >
                {renderStampIcon(rx.emoji, 'w-5 h-5')}
              </div>
              <span className="mt-1 px-2 py-0.5 rounded bg-slate-900/85 text-white text-[10px] font-semibold whitespace-nowrap">
                {rx.userName}
              </span>
            </div>
          ))}

          {/* Layer 4: Live Multi-User Collaborator Cursors & Cursor Chat */}
          {peers.map((peer) => {
            const hasFreshChat =
              peer.cursorChat &&
              (!peer.cursorChatUpdatedAt ||
                Date.now() - peer.cursorChatUpdatedAt < 18000);

            return (
              <div
                key={peer.id}
                style={{
                  transform: `translate3d(${peer.x}px, ${peer.y}px, 0)`,
                }}
                className="absolute top-0 left-0 z-50 pointer-events-none transition-transform duration-75 ease-out"
              >
                {peer.highFiveActive ? (
                  <div
                    style={{ backgroundColor: peer.color }}
                    className="w-8 h-8 -translate-x-2 -translate-y-2 rounded-full text-white flex items-center justify-center shadow-md ring-2 ring-white animate-bounce"
                  >
                    <HandMetal className="w-4 h-4" />
                  </div>
                ) : (
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="drop-shadow-xs"
                  >
                    <path
                      d="M4 3L11.5 20L14.2 13.2L21 10.5L4 3Z"
                      fill={peer.color}
                      stroke="#FFFFFF"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}

                <div
                  style={{ backgroundColor: peer.color }}
                  className="ml-3.5 -mt-1 px-2.5 py-1 rounded-xl rounded-tl-xs text-white shadow-md flex flex-col max-w-[220px]"
                >
                  <span className="text-[11px] font-bold leading-none whitespace-nowrap">
                    {peer.name}
                  </span>
                  {hasFreshChat && (
                    <span className="text-xs font-medium mt-1 leading-snug break-words border-t border-white/20 pt-1">
                      {peer.cursorChat}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Local User Floating Cursor Chat Input ("/") */}
        {cursorChatOpen && (
          <div
            style={{
              left: Math.min(window.innerWidth - 260, screenCursorPos.x + 16),
              top: Math.min(window.innerHeight - 100, screenCursorPos.y - 56),
              backgroundColor: currentUser.color,
            }}
            className="fixed z-50 rounded-2xl rounded-tl-xs shadow-xl p-2 text-white flex items-center gap-2 min-w-[220px]"
          >
            <input
              type="text"
              value={cursorChatText}
              onChange={(e) => {
                setCursorChatText(e.target.value);
                sendWs({ type: 'cursor:chat', message: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.stopPropagation();
                  setCursorChatOpen(false);
                }
              }}
              placeholder="Say something live..."
              autoFocus
              className="bg-transparent text-xs font-medium placeholder:text-white/70 focus:outline-none w-full"
            />
            <span className="text-[10px] font-mono opacity-75 shrink-0">
              ESC
            </span>
          </div>
        )}
      </main>

      {/* FigJam Bottom Floating Tool Dock with Attach Files Button */}
      <ToolDock
        activeTool={activeTool}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          if (tool !== 'select') setHighFiveMode(false);
        }}
        activeColor={activeColor}
        onSelectColor={setActiveColor}
        activeShapeKind={activeShapeKind}
        onSelectShapeKind={setActiveShapeKind}
        activeStampKind={activeStampKind}
        onSelectStampKind={setActiveStampKind}
        penStrokeWidth={penStrokeWidth}
        onSelectPenStrokeWidth={setPenStrokeWidth}
        isHighlighter={isHighlighter}
        onToggleHighlighter={() => setIsHighlighter((prev) => !prev)}
        onOpenCursorChat={() => {
          setCursorChatOpen(true);
          setCursorChatText('');
        }}
        highFiveMode={highFiveMode}
        onToggleHighFive={() => {
          const next = !highFiveMode;
          setHighFiveMode(next);
          emitCursorTelemetry(worldCursorPos, next);
        }}
        onTriggerReactionBurst={(emoji) => {
          const rx: FloatingReaction = {
            id: `rx-local-${Date.now()}`,
            emoji,
            x: worldCursorPos.x,
            y: worldCursorPos.y,
            userName: currentUser.name,
            userColor: currentUser.color,
            createdAt: Date.now(),
          };
          setReactions((prev) => [...prev, rx]);
          sendWs({
            type: 'reaction:send',
            emoji,
            x: worldCursorPos.x,
            y: worldCursorPos.y,
          });
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== rx.id));
          }, 1900);
        }}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onTriggerAttachFiles={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*,.pdf,.xlsx,.xls,.csv,.pptx,.ppt,.doc,.docx';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
              handleAttachFiles(files);
            }
          };
          input.click();
        }}
      />

      {/* Interactive Radar Minimap & Zoom Controls */}
      <Minimap
        objects={objects}
        peers={peers}
        viewport={viewport}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
        matchingObjectIds={matchingObjectIds}
        onPanToWorldCenter={(wx, wy) => {
          setFollowingUserId(null);
          setViewport((prev) => ({
            ...prev,
            x: canvasSize.width / 2 - wx * prev.zoom,
            y: canvasSize.height / 2 - wy * prev.zoom,
          }));
        }}
        onZoomStep={(delta) => {
          setFollowingUserId(null);
          setViewport((prev) => {
            const nextZoom = Math.min(4, Math.max(0.15, prev.zoom + delta));
            const cx = canvasSize.width / 2;
            const cy = canvasSize.height / 2;
            return {
              x: cx - ((cx - prev.x) / prev.zoom) * nextZoom,
              y: cy - ((cy - prev.y) / prev.zoom) * nextZoom,
              zoom: nextZoom,
            };
          });
        }}
        onResetZoom={() => {
          setFollowingUserId(null);
          setViewport((prev) => ({ ...prev, zoom: 1 }));
        }}
        onFitToContent={handleFitToContent}
      />

      {/* Picture-in-Picture 2nd WebSocket Collaborator Client */}
      {splitPeerOpen && (
        <LivePeerWindow
          roomId={roomId}
          onClose={() => setSplitPeerOpen(false)}
        />
      )}

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onLoadTemplate={(templateId) => {
          pushUndoSnapshot(objects);
          sendWs({ type: 'template:load', templateId });
        }}
        onClearBoard={() => {
          pushUndoSnapshot(objects);
          setObjects([]);
          sendWs({ type: 'board:clear' });
        }}
      />

      {/* Votes Leaderboard & Live Activity Drawer */}
      <ActivityAndVotesDrawer
        isOpen={activityDrawerOpen}
        onClose={() => setActivityDrawerOpen(false)}
        objects={objects}
        activities={activities}
        onFocusObject={(obj) => {
          const b = getObjectBounds(obj);
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          setSelectedIds([obj.id]);
          setViewport({
            x: canvasSize.width / 2 - cx * 1.05,
            y: canvasSize.height / 2 - cy * 1.05,
            zoom: 1.05,
          });
        }}
        onToggleVote={handleToggleVote}
        currentUserId={currentUser.id}
      />

      {/* Share Room & Collaborator Identity Modal */}
      <ShareAndProfileModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        roomId={roomId}
        onChangeRoom={handleChangeRoom}
        currentUser={currentUser}
        peers={peers}
        onUpdateProfile={(name, color) => {
          localStorage.setItem('cj_user_name', name);
          localStorage.setItem('cj_user_color', color);
          setCurrentUser((prev) => ({ ...prev, name, color }));
          sendWs({ type: 'user:profile', name, color });
        }}
        splitPeerOpen={splitPeerOpen}
        onToggleSplitPeer={() => setSplitPeerOpen((prev) => !prev)}
      />

      {/* File Preview & Inspection Modal (Review without saving & delete) */}
      <FilePreviewModal
        attachment={previewAttachment}
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        onDelete={(att) => {
          setPreviewAttachment(null);
          requestDeleteObjects([att.id]);
        }}
      />

      {/* Google Drive Storage & Cloud Autosave Modal */}
      <DriveBackupModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        roomId={roomId}
        boardTitle={boardTitle}
        isSignedIn={isDriveSignedIn}
        quotaInfo={driveQuota}
        lastAutosaveTime={lastAutosaveTime}
        isAutosaving={isAutosaving}
        autosaveEnabled={autosaveEnabled}
        onToggleAutosave={() => setAutosaveEnabled((prev) => !prev)}
        onManualBackup={handleManualBackup}
        onRestoreBackup={(backupState) => {
          pushUndoSnapshot(objects);
          setBoardTitle(backupState.title);
          setObjects(backupState.objects);
          sendWs({ type: 'board:replace_all', objects: backupState.objects });
        }}
        onDeleteBackupFile={(fileId, fileName) => {
          setConfirmationState({
            isOpen: true,
            title: 'Delete Cloud Backup File?',
            message: `Are you sure you want to delete "${fileName}" from your Google Drive? This action cannot be undone.`,
            confirmLabel: 'Delete Backup',
            onConfirm: async () => {
              setConfirmationState((prev) => ({ ...prev, isOpen: false }));
              try {
                await deleteDriveFile(fileId);
              } catch (e) {
                console.error('Failed to delete Drive backup:', e);
              }
            },
          });
        }}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleLogout}
      />

      {/* Destructive Operation User Confirmation Dialog (MANDATORY for Workspace APIs) */}
      <ConfirmationDialog
        isOpen={confirmationState.isOpen}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmLabel={confirmationState.confirmLabel}
        onConfirm={confirmationState.onConfirm}
        onCancel={() => setConfirmationState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
