import {
  formatLeaveKindTh,
  formatLeaveSpanTh,
  getShiftCoverageAtDateTime,
} from '../data/staffSchedule';
import { AppState, Language, Member, MorningStreakState } from '../types/barnhem';
import { getDateKey } from './timeRules';
import { getTrashDutyInfoForDate } from './trashDuty';

export interface HouseChoreInfo {
  id: string;
  emoji: string;
  titleTh: string;
  titleEn: string;
  detailTh: string;
  detailEn: string;
}

export const HOUSE_CHORES_POOL: HouseChoreInfo[] = [
  {
    id: 'sweep_hall',
    emoji: '🧹',
    titleTh: 'กวาดพื้นโถงกลาง & ทางเดิน',
    titleEn: 'Sweep Main Hall & Walkway',
    detailTh: 'กวาดฝุ่นและเศษกระดาษให้สะอาดเรียบร้อย',
    detailEn: 'Sweep dust and paper scraps cleanly',
  },
  {
    id: 'mop_living',
    emoji: '🫧',
    titleTh: 'ถูพื้นห้องนั่งเล่น & มุมการบ้าน',
    titleEn: 'Mop Living & Study Area',
    detailTh: 'ถูพื้นด้วยน้ำยาถูพื้นให้สะอาดหอมสดชื่น',
    detailEn: 'Mop study & living zone neatly',
  },
  {
    id: 'trash_sort',
    emoji: '🗑️',
    titleTh: 'ทิ้งขยะ & แยกขวดรีไซเคิล',
    titleEn: 'Empty Trash & Sort Recycling',
    detailTh: 'รวบรวมถุงขยะและแยกขวดพลาสติกลงถังหน้าบ้าน',
    detailEn: 'Collect trash bags and sort bottles outside',
  },
  {
    id: 'water_plants',
    emoji: '🪴',
    titleTh: 'รดน้ำต้นไม้ & ดูแลสวนหน้าบ้าน',
    titleEn: 'Water Plants & Front Garden',
    detailTh: 'รดน้ำต้นไม้พอชุ่มและเก็บใบไม้แห้ง',
    detailEn: 'Water plants and clear dry leaves',
  },
  {
    id: 'organize_shoes',
    emoji: '👟',
    titleTh: 'จัดชั้นวางรองเท้า & กระเป๋านักเรียน',
    titleEn: 'Organize Shoe Rack & Bags',
    detailTh: 'เรียงรองเท้าให้เป็นคู่สวยงามเข้าชั้นวาง',
    detailEn: 'Line up shoes neatly on the rack',
  },
  {
    id: 'wipe_tables',
    emoji: '🧽',
    titleTh: 'เช็ดโต๊ะอาหาร & อ่างล้างมือ',
    titleEn: 'Wipe Dining Tables & Sinks',
    detailTh: 'เช็ดคราบบนโต๊ะอาหารและทำความสะอาดอ่างล้างมือ',
    detailEn: 'Wipe dining tables and clean wash sinks',
  },
];

export function getDailyHouseChoreForKid(
  kid: Member,
  allKids: Member[],
  now: Date
): HouseChoreInfo {
  if (kid.customHouseChore && kid.customHouseChore.trim()) {
    return {
      id: 'custom',
      emoji: '🏡',
      titleTh: kid.customHouseChore.trim(),
      titleEn: kid.customHouseChore.trim(),
      detailTh: 'เวรประจำวันที่พี่เลี้ยงมอบหมายให้เป็นพิเศษ',
      detailEn: 'Special daily house chore assigned by Staff',
    };
  }
  const idx = Math.max(
    0,
    allKids.findIndex((k) => k.id === kid.id)
  );
  const daySeed = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
  const choreIdx = (idx + daySeed) % HOUSE_CHORES_POOL.length;
  return HOUSE_CHORES_POOL[choreIdx];
}

export function getDefaultStreak(): MorningStreakState {
  return {
    currentMorningStreak: 0,
    bestMorningStreak: 0,
    lastOnTimeDateKey: null,
    streakMilestonesClaimed: 0,
  };
}

export function applyMorningStreakOnTime(
  kid: Member,
  now: Date
): {
  nextStreak: MorningStreakState;
  milestoneBonusStars: number;
  streakTextTh: string | null;
} {
  const todayKey = getDateKey(now);
  const prev = kid.streak ?? getDefaultStreak();

  // Already recorded on-time today
  if (prev.lastOnTimeDateKey === todayKey) {
    return { nextStreak: prev, milestoneBonusStars: 0, streakTextTh: null };
  }

  let isConsecutive = false;
  if (prev.lastOnTimeDateKey) {
    const prevDate = new Date(`${prev.lastOnTimeDateKey}T00:00:00`);
    const todayDate = new Date(`${todayKey}T00:00:00`);
    const diffDays = Math.round(
      (todayDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    // Allow 1 day gap OR bridging weekend Sat/Sun -> Mon (up to 3 days if today is Mon)
    if (diffDays === 1 || (now.getDay() === 1 && diffDays <= 3)) {
      isConsecutive = true;
    }
  }

  const nextCount = isConsecutive ? prev.currentMorningStreak + 1 : 1;
  const nextBest = Math.max(prev.bestMorningStreak, nextCount);
  const hitMilestone = nextCount > 0 && nextCount % 5 === 0;
  const milestoneBonusStars = hitMilestone ? 25 : 0;

  return {
    nextStreak: {
      currentMorningStreak: nextCount,
      bestMorningStreak: nextBest,
      lastOnTimeDateKey: todayKey,
      streakMilestonesClaimed:
        prev.streakMilestonesClaimed + (hitMilestone ? 1 : 0),
    },
    milestoneBonusStars,
    streakTextTh: hitMilestone
      ? `🔥 โบนัสมาเช้าต่อเนื่องครบ ${nextCount} วันติด! รับเพิ่ม +25 ⭐`
      : null,
  };
}

export function buildExecutiveLineDigest(
  state: AppState,
  now: Date,
  lang: Language
): string {
  const kids = state.members.filter((m) => m.role === 'kid');
  const todayKey = getDateKey(now);
  const dateDisplay = now.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const trashInfo = getTrashDutyInfoForDate(now);

  const topStars = [...kids]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 3)
    .map((k, i) => `${i + 1}. น้อง${k.nickname} (${k.stars.toLocaleString()} ⭐)`)
    .join('\n');

  const streakHeroes = kids
    .filter((k) => (k.streak?.currentMorningStreak ?? 0) >= 3)
    .sort(
      (a, b) =>
        (b.streak?.currentMorningStreak ?? 0) -
        (a.streak?.currentMorningStreak ?? 0)
    )
    .slice(0, 5)
    .map(
      (k) =>
        `• น้อง${k.nickname} (${k.streak?.currentMorningStreak ?? 0} วันติด)`
    );

  const activeSick = state.sickReports.filter((r) => !r.resolved);
  const totalFines = kids.reduce((sum, k) => sum + k.penalty.lateFineThb, 0);
  const houseChoresDone = kids.filter((k) => k.daily.houseChoreDone).length;
  const kitchenVerifiedToday = state.kitchenLogs.filter(
    (l) => l.dateKey === todayKey
  ).length;
  const pendingSupplies = state.supplyRequests.filter(
    (r) => r.status === 'pending'
  ).length;
  const unclaimedLost = state.lostFoundItems.filter(
    (i) => i.status !== 'claimed'
  ).length;
  const unreadDms = state.privateMessages.filter((m) => !m.readByStaff).length;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const shiftCoverage = getShiftCoverageAtDateTime(
    now,
    nowMinutes,
    state.staffLeaves ?? [],
    state.settings.isPublicHolidayToday
  );
  const leaveDigestLines =
    shiftCoverage.leavesForDate.length > 0
      ? shiftCoverage.leavesForDate
          .map(
            (l) =>
              `  - ${l.staffName}: ${formatLeaveKindTh(l.kind)} (${formatLeaveSpanTh(l)})${
                l.substituteName ? ` → แทนโดย ${l.substituteName}` : ' → ⚠️ รอจัดคนแทน'
              }`
          )
          .join('\n')
      : '  - ไม่มีพี่เลี้ยงลาวันนี้ (เข้าเวรครบ)';

  return [
    `📊 สรุปรายงานบ้าน Barnhem (${dateDisplay})`,
    `👧👦 จำนวนน้องทั้งหมด: ${kids.length} คน`,
    ``,
    `👩‍🏫 เวรพี่เลี้ยง ณ เวลา ${shiftCoverage.timeLabel} น.: ${
      shiftCoverage.onDutyNowNames.length > 0
        ? shiftCoverage.onDutyNowNames.join(', ')
        : '⚠️ ยังไม่มีผู้ดูแลระบุในกะนี้'
    }`,
    `🏖️ สถานะการลาพี่เลี้ยงวันนี้:`,
    leaveDigestLines,
    ``,
    `🏆 อันดับดาวความดีสูงสุด 3 อันดับ:`,
    topStars || '- ยังไม่มีข้อมูล',
    ``,
    `🔥 ดาวรุ่งมาเช้าต่อเนื่อง (3+ วัน):`,
    streakHeroes.length > 0 ? streakHeroes.join('\n') : '- กำลังสะสมสถิติเช้าต่อเนื่อง',
    ``,
    `🩺 เด็กป่วยที่กำลังดูแล: ${activeSick.length} เคส${
      activeSick.length > 0
        ? ` (${activeSick.map((s) => `${s.kidNickname}: ${s.symptoms}`).join(', ')})`
        : ''
    }`,
    `🧹 เวรทำเขตบริเวณเช้าวันนี้: เสร็จแล้ว ${houseChoresDone}/${kids.length} คน`,
    `🗑️ เวรทิ้งขยะสัปดาห์ที่ ${trashInfo.weekNumber} (พุธ/อาทิตย์): ชาย ${trashInfo.boyAssignee.displayNameTh} | หญิง ${trashInfo.girlAssignee.displayNameTh}`,
    `🍳 เวรห้องครัวที่แม่ครัวยืนยันวันนี้: ${kitchenVerifiedToday} ครั้ง`,
    `💰 ค่าปรับสายสะสมรวมทั้งบ้าน: ฿${totalFines.toLocaleString()}`,
    `📦 คำขอเบิกของใช้รอตรวจ: ${pendingSupplies} รายการ | 🔎 ของหายรอรับคืน: ${unclaimedLost} ชิ้น`,
    `💌 ข้อความหลังไมค์ยังไม่อ่าน: ${unreadDms} ข้อความ`,
  ].join('\n');
}
