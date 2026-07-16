import React from 'react';
import type {
  CollabDecorations,
  FieldComponentProps,
  FieldProposal,
  FormStore,
  UIStore,
} from '@esheet/core';
import { getFieldComponent } from '@esheet/fields';

export interface FieldNodeProps {
  id: string;
  form: FormStore;
  ui: UIStore;
  /** Nesting depth for visual styling (default: 0) */
  depth?: number;
  /** Optional host-supplied collaboration decorations (see EsheetRendererProps). */
  collab?: CollabDecorations;
}

/**
 * FieldNode - Renders a single field or section with recursive children
 *
 * Looks up the field component from the registry and passes field props.
 * For sections, recursively renders visible children.
 */
export const FieldNode = React.memo(function FieldNode({
  id,
  form,
  ui,
  depth = 1,
  collab,
}: FieldNodeProps) {
  // Subscribe to field data
  const field = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().getField(id),
    () => form.getState().getField(id)
  );

  const normalized = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().normalized,
    () => form.getState().normalized
  );

  const responses = React.useSyncExternalStore(
    (cb) => form.subscribe(cb),
    () => form.getState().responses,
    () => form.getState().responses
  );

  // Get visible children for sections and pages
  const visibleChildIds = React.useMemo(() => {
    if (!field || field.definition.fieldType !== 'section') return [];

    const node = normalized.byId[id];
    if (!node || node.childIds.length === 0) return [];

    const cache = new Map<string, boolean>();

    const isFieldRenderable = (fieldId: string): boolean => {
      const cached = cache.get(fieldId);
      if (cached !== undefined) return cached;

      const isVisible = form.getState().isVisible(fieldId);
      if (!isVisible) {
        cache.set(fieldId, false);
        return false;
      }

      const childNode = normalized.byId[fieldId];
      if (!childNode) {
        cache.set(fieldId, false);
        return false;
      }

      if (childNode.definition.fieldType !== 'section') {
        cache.set(fieldId, true);
        return true;
      }

      const hasRenderableChild = childNode.childIds.some((cid) =>
        isFieldRenderable(cid)
      );
      cache.set(fieldId, hasRenderableChild);
      return hasRenderableChild;
    };

    return node.childIds.filter((childId) => isFieldRenderable(childId));
  }, [field, id, form, normalized, responses]);

  // Render nested children for sections
  const nestedChildren = React.useMemo(() => {
    if (
      !field ||
      field.definition.fieldType !== 'section' ||
      visibleChildIds.length === 0
    ) {
      return null;
    }
    const containerClass =
      depth === 1
        ? 'section-children ms:space-y-2'
        : 'section-children ms:space-y-2 ms:border-l ms:border-msborder ms:pl-3';

    return (
      <div className={containerClass} data-depth={depth}>
        {visibleChildIds.map((childId) => (
          <FieldNode
            key={childId}
            id={childId}
            form={form}
            ui={ui}
            depth={depth + 1}
            collab={collab}
          />
        ))}
      </div>
    );
  }, [field, visibleChildIds, id, form, ui, depth, collab]);

  // Collab decorations (presence dots + proposal adornment) for this field.
  const presence = collab?.presenceByField?.[id] ?? [];
  const proposals = collab?.proposalsByField?.[id] ?? [];
  const adornmentId = `${form.getState().instanceId}-proposal-${id}`;

  // Link the field's answer input to the proposal adornment. The input is
  // rendered by the field component (its id ends in `-answer-<fieldId>`), so
  // the aria-describedby token is managed on the live DOM.
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const hasProposals = proposals.length > 0;
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !hasProposals) return undefined;
    const input = Array.from(
      wrapper.querySelectorAll('input, select, textarea')
    ).find((el) => el.id.endsWith(`-answer-${id}`));
    if (!input) return undefined;
    const tokens = (input.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.includes(adornmentId)) {
      input.setAttribute(
        'aria-describedby',
        [...tokens, adornmentId].join(' ')
      );
    }
    return () => {
      const rest = (input.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((token) => token && token !== adornmentId);
      if (rest.length > 0) {
        input.setAttribute('aria-describedby', rest.join(' '));
      } else {
        input.removeAttribute('aria-describedby');
      }
    };
  }, [hasProposals, id, adornmentId]);

  if (!field) return null;

  const Component = getFieldComponent(field.definition.fieldType);

  if (!Component) {
    return (
      <div
        className="ms:p-4 ms:border ms:border-msborder ms:rounded ms:bg-mssurface ms:mb-2"
        data-field-type={field.definition.fieldType}
        data-field-id={field.definition.id}
      >
        <p className="ms:text-sm ms:text-mstextmuted">
          Unknown field type:{' '}
          <code className="ms:font-mono">{field.definition.fieldType}</code>
        </p>
      </div>
    );
  }

  // Check if field is enabled/required via conditional logic
  const isVisible = form.getState().isVisible(field.definition.id);
  const isEnabled = form.getState().isEnabled(field.definition.id);
  const isRequired = form.getState().isRequired(field.definition.id);
  const isSoftRequired = form.getState().isSoftRequired(field.definition.id);
  const isReadOnly = form.getState().isReadOnly(field.definition.id);
  const response = form.getState().getResponse(field.definition.id);

  if (!isVisible) return null;

  const props: FieldComponentProps = {
    field,
    form,
    ui,
    isSelected: false,
    isPreview: true,
    isEnabled,
    isRequired,
    isSoftRequired,
    isReadOnly,
    response,
    onRemove: () => undefined, // No-op in renderer
    onUpdate: () => undefined, // No-op in renderer
    onResponse: (value) =>
      form.getState().setResponse(field.definition.id, value),
  };

  const parentNode = field.parentId
    ? form.getState().getField(field.parentId)
    : null;
  const isChildOfSection = parentNode?.definition.fieldType === 'section';

  const wrapperClass = `field-wrapper${isChildOfSection ? ' ms:py-1' : ''}${
    !isEnabled ? ' ms:opacity-50 ms:pointer-events-none' : ''
  }`;

  const fieldLabel = field.definition.question || field.definition.id;

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      data-field-type={field.definition.fieldType}
      data-field-id={field.definition.id}
      aria-disabled={!isEnabled || undefined}
    >
      {presence.length > 0 && (
        <div
          className="collab-presence ms:absolute ms:top-2 ms:right-2 ms:flex ms:gap-1"
          role="img"
          aria-label={presence.map((peer) => peer.name).join(', ')}
        >
          {presence.map((peer) => (
            <span
              key={peer.name}
              title={peer.name}
              className="ms:inline-block ms:w-2.5 ms:h-2.5 ms:rounded-full ms:border ms:border-mssurface"
              style={{ backgroundColor: peer.color }}
            />
          ))}
        </div>
      )}
      {field.definition.fieldType === 'section' ? (
        (() => {
          const ContainerComponent = Component as React.ComponentType<
            FieldComponentProps & { nestedChildren?: React.ReactNode }
          >;
          return (
            <ContainerComponent {...props} nestedChildren={nestedChildren} />
          );
        })()
      ) : (
        <Component {...props} />
      )}
      {hasProposals && (
        <div id={adornmentId} className="collab-proposals ms:mt-2 ms:space-y-1">
          {proposals.map((proposal) => (
            <ProposalAdornment
              key={proposal.id}
              proposal={proposal}
              fieldId={id}
              fieldLabel={fieldLabel}
              collab={collab}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** One proposal row inside a field's collab adornment. */
function ProposalAdornment({
  proposal,
  fieldId,
  fieldLabel,
  collab,
}: {
  proposal: FieldProposal;
  fieldId: string;
  fieldLabel: string;
  collab?: CollabDecorations;
}) {
  const format = collab?.formatValue ?? ((value: unknown) => String(value));
  const acceptAction = proposal.conflict ? 'accept-anyway' : 'accept';
  const acceptText = proposal.conflict ? 'Accept anyway' : 'Accept';
  return (
    <div className="collab-proposal ms:flex ms:flex-wrap ms:items-center ms:gap-2 ms:rounded ms:border ms:border-mswarning/40 ms:bg-mswarning/10 ms:px-2 ms:py-1 ms:text-sm ms:text-mstext">
      <span className="collab-proposal-value">
        Proposed: <strong>{format(proposal.proposedValue)}</strong>
      </span>
      <span className="collab-proposal-actor ms:text-mstextmuted">
        by {proposal.actor}
      </span>
      {proposal.conflict && (
        <span className="collab-proposal-conflict ms:text-msdanger">
          Changed since proposed — now: {format(proposal.conflict.currentValue)}
        </span>
      )}
      {collab?.canResolve && collab.onProposalAction && (
        <span className="collab-proposal-actions ms:ml-auto ms:flex ms:gap-1">
          <button
            type="button"
            aria-label={`${acceptText} proposal for ${fieldLabel}`}
            className="ms:px-2 ms:py-0.5 ms:rounded ms:text-xs ms:font-medium ms:border-0 ms:cursor-pointer ms:bg-msprimary ms:text-mstextsecondary ms:hover:bg-msprimary/90 ms:transition-colors"
            onClick={() =>
              collab.onProposalAction?.(fieldId, proposal.id, acceptAction)
            }
          >
            {acceptText}
          </button>
          <button
            type="button"
            aria-label={`Reject proposal for ${fieldLabel}`}
            className="ms:px-2 ms:py-0.5 ms:rounded ms:text-xs ms:font-medium ms:cursor-pointer ms:bg-mssurface ms:text-msdanger ms:border ms:border-msdanger/40 ms:hover:bg-msdanger/10 ms:transition-colors"
            onClick={() =>
              collab.onProposalAction?.(fieldId, proposal.id, 'reject')
            }
          >
            Reject
          </button>
        </span>
      )}
    </div>
  );
}
