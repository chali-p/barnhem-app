import React, { useMemo, useState } from 'react';
import { KidGroup, Language, Member, ModalAlertPayload } from '../types/barnhem';
import { getDailyHouseChoreForKid } from '../utils/houseChores';
import {
  getKitchenSlotsLabelsForKid,
  getMemberTrashDutyStatusForDate,
  getTrashDutyDaySlots,
  getTrashDutyInfoForDate,
} from '../utils/trashDuty';
import { getDateKey } from '../utils/timeRules';
import { KidDutySchedulesPanel } from './KidDutySchedulesPanel';

interface KidDutyRosterViewProps {
  orgName: string;
  kids: Member[];
  now: Date;
  lang: Language;
  isPublicHolidayToday?: boolean;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onBackHome: () => void;
}

export const KidDutyRosterView: React.FC<KidDutyRosterViewProps> = ({
  orgName,
  kids,
  now,
  lang,
  isPublicHolidayToday = false,
  onShowAlert,
  onBackHome,
}) => {
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(true);
  const [groupFilter, setGroupFilter] = useState<0 | KidGroup>(0);
  const [search, setSearch] = useState('');
  const [copiedJustNow, setCopiedJustNow] = useState(false);

  const todayKey = getDateKey(now);
  const trashToday = useMemo(() => getTrashDutyInfoForDate(now), [now]);
  const trashDaySlots = useMemo(() => getTrashDutyDaySlots(now), [now]);

  const dailyRosterRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return kids
      .filter((k) => {
        if (groupFilter !== 0 && k.group !== groupFilter) return false;
        if (!q) return true;
        return (
          k.nickname.toLowerCase().includes(q) ||
          k.fullName.toLowerCase().includes(q)
        );
      })
      .map((kid) => {
        const chore = getDailyHouseChoreForKid(kid, kids, now, isPublicHolidayToday);
        const choreDone = Boolean(kid.daily.dateKey === todayKey && kid.daily.houseChoreDone);
        const kitchenSlots = getKitchenSlotsLabelsForKid(kid, lang);
        const isTrashTodayBoy = kid.id === trashToday.boyAssignee.kidId;
        const isTrashTodayGirl = kid.id === trashToday.girlAssignee.kidId;
        return {
          kid,
          chore,
          choreDone,
          kitchenSlots,
          isTrashTodayBoy,
          isTrashTodayGirl,
        };
      });
  }, [kids, groupFilter, search, now, isPublicHolidayToday, todayKey, lang, trashToday]);

  const choresDoneCount = useMemo(
    () =>
      kids.filter((k) => k.daily.dateKey === todayKey && k.daily.houseChoreDone).length,
    [kids, todayKey]
  );

  const summaryText = useMemo(() => {
    const dateLabel = now.toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const formatZoneLine = (zone: 'boys' | 'girls', label: string) => {
      const parts = trashDaySlots.map((slot) => {
        const assignee = zone === 'boys' ? slot.boyAssignee : slot.girlAssignee;
        const member = kids.find((k) => k.id === assignee.kidId);
        const done = getMemberTrashDutyStatusForDate(member, slot.dateKey).done;
        const statusStr = done
          ? 'ทิ้งแล้ว ✅'
          : slot.isUpcoming
          ? 'รอดำเนินการ ⏳'
          : 'ยังไม่ยืนยัน ⏳';
        return `${slot.dayWithDateTh} ${assignee.displayNameTh} (${statusStr})`;
      });
      return `- ${label}: ${parts.join(' · ')}`;
    };
    const lines = [
      `📅 สรุปตารางเวรเด็กทั้งหมด (${orgName})`,
      `🗓️ ${dateLabel}`,
      `🗑️ เวรทิ้งขยะสัปดาห์ที่ ${trashToday.weekNumber}:`,
      formatZoneLine('boys', 'เขตผู้ชาย'),
      formatZoneLine('girls', 'เขตผู้หญิง'),
      `🧹 เวรเขตพื้นที่วันนี้: ทำแล้ว ${choresDoneCount}/${kids.length} คน`,
      '',
    ];
    for (const row of dailyRosterRows.slice(0, 25)) {
      lines.push(
        `- ${row.kid.emoji} ${row.kid.nickname}: ${row.chore.titleTh} [${
          row.choreDone ? 'เสร็จแล้ว ✅' : 'รอทำ ⏳'
        }]${row.kitchenSlots.length > 0 ? ` · ครัว: ${row.kitchenSlots.join(', ')}` : ''}`
      );
    }
    return lines.join('\n').slice(0, 1800);
  }, [
    choresDoneCount,
    dailyRosterRows,
    kids,
    now,
    orgName,
    trashDaySlots,
    trashToday,
  ]);

  const handleCopySummary = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      }
      setCopiedJustNow(true);
      window.setTimeout(() => setCopiedJustNow(false), 2500);
      onShowAlert({
        icon: '📅',
        title: lang === 'th' ? 'คัดลอกตารางเวรแล้ว!' : 'Duty Schedule Copied!',
        message:
          lang === 'th'
            ? 'สามารถนำไปวางส่งในกลุ่ม LINE ได้ทันทีค่ะ'
            : 'Ready to paste into LINE or notes.',
        tone: 'mint',
      });
    } catch {
      onShowAlert({
        icon: '📅',
        title: lang === 'th' ? 'สรุปตารางเวรวันนี้' : 'Today Duty Summary',
        message: summaryText,
        tone: 'blue',
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header Card */}
      <section className="rounded-[28px] border-2 border-[#A7D3EC] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#A7D3EC] bg-[#EDF6FF] px-3 py-1 text-xs font-extrabold text-[#1D4D73]">
              <span>🔑 PIN 0003</span>
              <span>·</span>
              <span>
                {lang === 'th' ? 'เช็คตารางเวรเด็กทั้งหมด' : 'All Kids Duty Schedules'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
              📅 {lang === 'th' ? 'ตารางเวรเด็กทั้งหมด (รายวัน · วันหยุด · ครัว · ทิ้งขยะ)' : 'All Kids Duty Roster'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5C52]">
              {lang === 'th'
                ? 'ตรวจสอบเวรประจำวันของน้องทุกคน เวรวันหยุด 14 โซน เวรห้องครัว และเวรทิ้งขยะรายสัปดาห์ได้ครบในหน้าเดียวค่ะ'
                : 'Inspect daily house chores, 14-zone weekend cleaning, kitchen shifts, and weekly trash duty in one place.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://line.me/R/share?text=${encodeURIComponent(summaryText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-2xl bg-[#06C755] hover:bg-[#05B24C] text-white px-4 py-2 text-xs font-extrabold shadow-xs"
            >
              <span>💚</span>
              <span>{lang === 'th' ? 'ส่งเข้า LINE' : 'Send to LINE'}</span>
            </a>

            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="min-h-[40px] rounded-2xl border border-[#A7D3EC] bg-[#EDF6FF] hover:bg-[#DCEEF8] text-[#1D4D73] px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              {copiedJustNow
                ? lang === 'th'
                  ? '✅ คัดลอกแล้ว'
                  : '✅ Copied'
                : lang === 'th'
                ? '📋 คัดลอกสรุปเวร'
                : '📋 Copy Summary'}
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

        {/* Today's Duty Snapshot Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] px-4 py-3">
            <div className="font-semibold text-[#114A42]">
              🧹 {lang === 'th' ? 'เวรทำความสะอาดวันนี้' : 'Daily Chores Today'}
            </div>
            <div className="text-xl font-extrabold text-[#114A42] tabular-nums mt-0.5">
              {choresDoneCount}/{kids.length} {lang === 'th' ? 'คนเสร็จแล้ว' : 'done'}
            </div>
          </div>

          {[
            {
              zone: 'boys' as const,
              icon: '👨',
              headerTh: `เวรขยะชาย (สัปดาห์ที่ ${trashToday.weekNumber})`,
              headerEn: `Boys Trash (Wk ${trashToday.weekNumber})`,
              cardCls: 'border-[#C4DCF0] bg-[#F5FAFF]',
              textCls: 'text-[#163B59]',
            },
            {
              zone: 'girls' as const,
              icon: '👩',
              headerTh: `เวรขยะหญิง (สัปดาห์ที่ ${trashToday.weekNumber})`,
              headerEn: `Girls Trash (Wk ${trashToday.weekNumber})`,
              cardCls: 'border-[#F3C6D6] bg-[#FFF7FA]',
              textCls: 'text-[#6E1F3A]',
            },
          ].map((cfg) => (
            <div key={cfg.zone} className={`rounded-2xl border px-4 py-3 ${cfg.cardCls}`}>
              <div className={`font-semibold ${cfg.textCls}`}>
                {cfg.icon} {lang === 'th' ? cfg.headerTh : cfg.headerEn}
              </div>
              <div className="mt-1.5 space-y-1">
                {trashDaySlots.map((slot) => {
                  const assignee = cfg.zone === 'boys' ? slot.boyAssignee : slot.girlAssignee;
                  const member = kids.find((k) => k.id === assignee.kidId);
                  const status = getMemberTrashDutyStatusForDate(member, slot.dateKey);
                  const assigneeName =
                    lang === 'th' ? assignee.displayNameTh : assignee.displayNameEn;
                  return (
                    <div
                      key={`${cfg.zone}-snap-${slot.dateKey}`}
                      className={`text-xs font-extrabold flex items-center justify-between gap-2 ${cfg.textCls}`}
                    >
                      <span className="truncate">
                        {lang === 'th' ? slot.dayWithDateTh : slot.dayWithDateEn} · {assigneeName}
                      </span>
                      <span
                        className={`shrink-0 ${
                          status.done
                            ? 'text-[#146850]'
                            : slot.isUpcoming
                            ? 'text-[#4B6175]'
                            : 'text-[#9E3818]'
                        }`}
                      >
                        {status.done
                          ? lang === 'th'
                            ? '✅ ทิ้งแล้ว'
                            : '✅ Cleared'
                          : slot.isUpcoming
                          ? lang === 'th'
                            ? '🕒 รอดำเนินการ'
                            : '🕒 Pending'
                          : lang === 'th'
                          ? '⏳ ยังไม่ยืนยัน'
                          : '⏳ Unconfirmed'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-Kid Daily Duty Breakdown */}
      <section className="rounded-[28px] border-2 border-[#EBD8C3] bg-white p-4 sm:p-5 pastel-shadow space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#3D322C]">
              🧹 {lang === 'th' ? 'เวรประจำตัวของน้องทุกคนวันนี้' : "Each Kid's Duties Today"}
            </h2>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'th'
                ? 'แสดงเวรเขตพื้นที่ประจำวัน สถานะการทำเวรวันนี้ เวรครัว และเวรขยะที่รับผิดชอบค่ะ'
                : 'Daily assigned chore, completion status, kitchen shifts, and trash duty.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDailyBreakdown((p) => !p)}
            className="min-h-[36px] rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] hover:bg-[#FAF1E6] px-3 py-1.5 text-xs font-bold text-[#5E4E45] cursor-pointer"
          >
            {showDailyBreakdown
              ? lang === 'th'
                ? '🙈 ซ่อนรายการรายคน ▴'
                : '🙈 Hide Per-Kid ▴'
              : lang === 'th'
              ? '👁️ แสดงรายการรายคน ▾'
              : '👁️ Show Per-Kid ▾'}
          </button>
        </div>

        {showDailyBreakdown && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 0 as const, th: 'ทั้งหมด', en: 'All' },
                    { id: 1 as const, th: 'กลุ่ม 1 · ประถม', en: 'Group 1' },
                    { id: 2 as const, th: 'กลุ่ม 2 · มัธยม', en: 'Group 2' },
                    { id: 3 as const, th: 'กลุ่ม 3 · วิทยาลัย', en: 'Group 3' },
                  ]
                ).map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGroupFilter(g.id)}
                    className={`rounded-xl border px-3 py-1 text-xs font-bold cursor-pointer transition-colors ${
                      groupFilter === g.id
                        ? 'border-[#3D322C] bg-[#3D322C] text-white'
                        : 'border-[#EBD8C3] bg-[#FFFDF9] text-[#5E4E45] hover:bg-[#FAF1E6]'
                    }`}
                  >
                    {lang === 'th' ? g.th : g.en}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === 'th' ? '🔍 ค้นหาชื่อน้อง...' : '🔍 Search kid...'}
                className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] px-3.5 py-1.5 text-xs text-[#3D322C] w-full sm:w-48"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {dailyRosterRows.map(({ kid, chore, choreDone, kitchenSlots, isTrashTodayBoy, isTrashTodayGirl }) => (
                <div
                  key={kid.id}
                  className={`rounded-2xl border px-3.5 py-3 flex items-start justify-between gap-2.5 ${
                    choreDone
                      ? 'border-[#8FD4C6] bg-[#F2FCF9]'
                      : 'border-[#EFE6DC] bg-[#FFFDF9]'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#3D322C]">
                      <span>
                        {kid.emoji} {kid.nickname}
                      </span>
                      {(isTrashTodayBoy || isTrashTodayGirl) && (
                        <span className="rounded-lg border border-[#A7D3EC] bg-[#EDF6FF] px-2 py-0.5 text-[10px] font-extrabold text-[#1D4D73]">
                          🗑️ {lang === 'th' ? 'เวรทิ้งขยะสัปดาห์นี้' : 'Trash Week'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-[#4F433C]">
                      {chore.emoji} {lang === 'th' ? chore.titleTh : chore.titleEn}
                    </div>
                    {kitchenSlots.length > 0 && (
                      <div className="text-[11px] font-semibold text-[#855A24]">
                        🍳 {lang === 'th' ? 'เวรครัว:' : 'Kitchen:'} {kitchenSlots.join(' · ')}
                      </div>
                    )}
                  </div>

                  <span
                    className={`rounded-xl border px-2.5 py-1 text-[11px] font-extrabold shrink-0 whitespace-nowrap ${
                      choreDone
                        ? 'border-[#8FD4C6] bg-white text-[#114A42]'
                        : 'border-[#F2DA84] bg-[#FFF8E1] text-[#8A5A10]'
                    }`}
                  >
                    {choreDone
                      ? lang === 'th'
                        ? '✅ ทำแล้ว'
                        : '✅ Done'
                      : lang === 'th'
                      ? '⏳ รอทำเวร'
                      : '⏳ Pending'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Complete 3-Channel Duty Schedules (14-Zone Holiday, Kitchen, 16-Week Trash Calendar) */}
      <section className="rounded-[28px] border-2 border-[#EBD8C3] bg-white p-4 sm:p-6 pastel-shadow">
        <KidDutySchedulesPanel
          kids={kids}
          now={now}
          lang={lang}
          isPublicHolidayToday={isPublicHolidayToday}
        />
      </section>
    </div>
  );
};
