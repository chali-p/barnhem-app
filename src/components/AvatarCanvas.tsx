import React from 'react';
import { COVER_SCENES } from '../data/initialData';
import {
  AvatarConfig,
  FriendVisitActivity,
  Gender,
  Language,
  Member,
  PetCompanionConfig,
  ProfileGift,
  ShopItem,
} from '../types/barnhem';
import { PetCanvasSvg } from './PetCanvasSvg';
import { GoldenPiggySvg, PinkPiggySvg } from './PiggyBankSvg';
import { ActiveFestivalInfo } from '../utils/festivalAndEvents';

export interface VisitingBuddyDisplay {
  member: Member;
  activity: FriendVisitActivity;
  isHost: boolean; // true = buddy is visiting this kid's home, false = this kid is visiting buddy's home
}

interface AvatarCanvasProps {
  gender: Gender;
  avatar: AvatarConfig;
  activeStage: number;
  collectedSceneItems: string[];
  shopItems: ShopItem[];
  lang: Language;
  compact?: boolean;
  panoramic?: boolean;
  kidEmoji?: string;
  kidNickname?: string;
  kidFullName?: string;
  kidId?: string;
  stars?: number;
  visitingBuddy?: VisitingBuddyDisplay | null;
  pet?: PetCompanionConfig;
  petMood?: 'happy' | 'hungry' | 'lonely';
  petHunger?: number;
  activeFestival?: ActiveFestivalInfo | null;
  onOpenWardrobe?: () => void;
  onOpenFriendVisits?: () => void;
  onOpenPet?: () => void;
  onOpenProfile?: () => void;
  pendingFriendVisitCount?: number;
  pinkCoins?: number;
  weeklyPenaltyThb?: number;
  goldenPoolCoins?: number;
  onOpenPinkPiggy?: () => void;
  onOpenGoldPiggy?: () => void;
  activeGift?: ProfileGift | null;
  onOpenGift?: () => void;
  emailLocked?: boolean;
  emailBonusClaimed?: boolean;
  linkedEmail?: string;
  emailLoginBusy?: boolean;
  onOpenLinkEmailModal?: () => void;
  onSignInKidEmail?: () => void;
}

const SKIN_MAP: Record<AvatarConfig['skinTone'], string> = {
  fair: '#FFE6D5',
  warm: '#FAD2B4',
  tan: '#E2AC82',
  deep: '#AA744F',
};

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  gender,
  avatar,
  activeStage,
  collectedSceneItems,
  shopItems,
  lang,
  compact = false,
  panoramic = false,
  kidEmoji,
  kidNickname,
  kidFullName,
  kidId,
  stars,
  visitingBuddy = null,
  pet,
  petMood = 'happy',
  petHunger,
  activeFestival = null,
  onOpenWardrobe,
  onOpenFriendVisits,
  onOpenPet,
  onOpenProfile,
  pendingFriendVisitCount = 0,
  pinkCoins,
  weeklyPenaltyThb = 0,
  goldenPoolCoins,
  onOpenPinkPiggy,
  onOpenGoldPiggy,
  activeGift = null,
  onOpenGift,
  emailLocked = false,
  emailBonusClaimed = false,
  linkedEmail,
  emailLoginBusy = false,
  onOpenLinkEmailModal,
  onSignInKidEmail,
}) => {
  const scene = COVER_SCENES.find((s) => s.stage === activeStage) ?? COVER_SCENES[0];
  const stageItems = shopItems.filter(
    (item) => item.subType === 'scene_item' && item.sceneStage === activeStage
  );
  const collectedInStage = stageItems.filter((item) => collectedSceneItems.includes(item.id));

  const renderCharacterSvg = (
    charGender: Gender,
    charAvatar: AvatarConfig,
    sizeClass: string,
    prefix: string
  ) => {
    const equippedCasual = shopItems.find((i) => i.id === charAvatar.equippedCasualId);
    const equippedFestival =
      shopItems.find((i) => i.id === charAvatar.equippedFestivalId) ??
      (activeFestival ? shopItems.find((i) => i.id === activeFestival.defaultOutfitId) : undefined);
    const equippedFestivalProp = shopItems.find((i) => i.id === charAvatar.equippedFestivalPropId);
    const equippedBag = shopItems.find((i) => i.id === charAvatar.equippedBagId);
    const equippedHat = shopItems.find((i) => i.id === charAvatar.equippedHatId);
    const equippedGlasses = shopItems.find((i) => i.id === charAvatar.equippedGlassesId);
    const equippedCosmetic = shopItems.find((i) => i.id === charAvatar.equippedCosmeticId);

    const skin = SKIN_MAP[charAvatar.skinTone];
    const torsoWidth = charAvatar.bodyType === 'slim' ? 50 : charAvatar.bodyType === 'sturdy' ? 66 : 58;
    const torsoX = 100 - torsoWidth / 2;

    const custom = charAvatar.customOutfit ?? {
      style: 'hoodie',
      primaryColor: '#FADADD',
      secondaryColor: '#FFF5BA',
      pattern: 'stars',
      emblem: '🌸',
    };

    const isFestivalMode = charAvatar.outfitMode === 'festival';

    const activeVariant =
      charAvatar.outfitMode === 'custom_design'
        ? custom.style
        : isFestivalMode
        ? equippedFestival?.outfitVariant ?? 'thai_festive'
        : equippedCasual?.outfitVariant ?? 'hoodie';

    const activePrimary =
      charAvatar.outfitMode === 'custom_design'
        ? custom.primaryColor
        : isFestivalMode
        ? equippedFestival?.colorHex ?? activeFestival?.primaryColor ?? '#F6D6E3'
        : equippedCasual?.colorHex ?? '#FADADD';

    const activeSecondary =
      charAvatar.outfitMode === 'custom_design'
        ? custom.secondaryColor
        : isFestivalMode
        ? equippedFestival?.secondaryColorHex ?? activeFestival?.secondaryColor ?? '#D49A45'
        : equippedCasual?.secondaryColorHex ?? '#5E548E';

    const dotsPatternId = `${prefix}_dots`;
    const stripesPatternId = `${prefix}_stripes`;

    return (
      <svg
        viewBox="0 0 200 230"
        className={`${sizeClass} drop-shadow-sm`}
        aria-label="Anime Character Avatar"
      >
        <defs>
          <pattern id={dotsPatternId} width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1.6" fill="#FFFFFF" opacity="0.65" />
          </pattern>
          <pattern id={stripesPatternId} width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.45" />
          </pattern>
        </defs>

        {/* Soft floor shadow */}
        <ellipse cx="100" cy="214" rx="44" ry="8" fill="rgba(61,50,44,0.12)" />

        {/* School Bag behind character */}
        {equippedBag && (
          <g>
            <rect
              x="61"
              y="108"
              width="78"
              height="54"
              rx="15"
              fill={equippedBag.colorHex ?? '#8EC5E8'}
              stroke="#3D322C"
              strokeWidth="2.2"
            />
            <path d="M77 108 L80 146" stroke="#3D322C" strokeWidth="2.8" strokeLinecap="round" opacity="0.32" />
            <path d="M123 108 L120 146" stroke="#3D322C" strokeWidth="2.8" strokeLinecap="round" opacity="0.32" />
            {equippedBag.id === 'wardrobe_bag_bunny' && (
              <>
                <ellipse cx="69" cy="97" rx="5.5" ry="13" fill="#F9DEC9" stroke="#3D322C" strokeWidth="1.8" />
                <ellipse cx="131" cy="97" rx="5.5" ry="13" fill="#F9DEC9" stroke="#3D322C" strokeWidth="1.8" />
              </>
            )}
          </g>
        )}

        {/* Back Anime Tied Hair */}
        {charAvatar.hairStyle === 'tied_ponytail' && (
          <g>
            <path
              d="M124 44 C156 42, 166 96, 138 122 C134 102, 130 80, 120 62 Z"
              fill={charAvatar.hairColor}
            />
            <circle cx="129" cy="52" r="6" fill="#FADADD" stroke="#E86F87" strokeWidth="1.5" />
          </g>
        )}
        {charAvatar.hairStyle === 'tied_bun' && (
          <>
            <circle cx="62" cy="40" r="14" fill={charAvatar.hairColor} />
            <circle cx="138" cy="40" r="14" fill={charAvatar.hairColor} />
            <circle cx="66" cy="48" r="4" fill="#FADADD" />
            <circle cx="134" cy="48" r="4" fill="#FADADD" />
          </>
        )}

        {/* Legs */}
        <rect x="79" y="168" width="15" height="36" rx="7.5" fill={skin} />
        <rect x="106" y="168" width="15" height="36" rx="7.5" fill={skin} />

        {/* Anime Socks & Shoes */}
        {charAvatar.outfitMode !== 'lounge' ? (
          <>
            <rect x="78" y="187" width="17" height="14" rx="4" fill="#FFFFFF" />
            <rect x="105" y="187" width="17" height="14" rx="4" fill="#FFFFFF" />
            <rect x="76" y="198" width="21" height="12" rx="6" fill="#3D322C" />
            <rect x="103" y="198" width="21" height="12" rx="6" fill="#3D322C" />
          </>
        ) : (
          <>
            <rect x="77" y="199" width="19" height="9" rx="4.5" fill="#FADADD" />
            <rect x="104" y="199" width="19" height="9" rx="4.5" fill="#FADADD" />
          </>
        )}

        {/* Arms */}
        <rect x={torsoX - 13} y="114" width="14" height="42" rx="7" fill={skin} />
        <rect x={torsoX + torsoWidth - 1} y="114" width="14" height="42" rx="7" fill={skin} />

        {/* OUTFIT MODE 1: LOUNGE */}
        {charAvatar.outfitMode === 'lounge' && (
          <g>
            <rect x={torsoX} y="149" width={torsoWidth} height="26" rx="8" fill="#DCEEF8" stroke="#8FAEE0" strokeWidth="2" />
            <line x1="100" y1="158" x2="100" y2="175" stroke="#8FAEE0" strokeWidth="2" />
            <rect x={torsoX} y="106" width={torsoWidth} height="47" rx="13" fill="#FFFFFF" stroke="#EBD8C3" strokeWidth="2" />
            <path d="M86 106 Q100 120 114 106" fill={skin} stroke="#EBD8C3" strokeWidth="1.5" />
          </g>
        )}

        {/* OUTFIT MODE 2: SCHOOL UNIFORM */}
        {charAvatar.outfitMode === 'uniform' && (
          <g>
            {charGender === 'F' ? (
              <path
                d={`M${torsoX} 148 L${torsoX + torsoWidth} 148 L${torsoX + torsoWidth + 10} 180 L${torsoX - 10} 180 Z`}
                fill="#2C3A57"
              />
            ) : (
              <g>
                <rect x={torsoX} y="148" width={torsoWidth} height="28" rx="6" fill="#2C3A57" />
                <line x1="100" y1="158" x2="100" y2="176" stroke="#1E293B" strokeWidth="2" />
              </g>
            )}
            <rect x={torsoX} y="106" width={torsoWidth} height="46" rx="11" fill="#FFFFFF" stroke="#DCEEF8" strokeWidth="2" />
            <rect x={torsoX - 12} y="107" width="14" height="20" rx="6" fill="#FFFFFF" stroke="#DCEEF8" strokeWidth="1.5" />
            <rect x={torsoX + torsoWidth - 2} y="107" width="14" height="20" rx="6" fill="#FFFFFF" stroke="#DCEEF8" strokeWidth="1.5" />
            <polygon points="86,106 100,118 92,122" fill="#DCEEF8" />
            <polygon points="114,106 100,118 108,122" fill="#DCEEF8" />
            {charGender === 'F' ? (
              <path d="M91 116 L100 122 L109 116 L109 126 L100 122 L91 126 Z" fill="#E86F87" />
            ) : (
              <polygon points="97,116 103,116 102,138 98,138" fill="#2C3A57" />
            )}
          </g>
        )}

        {/* OUTFIT MODE 3, 4, 5: CASUAL, CUSTOM DESIGN, OR FESTIVAL OUTFIT */}
        {(charAvatar.outfitMode === 'casual' ||
          charAvatar.outfitMode === 'custom_design' ||
          charAvatar.outfitMode === 'festival') && (
          <g>
            {activeVariant === 'dress' ||
            activeVariant === 'thai_festive' ||
            activeVariant === 'cny' ||
            (charGender === 'F' && activeVariant === 'preppy') ? (
              <path
                d={`M${torsoX} 145 L${torsoX + torsoWidth} 145 L${torsoX + torsoWidth + 13} 182 L${torsoX - 13} 182 Z`}
                fill={
                  activeVariant === 'thai_festive'
                    ? activeSecondary
                    : activeVariant === 'dress' || activeVariant === 'cny'
                    ? activePrimary
                    : activeSecondary
                }
                stroke="#3D322C"
                strokeOpacity="0.2"
                strokeWidth="1.8"
              />
            ) : (
              <rect
                x={torsoX - 2}
                y="148"
                width={torsoWidth + 4}
                height="29"
                rx="8"
                fill={activeSecondary}
              />
            )}

            <rect
              x={torsoX}
              y="106"
              width={torsoWidth}
              height="47"
              rx="13"
              fill={activePrimary}
              stroke="#3D322C"
              strokeOpacity="0.18"
              strokeWidth="1.8"
            />
            <rect x={torsoX - 13} y="107" width="15" height="24" rx="7" fill={activePrimary} />
            <rect x={torsoX + torsoWidth - 2} y="107" width="15" height="24" rx="7" fill={activePrimary} />

            {charAvatar.outfitMode === 'custom_design' && custom.pattern === 'dots' && (
              <rect x={torsoX} y="106" width={torsoWidth} height="47" rx="13" fill={`url(#${dotsPatternId})`} />
            )}
            {charAvatar.outfitMode === 'custom_design' && custom.pattern === 'stripes' && (
              <rect x={torsoX} y="106" width={torsoWidth} height="47" rx="13" fill={`url(#${stripesPatternId})`} />
            )}
            {charAvatar.outfitMode === 'custom_design' && custom.pattern === 'stars' && (
              <g fontSize="8" opacity="0.75">
                <text x="82" y="122">✦</text>
                <text x="112" y="124">✦</text>
                <text x="85" y="143">✦</text>
                <text x="110" y="144">✦</text>
              </g>
            )}
            {charAvatar.outfitMode === 'custom_design' && custom.pattern === 'hearts' && (
              <g fontSize="8" opacity="0.75">
                <text x="80" y="122">♡</text>
                <text x="113" y="124">♡</text>
                <text x="84" y="143">♡</text>
                <text x="110" y="144">♡</text>
              </g>
            )}

            {activeVariant === 'hoodie' && (
              <>
                <path d="M84 106 Q100 120 116 106" fill="none" stroke={activeSecondary} strokeWidth="3.5" strokeLinecap="round" />
                <line x1="93" y1="115" x2="93" y2="128" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="107" y1="115" x2="107" y2="128" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
              </>
            )}
            {activeVariant === 'overalls' && (
              <>
                <rect x={torsoX + 8} y="107" width="7" height="44" fill={activeSecondary} />
                <rect x={torsoX + torsoWidth - 15} y="107" width="7" height="44" fill={activeSecondary} />
                <rect x={torsoX + 6} y="126" width={torsoWidth - 12} height="27" rx="5" fill={activeSecondary} />
              </>
            )}
            {activeVariant === 'preppy' && (
              <>
                <polygon points="80,106 120,106 100,122" fill="#FFFFFF" stroke={activeSecondary} strokeWidth="2" />
                <path d="M91 118 L100 124 L109 118 L109 128 L100 124 L91 128 Z" fill="#E86F87" />
              </>
            )}

            {activeVariant === 'thai_festive' && (
              <>
                <path
                  d={`M${torsoX + 4} 107 L${torsoX + torsoWidth - 10} 150 L${torsoX + torsoWidth - 22} 150 L${torsoX - 2} 112 Z`}
                  fill={activeSecondary}
                  opacity="0.88"
                />
                <rect x={torsoX + 2} y="145" width={torsoWidth - 4} height="5" rx="2.5" fill="#FFD166" />
              </>
            )}
            {activeVariant === 'santa' && (
              <>
                <rect x={torsoX - 1} y="106" width={torsoWidth + 2} height="8" rx="4" fill="#FFFFFF" />
                <rect x={torsoX} y="141" width={torsoWidth} height="6" rx="2" fill="#3D322C" />
                <rect x="95" y="140" width="10" height="8" rx="2" fill="#FFD166" />
              </>
            )}
            {activeVariant === 'cny' && (
              <>
                <rect x="92" y="105" width="16" height="6" rx="3" fill={activeSecondary} />
                <line x1="100" y1="112" x2="100" y2="146" stroke={activeSecondary} strokeWidth="2.2" />
                <circle cx="100" cy="118" r="2" fill={activeSecondary} />
                <circle cx="100" cy="127" r="2" fill={activeSecondary} />
              </>
            )}
            {activeVariant === 'floral' && (
              <g fontSize="9">
                <text x={torsoX + 7} y="124">🌺</text>
                <text x={torsoX + torsoWidth - 18} y="126">🌼</text>
                <text x={torsoX + 10} y="144">🌸</text>
                <text x={torsoX + torsoWidth - 20} y="143">🌺</text>
              </g>
            )}
            {activeVariant === 'halloween' && (
              <>
                <path
                  d={`M${torsoX - 6} 110 L${torsoX + torsoWidth + 6} 110 L${torsoX + torsoWidth + 11} 148 L100 138 L${torsoX - 11} 148 Z`}
                  fill={activeSecondary}
                  opacity="0.72"
                />
              </>
            )}
            {activeVariant === 'party' && (
              <g fontSize="8">
                <text x={torsoX + 7} y="122">✨</text>
                <text x={torsoX + torsoWidth - 17} y="123">🌟</text>
                <text x={torsoX + 9} y="144">🎉</text>
              </g>
            )}

            {charAvatar.outfitMode === 'custom_design' && custom.drawingDataUrl ? (
              <image
                href={custom.drawingDataUrl}
                x={torsoX + 6}
                y="112"
                width={torsoWidth - 12}
                height="32"
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <text x="100" y="136" textAnchor="middle" fontSize="14">
                {charAvatar.outfitMode === 'custom_design'
                  ? custom.emblem
                  : isFestivalMode
                  ? equippedFestival?.emoji ?? activeFestival?.emoji ?? '🎊'
                  : equippedCasual?.emoji ?? '⭐'}
              </text>
            )}
          </g>
        )}

        {/* Neck & Anime Head */}
        <rect x="93" y="92" width="14" height="17" rx="6" fill={skin} />
        <path
          d="M64 62 C64 36, 80 26, 100 26 C120 26, 136 36, 136 62 C136 82, 120 98, 100 98 C80 98, 64 82, 64 62 Z"
          fill={skin}
        />
        <circle cx="64" cy="68" r="6" fill={skin} />
        <circle cx="136" cy="68" r="6" fill={skin} />

        {/* Hair Crown */}
        <path
          d="M62 66 C60 34, 80 22, 100 22 C120 22, 140 34, 138 66 C134 50, 127 42, 120 48 L112 56 L106 44 L96 58 L89 44 L80 54 C74 44, 66 52, 62 66 Z"
          fill={charAvatar.hairColor}
        />

        {/* Eyes */}
        {charAvatar.faceMood === 'cheerful' ? (
          <>
            <path d="M78 68 Q85 61 92 68" fill="none" stroke="#2E231D" strokeWidth="3" strokeLinecap="round" />
            <path d="M108 68 Q115 61 122 68" fill="none" stroke="#2E231D" strokeWidth="3" strokeLinecap="round" />
            <path d="M92 80 Q100 90 108 80 Z" fill="#F28B9C" stroke="#2E231D" strokeWidth="1.8" />
          </>
        ) : (
          <>
            <ellipse cx="85" cy="68" rx="6.5" ry="7.8" fill="#2E231D" />
            <ellipse cx="115" cy="68" rx="6.5" ry="7.8" fill="#2E231D" />
            <ellipse cx="85" cy="71" rx="4.5" ry="3.2" fill="#6D597A" opacity="0.6" />
            <ellipse cx="115" cy="71" rx="4.5" ry="3.2" fill="#6D597A" opacity="0.6" />
            <circle cx="82.5" cy="64.8" r="2.4" fill="#FFFFFF" />
            <circle cx="112.5" cy="64.8" r="2.4" fill="#FFFFFF" />
            <circle cx="87.5" cy="71.2" r="1.2" fill="#FFFFFF" />
            <circle cx="117.5" cy="71.2" r="1.2" fill="#FFFFFF" />
            {equippedCosmetic && (
              <>
                <text x="74" y="61" fontSize="7">✨</text>
                <text x="120" y="61" fontSize="7">✨</text>
              </>
            )}
            {charGender === 'F' && (
              <>
                <path d="M78 63 Q85 58 92 63" fill="none" stroke="#2E231D" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M108 63 Q115 58 122 63" fill="none" stroke="#2E231D" strokeWidth="2.2" strokeLinecap="round" />
              </>
            )}
            <path
              d={charAvatar.faceMood === 'cool' ? 'M78 56 L92 54' : 'M79 56 Q85 53 91 56'}
              fill="none"
              stroke={charAvatar.hairColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={charAvatar.faceMood === 'cool' ? 'M108 54 L122 56' : 'M109 56 Q115 53 121 56'}
              fill="none"
              stroke={charAvatar.hairColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={charAvatar.faceMood === 'shy' ? 'M96 82 Q100 84 104 82' : 'M94 81 Q100 87 106 81'}
              fill="none"
              stroke="#2E231D"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Cheeks */}
        <ellipse
          cx="75"
          cy="77"
          rx={equippedCosmetic ? '7.5' : '5.5'}
          ry={equippedCosmetic ? '4' : '2.8'}
          fill="#F79BB4"
          opacity={equippedCosmetic ? '0.88' : '0.45'}
        />
        <ellipse
          cx="125"
          cy="77"
          rx={equippedCosmetic ? '7.5' : '5.5'}
          ry={equippedCosmetic ? '4' : '2.8'}
          fill="#F79BB4"
          opacity={equippedCosmetic ? '0.88' : '0.45'}
        />

        {equippedGlasses && (
          equippedGlasses.id === 'fest_glasses_songkran' ? (
            <g stroke="#2D749E" strokeWidth="2.4" fill="rgba(124,198,232,0.45)">
              <rect x="74" y="59" width="23" height="16" rx="6" />
              <rect x="103" y="59" width="23" height="16" rx="6" />
              <line x1="97" y1="67" x2="103" y2="67" />
            </g>
          ) : (
            <g stroke={equippedGlasses.colorHex ?? '#5C4B43'} strokeWidth="2.3" fill="rgba(255,255,255,0.22)">
              <circle cx="85" cy="68" r="9.5" />
              <circle cx="115" cy="68" r="9.5" />
              <line x1="94.5" y1="68" x2="105.5" y2="68" />
            </g>
          )
        )}

        {equippedHat && (
          equippedHat.id === 'wardrobe_hat_bunny' ? (
            <g>
              <ellipse cx="82" cy="18" rx="6" ry="15" fill="#FADADD" stroke="#E86F87" strokeWidth="1.8" />
              <ellipse cx="118" cy="18" rx="6" ry="15" fill="#FADADD" stroke="#E86F87" strokeWidth="1.8" />
              <path d="M68 32 Q100 22 132 32" fill="none" stroke="#E86F87" strokeWidth="4" strokeLinecap="round" />
            </g>
          ) : equippedHat.id === 'fest_hat_santa' ? (
            <g>
              <path d="M68 39 C74 14, 124 10, 140 34 L126 39 Z" fill="#E56B7A" stroke="#3D322C" strokeWidth="1.8" />
              <rect x="64" y="34" width="72" height="8" rx="4" fill="#FFFFFF" stroke="#3D322C" strokeWidth="1.6" />
              <circle cx="141" cy="34" r="6" fill="#FFFFFF" stroke="#3D322C" strokeWidth="1.5" />
            </g>
          ) : equippedHat.id === 'fest_hat_witch' ? (
            <g>
              <polygon points="75,36 100,4 125,36" fill="#6D597A" stroke="#3D322C" strokeWidth="1.8" />
              <ellipse cx="100" cy="36" rx="34" ry="5.5" fill="#6D597A" stroke="#3D322C" strokeWidth="1.8" />
              <rect x="81" y="29" width="38" height="5" rx="2" fill="#F59E56" />
            </g>
          ) : equippedHat.id === 'fest_hat_krathong_flower' ? (
            <g>
              <path d="M70 33 Q100 21 130 33" fill="none" stroke="#D49A45" strokeWidth="3.5" strokeLinecap="round" />
              <text x="100" y="24" textAnchor="middle" fontSize="14">🌺</text>
              <text x="77" y="29" textAnchor="middle" fontSize="10">🌸</text>
              <text x="123" y="29" textAnchor="middle" fontSize="10">🌼</text>
            </g>
          ) : equippedHat.id === 'fest_hat_new_year_crown' ? (
            <g>
              <polygon points="75,35 82,16 93,27 100,12 107,27 118,16 125,35" fill="#FFD166" stroke="#3D322C" strokeWidth="1.8" />
              <circle cx="100" cy="11" r="3" fill="#E86F87" />
            </g>
          ) : equippedHat.id === 'fest_hat_cny' ? (
            <g>
              <circle cx="72" cy="30" r="8.5" fill="#D94E5C" stroke="#F5C97B" strokeWidth="2" />
              <circle cx="128" cy="30" r="8.5" fill="#D94E5C" stroke="#F5C97B" strokeWidth="2" />
              <path d="M78 28 Q100 20 122 28" fill="none" stroke="#F5C97B" strokeWidth="3" />
            </g>
          ) : (
            <g>
              <path
                d="M66 39 C70 18, 130 18, 134 39 Z"
                fill={equippedHat.colorHex ?? '#F5C97B'}
                stroke="#3D322C"
                strokeWidth="2"
              />
              <rect
                x="59"
                y="37"
                width="82"
                height="7.5"
                rx="3.8"
                fill={equippedHat.colorHex ?? '#F5C97B'}
                stroke="#3D322C"
                strokeWidth="2"
              />
            </g>
          )
        )}

        {/* Festival Prop held / displayed beside character */}
        {equippedFestivalProp && (
          <g transform="translate(154, 174)">
            {equippedFestivalProp.id === 'fest_prop_krathong' ? (
              <g>
                <ellipse cx="0" cy="16" rx="19" ry="7" fill="#78B87E" stroke="#3D322C" strokeWidth="1.5" />
                <path d="M-15 14 L-9 4 L-3 14 L0 2 L3 14 L9 4 L15 14 Z" fill="#F3A6B8" stroke="#3D322C" strokeWidth="1.2" />
                <rect x="-2" y="-6" width="4" height="12" rx="1.5" fill="#FFF5BA" />
                <ellipse cx="0" cy="-9" rx="3" ry="4.5" fill="#FFA94D" />
              </g>
            ) : equippedFestivalProp.id === 'fest_prop_christmas_gift' ? (
              <g>
                <rect x="-13" y="0" width="26" height="22" rx="4" fill="#E56B7A" stroke="#3D322C" strokeWidth="1.6" />
                <rect x="-2.5" y="0" width="5" height="22" fill="#FFF5BA" />
                <rect x="-13" y="8" width="26" height="5" fill="#FFF5BA" />
                <circle cx="-4" cy="-3" r="3.5" fill="#7CC6B8" stroke="#3D322C" strokeWidth="1.2" />
                <circle cx="4" cy="-3" r="3.5" fill="#7CC6B8" stroke="#3D322C" strokeWidth="1.2" />
              </g>
            ) : equippedFestivalProp.id === 'fest_prop_balloon' ? (
              <g>
                <line x1="-2" y1="20" x2="-7" y2="-10" stroke="#7B695F" strokeWidth="1.4" />
                <line x1="-2" y1="20" x2="8" y2="-14" stroke="#7B695F" strokeWidth="1.4" />
                <ellipse cx="-8" cy="-16" rx="9" ry="11" fill="#F79BB4" stroke="#3D322C" strokeWidth="1.4" />
                <ellipse cx="9" cy="-21" rx="9" ry="11" fill="#8EC5E8" stroke="#3D322C" strokeWidth="1.4" />
              </g>
            ) : equippedFestivalProp.id === 'fest_prop_water_bowl' ? (
              <g>
                <path d="M-15 6 Q-14 22 0 22 Q14 22 15 6 Z" fill="#DCEEF8" stroke="#5C7A96" strokeWidth="1.8" />
                <ellipse cx="0" cy="6" rx="15" ry="4.5" fill="#9ED2F6" stroke="#5C7A96" strokeWidth="1.4" />
                <circle cx="-5" cy="5" r="2.2" fill="#FFFFFF" />
                <circle cx="4" cy="6" r="2.2" fill="#FFFFFF" />
              </g>
            ) : (
              <text x="0" y="14" textAnchor="middle" fontSize="22">
                {equippedFestivalProp.emoji}
              </text>
            )}
          </g>
        )}
      </svg>
    );
  };

  const equippedBag = shopItems.find((i) => i.id === avatar.equippedBagId);
  const equippedCasual = shopItems.find((i) => i.id === avatar.equippedCasualId);
  const equippedFestivalOutfit =
    shopItems.find((i) => i.id === avatar.equippedFestivalId) ??
    (activeFestival ? shopItems.find((i) => i.id === activeFestival.defaultOutfitId) : undefined);

  const outfitLabel =
    avatar.outfitMode === 'uniform'
      ? lang === 'th'
        ? '👔 ชุดนักเรียนพร้อมเรียน'
        : '👔 School Uniform'
      : avatar.outfitMode === 'festival'
      ? lang === 'th'
        ? `${equippedFestivalOutfit?.emoji ?? '🎊'} ${equippedFestivalOutfit?.nameTh ?? 'ชุดเทศกาลพิเศษ'}`
        : `${equippedFestivalOutfit?.emoji ?? '🎊'} ${equippedFestivalOutfit?.nameEn ?? 'Festival Outfit'}`
      : avatar.outfitMode === 'custom_design'
      ? lang === 'th'
        ? '🎨 ชุดออกแบบเองสไตล์อนิเมะ'
        : '🎨 My Custom Anime Outfit'
      : avatar.outfitMode === 'casual'
      ? lang === 'th'
        ? `✨ ${equippedCasual?.nameTh ?? 'ชุดใส่เที่ยวอนิเมะ'}`
        : `✨ ${equippedCasual?.nameEn ?? 'Anime Casual'}`
      : lang === 'th'
      ? '🩳 เสื้อซับ & กางเกงขาสั้น (อยู่บ้าน)'
      : '🩳 Home Undershirt & Shorts';

  const avatarSvg = renderCharacterSvg(
    gender,
    avatar,
    visitingBuddy
      ? 'w-28 h-32 sm:w-32 sm:h-36'
      : panoramic
      ? 'w-32 h-36 sm:w-36 sm:h-40'
      : compact
      ? 'w-40 h-44'
      : 'w-48 h-52',
    'main'
  );

  const buddySvg = visitingBuddy
    ? renderCharacterSvg(
        visitingBuddy.member.gender,
        visitingBuddy.member.avatar,
        'w-28 h-32 sm:w-32 sm:h-36',
        `buddy_${visitingBuddy.member.id}`
      )
    : null;

  const activityDisplay =
    visitingBuddy?.activity === 'study'
      ? { emoji: '📚', th: 'ติวหนังสือด้วยกัน', en: 'Studying together', bg: 'bg-[#DCEEF8] text-[#28445A]' }
      : visitingBuddy?.activity === 'travel'
      ? { emoji: '🎒', th: 'ไปเที่ยวเล่นด้วยกัน', en: 'Hanging out together', bg: 'bg-[#D4F0F0] text-[#214F4B]' }
      : visitingBuddy?.activity === 'eat'
      ? { emoji: '🍚', th: 'กินข้าวด้วยกัน', en: 'Eating together', bg: 'bg-[#FFF5BA] text-[#6B4800]' }
      : visitingBuddy?.activity === 'cycling'
      ? { emoji: '🚲', th: 'ปั่นจักรยานด้วยกัน', en: 'Cycling together', bg: 'bg-[#E6F7E8] text-[#20572A]' }
      : visitingBuddy?.activity === 'football'
      ? { emoji: '⚽', th: 'ไปเตะฟุตบอลด้วยกัน', en: 'Playing football together', bg: 'bg-[#EAF3FF] text-[#1D4B7A]' }
      : visitingBuddy?.activity === 'volleyball'
      ? { emoji: '🏐', th: 'ไปเล่นวอลเลย์บอลด้วยกัน', en: 'Playing volleyball together', bg: 'bg-[#FFF0E6] text-[#7A3B14]' }
      : null;



  if (panoramic) {
    return (
      <div
        className="relative overflow-hidden rounded-[32px] border-2 border-[#EBD8C3] min-h-[265px] sm:min-h-[285px] flex items-center"
        style={{ background: scene.bgGradient }}
      >
        <div
          className={`relative w-full min-h-[265px] sm:min-h-[285px] p-4 sm:p-6 flex items-center transition-all duration-300 ${
            emailLocked
              ? 'filter grayscale-[82%] blur-[4.5px] opacity-85 pointer-events-none select-none'
              : ''
          }`}
        >
        {/* Full-Width Unobstructed Scenic Panoramic Illustration */}
        <svg
          viewBox="0 0 1200 320"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          aria-hidden="true"
        >
          {/* Glowing pastel sun / moon */}
          <circle
            cx="985"
            cy="72"
            r="38"
            fill={activeStage === 6 ? '#FFFDF9' : '#FFF5BA'}
            opacity="0.92"
          />
          <circle
            cx="985"
            cy="72"
            r="52"
            fill={activeStage === 6 ? '#EAE4F2' : '#FFF5BA'}
            opacity="0.32"
          />

          {/* Soft drifting clouds across open sky */}
          <ellipse cx="620" cy="64" rx="52" ry="18" fill="#FFFFFF" opacity="0.72" />
          <ellipse cx="652" cy="58" rx="34" ry="15" fill="#FFFFFF" opacity="0.72" />
          <ellipse cx="835" cy="95" rx="44" ry="15" fill="#FFFFFF" opacity="0.62" />
          <ellipse cx="470" cy="86" rx="38" ry="13" fill="#FFFFFF" opacity="0.55" />

          {/* Rolling distant hills */}
          <path
            d="M0 250 Q260 205 560 245 T1200 220 L1200 320 L0 320 Z"
            fill={activeStage === 5 ? '#DCEEF8' : '#E7F5DC'}
            opacity="0.82"
          />
          <path
            d="M0 280 Q360 240 760 268 T1200 248 L1200 320 L0 320 Z"
            fill={activeStage === 5 ? '#FFF5BA' : '#D5EDC8'}
            opacity="0.92"
          />

          {/* Stage-specific unobstructed landmark on the far right meadow */}
          {activeStage === 1 && (
            <g transform="translate(880,145)">
              <rect x="26" y="42" width="128" height="74" rx="10" fill="#FFFDF9" stroke="#EBD8C3" strokeWidth="3" />
              <polygon points="10,46 90,-4 170,46" fill="#F3A6B8" stroke="#E2879C" strokeWidth="3" />
              <rect x="74" y="72" width="32" height="44" rx="6" fill="#EBD8C3" />
              <rect x="42" y="64" width="22" height="22" rx="5" fill="#DCEEF8" />
              <rect x="116" y="64" width="22" height="22" rx="5" fill="#DCEEF8" />
            </g>
          )}
          {activeStage === 2 && (
            <g transform="translate(890,155)">
              <circle cx="40" cy="60" r="24" fill="#B8E0B4" />
              <circle cx="135" cy="54" r="28" fill="#A2D6A0" />
              <circle cx="88" cy="48" r="32" fill="#C7E8B6" />
              <text x="30" y="96" fontSize="22">🌷</text>
              <text x="80" y="102" fontSize="22">🌼</text>
              <text x="128" y="96" fontSize="22">🦋</text>
            </g>
          )}
          {activeStage === 3 && (
            <g transform="translate(895,148)">
              <rect x="20" y="34" width="130" height="80" rx="12" fill="#EAE4F2" stroke="#C5B8E8" strokeWidth="3" />
              <path d="M20 34 Q85 -10 150 34 Z" fill="#8EC5E8" />
              <rect x="42" y="54" width="86" height="42" rx="6" fill="#FFFDF9" />
            </g>
          )}
          {activeStage === 4 && (
            <g transform="translate(890,146)">
              <rect x="24" y="42" width="126" height="74" rx="10" fill="#FFFDF9" stroke="#E79A85" strokeWidth="3" />
              <rect x="16" y="28" width="142" height="20" rx="8" fill="#FADADD" stroke="#E79A85" strokeWidth="2.5" />
              <rect x="70" y="72" width="34" height="44" rx="6" fill="#FDE2D2" />
            </g>
          )}
          {activeStage === 5 && (
            <g transform="translate(880,152)">
              <path d="M20 96 Q80 82 140 96" stroke="#8EC5E8" strokeWidth="4" fill="none" />
              <line x1="90" y1="36" x2="90" y2="96" stroke="#8D6E63" strokeWidth="4" />
              <path d="M52 38 Q90 8 128 38 Z" fill="#F3A6B8" />
            </g>
          )}
          {activeStage === 6 && (
            <g transform="translate(885,152)">
              <polygon points="24,106 86,28 148,106" fill="#C5B8E8" stroke="#7A6BA3" strokeWidth="3" />
              <polygon points="72,106 86,62 100,106" fill="#FFF5BA" />
              <text x="15" y="18" fontSize="16">✨</text>
              <text x="155" y="24" fontSize="16">⭐</text>
            </g>
          )}
          {activeStage === 7 && (
            <g transform="translate(875,126)">
              <rect x="34" y="52" width="108" height="80" rx="8" fill="#FFFDF9" stroke="#D896B4" strokeWidth="3" />
              <rect x="20" y="34" width="24" height="98" rx="4" fill="#FADADD" />
              <rect x="132" y="34" width="24" height="98" rx="4" fill="#FADADD" />
              <polygon points="16,36 32,8 48,36" fill="#EAE4F2" />
              <polygon points="128,36 144,8 160,36" fill="#EAE4F2" />
              <polygon points="62,52 88,12 114,52" fill="#F3A6B8" />
            </g>
          )}

          {/* Live Seasonal Festival Scenery Accents */}
          {activeFestival && (
            <g opacity="0.9">
              <text x="530" y="54" fontSize="24">{activeFestival.decorEmojis[0]}</text>
              <text x="720" y="70" fontSize="22">{activeFestival.decorEmojis[1]}</text>
              <text x="860" y="52" fontSize="20">{activeFestival.decorEmojis[2]}</text>
              <text x="640" y="282" fontSize="22">{activeFestival.decorEmojis[0]}</text>
              <text x="780" y="286" fontSize="20">{activeFestival.decorEmojis[1]}</text>
            </g>
          )}
        </svg>

        {/* Top-Right Cover Corner: Personal Pink Piggy Bank & Shared Golden Piggy Bank */}
        {(onOpenPinkPiggy || onOpenGoldPiggy) && (
          <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5 sm:gap-2.5">
            {onOpenPinkPiggy && typeof pinkCoins === 'number' && (
              <button
                type="button"
                onClick={onOpenPinkPiggy}
                title={
                  lang === 'th'
                    ? 'กระปุกหมูสีชมพู (ส่วนตัว) — กดดูยอดเหรียญค่าไปโรงเรียน'
                    : 'Pink Piggy Bank (Personal Allowance)'
                }
                className={`group flex items-center gap-1.5 sm:gap-2 rounded-2xl border-2 px-2 py-1.5 sm:px-3 sm:py-2 shadow-sm backdrop-blur-sm transition-transform active:scale-95 hover:-translate-y-0.5 cursor-pointer ${
                  pinkCoins < 0
                    ? 'border-[#E66C85] bg-[#FFE8EC]/95 text-[#9C1D35]'
                    : 'border-[#F3B7C0] bg-[#FFF4F7]/95 text-[#3D322C]'
                }`}
              >
                <PinkPiggySvg
                  className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 transition-transform group-hover:scale-105"
                  isNegative={pinkCoins < 0}
                />
                <div className="text-left leading-tight">
                  <div className="text-[10px] font-bold text-[#8B4858]">
                    {lang === 'th' ? 'ส่วนตัว' : 'Mine'}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold tabular-nums">
                    {pinkCoins.toLocaleString()} ฿
                  </div>
                  {weeklyPenaltyThb > 0 && (
                    <div className="text-[9px] font-bold text-[#C63D55] tabular-nums">
                      -{weeklyPenaltyThb} ฿
                    </div>
                  )}
                </div>
              </button>
            )}

            {onOpenGoldPiggy && typeof goldenPoolCoins === 'number' && (
              <button
                type="button"
                onClick={onOpenGoldPiggy}
                title={
                  lang === 'th'
                    ? 'กระปุกหมูสีทอง (กองทุนกลาง) — ดูยอดเงินกองกลางทุกคน'
                    : 'Golden Piggy Bank (Shared Pool)'
                }
                className="group flex items-center gap-1.5 sm:gap-2 rounded-2xl border-2 border-[#F0C84B] bg-[#FFF8D8]/95 px-2 py-1.5 sm:px-3 sm:py-2 text-[#5A3B00] shadow-sm backdrop-blur-sm transition-transform active:scale-95 hover:-translate-y-0.5 cursor-pointer"
              >
                <GoldenPiggySvg className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 transition-transform group-hover:scale-105" />
                <div className="text-left leading-tight">
                  <div className="text-[10px] font-bold text-[#8A5A00]">
                    {lang === 'th' ? 'กองกลาง' : 'Pool'}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold tabular-nums">
                    {goldenPoolCoins.toLocaleString()} ฿
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Collected Stage Props gently resting on the open right scenic ground (non-blocking) */}
        {collectedInStage.length > 0 && (
          <div className="hidden md:flex items-center gap-2 absolute bottom-4 right-6 z-10 pointer-events-none">
            {collectedInStage.map((item) => (
              <span
                key={item.id}
                title={lang === 'th' ? item.nameTh : item.nameEn}
                className="text-2xl drop-shadow-xs"
              >
                {item.imageBase64 ? (
                  <img
                    src={item.imageBase64}
                    alt={item.nameTh}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-lg object-cover"
                  />
                ) : (
                  item.emoji
                )}
              </span>
            ))}
          </div>
        )}

        {/* Left Side: Single Slim Portrait Card (leaving panoramic backdrop completely open!) */}
        <div className="relative z-10 flex items-center">
          {/* Avatar Frame (Expands gently to show side-by-side friend hangout when accepted!) */}
          <div
            className={`rounded-[22px] bg-white/95 border border-[#EBD8C3]/80 p-2.5 flex flex-col items-center shadow-sm shrink-0 ${
              visitingBuddy ? 'w-auto px-3' : 'w-52 sm:w-56'
            }`}
          >
            {visitingBuddy && activityDisplay && (
              <button
                type="button"
                onClick={onOpenFriendVisits}
                className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold cursor-pointer ${activityDisplay.bg}`}
              >
                <span>{activityDisplay.emoji}</span>
                <span>{lang === 'th' ? activityDisplay.th : activityDisplay.en}</span>
              </button>
            )}

            {visitingBuddy && buddySvg ? (
              <div className="flex items-end justify-center gap-1.5">
                <div className="flex flex-col items-center">
                  {avatarSvg}
                  <span className="text-[11px] font-bold text-[#3D322C] mt-0.5">
                    {kidEmoji} {kidNickname}
                  </span>
                </div>
                <div className="mb-12 flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF5BA] border border-[#F4DB73] text-sm shadow-xs">
                  {activityDisplay?.emoji ?? '🤝'}
                </div>
                <div className="flex flex-col items-center">
                  {buddySvg}
                  <span className="text-[11px] font-bold text-[#5E4E45] mt-0.5">
                    {visitingBuddy.member.emoji} {visitingBuddy.member.nickname}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-center gap-1">
                  {avatarSvg}
                  {pet && (
                    <button
                      type="button"
                      onClick={onOpenPet}
                      title={lang === 'th' ? `ดูแล ${pet.name}` : `Care for ${pet.name}`}
                      className="-ml-4 mb-1 flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                    >
                      <PetCanvasSvg pet={pet} mood={petMood} sizeClass="w-14 h-14 sm:w-16 sm:h-16" />
                      <span className="rounded-full bg-[#FFF5BA] border border-[#F4DB73] px-1.5 py-0.5 text-[10px] font-extrabold text-[#5A4614] leading-none">
                        {petMood === 'hungry'
                          ? lang === 'th'
                            ? '🥣 หิว!'
                            : '🥣 Hungry'
                          : pet.name}
                      </span>
                    </button>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#3D322C] max-w-full truncate">
                  {kidEmoji && <span>{kidEmoji}</span>}
                  <span className="truncate">{kidNickname ?? ''}</span>
                  {typeof stars === 'number' && (
                    <span className="text-[11px] font-bold text-[#7A5912] tabular-nums">
                      · ⭐ {stars.toLocaleString()}
                    </span>
                  )}
                </div>
                {equippedBag && (
                  <div className="text-[10px] font-semibold text-[#9B4D62] truncate max-w-full">
                    {equippedBag.emoji} {lang === 'th' ? equippedBag.nameTh : equippedBag.nameEn}
                  </div>
                )}
              </>
            )}

            {activeGift && (
              <button
                type="button"
                onClick={onOpenGift}
                title={
                  lang === 'th'
                    ? `${activeGift.title} จาก${activeGift.senderName} — กดอ่านข้อความ`
                    : `${activeGift.title} from ${activeGift.senderName}`
                }
                className="mt-1.5 w-full rounded-xl border border-[#F2C36B] bg-[#FFF6D6] hover:bg-[#FFEDB3] px-2 py-1 text-left flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <span className="text-lg leading-none shrink-0">{activeGift.emoji}</span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-[10px] font-extrabold text-[#6E4500] truncate">
                    {activeGift.title}
                    {typeof activeGift.amountThb === 'number' && activeGift.amountThb > 0
                      ? ` (+${activeGift.amountThb.toLocaleString()} ฿)`
                      : ''}
                  </div>
                  <div className="text-[9px] font-semibold text-[#8A6118] truncate">
                    {lang === 'th' ? `จาก ${activeGift.senderName}` : `From ${activeGift.senderName}`}
                  </div>
                </div>
              </button>
            )}

            {(onOpenWardrobe || onOpenProfile) && (
              <div className="mt-2 w-full grid grid-cols-2 gap-1.5">
                {onOpenWardrobe && (
                  <button
                    type="button"
                    onClick={onOpenWardrobe}
                    className="min-h-[34px] rounded-xl bg-[#F4F0F9] hover:bg-[#EAE4F2] border border-[#DFD5EC] px-2 py-1 text-[11px] font-bold text-[#3D322C] cursor-pointer whitespace-nowrap truncate"
                  >
                    ✂️ {lang === 'th' ? 'แต่งตัว' : 'Dress Up'}
                  </button>
                )}
                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="relative min-h-[34px] rounded-xl bg-[#FFEAF0] hover:bg-[#FFD9E4] border border-[#F3B8C8] px-2 py-1 text-[11px] font-bold text-[#6B2336] cursor-pointer whitespace-nowrap truncate"
                  >
                    🩷 {lang === 'th' ? 'พื้นที่ของฉัน' : 'My Space'}
                    {(pendingFriendVisitCount > 0 || (typeof petHunger === 'number' && petHunger < 45)) && (
                      <span
                        aria-hidden="true"
                        className="ml-1 inline-block h-2 w-2 rounded-full bg-[#E66C85] align-middle"
                      />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </div>

        {emailLocked && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-[#2D2522]/15">
            <div className="w-full max-w-md rounded-[26px] border-2 border-white/95 bg-[#FFFDF9]/92 backdrop-blur-md px-4 py-3.5 sm:px-6 sm:py-4 text-center shadow-lg space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F2EDE9] border border-[#DFD3C8] px-3 py-1 text-[11px] font-extrabold text-[#4D3E36]">
                <span>🔒</span>
                <span>
                  {lang === 'th'
                    ? 'ยังไม่ล็อกอินอีเมล · ดาวอยู่ที่ 0 ⭐ (ปลดล็อกเมื่อล็อกอิน)'
                    : 'Not Signed In · Stars at 0 ⭐ (Unlock on Email Login)'}
                </span>
              </div>

              {!emailBonusClaimed && (
                <div className="rounded-2xl border border-[#F2C36B] bg-gradient-to-r from-[#FFF6D6] via-[#FFF9E6] to-[#FFF2C2] px-3 py-2 text-xs sm:text-sm font-extrabold text-[#6E4500] shadow-2xs">
                  🎁{' '}
                  {lang === 'th'
                    ? 'ล็อกอินอีเมลครั้งแรก รับดาวพิเศษ +1,000 ⭐ ทันที!'
                    : 'First email login bonus: Get +1,000 ⭐ immediately!'}
                </div>
              )}

              <p className="text-[11px] sm:text-xs text-[#5E4E45] leading-relaxed">
                {lang === 'th'
                  ? 'สามารถนำดาวมาช็อปปิ้งที่ร้านมินิมาร์ท เพื่อรับของรางวัลมากมาย และอัปเดตข้อมูลได้ก่อนใคร'
                  : 'Use your stars to shop at the foundation minimart, claim rewards, and get priority updates!'}
                {linkedEmail ? (
                  <span className="block mt-0.5 font-bold text-[#114A42]">
                    📧 {lang === 'th' ? `อีเมลที่ผูกไว้: ${linkedEmail}` : `Linked: ${linkedEmail}`}
                  </span>
                ) : null}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                {!linkedEmail ? (
                  onOpenLinkEmailModal && (
                    <button
                      type="button"
                      onClick={onOpenLinkEmailModal}
                      className="min-h-[40px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-4 py-2 text-xs font-extrabold shadow-sm cursor-pointer transition-colors"
                    >
                      📧{' '}
                      {lang === 'th'
                        ? !emailBonusClaimed
                          ? 'เพิ่มอีเมลของหนู (+1,000 ⭐)'
                          : 'เพิ่มอีเมลของหนู'
                        : 'Add My Email'}
                    </button>
                  )
                ) : (
                  <>
                    {onSignInKidEmail && (
                      <button
                        type="button"
                        disabled={emailLoginBusy}
                        onClick={onSignInKidEmail}
                        className="min-h-[40px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-4 py-2 text-xs font-extrabold shadow-sm cursor-pointer transition-colors disabled:opacity-60"
                      >
                        🔑{' '}
                        {emailLoginBusy
                          ? lang === 'th'
                            ? 'กำลังเปิด Google...'
                            : 'Signing in...'
                          : !emailBonusClaimed
                          ? lang === 'th'
                            ? 'ล็อกอินอีเมลรับ 1,000 ⭐'
                            : 'Sign In & Claim 1,000 ⭐'
                          : lang === 'th'
                          ? 'ล็อกอินด้วยอีเมลน้อง'
                          : 'Sign In with Kid Email'}
                      </button>
                    )}
                    {onOpenLinkEmailModal && (
                      <button
                        type="button"
                        onClick={onOpenLinkEmailModal}
                        className="min-h-[40px] rounded-2xl border border-[#D7C8BA] bg-white hover:bg-[#FAF5EF] text-[#4D3E36] px-3.5 py-2 text-xs font-bold cursor-pointer transition-colors"
                      >
                        ✏️ {lang === 'th' ? 'แก้ไขอีเมล' : 'Edit Email'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border-2 border-white/80 ${
        compact ? 'p-4' : 'p-5'
      }`}
      style={{ background: scene.bgGradient }}
    >
      <div className="flex items-center justify-between text-xs font-medium text-[#4D3E36] mb-2 relative z-10">
        <span>
          {scene.badgeEmoji} {lang === 'th' ? scene.titleTh : scene.titleEn}
        </span>
        <span className="tabular-nums">
          {collectedInStage.length}/7 {lang === 'th' ? 'ไอเทมฉาก' : 'items'}
        </span>
      </div>

      <div className="relative flex flex-col items-center justify-center py-1">
        {avatarSvg}
        <div className="mt-1 rounded-2xl bg-white/85 px-4 py-1.5 text-xs font-semibold text-[#3D322C] shadow-sm text-center">
          {outfitLabel}
        </div>
      </div>
    </div>
  );
};
