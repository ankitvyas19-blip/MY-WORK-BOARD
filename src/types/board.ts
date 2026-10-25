export type BoardColorKey =
  | 'yellow'
  | 'orange'
  | 'rose'
  | 'violet'
  | 'blue'
  | 'teal'
  | 'emerald'
  | 'slate';

export type ToolType =
  | 'select'
  | 'hand'
  | 'sticky'
  | 'shape'
  | 'connector'
  | 'pen'
  | 'text'
  | 'section'
  | 'stamp'
  | 'attachment'
  | 'eraser';

export type ShapeKind = 'rect' | 'pill' | 'diamond' | 'circle' | 'cylinder';
export type StampKind = 'thumbsup' | 'heart' | 'fire' | 'star' | 'question' | 'check';
export type AnchorPort = 'top' | 'right' | 'bottom' | 'left';
export type FontStyleType = 'sans' | 'hand' | 'mono';
export type AttachmentKind = 'image' | 'pdf' | 'excel' | 'powerpoint' | 'file';

export interface Point {
  x: number;
  y: number;
}

export interface BaseBoardObject {
  id: string;
  type: 'sticky' | 'shape' | 'section' | 'text' | 'connector' | 'path' | 'stamp' | 'attachment';
  zIndex: number;
  locked?: boolean;
  updatedAt: number;
}

export interface StickyNoteObject extends BaseBoardObject {
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: BoardColorKey;
  authorName: string;
  authorColor: string;
  votes: string[];
  fontStyle: FontStyleType;
  fontSize: 'sm' | 'md' | 'lg';
}

export interface ShapeObject extends BaseBoardObject {
  type: 'shape';
  shapeKind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: BoardColorKey;
  fillStyle: 'solid' | 'tinted' | 'outline';
  fontStyle: FontStyleType;
}

export interface SectionObject extends BaseBoardObject {
  type: 'section';
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  color: BoardColorKey;
}

export interface TextObject extends BaseBoardObject {
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: BoardColorKey;
  fontStyle: FontStyleType;
  fontSize: 'sm' | 'md' | 'lg' | 'xl';
}

export interface ConnectorObject extends BaseBoardObject {
  type: 'connector';
  fromId: string | null;
  fromPort: AnchorPort;
  fromPoint: Point;
  toId: string | null;
  toPort: AnchorPort;
  toPoint: Point;
  label: string;
  color: BoardColorKey;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  curveStyle: 'curved' | 'straight' | 'elbow';
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

export interface PathObject extends BaseBoardObject {
  type: 'path';
  points: Point[];
  color: BoardColorKey;
  strokeWidth: number;
  isHighlighter?: boolean;
}

export interface StampObject extends BaseBoardObject {
  type: 'stamp';
  stampKind: StampKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  authorName: string;
  authorColor: string;
}

export interface AttachmentObject extends BaseBoardObject {
  type: 'attachment';
  x: number;
  y: number;
  width: number;
  height: number;
  attachmentKind: AttachmentKind;
  fileName: string;
  fileSize: number;
  mimeType: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveThumbnailLink?: string;
  dataUrl?: string; // Inline preview
  textContent?: string; // Optional text/CSV content for table preview
  caption?: string;
  authorName: string;
  authorColor: string;
}

export type BoardObject =
  | StickyNoteObject
  | ShapeObject
  | SectionObject
  | TextObject
  | ConnectorObject
  | PathObject
  | StampObject
  | AttachmentObject;

export interface CollaboratorPresence {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  cursorChat?: string;
  cursorChatUpdatedAt?: number;
  highFiveActive?: boolean;
  activeTool: ToolType;
  selectedIds: string[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  lastSeen: number;
}

export interface RoomTimerState {
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  startedAt: number | null;
}

export interface ActivityItem {
  id: string;
  userName: string;
  userColor: string;
  action: string;
  timestamp: number;
}

export interface FloatingReaction {
  id: string;
  emoji: StampKind;
  x: number;
  y: number;
  userName: string;
  userColor: string;
  createdAt: number;
}

export interface BoardPage {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  objects: BoardObject[];
  viewport?: {
    x: number;
    y: number;
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

export interface RoomStatePayload {
  roomId: string;
  title: string;
  objects: BoardObject[];
  users: CollaboratorPresence[];
  timer: RoomTimerState;
  activities: ActivityItem[];
}

export interface DriveQuotaInfo {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  userEmail?: string;
  displayName?: string;
  photoLink?: string;
}

export interface DriveBackupItem {
  id: string;
  name: string;
  modifiedTime: string;
  size: string;
  webViewLink?: string;
  itemCount?: number;
}

export const BOARD_PALETTE: Record<
  BoardColorKey,
  {
    label: string;
    stickyBg: string;
    stickyBorder: string;
    stickyShadow: string;
    shapeFill: string;
    shapeTinted: string;
    shapeStroke: string;
    sectionBg: string;
    sectionBorder: string;
    sectionHeaderBg: string;
    textHex: string;
    strokeHex: string;
    swatchHex: string;
  }
> = {
  yellow: {
    label: 'Warm Sun',
    stickyBg: '#FFF3A8',
    stickyBorder: '#F2DC6D',
    stickyShadow: 'rgba(180, 145, 25, 0.16)',
    shapeFill: '#FACC15',
    shapeTinted: '#FEF9C3',
    shapeStroke: '#CA8A04',
    sectionBg: 'rgba(254, 249, 195, 0.35)',
    sectionBorder: '#EAB308',
    sectionHeaderBg: '#FEF08A',
    textHex: '#854D0E',
    strokeHex: '#EAB308',
    swatchHex: '#FACC15',
  },
  orange: {
    label: 'Tangerine',
    stickyBg: '#FFD8B5',
    stickyBorder: '#F7B983',
    stickyShadow: 'rgba(194, 95, 25, 0.16)',
    shapeFill: '#FB923C',
    shapeTinted: '#FFEDD5',
    shapeStroke: '#EA580C',
    sectionBg: 'rgba(255, 237, 213, 0.38)',
    sectionBorder: '#F97316',
    sectionHeaderBg: '#FED7AA',
    textHex: '#9A3412',
    strokeHex: '#EA580C',
    swatchHex: '#FB923C',
  },
  rose: {
    label: 'Coral Rose',
    stickyBg: '#FFC9D9',
    stickyBorder: '#F49FB8',
    stickyShadow: 'rgba(190, 55, 100, 0.15)',
    shapeFill: '#F43F5E',
    shapeTinted: '#FFE4E6',
    shapeStroke: '#E11D48',
    sectionBg: 'rgba(255, 228, 230, 0.38)',
    sectionBorder: '#F43F5E',
    sectionHeaderBg: '#FECDD3',
    textHex: '#9F1239',
    strokeHex: '#E11D48',
    swatchHex: '#FB7185',
  },
  violet: {
    label: 'Fig Violet',
    stickyBg: '#E4D4FF',
    stickyBorder: '#C7AEF7',
    stickyShadow: 'rgba(109, 60, 200, 0.15)',
    shapeFill: '#8B5CF6',
    shapeTinted: '#F3E8FF',
    shapeStroke: '#7C3AED',
    sectionBg: 'rgba(243, 232, 255, 0.38)',
    sectionBorder: '#8B5CF6',
    sectionHeaderBg: '#E9D5FF',
    textHex: '#5B21B6',
    strokeHex: '#7C3AED',
    swatchHex: '#A78BFA',
  },
  blue: {
    label: 'Cobalt Sky',
    stickyBg: '#C8E4FF',
    stickyBorder: '#97C8FA',
    stickyShadow: 'rgba(37, 99, 235, 0.15)',
    shapeFill: '#3B82F6',
    shapeTinted: '#DBEAFE',
    shapeStroke: '#2563EB',
    sectionBg: 'rgba(219, 234, 254, 0.38)',
    sectionBorder: '#3B82F6',
    sectionHeaderBg: '#BFDBFE',
    textHex: '#1E40AF',
    strokeHex: '#2563EB',
    swatchHex: '#60A5FA',
  },
  teal: {
    label: 'Lagoon Teal',
    stickyBg: '#BCEEED',
    stickyBorder: '#88DBD9',
    stickyShadow: 'rgba(13, 148, 136, 0.15)',
    shapeFill: '#14B8A6',
    shapeTinted: '#CCFBF1',
    shapeStroke: '#0D9488',
    sectionBg: 'rgba(204, 251, 241, 0.38)',
    sectionBorder: '#14B8A6',
    sectionHeaderBg: '#99F6E4',
    textHex: '#115E59',
    strokeHex: '#0D9488',
    swatchHex: '#2DD4BF',
  },
  emerald: {
    label: 'Mint Leaf',
    stickyBg: '#C6F4D6',
    stickyBorder: '#93E2AF',
    stickyShadow: 'rgba(22, 163, 74, 0.15)',
    shapeFill: '#22C55E',
    shapeTinted: '#DCFCE7',
    shapeStroke: '#16A34A',
    sectionBg: 'rgba(220, 252, 231, 0.38)',
    sectionBorder: '#22C55E',
    sectionHeaderBg: '#BBF7D0',
    textHex: '#166534',
    strokeHex: '#16A34A',
    swatchHex: '#4ADE80',
  },
  slate: {
    label: 'Graphite Ink',
    stickyBg: '#E2E8F0',
    stickyBorder: '#CBD5E1',
    stickyShadow: 'rgba(30, 41, 59, 0.14)',
    shapeFill: '#334155',
    shapeTinted: '#F1F5F9',
    shapeStroke: '#1E293B',
    sectionBg: 'rgba(241, 245, 249, 0.55)',
    sectionBorder: '#64748B',
    sectionHeaderBg: '#E2E8F0',
    textHex: '#0F172A',
    strokeHex: '#1E293B',
    swatchHex: '#475569',
  },
};
