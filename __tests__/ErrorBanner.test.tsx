/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBanner from '../components/ErrorBanner';
import { ApiErrorResponse } from '../types/error';

const fatalError: ApiErrorResponse = {
  success: false,
  error: {
    type: 'FATAL',
    message: 'Something went wrong',
  },
};

const rateLimitError: ApiErrorResponse = {
  success: false,
  error: {
    type: 'RATE_LIMIT',
    message: 'Too many requests',
    retryAfterSeconds: 10,
  },
};

describe('ErrorBanner', () => {
  it('renders null when error is null', () => {
    const { container } = render(
      <ErrorBanner error={null} onDismiss={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders error message', () => {
    render(<ErrorBanner error={fatalError} onDismiss={jest.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = jest.fn();
    render(<ErrorBanner error={fatalError} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders Try Again button when onRetry is provided', () => {
    render(
      <ErrorBanner error={fatalError} onDismiss={jest.fn()} onRetry={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls onRetry when Try Again is clicked', () => {
    const onRetry = jest.fn();
    render(
      <ErrorBanner error={fatalError} onDismiss={jest.fn()} onRetry={onRetry} />
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does NOT render Try Again button when onRetry is not provided', () => {
    render(<ErrorBanner error={fatalError} onDismiss={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  it('shows countdown for rate-limit errors', () => {
    render(<ErrorBanner error={rateLimitError} onDismiss={jest.fn()} />);
    expect(screen.getByText(/retry available in/i)).toBeInTheDocument();
  });
});
