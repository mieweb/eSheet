import type { AttachmentAnswer } from '@esheet/core';

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

/** Read a File into the AttachmentAnswer shape (dataUrl-based). */
export const readFileAsAttachment = (file: File): Promise<AttachmentAnswer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        contentType: file.type || 'application/octet-stream',
        dataUrl: reader.result as string,
        title: file.name,
        size: file.size,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
