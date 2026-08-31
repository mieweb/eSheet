import React, { useCallback, useState } from 'react';
import type { FieldComponentProps, FileFieldDefinition } from '@esheet/core';
import { TrashIcon, UploadIcon } from '../../icons.js';
import {
  fileToInput,
  formatFileSize,
  fileMatchesAccept,
  readFileAsAttachment,
} from '../../lib/file-utils.js';
import {
  removeUnreferencedFiles,
  storeFiles,
  useFileStore,
} from '../../lib/FileStoreProvider.js';

const PREDEFINED_FILE_TYPES = [
  { label: 'JPEG', value: 'image/jpeg', accept: '.jpg,.jpeg' },
  { label: 'PNG', value: 'image/png', accept: '.png' },
  { label: 'GIF', value: 'image/gif', accept: '.gif' },
  { label: 'WebP', value: 'image/webp', accept: '.webp' },
  { label: 'SVG', value: 'image/svg+xml', accept: '.svg' },
  { label: 'PDF', value: 'application/pdf', accept: '.pdf' },
  { label: 'Word (.doc)', value: 'application/msword', accept: '.doc' },
  {
    label: 'Word (.docx)',
    value:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    accept: '.docx',
  },
  { label: 'Excel (.xls)', value: 'application/vnd.ms-excel', accept: '.xls' },
  {
    label: 'Excel (.xlsx)',
    value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    accept: '.xlsx',
  },
  { label: 'CSV', value: 'text/csv', accept: '.csv' },
  { label: 'Text', value: 'text/plain', accept: '.txt' },
  { label: 'JSON', value: 'application/json', accept: '.json' },
  { label: 'YAML', value: 'application/yaml', accept: '.yaml,.yml' },
  { label: 'ZIP', value: 'application/zip', accept: '.zip' },
  { label: 'MP4', value: 'video/mp4', accept: '.mp4' },
  { label: 'WebM', value: 'video/webm', accept: '.webm' },
  { label: 'MP3', value: 'audio/mpeg', accept: '.mp3' },
  { label: 'WAV', value: 'audio/wav', accept: '.wav' },
] as const;

const getAcceptString = (selectedTypes: string[]): string => {
  const accepts = selectedTypes
    .map((val) => PREDEFINED_FILE_TYPES.find((ft) => ft.value === val)?.accept)
    .filter(Boolean) as string[];
  return accepts.join(',');
};

const getSelectedTypes = (acceptString?: string): string[] => {
  if (!acceptString) return [];
  const parts = new Set(acceptString.split(',').map((s) => s.trim()));
  return PREDEFINED_FILE_TYPES.filter((ft) => {
    const ftParts = ft.accept.split(',').map((s) => s.trim());
    return ftParts.some((p) => parts.has(p)) || parts.has(ft.value);
  }).map((ft) => ft.value);
};

const SIZE_UNITS = {
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
} as const;

type SizeUnit = keyof typeof SIZE_UNITS;

const getBestUnit = (bytes: number): SizeUnit => {
  if (bytes >= SIZE_UNITS.GB) return 'GB';
  if (bytes >= SIZE_UNITS.MB) return 'MB';
  return 'KB';
};

const convertBytesToUnit = (bytes: number, unit: SizeUnit): number => {
  return Math.round((bytes / SIZE_UNITS[unit]) * 100) / 100;
};

const convertUnitToBytes = (value: number, unit: SizeUnit): number => {
  return Math.round(value * SIZE_UNITS[unit]);
};

export const FileField = React.memo(function FileField({
  field,
  form,
  isPreview,
  isEnabled,
  isRequired,
  isSoftRequired,
  response,
  onUpdate,
  onResponse,
}: FieldComponentProps) {
  const def = field.definition as FileFieldDefinition & { question?: string };
  const instanceId = form.getState().instanceId;
  const maxFiles = def.maxFiles ?? 1;
  const fileStore = useFileStore();
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(
    def.maxFileSize ? getBestUnit(def.maxFileSize) : 'KB'
  );
  const [typeSearch, setTypeSearch] = useState<string>('');

  const fileDataArr = React.useMemo(() => {
    if (!response?.fileData) return [];
    return Array.isArray(response.fileData)
      ? response.fileData
      : [response.fileData];
  }, [response?.fileData]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setErrorMsg('');
      const availableSlots = maxFiles - fileDataArr.length;
      const filesToProcess = Array.from(files).slice(0, availableSlots);
      const maxFileSize = def.maxFileSize;

      // Validate file types against accept filter
      const rejectedTypes: string[] = [];
      const typeAccepted: File[] = [];

      filesToProcess.forEach((file) => {
        if (fileMatchesAccept(file, def.accept)) typeAccepted.push(file);
        else rejectedTypes.push(file.name);
      });

      if (rejectedTypes.length > 0) {
        setErrorMsg(`File type not accepted: ${rejectedTypes.join(', ')}`);
        if (typeAccepted.length === 0) return;
      }

      // Validate file sizes
      const oversizedFiles: string[] = [];
      const validFiles: File[] = [];

      typeAccepted.forEach((file) => {
        if (maxFileSize && file.size > maxFileSize) {
          oversizedFiles.push(`${file.name} (${formatFileSize(file.size)})`);
        } else {
          validFiles.push(file);
        }
      });

      if (oversizedFiles.length > 0) {
        setErrorMsg(
          `File(s) exceed max size of ${formatFileSize(
            maxFileSize!
          )}: ${oversizedFiles.join(', ')}`
        );
        if (validFiles.length === 0) return;
      }

      void (async () => {
        const stored = fileStore
          ? await storeFiles(fileStore, validFiles.map(fileToInput))
          : await Promise.all(validFiles.map(readFileAsAttachment));
        const updated = [...fileDataArr, ...stored];
        onResponse({ fileData: maxFiles === 1 ? updated[0] : updated });
      })();
    },
    [
      fileDataArr,
      maxFiles,
      def.maxFileSize,
      def.accept,
      onResponse,
      fileStore,
    ]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const updated = fileDataArr.filter((_, i) => i !== index);
      removeUnreferencedFiles(fileStore, fileDataArr, updated);
      onResponse({
        fileData:
          updated.length === 0
            ? undefined
            : maxFiles === 1
            ? updated[0]
            : updated,
      });
    },
    [fileDataArr, maxFiles, onResponse, fileStore]
  );

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      if (isEnabled) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [isEnabled, handleFiles]
  );

  if (isPreview) {
    const canAddMore = fileDataArr.length < maxFiles;

    return (
      <div className="file-field-preview ms:flex ms:flex-col ms:gap-4 ms:pb-4">
        <div className="ms:font-light ms:text-mstext ms:break-words ms:overflow-hidden">
          {def.question || 'Upload file'}
          {(isRequired || isSoftRequired) && (
            <span
              className={`ms:ml-0.5 ${
                isSoftRequired ? 'ms:text-mswarning' : 'ms:text-msdanger'
              }`}
            >
              *
            </span>
          )}
          {maxFiles > 1 && (
            <span className="ms:ml-2 ms:text-xs ms:text-mstextmuted">
              ({fileDataArr.length}/{maxFiles})
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="ms:p-3 ms:bg-msdanger/10 ms:border ms:border-msdanger ms:rounded-lg ms:text-sm ms:text-msdanger">
            {errorMsg}
          </div>
        )}

        {fileDataArr.length > 0 && (
          <div className="ms:space-y-2">
            {fileDataArr.map((file, index) => (
              <div
                key={index}
                className="file-item ms:flex ms:items-center ms:justify-between ms:p-3 ms:border ms:border-msborder ms:bg-mssurface ms:rounded-lg ms:gap-2"
              >
                <div className="ms:flex-1 ms:min-w-0">
                  <div className="ms:text-sm ms:font-medium ms:text-mstext ms:truncate">
                    {file.title || 'Unnamed file'}
                  </div>
                  <div className="ms:text-xs ms:text-mstextmuted ms:flex ms:gap-2 ms:flex-wrap">
                    <span>{file.contentType}</span>
                    {file.size && <span>•</span>}
                    {file.size && <span>{formatFileSize(file.size)}</span>}
                  </div>
                </div>
                {isEnabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="ms:p-2 ms:text-mstextmuted ms:hover:text-msdanger ms:transition-colors"
                    aria-label={`Remove ${file.title || 'file'}`}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canAddMore && (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`file-upload-zone ms:border-2 ms:border-dashed ms:rounded-lg ms:p-6 ms:transition-all ${
              isDragActive
                ? 'ms:border-msprimary ms:bg-msprimary/5'
                : 'ms:border-msborder ms:bg-mssurface ms:hover:border-mstextmuted'
            } ${
              !isEnabled
                ? 'ms:opacity-50 ms:cursor-not-allowed'
                : 'ms:cursor-pointer'
            }`}
          >
            <input
              id={`${instanceId}-file-answer-${def.id}`}
              type="file"
              accept={def.accept}
              multiple={maxFiles > 1}
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              onChange={(e) => handleFiles(e.target.files)}
              disabled={!isEnabled}
              className="ms:hidden"
            />
            <label
              htmlFor={`${instanceId}-file-answer-${def.id}`}
              className="ms:flex ms:flex-col ms:items-center ms:justify-center ms:gap-3 ms:cursor-pointer"
            >
              <UploadIcon className="ms:w-8 ms:h-8 ms:text-mstextmuted" />
              <div className="ms:text-center">
                <div className="ms:text-sm ms:font-medium ms:text-mstext">
                  {fileDataArr.length === 0
                    ? 'Choose file or drag and drop'
                    : 'Add more files'}
                </div>
                <div className="ms:mt-2 ms:text-xs ms:text-mstextmuted ms:space-y-1">
                  {def.accept && <div>{def.accept.split(',').join(', ')}</div>}
                  {def.maxFileSize && (
                    <div>Max {formatFileSize(def.maxFileSize)} per file</div>
                  )}
                </div>
              </div>
            </label>
          </div>
        )}
      </div>
    );
  }

  // Builder mode
  return (
    <div className="file-field-edit ms:space-y-3">
      <div>
        <label
          htmlFor={`${instanceId}-canvas-question-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Question
        </label>
        <input
          id={`${instanceId}-canvas-question-${def.id}`}
          aria-label="Question"
          type="text"
          value={def.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Enter question"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
        />
      </div>

      <div>
        <label
          htmlFor={`${instanceId}-editor-accepted-types-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-2"
        >
          Accepted types
        </label>
        <input
          id={`${instanceId}-editor-accepted-types-${def.id}`}
          type="text"
          placeholder="Search file types..."
          value={typeSearch}
          onChange={(e) => setTypeSearch(e.target.value)}
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:mb-2"
        />
        <div className="ms:space-y-2 ms:h-28 ms:overflow-y-auto ms:border ms:border-msborder ms:rounded-lg ms:p-3 ms:bg-mssurface">
          {PREDEFINED_FILE_TYPES.filter((ft) =>
            ft.label.toLowerCase().includes(typeSearch.toLowerCase())
          ).map((fileType) => {
            const selectedTypes = getSelectedTypes(def.accept);
            const isSelected = selectedTypes.includes(fileType.value);
            return (
              <label
                key={fileType.value}
                className="ms:flex ms:items-center ms:gap-2 ms:cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...selectedTypes, fileType.value]
                      : selectedTypes.filter((t) => t !== fileType.value);
                    onUpdate({ accept: getAcceptString(updated) || undefined });
                  }}
                  className="ms:w-4 ms:h-4"
                />
                <span className="ms:text-sm ms:text-mstext">
                  {fileType.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor={`${instanceId}-editor-max-file-size-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Max file size
        </label>
        <div className="ms:flex ms:gap-2">
          <input
            id={`${instanceId}-editor-max-file-size-${def.id}`}
            type="number"
            value={
              def.maxFileSize
                ? convertBytesToUnit(def.maxFileSize, sizeUnit)
                : ''
            }
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              onUpdate({
                maxFileSize: val
                  ? convertUnitToBytes(val, sizeUnit)
                  : undefined,
              });
            }}
            placeholder="Optional"
            className="ms:px-3 ms:py-2 ms:h-10 ms:flex-1 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
          />
          <select
            id={`${instanceId}-editor-size-unit-${def.id}`}
            aria-label="File size unit"
            value={sizeUnit}
            onChange={(e) => {
              const newUnit = e.target.value as SizeUnit;
              setSizeUnit(newUnit);
            }}
            className="ms:px-3 ms:py-2 ms:h-10 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
          >
            <option value="KB">KB</option>
            <option value="MB">MB</option>
            <option value="GB">GB</option>
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${instanceId}-editor-max-files-${def.id}`}
          className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
        >
          Max files allowed
        </label>
        <input
          id={`${instanceId}-editor-max-files-${def.id}`}
          type="number"
          min="1"
          value={def.maxFiles ?? ''}
          onChange={(e) =>
            onUpdate({
              maxFiles: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          onBlur={(e) => {
            const val = e.target.value ? Number(e.target.value) : 0;
            if (val < 1) {
              onUpdate({ maxFiles: 1 });
            }
          }}
          placeholder="1"
          className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg"
        />
      </div>
    </div>
  );
});

export default FileField;
