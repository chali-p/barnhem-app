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
    id: 'autonomous_minimart',
    emoji: '🏪🚪',
    badgeTh: 'จุดขายแนะนำ · ไร้พนักงาน',
    badgeEn: 'Flagship · Self-Service',
    titleTh: 'มินิมาร์ทจ่ายเอง + สแกนใบเสร็จเปิดประตู',
    titleEn: 'Self-Checkout Minimart + Receipt Door Gate',
    taglineTh:
      'ลูกค้าหยิบสินค้า-จ่ายเงินด้วยตัวเอง แล้วนำใบเสร็จ QR / รหัสผ่านสแกนเปิดประตูทางออกอัตโนมัติ ลดคนเฝ้าร้านได้เกือบ 100%',
    taglineEn:
      'Customers self-checkout via QR and scan their digital receipt to unlock the exit gate automatically—minimal staffing required.',
    rolesLabelTh: 'เจ้าของร้าน ↔ ระบบอัตโนมัติ & ลูกค้า/ผู้ตรวจสต๊อก',
    rolesLabelEn: 'Shop Owner ↔ Automation & Self-Service Customers',
    orgNamePlaceholderTh: 'เช่น ร้านอิ่มสุข มินิมาร์ท 24 ชม.',
    orgNamePlaceholderEn: 'e.g. QuickBuy 24h Self-Service Minimart',
    sizePlaceholderTh: 'เช่น 1 สาขา ประตูอัตโนมัติ 1 บาน / สินค้า ~150 รายการ',
    sizePlaceholderEn: 'e.g. 1 branch, 1 smart exit gate, ~150 SKUs',
    defaultAddons: [
      'receipt_door_gate',
      'self_checkout_qr',
      'star_loyalty_minimart',
      'smart_stock_alerts',
      'auto_sheet_line_report',
    ],
    ownerRoleLabelTh: 'เจ้าของร้านอัตโนมัติ',
    staffRoleLabelTh: 'ผู้ดูแลสต๊อก/เติมของ',
    memberRoleLabelTh: 'ลูกค้าสมาชิก / พนักงานทดสอบ',
    sampleMemberNickname: 'ลูกค้า VIP 1',
    sampleMemberEmoji: '🛍️',
    sampleGreetingTh:
      'เปิดโหมดมินิมาร์ทจ่ายเอง + ใบเสร็จสแกนเปิดประตูเรียบร้อย! ระบบพร้อมช่วยรับชำระอัตโนมัติ ออกใบเสร็จคิวอาร์โค้ดเปิดประตู สะสมดาวลูกค้า และส่งสรุปยอดเข้า Google Sheet แทนคนเฝ้าร้านค่ะ',
  },
  {
    id: 'kindergarten_classroom',
    emoji: '🏫🎒',
    badgeTh: 'ห้องเรียน / โรงเรียนเล็ก',
    badgeEn: 'Classroom & Kindergarten',
    titleTh: 'ห้องเรียน / โรงเรียนอนุบาล / ศูนย์เด็กเล็ก',
    titleEn: 'Kindergarten / Small School / Classroom',
    taglineTh:
      'คุณครูคนเดียวดูแลได้ทั้งห้อง: เช็คชื่อเข้าเรียน เวรทำความสะอาด การบ้าน และสะสม ⭐ ดาวแลกรางวัลหน้าชั้น',
    taglineEn:
      'One teacher manages the whole class effortlessly: attendance, classroom chores, homework, and ⭐ star rewards.',
    rolesLabelTh: 'คุณครู / ผู้ช่วย ↔ นักเรียน',
    rolesLabelEn: 'Teacher ↔ Students',
    orgNamePlaceholderTh: 'เช่น ห้องเรียนอนุบาล 2 / โรงเรียนบ้านแสนดี',
    orgNamePlaceholderEn: 'e.g. Sunshine Kindergarten Room 2',
    sizePlaceholderTh: 'เช่น นักเรียน 25 คน คุณครู 2 ท่าน',
    sizePlaceholderEn: 'e.g. 25 students, 2 teachers',
    defaultAddons: [
      'auto_shift_attendance',
      'star_loyalty_minimart',
      'auto_sheet_line_report',
    ],
    ownerRoleLabelTh: 'คุณครูใหญ่ / ผู้บริหาร',
    staffRoleLabelTh: 'คุณครูประจำชั้น',
    memberRoleLabelTh: 'นักเรียนตัวอย่าง',
    sampleMemberNickname: 'น้องต้นกล้า',
    sampleMemberEmoji: '🌱',
    sampleGreetingTh:
      'เปิดโหมดห้องเรียนอัจฉริยะเรียบร้อย! คุณครูสามารถเช็คชื่อ สั่งงานเวรห้อง มอบ ⭐ ดาวตั้งใจเรียน และเปิดมุมแลกรางวัลให้นักเรียนได้ทันทีค่ะ',
  },
  {
    id: 'lean_sme_shop',
    emoji: '💼⚡',
    badgeTh: 'SME ไร้ฝ่ายบุคคล',
    badgeEn: 'Lean SME Team',
    titleTh: 'ธุรกิจ SME / คาเฟ่ / คลินิก (ลดคนดูแลหลังบ้าน)',
    titleEn: 'Lean SME / Cafe / Clinic (Zero-HR Admin)',
    taglineTh:
      'ให้ระบบเช็คเข้ากะตรงเวลา ตรวจงานเปิด-ปิดร้าน ส่งมอบกะ และสะสมดาวแลกสวัสดิการ โดยไม่ต้องจ้าง HR หลายคน',
    taglineEn:
      'Automated shift check-in, store opening checklists, handover logs, and star perks without hiring extra HR staff.',
    rolesLabelTh: 'เจ้าของกิจการ / หัวหน้ากะ ↔ พนักงาน',
    rolesLabelEn: 'Business Owner ↔ Team Members',
    orgNamePlaceholderTh: 'เช่น คาเฟ่อบอุ่น / คลินิกยิ้มสวย',
    orgNamePlaceholderEn: 'e.g. Cozy Bean Cafe / Bright Smile Clinic',
    sizePlaceholderTh: 'เช่น พนักงาน 6 คน กะเช้า-เย็น',
    sizePlaceholderEn: 'e.g. 6 staff across 2 shifts',
    defaultAddons: [
      'auto_shift_attendance',
      'star_loyalty_minimart',
      'smart_stock_alerts',
      'auto_sheet_line_report',
    ],
    ownerRoleLabelTh: 'เจ้าของกิจการ',
    staffRoleLabelTh: 'ผู้จัดการร้าน / หัวหน้ากะ',
    memberRoleLabelTh: 'น้องพนักงาน 1',
    sampleMemberNickname: 'พนักงานกะเช้า',
    sampleMemberEmoji: '☕',
    sampleGreetingTh:
      'เปิดโหมดธุรกิจ SME อัตโนมัติเรียบร้อย! ให้ระบบช่วยบันทึกเข้ากะ ตรวจความเรียบร้อยของร้าน และสรุปยอดส่งผู้บริหารแทนงานเอกสารได้เลยค่ะ',
  },
  {
    id: 'foundation_care',
    emoji: '🏡💛',
    badgeTh: 'ต้นฉบับบ้านดูแลเด็ก',
    badgeEn: 'Care Home & Foundation',
    titleTh: 'มูลนิธิ / บ้านพักเด็ก / ศูนย์ดูแลเยาวชน',
    titleEn: 'Children Foundation & Care Home',
    taglineTh:
      'ครบชุดต้นฉบับ: กิจวัตรเช้า-เย็น-การบ้าน ตารางเวรครัว-ซักผ้า เช็คสุขภาพ และร้านมินิมาร์ทสวัสดิการ',
    taglineEn:
      'Full original suite: morning/evening routines, kitchen & laundry duties, health cards, and star minimart.',
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
      'เปิดพื้นที่บ้านดูแลเด็กเรียบร้อย! ใช้รหัส PIN 1234 เพื่อเพิ่มรายชื่อน้องๆ พี่เลี้ยง และปรับตารางกิจวัตรของบ้านได้ทันทีค่ะ',
  },
  {
    id: 'custom_automation',
    emoji: '🧩✨',
    badgeTh: 'ช้อยส์แปลกใหม่เฉพาะทาง',
    badgeEn: 'Custom Unmanned Mode',
    titleTh: 'ธุรกิจ / พื้นที่อัตโนมัติแนวแปลกใหม่ (ออกแบบเอง)',
    titleEn: 'Custom Self-Service / Unique Niche Space',
    taglineTh:
      'เช่น ร้านซักอบรีด 24 ชม., Co-Working เปิดประตูด้วยบิล, ฟิตเนสไร้คนเฝ้า, ตู้ขนมหอพัก หรือชุมชนจัดการตัวเอง',
    taglineEn:
      '24h laundromat, receipt-access study room, unstaffed gym, dorm pantry, or self-run community hub.',
    rolesLabelTh: 'ผู้ดูแลระบบ ↔ สมาชิก / ผู้มาใช้บริการ',
    rolesLabelEn: 'Operator ↔ Members / Visitors',
    orgNamePlaceholderTh: 'เช่น ห้องอ่านหนังสือ 24 ชม. / ร้านซักรีดไร้คนเฝ้า',
    orgNamePlaceholderEn: 'e.g. 24h Smart Study Lounge / Unmanned Laundry',
    sizePlaceholderTh: 'เช่น 1 จุดบริการ ผู้ใช้งาน ~50 คน/วัน',
    sizePlaceholderEn: 'e.g. 1 unmanned location, ~50 daily visitors',
    defaultAddons: [
      'receipt_door_gate',
      'self_checkout_qr',
      'auto_sheet_line_report',
    ],
    ownerRoleLabelTh: 'ผู้สร้างระบบอัตโนมัติ',
    staffRoleLabelTh: 'ผู้ช่วยตรวจหน้างาน',
    memberRoleLabelTh: 'สมาชิกบริการ 1',
    sampleMemberNickname: 'สมาชิก 01',
    sampleMemberEmoji: '🔑',
    sampleGreetingTh:
      'เปิดพื้นที่ระบบอัตโนมัติเฉพาะทางเรียบร้อย! คุณสามารถปรับแต่งกติกา จุดสแกน และหน้าร้านค้าให้เข้ากับโมเดลธุรกิจของคุณได้ 100% ค่ะ',
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
    id: 'receipt_door_gate',
    emoji: '🚪📱',
    titleTh: 'ใบเสร็จสแกนเปิดประตูอัตโนมัติ',
    titleEn: 'Receipt-to-Unlock Exit Gate',
    descTh: 'จ่ายเสร็จได้รหัส QR / PIN ท้ายใบเสร็จ ใช้สแกนเปิดประตูออกได้ 1 ครั้ง ป้องกันใช้ซ้ำ',
    descEn: 'Single-use QR / PIN printed on receipt to unlock exit door',
  },
  {
    id: 'self_checkout_qr',
    emoji: '💳🛒',
    titleTh: 'ลูกค้าคิดเงินและจ่ายเอง 24 ชม.',
    titleEn: '24/7 Customer Self-Checkout',
    descTh: 'หน้าจอกดเลือก/สแกนสินค้า ชำระด้วย QR พร้อมเพย์หรือดาวสะสมแทนแคชเชียร์',
    descEn: 'Self-service cart and instant QR payment without cashier',
  },
  {
    id: 'auto_shift_attendance',
    emoji: '⏰✅',
    titleTh: 'เช็คชื่อ/เข้ากะ/ตารางเวรอัตโนมัติ',
    titleEn: 'Automated Attendance & Duties',
    descTh: 'บันทึกเวลาเข้า-ออกตรงเวลา คำนวณสาย-ขยันให้เองตามนาฬิกาจริง',
    descEn: 'Clock-based check-ins and automatic on-time scoring',
  },
  {
    id: 'star_loyalty_minimart',
    emoji: '⭐🎁',
    titleTh: 'ระบบสะสมดาวแลกของรางวัล',
    titleEn: 'Star Loyalty & Reward Store',
    descTh: 'สะสมดาวความดี/ดาวลูกค้า นำมาแลกสินค้า ขนม หรือสิทธิพิเศษอัตโนมัติ',
    descEn: 'Earn loyalty stars and redeem snacks or perks automatically',
  },
  {
    id: 'smart_stock_alerts',
    emoji: '📦🔔',
    titleTh: 'แจ้งเตือนสต๊อกหมด / ของหาย / แจ้งซ่อม',
    titleEn: 'Smart Restock & Issue Alerts',
    descTh: 'เช็คสินค้าคงเหลือ รายงานอุปกรณ์ชำรุด หรือจุดที่ต้องเติมของให้เจ้าของรู้ทันที',
    descEn: 'Restock alerts, issue tickets, and lost-and-found tracker',
  },
  {
    id: 'auto_sheet_line_report',
    emoji: '📊💬',
    titleTh: 'สรุปยอดส่ง Google Sheet & LINE อัตโนมัติ',
    titleEn: 'Auto Google Sheet & LINE Summary',
    descTh: 'ส่งรายงานยอดขาย/เช็คชื่อประจำวันเข้าชีตส่วนตัวโดยไม่ต้องมานั่งจดเอง',
    descEn: 'Automatic daily summaries pushed to your Google Sheet & LINE',
  },
];

export function getOrganizationPreset(presetId?: OrganizationPresetId): OrganizationPresetOption {
  return (
    ORGANIZATION_PRESETS.find((p) => p.id === presetId) ?? ORGANIZATION_PRESETS[3]
  );
}
