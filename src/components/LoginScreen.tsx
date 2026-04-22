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
    // Password lives in VITE_ADMIN_PASSWORD (Cloudflare Pages env var).
    // Fallback 'admin123' only kicks in for local dev without a .env.local —
    // never ship a build without the env var set in production.
    const expected = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || 'admin123';
    if (password === expected) {
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

      {/* Floating gold particles - ambient life on the landing page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="floating-particle"
            style={{
              left: `${(i + 1) * 11 + (i % 3) * 2}%`,
              animationDuration: `${9 + ((i * 1.3) % 6)}s`,
              animationDelay: `${i * 1.1}s`,
              width: i % 3 === 0 ? '5px' : '3px',
              height: i % 3 === 0 ? '5px' : '3px',
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 w-full max-w-4xl flex-1 justify-center">
        {/* Logo */}
        <div
          className="landing-fade-in"
          style={{
            marginBottom: 'clamp(1.5rem, 3vh, 3rem)',
            animationDelay: '0ms',
          }}
        >
          <img
            src="/wayfinder-logo.png"
            alt="BukSU Wayfinder Logo"
            className="object-contain cursor-pointer logo-breathe"
            style={{
              width: 'clamp(9rem, 16vw, 18rem)',
              height: 'auto',
            }}
            onClick={handleSecretTap}
          />
        </div>

        {/* Welcome Title */}
        <h1
          className="landing-fade-in font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] font-extrabold tracking-tight leading-tight mb-3"
          style={{
            color: '#F5F5F5',
            fontSize: 'clamp(1.75rem, 5vw, 5rem)',
            animationDelay: '180ms',
          }}
        >
          <span style={{ display: 'block' }}>Welcome to</span>
          <span style={{ display: 'block' }}>Bukidnon State University</span>
        </h1>

        {/* BukSU official motto - single gold accent, refined tracking */}
        <p
          className="landing-fade-in font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif] mt-3 font-semibold uppercase"
          style={{
            color: '#E6A13A',
            letterSpacing: '0.25em',
            fontSize: 'clamp(0.85rem, 1.5vw, 1.35rem)',
            animationDelay: '360ms',
          }}
        >
          Educate · Innovate · Lead
        </p>

        {/* Action Buttons */}
        {!showAdminForm ? (
          <div
            className="landing-fade-in w-full flex justify-center"
            style={{ marginTop: 'clamp(4rem, 9vh, 10rem)', animationDelay: '540ms' }}
          >
            {/* CTA wrapper - hosts the breathing pulse ring behind the button */}
            <div className="relative inline-block cta-breathe">
              {/* Soft pulsing glow ring behind the button */}
              <div
                className="absolute inset-0 rounded-2xl cta-pulse-ring pointer-events-none"
                aria-hidden="true"
              />
            {/* Start Wayfinding Button - large, clean CTA */}
            <button
              onClick={() => onLogin('user')}
              className="group relative rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] flex items-center cursor-pointer font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]"
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

        /* Landing-page entrance: elements lift + fade in on load.
           Each element sets its own animation-delay inline for a staggered feel. */
        @keyframes landingRiseIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .landing-fade-in {
          opacity: 0;
          animation: landingRiseIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* Slow breathe on the hero logo to give the page a hint of life. */
        @keyframes logoBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.025); }
        }
        .logo-breathe {
          animation: logoBreathe 4.5s ease-in-out infinite;
        }

        /* Soft pulsing glow ring behind the Start Wayfinding CTA. Visible as a
           halo that swells outward — signals the button is tappable without
           being noisy. */
        @keyframes ctaPulseRing {
          0% {
            transform: scale(1);
            opacity: 0.55;
            box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.55),
                        0 0 20px 0 rgba(59, 130, 246, 0.35);
          }
          70% {
            opacity: 0;
            transform: scale(1.08);
            box-shadow: 0 0 0 18px rgba(6, 182, 212, 0),
                        0 0 40px 10px rgba(59, 130, 246, 0);
          }
          100% {
            transform: scale(1);
            opacity: 0;
          }
        }
        .cta-pulse-ring {
          background: linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(6,182,212,0.35) 100%);
          animation: ctaPulseRing 2.6s ease-out infinite;
        }
        /* Subtle scale breathe on the CTA wrapper to complement the ring. */
        @keyframes ctaBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        .cta-breathe {
          animation: ctaBreathe 2.6s ease-in-out infinite;
        }

        /* Floating gold particles rising slowly from the bottom of the screen. */
        @keyframes floatUp {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          8%, 92% {
            opacity: 0.9;
          }
          50% {
            transform: translateY(-55vh) translateX(8px);
          }
          100% {
            transform: translateY(-110vh) translateX(-6px);
            opacity: 0;
          }
        }
        .floating-particle {
          position: absolute;
          bottom: -10px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #FFD700;
          box-shadow: 0 0 8px 2px rgba(255, 215, 0, 0.5),
                      0 0 16px 4px rgba(230, 161, 58, 0.25);
          animation: floatUp linear infinite;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
};

export { LoginScreen };
