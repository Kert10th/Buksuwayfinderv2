import { useState } from 'react';
import { toast } from 'sonner';
import { WayfinderInterface } from './components/WayfinderInterface';
import { LoginScreen } from './components/LoginScreen';
import { Toaster } from './components/ui/sonner';
import { useIdleTimeout } from './hooks/useIdleTimeout';

const IDLE_TIMEOUT_MS = 60_000;
const IDLE_WARNING_MS = 10_000;

export default function App() {
  const [userRole, setUserRole] = useState<null | 'user' | 'admin'>(null);

  useIdleTimeout({
    // Only kiosk (regular user) sessions auto-return to the landing screen.
    // Admins routinely pause for minutes while editing nodes / drawing routes,
    // so their sessions stay active until they explicitly log out.
    enabled: userRole === 'user',
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onWarning: () => {
      toast.warning('Session ending soon', {
        description: `Returning to home screen in ${IDLE_WARNING_MS / 1000} seconds. Tap anywhere to stay.`,
        duration: IDLE_WARNING_MS,
        id: 'idle-warning',
      });
    },
    onActivity: () => {
      toast.dismiss('idle-warning');
    },
    onTimeout: () => {
      toast.dismiss('idle-warning');
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
      <Toaster position="top-right" richColors />
    </>
  );
}
