import React from 'react';

export type FieldProvider = (children: React.ReactNode) => React.ReactNode;

export interface FieldProviderStackProps {
  providers?: readonly FieldProvider[];
  children: React.ReactNode;
}

export function FieldProviderStack({
  providers = [],
  children,
}: FieldProviderStackProps): React.JSX.Element {
  let content = children;
  for (let index = providers.length - 1; index >= 0; index -= 1) {
    content = providers[index](content);
  }

  return <>{content}</>;
}
