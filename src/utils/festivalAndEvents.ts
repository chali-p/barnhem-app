import { Announcement, FestivalId, Language, Member } from '../types/barnhem';
import { getMinutesOfDay, isPublicHoliday } from './timeRules';

export interface ActiveFestivalInfo {
  id: FestivalId;
  nameTh: string;
  nameEn: string;
  emoji: string;
  dateWindowTh: string;
  dateWindowEn: string;
  defaultOutfitId: string;
  defaultPropId?: string;
  outfitNameTh: string;
  outfitNameEn: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bannerGradient: string;
  announcementTitleTh: string;
  announcementTitleEn: string;
  announcementBodyTh: string;
  announcementBodyEn: string;
  decorEmojis: [string, string, string];
}

export const FESTIVAL_CATALOG: ActiveFestivalInfo[] = [
  {
    id: 'loy_krathong',
    nameTh: 'เทศกาลลอยกระทง',
    nameEn: 'Loy Krathong Festival',
    emoji: '🪷',
    dateWindowTh: '15–28 พฤศจิกายน',
    dateWindowEn: 'Nov 15–28',
    defaultOutfitId: 'fest_outfit_loy_krathong',
    defaultPropId: 'fest_prop_krathong',
    outfitNameTh: 'ชุดไทยประยุกต์ลอยกระทง',
    outfitNameEn: 'Thai Festive Loy Krathong Set',
    primaryColor: '#F6D6E3',
    secondaryColor: '#D49A45',
    accentColor: '#A85B73',
    bannerGradient: 'linear-gradient(135deg, #FFF5BA 0%, #FADADD 55%, #EAE4F2 100%)',
    announcementTitleTh: '🪷 สุขสันต์เทศกาลลอยกระทงบ้าน Barnhem!',
    announcementTitleEn: '🪷 Happy Loy Krathong Festival!',
    announcementBodyTh:
      'ชวนน้องๆ แต่งตัวด้วย "ชุดไทยประยุกต์ลอยกระทง" และถือกระทงประทีปทองรับเทศกาลได้เลย! (หากไปโรงเรียนยังใส่ชุดนักเรียนเหมือนเดิมหรือกดเปลี่ยนสลับชุดในตู้เสื้อผ้าได้ค่ะ)',
    announcementBodyEn:
      'Try on the free Loy Krathong Thai outfit & glowing Krathong prop! When going to school, school uniform still applies — switch freely anytime!',
    decorEmojis: ['🪷', '🏮', '✨'],
  },
  {
    id: 'christmas',
    nameTh: 'เทศกาลคริสต์มาส',
    nameEn: 'Christmas Festival',
    emoji: '🎄',
    dateWindowTh: '19–27 ธันวาคม',
    dateWindowEn: 'Dec 19–27',
    defaultOutfitId: 'fest_outfit_christmas',
    defaultPropId: 'fest_prop_christmas_gift',
    outfitNameTh: 'ชุดซานต้าพาสเทลคริสต์มาส',
    outfitNameEn: 'Pastel Santa Festive Outfit',
    primaryColor: '#E56B7A',
    secondaryColor: '#FFFDF9',
    accentColor: '#3B7A57',
    bannerGradient: 'linear-gradient(135deg, #FFE4E8 0%, #FFFDF9 50%, #DCF3E8 100%)',
    announcementTitleTh: '🎄 Merry Christmas! เทศกาลคริสต์มาสอบอุ่น',
    announcementTitleEn: '🎄 Merry Christmas at Barnhem!',
    announcementBodyTh:
      'เปิดให้ใส่น้องใส่ "ชุดซานต้าพาสเทล" และหมวก/ของขวัญคริสต์มาสฟรีตลอดเทศกาล! ไปโรงเรียนยังคงใส่ชุดนักเรียนหรือสลับชุดได้ค่ะ',
    announcementBodyEn:
      'Pastel Santa outfit & festive gift props are unlocked for free during Christmas! Switch between uniform and festive outfit anytime.',
    decorEmojis: ['🎄', '❄️', '🎁'],
  },
  {
    id: 'new_year',
    nameTh: 'เทศกาลปีใหม่',
    nameEn: 'New Year Celebration',
    emoji: '🎉',
    dateWindowTh: '28 ธันวาคม – 4 มกราคม',
    dateWindowEn: 'Dec 28 – Jan 4',
    defaultOutfitId: 'fest_outfit_new_year',
    outfitNameTh: 'ชุดปาร์ตี้ปีใหม่สายรุ้ง',
    outfitNameEn: 'Rainbow New Year Party Set',
    primaryColor: '#FFF1A8',
    secondaryColor: '#9C89D9',
    accentColor: '#7B4FA3',
    bannerGradient: 'linear-gradient(135deg, #FFF5BA 0%, #DCEEF8 55%, #FADADD 100%)',
    announcementTitleTh: '🎉 สวัสดีปีใหม่! เทศกาลฉลองขึ้นปีใหม่',
    announcementTitleEn: '🎉 Happy New Year Celebration!',
    announcementBodyTh:
      'เริ่มต้นปีใหม่สดใส! ใส่ "ชุดปาร์ตี้ปีใหม่สายรุ้ง" และมงกุฎฉลองปีใหม่ได้เลย หรือสลับใส่ชุดนักเรียนเมื่อไปเรียนตามปกติค่ะ',
    announcementBodyEn:
      'Welcome the New Year in the Rainbow Party Set! Freely switch between festive outfit and school uniform.',
    decorEmojis: ['🎉', '🎆', '🥳'],
  },
  {
    id: 'childrens_day',
    nameTh: 'วันเด็กแห่งชาติ',
    nameEn: "National Children's Day",
    emoji: '🎈',
    dateWindowTh: 'สัปดาห์วันเด็ก (มกราคม)',
    dateWindowEn: "Children's Day Week (Jan)",
    defaultOutfitId: 'fest_outfit_childrens_day',
    defaultPropId: 'fest_prop_balloon',
    outfitNameTh: 'ชุดนักสำรวจวันเด็กสุดคิวท์',
    outfitNameEn: "Children's Day Explorer Set",
    primaryColor: '#A7E3DC',
    secondaryColor: '#F39C6B',
    accentColor: '#1E6B62',
    bannerGradient: 'linear-gradient(135deg, #D4F0F0 0%, #FFF5BA 55%, #FADADD 100%)',
    announcementTitleTh: '🎈 สุขสันต์วันเด็กแห่งชาติ บ้าน Barnhem!',
    announcementTitleEn: "🎈 Happy National Children's Day!",
    announcementBodyTh:
      'วันเด็กปีนี้ชวนน้องๆ ใส่ "ชุดนักสำรวจวันเด็ก" และลูกโป่งพาสเทลร่วมกิจกรรมสนุกๆ กันนะ!',
    announcementBodyEn:
      "Celebrate Children's Day with the free Explorer Set and pastel balloons!",
    decorEmojis: ['🎈', '🧸', '🌟'],
  },
  {
    id: 'chinese_new_year',
    nameTh: 'เทศกาลตรุษจีน',
    nameEn: 'Chinese New Year',
    emoji: '🧧',
    dateWindowTh: 'ช่วงเทศกาลตรุษจีน',
    dateWindowEn: 'Chinese New Year Season',
    defaultOutfitId: 'fest_outfit_cny',
    outfitNameTh: 'ชุดกี่เพ้า / เสื้อจีนมงคลแดงทอง',
    outfitNameEn: 'Lucky Red & Gold Festive Set',
    primaryColor: '#D94E5C',
    secondaryColor: '#F5C97B',
    accentColor: '#8F1D2C',
    bannerGradient: 'linear-gradient(135deg, #FFE2E6 0%, #FFF5BA 60%, #FADADD 100%)',
    announcementTitleTh: '🧧 ซินเจียยู่อี่ ซินนี้ฮวดไช้! ตรุษจีนบ้าน Barnhem',
    announcementTitleEn: '🧧 Happy Chinese New Year!',
    announcementBodyTh:
      'ใส่ "ชุดกี่เพ้า / เสื้อจีนมงคล" เสริมสิริมงคลรับอั่งเปาดาวได้เลยค่ะ ไปโรงเรียนสามารถใส่ชุดนักเรียนเหมือนเดิมหรือเปลี่ยนชุดได้นะ',
    announcementBodyEn:
      'Put on the Lucky Red & Gold outfit for Chinese New Year! Switch with school uniform anytime.',
    decorEmojis: ['🧧', '🏮', '🍊'],
  },
  {
    id: 'valentine',
    nameTh: 'เทศกาลวาเลนไทน์',
    nameEn: "Valentine's Day",
    emoji: '💝',
    dateWindowTh: '12–16 กุมภาพันธ์',
    dateWindowEn: 'Feb 12–16',
    defaultOutfitId: 'fest_outfit_valentine',
    outfitNameTh: 'ชุดสเวตเตอร์หัวใจวาเลนไทน์',
    outfitNameEn: 'Sweet Heart Valentine Knit',
    primaryColor: '#FADADD',
    secondaryColor: '#E86F87',
    accentColor: '#9E2B48',
    bannerGradient: 'linear-gradient(135deg, #FFE4EC 0%, #FFFDF9 55%, #FDE2D2 100%)',
    announcementTitleTh: '💝 สัปดาห์แห่งความรัก & การ์ดขอบคุณบ้าน Barnhem',
    announcementTitleEn: "💝 Valentine's Kindness Week!",
    announcementBodyTh:
      'ชวนน้องส่งการ์ดขอบคุณความดีให้เพื่อนและพี่เลี้ยง พร้อมเปลี่ยนเป็น "ชุดสเวตเตอร์หัวใจ" น่ารักๆ ได้ฟรีตลอดเทศกาลค่ะ',
    announcementBodyEn:
      'Send kindness cards to friends & staff and wear the Valentine Heart Knit set!',
    decorEmojis: ['💝', '🌸', '💌'],
  },
  {
    id: 'songkran',
    nameTh: 'เทศกาลสงกรานต์',
    nameEn: 'Songkran Water Festival',
    emoji: '💦',
    dateWindowTh: '11–18 เมษายน',
    dateWindowEn: 'Apr 11–18',
    defaultOutfitId: 'fest_outfit_songkran',
    defaultPropId: 'fest_prop_water_bowl',
    outfitNameTh: 'เสื้อลายดอกสงกรานต์สดใส',
    outfitNameEn: 'Songkran Tropical Floral Shirt',
    primaryColor: '#7CC6E8',
    secondaryColor: '#F59E7A',
    accentColor: '#1B5E82',
    bannerGradient: 'linear-gradient(135deg, #DCEEF8 0%, #D4F0F0 50%, #FFF5BA 100%)',
    announcementTitleTh: '💦 สวัสดีวันสงกรานต์ & ปีใหม่ไทย!',
    announcementTitleEn: '💦 Happy Songkran Thai New Year!',
    announcementBodyTh:
      'เปิดให้ใส่น้องใส่ "เสื้อลายดอกสงกรานต์" พร้อมแว่นกันน้ำและขันดอกมะลิฟรีตลอดเทศกาล เล่นน้ำอย่างปลอดภัยและเคารพผู้ใหญ่นะคะ!',
    announcementBodyEn:
      'Wear the Songkran Floral Shirt & water props for free! Celebrate safely and respectfully.',
    decorEmojis: ['💦', '🌺', '💧'],
  },
  {
    id: 'mothers_day',
    nameTh: 'วันแม่แห่งชาติ',
    nameEn: "National Mother's Day",
    emoji: '💙',
    dateWindowTh: '9–13 สิงหาคม',
    dateWindowEn: 'Aug 9–13',
    defaultOutfitId: 'fest_outfit_mothers_day',
    outfitNameTh: 'ชุดผ้าไทยสีฟ้าวันแม่',
    outfitNameEn: "Sky Blue Mother's Day Set",
    primaryColor: '#9ED2F6',
    secondaryColor: '#FFFFFF',
    accentColor: '#1E5485',
    bannerGradient: 'linear-gradient(135deg, #DCEEF8 0%, #EFF8FF 55%, #FFFDF9 100%)',
    announcementTitleTh: '💙 ประกาศสัปดาห์วันแม่แห่งชาติ (12 สิงหาคม)',
    announcementTitleEn: "💙 Mother's Day Appreciation Week",
    announcementBodyTh:
      'ชวนน้องแต่งตัวด้วย "ชุดผ้าไทยสีฟ้า" รำลึกพระคุณและทำความดีมอบรอยยิ้มให้กัน (ไปเรียนใส่ชุดนักเรียนหรือสลับชุดได้ตามสะดวกค่ะ)',
    announcementBodyEn:
      "Wear the Sky Blue Mother's Day outfit and share acts of kindness!",
    decorEmojis: ['💙', '🤍', '🌼'],
  },
  {
    id: 'halloween',
    nameTh: 'เทศกาลฮาโลวีน',
    nameEn: 'Halloween Festival',
    emoji: '🎃',
    dateWindowTh: '27 ตุลาคม – 2 พฤศจิกายน',
    dateWindowEn: 'Oct 27 – Nov 2',
    defaultOutfitId: 'fest_outfit_halloween',
    outfitNameTh: 'ชุดแฟนซีฮาโลวีนพาสเทล',
    outfitNameEn: 'Cute Pastel Halloween Costume',
    primaryColor: '#F59E56',
    secondaryColor: '#6D597A',
    accentColor: '#7A3B12',
    bannerGradient: 'linear-gradient(135deg, #FFE6CC 0%, #EAE4F2 55%, #FFF5BA 100%)',
    announcementTitleTh: '🎃 Happy Halloween! ปาร์ตี้แฟนซีสุดน่ารัก',
    announcementTitleEn: '🎃 Happy Pastel Halloween!',
    announcementBodyTh:
      'ชวนน้องเปลี่ยนเป็น "ชุดแฟนซีฮาโลวีน" และหมวกแม่มดจิ๋วสุดคิวท์! (ไปโรงเรียนใส่ชุดนักเรียนเหมือนเดิมหรือเปลี่ยนชุดได้ค่ะ)',
    announcementBodyEn:
      'Switch into the cute Pastel Halloween costume & witch hat anytime!',
    decorEmojis: ['🎃', '👻', '🍬'],
  },
  {
    id: 'fathers_day',
    nameTh: 'วันพ่อแห่งชาติ',
    nameEn: "National Father's Day",
    emoji: '💛',
    dateWindowTh: '3–7 ธันวาคม',
    dateWindowEn: 'Dec 3–7',
    defaultOutfitId: 'fest_outfit_fathers_day',
    outfitNameTh: 'เสื้อเหลืองวันพ่อแสนอบอุ่น',
    outfitNameEn: "Warm Yellow Father's Day Polo",
    primaryColor: '#FFE47A',
    secondaryColor: '#5C4B43',
    accentColor: '#7A5900',
    bannerGradient: 'linear-gradient(135deg, #FFF5BA 0%, #FFFDF9 55%, #FDE2D2 100%)',
    announcementTitleTh: '💛 ประกาศสัปดาห์วันพ่อแห่งชาติ (5 ธันวาคม)',
    announcementTitleEn: "💛 National Father's Day Week",
    announcementBodyTh:
      'ชวนน้องๆ ใส่ "เสื้อเหลืองวันพ่อ" ร่วมทำความดีจิตอาสาดูแลบ้าน (สามารถสลับกับชุดนักเรียนได้ตามต้องการค่ะ)',
    announcementBodyEn:
      "Wear the Warm Yellow Father's Day outfit and spread kindness!",
    decorEmojis: ['💛', '🌼', '🌟'],
  },
];

function isBetweenMMDD(month: number, day: number, startM: number, startD: number, endM: number, endD: number): boolean {
  const cur = month * 100 + day;
  const s = startM * 100 + startD;
  const e = endM * 100 + endD;
  if (s <= e) return cur >= s && cur <= e;
  return cur >= s || cur <= e; // wraps year end (e.g. Dec 28 -> Jan 4)
}

export function getActiveFestival(
  now: Date,
  override?: FestivalId | 'auto' | 'none'
): ActiveFestivalInfo | null {
  if (override === 'none') return null;
  if (override && override !== 'auto') {
    return FESTIVAL_CATALOG.find((f) => f.id === override) ?? null;
  }

  const m = now.getMonth() + 1;
  const d = now.getDate();

  let detectedId: FestivalId | null = null;
  if (isBetweenMMDD(m, d, 12, 28, 1, 4)) detectedId = 'new_year';
  else if (isBetweenMMDD(m, d, 1, 7, 1, 15)) detectedId = 'childrens_day';
  else if (isBetweenMMDD(m, d, 1, 24, 2, 11)) detectedId = 'chinese_new_year';
  else if (isBetweenMMDD(m, d, 2, 12, 2, 16)) detectedId = 'valentine';
  else if (isBetweenMMDD(m, d, 4, 11, 4, 18)) detectedId = 'songkran';
  else if (isBetweenMMDD(m, d, 8, 9, 8, 13)) detectedId = 'mothers_day';
  else if (isBetweenMMDD(m, d, 10, 27, 11, 2)) detectedId = 'halloween';
  else if (isBetweenMMDD(m, d, 11, 15, 11, 28)) detectedId = 'loy_krathong';
  else if (isBetweenMMDD(m, d, 12, 3, 12, 7)) detectedId = 'fathers_day';
  else if (isBetweenMMDD(m, d, 12, 19, 12, 27)) detectedId = 'christmas';

  if (!detectedId) return null;
  return FESTIVAL_CATALOG.find((f) => f.id === detectedId) ?? null;
}

export function getAnnouncementScheduleStatus(
  ann: Announcement,
  now: Date
): 'active' | 'upcoming' | 'expired' {
  const t = now.getTime();
  if (ann.startAt) {
    const startMs = new Date(ann.startAt).getTime();
    if (!Number.isNaN(startMs) && t < startMs) return 'upcoming';
  }
  if (ann.endAt) {
    const endMs = new Date(ann.endAt).getTime();
    if (!Number.isNaN(endMs) && t > endMs) return 'expired';
  }
  return 'active';
}

export interface DynamicContextualAnnouncement {
  id: string;
  badgeTh: string;
  badgeEn: string;
  titleTh: string;
  titleEn: string;
  bodyTh: string;
  bodyEn: string;
  windowLabelTh: string;
  windowLabelEn: string;
  isFestival: boolean;
  isUrgent?: boolean;
}

export function getDynamicTimeEventAnnouncement(
  now: Date,
  kid: Member,
  dailyChoreTitleTh: string,
  dailyChoreTitleEn: string,
  manualHolidayFlag: boolean,
  activeFestival: ActiveFestivalInfo | null
): DynamicContextualAnnouncement {
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const mins = getMinutesOfDay(now);
  const holiday = isPublicHoliday(now, manualHolidayFlag);
  const isWeekend = day === 0 || day === 6;

  // 1. Time-of-day event slot
  let timeTitleTh = '';
  let timeTitleEn = '';
  let timeBodyTh = '';
  let timeBodyEn = '';
  let windowTh = '';
  let windowEn = '';
  let badgeTh = '⏰ ประจำช่วงเวลานี้';
  let badgeEn = '⏰ Live Schedule';

  if (isWeekend || holiday) {
    if (mins < 10 * 60) {
      windowTh = 'ช่วงเช้าวันหยุด (08:00–10:00 น.)';
      windowEn = 'Holiday Morning (08:00–10:00)';
      timeTitleTh =
        day === 6
          ? '☀️ เช้าวันเสาร์ (หลังคืนวันศุกร์ Free Day): เช็คอินก่อน 08:30 น.'
          : day === 0
          ? '☀️ เช้าวันอาทิตย์: เช็คอินทำเวร อาบน้ำ & เวรครัว 08:00–08:15 น.'
          : '🏖️ เช้าวันหยุดนักขัตฤกษ์: พักผ่อนและแต่งชุดเทศกาล/ชุดเที่ยวได้ทั้งวัน!';
      timeTitleEn =
        day === 6
          ? '☀️ Saturday Morning (After Free Day): Check in before 08:30'
          : day === 0
          ? '☀️ Sunday Morning: Chores & Shower Check-In 08:00–08:15'
          : '🏖️ Public Holiday Morning: Casual & Festival outfits unlocked all day!';
      timeBodyTh =
        day === 6
          ? `ตื่นมาเช็คอินก่อน 08:30 น. (+10 ⭐) (เกินเวลา ยึดมือถือถึง 18:30 น.) · เวรบ้าน: ${dailyChoreTitleTh} · เวรครัวเช้า 09:30 น.`
          : `เวรประจำบ้านวันนี้: ${dailyChoreTitleTh} · เวรห้องครัวเช้า (${day === 0 ? 'อาทิตย์ 09:15 น.' : 'เสาร์/นักขัตฤกษ์ 09:30 น.'})`;
      timeBodyEn = `Today's house chore: ${dailyChoreTitleEn} · Morning kitchen duty (${day === 0 ? 'Sun 09:15' : 'Sat/Holiday 09:30'}).`;
    } else if (mins < 15 * 60 + 30) {
      windowTh = 'ช่วงกลางวันหยุด (10:00–15:30 น.)';
      windowEn = 'Holiday Afternoon (10:00–15:30)';
      timeTitleTh =
        kid.group === 2
          ? '🏡 ช่วงบ่ายวันหยุด: เด็กโตเก็บมือถือไม่เกิน 14:00 น. และห้ามนอนกลางวัน'
          : '🎨 ช่วงบ่ายวันหยุด: ทำกิจกรรมบ้าน ดูแลสัตว์เลี้ยง & เตรียมเวรครัว 15:30 น.';
      timeTitleEn =
        kid.group === 2
          ? '🏡 Holiday Afternoon: Store phone by 14:00 & no daytime naps'
          : '🎨 Holiday Afternoon: House activities, pet care & 15:30 kitchen prep';
      timeBodyTh = `เตรียมตัวเวรห้องครัวตอนเย็น 15:30 น. และทำเวร "${dailyChoreTitleTh}" ให้เรียบร้อยนะคะ`;
      timeBodyEn = `Evening kitchen duty starts at 15:30; remember house chore "${dailyChoreTitleEn}".`;
    } else if (mins < 18 * 60 + 30) {
      windowTh = 'ช่วงเย็น (15:30–18:30 น.)';
      windowEn = 'Evening Prep (15:30–18:30)';
      timeTitleTh = '🍳 ช่วงเวรครัว 15:30 น. & เตรียมเช็คลิสต์รอบเย็น';
      timeTitleEn = '🍳 15:30 Kitchen Shift & Evening Prep';
      timeBodyTh = 'น้องที่มีเวรครัวรายงานตัวกับแม่ครัว และเตรียมซัก-รีด-อาบน้ำให้เสร็จก่อน 18:30 น. ค่ะ';
      timeBodyEn = 'Kitchen duty helpers report to chef; finish laundry and shower before 18:30.';
    } else {
      windowTh = 'ช่วงค่ำ (หลัง 18:30 น.)';
      windowEn = 'Night Shift (After 18:30)';
      timeTitleTh =
        kid.group === 1
          ? '🌙 รอบค่ำ: เตรียมตัวเข้าด่านบอสภาษา 20:00 น. และเข้านอน 21:00 น.'
          : '📱 รอบค่ำ: เช็คลิสต์ครบ 4 ข้อรับมือถือ 18:30 น. และคืนเครื่องไม่เกิน 21:00 / 22:45 น.';
      timeTitleEn =
        kid.group === 1
          ? '🌙 Night: 20:00 Language Boss Stage & 21:00 bedtime'
          : '📱 Night: 4-item checklist for 18:30 phone pickup & curfew return';
      timeBodyTh = 'อย่าลืมคืนมือถือก่อนเวลา Curfew และพักผ่อนให้เพียงพอนะคะ';
      timeBodyEn = 'Return phone before curfew and get a good rest!';
    }
  } else {
    // Mon - Fri school days
    if (mins < 8 * 60 + 30) {
      windowTh = 'กะเช้าไปโรงเรียน (05:30–08:30 น.)';
      windowEn = 'Morning School Rush (05:30–08:30)';
      timeTitleTh =
        kid.group === 1
          ? '🚌 กะเช้าไปโรงเรียน: กินข้าวเช้าก่อน 06:40 น. & ขึ้นรถตู้ไม่เกิน 07:01 น.'
          : kid.group === 2
          ? '🚌 กะเช้าไปโรงเรียน: อาบน้ำแต่งตัว-ขอรับมือถือ & เช็คชื่อไม่เกิน 07:21 น.'
          : '🎓 กะเช้าไปเรียน/ฝึกงาน: เช็คอินรับ +10 ⭐';
      timeTitleEn =
        kid.group === 1
          ? '🚌 School Morning: Breakfast before 06:40 & van by 07:01'
          : kid.group === 2
          ? '🚌 School Morning: Ready & School Check-In by 07:21'
          : '🎓 Morning: College / Internship check-in (+10 ⭐)';
      timeBodyTh = 'ไปโรงเรียนแต่งชุดนักเรียนเรียบร้อยเหมือนเดิม (หากเป็นช่วงเทศกาลสามารถสลับชุดในตู้เสื้อผ้าได้ค่ะ)';
      timeBodyEn = 'School uniform is worn for school mornings (festival outfits can also be switched anytime during festivals).';
      badgeTh = '🌅 เหตุการณ์กะเช้า';
      badgeEn = '🌅 Morning Event';
    } else if (mins < 15 * 60 + 30) {
      windowTh = 'ช่วงระหว่างวันเรียน (08:30–15:30 น.)';
      windowEn = 'School Hours (08:30–15:30)';
      timeTitleTh = '📚 ช่วงเวลาเรียน — ตั้งใจเรียน & เตรียมพร้อมกลับบ้านเย็นนี้';
      timeTitleEn = '📚 School Hours — Focus in class & prepare for return home';
      timeBodyTh = `หลังเลิกเรียนมีเวรห้องครัว 15:30 น. และเวรประจำบ้าน "${dailyChoreTitleTh}" รออยู่ค่ะ`;
      timeBodyEn = `After school: 15:30 kitchen shift and house chore "${dailyChoreTitleEn}".`;
      badgeTh = '🏫 เหตุการณ์กลางวัน';
      badgeEn = '🏫 Daytime Event';
    } else if (day === 5 && mins >= 15 * 60) {
      windowTh = 'วันศุกร์ Free Day (15:00–22:45 น.)';
      windowEn = 'Friday Free Day (15:00–22:45)';
      timeTitleTh = '🎈 วันศุกร์ Free Day! วันนี้สามารถสั่งเซเว่นได้นะคะ 🏪';
      timeTitleEn = '🎈 Happy Friday Free Day! 7-Eleven orders available today! 🏪';
      timeBodyTh =
        'กลับบ้านและเก็บโทรศัพท์มือถือ 15:00–18:00 น. · มารับโทรศัพท์มือถือ 18:15–22:45 น. · คืนวันศุกร์ไม่ต้องเก็บมือถือ แต่ตื่นมาเช็คอินเช้าวันเสาร์ก่อน 08:30 น.\nทุกคนที่มีโทรศัพท์จะต้องตั้งปลุกก่อนเวลาเผื่อเดินมาเช็คอินด้วยนะเด็กๆ';
      timeBodyEn =
        'Return home & store phone 15:00–18:00 · Pick up phone 18:15–22:45 · Keep phone tonight, check in Saturday before 08:30.\nEveryone with a phone must set an alarm ahead of time to walk over and check in!';
      badgeTh = '🎈 วันศุกร์ Free Day';
      badgeEn = '🎈 Friday Free Day';
    } else if (mins < 18 * 60 + 30) {
      windowTh = 'กะเย็นกลับบ้าน (15:30–18:30 น.)';
      windowEn = 'Afternoon Return (15:30–18:30)';
      timeTitleTh =
        kid.group === 1
          ? '🏡 กลับบ้าน (กะเย็น): Speedy Ninja 20 นาที เรียนเสริม & งานบ้านก่อน 18:15 น.'
          : '📸 กะเย็นกลับบ้าน: ถ่ายรูปเช็คอินกลับบ้าน · เวรครัว 15:30 น. & เตรียมเช็คลิสต์';
      timeTitleEn =
        kid.group === 1
          ? '🏡 Return Home: 20-min Speedy Ninja, study & chores before 18:15'
          : '📸 Return Home: Take check-in photo, 15:30 kitchen duty & prepare checklist';
      timeBodyTh = `อย่าลืมทำเวร "${dailyChoreTitleTh}" (+5 ⭐) และเช็คคิวซักผ้าวันนี้นะคะ`;
      timeBodyEn = `Complete "${dailyChoreTitleEn}" (+5 ⭐) and check today's laundry queue.`;
      badgeTh = '🏡 เหตุการณ์กะเย็น';
      badgeEn = '🏡 Afternoon Event';
    } else if (mins < 20 * 60 + 30) {
      windowTh = 'ช่วงค่ำ & เวลาแต่งตัวอิสระ (18:30–20:30 น.)';
      windowEn = 'Evening & Free Dress-Up (18:30–20:30)';
      timeTitleTh = '✨ หลัง 18:30 น. ปลดล็อกชุดเที่ยว & ช่วงทำภารกิจรอบค่ำแล้ว!';
      timeTitleEn = '✨ After 18:30: Casual outfits unlocked & evening routine active!';
      timeBodyTh =
        kid.group === 1
          ? 'เตรียมเข้าด่านบอสภาษาเวลา 20:00 น. ขอ PIN พี่เลี้ยงปลดล็อกการ์ตูนค่ะ'
          : 'เช็คลิสต์ครบ 4 ข้อเพื่อรับมือถือ 18:30 น. (หากมีการบ้านลงทะเบียน 20:30–20:45 น.)';
      timeBodyEn =
        kid.group === 1
          ? 'Prepare for the 20:00 language Boss Stage!'
          : 'Complete 4-item checklist for 18:30 phone pickup (homework registration 20:30–20:45).';
      badgeTh = '🌙 เหตุการณ์รอบค่ำ';
      badgeEn = '🌙 Evening Event';
    } else {
      windowTh = 'กะค่ำก่อนนอน (20:30–23:59 น.)';
      windowEn = 'Night Curfew & Bedtime (20:30–23:59)';
      timeTitleTh =
        kid.group === 1
          ? '😴 เตรียมตัวเข้านอน (ดื่มน้ำ 20:40 น. · เข้านอน 21:00 น.)'
          : '📱 ช่วงส่งคืนมือถือ & พักผ่อน (ไม่มีการบ้าน 21:00 น. / ลงทะเบียนการบ้าน 22:45 น.)';
      timeTitleEn =
        kid.group === 1
          ? '😴 Bedtime Prep (Drink water 20:40 · Bedtime 21:00)'
          : '📱 Phone Return Curfew (21:00 or 22:45 with registered homework)';
      timeBodyTh = 'เก็บของเตรียมกระเป๋านักเรียนสำหรับพรุ่งนี้เช้าและพักผ่อนให้เต็มที่นะ';
      timeBodyEn = 'Pack school bag for tomorrow and get plenty of sleep!';
      badgeTh = '🛏️ เหตุการณ์ก่อนนอน';
      badgeEn = '🛏️ Bedtime Notice';
    }
  }

  // 2. If there is an active festival today, highlight festival event alongside live time window!
  if (activeFestival) {
    return {
      id: `dyn_fest_${activeFestival.id}_${day}_${Math.floor(mins / 60)}`,
      badgeTh: `${activeFestival.emoji} ${activeFestival.nameTh} (${activeFestival.dateWindowTh})`,
      badgeEn: `${activeFestival.emoji} ${activeFestival.nameEn} (${activeFestival.dateWindowEn})`,
      titleTh: activeFestival.announcementTitleTh,
      titleEn: activeFestival.announcementTitleEn,
      bodyTh: `${activeFestival.announcementBodyTh}\n⏰ ${windowTh}: ${timeTitleTh}`,
      bodyEn: `${activeFestival.announcementBodyEn}\n⏰ ${windowEn}: ${timeTitleEn}`,
      windowLabelTh: windowTh,
      windowLabelEn: windowEn,
      isFestival: true,
    };
  }

  return {
    id: `dyn_time_${day}_${Math.floor(mins / 60)}`,
    badgeTh,
    badgeEn,
    titleTh: timeTitleTh,
    titleEn: timeTitleEn,
    bodyTh: timeBodyTh,
    bodyEn: timeBodyEn,
    windowLabelTh: windowTh,
    windowLabelEn: windowEn,
    isFestival: false,
  };
}
