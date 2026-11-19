import React from 'react';

interface PiggySvgProps {
  className?: string;
  isNegative?: boolean;
}

export const PinkPiggySvg: React.FC<PiggySvgProps> = ({
  className = 'w-9 h-9',
  isNegative = false,
}) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    {/* Coin dropping in */}
    <circle cx="32" cy="11" r="6" fill="#FFD166" stroke="#B7791F" strokeWidth="1.8" />
    <text x="32" y="13.8" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#7A4F0B">
      ฿
    </text>

    {/* Piggy ears */}
    <ellipse cx="19" cy="21" rx="6" ry="8" transform="rotate(-22 19 21)" fill="#F9B4C4" stroke="#C9647D" strokeWidth="2" />
    <ellipse cx="45" cy="21" rx="6" ry="8" transform="rotate(22 45 21)" fill="#F9B4C4" stroke="#C9647D" strokeWidth="2" />

    {/* Little legs */}
    <rect x="20" y="47" width="7" height="9" rx="3.5" fill="#F49CB2" stroke="#C9647D" strokeWidth="1.8" />
    <rect x="37" y="47" width="7" height="9" rx="3.5" fill="#F49CB2" stroke="#C9647D" strokeWidth="1.8" />

    {/* Main plump body */}
    <ellipse
      cx="32"
      cy="36"
      rx="21"
      ry="16"
      fill={isNegative ? '#FFE0E4' : '#FFD1DC'}
      stroke={isNegative ? '#D9485B' : '#C9647D'}
      strokeWidth="2.2"
    />

    {/* Coin slot on top */}
    <rect x="25" y="21.5" width="14" height="3.2" rx="1.6" fill="#8C3B51" />

    {/* Rosy cheeks */}
    <ellipse cx="18" cy="39" rx="3.5" ry="2.2" fill="#F78DA7" opacity="0.6" />
    <ellipse cx="46" cy="39" rx="3.5" ry="2.2" fill="#F78DA7" opacity="0.6" />

    {/* Eyes */}
    {isNegative ? (
      <>
        <path d="M21 31 L25 33.5 L21 36" fill="none" stroke="#6B2231" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M43 31 L39 33.5 L43 36" fill="none" stroke="#6B2231" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <circle cx="22.5" cy="33" r="2.3" fill="#3D322C" />
        <circle cx="41.5" cy="33" r="2.3" fill="#3D322C" />
        <circle cx="21.8" cy="32.2" r="0.8" fill="#FFFFFF" />
        <circle cx="40.8" cy="32.2" r="0.8" fill="#FFFFFF" />
      </>
    )}

    {/* Cute snout */}
    <ellipse cx="32" cy="40" rx="7.5" ry="5.5" fill="#F9B4C4" stroke="#C9647D" strokeWidth="1.8" />
    <circle cx="29.5" cy="40" r="1.2" fill="#9E4259" />
    <circle cx="34.5" cy="40" r="1.2" fill="#9E4259" />
  </svg>
);

export const GoldenPiggySvg: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    {/* Sparkles */}
    <text x="8" y="17" fontSize="9">✨</text>
    <text x="48" y="17" fontSize="9">✨</text>

    {/* Coin dropping in */}
    <circle cx="32" cy="11" r="6" fill="#FFF3B0" stroke="#B7791F" strokeWidth="1.8" />
    <text x="32" y="13.8" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#7A4F0B">
      ★
    </text>

    {/* Ears */}
    <ellipse cx="19" cy="21" rx="6" ry="8" transform="rotate(-22 19 21)" fill="#FAD66B" stroke="#B7791F" strokeWidth="2" />
    <ellipse cx="45" cy="21" rx="6" ry="8" transform="rotate(22 45 21)" fill="#FAD66B" stroke="#B7791F" strokeWidth="2" />

    {/* Little legs */}
    <rect x="20" y="47" width="7" height="9" rx="3.5" fill="#F4C542" stroke="#B7791F" strokeWidth="1.8" />
    <rect x="37" y="47" width="7" height="9" rx="3.5" fill="#F4C542" stroke="#B7791F" strokeWidth="1.8" />

    {/* Golden plump body */}
    <ellipse cx="32" cy="36" rx="21" ry="16" fill="#FFE680" stroke="#B7791F" strokeWidth="2.2" />
    <path d="M18 28 Q26 23 36 25" fill="none" stroke="#FFF9D6" strokeWidth="2.5" strokeLinecap="round" />

    {/* Coin slot */}
    <rect x="25" y="21.5" width="14" height="3.2" rx="1.6" fill="#7A4F0B" />

    {/* Eyes */}
    <circle cx="22.5" cy="33" r="2.3" fill="#3D322C" />
    <circle cx="41.5" cy="33" r="2.3" fill="#3D322C" />
    <circle cx="21.8" cy="32.2" r="0.8" fill="#FFFFFF" />
    <circle cx="40.8" cy="32.2" r="0.8" fill="#FFFFFF" />

    {/* Snout */}
    <ellipse cx="32" cy="40" rx="7.5" ry="5.5" fill="#FAD66B" stroke="#B7791F" strokeWidth="1.8" />
    <circle cx="29.5" cy="40" r="1.2" fill="#8C590C" />
    <circle cx="34.5" cy="40" r="1.2" fill="#8C590C" />
  </svg>
);
