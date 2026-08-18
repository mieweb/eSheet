import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FieldProviderStack } from './FieldProviders.js';

describe('FieldProviderStack', () => {
  it('composes optional providers around the shared render tree', () => {
    const firstProvider = vi.fn((children: ReactNode) => (
      <div data-testid="first-provider">{children}</div>
    ));
    const secondProvider = vi.fn((children: ReactNode) => (
      <div data-testid="second-provider">{children}</div>
    ));

    render(
      <FieldProviderStack providers={[firstProvider, secondProvider]}>
        <output>content</output>
      </FieldProviderStack>
    );

    expect(screen.getByText('content')).toBeTruthy();
    expect(
      within(screen.getByTestId('first-provider')).getByTestId(
        'second-provider'
      )
    ).toBeTruthy();
    expect(firstProvider).toHaveBeenCalledOnce();
    expect(secondProvider).toHaveBeenCalledOnce();
  });

  it('renders the shared tree when no providers are supplied', () => {
    render(
      <FieldProviderStack>
        <output>content</output>
      </FieldProviderStack>
    );

    expect(screen.getByText('content')).toBeTruthy();
  });
});
