import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Trash2,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  File,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eye,
  Check,
  Cloud,
} from 'lucide-react';
import { AttachmentObject } from '../types/board';
import { formatBytes } from '../services/driveService';

interface FilePreviewModalProps {
  attachment: AttachmentObject | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (attachment: AttachmentObject) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  attachment,
  isOpen,
  onClose,
  onDelete,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'preview' | 'details'>('preview');

  // Detect mobile devices (touch screen, mobile user agent, or narrow viewport)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
    const isSmallScreen = window.innerWidth < 768;
    const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    return isMobileUa || (isTouch && isSmallScreen);
  });

  useEffect(() => {
    const checkMobile = () => {
      const ua = navigator.userAgent || '';
      const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
      const isSmallScreen = window.innerWidth < 768;
      const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
      setIsMobile(isMobileUa || (isTouch && isSmallScreen));
    };

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Touch gesture state for pinch-to-zoom in preview
  const previewTouchRef = useRef<{
    initialDist: number;
    initialZoom: number;
  }>({ initialDist: 0, initialZoom: 1 });

  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      previewTouchRef.current = {
        initialDist: dist,
        initialZoom: zoomLevel,
      };
    }
  };

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && previewTouchRef.current.initialDist > 0) {
      if (e.cancelable) e.preventDefault();
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      const scale = dist / previewTouchRef.current.initialDist;
      setZoomLevel(
        Math.min(4, Math.max(0.25, Math.round(previewTouchRef.current.initialZoom * scale * 100) / 100))
      );
    }
  };

  const handlePreviewTouchEnd = () => {
    previewTouchRef.current = { initialDist: 0, initialZoom: 1 };
  };

  if (!isOpen || !attachment) return null;

  const getFileIcon = (kind: string) => {
    switch (kind) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-indigo-500" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-500" />;
      case 'excel':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
      case 'powerpoint':
        return <Presentation className="w-5 h-5 text-orange-500" />;
      default:
        return <File className="w-5 h-5 text-slate-500" />;
    }
  };

  const getBadgeColor = (kind: string) => {
    switch (kind) {
      case 'image':
        return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      case 'pdf':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'excel':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'powerpoint':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  const handleDownload = () => {
    if (attachment.dataUrl) {
      const a = document.createElement('a');
      a.href = attachment.dataUrl;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (attachment.driveWebViewLink) {
      window.open(attachment.driveWebViewLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenDirectPdf = () => {
    if (attachment.driveWebViewLink) {
      window.open(attachment.driveWebViewLink, '_blank', 'noopener,noreferrer');
      return;
    }
    if (attachment.dataUrl) {
      try {
        // Convert base64 dataUrl to blob URL for mobile viewer
        const parts = attachment.dataUrl.split(';base64,');
        const contentType = parts[0].split(':')[1] || 'application/pdf';
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch {
        handleDownload();
      }
    }
  };

  // Render CSV / plain text table if textContent is present
  const renderSpreadsheetContent = () => {
    if (!attachment.textContent) return null;
    const lines = attachment.textContent.trim().split('\n').slice(0, 100);
    const rows = lines.map((line) => {
      // Split by comma or tab
      return line.includes('\t') ? line.split('\t') : line.split(',');
    });

    return (
      <div className="w-full overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs max-h-[520px]">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            {rows[0] && (
              <tr className="bg-slate-100/80 border-b border-slate-200 font-semibold text-slate-700">
                <th className="p-2 border-r border-slate-200 text-slate-400 font-mono text-[10px] w-10 text-center">
                  #
                </th>
                {rows[0].map((cell, colIdx) => (
                  <th key={colIdx} className="p-2.5 border-r border-slate-200 font-medium">
                    {cell.trim().replace(/^["']|["']$/g, '')}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.slice(1).map((row, rIdx) => (
              <tr
                key={rIdx}
                className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
              >
                <td className="p-2 border-r border-slate-200 text-slate-400 font-mono text-[10px] text-center bg-slate-50/50">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2 border-r border-slate-100 font-mono tabular-nums text-slate-800">
                    {cell.trim().replace(/^["']|["']$/g, '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {lines.length >= 100 && (
          <div className="p-2 text-center text-[11px] text-slate-400 border-t border-slate-100">
            Preview limited to first 100 rows. Open in Google Drive or Excel for full dataset.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs shrink-0">
              {getFileIcon(attachment.attachmentKind)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                  {attachment.fileName}
                </h2>
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border shrink-0 ${getBadgeColor(
                    attachment.attachmentKind
                  )}`}
                >
                  {attachment.attachmentKind}
                </span>
                {attachment.driveFileId && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
                    <Cloud className="w-3 h-3" />
                    <span>Hosted on Google Drive</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {formatBytes(attachment.fileSize)} · Added by {attachment.authorName} · Read-only Review
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {attachment.driveWebViewLink && (
              <a
                href={attachment.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in Drive</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={() => onDelete(attachment)}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Delete attachment"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close review (without saving)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 min-h-0 bg-slate-100/60 p-4 sm:p-6 flex items-center justify-center overflow-auto relative">
          {/* Image / Screenshot Viewer */}
          {attachment.attachmentKind === 'image' && attachment.dataUrl && (
            <div
              onTouchStart={handlePreviewTouchStart}
              onTouchMove={handlePreviewTouchMove}
              onTouchEnd={handlePreviewTouchEnd}
              onTouchCancel={handlePreviewTouchEnd}
              className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden touch-none"
            >
              <div
                className="max-w-full max-h-full overflow-auto flex items-center justify-center p-4"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                }}
              >
                <img
                  src={attachment.dataUrl}
                  alt={attachment.fileName}
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                  className="max-h-[64vh] max-w-[85vw] object-contain rounded-lg shadow-md transition-transform duration-150"
                />
              </div>

              {/* Floating Image Zoom Bar */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full px-3 py-1 shadow-md flex items-center gap-2 text-xs font-mono tabular-nums text-slate-700">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer ml-1"
                  title="Reset Zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* PDF Viewer */}
          {attachment.attachmentKind === 'pdf' && (() => {
            const isMobileDevice =
              isMobile ||
              (typeof navigator !== 'undefined' &&
                (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
                  (typeof window !== 'undefined' && window.innerWidth < 768)));

            // Mobile browsers: replace inline PDF viewer with prominent 'Open Full PDF' button linking to Google Drive preview URL
            if (isMobileDevice) {
              const drivePreviewUrl = attachment.driveWebViewLink
                ? (attachment.driveWebViewLink.includes('/view')
                    ? attachment.driveWebViewLink.replace('/view', '/preview')
                    : attachment.driveWebViewLink)
                : (attachment.id ? `https://drive.google.com/file/d/${attachment.id}/preview` : '');

              return (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shadow-xs">
                    <FileText className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 break-words">{attachment.fileName}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF Document {attachment.fileSize ? `(${formatBytes(attachment.fileSize)})` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    Mobile browsers restrict inline PDF embedding. Tap below to view the entire document in full resolution with complete navigation and pinch-to-zoom.
                  </p>
                  <div className="flex flex-col gap-2.5 w-full pt-1">
                    {drivePreviewUrl ? (
                      <a
                        href={drivePreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg hover:shadow-indigo-500/25"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open Full PDF</span>
                      </a>
                    ) : attachment.dataUrl ? (
                      <button
                        type="button"
                        onClick={handleOpenDirectPdf}
                        className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg hover:shadow-indigo-500/25"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open Full PDF</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg hover:shadow-indigo-500/25"
                      >
                        <Download className="w-4 h-4" />
                        <span>Open Full PDF</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF File</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Desktop: If hosted on Google Drive, use responsive iframe preview with toolbar
            if (attachment.driveWebViewLink) {
              const drivePreviewUrl = attachment.driveWebViewLink.replace('/view', '/preview');
              return (
                <div className="w-full h-full flex flex-col items-center justify-between gap-3">
                  {/* Action Banner */}
                  <div className="w-full bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Cloud className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-xs text-indigo-900 font-medium truncate">
                        Google Drive PDF Viewer
                      </span>
                    </div>
                    <a
                      href={attachment.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Full PDF in Drive</span>
                    </a>
                  </div>

                  {/* Responsive Google Drive Embed */}
                  <div className="flex-1 w-full min-h-0 rounded-xl overflow-hidden border border-slate-200 shadow-md bg-white relative">
                    <iframe
                      src={drivePreviewUrl}
                      className="w-full h-full border-0"
                      title={attachment.fileName}
                      allow="autoplay"
                    />
                  </div>
                </div>
              );
            }

            // Desktop fallback: inline object
            return (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {attachment.dataUrl ? (
                  <object
                    data={attachment.dataUrl}
                    type="application/pdf"
                    className="w-full h-full rounded-xl border border-slate-200 shadow-md bg-white"
                  >
                    <div className="text-center p-8 space-y-3">
                      <p className="text-sm text-slate-600">
                        Your browser cannot display this PDF directly in the frame.
                      </p>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium cursor-pointer"
                      >
                        Download PDF to View
                      </button>
                    </div>
                  </object>
                ) : (
                  <div className="text-center p-8 space-y-2">
                    <FileText className="w-12 h-12 text-rose-500 mx-auto" />
                    <p className="text-sm font-semibold text-slate-800">{attachment.fileName}</p>
                    <p className="text-xs text-slate-500">PDF Document ({formatBytes(attachment.fileSize)})</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Excel / Spreadsheet Viewer */}
          {attachment.attachmentKind === 'excel' && (
            <div className="w-full h-full flex flex-col items-center justify-start p-2">
              {attachment.textContent ? (
                renderSpreadsheetContent()
              ) : attachment.driveWebViewLink ? (
                <iframe
                  src={attachment.driveWebViewLink.replace('/view', '/preview')}
                  className="w-full h-full rounded-xl border border-slate-200 shadow-md bg-white"
                  title={attachment.fileName}
                />
              ) : (
                <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md">
                  <FileSpreadsheet className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-900 mb-1">{attachment.fileName}</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Excel Spreadsheet ({formatBytes(attachment.fileSize)})
                  </p>
                  {attachment.driveWebViewLink && (
                    <a
                      href={attachment.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Review in Google Drive</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PowerPoint Presentation Viewer */}
          {attachment.attachmentKind === 'powerpoint' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
              {attachment.driveWebViewLink ? (
                <iframe
                  src={attachment.driveWebViewLink.replace('/view', '/preview')}
                  className="w-full h-full rounded-xl border border-slate-200 shadow-md bg-white"
                  title={attachment.fileName}
                />
              ) : (
                <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md">
                  <Presentation className="w-14 h-14 text-orange-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-900 mb-1">{attachment.fileName}</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    PowerPoint Presentation ({formatBytes(attachment.fileSize)})
                  </p>
                  {attachment.driveWebViewLink && (
                    <a
                      href={attachment.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Review in Google Drive</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Other / Generic Document */}
          {attachment.attachmentKind === 'file' && (
            <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md">
              <File className="w-14 h-14 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">{attachment.fileName}</h3>
              <p className="text-xs text-slate-500 mb-4">
                File Attachment ({formatBytes(attachment.fileSize)})
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-indigo-500" />
            <span>Inspection mode: Review without altering or saving changes.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
