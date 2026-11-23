import { AutomationAddonId, OrganizationPresetId } from '../types/barnhem';

export interface OrganizationPresetOption {
  id: OrganizationPresetId;
  emoji: string;
  badgeTh?: string;
  badgeEn?: string;
  titleTh: string;
  titleEn: string;
  taglineTh: string;
  taglineEn: string;
  rolesLabelTh: string;
  rolesLabelEn: string;
  orgNamePlaceholderTh: string;
  orgNamePlaceholderEn: string;
  sizePlaceholderTh: string;
  sizePlaceholderEn: string;
  defaultAddons: AutomationAddonId[];
  ownerRoleLabelTh: string;
  staffRoleLabelTh: string;
  memberRoleLabelTh: string;
  sampleMemberNickname: string;
  sampleMemberEmoji: string;
  sampleGreetingTh: string;
}

export const ORGANIZATION_PRESETS: OrganizationPresetOption[] = [
  {
    id: 'foundation_care',
    emoji: '🏡💛',
    badgeTh: 'สำหรับมูลนิธิ & บ้านพักเด็ก',
    badgeEn: 'Care Home & Foundation',
    titleTh: 'มูลนิธิ / บ้านพักเด็ก / ศูนย์ดูแลเยาวชน',
    titleEn: 'Children Foundation & Care Home',
    taglineTh:
      'ครบชุดสำหรับมูลนิธิ: กิจวัตรเช้า-เย็น-การบ้าน ตารางเวรครัว-ซักผ้า เช็คสุขภาพ และมินิมาร์ทสวัสดิการ',
    taglineEn:
      'Complete foundation suite: morning/evening routines, kitchen & laundry duties, health cards, and star minimart.',
    rolesLabelTh: 'ผู้ดูแลบ้าน / พี่เลี้ยง ↔ น้องๆ',
    rolesLabelEn: 'Caregiver / Staff ↔ Youth',
    orgNamePlaceholderTh: 'เช่น มูลนิธิบ้านสายใจรักษ์',
    orgNamePlaceholderEn: 'e.g. Sunshine Youth Foundation',
    sizePlaceholderTh: 'เช่น เด็ก 12 คน พี่เลี้ยง 4 คน',
    sizePlaceholderEn: 'e.g. 12 kids, 4 caregivers',
    defaultAddons: [
      'auto_shift_attendance',
      'star_loyalty_minimart',
      'auto_sheet_line_report',
    ],
    ownerRoleLabelTh: 'ผู้ดูแลบ้าน',
    staffRoleLabelTh: 'พี่เลี้ยงประจำ',
    memberRoleLabelTh: 'น้องตัวอย่าง',
    sampleMemberNickname: 'น้องตัวอย่าง',
    sampleMemberEmoji: '🐣',
    sampleGreetingTh:
      'เปิดพื้นที่มูลนิธิดูแลเด็กเรียบร้อย! ใช้รหัส PIN 1234 เพื่อเพิ่มรายชื่อน้องๆ พี่เลี้ยง และปรับตารางกิจวัตรของบ้านได้ทันทีค่ะ',
  },
];

export interface AutomationAddonOption {
  id: AutomationAddonId;
  emoji: string;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
}

export const AUTOMATION_ADDON_OPTIONS: AutomationAddonOption[] = [
  {
    id: 'auto_shift_attendance',
    emoji: '⏰✅',
    titleTh: 'เช็คชื่อกิจวัตร & ตารางเวรอัตโนมัติ',
    titleEn: 'Automated Routine Check-ins & Duties',
    descTh: 'บันทึกเวลาเช็คชื่อตรงเวลา คำนวณสาย-ขยันให้อัตโนมัติตามนาฬิกาจริง',
    descEn: 'Clock-based check-ins and automatic on-time scoring',
  },
  {
    id: 'star_loyalty_minimart',
    emoji: '⭐🎁',
    titleTh: 'สะสมดาวความดีแลกของใช้มูลนิธิ',
    titleEn: 'Star Rewards & Foundation Minimart',
    descTh: 'สะสมดาวความดีให้น้องๆ นำมาแลกของใช้จำเป็น ขนม หรือไอเทมแต่งหน้าปก',
    descEn: 'Kids earn stars and exchange for essentials, snacks, or cover items',
  },
  {
    id: 'auto_sheet_line_report',
    emoji: '📊💬',
    titleTh: 'สรุปยอดส่ง Google Sheet & LINE อัตโนมัติ',
    titleEn: 'Auto Google Sheet & LINE Summary',
    descTh: 'ส่งสรุปกิจวัตรและรายงานประจำสัปดาห์เข้าชีตของมูลนิธิอัตโนมัติ',
    descEn: 'Automatic daily and weekly summaries pushed to your Google Sheet & LINE',
  },
];

export function getOrganizationPreset(_presetId?: OrganizationPresetId): OrganizationPresetOption {
  return ORGANIZATION_PRESETS[0];
}
