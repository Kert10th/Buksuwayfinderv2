export function BrandLogo() {
  return (
    <div className="flex items-center gap-4">
      {/* The Logo SVG */}
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 drop-shadow-lg">
        {/* Shield/Background */}
        <path d="M100 180C140 160 170 120 170 80C170 45 140 20 100 20C60 20 30 45 30 80C30 120 60 160 100 180Z" fill="#001C38"/>
        
        {/* Mortarboard / Grad Cap shape integrated */}
        <path d="M100 45L150 70L100 95L50 70L100 45Z" fill="#E6A13A"/>
        <path d="M150 70V90" stroke="#E6A13A" strokeWidth="3"/>
        
        {/* Location Pin Shape intersecting */}
        <path d="M100 105C108.284 105 115 98.2843 115 90C115 81.7157 108.284 75 100 75C91.7157 75 85 81.7157 85 90C85 98.2843 91.7157 105 100 105Z" fill="#003566"/>
        <path d="M100 150L85 110H115L100 150Z" fill="#E6A13A"/>
      </svg>
      
      {/* Brand Text */}
      <div className="flex flex-col">
        <h1 className="text-white text-2xl font-bold">
          Bukidnon State University Wayfinder
        </h1>
        <p className="text-[#E6A13A] text-xs tracking-[0.25em] uppercase font-semibold">
          Innovate, Educate, Lead
        </p>
        <p className="text-white/60 text-xs mt-1">
          Malaybalay City, Bukidnon, 8700, Philippines
        </p>
      </div>
    </div>
  );
}