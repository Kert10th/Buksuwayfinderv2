interface BrandLogoProps {
  darkMode?: boolean;
}

// The logo image already contains the "BukSU Wayfinder System" wordmark,
// so the component just renders the image. `darkMode` prop kept for API
// stability in case we ever add a text label back.
export function BrandLogo({ darkMode: _darkMode = true }: BrandLogoProps) {
  return (
    <img
      src="/wayfinder-logo.png"
      alt="BukSU Wayfinder System"
      className="object-contain drop-shadow-lg shrink-0 block"
      style={{
        width: 'clamp(6rem, 10vw, 11rem)',
        height: 'auto',
      }}
    />
  );
}
