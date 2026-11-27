import React, { useMemo, useState } from 'react';
import { AppSettings, Language } from '../types/barnhem';
import {
  formatThaiCurfewClock,
  getAutoReturnPhoneRuleConfig,
  getEffectiveHomeworkPermissionWindow,
  getEffectiveWeekendLatePenaltyPreset,
  minsToHHMM,
} from '../utils/expressKiosk';
import { formatDigitalClock } from '../utils/timeRules';
import { HolidayCheckInNoticeCard } from './HolidayCheckInNoticeCard';

export type RulesShiftTab = 'morning' | 'evening' | 'night' | 'all';
export type RulesGroupFilter = 'all' | 'older' | 'younger' | 'senior';

interface HouseRulesGuideViewProps {
  orgName?: string;
  now: Date;
  lang: Language;
  settings?: AppSettings;
  compactEmbedded?: boolean;
  defaultGroupFilter?: RulesGroupFilter;
  onBackHome?: () => void;
}

function detectCurrentShift(now: Date): 'morning' | 'evening' | 'night' {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 12 * 60) return 'morning';
  if (mins < 18 * 60 + 30) return 'evening';
  return 'night';
}

export const HouseRulesGuideView: React.FC<HouseRulesGuideViewProps> = ({
  orgName = 'Barnhem Care & Kids',
  now,
  lang,
  settings,
  compactEmbedded = false,
  defaultGroupFilter = 'all',
  onBackHome,
}) => {
  const liveShift = useMemo(() => detectCurrentShift(now), [now]);
  const [activeShift, setActiveShift] = useState<RulesShiftTab>(() => liveShift);
  const [groupFilter, setGroupFilter] = useState<RulesGroupFilter>(defaultGroupFilter);

  const hwPermWin = useMemo(() => getEffectiveHomeworkPermissionWindow(settings), [settings]);
  const autoReturnRule = useMemo(() => getAutoReturnPhoneRuleConfig(settings), [settings]);
  const weekendPreset = useMemo(() => getEffectiveWeekendLatePenaltyPreset(settings), [settings]);

  const noHwDeadlineTh = formatThaiCurfewClock(autoReturnRule.noHomeworkDeadlineMins);
  const noHwDeadlineEn = minsToHHMM(autoReturnRule.noHomeworkDeadlineMins);
  const hwExtDeadlineTh = formatThaiCurfewClock(autoReturnRule.homeworkExtendedDeadlineMins);
  const hwExtDeadlineEn = minsToHHMM(autoReturnRule.homeworkExtendedDeadlineMins);
  const hwReqStartEn = minsToHHMM(hwPermWin.startMins);
  const hwReqEndEn = minsToHHMM(hwPermWin.endMins);

  const showOlder = groupFilter === 'all' || groupFilter === 'older';
  const showYounger = groupFilter === 'all' || groupFilter === 'younger';
  const showSenior = groupFilter === 'all' || groupFilter === 'senior';

  const shiftTabs: Array<{
    id: RulesShiftTab;
    emoji: string;
    labelTh: string;
    labelEn: string;
    subTh: string;
    subEn: string;
    activeCls: string;
  }> = [
    {
      id: 'morning',
      emoji: '🌅',
      labelTh: 'ช่วงเช้า',
      labelEn: 'Morning',
      subTh: 'เด็กโต 1 · เด็กเล็ก 2 · พี่ใหญ่ 1',
      subEn: 'Older 1 · Younger 2 · Senior 1',
      activeCls: 'border-[#F2BD6D] bg-[#FFF6DF] text-[#6B4409]',
    },
    {
      id: 'evening',
      emoji: '🌇',
      labelTh: 'ช่วงเย็น',
      labelEn: 'Evening',
      subTh: 'เด็กเล็ก 0 · เด็กโต 2',
      subEn: 'Younger 0 · Older 2',
      activeCls: 'border-[#F1A3B4] bg-[#FFF0F4] text-[#7D1E37]',
    },
    {
      id: 'night',
      emoji: '🌙',
      labelTh: 'ช่วงค่ำ',
      labelEn: 'Night',
      subTh: 'เด็กเล็ก 1 · เด็กโต 2 + คอม',
      subEn: 'Younger 1 · Older 2 + PC',
      activeCls: 'border-[#A7B9EB] bg-[#EFF3FF] text-[#1E336B]',
    },
    {
      id: 'all',
      emoji: '📋',
      labelTh: 'ดูทั้งหมด',
      labelEn: 'View All',
      subTh: 'รวมครบทั้ง 3 ช่วงเวลา',
      subEn: 'All 3 shifts',
      activeCls: 'border-[#73CBB9] bg-[#E7F9F5] text-[#114A42]',
    },
  ];

  const groupFilters: Array<{
    id: RulesGroupFilter;
    labelTh: string;
    labelEn: string;
    dotCls: string;
    idleCls: string;
    activeCls: string;
  }> = [
    {
      id: 'all',
      labelTh: 'ทุกคน (ทุกรุ่น)',
      labelEn: 'All Groups',
      dotCls: 'bg-[#6E5C52]',
      idleCls: 'border-[#D6CCC2] bg-[#FAF8F5] hover:bg-[#EFE9E1] text-[#4A3E38]',
      activeCls: 'border-[#3D322C] bg-[#3D322C] text-white shadow-xs',
    },
    {
      id: 'younger',
      labelTh: '🐣 รุ่นเด็กเล็ก (สีเหลืองทอง)',
      labelEn: '🐣 Younger Kids (Amber)',
      dotCls: 'bg-[#F59E0B]',
      idleCls: 'border-[#F59E0B] bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#78350F]',
      activeCls: 'border-[#B45309] bg-[#D97706] text-white shadow-xs',
    },
    {
      id: 'older',
      labelTh: '🌟 รุ่นเด็กโต (สีฟ้า)',
      labelEn: '🌟 Older Kids (Blue)',
      dotCls: 'bg-[#0284C7]',
      idleCls: 'border-[#38BDF8] bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0C4A6E]',
      activeCls: 'border-[#0369A1] bg-[#0284C7] text-white shadow-xs',
    },
    {
      id: 'senior',
      labelTh: '🎓 รุ่นพี่ใหญ่ พี่โบ (สีม่วง)',
      labelEn: "🎓 Senior P'Bo (Violet)",
      dotCls: 'bg-[#7C3AED]',
      idleCls: 'border-[#A78BFA] bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#4C1D95]',
      activeCls: 'border-[#6D28D9] bg-[#7C3AED] text-white shadow-xs',
    },
  ];

  const showMorning = activeShift === 'morning' || activeShift === 'all';
  const showEvening = activeShift === 'evening' || activeShift === 'all';
  const showNight = activeShift === 'night' || activeShift === 'all';

  return (
    <div className={compactEmbedded ? 'space-y-4' : 'max-w-5xl mx-auto space-y-5'}>
      {/* Standalone Header Card (shown when opened via PIN 0007) */}
      {!compactEmbedded && (
        <section className="rounded-[28px] border-2 border-[#D4C7EA] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4C7EA] bg-[#F4EFFB] px-3 py-1 text-xs font-extrabold text-[#3E2B63]">
                  <span>🔑 PIN 0007</span>
                  <span>·</span>
                  <span>
                    {lang === 'th' ? 'คู่มือข้อตกลง & การกดระบบ' : 'House Agreement & Guide'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-xl border border-[#C9E7E0] bg-[#EEFBF8] px-2.5 py-1 text-[11px] font-bold text-[#114A42] tabular-nums">
                  <span>🕒</span>
                  <span>
                    {lang === 'th'
                      ? `เวลาปัจจุบัน ${formatDigitalClock(now)} น. (${
                          liveShift === 'morning'
                            ? 'ช่วงเช้า'
                            : liveShift === 'evening'
                            ? 'ช่วงเย็น'
                            : 'ช่วงค่ำ'
                        })`
                      : `Now ${formatDigitalClock(now)}`}
                  </span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
                📜{' '}
                {lang === 'th'
                  ? `สรุปข้อตกลงและขั้นตอนการกดระบบประจำวัน — ${orgName}`
                  : `Daily House Rules & Check-In Steps — ${orgName}`}
              </h1>
              <p className="text-xs sm:text-sm text-[#6E5C52]">
                {lang === 'th'
                  ? 'เลือกดูแยกตามช่วงเวลา เช้า · เย็น · ค่ำ หรือเลือกสีตามรุ่นของตนเองให้อ่านง่ายชัดเจนได้เลยค่ะ'
                  : 'Browse by Morning, Evening, or Night shift—color-coded by group for instant clarity.'}
              </p>
            </div>

            {onBackHome && (
              <button
                type="button"
                onClick={onBackHome}
                className="min-h-[40px] rounded-2xl border border-[#EBD8C3] bg-white hover:bg-[#FAF5EF] text-[#3D322C] px-4 py-2 text-xs font-extrabold cursor-pointer shrink-0"
              >
                ← {lang === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Compact Top Banner when embedded inside Useful Info or Kid Hub */}
      {compactEmbedded && (
        <div className="rounded-2xl border border-[#D4C7EA] bg-[#F7F3FC] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#3E2B63]">
          <span className="font-bold">
            📜{' '}
            {lang === 'th'
              ? 'สรุปข้อตกลงและขั้นตอนการกดระบบแยกตามช่วงเวลาและสีรุ่น'
              : 'House Agreements Color-Coded by Shift & Group'}
          </span>
          <span className="rounded-lg bg-white border border-[#D4C7EA] px-2.5 py-0.5 font-extrabold tabular-nums">
            🔑 PIN 0007
          </span>
        </div>
      )}

      {/* Shift Switcher Tabs + High-Contrast Color-Coded Group Filter */}
      <div className="rounded-3xl border-2 border-[#EAE1D8] bg-white p-3.5 sm:p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {shiftTabs.map((tab) => {
            const active = activeShift === tab.id;
            const isNowTab = tab.id === liveShift;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveShift(tab.id)}
                className={`rounded-2xl border-2 px-3 py-2.5 text-left transition-all cursor-pointer ${
                  active
                    ? `${tab.activeCls} shadow-xs`
                    : 'border-[#EDE5DC] bg-[#FAF8F5] hover:bg-[#F3EDE6] text-[#5E4E45]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-extrabold">
                    {tab.emoji} {lang === 'th' ? tab.labelTh : tab.labelEn}
                  </span>
                  {isNowTab && (
                    <span className="rounded-md bg-[#114A42] px-1.5 py-0.5 text-[9px] font-extrabold text-white shrink-0">
                      {lang === 'th' ? 'ตอนนี้' : 'NOW'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-medium opacity-85 mt-0.5 truncate">
                  {lang === 'th' ? tab.subTh : tab.subEn}
                </div>
              </button>
            );
          })}
        </div>

        {/* Distinct Color Legend / Filter by Group (รุ่น) */}
        <div className="rounded-2xl border border-[#EAE1D8] bg-[#FCFBF9] p-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold text-[#5E4E45] px-1">
            🎨 {lang === 'th' ? 'แยกสีตามรุ่น:' : 'Color Code by Group:'}
          </span>
          {groupFilters.map((gf) => {
            const active = groupFilter === gf.id;
            return (
              <button
                key={gf.id}
                type="button"
                onClick={() => setGroupFilter(gf.id)}
                className={`rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold cursor-pointer transition-all inline-flex items-center gap-1.5 ${
                  active ? gf.activeCls : gf.idleCls
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full border border-white/80 shrink-0 ${
                    active ? 'bg-white' : gf.dotCls
                  }`}
                />
                <span>{lang === 'th' ? gf.labelTh : gf.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🌅 SECTION 1: ช่วงเช้า (MORNING)                          */}
      {/* ======================================================== */}
      {showMorning && (
        <section className="rounded-[26px] border-2 border-[#E7C27D] bg-white p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-[#F6E6C2]">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-[#6B4409] flex items-center gap-2">
                <span>🌅</span>
                <span>{lang === 'th' ? 'ช่วงเช้า' : 'Morning Shift'}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                <span className="rounded-md bg-[#E0F2FE] border border-[#38BDF8] px-2 py-0.5 text-[#0C4A6E]">
                  🌟 {lang === 'th' ? 'เด็กโต 1 ครั้ง' : 'Older 1'}
                </span>
                <span className="rounded-md bg-[#FEF3C7] border border-[#F59E0B] px-2 py-0.5 text-[#78350F]">
                  🐣 {lang === 'th' ? 'เด็กเล็ก 2 ครั้ง' : 'Younger 2'}
                </span>
                <span className="rounded-md bg-[#EDE9FE] border border-[#A78BFA] px-2 py-0.5 text-[#4C1D95]">
                  🎓 {lang === 'th' ? 'พี่ใหญ่ (พี่โบ) 1 ครั้ง' : "Senior P'Bo 1"}
                </span>
              </div>
            </div>
            <span className="rounded-xl border border-[#F2BD6D] bg-[#FFF5D6] px-3 py-1 text-xs font-extrabold text-[#6B4409] tabular-nums">
              ⏰ {lang === 'th' ? '06:15 – 07:21 น.' : '06:15 – 07:21'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {/* 🌟 รุ่นเด็กโต (สีฟ้า) - ช่วงเช้า */}
            {showOlder && (
              <div className="rounded-2xl border-2 border-[#38BDF8] border-l-[8px] border-l-[#0284C7] bg-[#F0F9FF] overflow-hidden shadow-2xs">
                <div className="bg-[#BAE6FD]/80 border-b border-[#38BDF8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#0284C7] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                      🌟 {lang === 'th' ? 'รุ่นเด็กโต' : 'Older Kids'}
                    </span>
                    <span className="font-extrabold text-sm sm:text-base text-[#0C4A6E]">
                      {lang === 'th'
                        ? '(ระบบความเชื่อใจ — ไม่ต้องกดขอรับมือถือ)'
                        : '(Trust System — No Phone Pickup Tap Required)'}
                    </span>
                  </div>
                  <span className="rounded-lg bg-white border border-[#0284C7] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0C4A6E]">
                    {lang === 'th' ? 'กด 1 ครั้ง' : '1 Tap'}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="rounded-xl bg-white border border-[#7DD3FC] p-3 space-y-1.5 text-xs sm:text-sm text-[#1E3A5F]">
                    <p>
                      <strong className="text-[#0369A1]">
                        {lang === 'th' ? 'เงื่อนไขรับมือถือ:' : 'Pickup Condition:'}
                      </strong>{' '}
                      {lang === 'th'
                        ? 'ต้องอาบน้ำ แต่งตัว และทานข้าวให้เรียบร้อยก่อน จึงจะมารับมือถือที่จุดรับได้ (พี่เลี้ยงจะนำมาวางไว้เวลา 06:15 น.)'
                        : 'Must shower, get dressed, and finish breakfast before picking up phone at the station (placed by staff at 06:15).'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#F59E0B] bg-[#FFFBEB] p-3 space-y-2 text-xs sm:text-sm">
                    <div className="font-extrabold text-[#92400E]">
                      ⚠️{' '}
                      {lang === 'th'
                        ? 'มาตรการปรับเวลา (หากไม่ทำตามข้อตกลง):'
                        : 'Time Adjustment Steps (If agreement is not followed):'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white border border-[#FCD34D] px-3 py-2">
                        <div className="text-[11px] font-extrabold text-[#B45309]">Step 1</div>
                        <div className="font-bold text-[#3D322C] tabular-nums">
                          {lang === 'th' ? 'เลื่อนเวลารับมือถือเป็น 06:30 น.' : 'Delayed to 06:30'}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white border border-[#F59E0B] px-3 py-2">
                        <div className="text-[11px] font-extrabold text-[#C2410C]">Step 2</div>
                        <div className="font-bold text-[#3D322C] tabular-nums">
                          {lang === 'th' ? 'เลื่อนเวลารับมือถือเป็น 06:45 น.' : 'Delayed to 06:45'}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white border border-[#F43F5E] px-3 py-2">
                        <div className="text-[11px] font-extrabold text-[#BE123C]">Step 3</div>
                        <div className="font-bold text-[#881337] tabular-nums">
                          {lang === 'th' ? 'เลื่อนเวลารับมือถือเป็น 07:00 น.' : 'Delayed to 07:00'}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-[#92400E] pt-0.5">
                      💛{' '}
                      {lang === 'th'
                        ? 'ขอให้เด็กๆ รักษาความซื่อสัตย์ต่อตนเอง ไม่รบกวนหรือเบียดเบียนผู้อื่นนะคะ'
                        : 'Please stay honest with yourself and be considerate of others.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#38BDF8] bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="font-bold text-[#0C4A6E]">
                      🚐 {lang === 'th' ? 'เช็คชื่อไปโรงเรียน:' : 'School Check-In:'}{' '}
                      {lang === 'th'
                        ? 'กดปุ่ม "ไปโรงเรียน" ก่อนเวลา 07:21 น.'
                        : 'Tap "Go to School" before 07:21'}
                    </span>
                    <span className="rounded-lg bg-[#0284C7] px-2.5 py-0.5 text-xs font-extrabold text-white tabular-nums">
                      ⏰ &lt; 07:21 น.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 🐣 รุ่นเด็กเล็ก (สีเหลืองทอง) & 🎓 รุ่นพี่ใหญ่ (สีม่วง) - ช่วงเช้า */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {showYounger && (
                <div className="rounded-2xl border-2 border-[#F59E0B] border-l-[8px] border-l-[#D97706] bg-[#FFFBEB] overflow-hidden shadow-2xs">
                  <div className="bg-[#FDE68A]/85 border-b border-[#F59E0B] px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-[#D97706] px-2.5 py-0.5 text-xs font-extrabold text-white">
                      🐣 {lang === 'th' ? 'รุ่นเด็กเล็ก' : 'Younger Kids'}
                    </span>
                    <span className="rounded-lg bg-white border border-[#D97706] px-2.5 py-0.5 text-[11px] font-extrabold text-[#78350F]">
                      {lang === 'th' ? 'กด 2 ครั้ง' : '2 Taps'}
                    </span>
                  </div>
                  <div className="p-4 space-y-2 text-xs sm:text-sm text-[#451A03]">
                    <div className="rounded-xl bg-white border border-[#FCD34D] p-3 space-y-1">
                      <div className="font-extrabold text-[#92400E]">
                        1. 🍚{' '}
                        {lang === 'th'
                          ? 'เช็คชื่อทานข้าว: กดปุ่ม "กินข้าว" ไม่เกินเวลา 06:40 น.'
                          : 'Breakfast Check-In: Tap "Breakfast" by 06:40'}
                      </div>
                      <p className="text-xs text-[#78350F]">
                        {lang === 'th'
                          ? '(ต้องนั่งประจำที่และมีอาหารวางอยู่ตรงหน้าแล้วเท่านั้น)'
                          : '(Only when seated at the table with food served in front of you)'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-[#FCD34D] p-3">
                      <div className="font-extrabold text-[#92400E]">
                        2. 🚐{' '}
                        {lang === 'th'
                          ? 'เช็คชื่อไปโรงเรียน: กดปุ่ม "ไปโรงเรียน" ก่อนเวลา 07:01 น.'
                          : 'School Check-In: Tap "Go to School" before 07:01'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showSenior && (
                <div className="rounded-2xl border-2 border-[#A78BFA] border-l-[8px] border-l-[#7C3AED] bg-[#F5F3FF] overflow-hidden shadow-2xs">
                  <div className="bg-[#DDD6FE]/85 border-b border-[#A78BFA] px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-[#7C3AED] px-2.5 py-0.5 text-xs font-extrabold text-white">
                      🎓 {lang === 'th' ? 'รุ่นพี่ใหญ่ (พี่โบ)' : "Senior (P'Bo)"}
                    </span>
                    <span className="rounded-lg bg-white border border-[#7C3AED] px-2.5 py-0.5 text-[11px] font-extrabold text-[#4C1D95]">
                      {lang === 'th' ? 'กด 1 ครั้ง' : '1 Tap'}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="rounded-xl bg-white border border-[#C4B5FD] p-3 text-xs sm:text-sm text-[#4C1D95]">
                      <div className="font-extrabold">
                        1. 🚐{' '}
                        {lang === 'th'
                          ? 'เช็คชื่อไปโรงเรียน: กดปุ่ม "ไปโรงเรียน" ก่อนเวลา 07:01 น.'
                          : 'School Check-In: Tap "Go to School" before 07:01'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 🏖️ บทลงโทษตื่นสายวันหยุด (เสาร์ · อาทิตย์ · วันหยุดนักขัตฤกษ์) */}
            <div className="rounded-2xl border-2 border-[#FB7185] bg-[#FFF1F2] overflow-hidden shadow-2xs">
              <div className="bg-[#FFE4E6] border-b border-[#FDA4AF] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[#BE123C] px-2.5 py-0.5 text-xs font-extrabold text-white">
                    🏖️ {lang === 'th' ? 'วันเสาร์ · วันอาทิตย์ · วันหยุด' : 'Sat · Sun · Public Holidays'}
                  </span>
                  <span className="font-extrabold text-sm sm:text-base text-[#881337]">
                    {lang === 'th'
                      ? 'บทลงโทษสำหรับคนที่ตื่นสายในวันหยุด'
                      : 'Late Wake-Up Penalties on Weekends & Holidays'}
                  </span>
                </div>
                <span className="rounded-lg bg-white border border-[#FDA4AF] px-2.5 py-0.5 text-[11px] font-extrabold text-[#9F1239] tabular-nums">
                  {lang === 'th'
                    ? 'เสาร์ 08:15–08:35 น. (อนุโลมถึง 08:36 น.) · อาทิตย์ & นักขัตฤกษ์ ≤ 08:15 น. (อนุโลมถึง 08:25 น.)'
                    : 'Sat 08:15–08:35 (grace to 08:36) · Sun & Hol ≤ 08:15 (grace to 08:25)'}
                </span>
              </div>

              <div className="px-4 pt-3">
                <HolidayCheckInNoticeCard lang={lang} variant="rules" defaultExpanded />
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div
                  className={`rounded-xl border p-3.5 space-y-1.5 bg-white ${
                    weekendPreset === 'weekend_late_no_phone_no_711'
                      ? 'border-[#F43F5E] ring-2 ring-[#FFE4E6]'
                      : 'border-[#FBCFE8]'
                  }`}
                >
                  <div className="font-extrabold text-[#9F1239] flex items-center justify-between gap-2">
                    <span>
                      📵 {lang === 'th' ? 'แบบที่ 1 (กำลังใช้งานเป็นหลัก):' : 'Option 1 (Active Default):'}
                    </span>
                    {weekendPreset === 'weekend_late_no_phone_no_711' && (
                      <span className="rounded-md bg-[#BE123C] px-2 py-0.5 text-[10px] font-extrabold text-white">
                        {lang === 'th' ? 'ใช้งานอยู่' : 'ACTIVE'}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-[#3D322C]">
                    {lang === 'th'
                      ? '• เด็กโต/พี่ใหญ่: งดใช้โทรศัพท์ตั้งแต่เวลา 18:30–22:45 น. วันนี้'
                      : '• Older/Senior: No phone use from 18:30–22:45 today'}
                  </p>
                  <p className="font-bold text-[#92400E]">
                    {lang === 'th'
                      ? '• เด็กเล็ก: งดสั่งเซเว่นวันนี้ 1 วัน'
                      : '• Younger Kids: No 7-Eleven orders today'}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3.5 space-y-1.5 bg-white ${
                    weekendPreset === 'weekend_late_no_freeday_no_711'
                      ? 'border-[#F43F5E] ring-2 ring-[#FFE4E6]'
                      : 'border-[#FBCFE8]'
                  }`}
                >
                  <div className="font-extrabold text-[#9F1239] flex items-center justify-between gap-2">
                    <span>
                      🗓️ {lang === 'th' ? 'แบบที่ 2 (เลือกสลับได้ในหน้าพี่เลี้ยง):' : 'Option 2 (Selectable by Staff):'}
                    </span>
                    {weekendPreset === 'weekend_late_no_freeday_no_711' && (
                      <span className="rounded-md bg-[#BE123C] px-2 py-0.5 text-[10px] font-extrabold text-white">
                        {lang === 'th' ? 'ใช้งานอยู่' : 'ACTIVE'}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-[#3D322C]">
                    {lang === 'th'
                      ? '• เด็กโต/พี่ใหญ่: งดฟรีเดย์ 1 วัน'
                      : '• Older/Senior: Deduct 1 Friday Free Day'}
                  </p>
                  <p className="font-bold text-[#92400E]">
                    {lang === 'th'
                      ? '• เด็กเล็ก: งดสั่งเซเว่นวันนี้ 1 วัน'
                      : '• Younger Kids: No 7-Eleven orders today'}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-3.5 text-xs font-semibold text-[#881337]">
                ⏰{' '}
                {lang === 'th'
                  ? 'ทุกคนที่มีโทรศัพท์จะต้องตั้งปลุกก่อนเวลาเผื่อเดินมาเช็คอินด้วยนะเด็กๆ (แจ้งป่วย/ลาพัก ระบบยกเว้นโทษให้อัตโนมัติค่ะ)'
                  : 'Everyone with a phone must set an alarm ahead of time to walk over and check in! (Waived if sick or on leave.)'}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 🌇 SECTION 2: ช่วงเย็น (EVENING)                          */}
      {/* ======================================================== */}
      {showEvening && (
        <section className="rounded-[26px] border-2 border-[#F1A3B4] bg-white p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-[#FAD5DE]">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-[#7D1E37] flex items-center gap-2">
                <span>🌇</span>
                <span>{lang === 'th' ? 'ช่วงเย็น' : 'Evening Shift'}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                <span className="rounded-md bg-[#FEF3C7] border border-[#F59E0B] px-2 py-0.5 text-[#78350F]">
                  🐣 {lang === 'th' ? 'เด็กเล็ก 0 ครั้ง' : 'Younger 0'}
                </span>
                <span className="rounded-md bg-[#E0F2FE] border border-[#38BDF8] px-2 py-0.5 text-[#0C4A6E]">
                  🌟 {lang === 'th' ? 'เด็กโต 2 ครั้ง' : 'Older 2'}
                </span>
              </div>
            </div>
            <span className="rounded-xl border border-[#F1A3B4] bg-[#FFEBF0] px-3 py-1 text-xs font-extrabold text-[#7D1E37]">
              ⏰ {lang === 'th' ? 'หลังกลับจากโรงเรียน' : 'After School'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {/* 🐣 รุ่นเด็กเล็ก (สีเหลืองทอง) - ช่วงเย็น */}
            {showYounger && (
              <div className="rounded-2xl border-2 border-[#F59E0B] border-l-[8px] border-l-[#D97706] bg-[#FFFBEB] overflow-hidden shadow-2xs">
                <div className="bg-[#FDE68A]/85 border-b border-[#F59E0B] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#D97706] px-2.5 py-0.5 text-xs font-extrabold text-white">
                    🐣 {lang === 'th' ? 'รุ่นเด็กเล็ก' : 'Younger Kids'}
                  </span>
                  <span className="rounded-lg bg-white border border-[#D97706] px-2.5 py-0.5 text-[11px] font-extrabold text-[#78350F]">
                    {lang === 'th' ? 'กด 0 ครั้ง' : '0 Taps'}
                  </span>
                </div>
                <div className="p-4">
                  <p className="rounded-xl bg-white border border-[#FCD34D] p-3 text-xs sm:text-sm text-[#78350F] font-semibold">
                    {lang === 'th'
                      ? 'ไม่ต้องกดเช็คชื่อใดๆ ในช่วงเย็น (ทำภารกิจส่วนตัว อาบน้ำ ตาก-รีดชุดให้เรียบร้อย)'
                      : 'No check-in taps required in the evening.'}
                  </p>
                </div>
              </div>
            )}

            {/* 🌟 รุ่นเด็กโต (สีฟ้า) - ช่วงเย็น */}
            {showOlder && (
              <div className="rounded-2xl border-2 border-[#38BDF8] border-l-[8px] border-l-[#0284C7] bg-[#F0F9FF] overflow-hidden shadow-2xs">
                <div className="bg-[#BAE6FD]/80 border-b border-[#38BDF8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#0284C7] px-2.5 py-0.5 text-xs font-extrabold text-white">
                    🌟 {lang === 'th' ? 'รุ่นเด็กโต' : 'Older Kids'}
                  </span>
                  <span className="rounded-lg bg-white border border-[#0284C7] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0C4A6E]">
                    {lang === 'th' ? 'กด 2 ครั้ง' : '2 Taps'}
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="rounded-xl bg-white border border-[#7DD3FC] p-3.5 space-y-1.5">
                    <div className="font-extrabold text-[#0369A1]">
                      1. 🏠{' '}
                      {lang === 'th' ? 'ปุ่มกลับมาจากโรงเรียน' : 'Back From School Button'}
                    </div>
                    <p className="text-[#1E3A5F]">
                      {lang === 'th'
                        ? 'กดชื่อของตนเองได้เลย (ไม่ต้องใส่รหัสผ่าน) และนำมือถือเก็บคืนลงกล่องให้เรียบร้อย'
                        : 'Tap your name directly (no PIN needed) and place your phone into the box.'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white border border-[#7DD3FC] p-3.5 space-y-1.5">
                    <div className="font-extrabold text-[#0369A1]">
                      2. 📱{' '}
                      {lang === 'th' ? 'ปุ่มตรวจชุดรับมือถือ' : 'Uniform Check & Phone Pickup'}
                    </div>
                    <p className="text-[#1E3A5F]">
                      {lang === 'th'
                        ? 'กดยืนยันตัวตนด้วย รหัส PIN 4 หลัก ของตนเอง'
                        : 'Confirm identity using your own 4-digit PIN.'}
                    </p>
                    <div className="rounded-lg bg-[#E0F2FE] border border-[#38BDF8] px-2.5 py-1.5 text-xs font-bold text-[#0C4A6E]">
                      ✅{' '}
                      {lang === 'th'
                        ? 'เงื่อนไข: ต้องซักผ้า รีดชุด อาบน้ำ และให้พี่เลี้ยงตรวจชุดเรียบร้อยแล้วเท่านั้น'
                        : 'Condition: Must complete laundry, ironing, shower, and caregiver inspection.'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 🌙 SECTION 3: ช่วงค่ำ (NIGHT)                             */}
      {/* ======================================================== */}
      {showNight && (
        <section className="rounded-[26px] border-2 border-[#A7B9EB] bg-white p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-[#D7E0F7]">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-[#1E336B] flex items-center gap-2">
                <span>🌙</span>
                <span>{lang === 'th' ? 'ช่วงค่ำ' : 'Night Shift'}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                <span className="rounded-md bg-[#FEF3C7] border border-[#F59E0B] px-2 py-0.5 text-[#78350F]">
                  🐣 {lang === 'th' ? 'เด็กเล็ก 1 ครั้ง' : 'Younger 1'}
                </span>
                <span className="rounded-md bg-[#E0F2FE] border border-[#38BDF8] px-2 py-0.5 text-[#0C4A6E]">
                  🌟 {lang === 'th' ? 'เด็กโต 2 ครั้ง + 💻 ขอใช้คอมทำการบ้าน (เฉพาะเด็กโต)' : 'Older 2 + 💻 PC Homework'}
                </span>
              </div>
            </div>
            <span className="rounded-xl border border-[#A7B9EB] bg-[#E8EEFF] px-3 py-1 text-xs font-extrabold text-[#1E336B] tabular-nums">
              ⏰ 18:30 – {hwExtDeadlineEn} {lang === 'th' ? 'น.' : ''}
            </span>
          </div>

          <div className="space-y-3.5">
            {/* 🐣 รุ่นเด็กเล็ก (สีเหลืองทอง) - ช่วงค่ำ */}
            {showYounger && (
              <div className="rounded-2xl border-2 border-[#F59E0B] border-l-[8px] border-l-[#D97706] bg-[#FFFBEB] overflow-hidden shadow-2xs">
                <div className="bg-[#FDE68A]/85 border-b border-[#F59E0B] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#D97706] px-2.5 py-0.5 text-xs font-extrabold text-white">
                      🐣 {lang === 'th' ? 'รุ่นเด็กเล็ก' : 'Younger Kids'}
                    </span>
                    <span className="font-extrabold text-sm sm:text-base text-[#78350F]">
                      {lang === 'th' ? '(ปลดล็อกดูการ์ตูน)' : '(Unlock Cartoons)'}
                    </span>
                  </div>
                  <span className="rounded-lg bg-white border border-[#D97706] px-2.5 py-0.5 text-[11px] font-extrabold text-[#78350F] tabular-nums">
                    ⏰ 19:30 – 20:00 น. · {lang === 'th' ? 'กด 1 ครั้ง' : '1 Tap'}
                  </span>
                </div>
                <div className="p-4">
                  <div className="rounded-xl bg-white border border-[#FCD34D] p-3 text-xs sm:text-sm text-[#451A03] space-y-1">
                    <p>
                      <strong className="text-[#92400E]">
                        {lang === 'th' ? 'เวลาลงทะเบียน:' : 'Window:'}
                      </strong>{' '}
                      19:30 – 20:00 น.
                    </p>
                    <p>
                      <strong className="text-[#92400E]">
                        {lang === 'th' ? 'เงื่อนไข:' : 'Condition:'}
                      </strong>{' '}
                      {lang === 'th'
                        ? 'ต้องตากชุดนักเรียน รีดชุดนักเรียน และอาบน้ำให้เรียบร้อยก่อน'
                        : 'Must hang dry uniform, iron uniform, and shower beforehand.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 💻 ปุ่มขออนุญาตใช้คอมทำการบ้าน (เฉพาะรุ่นเด็กโต สีฟ้า-มิ้นต์) */}
            {showOlder && (
              <div className="rounded-2xl border-2 border-[#38BDF8] border-l-[8px] border-l-[#0284C7] bg-[#ECFDF5] overflow-hidden shadow-2xs">
                <div className="bg-[#BAE6FD]/80 border-b border-[#38BDF8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#0284C7] px-2.5 py-0.5 text-xs font-extrabold text-white">
                      🌟 {lang === 'th' ? 'เฉพาะรุ่นเด็กโต' : 'Older Kids Only'}
                    </span>
                    <span className="rounded-lg bg-[#059669] px-2.5 py-0.5 text-xs font-extrabold text-white">
                      💻 {lang === 'th' ? 'ขอใช้คอมทำการบ้าน' : 'Computer Homework'}
                    </span>
                    <span className="font-extrabold text-sm sm:text-base text-[#0C4A6E]">
                      {lang === 'th' ? '(อัปเดตใหม่)' : '(New)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-white border border-[#0284C7] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0C4A6E] tabular-nums">
                      ⏰ 18:30 – 20:00 น.
                    </span>
                    <span className="rounded-lg bg-[#FEF3C7] border border-[#F59E0B] px-2.5 py-0.5 text-[11px] font-extrabold text-[#78350F]">
                      +10 ⭐
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm text-[#064E3B]">
                    <div className="rounded-xl bg-white border border-[#6EE7B7] p-3 space-y-1">
                      <div className="font-extrabold text-[#047857]">
                        ⏰ {lang === 'th' ? 'ช่วงเวลากด & รางวัล' : 'Open Hours & Reward'}
                      </div>
                      <p>
                        {lang === 'th'
                          ? '• เปิดให้กดเฉพาะเวลา 18:30 – 20:00 น. (เรียงตามลำดับเวลาในเมนูคำสั่งให้อัตโนมัติ)'
                          : '• Open strictly 18:30 – 20:00 (auto-sorted chronologically in commands menu)'}
                      </p>
                      <p>
                        {lang === 'th' ? '• รางวัล: รับ +10 ดาว' : '• Reward: +10 Stars'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-[#6EE7B7] p-3 space-y-1">
                      <div className="font-extrabold text-[#047857]">
                        🔐 {lang === 'th' ? 'การยืนยันตัวตน' : 'Identity Confirmation'}
                      </div>
                      <p>
                        {lang === 'th'
                          ? 'เมื่อเงื่อนไขครบแล้ว น้องต้องกรอก รหัส PIN 4 หลัก ของตนเองด้วยตนเอง โดยกดได้ทั้งจาก ปุ่มคำสั่งหน้าแรก และใน หน้าส่วนตัวของน้อง'
                          : 'Once all 5 prerequisites are complete, enter your own 4-digit PIN (available on both Home Quick Commands and your Personal Hub).'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-[#6EE7B7] p-3 space-y-1.5 text-xs sm:text-sm">
                    <div className="font-extrabold text-[#047857]">
                      ✅{' '}
                      {lang === 'th'
                        ? 'เงื่อนไขก่อนกด (ระบบจะตรวจสอบความครบถ้วนทั้ง 5 ข้อก่อนเสมอ):'
                        : '5 Prerequisites Checked Automatically Before Approval:'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['1. ซักผ้า', '2. ตากผ้า', '3. รีดผ้า', '4. อาบน้ำ', '5. ตรวจชุด'].map(
                        (item) => (
                          <span
                            key={item}
                            className="rounded-lg border border-[#34D399] bg-[#ECFDF5] px-2.5 py-1 text-xs font-extrabold text-[#065F46]"
                          >
                            {item}
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-xs text-[#047857]">
                      {lang === 'th'
                        ? '(หากยังไม่ครบ ระบบจะแจ้งเตือนรายการที่ขาดให้ทราบทันที)'
                        : '(If any task is missing, the system notifies which items remain.)'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 🌟 รุ่นเด็กโต (สีฟ้า) - ช่วงค่ำ */}
            {showOlder && (
              <div className="rounded-2xl border-2 border-[#38BDF8] border-l-[8px] border-l-[#0284C7] bg-[#F0F9FF] overflow-hidden shadow-2xs">
                <div className="bg-[#BAE6FD]/80 border-b border-[#38BDF8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#0284C7] px-2.5 py-0.5 text-xs font-extrabold text-white">
                      🌟 {lang === 'th' ? 'รุ่นเด็กโต' : 'Older Kids'}
                    </span>
                    <span className="font-extrabold text-sm sm:text-base text-[#0C4A6E]">
                      {lang === 'th'
                        ? '(การใช้มือถือและทำการบ้าน)'
                        : '(Phone Return & Homework)'}
                    </span>
                  </div>
                  <span className="rounded-lg bg-white border border-[#0284C7] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0C4A6E]">
                    {lang === 'th' ? 'กด 2 ครั้ง' : '2 Taps'}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="rounded-xl bg-white border border-[#7DD3FC] p-3.5 space-y-1.5">
                      <div className="font-extrabold text-[#0369A1] flex items-center justify-between gap-2">
                        <span>
                          📱{' '}
                          {lang === 'th'
                            ? 'กรณีทั่วไป (ไม่ได้ขอทำการบ้าน)'
                            : 'General Case (No Homework)'}
                        </span>
                        <span className="rounded-md bg-[#E0F2FE] border border-[#38BDF8] px-2 py-0.5 text-[11px] font-extrabold text-[#0C4A6E] tabular-nums">
                          ⏰ {noHwDeadlineEn} น.
                        </span>
                      </div>
                      <p className="text-[#1E3A5F]">
                        {lang === 'th'
                          ? `• สามารถนำมือถือไปเล่นในห้องได้ถึงเวลา ${noHwDeadlineTh}`
                          : `• Can use phone until ${noHwDeadlineEn}`}
                      </p>
                      <p className="text-[#BE123C] font-bold">
                        {lang === 'th'
                          ? `• ต้องกดคืนมือถือและเก็บเข้ากล่องก่อน ${noHwDeadlineTh} (หากคืนเกินเวลา ระบบจะหัก Free Day ทันที และไม่อนุญาตให้ใช้มือถือต่อ)`
                          : `• Must press Return Phone and place in box before ${noHwDeadlineEn} (late return deducts Free Day immediately).`}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-[#7DD3FC] p-3.5 space-y-1.5">
                      <div className="font-extrabold text-[#0369A1] flex items-center justify-between gap-2">
                        <span>
                          📝{' '}
                          {lang === 'th'
                            ? 'กรณีขออนุญาตทำการบ้าน'
                            : 'Homework Permission Case'}
                        </span>
                        <span className="rounded-md bg-[#E0F2FE] border border-[#38BDF8] px-2 py-0.5 text-[11px] font-extrabold text-[#0C4A6E] tabular-nums">
                          ⏰ {hwExtDeadlineEn} น.
                        </span>
                      </div>
                      <p className="text-[#1E3A5F]">
                        {lang === 'th'
                          ? `• กดปุ่ม "📝 ขออนุญาตทำการบ้าน" ได้ในช่วงเวลา ${hwPermWin.labelTh} (ระบบจะล็อกทันทีหลัง ${hwReqEndEn} น.)`
                          : `• Tap "Request Homework" during ${hwReqStartEn} – ${hwReqEndEn} (locks right after ${hwReqEndEn}).`}
                      </p>
                      <p className="text-[#BE123C] font-bold">
                        {lang === 'th'
                          ? `• ผู้ที่ลงทะเบียนไว้สามารถใช้มือถือได้ถึงเวลา ${hwExtDeadlineTh} (หากคืนช้ากว่ากำหนด ระบบจะหัก Free Day ทันที)`
                          : `• Registered kids may use phone until ${hwExtDeadlineEn} (late return deducts Free Day immediately).`}
                      </p>
                    </div>
                  </div>

                  {/* ข้อห้ามสำคัญ & กรณีชาร์จแบต */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="rounded-xl border-2 border-[#FB7185] bg-[#FFF1F2] p-3.5 space-y-1 text-[#881337]">
                      <div className="font-extrabold">
                        🚫{' '}
                        {lang === 'th'
                          ? 'ข้อห้ามสำคัญ (กรณีลงทะเบียนทำการบ้าน)'
                          : 'Strict Prohibition'}
                      </div>
                      <p className="font-semibold">
                        {lang === 'th'
                          ? 'เมื่อลงทะเบียนทำการบ้านแล้ว ห้าม นำมือถือเข้าไปใช้ในห้องนอน รวมถึงห้ามถือเดินไปเข้าห้องน้ำ โรงซักผ้า หรือบริเวณอื่นๆ เด็ดขาด'
                          : 'Once registered for homework, NEVER take your phone into bedrooms, bathrooms, the laundry room, or other areas.'}
                      </p>
                    </div>

                    <div className="rounded-xl border-2 border-[#FBBF24] bg-[#FFFBEB] p-3.5 space-y-1 text-[#78350F]">
                      <div className="font-extrabold">
                        🔋{' '}
                        {lang === 'th'
                          ? 'กรณีชาร์จแบตมือถือค้างไว้'
                          : 'If Phone Is Still Charging'}
                      </div>
                      <p className="font-semibold">
                        {lang === 'th'
                          ? 'รบกวนกดปุ่มคืนมือถือในระบบให้เรียบร้อยก่อนเข้านอน แล้วฝากเพื่อนหรือพี่เลี้ยงช่วยนำเก็บเข้ากล่องให้ด้วยนะคะ'
                          : 'Please press Return Phone in the system before bedtime and ask a friend or caregiver to put it into the box.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
