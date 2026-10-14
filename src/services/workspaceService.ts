import { BoardObject, BoardPage, BoardProject, WorkspaceState } from '../types/board';

const STORAGE_KEY = 'canvasjam_workspace_v2';

export function createBlankPage(name = 'Page 1'): BoardPage {
  const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
  return {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activePageId: initialPage.id,
    pages: [initialPage],
  };
}

export function getDefaultWorkspace(): WorkspaceState {
  const defaultPage: BoardPage = {
    id: 'page-1',
    name: 'Page 1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activePageId: defaultPage.id,
    pages: [defaultPage],
  };

  return {
    version: 2,
    activeProjectId: defaultProject.id,
    projects: [defaultProject],
  };
}

export function loadWorkspaceFromStorage(): WorkspaceState {
  if (typeof window === 'undefined') {
    return getDefaultWorkspace();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fallback = getDefaultWorkspace();
      saveWorkspaceToStorage(fallback);
      return fallback;
    }

    const parsed: WorkspaceState = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      const fallback = getDefaultWorkspace();
      saveWorkspaceToStorage(fallback);
      return fallback;
    }

    // Ensure valid active project
    let activeProj = parsed.projects.find((p) => p.id === parsed.activeProjectId);
    if (!activeProj) {
      activeProj = parsed.projects[0];
      parsed.activeProjectId = activeProj.id;
    }

    // Ensure active project has at least 1 page
    if (!activeProj.pages || activeProj.pages.length === 0) {
      const freshPage = createBlankPage('Page 1');
      activeProj.pages = [freshPage];
      activeProj.activePageId = freshPage.id;
    } else {
      const activePage = activeProj.pages.find((pg) => pg.id === activeProj?.activePageId);
      if (!activePage) {
        activeProj.activePageId = activeProj.pages[0].id;
      }
    }

    return parsed;
  } catch (e) {
    console.error('Failed to load workspace from localStorage:', e);
    return getDefaultWorkspace();
  }
}

export function saveWorkspaceToStorage(workspace: WorkspaceState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch (e) {
    console.warn('LocalStorage save failed (storage might be full):', e);
  }
}
