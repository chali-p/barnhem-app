import { PetCoatStyle, PetCompanionConfig, PetOutfitId, PetSpecies } from '../types/barnhem';

export const PET_FEED_STAR_REWARD = 5;
export const PET_DAILY_FEED_STAR_CAP = 3;

export interface PetSpeciesInfo {
  id: PetSpecies;
  emoji: string;
  nameTh: string;
  nameEn: string;
  defaultNameTh: string;
  defaultCoat: PetCoatStyle;
  soundTh: string;
  treatEmoji: string;
  treatTh: string;
  treatEn: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export const PET_SPECIES_CATALOG: PetSpeciesInfo[] = [
  {
    id: 'dog',
    emoji: '🐶',
    nameTh: 'น้องหมา',
    nameEn: 'Puppy',
    defaultNameTh: 'ปุ๊กปิ๊ก',
    defaultCoat: 'cream',
    soundTh: 'บ๊อกๆ!',
    treatEmoji: '🍗',
    treatTh: 'กระดูกเนื้อนุ่ม',
    treatEn: 'Bone Treat',
    badgeBg: '#FFF5BA',
    badgeText: '#5A4614',
    borderColor: '#E7B54D',
  },
  {
    id: 'shiba',
    emoji: '🐕',
    nameTh: 'ชิบะอินุ',
    nameEn: 'Shiba Inu',
    defaultNameTh: 'ฮาจิ',
    defaultCoat: 'calico',
    soundTh: 'โฮ่งๆ!',
    treatEmoji: '🥩',
    treatTh: 'เนื้อย่างหอมๆ',
    treatEn: 'Savory Bites',
    badgeBg: '#FFECD2',
    badgeText: '#693B12',
    borderColor: '#E59A54',
  },
  {
    id: 'cat',
    emoji: '🐱',
    nameTh: 'น้องแมว',
    nameEn: 'Kitten',
    defaultNameTh: 'ถุงเงิน',
    defaultCoat: 'calico',
    soundTh: 'เมี้ยว~',
    treatEmoji: '🐟',
    treatTh: 'ปลาทูย่างหอม',
    treatEn: 'Grilled Fish',
    badgeBg: '#EFE8FC',
    badgeText: '#3E2B63',
    borderColor: '#C8B7EB',
  },
  {
    id: 'rabbit',
    emoji: '🐰',
    nameTh: 'กระต่ายน้อย',
    nameEn: 'Bunny',
    defaultNameTh: 'โมจิ',
    defaultCoat: 'pink',
    soundTh: 'จุ๊บๆ~',
    treatEmoji: '🥕',
    treatTh: 'แครอทกรอบหวาน',
    treatEn: 'Crunchy Carrot',
    badgeBg: '#FFE8EF',
    badgeText: '#7B2E3B',
    borderColor: '#F3B7C0',
  },
  {
    id: 'hamster',
    emoji: '🐹',
    nameTh: 'แฮมสเตอร์',
    nameEn: 'Hamster',
    defaultNameTh: 'เมล็ด',
    defaultCoat: 'brown',
    soundTh: 'จี๊ดๆ!',
    treatEmoji: '🌻',
    treatTh: 'เมล็ดทานตะวัน',
    treatEn: 'Sunflower Seeds',
    badgeBg: '#FFF3DF',
    badgeText: '#6A4417',
    borderColor: '#E2AC79',
  },
  {
    id: 'panda',
    emoji: '🐼',
    nameTh: 'แพนด้า',
    nameEn: 'Panda',
    defaultNameTh: 'เปาเปา',
    defaultCoat: 'spotted',
    soundTh: 'งั่มๆ~',
    treatEmoji: '🎋',
    treatTh: 'ไผ่อ่อนสด',
    treatEn: 'Fresh Bamboo',
    badgeBg: '#E6FAF5',
    badgeText: '#144D42',
    borderColor: '#7CC6B8',
  },
  {
    id: 'fox',
    emoji: '🦊',
    nameTh: 'จิ้งจอกน้อย',
    nameEn: 'Little Fox',
    defaultNameTh: 'โซระ',
    defaultCoat: 'calico',
    soundTh: 'คิกๆ~',
    treatEmoji: '🍓',
    treatTh: 'เบอร์รี่ป่าหวาน',
    treatEn: 'Forest Berries',
    badgeBg: '#FFEAE3',
    badgeText: '#782F1B',
    borderColor: '#EB977C',
  },
  {
    id: 'penguin',
    emoji: '🐧',
    nameTh: 'เพนกวิน',
    nameEn: 'Penguin',
    defaultNameTh: 'ปิงปอง',
    defaultCoat: 'midnight',
    soundTh: 'ปี๊บๆ!',
    treatEmoji: '🐠',
    treatTh: 'ปลาแซลมอนสด',
    treatEn: 'Salmon Snack',
    badgeBg: '#E8F3FF',
    badgeText: '#1D4D73',
    borderColor: '#8FBCE6',
  },
  {
    id: 'duck',
    emoji: '🐥',
    nameTh: 'ลูกเป็ด',
    nameEn: 'Duckling',
    defaultNameTh: 'ก๊าบๆ',
    defaultCoat: 'cream',
    soundTh: 'ก๊าบๆ!',
    treatEmoji: '🌽',
    treatTh: 'ข้าวโพดหวาน',
    treatEn: 'Sweet Corn',
    badgeBg: '#FFF8CC',
    badgeText: '#694F0D',
    borderColor: '#F0CF65',
  },
  {
    id: 'capybara',
    emoji: '🤎',
    nameTh: 'คาปิบาร่า',
    nameEn: 'Capybara',
    defaultNameTh: 'คาปิ',
    defaultCoat: 'brown',
    soundTh: 'อือม์~',
    treatEmoji: '🍊',
    treatTh: 'ส้มยูซุชิลๆ',
    treatEn: 'Yuzu Orange',
    badgeBg: '#F4EDE4',
    badgeText: '#4F3926',
    borderColor: '#C4A281',
  },
];

export function getPetSpeciesInfo(species?: string): PetSpeciesInfo {
  return (
    PET_SPECIES_CATALOG.find((s) => s.id === species) ?? PET_SPECIES_CATALOG[0]
  );
}

export interface PetCoatOption {
  id: PetCoatStyle;
  labelTh: string;
  labelEn: string;
  body: string;
  ear: string;
  muzzle: string;
  spot?: string;
}

export const PET_COATS: PetCoatOption[] = [
  {
    id: 'cream',
    labelTh: 'ครีมนมสด',
    labelEn: 'Milky Cream',
    body: '#FFF3DF',
    ear: '#EBC89D',
    muzzle: '#FFFFFF',
  },
  {
    id: 'brown',
    labelTh: 'ชานมคาราเมล',
    labelEn: 'Caramel Tan',
    body: '#E2AC79',
    ear: '#B57B4C',
    muzzle: '#FFF0DC',
  },
  {
    id: 'spotted',
    labelTh: 'ขาวลายจุด',
    labelEn: 'Cute Spotted',
    body: '#FFFFFF',
    ear: '#4A3E39',
    muzzle: '#FFFDF9',
    spot: '#4A3E39',
  },
  {
    id: 'grey',
    labelTh: 'เทาเงินละมุน',
    labelEn: 'Soft Silver',
    body: '#D8DDE6',
    ear: '#9BA6B8',
    muzzle: '#F7F9FC',
  },
  {
    id: 'calico',
    labelTh: 'ส้มพีช / สามสี',
    labelEn: 'Peach Calico',
    body: '#FFD5A8',
    ear: '#E5955D',
    muzzle: '#FFF8F0',
    spot: '#C87849',
  },
  {
    id: 'mint',
    labelTh: 'เขียวมิ้นท์พาสเทล',
    labelEn: 'Pastel Mint',
    body: '#C9F3EA',
    ear: '#75C9B9',
    muzzle: '#F2FCFA',
  },
  {
    id: 'pink',
    labelTh: 'ชมพูซากุระ',
    labelEn: 'Sakura Pink',
    body: '#FFD9E4',
    ear: '#EC93AE',
    muzzle: '#FFF6F9',
  },
  {
    id: 'midnight',
    labelTh: 'ดำมิดไนท์',
    labelEn: 'Midnight',
    body: '#4F5768',
    ear: '#303642',
    muzzle: '#F4F7FB',
  },
];

export interface PetOutfitOption {
  id: PetOutfitId;
  emoji: string;
  labelTh: string;
  labelEn: string;
  minLevel: number;
}

export const PET_OUTFITS: PetOutfitOption[] = [
  { id: 'none', emoji: '🐾', labelTh: 'ชุดธรรมชาติ', labelEn: 'Natural', minLevel: 1 },
  { id: 'collar_heart', emoji: '❤️', labelTh: 'ปลอกคอหัวใจ', labelEn: 'Heart Collar', minLevel: 1 },
  { id: 'scarf_mint', emoji: '🧣', labelTh: 'ผ้าพันคอมิ้นท์', labelEn: 'Mint Scarf', minLevel: 1 },
  { id: 'ribbon_pink', emoji: '🎀', labelTh: 'โบว์ชมพูพาสเทล', labelEn: 'Pink Ribbon', minLevel: 1 },
  { id: 'hat_straw', emoji: '👒', labelTh: 'หมวกฟางสาน', labelEn: 'Straw Hat', minLevel: 2 },
  { id: 'glasses_cool', emoji: '😎', labelTh: 'แว่นกันแดดเท่ๆ', labelEn: 'Cool Shades', minLevel: 3 },
  { id: 'hoodie_star', emoji: '🧥', labelTh: 'เสื้อฮู้ดปักดาว', labelEn: 'Star Hoodie', minLevel: 4 },
  { id: 'cape_hero', emoji: '🦸', labelTh: 'ผ้าคลุมฮีโร่', labelEn: 'Hero Cape', minLevel: 5 },
];

export function createAdoptedPet(species: PetSpecies, now: Date, customName?: string): PetCompanionConfig {
  const iso = now.toISOString();
  const info = getPetSpeciesInfo(species);
  return {
    species,
    name: customName?.trim() || info.defaultNameTh,
    coat: info.defaultCoat,
    outfit: 'collar_heart',
    hunger: 72,
    happiness: 78,
    affection: 10,
    lastFedAt: iso,
    lastPlayedAt: iso,
  };
}

export function computeLivePetStats(pet: PetCompanionConfig, now: Date): {
  hunger: number;
  happiness: number;
  affection: number;
  level: number;
  nextLevelAffection: number;
  mood: 'happy' | 'hungry' | 'lonely';
} {
  const fedMs = Date.parse(pet.lastFedAt) || now.getTime();
  const playedMs = Date.parse(pet.lastPlayedAt) || now.getTime();
  const hoursFed = Math.max(0, (now.getTime() - fedMs) / (1000 * 60 * 60));
  const hoursPlayed = Math.max(0, (now.getTime() - playedMs) / (1000 * 60 * 60));

  const hunger = Math.min(100, Math.max(15, Math.round(pet.hunger - hoursFed * 3.5)));
  const happiness = Math.min(100, Math.max(20, Math.round(pet.happiness - hoursPlayed * 3)));
  const affection = Math.max(0, Math.floor(pet.affection));
  const level = Math.floor(affection / 30) + 1;
  const nextLevelAffection = level * 30;

  let mood: 'happy' | 'hungry' | 'lonely' = 'happy';
  if (hunger < 45) {
    mood = 'hungry';
  } else if (happiness < 50) {
    mood = 'lonely';
  }

  return {
    hunger,
    happiness,
    affection,
    level,
    nextLevelAffection,
    mood,
  };
}

export function getPetFeedStarStatus(
  pet: PetCompanionConfig | undefined,
  todayKey: string
): {
  usedToday: number;
  remainingToday: number;
  canEarnStars: boolean;
  rewardPerMeal: number;
  dailyCap: number;
} {
  const usedToday =
    pet && pet.lastFedRewardDate === todayKey
      ? Math.min(PET_DAILY_FEED_STAR_CAP, Math.max(0, pet.fedRewardCountToday ?? 0))
      : 0;
  const remainingToday = Math.max(0, PET_DAILY_FEED_STAR_CAP - usedToday);
  return {
    usedToday,
    remainingToday,
    canEarnStars: remainingToday > 0,
    rewardPerMeal: PET_FEED_STAR_REWARD,
    dailyCap: PET_DAILY_FEED_STAR_CAP,
  };
}

export function getNextFedPetState(
  pet: PetCompanionConfig,
  hungerGain: number,
  happyGain: number,
  loveGain: number,
  now: Date,
  todayKey: string
): {
  nextPet: PetCompanionConfig;
  earnedStars: number;
  usedTodayAfter: number;
  remainingAfter: number;
} {
  const live = computeLivePetStats(pet, now);
  const starStatus = getPetFeedStarStatus(pet, todayKey);
  const earnedStars = starStatus.canEarnStars ? PET_FEED_STAR_REWARD : 0;
  const usedTodayAfter = starStatus.canEarnStars ? starStatus.usedToday + 1 : starStatus.usedToday;
  const remainingAfter = Math.max(0, PET_DAILY_FEED_STAR_CAP - usedTodayAfter);

  const nextPet: PetCompanionConfig = {
    ...pet,
    hunger: Math.min(100, live.hunger + hungerGain),
    happiness: Math.min(100, live.happiness + happyGain),
    affection: live.affection + loveGain,
    lastFedAt: now.toISOString(),
    lastPlayedAt: now.toISOString(),
    lastFedRewardDate: todayKey,
    fedRewardCountToday: usedTodayAfter,
  };

  return {
    nextPet,
    earnedStars,
    usedTodayAfter,
    remainingAfter,
  };
}
