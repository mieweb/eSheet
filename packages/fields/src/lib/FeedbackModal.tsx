import { ZodIssuesPanel } from './ZodIssuesPanel.js';
import type { ReactNode } from 'react';

export type FeedbackModalVariant = 'info' | 'success' | 'warning' | 'error';

export interface FeedbackModalProps {
  open: boolean;
  title: string;
  message: string;
  details?: string;
  issues?: string[];
  issuesTitle?: string;
  issuesHint?: string;
  content?: ReactNode;
  variant?: FeedbackModalVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

const VARIANT_STYLES: Record<FeedbackModalVariant, string> = {
  info: 'ms:text-msprimary ms:bg-msprimary/10',
  success: 'ms:text-msaccent ms:bg-msaccent/10',
  warning: 'ms:text-mswarning ms:bg-mswarning/10',
  error: 'ms:text-msdanger ms:bg-msdanger/10',
};

/**
 * Reusable modal used for import and validation feedback.
 */
export function FeedbackModal({
  open,
  title,
  message,
  details,
  issues,
  issuesTitle,
  issuesHint,
  content,
  variant = 'info',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  showCancel = false,
  onConfirm,
  onClose,
}: FeedbackModalProps) {
  if (!open) return null;

  return (
    <div
      className="feedback-modal-overlay ms:fixed ms:inset-0 ms:z-50 ms:flex ms:items-center ms:justify-center ms:bg-msoverlay ms:px-4 ms:py-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="feedback-modal-content ms:w-full ms:max-w-2xl ms:rounded-xl ms:bg-mssurface ms:border ms:border-msborder ms:shadow-2xl ms:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ms:flex ms:items-start ms:gap-3 ms:mb-3">
          <div
            className={`ms:inline-flex ms:h-7 ms:min-w-7 ms:items-center ms:justify-center ms:rounded-full ms:text-xs ms:font-semibold ${VARIANT_STYLES[variant]}`}
          >
            i
          </div>
          <div className="ms:min-w-0">
            <h3 className="ms:text-base ms:font-semibold ms:text-mstext">
              {title}
            </h3>
            <p className="ms:text-sm ms:text-mstextmuted ms:mt-1 ms:whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>

        {issues && issues.length > 0 && (
          <ZodIssuesPanel
            title={issuesTitle ?? 'Validation Issues'}
            issues={issues}
            hint={issuesHint ?? 'Please resolve these issues and try again.'}
            className="ms:mb-3 ms:p-4"
            variant={
              variant === 'error'
                ? 'error'
                : variant === 'warning'
                ? 'warning'
                : variant === 'success'
                ? 'success'
                : 'info'
            }
          />
        )}

        {details && (
          <pre className="ms:text-xs ms:text-mstext ms:bg-msbackground ms:border ms:border-msborder ms:rounded ms:p-2 ms:whitespace-pre-wrap ms:break-words ms:max-h-96 ms:overflow-auto">
            {details}
          </pre>
        )}

        {content}

        <div className="ms:mt-4 ms:flex ms:justify-end ms:gap-2">
          {showCancel && (
            <button
              type="button"
              onClick={onClose}
              className="ms:px-4 ms:py-2 ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:text-sm ms:font-medium ms:hover:bg-msbackground ms:transition-colors ms:outline-none ms:focus:outline-none ms:cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm ?? onClose}
            className="ms:px-4 ms:py-2 ms:rounded-lg ms:bg-msprimary ms:text-mstextsecondary ms:text-sm ms:font-medium ms:hover:bg-msprimary/90 ms:transition-colors ms:border-0 ms:outline-none ms:focus:outline-none ms:cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
