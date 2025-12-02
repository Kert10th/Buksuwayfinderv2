export function UniversityLogo() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer Circle */}
      <circle cx="40" cy="40" r="38" stroke="#E6A13A" strokeWidth="2" fill="#001C38"/>
      
      {/* Inner Circle */}
      <circle cx="40" cy="40" r="32" stroke="#E6A13A" strokeWidth="1.5" fill="none"/>
      
      {/* Graduation Cap */}
      <path 
        d="M 25 38 L 40 32 L 55 38 L 40 44 Z" 
        fill="#E6A13A"
      />
      <path 
        d="M 40 44 L 40 52 L 45 54 L 45 46" 
        stroke="#E6A13A" 
        strokeWidth="1.5" 
        fill="none"
      />
      
      {/* Location Pin overlay */}
      <path 
        d="M 40 48 C 40 48 35 54 35 58 C 35 60.5 37.5 62 40 62 C 42.5 62 45 60.5 45 58 C 45 54 40 48 40 48 Z" 
        fill="#E6A13A"
      />
      <circle cx="40" cy="56" r="2" fill="#001C38"/>
      
      {/* Decorative elements - small stars */}
      <circle cx="20" cy="25" r="1.5" fill="#E6A13A"/>
      <circle cx="60" cy="25" r="1.5" fill="#E6A13A"/>
      <circle cx="25" cy="55" r="1.5" fill="#E6A13A"/>
      <circle cx="55" cy="55" r="1.5" fill="#E6A13A"/>
      
      {/* Text curve on top */}
      <path 
        id="curve" 
        d="M 15 40 A 25 25 0 0 1 65 40" 
        fill="none"
      />
      <text fill="#E6A13A" fontSize="6">
        <textPath href="#curve" startOffset="50%" textAnchor="middle">
          BUKIDNON STATE
        </textPath>
      </text>
    </svg>
  );
}
