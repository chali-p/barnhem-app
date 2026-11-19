import React from 'react';
import { PetCompanionConfig } from '../types/barnhem';
import { PET_COATS } from '../utils/petCare';

interface PetCanvasSvgProps {
  pet: PetCompanionConfig;
  mood?: 'happy' | 'hungry' | 'lonely';
  sizeClass?: string;
}

export const PetCanvasSvg: React.FC<PetCanvasSvgProps> = ({
  pet,
  mood = 'happy',
  sizeClass = 'w-20 h-20',
}) => {
  const coat = PET_COATS.find((c) => c.id === pet.coat) ?? PET_COATS[0];
  const isDog = pet.species === 'dog';

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${sizeClass} drop-shadow-xs select-none`}
      aria-label={`${pet.species === 'dog' ? 'Puppy' : 'Kitten'} ${pet.name}`}
    >
      {/* Floor shadow */}
      <ellipse cx="60" cy="108" rx="34" ry="6.5" fill="rgba(61,50,44,0.12)" />

      {/* Hero Cape behind pet */}
      {pet.outfit === 'cape_hero' && (
        <path
          d="M36 68 L20 100 Q60 108 100 100 L84 68 Z"
          fill="#FF8FAB"
          stroke="#C24667"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}

      {/* Wagging / Curled Tail */}
      {isDog ? (
        <path
          d="M84 86 Q104 72 99 58"
          fill="none"
          stroke={coat.ear}
          strokeWidth="8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M84 92 Q107 88 105 64 Q103 55 96 58"
          fill="none"
          stroke={coat.ear}
          strokeWidth="7"
          strokeLinecap="round"
        />
      )}

      {/* Back Ears */}
      {isDog ? (
        <>
          <ellipse
            cx="29"
            cy="49"
            rx="11"
            ry="20"
            transform="rotate(16 29 49)"
            fill={coat.ear}
            stroke="#3D322C"
            strokeWidth="2.2"
          />
          <ellipse
            cx="91"
            cy="49"
            rx="11"
            ry="20"
            transform="rotate(-16 91 49)"
            fill={coat.ear}
            stroke="#3D322C"
            strokeWidth="2.2"
          />
        </>
      ) : (
        <>
          <polygon
            points="31,42 36,15 54,32"
            fill={coat.body}
            stroke="#3D322C"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <polygon points="36,38 39,21 50,32" fill="#FADADD" />
          <polygon
            points="89,42 84,15 66,32"
            fill={coat.body}
            stroke="#3D322C"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <polygon points="84,38 81,21 70,32" fill="#FADADD" />
        </>
      )}

      {/* Body */}
      <ellipse
        cx="60"
        cy="86"
        rx="26"
        ry="21"
        fill={coat.body}
        stroke="#3D322C"
        strokeWidth="2.3"
      />

      {/* Coat Spot on Body */}
      {coat.spot && (
        <ellipse cx="73" cy="86" rx="9" ry="7" fill={coat.spot} opacity="0.85" />
      )}

      {/* Star Hoodie Outfit */}
      {pet.outfit === 'hoodie_star' && (
        <g>
          <path
            d="M36 74 Q60 66 84 74 L86 98 Q60 105 34 98 Z"
            fill="#DCD0F7"
            stroke="#5E468E"
            strokeWidth="2"
          />
          <text x="60" y="92" textAnchor="middle" fontSize="13">
            ⭐
          </text>
        </g>
      )}

      {/* Paws */}
      <ellipse cx="45" cy="102" rx="7.5" ry="5.5" fill={coat.muzzle} stroke="#3D322C" strokeWidth="2" />
      <ellipse cx="75" cy="102" rx="7.5" ry="5.5" fill={coat.muzzle} stroke="#3D322C" strokeWidth="2" />

      {/* Collar / Scarf / Bow */}
      {pet.outfit === 'collar_heart' && (
        <g>
          <path d="M40 70 Q60 78 80 70" fill="none" stroke="#E85A71" strokeWidth="5.5" strokeLinecap="round" />
          <circle cx="60" cy="77" r="5" fill="#FFD166" stroke="#3D322C" strokeWidth="1.5" />
        </g>
      )}
      {pet.outfit === 'scarf_mint' && (
        <g>
          <path d="M38 69 Q60 79 82 69" fill="none" stroke="#62C7B5" strokeWidth="8" strokeLinecap="round" />
          <rect x="64" y="72" width="9" height="16" rx="4" fill="#62C7B5" stroke="#267365" strokeWidth="1.5" />
        </g>
      )}
      {pet.outfit === 'ribbon_pink' && (
        <g transform="translate(60,72)">
          <polygon points="0,0 -11,-6 -11,6" fill="#F99BB3" stroke="#C24667" strokeWidth="1.5" />
          <polygon points="0,0 11,-6 11,6" fill="#F99BB3" stroke="#C24667" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="3.5" fill="#FFE5EC" stroke="#C24667" strokeWidth="1.5" />
        </g>
      )}

      {/* Head */}
      <ellipse
        cx="60"
        cy="49"
        rx="28"
        ry="24"
        fill={coat.body}
        stroke="#3D322C"
        strokeWidth="2.3"
      />

      {/* Head Spot for spotted/calico */}
      {coat.spot && (
        <ellipse cx="44" cy="41" rx="8" ry="6.5" fill={coat.spot} opacity="0.82" />
      )}

      {/* Muzzle */}
      <ellipse cx="60" cy="57" rx="13" ry="9" fill={coat.muzzle} />

      {/* Eyes based on mood */}
      {mood === 'happy' ? (
        <>
          <circle cx="48" cy="46" r="4.2" fill="#2E231D" />
          <circle cx="72" cy="46" r="4.2" fill="#2E231D" />
          <circle cx="46.8" cy="44.6" r="1.5" fill="#FFFFFF" />
          <circle cx="70.8" cy="44.6" r="1.5" fill="#FFFFFF" />
        </>
      ) : (
        <>
          <circle cx="48" cy="47" r="4" fill="#2E231D" />
          <circle cx="72" cy="47" r="4" fill="#2E231D" />
          <circle cx="49" cy="46" r="1.6" fill="#FFFFFF" />
          <circle cx="73" cy="46" r="1.6" fill="#FFFFFF" />
          <path d="M43 40 L52 43" stroke="#3D322C" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M77 40 L68 43" stroke="#3D322C" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}

      {/* Cheeks */}
      <ellipse cx="40" cy="53" rx="4.5" ry="2.6" fill="#F79BB4" opacity="0.72" />
      <ellipse cx="80" cy="53" rx="4.5" ry="2.6" fill="#F79BB4" opacity="0.72" />

      {/* Nose & Mouth */}
      {isDog ? (
        <ellipse cx="60" cy="53.5" rx="4.5" ry="3.2" fill="#3D322C" />
      ) : (
        <polygon points="56.5,52 63.5,52 60,56" fill="#F2849E" />
      )}
      <path d="M54 58 Q57 62 60 58 Q63 62 66 58" fill="none" stroke="#3D322C" strokeWidth="2" strokeLinecap="round" />

      {/* Cat Whiskers */}
      {!isDog && (
        <g stroke="#7B695F" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
          <line x1="28" y1="52" x2="39" y2="54" />
          <line x1="28" y1="58" x2="39" y2="58" />
          <line x1="92" y1="52" x2="81" y2="54" />
          <line x1="92" y1="58" x2="81" y2="58" />
        </g>
      )}

      {/* Cool Shades Outfit */}
      {pet.outfit === 'glasses_cool' && (
        <g>
          <rect x="38" y="40" width="18" height="11" rx="4" fill="#2E231D" opacity="0.88" />
          <rect x="64" y="40" width="18" height="11" rx="4" fill="#2E231D" opacity="0.88" />
          <line x1="56" y1="45" x2="64" y2="45" stroke="#2E231D" strokeWidth="2.5" />
        </g>
      )}

      {/* Straw Hat Outfit */}
      {pet.outfit === 'hat_straw' && (
        <g>
          <ellipse cx="60" cy="27" rx="28" ry="6.5" fill="#FCE192" stroke="#8C6720" strokeWidth="1.8" />
          <path d="M44 26 C46 12, 74 12, 76 26 Z" fill="#FCE192" stroke="#8C6720" strokeWidth="1.8" />
          <path d="M44 24 Q60 28 76 24" fill="none" stroke="#E86F87" strokeWidth="3.5" />
        </g>
      )}

      {/* Cute Status Sparkle */}
      {mood === 'happy' && (
        <text x="95" y="26" fontSize="14">
          💖
        </text>
      )}
      {mood === 'hungry' && (
        <text x="92" y="26" fontSize="14">
          🥣
        </text>
      )}
      {mood === 'lonely' && (
        <text x="92" y="26" fontSize="14">
          💭
        </text>
      )}
    </svg>
  );
};
