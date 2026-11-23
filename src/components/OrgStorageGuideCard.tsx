import React, { useState } from 'react';
import { Language, ModalAlertPayload } from '../types/barnhem';
import { copyTextToClipboard, GOOGLE_APPS_SCRIPT_TEMPLATE } from '../utils/syncStorage';

/**
 * Visual 3-pillar architecture diagram showing:
 * 1. Barnhem Master (Access Gate Only, Zero-Knowledge Lock)
 * 2. Partner Foundation Private Workspace
 * 3. Two Clear Free Storage Destinations (Own Google Sheet/Drive Lifetime vs Central 7-14 Day Cloud)
 */
export const PlatformVisualArchitecture: React.FC<{ lang: Language }> = ({ lang }) => {
  return (
    <div className="rounded-[24px] border-2 border-[#B9E8DF] bg-[#F5FCFA] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm sm:text-base font-extrabold text-[#114A42]">
          🗺️{' '}
          {lang === 'th'
            ? 'ภาพรวมการทำงานของระบบ: ใช้งานฟรี 100% แยกข้อมูลส่วนตัวทุกมูลนิธิ'
            : 'How It Works: 100% Free & Isolated Per Organization'}
        </div>
        <span className="rounded-lg bg-[#114A42] text-white px-2.5 py-1 text-[11px] font-extrabold">
          {lang === 'th' ? '🔒 Zero-Knowledge ปลอดภัย 100%' : '🔒 Zero-Knowledge Isolated'}
        </span>
      </div>

      {/* 3-Column Visual Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1.15fr_auto_1.35fr] items-stretch gap-2.5">
        {/* Pillar 1: Creator Gate */}
        <div className="rounded-2xl border border-[#EBD8C3] bg-white p-3.5 flex flex-col justify-between space-y-2">
          <div className="space-y-1">
            <div className="text-[11px] font-extrabold text-[#7B695F]">
              {lang === 'th' ? 'ฝั่งผู้สร้างระบบ (Barnhem)' : 'Platform Creator'}
            </div>
            <div className="text-sm font-extrabold text-[#3D322C]">
              🔑 {lang === 'th' ? 'กดอนุมัติเปิดประตูเท่านั้น' : 'Approves Entry Only'}
            </div>
            <p className="text-xs text-[#6E5C52] leading-relaxed">
              {lang === 'th'
                ? 'เห็นเฉพาะชื่อมูลนิธิกับสถานะคำขอ เพื่อกดเปิดสิทธิ์ให้ใช้งานฟรี'
                : 'Sees only organization name & contact to approve access.'}
            </p>
          </div>
          <div className="rounded-xl border border-[#F3B7C0] bg-[#FFE8ED] px-2.5 py-1.5 text-[11px] font-bold text-[#8B1D36]">
            🚫 {lang === 'th' ? 'ล็อกสิทธิ์: มองไม่เห็นเด็ก/การเงิน/PIN ของบ้านอื่น' : 'Blocked from viewing internal org data'}
          </div>
        </div>

        {/* Arrow 1 -> 2 */}
        <div className="flex items-center justify-center text-[#114A42] font-extrabold text-sm py-1 lg:px-1">
          <span className="lg:hidden">⬇️</span>
          <span className="hidden lg:inline">➜</span>
        </div>

        {/* Pillar 2: Private Foundation Workspace */}
        <div className="rounded-2xl border-2 border-[#7CC6B8] bg-white p-3.5 flex flex-col justify-between space-y-2">
          <div className="space-y-1">
            <div className="text-[11px] font-extrabold text-[#114A42]">
              {lang === 'th' ? 'ห้องส่วนตัวขององค์กรคุณ (100%)' : 'Your Isolated Workspace'}
            </div>
            <div className="text-sm font-extrabold text-[#3D322C]">
              🏛️ {lang === 'th' ? 'ระบบจัดการบ้าน & เช็คชื่อเด็ก' : 'Daily Care & Attendance App'}
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-bold text-[#3D322C]">
              <div className="rounded-lg bg-[#FFF5BA]/70 px-2 py-1">👧 รายชื่อเด็ก & PIN</div>
              <div className="rounded-lg bg-[#DCEEF8]/80 px-2 py-1">👩‍🏫 ขาด/ลา/มาสาย</div>
              <div className="rounded-lg bg-[#E8FAF6] px-2 py-1">💬 ส่งสรุปเข้า LINE</div>
              <div className="rounded-lg bg-[#FADADD]/60 px-2 py-1">🐷 ตารางงาน/ออมสิน</div>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-[#1B5E52]">
            {lang === 'th' ? 'ตั้งชื่อเด็ก พี่เลี้ยง และรหัส PIN ของตัวเองได้เต็มที่' : 'Full control of kids, staff & PINs'}
          </div>
        </div>

        {/* Arrow 2 -> 3 */}
        <div className="flex items-center justify-center text-[#114A42] font-extrabold text-sm py-1 lg:px-1">
          <span className="lg:hidden">⬇️</span>
          <span className="hidden lg:inline">➜</span>
        </div>

        {/* Pillar 3: 2 Storage Choices */}
        <div className="rounded-2xl border border-[#8FD4C6] bg-white p-3.5 space-y-2">
          <div className="text-[11px] font-extrabold text-[#114A42]">
            {lang === 'th' ? 'ปลายทางเก็บข้อมูล (เลือกได้ 2 แบบ)' : 'Storage Destination (2 Choices)'}
          </div>

          <div className="rounded-xl border-2 border-[#114A42] bg-[#E8FAF6] p-2.5 space-y-0.5">
            <div className="text-xs font-extrabold text-[#114A42]">
              🌟 {lang === 'th' ? '1. Google Sheet & Drive ขององค์กรเอง' : '1. Own Google Sheet & Drive'}
            </div>
            <div className="text-[11px] text-[#1B5E52] font-semibold">
              {lang === 'th'
                ? 'เก็บถาวรตลอดชีพ (บนพื้นที่ Google ฟรี 15 GB ของคุณ) · ไม่กินพื้นที่กลาง 0%'
                : 'Lifetime archive on your free 15 GB Google account · 0% central quota'}
            </div>
          </div>

          <div className="rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] p-2.5 space-y-0.5">
            <div className="text-xs font-extrabold text-[#3D322C]">
              ☁️ {lang === 'th' ? '2. คลาวด์ระบบกลางฟรี' : '2. Free Central Cloud'}
            </div>
            <div className="text-[11px] text-[#6E5C52]">
              {lang === 'th'
                ? 'ไม่ต้องต่อชีต ใช้ข้ามหลายเครื่องได้ทันที · เก็บประวัติช่วง 7–14 วันล่าสุด'
                : 'Multi-device sync · auto-trims logs older than 7–14 days'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TwoStorageOptionsCardProps {
  lang: Language;
  selectedMode?: 'own' | 'central';
  onSelectMode?: (mode: 'own' | 'central') => void;
}

export const TwoStorageOptionsCard: React.FC<TwoStorageOptionsCardProps> = ({
  lang,
  selectedMode,
  onSelectMode,
}) => {
  const isInteractive = Boolean(onSelectMode);

  const options = [
    {
      id: 'own' as const,
      badgeTh: '🌟 แนะนำ — เก็บได้ตลอดชีพ ฟรี 100%',
      badgeEn: '🌟 Recommended — Lifetime History (Free)',
      titleTh: 'ทางเลือกที่ 1: เชื่อม Google Sheet & Drive ขององค์กรเอง',
      titleEn: 'Option 1: Connect Your Own Google Sheet & Drive',
      bulletsTh: [
        'เก็บประวัติเด็ก ขาด/ลา/มาสาย และรูปภาพบนบัญชี Google ฟรี 15 GB ของมูลนิธิคุณเอง',
        'เก็บย้อนหลังได้ยาวนานตลอดชีพ (ไม่จำกัดแค่ 7-14 วัน) และเปิดดูใน Sheets/Excel ได้ทันที',
        'ไม่ใช้พื้นที่ระบบกลาง (0%) ข้อมูลอยู่กับองค์กรคุณ 100%',
      ],
      bulletsEn: [
        'Uses your own free 15 GB Google account for Sheets logs & Drive folders',
        'Keep unlimited lifetime history instead of 7–14 day cleanup',
        'Uses 0% central server space; 100% under your foundation account',
      ],
    },
    {
      id: 'central' as const,
      badgeTh: '☁️ สะดวกทันที — สำหรับใช้งานสั้น 1-2 อาทิตย์',
      badgeEn: '☁️ Instant Sync — Short-Term (1–2 Weeks)',
      titleTh: 'ทางเลือกที่ 2: ใช้คลาวด์ระบบกลางฟรี (ไม่ต้องต่อชีตเอง)',
      titleEn: 'Option 2: Free Central Cloud Sync (No Setup)',
      bulletsTh: [
        'ไม่ต้องตั้งค่าเพิ่มเติม กดซิงก์ข้ามแท็บเล็ตและมือถือพี่เลี้ยงได้ทันทีหลังอนุมัติ',
        'ระบบกลางจะตัดประวัติเก่าที่เกิน 7-14 วันออกอัตโนมัติเพื่อแบ่งปันพื้นที่ฟรีให้ทุกองค์กร',
        'เหมาะกับมูลนิธิที่ติดตามผลรายวัน-รายสัปดาห์ แล้วส่งสรุปเข้า LINE จบเป็นอาทิตย์',
      ],
      bulletsEn: [
        'Sync across devices immediately after approval with zero setup',
        'Automatically keeps the most recent 7–14 days of daily/weekly logs',
        'Ideal for weekly summary workflows via LINE without long-term archives',
      ],
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="text-xs font-extrabold text-[#114A42]">
        💡{' '}
        {lang === 'th'
          ? 'เปรียบเทียบ 2 ทางเลือกที่เก็บข้อมูล (ใช้งานฟรีทั้ง 2 แบบ เลือกสลับทีหลังได้ตลอดค่ะ):'
          : 'Choose Your Free Storage Option (Switch Anytime):'}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = selectedMode === opt.id;
          const baseClass = `rounded-2xl border-2 p-4 text-left space-y-2 transition-colors ${
            isSelected
              ? 'border-[#114A42] bg-[#E8FAF6]'
              : opt.id === 'own'
              ? 'border-[#8FD4C6] bg-[#F5FCFA]'
              : 'border-[#EBD8C3] bg-[#FFFDF9]'
          } ${isInteractive ? 'cursor-pointer hover:border-[#114A42]' : ''}`;

          const content = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
                    opt.id === 'own'
                      ? 'bg-[#114A42] text-white'
                      : 'bg-[#FFF5BA] text-[#6E4E10]'
                  }`}
                >
                  {lang === 'th' ? opt.badgeTh : opt.badgeEn}
                </span>
                {isInteractive && (
                  <span className="text-xs font-extrabold text-[#114A42]">
                    {isSelected
                      ? lang === 'th'
                        ? '✓ เลือกแบบนี้อยู่'
                        : '✓ Selected'
                      : lang === 'th'
                      ? 'คลิกเพื่อเลือก'
                      : 'Select'}
                  </span>
                )}
              </div>
              <div className="text-sm font-extrabold text-[#3D322C]">
                {lang === 'th' ? opt.titleTh : opt.titleEn}
              </div>
              <ul className="space-y-1 text-xs text-[#4F433C] list-disc list-inside leading-relaxed">
                {(lang === 'th' ? opt.bulletsTh : opt.bulletsEn).map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </>
          );

          return isInteractive ? (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectMode?.(opt.id)}
              className={baseClass}
            >
              {content}
            </button>
          ) : (
            <div key={opt.id} className={baseClass}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface OrgStorageGuideCardProps {
  lang: Language;
  onShowAlert: (payload: ModalAlertPayload) => void;
  defaultOpen?: boolean;
  compactTitle?: boolean;
}

export const OrgStorageGuideCard: React.FC<OrgStorageGuideCardProps> = ({
  lang,
  onShowAlert,
  defaultOpen = false,
  compactTitle = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [showCodePreview, setShowCodePreview] = useState(false);

  const handleCopyCode = async () => {
    const ok = await copyTextToClipboard(GOOGLE_APPS_SCRIPT_TEMPLATE);
    onShowAlert({
      icon: '📋',
      title: ok
        ? lang === 'th'
          ? 'คัดลอกโค้ดสำเร็จรูปแล้ว!'
          : 'Apps Script Template Copied!'
        : lang === 'th'
        ? 'โค้ด Google Apps Script'
        : 'Google Apps Script Code',
      message:
        lang === 'th'
          ? 'นำไปวางใน Google Sheet ขององค์กร > ส่วนขยาย (Extensions) > Apps Script แล้วกด Deploy → Web app (Anyone) ได้เลยค่ะ'
          : 'Paste into Google Sheets > Extensions > Apps Script and deploy as Web app (Anyone).',
      tone: 'mint',
    });
  };

  return (
    <div className="rounded-2xl border border-[#8FD4C6] bg-[#F5FCFA] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className={`${compactTitle ? 'text-xs' : 'text-sm'} font-extrabold text-[#114A42]`}>
            🛠️{' '}
            {lang === 'th'
              ? 'ภาพตัวอย่างหน้าจอ & วิธีเชื่อม Google Drive + Sheet (ทำตาม 2 นาที เสร็จเลย!)'
              : 'Visual Screen Guide: Connect Google Drive & Sheet in 2 Mins'}
          </div>
          <div className="text-xs text-[#4F433C]">
            {lang === 'th'
              ? 'มีภาพจำลองปุ่มให้ดูตามจริง ไม่ต้องเขียนโค้ดเอง ทำรอไว้ระหว่างรออนุมัติได้เลยค่ะ'
              : 'Visual screen mockups included—no coding required.'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-[36px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
        >
          {open
            ? lang === 'th'
              ? 'ซ่อนภาพคู่มือ ▴'
              : 'Hide Visual Guide ▴'
            : lang === 'th'
            ? '🖼️ เปิดดูภาพวิธีทำทีละขั้น ▾'
            : '🖼️ Open Visual Guide ▾'}
        </button>
      </div>

      {open && (
        <div className="space-y-4 pt-2 border-t border-[#D2EFE8]">
          {/* Quick Action Links */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://drive.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#EBD8C3] bg-white hover:bg-[#FFF5BA]/50 px-3 py-1.5 text-xs font-bold text-[#3D322C]"
            >
              📁 {lang === 'th' ? '1. เปิด Google Drive' : '1. Open Google Drive'} ↗
            </a>
            <a
              href="https://sheets.new"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#8FD4C6] bg-white hover:bg-[#E8FAF6] px-3 py-1.5 text-xs font-bold text-[#114A42]"
            >
              📊 {lang === 'th' ? '2. สร้าง Google Sheet ใหม่ทันที' : '2. Create New Google Sheet'} ↗
            </a>
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="min-h-[36px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              📋 {lang === 'th' ? '3. คัดลอกโค้ด Apps Script สำเร็จรูป' : '3. Copy Apps Script Template'}
            </button>
            <button
              type="button"
              onClick={() => setShowCodePreview((v) => !v)}
              className="min-h-[36px] rounded-xl border border-[#D2EFE8] bg-white hover:bg-[#FAF6F1] px-3 py-1.5 text-xs font-bold text-[#4F433C] cursor-pointer"
            >
              {showCodePreview
                ? lang === 'th'
                  ? 'ซ่อนโค้ด'
                  : 'Hide Code'
                : lang === 'th'
                ? '👁️ ดูตัวอย่างโค้ด'
                : '👁️ Preview Code'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Part A: Google Drive + Visual Mockup */}
            <div className="rounded-xl border border-[#EBD8C3] bg-white p-3.5 space-y-3">
              <div className="font-extrabold text-[#3D322C]">
                📁 {lang === 'th' ? 'ส่วนที่ 1: แชร์โฟลเดอร์ Google Drive (30 วินาที)' : 'Part 1: Google Drive Folder (30 sec)'}
              </div>

              {/* Visual Mockup: Google Drive Share Dialog */}
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-1.5">
                  <span className="font-bold text-[#1F2937]">📁 โฟลเดอร์: มูลนิธิบ้าน...</span>
                  <span className="rounded bg-[#E5E7EB] px-1.5 py-0.5 font-bold text-[#374151]">⋮ แชร์ (Share)</span>
                </div>
                <div className="text-[#4B5563] font-semibold">
                  {lang === 'th' ? 'การเข้าถึงทั่วไป (General access):' : 'General access:'}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-lg border-2 border-[#10B981] bg-[#ECFDF5] px-2.5 py-1 font-extrabold text-[#065F46]">
                    🌐 ทุกคนที่มีลิงก์ (Anyone with the link) ▾
                  </span>
                  <span className="rounded-lg bg-[#2563EB] text-white px-2.5 py-1 font-bold">
                    🔗 คัดลอกลิงก์
                  </span>
                </div>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-[#4F433C] leading-relaxed">
                <li>
                  {lang === 'th'
                    ? 'เปิด Google Drive ขององค์กร → กด "+ ใหม่" สร้างโฟลเดอร์ชื่อบ้าน'
                    : 'Open Google Drive → click "+ New" → New folder.'}
                </li>
                <li>
                  {lang === 'th'
                    ? 'กด ⋮ ที่โฟลเดอร์ → แชร์ → เลือก "ทุกคนที่มีลิงก์" (หรือแชร์ให้ทีม)'
                    : 'Click ⋮ → Share → set access to Anyone with the link (or your team).'}
                </li>
                <li>
                  {lang === 'th'
                    ? 'กด "คัดลอกลิงก์" มาวางในช่อง Google Drive ขององค์กร'
                    : 'Copy the link and paste it into the Drive URL box.'}
                </li>
              </ol>
            </div>

            {/* Part B: Google Sheet + 3-Step Visual Strip */}
            <div className="rounded-xl border border-[#8FD4C6] bg-white p-3.5 space-y-3">
              <div className="font-extrabold text-[#114A42]">
                📊 {lang === 'th' ? 'ส่วนที่ 2: เชื่อม Google Sheet เก็บถาวร (90 วินาที)' : 'Part 2: Google Sheet Setup (90 sec)'}
              </div>

              {/* Visual 3-Step Screen Strip */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] p-2 space-y-1">
                  <div className="font-extrabold text-[#114A42]">ขั้น 1: เปิดเมนู</div>
                  <div className="rounded bg-white border border-[#E5E7EB] px-1.5 py-1 text-[#374151]">
                    ไฟล์ · แก้ไข · ดู
                  </div>
                  <div className="rounded border-2 border-[#10B981] bg-[#ECFDF5] px-1.5 py-1 font-bold text-[#065F46]">
                    ส่วนขยาย ➜ Apps Script
                  </div>
                </div>

                <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] p-2 space-y-1">
                  <div className="font-extrabold text-[#114A42]">ขั้น 2: วางโค้ด</div>
                  <div className="rounded bg-[#1F2937] text-[#A7F3D0] px-1.5 py-1 font-mono">
                    {'function doPost()...'}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="rounded bg-[#E5E7EB] px-1 py-0.5 font-bold">💾 เซฟ</span>
                    <span className="rounded bg-[#2563EB] text-white px-1.5 py-0.5 font-bold">Deploy ▾</span>
                  </div>
                </div>

                <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] p-2 space-y-1">
                  <div className="font-extrabold text-[#114A42]">ขั้น 3: รับลิงก์</div>
                  <div className="rounded bg-white border border-[#E5E7EB] px-1.5 py-0.5">
                    ชนิด: <strong>Web app</strong>
                  </div>
                  <div className="rounded border-2 border-[#10B981] bg-[#ECFDF5] px-1.5 py-0.5 font-bold text-[#065F46]">
                    สิทธิ์: ทุกคน (Anyone)
                  </div>
                  <div className="text-[#2563EB] font-bold">🔗 คัดลอก URL</div>
                </div>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-[#4F433C] leading-relaxed">
                <li>
                  {lang === 'th'
                    ? 'กด "2. สร้าง Google Sheet ใหม่ทันที" → เมนู ส่วนขยาย (Extensions) → Apps Script'
                    : 'Click Create New Google Sheet → Extensions → Apps Script.'}
                </li>
                <li>
                  {lang === 'th'
                    ? 'ลบโค้ดเดิมออกหมด → กดปุ่ม "3. คัดลอกโค้ด Apps Script" ไปวาง → กด 💾 บันทึก'
                    : 'Replace old code with copied template → Save.'}
                </li>
                <li>
                  {lang === 'th'
                    ? 'กด Deploy → รายการใหม่ → เลือก Web app → ผู้มีสิทธิ์เข้าถึง: "ทุกคน (Anyone)" → อนุญาตสิทธิ์ → คัดลอก Web app URL มาวางได้เลย!'
                    : 'Deploy → New deployment → Web app → Who has access: Anyone → Authorize → copy URL!'}
                </li>
              </ol>
            </div>
          </div>

          {/* Live Sheet Output Table Preview */}
          <div className="rounded-xl border border-[#B9E8DF] bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-[#114A42]">
                📋 {lang === 'th' ? 'หน้าตา Google Sheet ที่องค์กรคุณจะได้รับจริง (แท็บ Logs บันทึกอัตโนมัติ):' : 'Preview: What Your Google Sheet (Logs Tab) Looks Like:'}
              </div>
              <span className="text-[11px] font-bold text-[#1B5E52]">
                {lang === 'th' ? '✅ เก็บย้อนหลังได้ตลอดชีพในบัญชีของคุณ' : '✅ Stored permanently in your account'}
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#E8FAF6] text-[#114A42] font-extrabold border-b border-[#B9E8DF]">
                    <th className="px-2.5 py-1.5 border-r border-[#D2EFE8]">เวลาซิงค์</th>
                    <th className="px-2.5 py-1.5 border-r border-[#D2EFE8]">เหตุการณ์</th>
                    <th className="px-2.5 py-1.5 border-r border-[#D2EFE8]">สมาชิก</th>
                    <th className="px-2.5 py-1.5 border-r border-[#D2EFE8]">เด็ก</th>
                    <th className="px-2.5 py-1.5 border-r border-[#D2EFE8]">ป่วย</th>
                    <th className="px-2.5 py-1.5">ข้อมูลเต็ม (JSON)</th>
                  </tr>
                </thead>
                <tbody className="text-[#4F433C]">
                  <tr className="border-b border-[#F3F4F6]">
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6] whitespace-nowrap">20/11 08:12</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6] font-semibold">เช็คชื่อไปโรงเรียน (น้องตัวอย่าง)</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6]">16</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6]">12</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6]">0</td>
                    <td className="px-2.5 py-1.5 font-mono text-[10px] text-[#6B7280]">{'{"members":[...]}'}</td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6] whitespace-nowrap">20/11 17:30</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6] font-semibold">ส่งสรุปรายสัปดาห์เข้า LINE</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6]">16</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6]">12</td>
                    <td className="px-2.5 py-1.5 border-r border-[#F3F4F6]">1</td>
                    <td className="px-2.5 py-1.5 font-mono text-[10px] text-[#6B7280]">{'{"weeklyActivityLogs":[...]}'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {showCodePreview && (
            <pre className="rounded-xl border border-[#D2EFE8] bg-[#1F2937] text-[#E5E7EB] p-3 text-[11px] overflow-x-auto leading-relaxed">
              <code>{GOOGLE_APPS_SCRIPT_TEMPLATE}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
