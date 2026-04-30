import { renderHook } from '@testing-library/react';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout';

describe('useInactivityTimeout', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should call onTimeout after the specified duration of inactivity', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimeout(20, onTimeout));

    // Fast-forward time by 19 minutes
    jest.advanceTimersByTime(19 * 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();

    // Fast-forward time by another 1 minute
    jest.advanceTimersByTime(1 * 60 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('should reset the timer on activity', () => {
    const onTimeout = jest.fn();
    renderHook(() => useInactivityTimeout(20, onTimeout));

    // Fast-forward time by 10 minutes
    jest.advanceTimersByTime(10 * 60 * 1000);
    
    // Simulate activity (e.g. keydown)
    // The hook listens to window events and uses throttle of 1s
    window.dispatchEvent(new Event('mousemove'));

    // Fast-forward time by 10 more minutes (total 20 minutes from start)
    jest.advanceTimersByTime(10 * 60 * 1000);
    
    // Since timer was reset at 10 minutes, it should not have fired yet
    expect(onTimeout).not.toHaveBeenCalled();

    // Fast-forward another 10 minutes to trigger the reset timer
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});
