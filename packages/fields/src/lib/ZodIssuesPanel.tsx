export type ZodIssuesPanelVariant = 'error' | 'warning' | 'info' | 'success';

const PANEL_VARIANT_STYLES: Record<
  ZodIssuesPanelVariant,
  { border: string; icon: string; number: string }
> = {
  error: {
    border: 'ms:border-l-msdanger',
    icon: 'ms:text-msdanger',
    number: 'ms:text-msdanger',
  },
  warning: {
    border: 'ms:border-l-mswarning',
    icon: 'ms:text-mswarning',
    number: 'ms:text-mswarning',
  },
  info: {
    border: 'ms:border-l-msprimary',
    icon: 'ms:text-msprimary',
    number: 'ms:text-msprimary',
  },
  success: {
    border: 'ms:border-l-msaccent',
    icon: 'ms:text-msaccent',
    number: 'ms:text-msaccent',
  },
};

export interface ZodIssuesPanelProps {
  title?: string;
  issues: readonly string[];
  hint?: string;
  className?: string;
  variant?: ZodIssuesPanelVariant;
}

/**
 * Reusable, field-style panel for displaying one or more Zod validation issues.
 */
export function ZodIssuesPanel({
  title = 'Invalid Form Definition',
  issues,
  hint = 'Please check your form definition for the above issues.',
  className = '',
  variant = 'error',
}: ZodIssuesPanelProps) {
  if (issues.length === 0) return null;

  const styles = PANEL_VARIANT_STYLES[variant];

  const rootClassName = [
    `zod-issues-panel ms:mb-2 ms:p-6 ms:bg-mssurface ms:border ms:border-msborder ms:rounded ms:border-l-2 ${styles.border}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName} role="alert" aria-live="polite">
      <div className="ms:flex ms:items-start ms:gap-3">
        <div
          className={`${styles.icon} ms:text-base ms:flex-shrink-0 ms:mt-0.5`}
        >
          ⚠
        </div>
        <div className="ms:flex-1">
          <h2 className="ms:text-base ms:font-medium ms:text-mstext ms:mb-2">
            {title}
          </h2>
          <div className="ms:space-y-3 ms:text-sm ms:text-mstext">
            {issues.map((issue, idx) => (
              <div
                key={`${idx}-${issue}`}
                className="ms:flex ms:gap-2 ms:py-1.5"
              >
                <div
                  className={`ms:flex-shrink-0 ${styles.number} ms:text-xs ms:font-medium ms:min-w-5`}
                >
                  {idx + 1}.
                </div>
                <div className="ms:flex-1 ms:text-sm ms:text-mstext ms:break-words">
                  {issue}
                </div>
              </div>
            ))}
          </div>
          <p className="ms:text-xs ms:text-mstextmuted ms:mt-2">{hint}</p>
        </div>
      </div>
    </div>
  );
}
