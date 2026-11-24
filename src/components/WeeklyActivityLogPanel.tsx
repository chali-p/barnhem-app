import React, { useMemo, useState } from 'react';
import {
  Language,
  Member,
  ModalAlertPayload,
  WeeklyActivityLog,
  WeeklyActivityStatus,
} from '../types/barnhem';
import { getDateKey } from '../utils/timeRules';

interface WeeklyActivityLogPanelProps {
  orgName: string;
  kids: Member[];
  logs: WeeklyActivityLog[];
  lastWeeklyClearedAt?: string | null;
  now: Date;
  lang: Language;
  staffName: string;
  onAddLog: (entry: WeeklyActivityLog) => void;
  onDeleteLog: (logId: string) => void;
  onClearWeeklyLogs: () => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const STATUS_META: Record<
  WeeklyActivityStatus,
  { th: string; en: string; emoji: string; badgeClass: string }
> = {
  on_time: {
    th: 'ตรงเวลา',
    en: 'On Time',
    emoji: '✅',
    badgeClass: 'bg-[#E8FAF6] text-[#114A42] border-[#8FD4C6]',
  },
  late: {
    th: 'มาสาย',
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

export function buildWeeklyLineSummary(
  orgName: string,
  logs: WeeklyActivityLog[],
  now: Date
): string {
  const dateLabel = now.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const onTimeCount = logs.filter((l) => l.status === 'on_time').length;
  const lateLogs = logs.filter((l) => l.status === 'late');
  const absentLogs = logs.filter((l) => l.status === 'absent');
  const sickLeaveLogs = logs.filter((l) => l.status === 'sick_leave');

  const formatLines = (items: WeeklyActivityLog[], limit = 12) =>
    items
      .slice(0, limit)
      .map(
        (l) =>
          `- ${l.kidEmoji} ${l.kidNickname} (${l.dateKey.slice(5)} ${l.timeText}): ${l.actionLabel}${
            l.note ? ` [${l.note}]` : ''
          }`
      )
      .join('\n');

  const sections: string[] = [
    `📋 สรุปประวัติการใช้งาน & ขาด-ลา-มาสาย (${orgName})`,
    `📅 ณ วันที่ ${dateLabel}`,
    `✅ ตรงเวลา/ใช้งาน: ${onTimeCount} ครั้ง`,
    `⏰ มาสาย: ${lateLogs.length} ครั้ง | ❌ ขาด: ${absentLogs.length} ครั้ง | 🏥 ลา/ป่วย: ${sickLeaveLogs.length} ครั้ง`,
  ];

  if (absentLogs.length > 0) {
    sections.push(`\n❌ รายการขาด (${absentLogs.length}):\n${formatLines(absentLogs)}`);
  }
  if (lateLogs.length > 0) {
    sections.push(`\n⏰ รายการมาสาย (${lateLogs.length}):\n${formatLines(lateLogs)}`);
  }
  if (sickLeaveLogs.length > 0) {
    sections.push(`\n🏥 รายการลา/ป่วย (${sickLeaveLogs.length}):\n${formatLines(sickLeaveLogs)}`);
  }
  if (absentLogs.length === 0 && lateLogs.length === 0 && sickLeaveLogs.length === 0) {
    sections.push('\n🌟 สัปดาห์นี้ไม่มีประวัติขาด-ลา-มาสายเลย เยี่ยมมากค่ะ!');
  }

  return sections.join('\n').slice(0, 1800);
}

export const WeeklyActivityLogPanel: React.FC<WeeklyActivityLogPanelProps> = ({
  orgName,
  kids,
  logs,
  lastWeeklyClearedAt,
  now,
  lang,
  staffName,
  onAddLog,
  onDeleteLog,
  onClearWeeklyLogs,
  onShowAlert,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [selectedKidId, setSelectedKidId] = useState<string>(kids[0]?.id ?? '');
  const [noteInput, setNoteInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WeeklyActivityStatus>('all');
  const [search, setSearch] = useState('');
  const [copiedJustNow, setCopiedJustNow] = useState(false);

  const effectiveKidId = kids.some((k) => k.id === selectedKidId)
    ? selectedKidId
    : kids[0]?.id ?? '';

  const isSundayEvening = now.getDay() === 0 && now.getHours() >= 16;

  const counts = useMemo(() => {
    return {
      total: logs.length,
      onTime: logs.filter((l) => l.status === 'on_time').length,
      late: logs.filter((l) => l.status === 'late').length,
      absent: logs.filter((l) => l.status === 'absent').length,
      sickLeave: logs.filter((l) => l.status === 'sick_leave').length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.kidNickname.toLowerCase().includes(q) ||
        l.actionLabel.toLowerCase().includes(q) ||
        (l.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [logs, statusFilter, search]);

  const lineSummaryText = useMemo(
    () => buildWeeklyLineSummary(orgName, logs, now),
    [orgName, logs, now]
  );

  const lineShareUrl = useMemo(
    () => `https://line.me/R/share?text=${encodeURIComponent(lineSummaryText)}`,
    [lineSummaryText]
  );

  const handleQuickRecord = (
    status: WeeklyActivityStatus,
    actionLabelTh: string,
    actionLabelEn: string
  ) => {
    const kid = kids.find((k) => k.id === effectiveKidId);
    if (!kid) return;

    const timeText = now.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const entry: WeeklyActivityLog = {
      id: `wal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kidId: kid.id,
      kidNickname: kid.nickname,
      kidEmoji: kid.emoji,
      kidGroup: kid.group,
      dateKey: getDateKey(now),
      timeText: `${timeText} น.`,
      actionLabel: lang === 'th' ? actionLabelTh : actionLabelEn,
      status,
      note: noteInput.trim() || undefined,
      recordedBy: staffName,
      createdAt: now.toISOString(),
    };
    onAddLog(entry);
    setNoteInput('');
    onShowAlert({
      icon: STATUS_META[status].emoji,
      title:
        lang === 'th'
          ? `บันทึก "${STATUS_META[status].th}" ให้ ${kid.nickname} แล้ว`
          : `Logged "${STATUS_META[status].en}" for ${kid.nickname}`,
      message: `${entry.actionLabel}${entry.note ? ` · ${entry.note}` : ''}`,
      tone: status === 'on_time' ? 'mint' : status === 'late' ? 'yellow' : 'pink',
    });
  };

  const handleCopyLine = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(lineSummaryText);
      }
      setCopiedJustNow(true);
      window.setTimeout(() => setCopiedJustNow(false), 3000);
      onShowAlert({
        icon: '💚',
        title: lang === 'th' ? 'คัดลอกสรุปส่ง LINE แล้ว!' : 'LINE Summary Copied!',
        message:
          lang === 'th'
            ? 'เปิดแอป LINE แล้วกดวาง (Paste) ในกลุ่มมูลนิธิได้เลยค่ะ'
            : 'Open LINE and paste into your group chat.',
        tone: 'mint',
      });
    } catch {
      onShowAlert({
        icon: '📋',
        title: lang === 'th' ? 'พร้อมส่งเข้า LINE' : 'Ready for LINE',
        message: lineSummaryText,
        tone: 'blue',
      });
    }
  };

  const handleConfirmClearWeekly = () => {
    onShowAlert({
      icon: '🧹',
      title:
        lang === 'th'
          ? 'ล้างประวัติรอบสัปดาห์นี้ (ทุกอาทิตย์เย็น)?'
          : 'Clear Weekly Activity Logs?',
      message:
        lang === 'th'
          ? `กำลังจะล้างประวัติทั้งหมด ${logs.length} รายการ (แนะนำให้กดส่งเข้า LINE ก่อนกดยืนยันนะคะ)`
          : `This will clear ${logs.length} log entries for the new week.`,
      tone: 'yellow',
      confirmLabel: lang === 'th' ? 'ยืนยันล้างข้อมูลสัปดาห์นี้' : 'Confirm Clear Logs',
      onConfirm: onClearWeeklyLogs,
    });
  };

  return (
    <section className="rounded-[28px] border-2 border-[#B9E8DF] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-[#114A42]">
            📋 {lang === 'th' ? 'ประวัติการใช้งาน & ขาด-ลา-มาสาย (ประจำสัปดาห์)' : 'Weekly Attendance & Activity Log'}
          </h3>
          <p className="text-xs text-[#6E5C52] mt-0.5">
            {lang === 'th'
              ? 'บันทึกอัตโนมัติทุกครั้งที่เด็กเช็คชื่อ ใช้งานระบบ หรือมาสาย + พี่เลี้ยงกดบันทึกขาด/ลา/ป่วยเพิ่มเติมได้ พร้อมส่ง LINE และล้างข้อมูลทุกอาทิตย์เย็นค่ะ'
              : 'Auto-logs every kid check-in, late arrival, and staff absent/leave record with 1-tap LINE share & Sunday evening reset.'}
          </p>
          {lastWeeklyClearedAt && (
            <div className="text-[11px] font-semibold text-[#6E5C52] mt-1">
              🕒{' '}
              {lang === 'th'
                ? `ล้างข้อมูลล่าสุดเมื่อ: ${new Date(lastWeeklyClearedAt).toLocaleString('th-TH')}`
                : `Last cleared: ${new Date(lastWeeklyClearedAt).toLocaleString()}`}
            </div>
          )}
        </div>

        {/* 1-Tap LINE Send & Sunday Reset Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={lineShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-2xl bg-[#06C755] hover:bg-[#05B24C] text-white px-4 py-2 text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs"
          >
            <span>💚</span>
            <span>{lang === 'th' ? 'ส่งเข้า LINE ทันที' : 'Send to LINE'}</span>
          </a>

          <button
            type="button"
            onClick={() => void handleCopyLine()}
            className="min-h-[42px] rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] hover:bg-[#D5F4EE] text-[#114A42] px-3.5 py-2 text-xs font-bold cursor-pointer"
          >
            {copiedJustNow
              ? lang === 'th'
                ? '✅ คัดลอกแล้ว!'
                : '✅ Copied!'
              : lang === 'th'
              ? '📋 คัดลอกส่ง LINE'
              : '📋 Copy for LINE'}
          </button>

          <button
            type="button"
            onClick={handleConfirmClearWeekly}
            className="min-h-[42px] rounded-2xl border border-[#F3B7C0] bg-[#FFE8ED] hover:bg-[#FADADD] text-[#8B1D36] px-3.5 py-2 text-xs font-bold cursor-pointer"
          >
            🧹 {lang === 'th' ? 'ล้างข้อมูลสัปดาห์นี้' : 'Clear Weekly Logs'}
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="min-h-[42px] rounded-2xl border border-[#B9E8DF] bg-[#E8FAF6] hover:bg-[#D5F4EE] text-[#114A42] px-3 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              {collapsed
                ? lang === 'th'
                  ? '👁️ แสดง ▾'
                  : '👁️ Show ▾'
                : lang === 'th'
                ? '🙈 ซ่อน ▴'
                : '🙈 Hide ▴'}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {isSundayEvening && (
        <div className="rounded-2xl border-2 border-[#F0D568] bg-[#FFF9DB] px-4 py-3 text-xs font-bold text-[#6B4E08] flex flex-wrap items-center justify-between gap-2">
          <span>
            🌇{' '}
            {lang === 'th'
              ? 'เย็นวันอาทิตย์แล้ว! แนะนำกด "💚 ส่งเข้า LINE ทันที" แล้วกด "🧹 ล้างข้อมูลสัปดาห์นี้" เพื่อเริ่มรอบใหม่ค่ะ'
              : 'Sunday evening reminder: Send your weekly report to LINE and clear logs for the new week.'}
          </span>
        </div>
      )}

      {/* Weekly Metrics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl border border-[#EBD8C3] bg-white px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-[#7B695F]">
            {lang === 'th' ? 'บันทึกทั้งหมดสัปดาห์นี้' : 'Total Weekly Logs'}
          </div>
          <div className="text-xl font-extrabold text-[#3D322C] tabular-nums">{counts.total}</div>
        </div>
        <div className="rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-[#114A42]">
            ✅ {lang === 'th' ? 'ตรงเวลา / เช็คใช้งาน' : 'On Time'}
          </div>
          <div className="text-xl font-extrabold text-[#114A42] tabular-nums">{counts.onTime}</div>
        </div>
        <div className="rounded-2xl border border-[#F2DA84] bg-[#FFF5CC] px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-[#8A5A10]">
            ⏰ {lang === 'th' ? 'มาสาย' : 'Late'}
          </div>
          <div className="text-xl font-extrabold text-[#8A5A10] tabular-nums">{counts.late}</div>
        </div>
        <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFE8ED] px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-[#8B1D36]">
            ❌/🏥 {lang === 'th' ? 'ขาด / ลา / ป่วย' : 'Absent / Leave'}
          </div>
          <div className="text-xl font-extrabold text-[#8B1D36] tabular-nums">
            {counts.absent + counts.sickLeave}
          </div>
        </div>
      </div>

      {/* Staff Quick Record Bar */}
      {kids.length > 0 && (
        <div className="rounded-2xl border border-[#EBD8C3] bg-white p-3.5 space-y-2.5">
          <div className="text-xs font-extrabold text-[#3D322C]">
            ✍️ {lang === 'th' ? 'พี่เลี้ยงกดบันทึก ขาด / ลา / ป่วย / มาสาย ด่วน:' : 'Quick Attendance Entry:'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={effectiveKidId}
              onChange={(e) => setSelectedKidId(e.target.value)}
              className="rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-2 text-xs font-bold text-[#3D322C]"
            >
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.nickname} ({k.fullName})
                </option>
              ))}
            </select>
            <input
              type="text"
              maxLength={120}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder={
                lang === 'th'
                  ? 'หมายเหตุ (เช่น ไข้ขึ้น / กลับบ้านต่างจังหวัด / รถติด)...'
                  : 'Optional note...'
              }
              className="flex-1 min-w-[180px] rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-2 text-xs text-[#3D322C]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickRecord('absent', 'ขาดเช็คชื่อ / ไม่มา', 'Absent')}
              className="min-h-[36px] rounded-xl border border-[#F3B7C0] bg-[#FFE8ED] hover:bg-[#FADADD] text-[#8B1D36] px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              ❌ {lang === 'th' ? 'บันทึกขาด' : 'Absent'}
            </button>
            <button
              type="button"
              onClick={() => handleQuickRecord('sick_leave', 'แจ้งป่วย / พักรักษาตัว', 'Sick Leave')}
              className="min-h-[36px] rounded-xl border border-[#A7D3EC] bg-[#DCEEF8] hover:bg-[#C6E2F3] text-[#1E445C] px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              🏥 {lang === 'th' ? 'บันทึกป่วย' : 'Sick'}
            </button>
            <button
              type="button"
              onClick={() => handleQuickRecord('sick_leave', 'ลากิจ / กลับบ้าน', 'Personal Leave')}
              className="min-h-[36px] rounded-xl border border-[#A7D3EC] bg-[#EEF7FC] hover:bg-[#DCEEF8] text-[#1E445C] px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              📝 {lang === 'th' ? 'บันทึกลา' : 'Leave'}
            </button>
            <button
              type="button"
              onClick={() => handleQuickRecord('late', 'มาสาย', 'Arrived Late')}
              className="min-h-[36px] rounded-xl border border-[#F2DA84] bg-[#FFF5CC] hover:bg-[#FCEB8E] text-[#8A5A10] px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              ⏰ {lang === 'th' ? 'บันทึกมาสาย' : 'Late'}
            </button>
            <button
              type="button"
              onClick={() => handleQuickRecord('on_time', 'พี่เลี้ยงเช็คอินปกติ', 'Checked In On Time')}
              className="min-h-[36px] rounded-xl border border-[#8FD4C6] bg-[#E8FAF6] hover:bg-[#D5F4EE] text-[#114A42] px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              ✅ {lang === 'th' ? 'มาปกติ' : 'On Time'}
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#F6EFE6] border border-[#EBD8C3]">
          {(
            [
              { id: 'all', th: 'ทั้งหมด', en: 'All' },
              { id: 'late', th: '⏰ มาสาย', en: 'Late' },
              { id: 'absent', th: '❌ ขาด', en: 'Absent' },
              { id: 'sick_leave', th: '🏥 ลา/ป่วย', en: 'Leave/Sick' },
              { id: 'on_time', th: '✅ ตรงเวลา', en: 'On Time' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-[#3D322C] shadow-2xs'
                  : 'text-[#6E5C52] hover:text-[#3D322C]'
              }`}
            >
              {lang === 'th' ? tab.th : tab.en}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={lang === 'th' ? '🔍 ค้นหาชื่อน้อง / กิจกรรม...' : '🔍 Search kid / activity...'}
          className="rounded-2xl border border-[#EBD8C3] bg-white px-3.5 py-1.5 text-xs text-[#3D322C] w-full sm:w-56"
        />
      </div>

      {/* Activity List */}
      {filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DFD2C3] bg-white p-6 text-center text-xs text-[#7B695F]">
          {lang === 'th'
            ? 'ยังไม่มีประวัติในรอบสัปดาห์นี้ — เมื่อน้องๆ กดใช้งานหรือพี่เลี้ยงบันทึกขาด/ลา/มาสาย รายการจะขึ้นที่นี่ทันทีค่ะ'
            : 'No weekly logs yet. Kid actions and staff attendance entries will appear here automatically.'}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {filteredLogs.slice(0, 80).map((log) => {
            const meta = STATUS_META[log.status] ?? STATUS_META.other;
            return (
              <div
                key={log.id}
                className="rounded-2xl border border-[#EFE6DC] bg-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-bold text-[#3D322C]">
                    <span>
                      {log.kidEmoji} {log.kidNickname}
                    </span>
                    <span
                      className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold ${meta.badgeClass}`}
                    >
                      {meta.emoji} {lang === 'th' ? meta.th : meta.en}
                    </span>
                    <span className="text-[#4F433C] font-semibold">{log.actionLabel}</span>
                  </div>
                  <div className="text-[11px] text-[#7B695F]">
                    📅 {log.dateKey} · 🕒 {log.timeText} · 👤 {log.recordedBy}
                    {log.note ? ` · 💬 ${log.note}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteLog(log.id)}
                  title={lang === 'th' ? 'ลบรายการนี้' : 'Remove entry'}
                  className="rounded-lg border border-[#EBD8C3] hover:bg-[#FFE8ED] px-2 py-1 text-[11px] text-[#7B695F] hover:text-[#8B1D36] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </section>
  );
};
