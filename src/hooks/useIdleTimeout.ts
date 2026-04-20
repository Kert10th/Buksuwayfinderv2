import { useEffect, useRef } from 'react';

interface UseIdleTimeoutOptions {
  enabled: boolean;
  timeoutMs: number;
  warningMs?: number;
  onTimeout: () => void;
  onWarning?: () => void;
  onActivity?: () => void;
}

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
];

export function useIdleTimeout({
  enabled,
  timeoutMs,
  warningMs,
  onTimeout,
  onWarning,
  onActivity,
}: UseIdleTimeoutOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);
  const onActivityRef = useRef(onActivity);

  onTimeoutRef.current = onTimeout;
  onWarningRef.current = onWarning;
  onActivityRef.current = onActivity;

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      timeoutRef.current = null;
      warningRef.current = null;
    };

    const schedule = () => {
      clearTimers();
      if (warningMs !== undefined && warningMs < timeoutMs) {
        warningRef.current = setTimeout(() => {
          onWarningRef.current?.();
        }, timeoutMs - warningMs);
      }
      timeoutRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, timeoutMs);
    };

    const handleActivity = () => {
      onActivityRef.current?.();
      schedule();
    };

    schedule();
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
    };
  }, [enabled, timeoutMs, warningMs]);
}
