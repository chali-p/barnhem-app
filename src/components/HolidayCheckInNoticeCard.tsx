import React, { useState } from 'react';
import { Language } from '../types/barnhem';

interface HolidayCheckInNoticeCardProps {
  lang: Language;
  variant?: 'kid_home' | 'rules' | 'announcement';
  defaultExpanded?: boolean;
}

export const HolidayCheckInNoticeCard: React.FC<HolidayCheckInNoticeCardProps> = ({
  lang,
  variant = 'rules',
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isKidHome = variant === 'kid_home';

  return (
    <section className="rounded-[22px] sm:rounded-[26px] border-2 border-[#F4C28C] bg-gradient-to-br from-[#FFFDF7] via-[#FFF9EE] to-[#FFF2F5] overflow-hidden shadow-2xs">
      <div className="bg-[#FFF1D6] border-b border-[#F4CFA0] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-extrabold text-[#6E340E] flex items-center gap-2">
            <span>📢</span>
            <span>
              {lang === 'th'
                ? 'กติกาโหวตบทลงโทษ & ระบบเช็คอินตื่นนอนวันหยุดแบบใหม่'
                : 'Holiday Late Penalty Vote & New Wake-Up Check-In Rules'}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-semibold text-[#8A5026] mt-0.5">
            {lang === 'th'
              ? 'วันเสาร์ 08:15–08:35 น. (อนุโลมถึง 08:36 น.) · อาทิตย์ & วันนักขัตฤกษ์ ≤ 08:15 น. (อนุโลมถึง 08:25 น.) · กดชื่อตัวเองได้เลย'
              : 'Sat 08:15–08:35 (grace to 08:36) · Sun & Public Holidays ≤ 08:15 (grace to 08:25) · Direct self-tap without PIN'}
          </p>
        </div>

        {isKidHome && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="min-h-[34px] rounded-xl border border-[#E5B880] bg-white hover:bg-[#FFF8EB] px-3 py-1 text-xs font-extrabold text-[#6E340E] cursor-pointer whitespace-nowrap shrink-0"
          >
            {expanded
              ? lang === 'th'
                ? 'ย่อ ▴'
                : 'Collapse ▴'
              : lang === 'th'
              ? 'อ่านทั้งหมด 3 ข้อ ▾'
              : 'Read All 3 Rules ▾'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-3.5 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs sm:text-[13px] text-[#3D322C] leading-relaxed">
          {/* 1. การโหวตบทลงโทษตื่นสายวันหยุด (วันนี้) */}
          <div className="rounded-2xl border border-[#F3B7C0] bg-white p-3.5 space-y-1.5">
            <div className="font-extrabold text-[#881337]">
              1. 🗳️{' '}
              {lang === 'th'
                ? 'การโหวตบทลงโทษตื่นสายวันหยุด (วันนี้)'
                : '1. Holiday Late Wake-Up Penalty Vote (Today)'}
            </div>
            <p>
              <strong className="text-[#6B2D39]">
                {lang === 'th' ? 'กติกา:' : 'Rule:'}
              </strong>{' '}
              {lang === 'th'
                ? 'พี่กิ๊กจะให้โหวตเลือกบทลงโทษของตัวเอง มี 2 ตัวเลือก'
                : "P'Kik opens a vote to pick your own penalty with 2 choices."}
            </p>
            <p>
              <strong className="text-[#6B2D39]">
                {lang === 'th' ? 'คำแนะนำ:' : 'Tip:'}
              </strong>{' '}
              {lang === 'th'
                ? 'ให้ตัดสินใจเลือกเอง อย่ากดตามเพื่อน'
                : 'Decide for yourself — do not just copy your friends.'}
            </p>
            <p>
              <strong className="text-[#6B2D39]">
                {lang === 'th' ? 'การแสดงผล:' : 'Display:'}
              </strong>{' '}
              {lang === 'th'
                ? 'ไม่แสดงชื่อว่าใครโหวตอะไร แต่ผลโหวตจะขึ้นโชว์ที่หน้าจอของแต่ละคนอัตโนมัติเมื่อตื่นสาย'
                : 'Individual votes stay anonymous; your voted penalty automatically appears on your screen if you wake up late.'}
            </p>
          </div>

          {/* 2. ระบบเช็คอินตื่นนอนแบบใหม่ (เริ่มพรุ่งนี้) */}
          <div className="rounded-2xl border border-[#8FD4C6] bg-white p-3.5 space-y-1.5">
            <div className="font-extrabold text-[#114A42]">
              2. 👆{' '}
              {lang === 'th'
                ? 'ระบบเช็คอินตื่นนอนแบบใหม่ (เริ่มพรุ่งนี้)'
                : '2. New Wake-Up Check-In System (Starting Tomorrow)'}
            </div>
            <p>
              <strong className="text-[#16574D]">
                {lang === 'th' ? 'วิธีการ:' : 'How:'}
              </strong>{' '}
              {lang === 'th'
                ? 'กดเลือกชื่อตัวเองได้เลย ไม่ต้องใส่รหัสยืนยัน (เพื่อความรวดเร็วและไม่ให้แย่งกันกด)'
                : 'Tap your own name directly — no PIN required (for speed and to avoid crowding).'}
            </p>
            <p className="rounded-xl border border-[#FDA4AF] bg-[#FFF1F2] px-2.5 py-1.5 text-[#881337] font-bold">
              🚫 {lang === 'th' ? 'ข้อห้ามสำคัญ:' : 'Important Rule:'}{' '}
              <span className="font-semibold">
                {lang === 'th'
                  ? 'ห้ามกดชื่อแทนเพื่อนเด็ดขาด หากพบว่ามีการกดแทนกัน จะเปลี่ยนกลับไปใช้ระบบใส่รหัสยืนยันตามเดิม ซึ่งจะทำให้เช็คอินช้าลง'
                  : 'Never tap for a friend! If anyone checks in for someone else, we will revert to PIN verification, which slows check-in down.'}
              </span>
            </p>
            <p>
              <strong className="text-[#16574D]">
                {lang === 'th' ? 'การเตรียมตัว:' : 'Preparation:'}
              </strong>{' '}
              {lang === 'th'
                ? 'ตั้งนาฬิกาปลุกและรีบลุกมากดชื่อด้วยตัวเองให้ทันเวลา'
                : 'Set an alarm and get up promptly to tap your own name on time.'}
            </p>
          </div>

          {/* 3. ตารางเวลาเช็คอินในวันหยุด */}
          <div className="rounded-2xl border border-[#F5C58A] bg-white p-3.5 space-y-2">
            <div className="font-extrabold text-[#7A3B10]">
              3. ⏰{' '}
              {lang === 'th'
                ? 'ตารางเวลาเช็คอินในวันหยุด'
                : '3. Holiday Wake-Up Check-In Schedule'}
            </div>
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 space-y-0.5">
              <div className="font-extrabold text-[#92400E]">
                📅 {lang === 'th' ? 'วันเสาร์' : 'Saturday'}
              </div>
              <div className="font-semibold text-[#5C3A14] tabular-nums">
                {lang === 'th'
                  ? 'ระบบเปิด 08:15 – 08:35 น. (อนุโลมได้ไม่เกิน 1 นาที / ถึง 08:36 น.)'
                  : 'Opens 08:15 – 08:35 (1-min max grace / until 08:36)'}
              </div>
            </div>
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 space-y-0.5">
              <div className="font-extrabold text-[#1E3A8A]">
                ☀️ {lang === 'th' ? 'วันอาทิตย์ และ วันนักขัตฤกษ์' : 'Sunday & Public Holidays'}
              </div>
              <div className="font-semibold text-[#1E40AF] tabular-nums">
                {lang === 'th'
                  ? 'ไม่เกิน 08:15 น. (อนุโลมได้ไม่เกิน 10 นาที / ถึง 08:25 น. เนื่องจากพี่เกดต้องเดินปลุกและไขกุญแจ เด็กๆ ต้องรีบทำเวลาลุกมาเช็คอิน)'
                  : "By 08:15 (10-min max grace / until 08:25 as P'Ked walks to wake kids & unlock doors — hurry up to check in!)"}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
