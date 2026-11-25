import React, { useMemo, useState } from 'react';
import {
  KidGroup,
  Language,
  Member,
  ModalAlertPayload,
  WeeklyActivityLog,
  WeeklyActivityStatus,
} from '../types/barnhem';
import {
  ACTIVITY_LOG_RETENTION_DAYS,
  getRemainingRetentionDays,
  pruneWeeklyActivityLogs,
} from '../utils/activityLogRetention';
import { getDateKey } from '../utils/timeRules';

interface KidActivityHistoryViewProps {
  orgName: string;
  kids: Member[];
  logs: WeeklyActivityLog[];
  now: Date;
  lang: Language;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onBackHome: () => void;
}

const STATUS_META: Record<
  WeeklyActivityStatus,
  { th: string; en: string; emoji: string; badgeClass: string }
> = {
  on_time: {
    th: 'ตรงเวลา / ทำรายการ',
    en: 'On Time / Action',
    emoji: '✅',
    badgeClass: 'bg-[#E8FAF6] text-[#114A42] border-[#8FD4C6]',
  },
  late: {
    th: 'มาสาย / เกินเวลา',
    en: 'Late',
    emoji: '⏰',
    badgeClass: 'bg-[#FFF5CC] text-[#8A5A10] border-[#F2DA84]',
  },
  absent: {
    th: 'ขาด',
    en: 'Absent',
    emoji: '❌',
    badgeClass: 'bg-[#FFE8ED] text-[#8B1D36] border-[#F3B7C0]',
  },
  sick_leave: {
    th: 'ลา / ป่วย',
    en: 'Sick / Leave',
    emoji: '🏥',
    badgeClass: 'bg-[#DCEEF8] text-[#1E445C] border-[#A7D3EC]',
  },
  other: {
    th: 'บันทึกทั่วไป',
    en: 'Activity',
    emoji: '📝',
    badgeClass: 'bg-[#F6EFE6] text-[#4F433C] border-[#DFD2C3]',
  },
};

const GROUP_LABELS: Record<KidGroup, { th: string; en: string }> = {
  1: { th: 'กลุ่ม 1 (ประถม)', en: 'Group 1 (Primary)' },
  2: { th: 'กลุ่ม 2 (มัธยม)', en: 'Group 2 (Secondary)' },
  3: { th: 'กลุ่ม 3 (วิทยาลัย/ฝึกงาน)', en: 'Group 3 (College)' },
};

export const KidActivityHistoryView: React.FC<KidActivityHistoryViewProps> = ({
  orgName,
  kids,
  logs,
  now,
  lang,
  onShowAlert,
  onBackHome,
}) => {
  const activeLogs = useMemo(() => pruneWeeklyActivityLogs(logs, now), [logs, now]);
  const todayKey = getDateKey(now);

  const rollingDays = useMemo(() => {
    const list: Array<{
      dateKey: string;
      shortLabel: string;
      fullLabel: string;
      relLabelTh: string;
      relLabelEn: string;
      count: number;
    }> = [];
    for (let offset = 0; offset < ACTIVITY_LOG_RETENTION_DAYS; offset += 1) {
      const d = new Date(now);
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - offset);
      const dk = getDateKey(d);
      const count = activeLogs.filter((l) => l.dateKey === dk).length;
      const shortLabel = d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
        day: 'numeric',
        month: 'short',
      });
      const fullLabel = d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      list.push({
        dateKey: dk,
        shortLabel,
        fullLabel,
        relLabelTh:
          offset === 0 ? 'วันนี้' : offset === 1 ? 'เมื่อวาน' : `${offset} วันก่อน`,
        relLabelEn:
          offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : `${offset}d ago`,
        count,
      });
    }
    return list;
  }, [activeLogs, lang, now]);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [viewMode, setViewMode] = useState<'timeline' | 'by_kid'>('timeline');
  const [groupFilter, setGroupFilter] = useState<0 | KidGroup>(0);
  const [kidFilter, setKidFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | WeeklyActivityStatus>('all');
  const [search, setSearch] = useState('');
  const [copiedJustNow, setCopiedJustNow] = useState(false);

  const effectiveSelectedDateKey =
    selectedDateKey === 'ALL_7D' || rollingDays.some((d) => d.dateKey === selectedDateKey)
      ? selectedDateKey
      : todayKey;

  const selectedDayMeta = rollingDays.find((d) => d.dateKey === effectiveSelectedDateKey);

  const dayScopedLogs = useMemo(() => {
    if (effectiveSelectedDateKey === 'ALL_7D') return activeLogs;
    return activeLogs.filter((l) => l.dateKey === effectiveSelectedDateKey);
  }, [activeLogs, effectiveSelectedDateKey]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dayScopedLogs.filter((l) => {
      if (groupFilter !== 0 && l.kidGroup !== groupFilter) return false;
      if (kidFilter !== 'all' && l.kidId !== kidFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.kidNickname.toLowerCase().includes(q) ||
        l.actionLabel.toLowerCase().includes(q) ||
        l.recordedBy.toLowerCase().includes(q) ||
        (l.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [dayScopedLogs, groupFilter, kidFilter, statusFilter, search]);

  const filteredKids = useMemo(() => {
    const q = search.trim().toLowerCase();
    return kids.filter((k) => {
      if (groupFilter !== 0 && k.group !== groupFilter) return false;
      if (kidFilter !== 'all' && k.id !== kidFilter) return false;
      if (!q) return true;
      const hasMatchingLog = filteredLogs.some((l) => l.kidId === k.id);
      return (
        hasMatchingLog ||
        k.nickname.toLowerCase().includes(q) ||
        k.fullName.toLowerCase().includes(q)
      );
    });
  }, [kids, groupFilter, kidFilter, search, filteredLogs]);

  const logsByKidMap = useMemo(() => {
    const map = new Map<string, WeeklyActivityLog[]>();
    for (const log of filteredLogs) {
      const list = map.get(log.kidId) ?? [];
      list.push(log);
      map.set(log.kidId, list);
    }
    return map;
  }, [filteredLogs]);

  const dayStats = useMemo(() => {
    const activeKidIds = new Set(dayScopedLogs.map((l) => l.kidId));
    return {
      total: dayScopedLogs.length,
      activeKids: activeKidIds.size,
      onTime: dayScopedLogs.filter((l) => l.status === 'on_time').length,
      late: dayScopedLogs.filter((l) => l.status === 'late').length,
      absentOrLeave: dayScopedLogs.filter(
        (l) => l.status === 'absent' || l.status === 'sick_leave'
      ).length,
    };
  }, [dayScopedLogs]);

  const dailySummaryText = useMemo(() => {
    const headingDate =
      effectiveSelectedDateKey === 'ALL_7D'
        ? 'ย้อนหลัง 7 วันล่าสุด'
        : selectedDayMeta?.fullLabel ?? effectiveSelectedDateKey;
    const lines = [
      `📋 ประวัติบันทึกการทำรายการของเด็ก (${orgName})`,
      `📅 ${headingDate}`,
      `📊 ทั้งหมด ${dayStats.total} รายการ · น้องที่ทำรายการ ${dayStats.activeKids}/${kids.length} คน`,
      `✅ ปกติ/ตรงเวลา: ${dayStats.onTime} | ⏰ สาย: ${dayStats.late} | ❌/🏥 ขาด/ลา/ป่วย: ${dayStats.absentOrLeave}`,
      '',
    ];
    for (const log of filteredLogs.slice(0, 35)) {
      lines.push(
        `- [${log.timeText}] ${log.kidEmoji} ${log.kidNickname}: ${log.actionLabel}${
          log.note ? ` (${log.note})` : ''
        }`
      );
    }
    if (filteredLogs.length === 0) {
      lines.push('ยังไม่มีรายการบันทึกในช่วงเวลานี้ค่ะ');
    }
    return lines.join('\n').slice(0, 1800);
  }, [
    dayStats,
    effectiveSelectedDateKey,
    filteredLogs,
    kids.length,
    orgName,
    selectedDayMeta,
  ]);

  const handleCopySummary = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(dailySummaryText);
      }
      setCopiedJustNow(true);
      window.setTimeout(() => setCopiedJustNow(false), 2500);
      onShowAlert({
        icon: '💚',
        title: lang === 'th' ? 'คัดลอกสรุปแล้ว!' : 'Summary Copied!',
        message:
          lang === 'th'
            ? 'สามารถนำไปวางใน LINE หรือบันทึกข้อความได้ทันทีค่ะ'
            : 'Ready to paste into LINE or notes.',
        tone: 'mint',
      });
    } catch {
      onShowAlert({
        icon: '📋',
        title: lang === 'th' ? 'สรุปรายการประจำวัน' : 'Daily Activity Summary',
        message: dailySummaryText,
        tone: 'blue',
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header Card */}
      <section className="rounded-[28px] border-2 border-[#B9E8DF] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#8FD4C6] bg-[#E8FAF6] px-3 py-1 text-xs font-extrabold text-[#114A42]">
              <span>🔑 PIN 0001</span>
              <span>·</span>
              <span>
                {lang === 'th'
                  ? 'เก็บข้อมูลอัตโนมัติ 7 วัน (1 อาทิตย์) แล้วลบอัตโนมัติ'
                  : 'Auto-retained for 7 days, then auto-deleted'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
              📋{' '}
              {lang === 'th'
                ? 'ประวัติบันทึกการทำรายการของเด็ก ตลอด 1 วัน'
                : 'Kid Full-Day Transaction & Activity Log'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5C52]">
              {lang === 'th'
                ? 'ดูทุกรายการเช็คชื่อ ปุ่มด่วน เข้า-ออกโรงเรียน การบ้าน ทิ้งขยะ แจ้งป่วย และกิจกรรมของเด็กตลอดทั้งวัน ข้อมูลเก่าเกิน 1 อาทิตย์จะถูกลบอัตโนมัติค่ะ'
                : 'View all kid check-ins, quick actions, trash duty, school logs, and reports for a full day. Entries older than 7 days are automatically purged.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://line.me/R/share?text=${encodeURIComponent(dailySummaryText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-2xl bg-[#06C755] hover:bg-[#05B24C] text-white px-4 py-2 text-xs font-extrabold shadow-xs"
            >
              <span>💚</span>
              <span>{lang === 'th' ? 'ส่งสรุปเข้า LINE' : 'Send to LINE'}</span>
            </a>

            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="min-h-[40px] rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] hover:bg-[#D5F4EE] text-[#114A42] px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              {copiedJustNow
                ? lang === 'th'
                  ? '✅ คัดลอกแล้ว'
                  : '✅ Copied'
                : lang === 'th'
                ? '📋 คัดลอกรายงาน'
                : '📋 Copy Report'}
            </button>

            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[40px] rounded-2xl border border-[#EBD8C3] bg-white hover:bg-[#FAF5EF] text-[#3D322C] px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              ← {lang === 'th' ? 'ออก / กลับหน้าแรก' : 'Exit to Home'}
            </button>
          </div>
        </div>

        {/* 7-Day Rolling Date Picker */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#5E4E45]">
              🗓️{' '}
              {lang === 'th'
                ? 'เลือกดูรายวัน (ย้อนหลัง 1 อาทิตย์ / ลบอัตโนมัติเมื่อครบ 7 วัน):'
                : 'Select 1-Day Window (7-Day Auto-Retention):'}
            </span>
            <span className="text-[11px] font-semibold text-[#7B695F] tabular-nums">
              {lang === 'th'
                ? `กำลังเก็บในระบบ ${activeLogs.length} รายการ (รอบ 7 วันล่าสุด)`
                : `${activeLogs.length} entries currently retained (last 7 days)`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {rollingDays.map((day) => {
              const active = effectiveSelectedDateKey === day.dateKey;
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  className={`rounded-2xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[#5FC2B0] bg-[#E3F8F3] text-[#114A42] shadow-2xs'
                      : 'border-[#EFE6DC] bg-white hover:bg-[#FFF8F1] text-[#3D322C]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold">
                      {lang === 'th' ? day.relLabelTh : day.relLabelEn}
                    </span>
                    <span
                      className={`rounded-lg px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                        active
                          ? 'bg-white text-[#114A42]'
                          : day.count > 0
                          ? 'bg-[#FFF3DB] text-[#8A5A10]'
                          : 'bg-[#F5F0EA] text-[#8B796E]'
                      }`}
                    >
                      {day.count}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold opacity-80 truncate mt-0.5 tabular-nums">
                    {day.shortLabel}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedDateKey('ALL_7D')}
              className={`rounded-2xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                effectiveSelectedDateKey === 'ALL_7D'
                  ? 'border-[#5FC2B0] bg-[#E3F8F3] text-[#114A42] shadow-2xs'
                  : 'border-[#EFE6DC] bg-[#FAF6F1] hover:bg-[#FFF8F1] text-[#3D322C]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold">
                  {lang === 'th' ? 'รวม 7 วัน' : 'All 7 Days'}
                </span>
                <span className="rounded-lg bg-white px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-[#3D322C]">
                  {activeLogs.length}
                </span>
              </div>
              <div className="text-[11px] font-semibold opacity-80 truncate mt-0.5">
                {lang === 'th' ? 'ทั้งสัปดาห์' : 'Full Week'}
              </div>
            </button>
          </div>
        </div>

        {/* Selected Day Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-[#EBD8C3] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold text-[#7B695F]">
              {effectiveSelectedDateKey === 'ALL_7D'
                ? lang === 'th'
                  ? 'รายการทั้งหมด (7 วัน)'
                  : 'Total Logs (7 Days)'
                : lang === 'th'
                ? `รายการของ ${selectedDayMeta?.relLabelTh ?? effectiveSelectedDateKey}`
                : `Logs (${selectedDayMeta?.relLabelEn ?? effectiveSelectedDateKey})`}
            </div>
            <div className="text-2xl font-extrabold text-[#3D322C] tabular-nums mt-0.5">
              {dayStats.total}
            </div>
          </div>

          <div className="rounded-2xl border border-[#A7D3EC] bg-[#EEF7FC] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#1E445C]">
              👧👦 {lang === 'th' ? 'เด็กที่มีบันทึก' : 'Active Kids'}
            </div>
            <div className="text-2xl font-extrabold text-[#1E445C] tabular-nums mt-0.5">
              {dayStats.activeKids}/{kids.length}
            </div>
          </div>

          <div className="rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#114A42]">
              ✅ {lang === 'th' ? 'ทำรายการ / ตรงเวลา' : 'On Time / Actions'}
            </div>
            <div className="text-2xl font-extrabold text-[#114A42] tabular-nums mt-0.5">
              {dayStats.onTime}
            </div>
          </div>

          <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFF0F3] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#8B1D36]">
              ⏰/❌ {lang === 'th' ? 'สาย / ขาด / ลา-ป่วย' : 'Late / Absent / Leave'}
            </div>
            <div className="text-2xl font-extrabold text-[#8B1D36] tabular-nums mt-0.5">
              {dayStats.late + dayStats.absentOrLeave}
            </div>
          </div>
        </div>
      </section>

      {/* Filter & View Switcher Bar */}
      <section className="rounded-[28px] border-2 border-[#EBD8C3] bg-white p-4 sm:p-5 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#F6EFE6] border border-[#EBD8C3]">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white text-[#3D322C] shadow-2xs'
                  : 'text-[#6E5C52] hover:text-[#3D322C]'
              }`}
            >
              🕒 {lang === 'th' ? 'เรียงตามเวลาตลอด 1 วัน' : 'Timeline'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_kid')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-colors ${
                viewMode === 'by_kid'
                  ? 'bg-white text-[#3D322C] shadow-2xs'
                  : 'text-[#6E5C52] hover:text-[#3D322C]'
              }`}
            >
              👧👦 {lang === 'th' ? 'สรุปรายชื่อเด็กทุกคน' : 'Grouped by Kid'}
            </button>
          </div>

          {/* Search & Kid Selector */}
          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(Number(e.target.value) as 0 | KidGroup);
                setKidFilter('all');
              }}
              className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-2 text-xs font-bold text-[#3D322C]"
            >
              <option value={0}>{lang === 'th' ? 'ทุกกลุ่มอายุ' : 'All Groups'}</option>
              <option value={1}>{lang === 'th' ? GROUP_LABELS[1].th : GROUP_LABELS[1].en}</option>
              <option value={2}>{lang === 'th' ? GROUP_LABELS[2].th : GROUP_LABELS[2].en}</option>
              <option value={3}>{lang === 'th' ? GROUP_LABELS[3].th : GROUP_LABELS[3].en}</option>
            </select>

            <select
              value={kidFilter}
              onChange={(e) => setKidFilter(e.target.value)}
              className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-2 text-xs font-bold text-[#3D322C]"
            >
              <option value="all">{lang === 'th' ? 'น้องทุกคน' : 'All Kids'}</option>
              {kids
                .filter((k) => groupFilter === 0 || k.group === groupFilter)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.emoji} {k.nickname}
                  </option>
                ))}
            </select>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                lang === 'th' ? '🔍 ค้นหาชื่อน้อง / รายการ...' : '🔍 Search kid / action...'
              }
              className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] px-3.5 py-2 text-xs text-[#3D322C] w-full sm:w-52"
            />
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', th: 'ทั้งหมด', en: 'All' },
              { id: 'on_time', th: '✅ ทำรายการ / ตรงเวลา', en: '✅ On Time' },
              { id: 'late', th: '⏰ มาสาย', en: '⏰ Late' },
              { id: 'absent', th: '❌ ขาด', en: '❌ Absent' },
              { id: 'sick_leave', th: '🏥 ลา / ป่วย', en: '🏥 Leave / Sick' },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`rounded-xl border px-3 py-1 text-xs font-bold cursor-pointer transition-colors ${
                statusFilter === st.id
                  ? 'border-[#3D322C] bg-[#3D322C] text-white'
                  : 'border-[#EBD8C3] bg-[#FFFDF9] text-[#5E4E45] hover:bg-[#FAF1E6]'
              }`}
            >
              {lang === 'th' ? st.th : st.en}
            </button>
          ))}
        </div>

        {/* Content Body */}
        {viewMode === 'timeline' ? (
          filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DFD2C3] bg-[#FFFDF9] p-8 text-center space-y-1.5">
              <div className="text-3xl">📭</div>
              <div className="text-sm font-bold text-[#3D322C]">
                {lang === 'th'
                  ? 'ยังไม่มีประวัติการทำรายการของเด็กในวันที่เลือกค่ะ'
                  : 'No kid activity records for the selected date'}
              </div>
              <div className="text-xs text-[#7B695F]">
                {lang === 'th'
                  ? 'เมื่อน้องๆ กดเช็คชื่อ ปุ่มด่วน ทิ้งขยะ แจ้งป่วย หรือพี่เลี้ยงบันทึกข้อมูล รายการจะขึ้นแสดงที่นี่ตลอด 1 วัน และเก็บไว้ 7 วันค่ะ'
                  : 'Check-ins, quick commands, trash duty confirmations, and reports will appear here automatically for 7 days.'}
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredLogs.map((log) => {
                const meta = STATUS_META[log.status] ?? STATUS_META.other;
                const daysLeft = getRemainingRetentionDays(log, now);
                return (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-[#EFE6DC] bg-[#FFFDF9] hover:bg-[#FFF9F2] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-[#3D322C]">
                        <span className="rounded-lg bg-[#F5ECE2] px-2 py-0.5 text-xs font-extrabold tabular-nums text-[#5E411D]">
                          🕒 {log.timeText}
                        </span>
                        <span>
                          {log.kidEmoji} {log.kidNickname}
                        </span>
                        <span
                          className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold ${meta.badgeClass}`}
                        >
                          {meta.emoji} {lang === 'th' ? meta.th : meta.en}
                        </span>
                        <span className="font-semibold text-[#3D322C]">{log.actionLabel}</span>
                      </div>
                      <div className="text-[11px] text-[#7B695F] flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <span className="tabular-nums">📅 {log.dateKey}</span>
                        <span>· 👤 {log.recordedBy}</span>
                        {log.note && <span>· 💬 {log.note}</span>}
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold text-[#8B796E] shrink-0 tabular-nums">
                      {daysLeft <= 1
                        ? lang === 'th'
                          ? '⏳ ลบอัตโนมัติใน 24 ชม.'
                          : '⏳ Auto-deletes <24h'
                        : lang === 'th'
                        ? `🗓️ ลบอัตโนมัติใน ${daysLeft} วัน`
                        : `🗓️ Auto-deletes in ${daysLeft}d`}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredKids.map((kid) => {
              const kidLogs = logsByKidMap.get(kid.id) ?? [];
              return (
                <div
                  key={kid.id}
                  className="rounded-2xl border border-[#EFE6DC] bg-[#FFFDF9] p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#F2E9DF]">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-[#3D322C] truncate">
                        {kid.emoji} {kid.nickname}{' '}
                        <span className="text-xs font-medium text-[#7B695F]">
                          ({kid.fullName})
                        </span>
                      </div>
                      <div className="text-[11px] text-[#7B695F]">
                        {kid.group
                          ? lang === 'th'
                            ? GROUP_LABELS[kid.group].th
                            : GROUP_LABELS[kid.group].en
                          : ''}
                      </div>
                    </div>
                    <span
                      className={`rounded-xl border px-2.5 py-1 text-xs font-extrabold tabular-nums shrink-0 ${
                        kidLogs.length > 0
                          ? 'border-[#8FD4C6] bg-[#E8FAF6] text-[#114A42]'
                          : 'border-[#E6DCD2] bg-[#F7F3EE] text-[#8B796E]'
                      }`}
                    >
                      {kidLogs.length} {lang === 'th' ? 'รายการ' : 'logs'}
                    </span>
                  </div>

                  {kidLogs.length === 0 ? (
                    <div className="text-xs text-[#8B796E] py-2">
                      {lang === 'th'
                        ? '— ยังไม่มีการทำรายการในวันที่เลือก'
                        : '— No actions logged on this day'}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {kidLogs.map((log) => {
                        const meta = STATUS_META[log.status] ?? STATUS_META.other;
                        return (
                          <div
                            key={log.id}
                            className="rounded-xl border border-[#F2E9DF] bg-white px-3 py-2 text-xs space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#3D322C] truncate">
                                {meta.emoji} {log.actionLabel}
                              </span>
                              <span className="text-[11px] font-bold text-[#6E5C52] tabular-nums shrink-0">
                                {log.timeText}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#7B695F]">
                              {effectiveSelectedDateKey === 'ALL_7D' ? `${log.dateKey} · ` : ''}
                              {log.recordedBy}
                              {log.note ? ` · ${log.note}` : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
