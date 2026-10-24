import { BoardObject, BoardPage, BoardProject, WorkspaceState } from '../types/board';

const STORAGE_KEY = 'canvasjam_workspace_v2';
const IDB_NAME = 'canvasjam_idb_v2';
const IDB_STORE = 'workspace_store';
const IDB_KEY = 'main_workspace';

let latestWorkspaceInMemory: WorkspaceState | null = null;
let serverSaveTimeout: any = null;
let pendingServerSync = false;

export function createBlankPage(name = 'Page 1'): BoardPage {
  const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    objects: [],
    viewport: {
      x: 60,
      y: 40,
      zoom: 1,
    },
  };
}

export function createNewProject(name = 'New Project'): BoardProject {
  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const initialPage = createBlankPage('Page 1');
  const now = Date.now();
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    activePageId: initialPage.id,
    pages: [initialPage],
  };
}

/**
 * Default fallback workspace when no saved data exists yet.
 * IMPORTANT: Uses updatedAt: 0 so it NEVER overwrites real saved data from IndexedDB or Server.
 */
export function getDefaultWorkspace(): WorkspaceState {
  const defaultPage: BoardPage = {
    id: 'page-1',
    name: 'Page 1',
    createdAt: 0,
    updatedAt: 0,
    objects: [],
    viewport: {
      x: 60,
      y: 40,
      zoom: 1,
    },
  };

  const defaultProject: BoardProject = {
    id: 'proj-default',
    name: 'Main Project',
    createdAt: 0,
    updatedAt: 0,
    activePageId: defaultPage.id,
    pages: [defaultPage],
  };

  return {
    version: 2,
    activeProjectId: defaultProject.id,
    projects: [defaultProject],
  };
}

export function normalizeWorkspace(ws: WorkspaceState): WorkspaceState {
  if (!ws || !Array.isArray(ws.projects) || ws.projects.length === 0) {
    return getDefaultWorkspace();
  }

  const normalizedProjects = ws.projects.map((p) => {
    const pages =
      Array.isArray(p.pages) && p.pages.length > 0
        ? p.pages.map((pg) => ({
            ...pg,
            objects: Array.isArray(pg.objects) ? pg.objects : [],
            viewport: pg.viewport || { x: 60, y: 40, zoom: 1 },
          }))
        : [createBlankPage('Page 1')];

    const activePg = pages.find((pg) => pg.id === p.activePageId) || pages[0];
    return {
      ...p,
      pages,
      activePageId: activePg.id,
    };
  });

  const activeProj =
    normalizedProjects.find((p) => p.id === ws.activeProjectId) ||
    normalizedProjects[0];

  return {
    version: 2,
    activeProjectId: activeProj.id,
    projects: normalizedProjects,
  };
}

export function getWorkspaceLatestTimestamp(ws: WorkspaceState | null | undefined): number {
  if (!ws || !Array.isArray(ws.projects)) return 0;
  let maxTs = 0;
  for (const p of ws.projects) {
    if (p.updatedAt && p.updatedAt > maxTs) maxTs = p.updatedAt;
    if (Array.isArray(p.pages)) {
      for (const pg of p.pages) {
        if (pg.updatedAt && pg.updatedAt > maxTs) maxTs = pg.updatedAt;
        if (Array.isArray(pg.objects)) {
          for (const obj of pg.objects) {
            if (obj.updatedAt && obj.updatedAt > maxTs) maxTs = obj.updatedAt;
          }
        }
      }
    }
  }
  return maxTs;
}

export function getWorkspaceTotalObjects(ws: WorkspaceState | null | undefined): number {
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

// ============================================================================
// IndexedDB Storage (Supports 100MB+ of Photos, Images, PDFs & Projects on Phone)
// ============================================================================
function openWorkspaceIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not available'));
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorkspaceToIndexedDB(workspace: WorkspaceState): Promise<void> {
  try {
    const db = await openWorkspaceIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(workspace, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('IndexedDB save warning:', err);
  }
}

export async function loadWorkspaceFromIndexedDB(): Promise<WorkspaceState | null> {
  try {
    const db = await openWorkspaceIDB();
    const result = await new Promise<WorkspaceState | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (result && Array.isArray(result.projects) && result.projects.length > 0) {
      return normalizeWorkspace(result);
    }
    return null;
  } catch (err) {
    console.warn('IndexedDB load warning:', err);
    return null;
  }
}

export function loadWorkspaceFromStorage(): WorkspaceState {
  if (typeof window === 'undefined') {
    return getDefaultWorkspace();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Do NOT save fallback to storage here (prevents overwriting server/IDB on fresh load)
      return getDefaultWorkspace();
    }

    const parsed: WorkspaceState = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      return getDefaultWorkspace();
    }

    return normalizeWorkspace(parsed);
  } catch (e) {
    console.error('Failed to load workspace from localStorage:', e);
    return getDefaultWorkspace();
  }
}

function postWorkspaceToServer(workspace: WorkspaceState, keepalive = false): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return fetch('/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workspace),
    keepalive,
  })
    .then((res) => res.ok)
    .catch((err) => {
      console.warn('Failed to sync workspace to server disk:', err);
      return false;
    });
}

export function saveWorkspaceToStorage(workspace: WorkspaceState, immediate = false): void {
  if (typeof window === 'undefined') return;

  const normalized = normalizeWorkspace(workspace);
  latestWorkspaceInMemory = normalized;

  // 1. Save full workspace (including high-res photos/images) to IndexedDB
  saveWorkspaceToIndexedDB(normalized);

  // 2. Save to localStorage (with automatic fallback if photos exceed 5MB localStorage limit)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('LocalStorage quota reached (photos saved in IndexedDB & Cloud Server):', e);
  }

  // 3. Sync full workspace state to server disk & cloud backup
  if (serverSaveTimeout) clearTimeout(serverSaveTimeout);
  if (immediate) {
    pendingServerSync = false;
    postWorkspaceToServer(normalized, false);
  } else {
    pendingServerSync = true;
    serverSaveTimeout = setTimeout(() => {
      pendingServerSync = false;
      postWorkspaceToServer(normalized, false);
    }, 300);
  }
}

// Flush immediately when phone screen locks, tab hides, or browser closes
if (typeof window !== 'undefined') {
  const flushPendingSave = () => {
    if (latestWorkspaceInMemory) {
      saveWorkspaceToIndexedDB(latestWorkspaceInMemory);
      if (pendingServerSync) {
        pendingServerSync = false;
        if (serverSaveTimeout) clearTimeout(serverSaveTimeout);
        postWorkspaceToServer(latestWorkspaceInMemory, true);
      }
    }
  };

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSave();
    }
  });
  window.addEventListener('pagehide', flushPendingSave);
  window.addEventListener('beforeunload', flushPendingSave);
}

export async function fetchWorkspaceFromServer(): Promise<WorkspaceState | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`/api/workspace?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.projects) && data.projects.length > 0) {
      return normalizeWorkspace(data);
    }
  } catch (err) {
    console.warn('Could not fetch workspace from server:', err);
  }
  return null;
}

/**
 * Merges LocalStorage, IndexedDB, and Server workspaces so no project, page, text, or photo is ever lost.
 */
export function mergeAndResolveWorkspaces(
  candidates: (WorkspaceState | null | undefined)[]
): WorkspaceState {
  const valid = candidates.filter(
    (c): c is WorkspaceState =>
      !!c &&
      Array.isArray(c.projects) &&
      c.projects.length > 0 &&
      (getWorkspaceLatestTimestamp(c) > 0 || getWorkspaceTotalObjects(c) > 0 || c.projects.length > 1)
  );

  if (valid.length === 0) {
    return candidates.find((c): c is WorkspaceState => !!c) || getDefaultWorkspace();
  }

  // Sort candidates by latest timestamp descending, then by total object count descending
  valid.sort((a, b) => {
    const objDiff = getWorkspaceTotalObjects(b) - getWorkspaceTotalObjects(a);
    const tsDiff = getWorkspaceLatestTimestamp(b) - getWorkspaceLatestTimestamp(a);
    // If one workspace has objects and the other is completely empty, prefer the one with objects!
    if (getWorkspaceTotalObjects(a) === 0 && getWorkspaceTotalObjects(b) > 0) return 1;
    if (getWorkspaceTotalObjects(b) === 0 && getWorkspaceTotalObjects(a) > 0) return -1;
    if (tsDiff !== 0) return tsDiff;
    return objDiff;
  });

  const primary = valid[0];
  const mergedProjectsMap = new Map<string, BoardProject>();

  // Start with primary projects in order, then merge pages/projects from other sources
  for (const ws of valid) {
    for (const proj of ws.projects) {
      const existingProj = mergedProjectsMap.get(proj.id);
      if (!existingProj) {
        mergedProjectsMap.set(proj.id, JSON.parse(JSON.stringify(proj)));
      } else {
        // Merge pages inside this project
        const pageMap = new Map<string, BoardPage>();
        for (const pg of existingProj.pages) {
          pageMap.set(pg.id, pg);
        }
        for (const pg of proj.pages) {
          const existingPg = pageMap.get(pg.id);
          if (!existingPg) {
            pageMap.set(pg.id, JSON.parse(JSON.stringify(pg)));
          } else {
            // Prefer the page version that has objects if the other is empty, or newer updatedAt
            const existingCount = existingPg.objects?.length || 0;
            const candidateCount = pg.objects?.length || 0;
            if (existingCount === 0 && candidateCount > 0) {
              pageMap.set(pg.id, JSON.parse(JSON.stringify(pg)));
            } else if (
              candidateCount > 0 &&
              (pg.updatedAt || 0) > (existingPg.updatedAt || 0)
            ) {
              pageMap.set(pg.id, JSON.parse(JSON.stringify(pg)));
            } else if (
              existingCount === 0 &&
              candidateCount === 0 &&
              (pg.updatedAt || 0) > (existingPg.updatedAt || 0)
            ) {
              pageMap.set(pg.id, JSON.parse(JSON.stringify(pg)));
            } else if (
              existingCount > 0 &&
              candidateCount === 0 &&
              (pg.updatedAt || 0) > (existingPg.updatedAt || 0) &&
              pg.name !== existingPg.name
            ) {
              // Keep existing objects AND apply newer renamed page title
              pageMap.set(pg.id, {
                ...JSON.parse(JSON.stringify(existingPg)),
                name: pg.name,
                updatedAt: pg.updatedAt,
              });
            }
          }
        }
        const mergedPages = Array.from(pageMap.values());
        const newerProj = (proj.updatedAt || 0) > (existingProj.updatedAt || 0) ? proj : existingProj;
        mergedProjectsMap.set(proj.id, {
          ...newerProj,
          pages: mergedPages,
          updatedAt: Math.max(existingProj.updatedAt || 0, proj.updatedAt || 0),
        });
      }
    }
  }

  return normalizeWorkspace({
    version: 2,
    activeProjectId: primary.activeProjectId,
    projects: Array.from(mergedProjectsMap.values()),
  });
}
