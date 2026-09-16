/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SecretField from '@/components/SecretField';

describe('SecretField', () => {
  it('starts masked and toggles visibility', () => {
    render(<SecretField label="API key" value="secret" onChange={jest.fn()} />);
    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show API key' }));
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide API key' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows the check result unless told to hide it', () => {
    const status = { ok: false, message: 'Rejected' };
    const { rerender } = render(<SecretField label="Token" status={status} />);
    expect(screen.getByTestId('field-status-error')).toBeInTheDocument();

    rerender(<SecretField label="Token" status={status} hideStatus />);
    expect(screen.queryByTestId('field-status-error')).not.toBeInTheDocument();
  });

  it('disables the toggle along with the field', () => {
    render(<SecretField label="API key" disabled />);
    expect(screen.getByRole('button', { name: 'Show API key' })).toBeDisabled();
  });
});
