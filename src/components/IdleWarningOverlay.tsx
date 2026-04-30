import { useEffect, useState } from 'react';

interface IdleWarningOverlayProps {
  show: boolean;
  durationMs: number;
}

export function IdleWarningOverlay({ show, durationMs }: IdleWarningOverlayProps) {
  const totalSeconds = Math.ceil(durationMs / 1000);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  useEffect(() => {
    if (!show) {
      setSecondsLeft(totalSeconds);
      return;
    }
    const start = Date.now();
    setSecondsLeft(totalSeconds);
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (elapsed >= durationMs) window.clearInterval(id);
    }, 120);
    return () => window.clearInterval(id);
  }, [show, durationMs, totalSeconds]);

  if (!show) return null;

  const ringRadius = 64;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <>
      <style>{`
        @keyframes idleWarningBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes idleWarningCardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes idleWarningDrain {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: ${ringCircumference}; }
        }
        @keyframes idleWarningPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
        @keyframes idleWarningDot {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50%      { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes idleWarningRingGlow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(230, 161, 58, 0.55)); }
          50%      { filter: drop-shadow(0 0 16px rgba(230, 161, 58, 0.95)); }
        }
        @keyframes idleWarningGlassShimmer {
          0%   { transform: translateX(-120%) skewX(-18deg); }
          100% { transform: translateX(220%)  skewX(-18deg); }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at center, rgba(0, 28, 56, 0.38) 0%, rgba(0, 12, 28, 0.62) 100%)',
          backdropFilter: 'blur(14px) saturate(160%)',
          WebkitBackdropFilter: 'blur(14px) saturate(160%)',
          animation: 'idleWarningBackdropIn 0.35s ease-out both',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 'min(440px, 92vw)',
            padding: '40px 36px 32px',
            borderRadius: 28,
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 100%)',
            backdropFilter: 'blur(36px) saturate(180%)',
            WebkitBackdropFilter: 'blur(36px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            boxShadow:
              '0 30px 80px rgba(0, 12, 28, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06) inset, 0 1px 0 rgba(255, 255, 255, 0.35) inset, 0 -1px 0 rgba(0, 0, 0, 0.18) inset',
            textAlign: 'center',
            color: '#FFFFFF',
            overflow: 'hidden',
            animation: 'idleWarningCardIn 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both',
          }}
        >
          {/* Glass shimmer sweep */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '40%',
              height: '100%',
              background:
                'linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.18) 50%, transparent 100%)',
              animation: 'idleWarningGlassShimmer 2.4s ease-out 0.4s both',
              pointerEvents: 'none',
            }}
          />

          {/* Gold accent glow blobs (decorative) */}
          <div
            style={{
              position: 'absolute',
              top: -60,
              left: -40,
              width: 180,
              height: 180,
              borderRadius: 999,
              background:
                'radial-gradient(circle, rgba(230, 161, 58, 0.35) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -70,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: 999,
              background:
                'radial-gradient(circle, rgba(230, 161, 58, 0.25) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              width: 168,
              height: 168,
              margin: '0 auto 22px',
              animation: 'idleWarningPulse 1.6s ease-in-out infinite',
            }}
          >
            <svg width="168" height="168" viewBox="0 0 168 168" style={{ display: 'block' }}>
              <defs>
                <linearGradient id="idleRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F4B860" />
                  <stop offset="100%" stopColor="#D19133" />
                </linearGradient>
              </defs>
              <circle
                cx="84"
                cy="84"
                r={ringRadius}
                stroke="rgba(255, 255, 255, 0.14)"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="84"
                cy="84"
                r={ringRadius}
                stroke="url(#idleRingGrad)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset="0"
                transform="rotate(-90 84 84)"
                style={{
                  animation: `idleWarningDrain ${durationMs}ms linear forwards, idleWarningRingGlow 1.6s ease-in-out infinite`,
                }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
                }}
              >
                {secondsLeft}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: 6,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                seconds
              </div>
            </div>
          </div>

          <h2
            style={{
              position: 'relative',
              fontSize: 24,
              fontWeight: 700,
              margin: '0 0 10px',
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
              textShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
            }}
          >
            Session Ending Soon
          </h2>
          <p
            style={{
              position: 'relative',
              fontSize: 15,
              margin: '0 0 22px',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.55,
            }}
          >
            Returning to the home screen shortly.
          </p>

          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 22px',
              borderRadius: 999,
              background:
                'linear-gradient(135deg, rgba(245, 184, 60, 0.95) 0%, rgba(208, 138, 42, 0.95) 100%)',
              color: '#3B2410',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.02em',
              boxShadow:
                '0 10px 26px rgba(230, 161, 58, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(0, 0, 0, 0.15)',
              border: '1px solid rgba(255, 230, 170, 0.5)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: 999,
                background: '#3B2410',
                animation: 'idleWarningDot 1s ease-in-out infinite',
              }}
            />
            Tap anywhere to stay
          </div>
        </div>
      </div>
    </>
  );
}
