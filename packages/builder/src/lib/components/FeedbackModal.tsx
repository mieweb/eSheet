export type FeedbackModalVariant = 'info' | 'success' | 'warning' | 'error';

export interface FeedbackModalProps {
  open: boolean;
  title: string;
  message: string;
  details?: string;
  variant?: FeedbackModalVariant;
  confirmLabel?: string;
  onClose: () => void;
}

const VARIANT_STYLES: Record<FeedbackModalVariant, string> = {
  info: 'es:text-esprimary es:bg-esprimary/10',
  success: 'es:text-esaccent es:bg-esaccent/10',
  warning: 'es:text-eswarning es:bg-eswarning/10',
  error: 'es:text-esdanger es:bg-esdanger/10',
};

/**
 * Reusable modal used for import and validation feedback.
 */
export function FeedbackModal({
  open,
  title,
  message,
  details,
  variant = 'info',
  confirmLabel = 'OK',
  onClose,
}: FeedbackModalProps) {
  if (!open) return null;

  return (
    <div
      className="feedback-modal-overlay es:fixed es:inset-0 es:z-50 es:flex es:items-center es:justify-center es:bg-esoverlay es:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="feedback-modal-content es:w-full es:max-w-lg es:rounded-xl es:bg-essurface es:border es:border-esborder es:shadow-2xl es:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="es:flex es:items-start es:gap-3 es:mb-3">
          <div
            className={`es:inline-flex es:h-7 es:min-w-7 es:items-center es:justify-center es:rounded-full es:text-xs es:font-semibold ${VARIANT_STYLES[variant]}`}
          >
            i
          </div>
          <div className="es:min-w-0">
            <h3 className="es:text-base es:font-semibold es:text-estext">
              {title}
            </h3>
            <p className="es:text-sm es:text-estextmuted es:mt-1 es:whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>

        {details && (
          <pre className="es:text-xs es:text-estext es:bg-esbackground es:border es:border-esborder es:rounded es:p-2 es:whitespace-pre-wrap es:break-words es:max-h-44 es:overflow-auto">
            {details}
          </pre>
        )}

        <div className="es:mt-4 es:flex es:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="es:px-4 es:py-2 es:rounded-lg es:bg-esprimary es:text-estextsecondary es:text-sm es:font-medium es:hover:bg-esprimary/90 es:transition-colors es:border-0 es:outline-none es:focus:outline-none es:cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
