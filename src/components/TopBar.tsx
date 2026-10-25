import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Users,
  Eye,
  Cloud,
  Paperclip,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Lock,
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Folder,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  ChevronDown,
  SlidersHorizontal,
  Home,
  Save,
} from 'lucide-react';
import {
  BoardProject,
  CollaboratorPresence,
  DriveQuotaInfo,
  RoomTimerState,
} from '../types/board';

export interface TopBarProps {
  // Projects & Pages
  projects: BoardProject[];
  activeProjectId: string;
  activePageId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name?: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onDeleteProject: (projectId: string) => void;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (name?: string) => void;
  onRenamePage: (pageId: string, newName: string) => void;
  onDeletePage: (pageId: string) => void;

  // Active board/room info
  roomId: string;
  boardTitle: string;
  onUpdateTitle?: (newTitle: string) => void;

  currentUser: CollaboratorPresence;
  peers: CollaboratorPresence[];
  followingUserId: string | null;
  onToggleFollowUser: (userId: string) => void;
  timer: RoomTimerState;
  onTimerAction: (action: 'start' | 'pause' | 'reset' | 'set', durationSeconds?: number) => void;
  gridMode: 'dots' | 'lines' | 'none';
  onCycleGridMode: () => void;
  onFitToContent: () => void;
  onOpenTemplates: () => void;
  onOpenActivityAndVotes: () => void;
  onOpenShareModal: () => void;
  onExportSvg: () => void;
  wsConnected: boolean;

  // Search Bar Props
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchMatchCount?: number;
  searchCurrentIndex?: number;
  onNextSearchMatch?: () => void;
  onPrevSearchMatch?: () => void;

  // Google Drive & Attachment Props
  isDriveSignedIn: boolean;
  driveQuota: DriveQuotaInfo | null;
  isAutosaving: boolean;
  lastAutosaveTime: number | null;
  onGoogleSignIn: () => void;
  onOpenDriveModal: () => void;
  onAttachFiles: (files: FileList | File[]) => void;
  onLockWorkspace?: () => void;
  onExportWorkspaceBackup?: () => void;
  onImportWorkspaceBackup?: (file: File) => void;
  onSaveWorkspaceNow?: () => void;
  onGoToHomePage?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projects,
  activeProjectId,
  activePageId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  roomId,
  boardTitle,
  onUpdateTitle,
  currentUser,
  peers,
  followingUserId,
  onToggleFollowUser,
  timer,
  onTimerAction,
  gridMode,
  onCycleGridMode,
  onFitToContent,
  onOpenTemplates,
  onOpenActivityAndVotes,
  onOpenShareModal,
  onExportSvg,
  wsConnected,
  searchQuery = '',
  onSearchChange,
  searchMatchCount = 0,
  searchCurrentIndex = 0,
  onNextSearchMatch,
  onPrevSearchMatch,
  isDriveSignedIn,
  driveQuota,
  isAutosaving,
  lastAutosaveTime,
  onGoogleSignIn,
  onOpenDriveModal,
  onAttachFiles,
  onLockWorkspace,
  onExportWorkspaceBackup,
  onImportWorkspaceBackup,
  onSaveWorkspaceNow,
  onGoToHomePage,
}) => {
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dropdown menus
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [justSavedFlash, setJustSavedFlash] = useState(false);

  // Renaming state
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renamingProjectName, setRenamingProjectName] = useState('');

  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renamingPageName, setRenamingPageName] = useState('');

  // TopBar direct page rename state
  const [editingCurrentPageInline, setEditingCurrentPageInline] = useState(false);
  const [inlinePageTitleDraft, setInlinePageTitleDraft] = useState('');

  // TopBar direct project rename state
  const [editingCurrentProjectInline, setEditingCurrentProjectInline] = useState(false);
  const [inlineProjectTitleDraft, setInlineProjectTitleDraft] = useState('');
  const [newProjectNameDraft, setNewProjectNameDraft] = useState('');
  const [newPageNameDraft, setNewPageNameDraft] = useState('');

  // Timer & popovers
  const [showTimerPopover, setShowTimerPopover] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(timer.remainingSeconds);

  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const pageMenuRef = useRef<HTMLDivElement | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);

  // Active Project & Page resolution
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || {
    id: 'proj-default',
    name: 'Main Project',
    pages: [],
  };

  const activePage =
    activeProject.pages.find((pg) => pg.id === activePageId) ||
    activeProject.pages[0] || {
      id: 'page-default',
      name: boardTitle || 'Page 1',
      objects: [],
    };

  useEffect(() => {
    setInlinePageTitleDraft(activePage.name);
  }, [activePage.name]);

  useEffect(() => {
    setInlineProjectTitleDraft(activeProject.name);
  }, [activeProject.name]);

  const handleFinishInlineProjectRename = () => {
    setEditingCurrentProjectInline(false);
    const trimmed = inlineProjectTitleDraft.trim();
    if (trimmed && trimmed !== activeProject.name) {
      onRenameProject(activeProject.id, trimmed);
    } else {
      setInlineProjectTitleDraft(activeProject.name);
    }
  };

  const handleCreateNamedProject = () => {
    const clean = newProjectNameDraft.trim();
    onCreateProject(clean || undefined);
    setNewProjectNameDraft('');
    setProjectMenuOpen(false);
  };

  const handleCreateNamedPage = () => {
    const clean = newPageNameDraft.trim();
    onCreatePage(clean || undefined);
    setNewPageNameDraft('');
    setPageMenuOpen(false);
  };

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuOpen(false);
      }
      if (pageMenuRef.current && !pageMenuRef.current.contains(target)) {
        setPageMenuOpen(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(target)) {
        setToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Timer tick
  useEffect(() => {
    if (!timer.isRunning) {
      setDisplaySeconds(timer.remainingSeconds);
      return;
    }
    const updateTick = () => {
      if (timer.startedAt) {
        const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
        setDisplaySeconds(Math.max(0, timer.remainingSeconds - elapsed));
      }
    };
    updateTick();
    const interval = window.setInterval(updateTick, 250);
    return () => window.clearInterval(interval);
  }, [timer]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleFinishInlinePageRename = () => {
    setEditingCurrentPageInline(false);
    const trimmed = inlinePageTitleDraft.trim();
    if (trimmed && trimmed !== activePage.name) {
      onRenamePage(activePage.id, trimmed);
      if (onUpdateTitle) onUpdateTitle(trimmed);
    } else {
      setInlinePageTitleDraft(activePage.name);
    }
  };

  const handleTriggerSaveNow = () => {
    if (onSaveWorkspaceNow) {
      onSaveWorkspaceNow();
    }
    setJustSavedFlash(true);
    window.setTimeout(() => setJustSavedFlash(false), 1800);
  };

  const handleGoHome = () => {
    setProjectMenuOpen(false);
    setPageMenuOpen(false);
    setToolsMenuOpen(false);
    if (onGoToHomePage) {
      onGoToHomePage();
    } else if (projects.length > 0) {
      const firstProj = projects[0];
      if (firstProj.id !== activeProjectId) {
        onSelectProject(firstProj.id);
      } else if (firstProj.pages.length > 0 && firstProj.pages[0].id !== activePageId) {
        onSelectPage(firstProj.pages[0].id);
      }
      onFitToContent();
    }
  };

  return (
    <header className="h-14 fixed top-0 left-0 right-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-2 sm:px-4 flex items-center justify-between select-none shadow-xs w-full flex-nowrap overflow-visible">
      {/* Hidden File Input for Attachments */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.csv,.xlsx,.xls,.pptx,.ppt,.txt,.md"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAttachFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Hidden File Input for Workspace JSON Restore */}
      <input
        type="file"
        ref={restoreFileInputRef}
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onImportWorkspaceBackup) {
            onImportWorkspaceBackup(file);
            e.target.value = '';
          }
        }}
      />

      {/* ========================================================= */}
      {/* ZONE 1 (LEFT): Workspace Identity & Page Navigation       */}
      {/* ========================================================= */}
      <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink-0">
        {/* Brand Logo + Home / Main Page Quick Button */}
        <button
          type="button"
          onClick={handleGoHome}
          className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer border border-indigo-200/80"
          title="Go to Main Page / Home & Center Canvas"
        >
          <Home className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="hidden sm:inline">Home</span>
        </button>

        {/* Project Switcher Dropdown & Inline Direct Rename */}
        <div className="relative flex items-center" ref={projectMenuRef}>
          {editingCurrentProjectInline ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={inlineProjectTitleDraft}
                onChange={(e) => setInlineProjectTitleDraft(e.target.value)}
                onBlur={handleFinishInlineProjectRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishInlineProjectRename();
                  if (e.key === 'Escape') {
                    setInlineProjectTitleDraft(activeProject.name);
                    setEditingCurrentProjectInline(false);
                  }
                }}
                autoFocus
                className="text-xs font-semibold text-slate-900 bg-white border-2 border-indigo-500 rounded px-2 py-1 focus:outline-none w-28 sm:w-40"
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleFinishInlineProjectRename();
                }}
                onClick={handleFinishInlineProjectRename}
                className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer"
                title="Save project name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  setProjectMenuOpen((prev) => !prev);
                  setPageMenuOpen(false);
                  setToolsMenuOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-l-md border-y border-l border-slate-200/80 transition-colors max-w-[92px] sm:max-w-[140px] truncate cursor-pointer"
                title={`Project: ${activeProject.name} (Tap to switch, create, or rename projects)`}
              >
                <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">{activeProject.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setInlineProjectTitleDraft(activeProject.name);
                  setEditingCurrentProjectInline(true);
                }}
                className="px-1.5 py-1.5 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/80 rounded-r-md border border-slate-200/80 border-l-slate-200 transition-colors cursor-pointer"
                title="Rename current project"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Project Menu Popover (Full-width fixed below TopBar on mobile so NEVER clipped) */}
          {projectMenuOpen && (
            <div className="fixed left-2 right-2 top-15 sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-1.5 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-[100] max-h-[82vh] flex flex-col">
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Projects ({projects.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Home className="w-3 h-3" />
                    <span>Main Page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Create New Project with custom name */}
              <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
                <div className="text-xs font-bold text-slate-700 mb-1.5">Create New Project</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Enter new project name..."
                    value={newProjectNameDraft}
                    onChange={(e) => setNewProjectNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateNamedProject();
                    }}
                    className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNamedProject}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto py-1 max-h-64 divide-y divide-slate-50">
                {projects.map((proj) => {
                  const isActive = proj.id === activeProjectId;
                  const isRenaming = renamingProjectId === proj.id;

                  if (isRenaming) {
                    return (
                      <div key={proj.id} className="px-3 py-2 flex items-center gap-1.5 bg-indigo-50/50">
                        <input
                          type="text"
                          value={renamingProjectName}
                          onChange={(e) => setRenamingProjectName(e.target.value)}
                          onBlur={() => {
                            if (renamingProjectName.trim() && renamingProjectName.trim() !== proj.name) {
                              onRenameProject(proj.id, renamingProjectName.trim());
                            }
                            setRenamingProjectId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (renamingProjectName.trim()) {
                                onRenameProject(proj.id, renamingProjectName.trim());
                              }
                              setRenamingProjectId(null);
                            } else if (e.key === 'Escape') {
                              setRenamingProjectId(null);
                            }
                          }}
                          autoFocus
                          className="flex-1 text-xs px-2.5 py-1.5 border-2 border-indigo-500 rounded-md bg-white text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (renamingProjectName.trim()) {
                              onRenameProject(proj.id, renamingProjectName.trim());
                            }
                            setRenamingProjectId(null);
                          }}
                          onClick={() => {
                            if (renamingProjectName.trim()) {
                              onRenameProject(proj.id, renamingProjectName.trim());
                            }
                            setRenamingProjectId(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingProjectId(null)}
                          className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={proj.id}
                      className={`px-3 py-2 mx-1 my-0.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200/60'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        onSelectProject(proj.id);
                        setProjectMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                        <Folder
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{proj.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({proj.pages.length}p)
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0 ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingProjectId(proj.id);
                            setRenamingProjectName(proj.name);
                          }}
                          className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                          title="Rename project"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Rename</span>
                        </button>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProject(proj.id);
                              setProjectMenuOpen(false);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-md transition-colors cursor-pointer"
                            title="Delete project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <span className="text-slate-300 font-light select-none text-xs" aria-hidden="true">/</span>

        {/* Page Switcher & Direct Inline Rename */}
        <div className="relative flex items-center" ref={pageMenuRef}>
          {editingCurrentPageInline ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={inlinePageTitleDraft}
                onChange={(e) => setInlinePageTitleDraft(e.target.value)}
                onBlur={handleFinishInlinePageRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishInlinePageRename();
                  if (e.key === 'Escape') {
                    setInlinePageTitleDraft(activePage.name);
                    setEditingCurrentPageInline(false);
                  }
                }}
                autoFocus
                className="text-xs font-semibold text-slate-900 bg-white border-2 border-indigo-500 rounded px-2 py-1 focus:outline-none w-28 sm:w-40"
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleFinishInlinePageRename();
                }}
                onClick={handleFinishInlinePageRename}
                className="p-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer"
                title="Save page name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  setPageMenuOpen((prev) => !prev);
                  setProjectMenuOpen(false);
                  setToolsMenuOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-800 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/80 rounded-l-md border-y border-l border-slate-200/80 transition-colors max-w-[92px] sm:max-w-[135px] truncate cursor-pointer"
                title={`Page: ${activePage.name} (Tap to switch, add, or rename pages)`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">{activePage.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setInlinePageTitleDraft(activePage.name);
                  setEditingCurrentPageInline(true);
                }}
                className="px-1.5 py-1.5 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/80 rounded-r-md border border-slate-200/80 border-l-slate-200 transition-colors cursor-pointer"
                title="Rename current page"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick 1-click Add Blank Page Button */}
          <button
            type="button"
            onClick={() => onCreatePage()}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200/80 transition-colors whitespace-nowrap cursor-pointer ml-1 shrink-0"
            title="Create a new blank page in this project"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-[11px]">Page</span>
          </button>

          {/* Page Menu Popover (Full-width fixed below TopBar on mobile so NEVER clipped) */}
          {pageMenuOpen && (
            <div className="fixed left-2 right-2 top-15 sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-1.5 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-[100] max-h-[82vh] flex flex-col">
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pages in {activeProject.name} ({activeProject.pages.length})
                </span>
                <div className="flex items-center gap-1.5">
                  {activeProject.pages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPage(activeProject.pages[0].id);
                        setPageMenuOpen(false);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md flex items-center gap-1 cursor-pointer"
                    >
                      <Home className="w-3 h-3" />
                      <span>Page 1</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPageMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Create New Page with custom name */}
              <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
                <div className="text-xs font-bold text-slate-700 mb-1.5">Add New Page</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Enter new page name..."
                    value={newPageNameDraft}
                    onChange={(e) => setNewPageNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateNamedPage();
                    }}
                    className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNamedPage}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto py-1 max-h-64 divide-y divide-slate-50">
                {activeProject.pages.map((pg, idx) => {
                  const isActive = pg.id === activePageId;
                  const isRenaming = renamingPageId === pg.id;

                  if (isRenaming) {
                    return (
                      <div key={pg.id} className="px-3 py-2 flex items-center gap-1.5 bg-indigo-50/50">
                        <input
                          type="text"
                          value={renamingPageName}
                          onChange={(e) => setRenamingPageName(e.target.value)}
                          onBlur={() => {
                            if (renamingPageName.trim() && renamingPageName.trim() !== pg.name) {
                              onRenamePage(pg.id, renamingPageName.trim());
                            }
                            setRenamingPageId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (renamingPageName.trim()) {
                                onRenamePage(pg.id, renamingPageName.trim());
                              }
                              setRenamingPageId(null);
                            } else if (e.key === 'Escape') {
                              setRenamingPageId(null);
                            }
                          }}
                          autoFocus
                          className="flex-1 text-xs px-2.5 py-1.5 border-2 border-indigo-500 rounded-md bg-white text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (renamingPageName.trim()) {
                              onRenamePage(pg.id, renamingPageName.trim());
                            }
                            setRenamingPageId(null);
                          }}
                          onClick={() => {
                            if (renamingPageName.trim()) {
                              onRenamePage(pg.id, renamingPageName.trim());
                            }
                            setRenamingPageId(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingPageId(null)}
                          className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={pg.id}
                      className={`px-3 py-2 mx-1 my-0.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200/60'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        onSelectPage(pg.id);
                        setPageMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                        <Layers
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">
                          {idx === 0 ? `${pg.name} (Main)` : pg.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({pg.objects.length} items)
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0 ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingPageId(pg.id);
                            setRenamingPageName(pg.name);
                          }}
                          className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                          title="Rename page"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Rename</span>
                        </button>
                        {activeProject.pages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePage(pg.id);
                              setPageMenuOpen(false);
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-md transition-colors cursor-pointer"
                            title="Delete page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 1-Tap Save Now + Auto-Save Status Button */}
        <button
          type="button"
          onClick={handleTriggerSaveNow}
          className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-md border transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            justSavedFlash
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm scale-105'
              : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
          }`}
          title="Tap to force-save all text, photos, projects, and pages to device & cloud right now"
        >
          {justSavedFlash ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Save</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* ZONE 2 (CENTER): Search, Canvas Tools & Timer             */}
      {/* ========================================================= */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink px-1 sm:px-2 justify-center">
        {/* Search Bar (visible on md+ screens) */}
        {onSearchChange && (
          <div className="relative hidden md:flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onSearchChange('');
                } else if (e.key === 'Enter') {
                  if (e.shiftKey && onPrevSearchMatch) {
                    e.preventDefault();
                    onPrevSearchMatch();
                  } else if (onNextSearchMatch) {
                    e.preventDefault();
                    onNextSearchMatch();
                  }
                }
              }}
              placeholder="Search canvas..."
              className="w-28 md:w-40 lg:w-48 pl-7 pr-8 py-1 text-xs bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 placeholder-slate-400 rounded-lg border border-slate-200/90 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />

            {searchQuery && (
              <div className="absolute right-1 flex items-center gap-0.5">
                {searchMatchCount > 0 ? (
                  <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-200/80 px-1 py-0.5 rounded tabular-nums">
                    {searchCurrentIndex + 1}/{searchMatchCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-200/60 px-1 py-0.5 rounded">
                    0
                  </span>
                )}
                {searchMatchCount > 1 && onPrevSearchMatch && onNextSearchMatch && (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={onPrevSearchMatch}
                      className="p-0.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Previous match (Shift+Enter)"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={onNextSearchMatch}
                      className="p-0.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Next match (Enter)"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                  title="Clear search (Esc)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Wide Screen View Buttons (>= xl) */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-medium text-slate-600 shrink-0">
          <button
            type="button"
            onClick={onOpenTemplates}
            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={onCycleGridMode}
            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            title="Toggle Canvas Grid (Dots / Lines / None)"
          >
            Grid: {gridMode.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={onFitToContent}
            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
            title="Fit all board objects into screen"
          >
            Fit Canvas
          </button>
          <button
            type="button"
            onClick={onOpenActivityAndVotes}
            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer"
          >
            Activity
          </button>
        </div>

        {/* Compact View Dropdown (< xl) */}
        <div className="relative xl:hidden" ref={toolsMenuRef}>
          <button
            type="button"
            onClick={() => {
              setToolsMenuOpen((prev) => !prev);
              setProjectMenuOpen(false);
              setPageMenuOpen(false);
            }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md border border-slate-200/80 transition-colors whitespace-nowrap cursor-pointer"
            title="Canvas Options, Backup & Tools"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Menu</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {toolsMenuOpen && (
            <div className="fixed right-2 top-15 sm:absolute sm:right-0 sm:top-full sm:mt-1.5 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-[100]">
              <button
                type="button"
                onClick={handleGoHome}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Go to Main / Home Page</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onFitToContent();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Center / Fit Canvas (100%)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenTemplates();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Templates</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCycleGridMode();
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>Grid Style</span>
                <span className="font-mono text-[10px] text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                  {gridMode}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenActivityAndVotes();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Activity & Votes</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => {
                  if (onExportWorkspaceBackup) onExportWorkspaceBackup();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Download Backup (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  restoreFileInputRef.current?.click();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                <span>Restore Backup (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenDriveModal();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloud Sync (Active)</span>
              </button>
            </div>
          )}
        </div>

        {/* Jam Timer Widget (visible on lg+) */}
        <div className="relative hidden lg:block shrink-0">
          <button
            type="button"
            onClick={() => setShowTimerPopover((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer border ${
              timer.isRunning
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
            }`}
            title="Meeting & Jam Timer"
          >
            {timer.isRunning ? (
              <Pause className="w-3 h-3 text-rose-600" />
            ) : (
              <Play className="w-3 h-3 text-slate-600" />
            )}
            <span>{formatTime(displaySeconds)}</span>
          </button>

          {showTimerPopover && (
            <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 p-2.5 z-[100]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800">Jam Timer</span>
                <button
                  type="button"
                  onClick={() => setShowTimerPopover(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1 mb-2">
                {[1, 3, 5].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      onTimerAction('set', mins * 60);
                      onTimerAction('start');
                      setShowTimerPopover(false);
                    }}
                    className="py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded transition-colors"
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                {timer.isRunning ? (
                  <button
                    type="button"
                    onClick={() => onTimerAction('pause')}
                    className="flex-1 py-1 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors"
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTimerAction('start')}
                    className="flex-1 py-1 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded transition-colors"
                  >
                    Start
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onTimerAction('reset')}
                  className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                  title="Reset timer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ZONE 3 (RIGHT): Attach, Storage, Collaboration & Export    */}
      {/* ========================================================= */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-nowrap">
        {/* Attach File Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md border border-slate-200/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          title="Attach photos, screenshots, PDFs, Excel sheets, PowerPoint decks"
        >
          <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="hidden sm:inline">Attach</span>
        </button>

        {/* Local PC Backup & Restore Buttons (visible on md+) */}
        <div className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={onExportWorkspaceBackup}
            className="px-1.5 sm:px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-white hover:shadow-xs rounded transition-all flex items-center gap-1 cursor-pointer"
            title="Download full backup of all canvas drawings, notes, files, and pages to your PC (.json)"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="hidden lg:inline text-[11px]">Backup</span>
          </button>
          <button
            type="button"
            onClick={() => restoreFileInputRef.current?.click()}
            className="px-1.5 sm:px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-white hover:shadow-xs rounded transition-all flex items-center gap-1 cursor-pointer"
            title="Restore canvas from a saved backup file (.json)"
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden lg:inline text-[11px]">Restore</span>
          </button>
        </div>

        {/* Permanent Cloud Sync Status Button (visible on md+) */}
        <button
          type="button"
          onClick={onOpenDriveModal}
          className="hidden md:flex px-2 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          title="Permanent Cloud Sync Active (Desktop & Phone Synced Automatically — No Login Needed)"
        >
          {isAutosaving ? (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          )}
          <span className="hidden md:inline font-semibold text-[11px]">
            {isAutosaving ? 'Syncing...' : 'Cloud Synced'}
          </span>
        </button>

        {/* Collaborators Avatar Stack */}
        <div className="hidden sm:flex items-center -space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenShareModal}
            title={`You: ${currentUser.name} (${wsConnected ? 'Live Sync Active' : 'Offline / Saved to Disk'}) — Click to customize profile`}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-white shadow-xs transition-transform hover:scale-105 cursor-pointer"
            style={{ backgroundColor: currentUser.color }}
          >
            {currentUser.name.slice(0, 2).toUpperCase()}
          </button>

          {peers.slice(0, 3).map((peer) => {
            const isFollowing = followingUserId === peer.id;
            return (
              <button
                key={peer.id}
                type="button"
                onClick={() => onToggleFollowUser(peer.id)}
                title={
                  isFollowing
                    ? `Following ${peer.name}'s viewport (Click to unfollow)`
                    : `${peer.name} — Click to follow camera`
                }
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 transition-transform hover:scale-110 cursor-pointer relative ${
                  isFollowing ? 'ring-indigo-600 scale-110 z-10' : 'ring-white'
                }`}
                style={{ backgroundColor: peer.color }}
              >
                {peer.name.slice(0, 2).toUpperCase()}
                {isFollowing && (
                  <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5">
                    <Eye className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Export SVG Button (visible on sm+) */}
        <button
          type="button"
          onClick={onExportSvg}
          className="hidden sm:flex px-2.5 sm:px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          title="Export vector SVG"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Lock Workspace Button */}
        {onLockWorkspace && (
          <button
            type="button"
            onClick={onLockWorkspace}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0"
            title="Lock Workspace (Logout session)"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
