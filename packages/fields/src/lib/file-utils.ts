import type { AttachmentAnswer, FileInput } from '@esheet/core';

// ---------------------------------------------------------------------------
// Shared file/attachment helpers used by FileField.
// ---------------------------------------------------------------------------

/** Human-readable file size (e.g. `1.5 MB`). */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/** Match a file against an `accept` string (MIME types, wildcards, extensions). */
export const fileMatchesAccept = (file: File, accept?: string): boolean => {
  if (!accept) return true;
  const parts = accept.split(',').map((s) => s.trim());
  if (parts.length === 0) return true;
  return parts.some((part) => {
    if (part.startsWith('.'))
      return file.name.toLowerCase().endsWith(part.toLowerCase());
    if (part.endsWith('/*')) return file.type.startsWith(part.slice(0, -1));
    return file.type === part;
  });
};

export interface FileMetadata {
  readonly contentType: string;
  readonly title: string;
  readonly size: number;
}

/** Normalize metadata shared by inline attachments and external file stores. */
export const getFileMetadata = (file: File): FileMetadata => ({
  contentType: file.type || 'application/octet-stream',
  title: file.name,
  size: file.size,
});

export const fileToInput = (file: File): FileInput => ({
  content: file,
  ...getFileMetadata(file),
});

/** Read a File into the AttachmentAnswer shape (dataUrl-based). */
export const readFileAsAttachment = (file: File): Promise<AttachmentAnswer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        ...getFileMetadata(file),
        dataUrl: reader.result as string,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Image types every browser can draw onto a canvas. */
export const DRAWABLE_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
] as const;

export const DRAWABLE_IMAGE_ACCEPT = DRAWABLE_IMAGE_TYPES.join(',');

/**
 * Image formats a host may offer from its own documents for a sketch field.
 * TIFF, PDF and DICOM are not drawable by browsers, so the host's `fetch` must
 * return a drawable image (e.g. a PNG of the first page) for those.
 */
export const IMAGE_SOURCE_ACCEPT = [
  ...DRAWABLE_IMAGE_TYPES,
  'image/tiff',
  'application/pdf',
  'application/dicom',
].join(',');

/**
 * Read an image Blob into a data URL, shrinking it so its longest edge is at
 * most `maxEdge` px. Large originals (e.g. scanned x-rays) would otherwise bloat
 * the stored response far beyond what the drawing canvas can display.
 */
export const readImageAsDataUrl = (
  blob: Blob,
  maxEdge = 1600
): Promise<string> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Image could not be processed'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected file is not a readable image'));
    };
    image.src = objectUrl;
  });
