import React, { useState, useEffect, useRef } from 'react';
import { Navigation, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (role: 'user' | 'admin') => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [password, setPassword] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const dateNum = date.getDate();
    const year = date.getFullYear();
    
    return `${day}, ${month} ${dateNum}, ${year}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleAdminLogin = () => {
    if (password === 'admin123') {
      onLogin('admin');
    } else {
      alert('Incorrect Password');
    }
  };

  const handleSecretTap = () => {
    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    // Increment tap count
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    // If 5 taps reached, show admin form and reset
    if (newTapCount >= 5) {
      setShowAdminForm(true);
      setTapCount(0);
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    } else {
      // Set timeout to reset tap count after 2 seconds of inactivity
      tapTimeoutRef.current = setTimeout(() => {
        setTapCount(0);
      }, 2000);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // Landing screen is always dark-themed -- apply `dark` class so shadcn
  // CSS vars flip to dark (otherwise body-inherited text is near-black).
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center justify-between fixed inset-0 z-50"
      style={{
        background: 'linear-gradient(to bottom, #020410 0%, #0F1535 100%)',
      }}
    >
      {/* Date and Time Display - Upper Right (Matching Main Page Position) */}
      <div
        className="absolute z-[100]"
        style={{
          top: 'clamp(1rem, 2vh, 2.5rem)',
          right: 'clamp(1.25rem, 2.5vw, 3rem)',
        }}
      >
        <div className="flex flex-col items-end">
          <div
            className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
            style={{ color: '#C0C0C0', fontSize: 'clamp(0.875rem, 1vw, 1.125rem)' }}
          >
            {formatDate(currentDateTime)}
          </div>
          <div
            className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] font-semibold"
            style={{ color: '#C0C0C0', fontSize: 'clamp(1.125rem, 1.4vw, 1.5rem)' }}
          >
            {formatTime(currentDateTime)}
          </div>
        </div>
      </div>

      {/* Starfield Background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(2px 2px at 20% 30%, white, transparent),
                            radial-gradient(2px 2px at 60% 70%, white, transparent),
                            radial-gradient(1px 1px at 50% 50%, white, transparent),
                            radial-gradient(1px 1px at 80% 10%, white, transparent),
                            radial-gradient(2px 2px at 90% 40%, white, transparent),
                            radial-gradient(1px 1px at 33% 60%, white, transparent),
                            radial-gradient(1px 1px at 55% 25%, white, transparent)`,
          backgroundSize: '200% 200%',
          animation: 'starfield 20s linear infinite',
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 w-full max-w-4xl flex-1 justify-center">
        {/* Logo */}
        <div style={{ marginBottom: 'clamp(1.5rem, 3vh, 3rem)' }}>
          <img
            src="/wayfinder-logo.png"
            alt="BukSU Wayfinder Logo"
            className="object-contain cursor-pointer"
            style={{
              width: 'clamp(9rem, 16vw, 18rem)',
              height: 'auto',
            }}
            onClick={handleSecretTap}
          />
        </div>

        {/* Welcome Title */}
        <h1
          className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] font-extrabold tracking-tight leading-tight mb-2"
          style={{
            color: '#C0C0C0',
            fontSize: 'clamp(1.75rem, 5vw, 5rem)',
          }}
        >
          <span style={{ display: 'block' }}>Welcome to</span>
          <span style={{ display: 'block' }}>Bukidnon State University</span>
        </h1>

        {/* Wayfinder System */}
        <p
          className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] mb-6 font-semibold"
          style={{
            background: 'linear-gradient(to right, #FFD700, #FFA500, #FFD700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: 'clamp(1rem, 2.2vw, 2.25rem)',
          }}
        >
          Wayfinder System
        </p>

        {/* Subtitle */}
        <p
          className="font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] mt-2 font-semibold tracking-tight"
          style={{
            color: '#D3D3D3',
            fontSize: 'clamp(1.25rem, 3vw, 2.75rem)',
          }}
        >
          EDUCATE. INNOVATE. LEAD.
        </p>

        {/* Motto */}
        <p
          className="mt-4 font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] font-medium"
          style={{
            background: 'linear-gradient(to right, #FFD700, #FFA500, #FFD700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: 'clamp(1.125rem, 2.5vw, 2.25rem)',
          }}
        >
          Smart Guidance. Seamless Journey.
        </p>

        {/* Action Buttons */}
        {!showAdminForm ? (
          <div
            className="w-full flex justify-center"
            style={{ marginTop: 'clamp(4rem, 9vh, 10rem)' }}
          >
            {/* Start Wayfinding Button - large, clean CTA */}
            <button
              onClick={() => onLogin('user')}
              className="group rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] flex items-center cursor-pointer font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
              style={{
                padding: 'clamp(0.9rem, 1.3vw, 1.6rem) clamp(2rem, 3vw, 4rem)',
                gap: 'clamp(0.75rem, 1vw, 1.25rem)',
                background: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
                boxShadow: '0 8px 28px rgba(6, 182, 212, 0.35)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(6, 182, 212, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(6, 182, 212, 0.35)';
              }}
            >
              <Navigation
                className="text-white"
                strokeWidth={2.5}
                style={{ width: 'clamp(1.4rem, 1.6vw, 2.25rem)', height: 'clamp(1.4rem, 1.6vw, 2.25rem)' }}
              />
              <span
                className="font-semibold text-white tracking-wide"
                style={{ fontSize: 'clamp(1.125rem, 1.6vw, 2rem)' }}
              >
                Start Wayfinding
              </span>
              <ArrowRight
                className="text-white transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.5}
                style={{ width: 'clamp(1.2rem, 1.4vw, 2rem)', height: 'clamp(1.2rem, 1.4vw, 2rem)' }}
              />
            </button>
          </div>
        ) : (
          /* Admin Authentication Form - Clean Simple Design */
          <div 
            className="mt-12 mx-auto px-4"
            style={{
              animation: 'fadeIn 0.3s ease-in-out',
              width: '400px',
              maxWidth: '100%',
            }}
          >
            <div className="flex flex-col gap-5">
              {/* Password Label */}
              <label className="text-gray-300 text-sm font-medium font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]">
                Password
              </label>

              {/* Password Input */}
              <input
                type="password"
                placeholder="Enter Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAdminLogin();
                  }
                }}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 text-base placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
              />

              {/* Login Button */}
              <button
                onClick={handleAdminLogin}
                disabled={!password.trim()}
                className="w-full bg-blue-600 text-white font-semibold rounded-lg py-3 text-base hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
                style={{
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                }}
              >
                LOGIN
              </button>

              {/* Back Button */}
              <button
                onClick={() => {
                  setShowAdminForm(false);
                  setPassword('');
                }}
                className="w-full bg-transparent border border-gray-300 text-gray-400 font-medium rounded-lg py-3 text-base hover:text-gray-600 hover:border-gray-400 transition-all font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Copyright */}
      <footer 
        className="relative z-30 w-full flex justify-center items-center pb-6 text-gray-600 text-xs text-center font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] cursor-pointer"
        onClick={handleSecretTap}
      >
        © 2026 BukSU ICTU
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes starfield {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(-50%, -50%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export { LoginScreen };
