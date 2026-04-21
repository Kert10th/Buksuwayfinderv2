interface BrandLogoProps {
  darkMode?: boolean;
}

export function BrandLogo({ darkMode = true }: BrandLogoProps) {
  return (
    <div className="flex items-center min-w-0" style={{ gap: 'clamp(0.75rem, 1vw, 1.25rem)' }}>
      {/* BSU Logo */}
      <img
        src="/wayfinder-logo.png"
        alt="BukSU Wayfinder Logo"
        className="object-contain drop-shadow-lg shrink-0"
        style={{
          width: 'clamp(3rem, 4vw, 5.5rem)',
          height: 'clamp(3rem, 4vw, 5.5rem)',
        }}
      />

      {/* Brand Text - two-line title keeps header compact at narrow widths */}
      <div className="flex flex-col min-w-0 font-['Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text',system-ui,sans-serif]">
        <span
          className="font-semibold uppercase tracking-[0.2em] leading-tight"
          style={{
            fontSize: 'clamp(0.6rem, 0.7vw, 0.875rem)',
            color: darkMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 28, 56, 0.7)',
          }}
        >
          Bukidnon State University
        </span>
        <h1
          className="font-extrabold tracking-wide drop-shadow-lg leading-tight uppercase"
          style={{
            fontSize: 'clamp(1rem, 1.4vw, 1.75rem)',
            color: darkMode ? '#FFFFFF' : '#001C38',
          }}
        >
          Wayfinder
        </h1>
      </div>
    </div>
  );
}