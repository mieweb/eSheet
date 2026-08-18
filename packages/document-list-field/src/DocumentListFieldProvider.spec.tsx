import { render, screen } from '@testing-library/react';
import {
  DocumentListFieldProvider,
  useDocumentListFieldHost,
} from './DocumentListGrid.js';

function HostProbe(): React.JSX.Element {
  const host = useDocumentListFieldHost();
  return <output>{host?.detailRowsExpanded ? 'expanded' : 'collapsed'}</output>;
}

describe('DocumentListFieldProvider', () => {
  it('makes host controls available without changing the field value', () => {
    render(
      <DocumentListFieldProvider host={{ detailRowsExpanded: true }}>
        <HostProbe />
      </DocumentListFieldProvider>
    );

    expect(screen.getByText('expanded')).toBeTruthy();
  });

  it('returns no host when the field is not wrapped', () => {
    render(<HostProbe />);

    expect(screen.getByText('collapsed')).toBeTruthy();
  });
});
