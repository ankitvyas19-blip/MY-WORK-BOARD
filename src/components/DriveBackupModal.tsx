import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  RotateCcw,
  Trash2,
  HardDrive,
  Clock,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { DriveBackupItem, DriveQuotaInfo } from '../types/board';
import {
  formatBytes,
  listBoardBackups,
  loadBoardBackup,
} from '../services/driveService';

interface DriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  boardTitle: string;
  isSignedIn: boolean;
  quotaInfo: DriveQuotaInfo | null;
  lastAutosaveTime: number | null;
  isAutosaving: boolean;
  autosaveEnabled: boolean;
  onToggleAutosave: () => void;
  onManualBackup: () => void;
  onRestoreBackup: (backupState: { title: string; objects: any[] }) => void;
  onDeleteBackupFile: (fileId: string, fileName: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSyncFromCloudNow?: () => Promise<void> | void;
  onExportWorkspaceBackup?: () => void;
}

export const DriveBackupModal: React.FC<DriveBackupModalProps> = ({
  isOpen,
  onClose,
  roomId,
  boardTitle,
  isSignedIn,
  quotaInfo,
  lastAutosaveTime,
  isAutosaving,
  autosaveEnabled,
  onToggleAutosave,
  onManualBackup,
  onRestoreBackup,
  onDeleteBackupFile,
  onSignOut,
  onSyncFromCloudNow,
  onExportWorkspaceBackup,
}) => {
  const [backups, setBackups] = useState<DriveBackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncDoneMessage, setSyncDoneMessage] = useState(false);

  useEffect(() => {
    if (isOpen && isSignedIn) {
      loadBackupsList();
    }
  }, [isOpen, isSignedIn, roomId]);

  const loadBackupsList = async () => {
    setLoadingBackups(true);
    try {
      const list = await listBoardBackups(roomId);
      setBackups(list);
    } catch (e) {
      console.error('Failed to list backups:', e);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleRestore = async (backup: DriveBackupItem) => {
    setRestoringId(backup.id);
    try {
      const data = await loadBoardBackup(backup.id);
      onRestoreBackup({
        title: data.title,
        objects: data.objects,
      });
      onClose();
    } catch (e) {
      console.error('Failed to restore backup:', e);
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  const usageBytes = quotaInfo?.usage ? parseInt(quotaInfo.usage, 10) : 0;
  const limitBytes = quotaInfo?.limit ? parseInt(quotaInfo.limit, 10) : 0;
  const percentUsed =
    limitBytes > 0 ? Math.min(100, Math.round((usageBytes / limitBytes) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Permanent Cloud Storage & Desktop ↔ Phone Sync
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatic 24/7 Cloud Sync — No Google Sign-In or Manual Restore Required
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Built-In Permanent Cloud Storage Active Card */}
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-950">
                  Built-In Cloud Storage & Cross-Device Sync (Active)
                </span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white rounded-full">
                No Login Required
              </span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Every project, page, text box, arrow connector, sticky note, and photo you create on your{' '}
              <strong>Desktop</strong> or <strong>Phone</strong> is automatically saved to your built-in{' '}
              <strong>Permanent Cloud Storage</strong> and merged item-by-item across all your devices. You{' '}
              <strong>do not</strong> need to sign in to Google Drive or manually restore backups.
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  if (!onSyncFromCloudNow) return;
                  setSyncingNow(true);
                  setSyncDoneMessage(false);
                  try {
                    await onSyncFromCloudNow();
                    setSyncDoneMessage(true);
                    setTimeout(() => setSyncDoneMessage(false), 3000);
                  } finally {
                    setSyncingNow(false);
                  }
                }}
                disabled={syncingNow}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingNow ? 'animate-spin' : ''}`} />
                <span>
                  {syncingNow
                    ? 'Syncing Cloud...'
                    : syncDoneMessage
                    ? 'Synced Desktop & Phone!'
                    : 'Sync Desktop & Phone Now'}
                </span>
              </button>

              {onExportWorkspaceBackup && (
                <button
                  type="button"
                  onClick={onExportWorkspaceBackup}
                  className="px-3 py-2 bg-white hover:bg-emerald-100/70 text-emerald-900 border border-emerald-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Download Backup Copy (.json)</span>
                </button>
              )}
            </div>
          </div>

          {/* Account & 5 TB Quota Overview (Only shown if signed in) */}
          {isSignedIn ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {quotaInfo?.photoLink ? (
                    <img
                      src={quotaInfo.photoLink}
                      alt={quotaInfo.displayName || 'Google User'}
                      className="w-8 h-8 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      {quotaInfo?.displayName?.[0] || 'G'}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {quotaInfo?.displayName || 'Connected Account'}
                    </div>
                    <div className="text-[11px] text-slate-500">{quotaInfo?.userEmail}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>

              {/* Storage Capacity Bar */}
              <div className="pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Google Drive Storage</span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {formatBytes(quotaInfo?.usage)} of{' '}
                    {limitBytes > 0 ? formatBytes(quotaInfo?.limit) : '5 TB (Workspace)'} used
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${Math.max(2, percentUsed)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Continuous Autosave Protection Status */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Automatic Crash, Phone Lock & Power-Off Protection
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Always ON
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your whiteboard state is continuously saved to your browser&apos;s IndexedDB, LocalStorage, and Permanent Cloud Storage. If your phone switches off or your laptop browser closes, all projects, pages, text, connectors, and attached photos are automatically restored the moment you open the app.
            </p>
          </div>

          {/* Cloud Version History & Revisions */}
          {isSignedIn && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Cloud Revisions in Google Drive</span>
                <button
                  type="button"
                  onClick={loadBackupsList}
                  className="text-indigo-600 hover:underline flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh List</span>
                </button>
              </div>

              {loadingBackups ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Loading revisions from Google Drive...
                </div>
              ) : backups.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No cloud backup files found in CanvasJam folder. Click &ldquo;Backup Now&rdquo; above to create one.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {backups.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-between transition-colors text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate max-w-xs">
                          {b.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          {new Date(b.modifiedTime).toLocaleString()} · {formatBytes(b.size)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestore(b)}
                          disabled={restoringId === b.id}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 font-medium rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="Restore this revision to canvas"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{restoringId === b.id ? 'Restoring...' : 'Restore'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteBackupFile(b.id, b.name)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete cloud backup file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Files are stored in the &ldquo;CanvasJam&rdquo; folder in your Google Drive.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
