import { PetCoatStyle, PetCompanionConfig, PetOutfitId, PetSpecies } from '../types/barnhem';

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
    ear: '#5E4B43',
    muzzle: '#FFFDF9',
    spot: '#6E5A52',
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
  return {
    species,
    name: customName?.trim() || (species === 'dog' ? 'ปุ๊กปิ๊ก' : 'ถุงเงิน'),
    coat: species === 'dog' ? 'cream' : 'calico',
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
