import type React from 'react';

// ---------------------------------------------------------------------------
// Pluggable notes composer — hosts may replace NotesField's default textarea
// (Write/Preview tabs) with a rich markdown editor, e.g. Kerebron via
// @esheet/field-kerebron's KerebronNotesComposer. Markdown stays the storage
// format either way.
// ---------------------------------------------------------------------------

export interface NotesComposerProps {
  /** Current markdown value. Loaded once on mount; the composer owns edits. */
  value: string;
  /** Fired (may be debounced by the composer) with the markdown text. */
  onChange: (markdown: string) => void;
  /** Accessible label for the editing surface. */
  ariaLabel: string;
  /** Placeholder shown when empty (composers may ignore it). */
  placeholder?: string;
}

export type NotesComposerComponent = React.ComponentType<NotesComposerProps>;

let composer: NotesComposerComponent | undefined;

/** Replace the default textarea composer in NotesField (app-wide). */
export function registerNotesComposer(component: NotesComposerComponent): void {
  composer = component;
}

/** The registered composer, or undefined for the built-in textarea. */
export function getNotesComposer(): NotesComposerComponent | undefined {
  return composer;
}

/** Reset to the built-in textarea (internal/test-only). */
export function resetNotesComposer(): void {
  composer = undefined;
}
