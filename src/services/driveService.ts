import { BoardObject, DriveBackupItem, DriveQuotaInfo, WorkspaceState } from '../types/board';
import { getAccessToken } from './firebaseAuth';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

// Cache folder IDs to reduce API calls
let cachedRootFolderId: string | null = null;
let cachedAttachmentsFolderId: string | null = null;
let cachedBackupsFolderId: string | null = null;

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Drive. Please sign in with Google first.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Google Drive API error (${res.status}):`, errorText);
    throw new Error(`Google Drive API error (${res.status}): ${res.statusText || errorText}`);
  }

  return res;
}

export async function getDriveStorageQuota(): Promise<DriveQuotaInfo> {
  const res = await fetchWithAuth(
    `${DRIVE_API_URL}/about?fields=storageQuota,user(displayName,emailAddress,photoLink)`
  );
  const data = await res.json();
  return {
    limit: data.storageQuota?.limit,
    usage: data.storageQuota?.usage,
    usageInDrive: data.storageQuota?.usageInDrive,
    userEmail: data.user?.emailAddress,
    displayName: data.user?.displayName,
    photoLink: data.user?.photoLink,
  };
}

export async function getOrCreateFolder(
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(
    /'/g,
    "\\'"
  )}' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchRes = await fetchWithAuth(
    `${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetchWithAuth(`${DRIVE_API_URL}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : undefined,
    }),
  });

  const createData = await createRes.json();
  return createData.id;
}

export async function getAppFolderStructure(): Promise<{
  rootId: string;
  attachmentsId: string;
  backupsId: string;
}> {
  if (cachedRootFolderId && cachedAttachmentsFolderId && cachedBackupsFolderId) {
    return {
      rootId: cachedRootFolderId,
      attachmentsId: cachedAttachmentsFolderId,
      backupsId: cachedBackupsFolderId,
    };
  }

  const rootId = await getOrCreateFolder('CanvasJam');
  cachedRootFolderId = rootId;

  const [attachmentsId, backupsId] = await Promise.all([
    getOrCreateFolder('Attachments', rootId),
    getOrCreateFolder('Backups', rootId),
  ]);

  cachedAttachmentsFolderId = attachmentsId;
  cachedBackupsFolderId = backupsId;

  return { rootId, attachmentsId, backupsId };
}

export async function uploadAttachmentToDrive(
  file: File | Blob,
  fileName: string,
  mimeType: string
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink?: string;
  thumbnailLink?: string;
}> {
  const { attachmentsId } = await getAppFolderStructure();

  const metadata = {
    name: fileName,
    mimeType,
    parents: [attachmentsId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;

  const fileBytes = new Uint8Array(await file.arrayBuffer());

  const preamble = new TextEncoder().encode(
    `${metadataPart}${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`
  );
  const postamble = new TextEncoder().encode(closeDelimiter);

  const fullPayload = new Uint8Array(
    preamble.length + fileBytes.length + postamble.length
  );
  fullPayload.set(preamble, 0);
  fullPayload.set(fileBytes, preamble.length);
  fullPayload.set(postamble, preamble.length + fileBytes.length);

  const res = await fetchWithAuth(
    `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,thumbnailLink`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  );

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    size: parseInt(data.size || '0', 10),
    webViewLink: data.webViewLink,
    thumbnailLink: data.thumbnailLink,
  };
}

export async function saveBoardBackupToDrive(
  roomId: string,
  boardTitle: string,
  objects: BoardObject[]
): Promise<{ id: string; savedAt: number }> {
  const { backupsId } = await getAppFolderStructure();
  const backupFileName = `CanvasJam_${roomId}_Autosave.json`;
  const savedAt = Date.now();

  const payload = JSON.stringify(
    {
      app: 'CanvasJam',
      version: '1.0',
      roomId,
      title: boardTitle,
      savedAt,
      itemCount: objects.length,
      objects,
    },
    null,
    2
  );

  // Check if an autosave file already exists for this room
  const query = `name = '${backupFileName.replace(
    /'/g,
    "\\'"
  )}' and '${backupsId}' in parents and trashed = false`;
  const searchRes = await fetchWithAuth(
    `${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    const existingFileId = searchData.files[0].id;
    // Update existing file content directly
    await fetchWithAuth(
      `${DRIVE_UPLOAD_URL}/files/${existingFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
      }
    );
    return { id: existingFileId, savedAt };
  }

  // Create new backup file
  const metadata = {
    name: backupFileName,
    mimeType: 'application/json',
    parents: [backupsId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}` +
    `${delimiter}Content-Type: application/json\r\n\r\n${payload}${closeDelimiter}`;

  const res = await fetchWithAuth(
    `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const data = await res.json();
  return { id: data.id, savedAt };
}

export async function listBoardBackups(roomId?: string): Promise<DriveBackupItem[]> {
  const { backupsId } = await getAppFolderStructure();

  let query = `'${backupsId}' in parents and trashed = false`;
  if (roomId) {
    query += ` and name contains '${roomId}'`;
  }

  const res = await fetchWithAuth(
    `${DRIVE_API_URL}/files?q=${encodeURIComponent(
      query
    )}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size,webViewLink)`
  );

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    size: f.size || '0',
    webViewLink: f.webViewLink,
  }));
}

export async function loadBoardBackup(
  fileId: string
): Promise<{ roomId: string; title: string; objects: BoardObject[]; savedAt: number }> {
  const res = await fetchWithAuth(`${DRIVE_API_URL}/files/${fileId}?alt=media`);
  const data = await res.json();
  return {
    roomId: data.roomId || 'product-strategy',
    title: data.title || 'Restored Board',
    objects: data.objects || [],
    savedAt: data.savedAt || Date.now(),
  };
}

export async function saveWorkspaceBackupToDrive(
  workspace: WorkspaceState
): Promise<{ id: string; savedAt: number }> {
  const { backupsId } = await getAppFolderStructure();
  const backupFileName = 'CanvasJam_Full_Workspace.json';
  const savedAt = Date.now();

  const totalPages = workspace.projects.reduce((acc, p) => acc + p.pages.length, 0);
  const totalObjects = workspace.projects.reduce(
    (acc, p) => acc + p.pages.reduce((oAcc, pg) => oAcc + pg.objects.length, 0),
    0
  );

  const payload = JSON.stringify(
    {
      app: 'CanvasJam',
      type: 'full_workspace',
      version: '2.0',
      savedAt,
      projectCount: workspace.projects.length,
      pageCount: totalPages,
      itemCount: totalObjects,
      workspace,
    },
    null,
    2
  );

  // Check if an existing workspace backup file exists
  const query = `name = '${backupFileName}' and '${backupsId}' in parents and trashed = false`;
  const searchRes = await fetchWithAuth(
    `${DRIVE_API_URL}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    const existingFileId = searchData.files[0].id;
    await fetchWithAuth(
      `${DRIVE_UPLOAD_URL}/files/${existingFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload,
      }
    );
    return { id: existingFileId, savedAt };
  }

  const metadata = {
    name: backupFileName,
    mimeType: 'application/json',
    parents: [backupsId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}` +
    `${delimiter}Content-Type: application/json\r\n\r\n${payload}${closeDelimiter}`;

  const res = await fetchWithAuth(
    `${DRIVE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const data = await res.json();
  return { id: data.id, savedAt };
}

export async function loadWorkspaceBackupFromDrive(
  fileId: string
): Promise<WorkspaceState | null> {
  const res = await fetchWithAuth(`${DRIVE_API_URL}/files/${fileId}?alt=media`);
  const data = await res.json();
  if (data.workspace && Array.isArray(data.workspace.projects)) {
    return data.workspace as WorkspaceState;
  }
  return null;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  await fetchWithAuth(`${DRIVE_API_URL}/files/${fileId}`, {
    method: 'DELETE',
  });
}

export function formatBytes(bytes: number | string | undefined): string {
  if (!bytes) return '0 B';
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
