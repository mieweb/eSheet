import React from 'react';
import {
  parseResponseReference,
  serializeResponseReference,
  type FieldComponentProps,
  type ResponseReference,
  type ResponseReferenceNavigate,
  type ResponseReferenceResolution,
  type ResponseReferenceResolver,
} from '@esheet/core';
import type { FieldProvider } from './FieldProviders.js';
import { registerCustomFieldTypes } from './component-registry.js';

interface Host {
  resolver: ResponseReferenceResolver;
  onNavigate?: ResponseReferenceNavigate;
}
const ResponseReferenceContext = React.createContext<Host | undefined>(
  undefined
);
export interface ResponseReferenceProviderProps extends Host {
  children: React.ReactNode;
}
export function ResponseReferenceProvider({
  resolver,
  onNavigate,
  children,
}: ResponseReferenceProviderProps): React.JSX.Element {
  const value = React.useMemo(
    () => ({ resolver, onNavigate }),
    [resolver, onNavigate]
  );
  return (
    <ResponseReferenceContext.Provider value={value}>
      {children}
    </ResponseReferenceContext.Provider>
  );
}
export function createResponseReferenceProvider(
  resolver: ResponseReferenceResolver,
  onNavigate?: ResponseReferenceNavigate
): FieldProvider {
  return (children) => (
    <ResponseReferenceProvider resolver={resolver} onNavigate={onNavigate}>
      {children}
    </ResponseReferenceProvider>
  );
}
export interface ResponseReferenceLinkProps {
  reference: ResponseReference;
  resolver?: ResponseReferenceResolver;
  onNavigate?: ResponseReferenceNavigate;
  className?: string;
}
/** Permit browser navigation only, never executable URLs or URL credentials. */
function safeHref(href: unknown): string | undefined {
  if (
    typeof href !== 'string' ||
    !href.trim() ||
    /[\u0000-\u0020\u007f\\]/.test(href)
  )
    return undefined;
  try {
    const url = new URL(href, 'https://esheet.invalid/');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return undefined;
    return href;
  } catch {
    return undefined;
  }
}
function approvedResolution(
  result: ResponseReferenceResolution
): ResponseReferenceResolution {
  if (
    !result ||
    !['available', 'restricted', 'missing'].includes(result.status)
  )
    return { status: 'missing' };
  const label =
    typeof result.label === 'string' && result.label.trim()
      ? result.label
      : undefined;
  if (result.status === 'missing') return { status: 'missing', label };
  const href = safeHref(result.href);
  if (result.status === 'restricted')
    return { status: 'restricted', label, ...(href ? { href } : {}) };
  return href
    ? { status: 'available', label: label ?? 'Open linked response', href }
    : { status: 'missing' };
}
/** The host supplies safe display metadata; this component never loads answers. */
export function ResponseReferenceLink({
  reference,
  resolver: resolverProp,
  onNavigate: navigateProp,
  className,
}: ResponseReferenceLinkProps): React.JSX.Element {
  const host = React.useContext(ResponseReferenceContext);
  const resolver = resolverProp ?? host?.resolver;
  const onNavigate = navigateProp ?? host?.onNavigate;
  const parsed = parseResponseReference(reference);
  const key = parsed ? serializeResponseReference(parsed) : '';
  const [result, setResult] = React.useState<{
    key: string;
    resolver: ResponseReferenceResolver;
    resolution: ResponseReferenceResolution;
  }>();
  React.useEffect(() => {
    if (!resolver || !key) return;
    const target = parseResponseReference(key);
    if (!target) return;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => resolver(target, controller.signal))
      .then(
        (resolution) => {
          if (!controller.signal.aborted)
            setResult({
              key,
              resolver,
              resolution: approvedResolution(resolution),
            });
        },
        () => {
          if (!controller.signal.aborted)
            setResult({ key, resolver, resolution: { status: 'missing' } });
        }
      );
    return () => controller.abort();
  }, [key, resolver]);
  // Do not display the previous target/session's metadata while a new resolver runs.
  const resolution =
    result?.key === key && result.resolver === resolver
      ? result.resolution
      : undefined;
  if (key && resolver && !resolution)
    return (
      <span role="status" className={className}>
        Loading linked response…
      </span>
    );
  const status = resolution?.status ?? 'missing';
  const label =
    resolution?.label ??
    (status === 'restricted'
      ? 'Restricted response'
      : 'Linked response unavailable');
  const href =
    resolution && resolution.status !== 'missing' ? resolution.href : undefined;
  if (!href || !parsed || !resolution)
    return (
      <span
        role="link"
        aria-disabled="true"
        data-response-reference-state={status}
        className={className}
      >
        {label}
      </span>
    );
  return (
    <a
      href={href}
      className={className}
      data-response-reference-state={status}
      onClick={(event) => {
        if (
          onNavigate &&
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          onNavigate(parsed, resolution);
        }
      }}
    >
      {label}
    </a>
  );
}
/** Reference assignment is host-owned; following it remains possible in read-only forms. */
export function ResponseReferenceField({
  response,
  isPreview,
}: FieldComponentProps): React.JSX.Element {
  if (!isPreview) return <span>Linked response — assigned by the host</span>;
  const reference = parseResponseReference(response?.answer);
  return reference ? (
    <ResponseReferenceLink reference={reference} />
  ) : (
    <span>No linked response</span>
  );
}
export function registerResponseReferenceFieldType(): void {
  registerCustomFieldTypes({
    responseReference: {
      label: 'Response link',
      category: 'rich',
      answerType: 'text',
      hasOptions: false,
      hasMatrix: false,
      defaultProps: {},
      component: ResponseReferenceField,
    },
  });
}
