import React, { useMemo, useState } from 'react';
import { AppMode, Language } from '../types/barnhem';
import { formatDigitalClock } from '../utils/timeRules';

type GuideAudienceFilter = 'all' | 'kids' | 'guides_records';

interface ShortcutManualViewProps {
  orgName?: string;
  now: Date;
  lang: Language;
  onNavigateMode: (
    targetMode: Extract<
      AppMode,
      | 'activity_log'
      | 'star_summary'
      | 'duty_roster'
      | 'secret_vote'
      | 'supply_request'
      | 'lost_found'
      | 'house_rules_guide'
      | 'staff_system_guide'
    >
  ) => void;
  onBackHome: () => void;
}

interface ShortcutPinEntry {
  pin: string;
  emoji: string;
  titleTh: string;
  titleEn: string;
  summaryTh: string;
  summaryEn: string;
  audience: 'kids' | 'guides_records';
  targetMode:
    | Extract<
        AppMode,
        | 'activity_log'
        | 'star_summary'
        | 'duty_roster'
        | 'secret_vote'
        | 'supply_request'
        | 'lost_found'
        | 'house_rules_guide'
        | 'staff_system_guide'
      >
    | null;
  rowCls: string;
  badgeCls: string;
  btnCls: string;
}

const SHORTCUT_ENTRIES: ShortcutPinEntry[] = [
  {
    pin: '0001',
    emoji: '📋',
    titleTh: 'ประวัติบันทึกการทำรายการของเด็ก',
    titleEn: 'Kid Activity History',
    summaryTh: 'ดูประวัติการเช็คชื่อ รับดาว หักดาว ย้อนหลัง',
    summaryEn: 'Check-in & star history logs',
    audience: 'guides_records',
    targetMode: 'activity_log',
    rowCls: 'border-[#BFDBFE] border-l-[#2563EB] bg-[#F8FAFF]',
    badgeCls: 'bg-[#2563EB] text-white',
    btnCls: 'bg-[#DBEAFE] hover:bg-[#BFDBFE] border-[#93C5FD] text-[#1E3A8A]',
  },
  {
    pin: '0002',
    emoji: '⭐',
    titleTh: 'เช็คยอดดาวของเด็กๆ ทั้งหมด',
    titleEn: 'All Kids Star Balances',
    summaryTh: 'ดูยอดดาวสะสมทุกคนแยกตามรุ่น + ส่ง LINE',
    summaryEn: 'Star balances by group + LINE export',
    audience: 'kids',
    targetMode: 'star_summary',
    rowCls: 'border-[#FDE68A] border-l-[#D97706] bg-[#FFFDF5]',
    badgeCls: 'bg-[#D97706] text-white',
    btnCls: 'bg-[#FEF3C7] hover:bg-[#FDE68A] border-[#F59E0B] text-[#78350F]',
  },
  {
    pin: '0003',
    emoji: '📅',
    titleTh: 'เช็คตารางเวรเด็กทั้งหมด',
    titleEn: 'All Kids Duty Roster',
    summaryTh: 'เวรรายวัน · วันหยุด 14 โซน · ครัว · ทิ้งขยะ พ./อา.',
    summaryEn: 'Daily chores, 14 zones, kitchen & Wed/Sun trash',
    audience: 'kids',
    targetMode: 'duty_roster',
    rowCls: 'border-[#A7F3D0] border-l-[#059669] bg-[#F4FCF9]',
    badgeCls: 'bg-[#059669] text-white',
    btnCls: 'bg-[#D1FAE5] hover:bg-[#A7F3D0] border-[#34D399] text-[#064E3B]',
  },
  {
    pin: '0004',
    emoji: '🗳️',
    titleTh: 'โหวตลับ',
    titleEn: 'Secret Polls',
    summaryTh: 'ลงคะแนนโหวตกิจกรรมของบ้านแบบลับ (ใช้ PIN น้อง)',
    summaryEn: 'Confidential polls with kid PIN',
    audience: 'kids',
    targetMode: 'secret_vote',
    rowCls: 'border-[#DDD6FE] border-l-[#7C3AED] bg-[#FAF8FF]',
    badgeCls: 'bg-[#7C3AED] text-white',
    btnCls: 'bg-[#EDE9FE] hover:bg-[#DDD6FE] border-[#A78BFA] text-[#4C1D95]',
  },
  {
    pin: '0005',
    emoji: '📦',
    titleTh: 'ขอเบิกของใช้',
    titleEn: 'Supply Requests',
    summaryTh: 'ส่งคำขอเบิกของใช้ส่วนตัว & ดูสถานะรับของ',
    summaryEn: 'Request supplies & track pickup',
    audience: 'kids',
    targetMode: 'supply_request',
    rowCls: 'border-[#FED7AA] border-l-[#EA580C] bg-[#FFF9F5]',
    badgeCls: 'bg-[#EA580C] text-white',
    btnCls: 'bg-[#FFEDD5] hover:bg-[#FED7AA] border-[#FB923C] text-[#7C2D12]',
  },
  {
    pin: '0006',
    emoji: '🔎',
    titleTh: 'แจ้งของหาย / แจ้งพบเจอของเก็บได้',
    titleEn: 'Lost & Found Board',
    summaryTh: 'โพสต์แจ้งของหาย ของเก็บได้ และยืนยันรับคืน',
    summaryEn: 'Report lost/found items & claim',
    audience: 'kids',
    targetMode: 'lost_found',
    rowCls: 'border-[#FBCFE8] border-l-[#DB2777] bg-[#FFF7FA]',
    badgeCls: 'bg-[#DB2777] text-white',
    btnCls: 'bg-[#FCE7F3] hover:bg-[#FBCFE8] border-[#F472B6] text-[#831843]',
  },
  {
    pin: '0007',
    emoji: '📜',
    titleTh: 'ข้อตกลงและขั้นตอนการกดระบบประจำวัน',
    titleEn: 'House Rules & Check-In Guide',
    summaryTh: 'กติกาน้องแยกสีตามรุ่น ช่วงเช้า–เย็น–ค่ำ + ขอใช้คอม',
    summaryEn: 'Color-coded kid rules by shift & PC homework',
    audience: 'guides_records',
    targetMode: 'house_rules_guide',
    rowCls: 'border-[#C4B5FD] border-l-[#6D28D9] bg-[#F8F6FF]',
    badgeCls: 'bg-[#6D28D9] text-white',
    btnCls: 'bg-[#EDE9FE] hover:bg-[#DDD6FE] border-[#A78BFA] text-[#4C1D95]',
  },
  {
    pin: '0008',
    emoji: '✨',
    titleTh: 'รหัส 0008 (ยังไม่ได้กำหนดหัวข้อใช้งาน)',
    titleEn: 'PIN 0008 (Unassigned)',
    summaryTh: 'ยังไม่มีหัวข้อย่อยในรหัสนี้',
    summaryEn: 'No topic assigned yet',
    audience: 'guides_records',
    targetMode: null,
    rowCls: 'border-[#E7E5E4] border-l-[#78716C] bg-[#FAFAF9]',
    badgeCls: 'bg-[#78716C] text-white',
    btnCls: 'bg-[#F5F5F4] border-[#D6D3D1] text-[#78716C]',
  },
  {
    pin: '0009',
    emoji: '📋',
    titleTh: 'ตารางสรุปการทำงานของพี่เลี้ยงและระบบ',
    titleEn: 'Staff & System Summary Table',
    summaryTh: 'คนเข้าเช้า · ไนท์วอชเตรียมเก็บมือถือ · วิธีน้องกดระบบ',
    summaryEn: 'Morning Shift, Night Watch & phone prep table',
    audience: 'guides_records',
    targetMode: 'staff_system_guide',
    rowCls: 'border-[#BAE6FD] border-l-[#0284C7] bg-[#F4FAFF]',
    badgeCls: 'bg-[#0284C7] text-white',
    btnCls: 'bg-[#E0F2FE] hover:bg-[#BAE6FD] border-[#38BDF8] text-[#0C4A6E]',
  },
];

export const ShortcutManualView: React.FC<ShortcutManualViewProps> = ({
  orgName = 'Barnhem Care & Kids',
  now,
  lang,
  onNavigateMode,
  onBackHome,
}) => {
  const [filter, setFilter] = useState<GuideAudienceFilter>('all');
  const [search, setSearch] = useState('');

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SHORTCUT_ENTRIES.filter((entry) => {
      if (filter !== 'all' && entry.audience !== filter) return false;
      if (!q) return true;
      return (
        entry.pin.includes(q) ||
        entry.titleTh.toLowerCase().includes(q) ||
        entry.titleEn.toLowerCase().includes(q) ||
        entry.summaryTh.toLowerCase().includes(q) ||
        entry.summaryEn.toLowerCase().includes(q)
      );
    });
  }, [filter, search]);

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* Compact Header Card */}
      <section className="rounded-2xl border-2 border-[#A7D3EC] bg-[#FFFDF9] p-3.5 sm:p-4 pastel-shadow space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
              <span className="rounded-lg border border-[#A7D3EC] bg-[#EDF6FF] px-2 py-0.5 text-[#1D4D73]">
                🔑 PIN 0000
              </span>
              <span className="rounded-lg border border-[#C9E7E0] bg-[#EEFBF8] px-2 py-0.5 text-[#114A42] tabular-nums">
                🕒 {formatDigitalClock(now)} {lang === 'th' ? 'น.' : ''}
              </span>
              <span className="text-[#7B695F] font-semibold truncate">{orgName}</span>
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-[#3D322C] mt-1">
              📖{' '}
              {lang === 'th'
                ? 'คู่มือรหัสลัด 0001–0009 (พิมพ์รหัสหน้าแรก หรือกดเปิดได้เลย)'
                : 'Shortcut PIN Directory 0001–0009'}
            </h1>
          </div>

          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[34px] rounded-xl border border-[#EBD8C3] bg-white hover:bg-[#FAF5EF] text-[#3D322C] px-3 py-1 text-xs font-extrabold cursor-pointer shrink-0"
          >
            ← {lang === 'th' ? 'กลับหน้าหลัก' : 'Back'}
          </button>
        </div>

        {/* Compact Filter + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#EFE6DC]">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all' as const, labelTh: 'ทั้งหมด', labelEn: 'All' },
              { id: 'kids' as const, labelTh: '🧒 น้อง & ส่วนรวม', labelEn: '🧒 Kids & Shared' },
              {
                id: 'guides_records' as const,
                labelTh: '📖 คู่มือ & ประวัติ',
                labelEn: '📖 Guides & Logs',
              },
            ].map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold cursor-pointer transition-colors ${
                    active
                      ? 'border-[#3D322C] bg-[#3D322C] text-white'
                      : 'border-[#E6DDD3] bg-[#FAF8F5] hover:bg-[#EFE9E1] text-[#5E4E45]'
                  }`}
                >
                  {lang === 'th' ? tab.labelTh : tab.labelEn}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'th' ? '🔍 ค้นหารหัส / หัวข้อ...' : '🔍 Search PIN...'}
            className="w-full sm:w-52 rounded-lg border border-[#DED4C8] bg-white px-2.5 py-1 text-xs font-semibold text-[#3D322C] placeholder:text-[#9B897E] focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
          />
        </div>
      </section>

      {/* Compact Long Horizontal Rows (0001 - 0009) */}
      <div className="space-y-1.5">
        {filteredEntries.map((item) => (
          <div
            key={item.pin}
            className={`rounded-xl border border-l-[6px] ${item.rowCls} px-3 py-2 flex items-center justify-between gap-2.5 shadow-2xs`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold tabular-nums shrink-0 ${item.badgeCls}`}
              >
                {item.pin}
              </span>
              <span className="text-base shrink-0">{item.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-extrabold text-[#3D322C] truncate">
                  {lang === 'th' ? item.titleTh : item.titleEn}
                </div>
                <div className="text-[11px] text-[#6E5C52] truncate">
                  {lang === 'th' ? item.summaryTh : item.summaryEn}
                </div>
              </div>
            </div>

            {item.targetMode ? (
              <button
                type="button"
                onClick={() => onNavigateMode(item.targetMode!)}
                className={`min-h-[30px] rounded-lg border px-2.5 py-1 text-[11px] font-extrabold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${item.btnCls}`}
              >
                {lang === 'th' ? 'เปิดดู →' : 'Open →'}
              </button>
            ) : (
              <span className="min-h-[30px] inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 opacity-75 bg-[#F5F5F4] border-[#D6D3D1] text-[#78716C]">
                {lang === 'th' ? 'ว่างอยู่' : 'Empty'}
              </span>
            )}
          </div>
        ))}
      </div>

      {filteredEntries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#DFD5CA] bg-white p-5 text-center text-xs font-bold text-[#7B695F]">
          {lang === 'th' ? 'ไม่พบหัวข้อที่ค้นหาค่ะ' : 'No matching shortcut PIN found.'}
        </div>
      )}
    </div>
  );
};
