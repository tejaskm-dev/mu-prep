// Hand-built SVG illustrations so the banners don't depend on stock photos.

export function StudyStackIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 290 210" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="ss-floor" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d4ecc0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#d4ecc0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ss-folder" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#2a6b3a" />
          <stop offset="1" stopColor="#173d22" />
        </linearGradient>
        <filter id="ss-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#1d3b1d" floodOpacity="0.16" />
        </filter>
      </defs>
      <path d="M40 200h220l-30-26H70z" fill="url(#ss-floor)" />
      {/* tall dark folder */}
      <g transform="rotate(-3 205 104)" filter="url(#ss-shadow)">
        <path d="M168 24a9 9 0 0 1 9-9h26l9 9h26a9 9 0 0 1 9 9v150a9 9 0 0 1-9 9h-61a9 9 0 0 1-9-9z" fill="url(#ss-folder)" />
      </g>
      {/* white paper leaning right */}
      <g transform="rotate(7 214 112)" filter="url(#ss-shadow)">
        <rect x="178" y="40" width="86" height="132" rx="6" fill="#fff" />
        <rect x="190" y="56" width="26" height="5" rx="2.5" fill="#3faa48" />
        {[70, 80, 90, 100].map((y, i) => (
          <rect key={y} x="190" y={y} width={[58, 50, 60, 44][i]} height="3.4" rx="1.7" fill="#cfe5c2" />
        ))}
        <rect x="190" y="116" width="20" height="5" rx="2.5" fill="#3faa48" />
        {[130, 140, 150].map((y, i) => (
          <rect key={y} x="190" y={y} width={[52, 60, 38][i]} height="3.4" rx="1.7" fill="#cfe5c2" />
        ))}
      </g>
      {/* light green panel */}
      <rect x="108" y="70" width="84" height="122" rx="7" fill="#d6eec3" filter="url(#ss-shadow)" />
      <rect x="120" y="86" width="40" height="4" rx="2" fill="#a9d68c" />
      <rect x="120" y="96" width="56" height="4" rx="2" fill="#bfe1a7" />
      {/* front paper */}
      <g transform="rotate(-7 128 146)" filter="url(#ss-shadow)">
        <rect x="92" y="98" width="76" height="98" rx="5" fill="#fff" />
        <rect x="103" y="111" width="24" height="5" rx="2.5" fill="#3faa48" />
        {[124, 133, 142, 151, 160, 169].map((y, i) => (
          <rect key={y} x="103" y={y} width={[52, 44, 54, 36, 48, 40][i]} height="3.2" rx="1.6" fill="#d7e8cc" />
        ))}
      </g>
      {/* little spark strokes */}
      <path d="M120 44l9 15M141 38l-1.5 18M103 58l15 5" stroke="#3faa48" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

export function BookStackIllustration({ className }: { className?: string }) {
  const books = [
    { y: 168, x: 26, w: 250, h: 30, cover: "#2b2b28", band: "#c8a96a" },
    { y: 140, x: 42, w: 232, h: 28, cover: "#5a3a22", band: "#d9b779" },
    { y: 114, x: 30, w: 240, h: 26, cover: "#21412c", band: "#c9b27c" },
    { y: 88, x: 52, w: 222, h: 26, cover: "#3b3b36", band: "#bfa064" },
    { y: 60, x: 38, w: 234, h: 28, cover: "#284a35", band: "#d4b674" },
    { y: 34, x: 60, w: 212, h: 26, cover: "#6b4426", band: "#d8bb80" },
  ];
  return (
    <svg viewBox="0 0 300 210" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="bs-pages" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f3ead2" />
          <stop offset="1" stopColor="#d9ccab" />
        </linearGradient>
        <radialGradient id="bs-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#3f6b3a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3f6b3a" stopOpacity="0" />
        </radialGradient>
        <filter id="bs-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      {/* out-of-focus plant */}
      <g filter="url(#bs-blur)" opacity="0.75">
        <ellipse cx="22" cy="120" rx="30" ry="46" fill="url(#bs-glow)" />
        <ellipse cx="8" cy="170" rx="26" ry="30" fill="#2f5a2c" opacity="0.6" />
      </g>
      {books.map((b, i) => (
        <g key={i} transform={`rotate(${i % 2 ? -1.2 : 0.8} ${b.x + b.w / 2} ${b.y + b.h / 2})`}>
          {/* page block */}
          <rect x={b.x + 6} y={b.y + 3} width={b.w - 6} height={b.h - 6} rx="2" fill="url(#bs-pages)" />
          {[0.3, 0.5, 0.7].map((t) => (
            <rect key={t} x={b.x + 8} y={b.y + 3 + (b.h - 6) * t} width={b.w - 12} height="0.8" fill="#bfae86" opacity="0.7" />
          ))}
          {/* cover (front edge) */}
          <rect x={b.x} y={b.y} width="16" height={b.h} rx="3" fill={b.cover} />
          <rect x={b.x} y={b.y} width={b.w} height="3.5" rx="1.5" fill={b.cover} />
          <rect x={b.x} y={b.y + b.h - 3.5} width={b.w} height="3.5" rx="1.5" fill={b.cover} />
          <rect x={b.x + 3} y={b.y + 5} width="2.2" height={b.h - 10} rx="1" fill={b.band} opacity="0.8" />
          <rect x={b.x + 9} y={b.y + 5} width="2.2" height={b.h - 10} rx="1" fill={b.band} opacity="0.8" />
        </g>
      ))}
    </svg>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M16 2c.9 6.7 4.3 10.6 13 14-8.7 3.4-12.1 7.3-13 14-.9-6.7-4.3-10.6-13-14 8.7-3.4 12.1-7.3 13-14z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Squiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 16" fill="none" className={className} aria-hidden>
      <path d="M3 12c22-6 58-10 114-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
