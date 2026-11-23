import React from 'react';
import { PetCompanionConfig } from '../types/barnhem';
import { getPetSpeciesInfo, PET_COATS } from '../utils/petCare';

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
  const species = pet.species;
  const info = getPetSpeciesInfo(species);

  const isBird = species === 'penguin' || species === 'duck';
  const isPanda = species === 'panda';
  const isShiba = species === 'shiba';
  const isFox = species === 'fox';
  const isCapybara = species === 'capybara';

  // Effective colors for distinctive breed silhouettes while still honoring chosen coat
  const primaryBody = isPanda ? '#FFFFFF' : coat.body;
  const earTone = isPanda ? '#3A322F' : isFox ? '#D86B3D' : coat.ear;
  const tummyColor = isPenguinOrDuckColor(species, coat.muzzle);
  const eyePatchColor = isPanda ? '#3A322F' : undefined;

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${sizeClass} drop-shadow-xs select-none`}
      aria-label={`${info.nameEn} ${pet.name}`}
    >
      {/* Floor shadow */}
      <ellipse cx="60" cy="109" rx="34" ry="6" fill="rgba(61,50,44,0.12)" />

      {/* Hero Cape behind pet */}
      {pet.outfit === 'cape_hero' && (
        <path
          d="M35 68 L19 101 Q60 109 101 101 L85 68 Z"
          fill="#FF8FAB"
          stroke="#C24667"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      )}

      {/* Tail per species */}
      {species === 'dog' && (
        <path
          d="M84 86 Q104 72 99 58"
          fill="none"
          stroke={earTone}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}
      {species === 'shiba' && (
        <path
          d="M83 84 Q107 72 99 53 Q93 48 88 57"
          fill="none"
          stroke={coat.body}
          strokeWidth="10"
          strokeLinecap="round"
        />
      )}
      {species === 'cat' && (
        <path
          d="M84 92 Q107 88 105 64 Q103 55 96 58"
          fill="none"
          stroke={earTone}
          strokeWidth="7"
          strokeLinecap="round"
        />
      )}
      {species === 'rabbit' && (
        <circle
          cx="88"
          cy="91"
          r="7.5"
          fill="#FFFDF9"
          stroke="#3D322C"
          strokeWidth="2"
        />
      )}
      {species === 'hamster' && (
        <circle cx="86" cy="94" r="5" fill={coat.ear} stroke="#3D322C" strokeWidth="1.8" />
      )}
      {species === 'panda' && (
        <circle cx="87" cy="92" r="6" fill="#3A322F" stroke="#3D322C" strokeWidth="1.8" />
      )}
      {species === 'fox' && (
        <g>
          <path
            d="M80 90 Q111 85 107 58 Q96 54 88 73"
            fill={coat.body}
            stroke="#3D322C"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M101 66 Q108 60 107 58 Q99 56 95 64 Z"
            fill="#FFFDF9"
          />
        </g>
      )}
      {species === 'duck' && (
        <polygon points="82,88 97,81 86,96" fill={coat.body} stroke="#3D322C" strokeWidth="2" strokeLinejoin="round" />
      )}

      {/* Back Ears / Head Tuft */}
      {species === 'dog' && (
        <>
          <ellipse
            cx="29"
            cy="49"
            rx="11"
            ry="20"
            transform="rotate(16 29 49)"
            fill={earTone}
            stroke="#3D322C"
            strokeWidth="2.2"
          />
          <ellipse
            cx="91"
            cy="49"
            rx="11"
            ry="20"
            transform="rotate(-16 91 49)"
            fill={earTone}
            stroke="#3D322C"
            strokeWidth="2.2"
          />
        </>
      )}

      {(species === 'cat' || species === 'shiba' || species === 'fox') && (
        <>
          <polygon
            points={isFox ? '29,43 32,10 53,31' : '31,42 36,15 54,32'}
            fill={isShiba ? coat.body : primaryBody}
            stroke="#3D322C"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <polygon
            points={isFox ? '34,37 35,17 48,31' : '36,38 39,21 50,32'}
            fill={isFox ? '#3D322C' : '#FADADD'}
          />
          <polygon
            points={isFox ? '91,43 88,10 67,31' : '89,42 84,15 66,32'}
            fill={isShiba ? coat.body : primaryBody}
            stroke="#3D322C"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <polygon
            points={isFox ? '86,37 85,17 72,31' : '84,38 81,21 70,32'}
            fill={isFox ? '#3D322C' : '#FADADD'}
          />
        </>
      )}

      {species === 'rabbit' && (
        <>
          <ellipse
            cx="44"
            cy="22"
            rx="8.5"
            ry="19"
            transform="rotate(-10 44 22)"
            fill={primaryBody}
            stroke="#3D322C"
            strokeWidth="2.2"
          />
          <ellipse
            cx="44"
            cy="23"
            rx="4.3"
            ry="13"
            transform="rotate(-10 44 23)"
            fill="#FADADD"
          />
          <ellipse
            cx="76"
            cy="22"
            rx="8.5"
            ry="19"
            transform="rotate(10 76 22)"
            fill={primaryBody}
            stroke="#3D322C"
            strokeWidth="2.2"
          />
          <ellipse
            cx="76"
            cy="23"
            rx="4.3"
            ry="13"
            transform="rotate(10 76 23)"
            fill="#FADADD"
          />
        </>
      )}

      {(species === 'hamster' || species === 'panda') && (
        <>
          <circle cx="36" cy="29" r="9.5" fill={earTone} stroke="#3D322C" strokeWidth="2.2" />
          {species === 'hamster' && <circle cx="36" cy="29" r="4.8" fill="#FADADD" />}
          <circle cx="84" cy="29" r="9.5" fill={earTone} stroke="#3D322C" strokeWidth="2.2" />
          {species === 'hamster' && <circle cx="84" cy="29" r="4.8" fill="#FADADD" />}
        </>
      )}

      {species === 'capybara' && (
        <>
          <ellipse cx="34" cy="33" rx="6" ry="7.5" transform="rotate(-24 34 33)" fill={earTone} stroke="#3D322C" strokeWidth="2" />
          <ellipse cx="86" cy="33" rx="6" ry="7.5" transform="rotate(24 86 33)" fill={earTone} stroke="#3D322C" strokeWidth="2" />
        </>
      )}

      {species === 'duck' && (
        <path
          d="M57 25 Q54 14 61 18 Q65 12 65 25"
          fill={coat.body}
          stroke="#3D322C"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {/* Penguin / Duck Wings / Flippers */}
      {isBird && (
        <>
          <ellipse
            cx="31"
            cy="83"
            rx="7"
            ry="15"
            transform="rotate(24 31 83)"
            fill={species === 'penguin' ? coat.body : coat.ear}
            stroke="#3D322C"
            strokeWidth="2"
          />
          <ellipse
            cx="89"
            cy="83"
            rx="7"
            ry="15"
            transform="rotate(-24 89 83)"
            fill={species === 'penguin' ? coat.body : coat.ear}
            stroke="#3D322C"
            strokeWidth="2"
          />
        </>
      )}

      {/* Body */}
      <ellipse
        cx="60"
        cy="86"
        rx={isCapybara ? 28 : 26}
        ry="21"
        fill={primaryBody}
        stroke="#3D322C"
        strokeWidth="2.3"
      />

      {/* Panda Dark Shoulder Band */}
      {isPanda && (
        <path
          d="M36 78 Q60 88 84 78 Q84 68 60 66 Q36 68 36 78 Z"
          fill="#3A322F"
        />
      )}

      {/* Belly Patch (Penguin, Shiba, Hamster, Rabbit, Fox) */}
      {(species === 'penguin' ||
        species === 'shiba' ||
        species === 'hamster' ||
        species === 'rabbit' ||
        species === 'fox') && (
        <ellipse cx="60" cy="88" rx="16" ry="15" fill={tummyColor} />
      )}

      {/* Coat Spot on Body for non-panda */}
      {coat.spot && !isPanda && !isBird && (
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

      {/* Feet / Paws */}
      {isBird ? (
        <>
          <ellipse cx="47" cy="105" rx="8.5" ry="4.5" fill="#FFA94D" stroke="#3D322C" strokeWidth="1.9" />
          <ellipse cx="73" cy="105" rx="8.5" ry="4.5" fill="#FFA94D" stroke="#3D322C" strokeWidth="1.9" />
        </>
      ) : (
        <>
          <ellipse
            cx="45"
            cy="102"
            rx="7.5"
            ry="5.5"
            fill={isPanda ? '#3A322F' : coat.muzzle}
            stroke="#3D322C"
            strokeWidth="2"
          />
          <ellipse
            cx="75"
            cy="102"
            rx="7.5"
            ry="5.5"
            fill={isPanda ? '#3A322F' : coat.muzzle}
            stroke="#3D322C"
            strokeWidth="2"
          />
        </>
      )}

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
        rx={isCapybara ? 29 : 28}
        ry={isCapybara ? 22.5 : 24}
        fill={primaryBody}
        stroke="#3D322C"
        strokeWidth="2.3"
      />

      {/* Penguin Face Mask */}
      {species === 'penguin' && (
        <path
          d="M39 50 C39 36, 53 33, 60 41 C67 33, 81 36, 81 50 C81 62, 71 69, 60 69 C49 69, 39 62, 39 50 Z"
          fill="#FFFDF9"
        />
      )}

      {/* Shiba / Fox Cheek Mask */}
      {(isShiba || isFox) && (
        <path
          d="M34 51 Q46 47 60 55 Q74 47 86 51 Q84 68 60 70 Q36 68 34 51 Z"
          fill="#FFF8F0"
        />
      )}

      {/* Capybara Cozy Yuzu Orange on Head when Happy */}
      {isCapybara && pet.outfit !== 'hat_straw' && (
        <g>
          <circle cx="60" cy="22" r="7.5" fill="#FFA94D" stroke="#B86214" strokeWidth="1.8" />
          <ellipse cx="64" cy="16" rx="4" ry="2.2" transform="rotate(-25 64 16)" fill="#5E9E47" />
        </g>
      )}

      {/* Head Spot for spotted/calico */}
      {coat.spot && !isPanda && !isBird && (
        <ellipse cx="44" cy="41" rx="8" ry="6.5" fill={coat.spot} opacity="0.82" />
      )}

      {/* Panda Eye Patches */}
      {eyePatchColor && (
        <>
          <ellipse cx="47" cy="47" rx="7.5" ry="6.2" transform="rotate(-16 47 47)" fill={eyePatchColor} />
          <ellipse cx="73" cy="47" rx="7.5" ry="6.2" transform="rotate(16 73 47)" fill={eyePatchColor} />
        </>
      )}

      {/* Muzzle */}
      {!isBird && (
        <ellipse
          cx="60"
          cy={isCapybara ? 56 : 57}
          rx={isCapybara ? 14 : 13}
          ry={isCapybara ? 10 : 9}
          fill={isCapybara ? coat.ear : coat.muzzle}
          opacity={isCapybara ? 0.55 : 1}
        />
      )}

      {/* Shiba Cute Eyebrow Dots */}
      {isShiba && (
        <>
          <circle cx="48" cy="38" r="2.3" fill="#FFFDF9" />
          <circle cx="72" cy="38" r="2.3" fill="#FFFDF9" />
        </>
      )}

      {/* Eyes based on mood & species */}
      {isCapybara && mood === 'happy' ? (
        <>
          <path d="M43 46 Q48 49 53 46" fill="none" stroke="#2E231D" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M67 46 Q72 49 77 46" fill="none" stroke="#2E231D" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : mood === 'happy' ? (
        <>
          <circle cx="48" cy="46" r="4.2" fill={isPanda ? '#111111' : '#2E231D'} />
          <circle cx="72" cy="46" r="4.2" fill={isPanda ? '#111111' : '#2E231D'} />
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

      {/* Cheeks (extra rosy for Hamster) */}
      <ellipse
        cx="39"
        cy="53"
        rx={species === 'hamster' ? 6.5 : 4.5}
        ry={species === 'hamster' ? 4.2 : 2.6}
        fill="#F79BB4"
        opacity={species === 'hamster' ? 0.85 : 0.72}
      />
      <ellipse
        cx="81"
        cy="53"
        rx={species === 'hamster' ? 6.5 : 4.5}
        ry={species === 'hamster' ? 4.2 : 2.6}
        fill="#F79BB4"
        opacity={species === 'hamster' ? 0.85 : 0.72}
      />

      {/* Nose & Mouth / Beak */}
      {isBird ? (
        <g>
          <ellipse
            cx="60"
            cy="53.5"
            rx={species === 'duck' ? 8.5 : 6}
            ry={species === 'duck' ? 4.5 : 3.8}
            fill="#FFA94D"
            stroke="#3D322C"
            strokeWidth="1.7"
          />
          <path d="M54 54 Q60 56.5 66 54" fill="none" stroke="#B86214" strokeWidth="1.2" />
        </g>
      ) : (
        <>
          {species === 'cat' || species === 'rabbit' || species === 'hamster' ? (
            <polygon points="56.5,52 63.5,52 60,56" fill="#F2849E" />
          ) : (
            <ellipse
              cx="60"
              cy="53.5"
              rx={isCapybara ? 5.2 : 4.5}
              ry={isCapybara ? 3.5 : 3.2}
              fill="#3D322C"
            />
          )}
          <path
            d="M54 58 Q57 62 60 58 Q63 62 66 58"
            fill="none"
            stroke="#3D322C"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {species === 'rabbit' && (
            <rect x="57.5" y="59.8" width="5" height="3.2" rx="1" fill="#FFFFFF" stroke="#3D322C" strokeWidth="1" />
          )}
        </>
      )}

      {/* Whiskers for Cat, Rabbit, Hamster */}
      {(species === 'cat' || species === 'rabbit' || species === 'hamster') && (
        <g stroke="#7B695F" strokeWidth="1.4" strokeLinecap="round" opacity="0.72">
          <line x1="27" y1="52" x2="38" y2="54" />
          <line x1="27" y1="58" x2="38" y2="58" />
          <line x1="93" y1="52" x2="82" y2="54" />
          <line x1="93" y1="58" x2="82" y2="58" />
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

function isPenguinOrDuckColor(species: PetCompanionConfig['species'], muzzle: string): string {
  if (species === 'penguin') return '#FFFDF9';
  if (species === 'duck') return '#FFF7C2';
  return muzzle;
}
