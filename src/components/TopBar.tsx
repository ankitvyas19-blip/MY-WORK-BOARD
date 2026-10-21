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
}) => {
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dropdown menus
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

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
        setRenamingProjectId(null);
        setEditingCurrentProjectInline(false);
      }
      if (pageMenuRef.current && !pageMenuRef.current.contains(target)) {
        setPageMenuOpen(false);
        setRenamingPageId(null);
        setEditingCurrentPageInline(false);
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

  return (
    <header className="h-14 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 select-none shadow-xs w-full flex-nowrap overflow-hidden">
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
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0">
        {/* Brand Logo */}
        <a
          href="#canvas"
          onClick={(e) => {
            e.preventDefault();
            onFitToContent();
          }}
          className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-indigo-600 transition-colors flex items-center gap-1.5"
          title="CanvasJam - Click to center canvas"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block shadow-xs"></span>
          <span>CanvasJam</span>
        </a>

        <span className="text-slate-300 font-light select-none text-xs" aria-hidden="true">/</span>

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
                className="text-xs font-semibold text-slate-900 bg-white border border-indigo-500 rounded px-2 py-0.5 focus:outline-none w-24 sm:w-36"
              />
              <button
                type="button"
                onClick={handleFinishInlineProjectRename}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
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
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-l-md border-y border-l border-slate-200/80 transition-colors max-w-[100px] sm:max-w-[140px] truncate cursor-pointer"
                title={`Project: ${activeProject.name} (Click to switch or manage projects)`}
              >
                <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">{activeProject.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setInlineProjectTitleDraft(activeProject.name);
                  setEditingCurrentProjectInline(true);
                }}
                className="px-1.5 py-1 text-slate-400 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/80 rounded-r-md border border-slate-200/80 border-l-slate-200 transition-colors cursor-pointer"
                title="Rename this project"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Project Menu Popover */}
          {projectMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 flex items-center justify-between border-b border-slate-100 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Projects ({projects.length})
                </span>
              </div>

              {/* Create New Project with custom name */}
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70">
                <div className="text-[11px] font-semibold text-slate-600 mb-1">Create New Project</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Project name..."
                    value={newProjectNameDraft}
                    onChange={(e) => setNewProjectNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateNamedProject();
                    }}
                    className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNamedProject}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    title="Create project"
                  >
                    <Plus className="w-3 h-3" />
                    Create
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto py-0.5">
                {projects.map((proj) => {
                  const isActive = proj.id === activeProjectId;
                  const isRenaming = renamingProjectId === proj.id;

                  if (isRenaming) {
                    return (
                      <div key={proj.id} className="px-2 py-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={renamingProjectName}
                          onChange={(e) => setRenamingProjectName(e.target.value)}
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
                          className="w-full text-xs px-2 py-1 border border-indigo-500 rounded bg-white text-slate-800 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (renamingProjectName.trim()) {
                              onRenameProject(proj.id, renamingProjectName.trim());
                            }
                            setRenamingProjectId(null);
                          }}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingProjectId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={proj.id}
                      className={`group px-2.5 py-1.5 mx-1 rounded-md flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-900 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        onSelectProject(proj.id);
                        setProjectMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <Folder
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{proj.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({proj.pages.length}p)
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingProjectId(proj.id);
                            setRenamingProjectName(proj.name);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Rename project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteProject(proj.id);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
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
                className="text-xs font-semibold text-slate-900 bg-white border border-indigo-500 rounded px-2 py-0.5 focus:outline-none w-24 sm:w-36"
              />
              <button
                type="button"
                onClick={handleFinishInlinePageRename}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
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
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-800 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/80 rounded-l-md border-y border-l border-slate-200/80 transition-colors max-w-[90px] sm:max-w-[130px] truncate cursor-pointer"
                title={`Page: ${activePage.name} (Click to open page menu)`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">{activePage.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setEditingCurrentPageInline(true)}
                className="px-1.5 py-1 text-slate-400 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200/80 rounded-r-md border border-slate-200/80 border-l-slate-200 transition-colors cursor-pointer"
                title="Rename this page"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick 1-click Add Blank Page Button */}
          <button
            type="button"
            onClick={() => onCreatePage()}
            className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 rounded-md border border-indigo-100 transition-colors whitespace-nowrap cursor-pointer ml-1 shrink-0"
            title="Create a new blank page in this project"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden xl:inline text-[11px]">Page</span>
          </button>

          {/* Page Menu Popover */}
          {pageMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-72 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 flex items-center justify-between border-b border-slate-100 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Pages ({activeProject.pages.length})
                </span>
              </div>

              {/* Create New Page with custom name */}
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70">
                <div className="text-[11px] font-semibold text-slate-600 mb-1">Add New Page</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Page name..."
                    value={newPageNameDraft}
                    onChange={(e) => setNewPageNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateNamedPage();
                    }}
                    className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNamedPage}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    title="Add page"
                  >
                    <Plus className="w-3 h-3" />
                    Create
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto py-0.5">
                {activeProject.pages.map((pg) => {
                  const isActive = pg.id === activePageId;
                  const isRenaming = renamingPageId === pg.id;

                  if (isRenaming) {
                    return (
                      <div key={pg.id} className="px-2 py-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={renamingPageName}
                          onChange={(e) => setRenamingPageName(e.target.value)}
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
                          className="w-full text-xs px-2 py-1 border border-indigo-500 rounded bg-white text-slate-800 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (renamingPageName.trim()) {
                              onRenamePage(pg.id, renamingPageName.trim());
                            }
                            setRenamingPageId(null);
                          }}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingPageId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={pg.id}
                      className={`group px-2.5 py-1.5 mx-1 rounded-md flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-900 font-medium'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        onSelectPage(pg.id);
                        setPageMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <Layers
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{pg.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({pg.objects.length} items)
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingPageId(pg.id);
                            setRenamingPageName(pg.name);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Rename page"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {activeProject.pages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePage(pg.id);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
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

        {/* Real-time Persistence Status Badge */}
        <div
          className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap shrink-0"
          title="Disk persistence active: all drawings, sticky notes, attachments, and pages are automatically saved to your PC."
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Saved</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ZONE 2 (CENTER): Search, Canvas Tools & Timer             */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 min-w-0 shrink px-2 justify-center">
        {/* Search Bar */}
        {onSearchChange && (
          <div className="relative flex items-center">
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
              className="w-24 sm:w-32 md:w-44 lg:w-48 pl-7 pr-8 py-1 text-xs bg-slate-100/90 hover:bg-slate-100 focus:bg-white text-slate-800 placeholder-slate-400 rounded-lg border border-slate-200/90 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
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
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md border border-slate-200/80 transition-colors whitespace-nowrap cursor-pointer"
            title="Canvas Options & Tools"
          >
            <SlidersHorizontal className="w-3 h-3 text-slate-500" />
            <span className="hidden sm:inline">Tools</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {toolsMenuOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  onOpenTemplates();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Templates</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCycleGridMode();
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>Grid Style</span>
                <span className="font-mono text-[10px] text-slate-400 uppercase bg-slate-100 px-1 py-0.5 rounded">
                  {gridMode}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onFitToContent();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Fit Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenActivityAndVotes();
                  setToolsMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Activity & Votes</span>
              </button>
            </div>
          )}
        </div>

        {/* Jam Timer Widget */}
        <div className="relative shrink-0">
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
            <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 p-2.5 z-50">
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
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
        {/* Attach File Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2 sm:px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md border border-slate-200/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          title="Attach screenshots, PDFs, Excel sheets, PowerPoint decks"
        >
          <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="hidden sm:inline">Attach</span>
        </button>

        {/* Local PC Backup & Restore Buttons */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200/80 shrink-0">
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

        {/* Google Drive Status / Manage Button */}
        {isDriveSignedIn ? (
          <button
            type="button"
            onClick={onOpenDriveModal}
            className="px-2 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Google Drive 5 TB Active (Click to manage cloud backups)"
          >
            {isAutosaving ? (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            )}
            <span className="hidden md:inline font-semibold text-[11px]">
              {isAutosaving ? 'Saving...' : 'Drive'}
            </span>
            <span className="font-mono text-[10px] text-emerald-600 hidden 2xl:inline">
              (5 TB)
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenDriveModal}
            className="px-2 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Google Drive Cloud Backup (Click to configure or sign in)"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              viewBox="0 0 48 48"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span className="hidden sm:inline text-[11px]">Drive</span>
          </button>
        )}

        {/* Collaborators Avatar Stack */}
        <div className="flex items-center -space-x-1.5 shrink-0">
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

        {/* Export SVG Button */}
        <button
          type="button"
          onClick={onExportSvg}
          className="px-2.5 sm:px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
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
