/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout';


describe('useInactivityTimeout', () => {
  beforeEach(() => {
    // Use fake timers so we control setTimeout scheduling
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('calls onTimeout after the full inactivity period', () => {
    const onTimeout = jest.fn();

    const { unmount } = renderHook(() => useInactivityTimeout(20, onTimeout));

    // Advance just under 20 minutes — must not have fired
    act(() => { jest.advanceTimersByTime(19 * 60 * 1000 + 59_000); });
    expect(onTimeout).not.toHaveBeenCalled();

    // Cross the 20-minute mark — timer fires
    act(() => { jest.advanceTimersByTime(1000); });
    expect(onTimeout).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('does NOT call onTimeout before the inactivity period elapses', () => {
    const onTimeout = jest.fn();

    const { unmount } = renderHook(() => useInactivityTimeout(20, onTimeout));

    act(() => { jest.advanceTimersByTime(10 * 60 * 1000); }); // half the window
    expect(onTimeout).not.toHaveBeenCalled();

    unmount();
  });
});
