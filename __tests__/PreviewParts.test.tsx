/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DropboxSaveAlert, PreviewToolbar, UnappliedEditsAlert } from '@/components/preview/PreviewParts';

describe('UnappliedEditsAlert', () => {
  const edits = [
    { path: 'coverLetter.body[1]', originalValue: 'a', editedValue: 'My second paragraph' },
    { path: 'coverLetter.body[3]', originalValue: 'b', editedValue: 'My fourth paragraph' },
  ];

  it('renders nothing when every edit was carried over', () => {
    const { container } = render(
      <UnappliedEditsAlert title="⚠️ Edits:" edits={[]} describeLocation={(e) => e.path} onClose={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each edit with its location and text', () => {
    render(
      <UnappliedEditsAlert
        title="⚠️ Unapplied Cover Letter Edits:"
        edits={edits}
        describeLocation={(e) => `Spot ${e.path.slice(-2, -1)}`}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('⚠️ Unapplied Cover Letter Edits:')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['At Spot 1: “My second paragraph”', 'At Spot 3: “My fourth paragraph”']);
  });

  it('can be dismissed', () => {
    const onClose = jest.fn();
    render(<UnappliedEditsAlert title="t" edits={edits} describeLocation={(e) => e.path} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DropboxSaveAlert', () => {
  it('renders nothing without a status', () => {
    const { container } = render(<DropboxSaveAlert status={null} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the message with the matching severity', () => {
    render(<DropboxSaveAlert status={{ type: 'error', message: 'Your Dropbox is full.' }} onClose={jest.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Your Dropbox is full.');
    expect(alert.className).toMatch(/Error/);
  });
});

describe('PreviewToolbar', () => {
  it('toggles highlights and renders the given actions', () => {
    const onChange = jest.fn();
    render(
      <PreviewToolbar showHighlights onShowHighlightsChange={onChange}>
        <button>Download DOCX</button>
      </PreviewToolbar>
    );
    expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /show highlights/i }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
