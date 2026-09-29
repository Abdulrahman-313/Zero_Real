export function LandingLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#0F2A3F" />
      <rect x="14" y="16" width="36" height="8" rx="3" fill="#1C7C6C" />
      <rect x="14" y="28" width="24" height="8" rx="3" fill="#DCEDE9" />
      <rect x="14" y="40" width="30" height="8" rx="3" fill="#DCEDE9" opacity="0.65" />
      <circle cx="47" cy="44" r="6" fill="#1C7C6C" />
    </svg>
  );
}
