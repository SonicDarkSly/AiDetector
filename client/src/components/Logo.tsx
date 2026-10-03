export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="MefIAnce" style={{ flex: '0 0 auto' }}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d52b1e" />
          <stop offset=".5" stopColor="#b0179a" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#logo-g)" />
      <circle cx="13.5" cy="13.5" r="8.6" fill="rgba(255,255,255,0.14)" stroke="#fff" strokeWidth="2.4" />
      <text
        x="13.5"
        y="16.9"
        textAnchor="middle"
        fontSize="9.6"
        fontWeight="800"
        fill="#fff"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letterSpacing="-0.3"
      >
        IA
      </text>
      <path d="M20.2 20.2l6.3 6.3" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      Mef<span className="wordmark-ia">IA</span>nce
    </span>
  );
}
