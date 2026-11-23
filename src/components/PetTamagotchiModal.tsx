import React, { useState } from 'react';
import {
  Announcement,
  Language,
  PetCoatStyle,
  PetCompanionConfig,
  PetOutfitId,
  PetSpecies,
} from '../types/barnhem';
import {
  computeLivePetStats,
  createAdoptedPet,
  getNextFedPetState,
  getPetFeedStarStatus,
  getPetSpeciesInfo,
  PET_COATS,
  PET_DAILY_FEED_STAR_CAP,
  PET_FEED_STAR_REWARD,
  PET_OUTFITS,
  PET_SPECIES_CATALOG,
} from '../utils/petCare';
import { getDateKey } from '../utils/timeRules';
import { PetCanvasSvg } from './PetCanvasSvg';

interface PetTamagotchiModalProps {
  pet?: PetCompanionConfig;
  now: Date;
  lang: Language;
  latestAnnouncement?: Announcement;
  announcementCount: number;
  onSavePet: (
    nextPet: PetCompanionConfig,
    actionLabel: string,
    bonusStars?: number,
    starReason?: string
  ) => void;
  onOpenAnnouncementsWithTreat: () => void;
}

export const PetTamagotchiModal: React.FC<PetTamagotchiModalProps> = ({
  pet,
  now,
  lang,
  latestAnnouncement,
  announcementCount,
  onSavePet,
  onOpenAnnouncementsWithTreat,
}) => {
  const [adoptSpecies, setAdoptSpecies] = useState<PetSpecies>('shiba');
  const [adoptCoat, setAdoptCoat] = useState<PetCoatStyle>('calico');
  const [adoptName, setAdoptName] = useState('ฮาจิ');
  const [nameEditedManually, setNameEditedManually] = useState(false);
  const [activeTab, setActiveTab] = useState<'care' | 'dress'>('care');
  const [nameInput, setNameInput] = useState(pet?.name ?? '');
  const [reactionText, setReactionText] = useState<string | null>(null);

  const todayKey = getDateKey(now);

  if (!pet) {
    const selectedInfo = getPetSpeciesInfo(adoptSpecies);
    const previewPet: PetCompanionConfig = {
      ...createAdoptedPet(adoptSpecies, now, adoptName),
      coat: adoptCoat,
      outfit: 'collar_heart',
    };

    return (
      <div className="space-y-4 text-[#3D322C]">
        <div className="rounded-[24px] sm:rounded-3xl border-2 border-[#F5D2DC] bg-[#FFF8FA] p-3.5 sm:p-5 text-center space-y-3.5">
          <div className="space-y-1">
            <div className="text-sm sm:text-base font-extrabold text-[#6B3242]">
              🐾{' '}
              {lang === 'th'
                ? 'เลือกเลี้ยงสัตว์ทามาก๊อตจิ (10 สายพันธุ์ · ฟรี!)'
                : 'Adopt a Tamagotchi Companion (10 Species · Free!)'}
            </div>
            <div className="text-[11px] font-semibold text-[#8C5262]">
              {lang === 'th'
                ? `เข้ามาให้อาหารทุกวันรับ +${PET_FEED_STAR_REWARD} ⭐/มื้อ (สูงสุด ${PET_DAILY_FEED_STAR_CAP} มื้อ/วัน = +${PET_FEED_STAR_REWARD * PET_DAILY_FEED_STAR_CAP} ⭐)`
                : `Feed daily to earn +${PET_FEED_STAR_REWARD} ⭐/meal (up to ${PET_DAILY_FEED_STAR_CAP} meals/day)`}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="rounded-3xl border-2 border-[#EBD8C3] bg-white px-7 py-3 shadow-xs flex flex-col items-center gap-1">
              <PetCanvasSvg pet={previewPet} mood="happy" sizeClass="w-24 h-24 sm:w-28 sm:h-28" />
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold border"
                style={{
                  backgroundColor: selectedInfo.badgeBg,
                  color: selectedInfo.badgeText,
                  borderColor: selectedInfo.borderColor,
                }}
              >
                {selectedInfo.emoji} {lang === 'th' ? selectedInfo.nameTh : selectedInfo.nameEn}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PET_SPECIES_CATALOG.map((sp) => {
              const selected = adoptSpecies === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => {
                    setAdoptSpecies(sp.id);
                    setAdoptCoat(sp.defaultCoat);
                    if (!nameEditedManually || !adoptName.trim()) {
                      setAdoptName(sp.defaultNameTh);
                    }
                  }}
                  className={`min-h-[48px] rounded-2xl border-2 px-2.5 py-2 text-xs font-extrabold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                    selected
                      ? 'shadow-xs scale-[1.02]'
                      : 'border-[#EBD8C3] bg-white text-[#6E5C52] hover:bg-[#FFFDF9]'
                  }`}
                  style={
                    selected
                      ? {
                          backgroundColor: sp.badgeBg,
                          borderColor: sp.borderColor,
                          color: sp.badgeText,
                        }
                      : undefined
                  }
                >
                  <span className="text-base">{sp.emoji}</span>
                  <span className="truncate">{lang === 'th' ? sp.nameTh : sp.nameEn}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 max-w-md mx-auto text-left">
            <label className="text-xs font-bold text-[#6E5C52] block">
              {lang === 'th' ? 'สีขนของน้อง' : 'Coat Color'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PET_COATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAdoptCoat(c.id)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border cursor-pointer flex items-center gap-1.5 ${
                    adoptCoat === c.id
                      ? 'border-[#3D322C] bg-[#FFFDF9] shadow-xs'
                      : 'border-[#EBD8C3] bg-white/80 text-[#6E5C52]'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-[#3D322C]/30 shrink-0"
                    style={{ backgroundColor: c.body }}
                  />
                  <span>{lang === 'th' ? c.labelTh : c.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 max-w-md mx-auto text-left">
            <label className="text-xs font-bold text-[#6E5C52] block">
              {lang === 'th' ? 'ตั้งชื่อให้สัตว์เลี้ยง' : 'Pet Name'}
            </label>
            <input
              type="text"
              maxLength={24}
              value={adoptName}
              onChange={(e) => {
                setNameEditedManually(true);
                setAdoptName(e.target.value);
              }}
              placeholder={lang === 'th' ? 'เช่น ฮาจิ, โมจิ, เปาเปา, คาปิ' : 'e.g. Mochi'}
              className="w-full rounded-xl border-2 border-[#EBD8C3] bg-white px-3.5 py-2 text-sm font-bold"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              const newPet = createAdoptedPet(adoptSpecies, now, adoptName);
              newPet.coat = adoptCoat;
              setNameInput(newPet.name);
              onSavePet(newPet, `Adopt Pet: ${newPet.name} (${selectedInfo.nameTh})`);
            }}
            className="w-full sm:w-auto min-h-[48px] rounded-2xl bg-[#B7EFE5] hover:bg-[#A0E8DC] border-2 border-[#6CCBC0] px-7 py-2.5 text-sm font-extrabold text-[#114A42] cursor-pointer"
          >
            ✨ {lang === 'th' ? `รับเลี้ยง "${adoptName.trim() || selectedInfo.defaultNameTh}" เลย!` : 'Adopt Now!'}
          </button>
        </div>
      </div>
    );
  }

  const speciesInfo = getPetSpeciesInfo(pet.species);
  const live = computeLivePetStats(pet, now);
  const feedStars = getPetFeedStarStatus(pet, todayKey);
  const noticedToday = pet.lastNoticeBonusDate === todayKey;

  const feedPet = (foodLabel: string, hungerGain: number, happyGain: number, loveGain: number) => {
    const { nextPet, earnedStars, remainingAfter } = getNextFedPetState(
      pet,
      hungerGain,
      happyGain,
      loveGain,
      now,
      todayKey
    );
    const starReason =
      earnedStars > 0
        ? `🐾 ให้อาหาร ${pet.name} (${foodLabel}) (+${earnedStars} ⭐)`
        : undefined;
    onSavePet(nextPet, `Feed Pet (${foodLabel})`, earnedStars, starReason);
    setReactionText(
      lang === 'th'
        ? earnedStars > 0
          ? `${speciesInfo.soundTh} ${pet.name} กิน${foodLabel} อร่อยมาก! รับ +${earnedStars} ⭐ & +${loveGain} ❤️ (เหลือโบนัสวันนี้ ${remainingAfter} มื้อ)`
          : `${speciesInfo.soundTh} ${pet.name} อิ่มอร่อยกับ${foodLabel} (+${loveGain} ❤️) (วันนี้รับดาวครบ ${PET_DAILY_FEED_STAR_CAP} มื้อแล้ว)`
        : earnedStars > 0
        ? `Yum! ${pet.name} loved ${foodLabel}! Earned +${earnedStars} ⭐!`
        : `Yum! ${pet.name} loved ${foodLabel}!`
    );
  };

  const playWithPet = (actLabel: string, happyGain: number, loveGain: number) => {
    const nextHappy = Math.min(100, live.happiness + happyGain);
    const nextPet: PetCompanionConfig = {
      ...pet,
      hunger: live.hunger,
      happiness: nextHappy,
      affection: live.affection + loveGain,
      lastPlayedAt: now.toISOString(),
    };
    onSavePet(nextPet, `Play Pet (${actLabel})`);
    setReactionText(
      lang === 'th'
        ? `${speciesInfo.soundTh} ${pet.name} มีความสุขสุดๆ (+${loveGain} ❤️)`
        : `${pet.name} is super happy! (+${loveGain} ❤️)`
    );
  };

  const changeOutfit = (outfitId: PetOutfitId) => {
    onSavePet({ ...pet, outfit: outfitId }, `Dress Pet (${outfitId})`);
    setReactionText(
      lang === 'th' ? `ว้าว! ${pet.name} ใส่ชุดใหม่น่ารักจังเลย ✨` : `${pet.name} looks adorable!`
    );
  };

  const speechMessage =
    reactionText ??
    (live.mood === 'hungry'
      ? lang === 'th'
        ? `${pet.name} ท้องร้องจ๊อกๆ แล้ว~ แวะมาป้อนข้าวรับ +${PET_FEED_STAR_REWARD} ⭐ นะ!`
        : `${pet.name} is getting hungry!`
      : live.mood === 'lonely'
      ? lang === 'th'
        ? `${pet.name} คิดถึงหนูจัง ลูบหัวหรือเล่นด้วยกันหน่อยสิ 💕`
        : `${pet.name} misses you!`
      : !noticedToday && latestAnnouncement
      ? lang === 'th'
        ? `วันนี้บ้านมีประกาศ “${latestAnnouncement.title}” ด้วยนะ! กดอ่านด้วยกันรับขนมฟรีเลย~`
        : `There’s a house notice today: "${latestAnnouncement.title}"! Let’s check it!`
      : lang === 'th'
      ? `อยู่ข้างๆ หนูเสมอเลยนะ สู้ๆ วันนี้! 💖`
      : `Always cheering for you today! 💖`);

  return (
    <div className="space-y-3.5 text-[#3D322C]">
      {/* Retro-Cute Tamagotchi LCD Screen */}
      <div className="rounded-[24px] sm:rounded-[28px] border-4 border-[#F3B7C0] bg-[#FFF5F7] p-3.5 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-[#7B2E3B] text-sm">
              {speciesInfo.emoji} {pet.name} · Lv.{live.level}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
              style={{
                backgroundColor: speciesInfo.badgeBg,
                color: speciesInfo.badgeText,
                borderColor: speciesInfo.borderColor,
              }}
            >
              {lang === 'th' ? speciesInfo.nameTh : speciesInfo.nameEn}
            </span>
          </div>
          <span className="font-bold text-[#8C5262] tabular-nums">
            ❤️ {live.affection} / {live.nextLevelAffection}
          </span>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border-2 border-[#EBD8C3] bg-[#FFFDF9] p-3.5 sm:p-4 flex flex-col sm:flex-row items-center gap-3.5 sm:gap-4">
          <div className="shrink-0">
            <PetCanvasSvg pet={pet} mood={live.mood} sizeClass="w-24 h-24 sm:w-28 sm:h-28" />
          </div>

          <div className="flex-1 w-full space-y-2.5">
            <div className="rounded-2xl bg-[#FFF8CC] border border-[#F5DE93] px-3 py-2 text-xs sm:text-sm font-bold text-[#5A4614]">
              💬 “{speechMessage}”
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>🥣 {lang === 'th' ? 'ความอิ่ม' : 'Fullness'}</span>
                  <span className="tabular-nums">{live.hunger}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#F3E9DF] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#6CCBC0] transition-all"
                    style={{ width: `${live.hunger}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>💖 {lang === 'th' ? 'ความสุข' : 'Happiness'}</span>
                  <span className="tabular-nums">{live.happiness}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#F3E9DF] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F28B9C] transition-all"
                    style={{ width: `${live.happiness}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Feeding Star Reward Progress Strip */}
        <div className="rounded-2xl border border-[#F2D572] bg-[#FFFBEB] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-extrabold text-[#5A4614]">
            ⭐{' '}
            {lang === 'th'
              ? `โบนัสให้อาหารได้ดาววันนี้: ${feedStars.usedToday}/${feedStars.dailyCap} มื้อ (มื้อละ +${feedStars.rewardPerMeal} ⭐)`
              : `Daily Feeding Stars: ${feedStars.usedToday}/${feedStars.dailyCap} meals (+${feedStars.rewardPerMeal} ⭐ each)`}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
              feedStars.canEarnStars
                ? 'bg-[#FFF0A3] text-[#6B4800]'
                : 'bg-[#E6FAF5] text-[#144D42]'
            }`}
          >
            {feedStars.canEarnStars
              ? lang === 'th'
                ? `เหลือรับดาวได้อีก ${feedStars.remainingToday} มื้อ`
                : `${feedStars.remainingToday} left today`
              : lang === 'th'
              ? 'รับดาวครบ 3 มื้อวันนี้แล้ว ✓'
              : 'Max stars earned today ✓'}
          </span>
        </div>

        {/* Daily Announcement Engagement Hook */}
        <div className="rounded-2xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-xs text-[#5A4614] min-w-0 flex-1">
            <div className="font-extrabold truncate">
              📢 {lang === 'th' ? `เช็คประกาศบ้านกับ ${pet.name} (${announcementCount} เรื่อง)` : `Check Notices (${announcementCount})`}
            </div>
            <div className="text-[11px] text-[#7A6428]">
              {noticedToday
                ? lang === 'th'
                  ? 'วันนี้รับขนมพิเศษจากการอ่านประกาศแล้ว'
                  : 'Daily notice treat claimed today!'
                : lang === 'th'
                ? 'กดอ่านประกาศวันนี้รับ “🍱 ขนมพิเศษฟรี” (+25% อิ่ม & สุข)'
                : 'Read today’s notices for a free Special Pet Treat!'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!noticedToday) {
                onSavePet(
                  {
                    ...pet,
                    hunger: Math.min(100, live.hunger + 25),
                    happiness: Math.min(100, live.happiness + 25),
                    affection: live.affection + 15,
                    lastFedAt: now.toISOString(),
                    lastPlayedAt: now.toISOString(),
                    lastNoticeBonusDate: todayKey,
                  },
                  'Pet Daily Notice Bonus'
                );
              }
              onOpenAnnouncementsWithTreat();
            }}
            className="min-h-[38px] rounded-xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#E7C958] px-3 py-1.5 text-xs font-extrabold text-[#5A4614] cursor-pointer whitespace-nowrap"
          >
            📢 {lang === 'th' ? (noticedToday ? 'เปิดดูประกาศ' : 'อ่านประกาศ + ขนมฟรี') : 'Notices'}
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('care')}
          className={`min-h-[44px] rounded-2xl font-extrabold text-xs sm:text-sm border cursor-pointer transition-colors px-2 ${
            activeTab === 'care'
              ? 'bg-[#DCF7F2] border-[#6CCBC0] text-[#114A42]'
              : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
          }`}
        >
          🥣 {lang === 'th' ? 'ให้อาหาร (+⭐) & เล่น' : 'Feed (+⭐) & Play'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dress')}
          className={`min-h-[44px] rounded-2xl font-extrabold text-xs sm:text-sm border cursor-pointer transition-colors px-2 ${
            activeTab === 'dress'
              ? 'bg-[#EFE8FC] border-[#C8B7EB] text-[#3E2B63]'
              : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
          }`}
        >
          🐾 {lang === 'th' ? '10 สายพันธุ์ & แต่งตัว' : '10 Breeds & Dress'}
        </button>
      </div>

      {activeTab === 'care' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => feedPet(lang === 'th' ? 'อาหารเม็ดรวม' : 'Pet Kibble', 20, 10, 5)}
              className="min-h-[54px] rounded-2xl border border-[#C7EBDD] bg-[#F5FCF9] hover:bg-[#E7F8F1] px-3.5 py-2.5 text-left cursor-pointer flex sm:block items-center justify-between gap-2"
            >
              <div className="text-sm font-extrabold text-[#1E5942]">
                🥣 {lang === 'th' ? 'อาหารเม็ดรวม' : 'Pet Kibble'}
              </div>
              <div className="text-[11px] text-[#3A755D]">
                +20 อิ่ม · +10 สุข {feedStars.canEarnStars ? `· +${PET_FEED_STAR_REWARD} ⭐` : '· ฟรี'}
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                feedPet(lang === 'th' ? speciesInfo.treatTh : speciesInfo.treatEn, 35, 18, 8)
              }
              className="min-h-[54px] rounded-2xl border border-[#F5DE93] bg-[#FFFDF0] hover:bg-[#FFF6D1] px-3.5 py-2.5 text-left cursor-pointer flex sm:block items-center justify-between gap-2"
            >
              <div className="text-sm font-extrabold text-[#5A4614]">
                {speciesInfo.treatEmoji} {lang === 'th' ? speciesInfo.treatTh : speciesInfo.treatEn}
              </div>
              <div className="text-[11px] text-[#7A6428]">
                +35 อิ่ม · +18 สุข {feedStars.canEarnStars ? `· +${PET_FEED_STAR_REWARD} ⭐` : '· ฟรี'}
              </div>
            </button>
            <button
              type="button"
              onClick={() => feedPet(lang === 'th' ? 'นม & ผลไม้สด' : 'Milk & Fruit', 15, 22, 6)}
              className="min-h-[54px] rounded-2xl border border-[#CAE2F6] bg-[#F5FAFF] hover:bg-[#E8F3FF] px-3.5 py-2.5 text-left cursor-pointer flex sm:block items-center justify-between gap-2"
            >
              <div className="text-sm font-extrabold text-[#1D4D73]">
                🥛 {lang === 'th' ? 'นม & ผลไม้สด' : 'Milk & Fruit'}
              </div>
              <div className="text-[11px] text-[#456D8F]">
                +15 อิ่ม · +22 สุข {feedStars.canEarnStars ? `· +${PET_FEED_STAR_REWARD} ⭐` : '· ฟรี'}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => playWithPet('เล่นของเล่นด้วยกัน', 22, 8)}
              className="min-h-[48px] rounded-2xl border border-[#F3B7C0] bg-[#FFF5F7] hover:bg-[#FFE9EE] px-4 py-2.5 font-extrabold text-sm text-[#7B2E3B] cursor-pointer"
            >
              🎾 {lang === 'th' ? 'เล่นกับน้อง' : 'Play Together'} (+22 สุข)
            </button>
            <button
              type="button"
              onClick={() => playWithPet('ลูบหัวกอดเบาๆ', 15, 6)}
              className="min-h-[48px] rounded-2xl border border-[#C8B7EB] bg-[#FAF7FF] hover:bg-[#EFE8FC] px-4 py-2.5 font-extrabold text-sm text-[#3E2B63] cursor-pointer"
            >
              🤍 {lang === 'th' ? 'ลูบหัวกอดเบาๆ' : 'Gentle Petting'} (+15 สุข)
            </button>
          </div>
        </div>
      )}

      {activeTab === 'dress' && (
        <div className="space-y-4">
          {/* Switch Between All 10 Breeds */}
          <div className="rounded-2xl border border-[#EBD8C3] bg-white p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-[#6E5C52]">
                🐾 {lang === 'th' ? 'เปลี่ยนสายพันธุ์สัตว์เลี้ยง (10 สายพันธุ์ · ฟรี)' : 'Switch Species (10 Breeds)'}
              </div>
              <span className="text-[11px] text-[#8C7A6E]">
                {lang === 'th' ? 'แต้มความผูกพัน & ดาวอยู่ครบ' : 'Affection & level kept'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PET_SPECIES_CATALOG.map((sp) => {
                const isSelected = pet.species === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      onSavePet(
                        {
                          ...pet,
                          species: sp.id,
                          coat: sp.defaultCoat,
                        },
                        `Switch Pet to ${sp.nameTh}`
                      );
                      setReactionText(
                        lang === 'th'
                          ? `${sp.soundTh} เปลี่ยนเป็น ${sp.nameTh} สุดน่ารักแล้ว!`
                          : `Switched to ${sp.nameEn}!`
                      );
                    }}
                    className={`min-h-[42px] rounded-xl px-2.5 py-1.5 text-xs font-extrabold border-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'shadow-xs'
                        : 'bg-[#FFFDF9] border-[#EBD8C3] text-[#6E5C52] hover:bg-[#FAF5EF]'
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: sp.badgeBg,
                            borderColor: sp.borderColor,
                            color: sp.badgeText,
                          }
                        : undefined
                    }
                  >
                    <span>{sp.emoji}</span>
                    <span className="truncate">{lang === 'th' ? sp.nameTh : sp.nameEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rename Pet */}
          <div className="rounded-2xl border border-[#EBD8C3] bg-white p-3 space-y-2">
            <div className="text-xs font-bold text-[#6E5C52]">
              ✏️ {lang === 'th' ? 'เปลี่ยนชื่อสัตว์เลี้ยง' : 'Rename Pet'}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={24}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] px-3 py-2 text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => {
                  const clean = nameInput.trim();
                  if (!clean) return;
                  onSavePet({ ...pet, name: clean }, `Rename Pet: ${clean}`);
                  setReactionText(lang === 'th' ? `ตั้งชื่อใหม่เป็น "${clean}" แล้ว!` : `Renamed to ${clean}!`);
                }}
                className="rounded-xl bg-[#3D322C] text-white px-4 py-2 text-xs font-bold cursor-pointer shrink-0"
              >
                {lang === 'th' ? 'บันทึก' : 'Save'}
              </button>
            </div>
          </div>

          {/* Coat Styles */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[#6E5C52]">
              🎨 {lang === 'th' ? 'เลือกสีขน / สีตัวสัตว์เลี้ยง' : 'Coat Style'}
            </div>
            <div className="flex flex-wrap gap-2">
              {PET_COATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSavePet({ ...pet, coat: c.id }, `Change Pet Coat (${c.id})`)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold border cursor-pointer flex items-center gap-1.5 ${
                    pet.coat === c.id
                      ? 'border-[#3D322C] bg-[#FFF8CC]'
                      : 'border-[#EBD8C3] bg-white hover:bg-[#FAF5EF]'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-[#3D322C]/30 shrink-0"
                    style={{ backgroundColor: c.body }}
                  />
                  <span>{lang === 'th' ? c.labelTh : c.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Outfits */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[#6E5C52]">
              👗 {lang === 'th' ? 'แต่งตัวให้น้อง (ปลดล็อกฟรีตาม Lv. ความสนิท)' : 'Pet Outfits (Free via Love Level)'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PET_OUTFITS.map((item) => {
                const unlocked = live.level >= item.minLevel;
                const equipped = pet.outfit === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => changeOutfit(item.id)}
                    className={`min-h-[54px] rounded-2xl border p-2.5 text-center transition-colors ${
                      !unlocked
                        ? 'border-[#E8DDD3] bg-[#FAF7F3] text-[#9A8A80] opacity-70 cursor-not-allowed'
                        : equipped
                        ? 'border-[#C8B7EB] bg-[#EFE8FC] text-[#3E2B63] font-extrabold cursor-pointer'
                        : 'border-[#EBD8C3] bg-white hover:bg-[#FFF5F7] text-[#3D322C] font-bold cursor-pointer'
                    }`}
                  >
                    <div className="text-lg">{unlocked ? item.emoji : '🔒'}</div>
                    <div className="text-xs mt-0.5 truncate">
                      {lang === 'th' ? item.labelTh : item.labelEn}
                    </div>
                    {!unlocked && (
                      <div className="text-[10px] font-semibold">Lv.{item.minLevel}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
