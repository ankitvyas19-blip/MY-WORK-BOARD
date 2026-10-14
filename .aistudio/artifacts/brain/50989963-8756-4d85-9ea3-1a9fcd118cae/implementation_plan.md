# Multi-Project Workspace with Renameable Pages & Dual Persistence

Enable unlimited projects and dynamic, renameable board pages with clean blank canvas initialization, controlled via an integrated TopBar switcher and backed by dual persistence across local storage and Google Drive.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your answers to our clarifying questions, the following key architectural behaviors are confirmed:

- **Confirmed Decision 1 (Navigation & Layout)**: Project and page navigation will be seamlessly integrated directly into the TopBar with one-click **Add**, **Rename**, and **Switch** controls, keeping the entire screen dedicated to your infinite whiteboard without cluttering screen edges with permanent sidebars.
- **Confirmed Decision 2 (Data Persistence)**: Board content will be saved with **dual persistence**: immediately and automatically to browser Local Storage (surviving page reloads and server restarts without losing custom drawings or objects), with direct one-click and automatic sync to Google Drive for cloud backups and cross-device safety.
- **Confirmed Decision 3 (Page Creation State)**: Newly created pages start with a pristine blank canvas rather than pre-seeded template shapes, giving you a fresh workspace every time.
- **Root Cause Identified (Saved Content Resetting)**: The existing application had hardcoded 3 fixed room IDs (`canvas-1`, `canvas-2`, `canvas-3`) that were re-seeded with demo template shapes on server reboot and lacked isolated localStorage keys per page/project. Moving between boards or restarting wiped your custom edits and reverted to default presets. The new system establishes a hierarchical `Project -> Page -> BoardObjects` store keyed specifically per page with isolated states.

---

## 1. Overview & Core Concept

- **What It Does**: Provides a collaborative whiteboard workspace where users can create unlimited distinct projects (e.g., "Sprint Planning", "Architecture Roadmap", "Design Moodboard"). Each project holds an arbitrary number of renameable pages (e.g., "Page 1: Brainstorm", "Page 2: Flowchart"). Creating a new page opens a fresh, clean canvas. All edits, shapes, text notes, sticky notes, and attachments are immediately saved to local storage and can be backed up or synced to Google Drive.
- **Target Audience / Persona**: Designers, product managers, engineers, and thinkers who need dedicated, organized project boards with multiple specialized sheets without losing work between sessions.
- **Key Value**: Eliminates the 3-page ceiling, allows custom naming for both projects and pages, guarantees permanent data retention across reloads, and preserves clean canvas isolation so projects never bleed into each other.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Switching & Renaming Projects**:
   - The user looks at the left zone of the TopBar.
   - A modern Project dropdown selector displays the active project title (e.g., `Main Workspace`).
   - Clicking the title reveals a dropdown menu displaying all projects, a `+ New Project` button, and an inline pencil icon to rename the current project.
   - When renaming, an inline input replaces the title with immediate `Enter` to save or `Esc` to cancel.
2. **Adding & Renaming Pages**:
   - Adjacent to the project selector, the Page switcher displays the active page (e.g., `Board 1`).
   - Clicking reveals a menu of pages within that project, with a `+ Add Page` button.
   - Alternatively, a quick `+` button in the top bar creates a new blank canvas page and immediately switches to it.
   - Double-clicking or clicking the edit icon allows instant renaming of the page (e.g., from `Untitled Page 2` to `Sprint Retro`).
3. **Persisting & Restoring Content**:
   - As the user draws, adds sticky notes, places shapes, or uploads attachments, changes are instantly debounced into LocalStorage under `whiteboard_workspace_state` and synced to the collaborative server room.
   - A subtle save indicator in the TopBar confirms `"Saved locally"` with a timestamp.
   - If connected to Google Drive, a `"Sync with Drive"` badge or button allows manual or auto cloud backup directly to the user's Google Drive app folder.
   - Reloading the browser immediately restores the exact project, page, pan coordinates, zoom level, and canvas objects.

### Visual Identity & Theme

- **Aesthetic Direction**: High-utility, minimalist SaaS design inspired by modern creative tooling (Linear, Figma, Raycast). Clean typography, disciplined whitespace, zero decorative pills, and high-contrast readable controls.
- **Color Palette & Mood**:
  - Dominant Neutral Canvas: Crisp neutral white (`#FFFFFF`) / soft canvas grid dots (`#E2E8F0`) in light mode; deep slate neutral (`#0F172A`) with subtle dot grid (`#1E293B`) in dark mode.
  - Structural Surfaces: TopBar and popovers use clean white with subtle 1px border lines (`border-slate-200 dark:border-slate-800`), avoiding heavy card-in-card nesting.
  - Accent Color: Intentional indigo/slate accent (`#4F46E5` / `#0F172A`) reserved strictly for primary actions (`+ New Page`, active page highlight).
- **Typography & Hierarchy**:
  - Clean display sans font for TopBar navigation and dialogs (`Plus Jakarta Sans` or modern system sans).
  - Tabular numerals (`tabular-nums font-mono`) for zoom percentages, page counters, and storage timestamps.
  - Clean typographic breadcrumb hierarchy: `Project Name / Page Name`.
- **Interactive Feedback & Motion**:
  - Quick, smooth popover reveals ($\le 150\text{ms}$) with subtle fade and scale.
  - Clear visual hover states on project/page list items with subtle rounded highlights.
  - Inline editing with autofocus, outline ring, and clear save/cancel confirmation.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hierarchical Data Structure (`Projects -> Pages -> Canvas State`)**:
  - *Chosen Approach*: Store a root workspace state containing `projects: Project[]`, where each project has `id, name, pages: Page[]`, and each page has `id, name, objects: BoardObject[], viewport: { x, y, zoom }`.
  - *Why*: Provides complete state isolation. Switching between pages smoothly swaps the canvas object array without mutating other pages, completely solving the "content is always same" bug.
  - *Alternatives Considered*: Flat room IDs (the legacy approach) caused race conditions and shared object states across sessions.
- **Decision 2: Dual Persistence (Local Storage + Google Drive)**:
  - *Chosen Approach*: Local storage is the primary source of truth for immediate zero-latency local operations (100% offline resilience, survives server reboots). Google Drive integration serves as cloud synchronization and multi-device archive.
  - *Why*: In ephemeral or server-restart environments, memory-only servers lose state. Local storage guarantees the user never loses a stroke, while Google Drive fulfills cloud backup needs.
  - *Alternatives Considered*: Server-memory only (failed due to server restarts) or Google Drive only (slow network latency on every canvas stroke).
- **Decision 3: Clean Blank Canvas on Page Creation**:
  - *Chosen Approach*: When a user clicks `+ Add Page`, the new page is initialized with `objects: []` (empty array) and centered viewport `{ x: 0, y: 0, zoom: 1 }`.
  - *Why*: Directly satisfies the user's requirement ("Start with a clean blank canvas") rather than copying previous objects or enforcing mockup templates.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TopBar Component                                │
│                                                                             │
│  ┌────────────────────────┐  /  ┌────────────────────────┐  ┌─────────────┐ │
│  │ Project Switcher & Menu│     │   Page Switcher & Menu │  │ Sync Status │ │
│  │ • Current Project Name │     │   • Current Page Name  │  │ • LocalSave │ │
│  │ • [+ New Project]      │     │   • [+ Add Page]       │  │ • [Drive]   │ │
│  │ • [Rename] / [Delete]  │     │   • [Rename] / [Delete]│  └─────────────┘ │
│  └────────────────────────┘     └────────────────────────┘                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Workspace Store Hook                             │
│                                                                             │
│  State:                                                                     │
│  • projects: [ { id, name, pages: [ { id, name, objects, viewport } ] } ]   │
│  • activeProjectId, activePageId                                            │
│                                                                             │
│  Actions:                                                                   │
│  • createProject(name) / renameProject(id, name) / deleteProject(id)        │
│  • createPage(projectId, name) / renamePage(projectId, pageId, name)        │
│  • switchPage(projectId, pageId)                                            │
│  • updatePageObjects(objects) / updatePageViewport(viewport)                │
└──────────────┬──────────────────────────────────────────────┬───────────────┘
               │                                              │
               ▼                                              ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│     Client Local Storage     │              │     Google Drive Service     │
│  • Key: whiteboard_workspace │              │  • Upload workspace backup   │
│  • Debounced instant write   │              │  • Restore from Drive file   │
│  • Instant reload restore    │              │  • Auto-save backup toggle   │
└──────────────────────────────┘              └──────────────────────────────┘
```

### Data Model & State

```typescript
export interface BoardPage {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  objects: BoardObject[];
  viewport: {
    panX: number;
    panY: number;
    zoom: number;
  };
}

export interface BoardProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  activePageId: string;
  pages: BoardPage[];
}

export interface WorkspaceState {
  version: number;
  activeProjectId: string;
  projects: BoardProject[];
}
```

### Interactive Component & State Mapping

1. **TopBar Project Menu**:
   - Displays current project name with chevron.
   - Clicking opens popover menu listing all existing projects with checkmark next to active.
   - Includes `Rename` button that activates inline input with instant validation.
   - Includes `+ New Project` button that opens a prompt or quick-create dialog, defaulting to a new project with a single clean blank page.
2. **TopBar Page Selector**:
   - Displays current page title with page icon and rename pencil.
   - Allows quick inline renaming directly by clicking pencil or double clicking the label.
   - Dropdown displays all pages in the current project.
   - `+ New Page` button appends a clean page (`Page 2`, `Page 3`, etc.) with `objects: []` and switches active canvas to it immediately.
3. **Dual Persistence Handlers**:
   - Any mutation (drawing strokes, moving objects, adding stickies, renaming pages) triggers local storage serialization within 400ms debounce.
   - App initialization checks `localStorage.getItem('whiteboard_workspace_state')`. If present, it loads all user projects and pages seamlessly.
   - Google Drive sync button uploads the current workspace snapshot to the user's `Whiteboard Backups` folder on Google Drive and offers 1-click restore.
4. **Clean Reset Protection**:
   - Server or client templates will ONLY populate if local storage is completely empty on very first install, ensuring user content is never overwritten with default shapes.
