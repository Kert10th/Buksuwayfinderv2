import { useState } from 'react';
import { WayfinderInterface } from './components/WayfinderInterface';
import { LoginScreen } from './components/LoginScreen';
import { Toaster } from './components/ui/sonner';
import { IdleWarningOverlay } from './components/IdleWarningOverlay';
import { useIdleTimeout } from './hooks/useIdleTimeout';

const IDLE_TIMEOUT_MS = 60_000;
const IDLE_WARNING_MS = 10_000;

export default function App() {
  const [userRole, setUserRole] = useState<null | 'user' | 'admin'>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  useIdleTimeout({
    // Only kiosk (regular user) sessions auto-return to the landing screen.
    // Admins routinely pause for minutes while editing nodes / drawing routes,
    // so their sessions stay active until they explicitly log out.
    enabled: userRole === 'user',
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onWarning: () => setShowIdleWarning(true),
    onActivity: () => setShowIdleWarning(false),
    onTimeout: () => {
      setShowIdleWarning(false);
      setUserRole(null);
    },
  });

  return (
    <>
      {userRole === null ? (
        <LoginScreen onLogin={(role) => setUserRole(role)} />
      ) : (
        <WayfinderInterface
          isAdmin={userRole === 'admin'}
          onLogout={() => setUserRole(null)}
        />
      )}
      <IdleWarningOverlay show={showIdleWarning} durationMs={IDLE_WARNING_MS} />
      <Toaster position="top-right" richColors offset="90px" />
    </>
  );
}
