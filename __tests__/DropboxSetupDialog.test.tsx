/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DropboxSetupDialog from '@/components/DropboxSetupDialog';
import { DROPBOX_APP_CONSOLE_URL } from '@/lib/constants';

describe('DropboxSetupDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<DropboxSetupDialog open={false} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all three setup steps when open', () => {
    render(<DropboxSetupDialog open onClose={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: /connect dropbox/i })).toBeInTheDocument();
    expect(screen.getByText(/create your app/i)).toBeInTheDocument();
    expect(screen.getByText(/set permissions first/i)).toBeInTheDocument();
    expect(screen.getByText(/generate and paste/i)).toBeInTheDocument();
  });

  it('names both scopes the app actually calls', () => {
    render(<DropboxSetupDialog open onClose={jest.fn()} />);
    expect(screen.getByText('account_info.read')).toBeInTheDocument();
    expect(screen.getByText('files.content.write')).toBeInTheDocument();
  });

  it('warns that permissions must be set before generating the token', () => {
    render(<DropboxSetupDialog open onClose={jest.fn()} />);
    expect(screen.getByText(/missing_scope/)).toBeInTheDocument();
  });

  it('links to the account-neutral app console in a new tab', () => {
    render(<DropboxSetupDialog open onClose={jest.fn()} />);
    const link = screen.getByRole('link', { name: /open app console/i });
    expect(link).toHaveAttribute('href', DROPBOX_APP_CONSOLE_URL);
    expect(link.getAttribute('href')).not.toContain('app_key');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it('closes via the "Got it" button', () => {
    const onClose = jest.fn();
    render(<DropboxSetupDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the backdrop', () => {
    const onClose = jest.fn();
    render(<DropboxSetupDialog open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('dropbox-setup-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the panel itself is clicked', () => {
    const onClose = jest.fn();
    render(<DropboxSetupDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    render(<DropboxSetupDialog open onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the close button on open', () => {
    render(<DropboxSetupDialog open onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
  });
});
