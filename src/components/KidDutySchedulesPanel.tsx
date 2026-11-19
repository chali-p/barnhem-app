import React, { useMemo, useState } from 'react';
import { KitchenDutyAssignment, Language, Member } from '../types/barnhem';
import { getDailyHouseChoreForKid, HOUSE_CHORES_POOL } from '../utils/houseChores';
import {
  generateTrashDutySchedule,
  getKitchenSlotsLabelsForKid,
  getTrashDutyInfoForDate,
  isKidAssignedTrashWeek,
  TRASH_DUTY_RULE_EN,
  TRASH_DUTY_RULE_TH,
} from '../utils/trashDuty';

type DutySubTab = 'trash' | 'morning_zone' | 'kitchen';
type TrashZoneFilter = 'boys' | 'girls' | 'both';

interface KidDutySchedulesPanelProps {
  kids: Member[];
  now: Date;
  lang: Language;
  currentKid?: Member;
  compactHeader?: boolean;
  onToggleKitchenSlot?: (
    kidId: string,
    slot: keyof KitchenDutyAssignment,
    checked: boolean
  ) => void;
}

export const KidDutySchedulesPanel: React.FC<KidDutySchedulesPanelProps> = ({
  kids,
  now,
  lang,
  currentKid,
  compactHeader = false,
  onToggleKitchenSlot,
}) => {
  const defaultZone: TrashZoneFilter =
    currentKid?.gender === 'M'
      ? 'boys'
      : currentKid?.gender === 'F'
      ? 'girls'
      : 'both';

  const [activeTab, setActiveTab] = useState<DutySubTab>('trash');
  const [zoneFilter, setZoneFilter] = useState<TrashZoneFilter>(defaultZone);
  const [weeksToShow, setWeeksToShow] = useState<number>(16);

  const trashToday = useMemo(() => getTrashDutyInfoForDate(now), [now]);

  // Keep baseline 16 weeks starting from week 1 if current date is in or before week 16,
  // or dynamically shift window to include current week + upcoming 15 weeks automatically
  const startWeekNum = useMemo(
    () => (trashToday.weekNumber <= weeksToShow && trashToday.weekNumber >= 1 ? 1 : Math.max(1, trashToday.weekNumber - 1)),
    [trashToday.weekNumber, weeksToShow]
  );

  const scheduleRows = useMemo(
    () => generateTrashDutySchedule(weeksToShow, startWeekNum),
    [weeksToShow, startWeekNum]
  );

  // Next upcoming trash duty week for currentKid (if viewing in KidHub)
  const myNextTrashWeek = useMemo(() => {
    if (!currentKid) return null;
    for (let offset = 0; offset < 12; offset += 1) {
      const candidateWeekNum = trashToday.weekNumber + offset;
      const rows = generateTrashDutySchedule(1, candidateWeekNum);
      if (rows[0] && isKidAssignedTrashWeek(currentKid, rows[0])) {
        return rows[0];
      }
    }
    return null;
  }, [currentKid, trashToday.weekNumber]);

  const sortedKidsForView = useMemo(() => {
    const base = [...kids];
    if (!currentKid) return base;
    return base.sort((a, b) => {
      if (a.id === currentKid.id) return -1;
      if (b.id === currentKid.id) return 1;
      return (a.group ?? 99) - (b.group ?? 99);
    });
  }, [kids, currentKid]);

  const myMorningChore = currentKid
    ? getDailyHouseChoreForKid(currentKid, kids, now)
    : null;
  const myKitchenSlots = currentKid
    ? getKitchenSlotsLabelsForKid(currentKid, lang)
    : [];
  const isMyTrashWeek = currentKid
    ? isKidAssignedTrashWeek(currentKid, trashToday)
    : false;

  return (
    <div className="space-y-4 text-[#3D322C]">
      {!compactHeader && (
        <div>
          <h3 className="text-lg font-bold">
            📋 {lang === 'th' ? 'ช่องตารางเวรต่างๆ ของน้อง (เขตเช้า · ห้องครัว · ทิ้งขยะ)' : 'All Kid Duty Schedules'}
          </h3>
          <p className="text-xs text-[#6E5C52] mt-0.5">
            {lang === 'th'
              ? 'รวมเวรประจำวันและประจำสัปดาห์ของเด็กๆ ทั้งเวรทำเขตบริเวณตอนเช้า เวรห้องครัว และตารางเวรทิ้งขยะคำนวณอัตโนมัติค่ะ'
              : 'Complete daily & weekly duties: Morning compound zones, Kitchen shifts, and auto-calculated Trash duty.'}
          </p>
        </div>
      )}

      {/* Quick 3-Channel Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('morning_zone')}
          className={`rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
            activeTab === 'morning_zone'
              ? 'border-[#7CC6B8] bg-[#ECFBF7]'
              : 'border-[#DCEEEB] bg-[#F6FCFB] hover:bg-[#ECFBF7]'
          }`}
        >
          <div className="font-extrabold text-[#1D544C] flex items-center justify-between gap-1">
            <span>🧹 {lang === 'th' ? '1. เวรทำเขตบริเวณตอนเช้า' : '1. Morning Zone'}</span>
            {currentKid && (
              <span className="text-[10px] font-bold">
                {currentKid.daily.houseChoreDone ? '✅' : '⏳'}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[#2E6A60] truncate">
            {currentKid && myMorningChore
              ? `${myMorningChore.emoji} ${lang === 'th' ? myMorningChore.titleTh : myMorningChore.titleEn}`
              : lang === 'th'
              ? `เสร็จแล้ววันนี้ ${kids.filter((k) => k.daily.houseChoreDone).length}/${kids.length} คน`
              : `Done today: ${kids.filter((k) => k.daily.houseChoreDone).length}/${kids.length}`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kitchen')}
          className={`rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
            activeTab === 'kitchen'
              ? 'border-[#F0B87A] bg-[#FFF5E8]'
              : 'border-[#F3DFC6] bg-[#FFFDF8] hover:bg-[#FFF5E8]'
          }`}
        >
          <div className="font-extrabold text-[#6E4414] flex items-center justify-between gap-1">
            <span>🍳 {lang === 'th' ? '2. เวรห้องครัว' : '2. Kitchen Duty'}</span>
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[#855A24] truncate">
            {currentKid
              ? myKitchenSlots.length > 0
                ? myKitchenSlots.join(' · ')
                : lang === 'th'
                ? 'สัปดาห์นี้ไม่มีรอบเวรครัว'
                : 'No kitchen slot assigned'
              : lang === 'th'
              ? `มีน้องรับผิดชอบ ${kids.filter((k) => k.kitchenDuty.evening1530 || k.kitchenDuty.sat0930 || k.kitchenDuty.sun0915).length} คน`
              : `Assigned: ${kids.filter((k) => k.kitchenDuty.evening1530 || k.kitchenDuty.sat0930 || k.kitchenDuty.sun0915).length} kids`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trash')}
          className={`rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
            activeTab === 'trash'
              ? 'border-[#96C7EE] bg-[#EDF6FF]'
              : 'border-[#D5E6F5] bg-[#F7FBFF] hover:bg-[#EDF6FF]'
          }`}
        >
          <div className="font-extrabold text-[#1D4D73] flex items-center justify-between gap-1">
            <span>🗑️ {lang === 'th' ? '3. เวรทิ้งขยะ (พ./อา.)' : '3. Weekly Trash'}</span>
            {trashToday.isTrashDayToday && (
              <span className="text-[10px] font-extrabold text-[#B8324B]">
                {lang === 'th' ? 'วันทิ้งขยะ!' : 'Today!'}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[#2E5D85] truncate">
            {lang === 'th'
              ? `สัปดาห์ที่ ${trashToday.weekNumber}: ชาย ${trashToday.boyAssignee.displayNameTh} · หญิง ${trashToday.girlAssignee.displayNameTh}`
              : `Wk ${trashToday.weekNumber}: ${trashToday.boyAssignee.displayNameEn} · ${trashToday.girlAssignee.displayNameEn}`}
          </div>
        </button>
      </div>

      {/* ---------------- TAB 1: WEEKLY TRASH DUTY ---------------- */}
      {activeTab === 'trash' && (
        <div className="space-y-4">
          {/* Current Week Spotlight Banner */}
          <div className="rounded-2xl border-2 border-[#C4DCF0] bg-[#F5FAFF] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm sm:text-base font-extrabold text-[#1B4568]">
                🗓️{' '}
                {lang === 'th'
                  ? `สัปดาห์ที่ ${trashToday.weekNumber} (${trashToday.rangeLabelTh})`
                  : `Week ${trashToday.weekNumber} (${trashToday.rangeLabelEn})`}
              </div>
              <div className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white border border-[#C4DCF0] text-[#26547C]">
                {lang === 'th'
                  ? trashToday.nextTrashDayLabelTh
                  : trashToday.nextTrashDayLabelEn}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-[#E8F4FA] border border-[#BBDDF0] px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-[#2B5878]">
                    👨 {lang === 'th' ? 'เขตเด็กผู้ชาย (อาทิตย์ & พุธเย็น)' : 'Boys Zone (Sun & Wed Evening)'}
                  </div>
                  <div className="text-base font-extrabold text-[#163B59]">
                    {lang === 'th'
                      ? trashToday.boyAssignee.displayNameTh
                      : trashToday.boyAssignee.displayNameEn}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#3D5B7A]">
                  {trashToday.sundayLabelTh} · {trashToday.wednesdayLabelTh}
                </span>
              </div>

              <div className="rounded-xl bg-[#FCEEF3] border border-[#F3C6D6] px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-[#87324F]">
                    👩 {lang === 'th' ? 'เขตเด็กผู้หญิง (อาทิตย์ & พุธเย็น)' : 'Girls Zone (Sun & Wed Evening)'}
                  </div>
                  <div className="text-base font-extrabold text-[#6E1F3A]">
                    {lang === 'th'
                      ? trashToday.girlAssignee.displayNameTh
                      : trashToday.girlAssignee.displayNameEn}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#87324F]">
                  {trashToday.sundayLabelTh} · {trashToday.wednesdayLabelTh}
                </span>
              </div>
            </div>

            {currentKid && (
              <div
                className={`rounded-xl px-3.5 py-2 text-xs font-bold border ${
                  isMyTrashWeek
                    ? 'bg-[#FFF3C9] border-[#E8C563] text-[#614709]'
                    : 'bg-white border-[#D6E6F4] text-[#355470]'
                }`}
              >
                {isMyTrashWeek
                  ? lang === 'th'
                    ? `🔔 สัปดาห์นี้เป็นเวรทิ้งขยะของน้อง${currentKid.nickname}! อย่าลืมนำขยะไปทิ้งในเย็นวันอาทิตย์ (${trashToday.sundayLabelTh}) และเย็นวันพุธ (${trashToday.wednesdayLabelTh}) นะคะ`
                    : `🔔 It's your Trash Duty week! Sun (${trashToday.sundayLabelEn}) & Wed (${trashToday.wednesdayLabelEn}).`
                  : myNextTrashWeek
                  ? lang === 'th'
                    ? `📌 คิวทิ้งขยะรอบถัดไปของน้อง${currentKid.nickname}: สัปดาห์ที่ ${myNextTrashWeek.weekNumber} (${myNextTrashWeek.rangeLabelTh})`
                    : `📌 Your next Trash Duty: Week ${myNextTrashWeek.weekNumber} (${myNextTrashWeek.rangeLabelEn})`
                  : null}
              </div>
            )}
          </div>

          {/* Zone Toggle & Cycle Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setZoneFilter('boys')}
                className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                  zoneFilter === 'boys'
                    ? 'bg-[#CBE6F2] border-[#7AB4CE] text-[#153D52]'
                    : 'bg-white border-[#E4DDD5] text-[#5B4D45] hover:bg-[#F5FAFD]'
                }`}
              >
                👨 {lang === 'th' ? 'เขตเด็กผู้ชาย (วน 7 คน)' : 'Boys Zone (7)'}
              </button>
              <button
                type="button"
                onClick={() => setZoneFilter('girls')}
                className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                  zoneFilter === 'girls'
                    ? 'bg-[#F9CAD8] border-[#DF8EA8] text-[#5C1A31]'
                    : 'bg-white border-[#E4DDD5] text-[#5B4D45] hover:bg-[#FFF5F8]'
                }`}
              >
                👩 {lang === 'th' ? 'เขตเด็กผู้หญิง (วน 8 คน)' : 'Girls Zone (8)'}
              </button>
              <button
                type="button"
                onClick={() => setZoneFilter('both')}
                className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                  zoneFilter === 'both'
                    ? 'bg-[#E6E7F8] border-[#A7ABDF] text-[#282B5C]'
                    : 'bg-white border-[#E4DDD5] text-[#5B4D45] hover:bg-[#F6F6FD]'
                }`}
              >
                👧👦 {lang === 'th' ? 'ดูคู่กันทั้ง 2 เขต' : 'Both Zones'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setWeeksToShow((prev) => (prev >= 24 ? 16 : prev + 8))}
              className="min-h-[36px] rounded-xl border border-[#E4DDD5] bg-white hover:bg-[#FAF5EF] px-3 py-1 text-xs font-bold text-[#5A483E] cursor-pointer"
            >
              {weeksToShow >= 24
                ? lang === 'th'
                  ? '↩️ ย่อเหลือ 16 สัปดาห์ (ถึง มี.ค. 2027)'
                  : '↩️ Show 16 Weeks'
                : lang === 'th'
                ? '➕ คำนวณเพิ่ม +8 สัปดาห์ล่วงหน้า'
                : '➕ +8 Future Weeks'}
            </button>
          </div>

          {/* Boys Table (matches screenshot exactly) */}
          {(zoneFilter === 'boys' || zoneFilter === 'both') && (
            <div className="rounded-2xl border-2 border-[#B8D9E8] bg-white overflow-hidden">
              <div className="bg-[#CBE6F2] px-4 py-2.5 text-center font-extrabold text-sm sm:text-base text-[#1A3442]">
                🧹 {lang === 'th' ? 'ตารางเวรทิ้งขยะประจำสัปดาห์ (เขตเด็กผู้ชาย)' : 'Weekly Trash Duty (Boys Zone)'} 🗑️
              </div>
              <div className="bg-white px-4 py-1.5 text-center text-[11px] sm:text-xs italic text-[#4E423B] border-b border-[#D8EBF3]">
                {lang === 'th'
                  ? `ระยะเวลา: ${scheduleRows[0]?.rangeLabelTh.split(' - ')[0] ? 'พฤศจิกายน 2026 - ' : ''}มีนาคม 2027${weeksToShow > 16 ? ' (+ล่วงหน้า)' : ''} | วันปฏิบัติหน้าที่: ทุกวันพุธ และ วันอาทิตย์`
                  : 'Schedule: Wednesdays & Sundays (Boys Zone)'}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[#CBE6F2] text-[#1A3442] border-y border-[#3D322C]">
                      <th className="py-2 px-2.5 font-extrabold">{lang === 'th' ? 'สัปดาห์ที่' : 'Week'}</th>
                      <th className="py-2 px-3 font-extrabold">{lang === 'th' ? 'ช่วงวันที่ (สัปดาห์)' : 'Date Range'}</th>
                      <th className="py-2 px-3 font-extrabold">{lang === 'th' ? 'เย็นวันอาทิตย์ (ทิ้งขยะ)' : 'Sunday Evening'}</th>
                      <th className="py-2 px-3 font-extrabold">{lang === 'th' ? 'เย็นวันพุธ (ทิ้งขยะ)' : 'Wednesday Evening'}</th>
                      <th className="py-2 px-3 font-extrabold bg-[#C0E0EE]">{lang === 'th' ? 'ผู้รับผิดชอบ 👤' : 'Assignee'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row, index) => {
                      const isCurrentWeek = row.weekNumber === trashToday.weekNumber;
                      const isCycleBoundary = row.weekNumber % 7 === 0 && index < scheduleRows.length - 1;
                      const isMine = currentKid?.id === row.boyAssignee.kidId;
                      return (
                        <tr
                          key={`boy-wk-${row.weekNumber}`}
                          className={`${
                            isCycleBoundary ? 'border-b-2 border-[#3D322C]' : 'border-b border-[#EBF2F6]'
                          } ${
                            isCurrentWeek
                              ? 'bg-[#FFF5CC] font-bold'
                              : row.weekNumber % 2 === 1
                              ? 'bg-white'
                              : 'bg-[#E9F5F9]'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 tabular-nums font-bold">
                            {isCurrentWeek ? '👉 ' : ''}
                            {row.weekNumber}
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{row.rangeLabelTh}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{row.sundayLabelTh}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{row.wednesdayLabelTh}</td>
                          <td
                            className={`py-1.5 px-3 font-bold whitespace-nowrap ${
                              isCurrentWeek
                                ? 'bg-[#FFE79E] text-[#4E3604]'
                                : isMine
                                ? 'bg-[#D6E7FA] text-[#173E6B]'
                                : 'bg-[#E6E7F8] text-[#282B52]'
                            }`}
                          >
                            {isMine ? '⭐ ' : ''}
                            {lang === 'th' ? row.boyAssignee.displayNameTh : row.boyAssignee.displayNameEn}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-white py-2 px-3 text-center text-xs sm:text-sm font-extrabold text-[#D01F2F] border-t border-[#E6EFF5]">
                {lang === 'th' ? TRASH_DUTY_RULE_TH : TRASH_DUTY_RULE_EN}
              </div>
            </div>
          )}

          {/* Girls Table (matches screenshot exactly) */}
          {(zoneFilter === 'girls' || zoneFilter === 'both') && (
            <div className="rounded-2xl border-2 border-[#F2C0D0] bg-white overflow-hidden">
              <div className="bg-[#F9CAD8] px-4 py-2.5 text-center font-extrabold text-sm sm:text-base text-[#4B1A2A]">
                🧹 {lang === 'th' ? 'ตารางเวรทิ้งขยะประจำสัปดาห์ (เขตเด็กผู้หญิง)' : 'Weekly Trash Duty (Girls Zone)'} 🗑️
              </div>
              <div className="bg-white px-4 py-1.5 text-center text-[11px] sm:text-xs italic text-[#4E423B] border-b border-[#FADCE6]">
                {lang === 'th'
                  ? `ระยะเวลา: พฤศจิกายน 2026 - มีนาคม 2027${weeksToShow > 16 ? ' (+ล่วงหน้า)' : ''} | วันปฏิบัติหน้าที่: ทุกวันพุธ และ วันอาทิตย์`
                  : 'Schedule: Wednesdays & Sundays (Girls Zone)'}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[#F9CAD8] text-[#4B1A2A] border-y border-[#3D322C]">
                      <th className="py-2 px-2.5 font-extrabold">{lang === 'th' ? 'สัปดาห์ที่' : 'Week'}</th>
                      <th className="py-2 px-3 font-extrabold">{lang === 'th' ? 'ช่วงวันที่ (สัปดาห์)' : 'Date Range'}</th>
                      <th className="py-2 px-3 font-extrabold">{lang === 'th' ? 'เย็นวันอาทิตย์ (ทิ้งขยะ)' : 'Sunday Evening'}</th>
                      <th className="py-2 px-3 font-extrabold">{lang === 'th' ? 'เย็นวันพุธ (ทิ้งขยะ)' : 'Wednesday Evening'}</th>
                      <th className="py-2 px-3 font-extrabold bg-[#F4BECF]">{lang === 'th' ? 'ผู้รับผิดชอบ 👤' : 'Assignee'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row, index) => {
                      const isCurrentWeek = row.weekNumber === trashToday.weekNumber;
                      const isCycleBoundary = row.weekNumber % 8 === 0 && index < scheduleRows.length - 1;
                      const isMine = currentKid?.id === row.girlAssignee.kidId;
                      return (
                        <tr
                          key={`girl-wk-${row.weekNumber}`}
                          className={`${
                            isCycleBoundary ? 'border-b-2 border-[#3D322C]' : 'border-b border-[#FCECF1]'
                          } ${
                            isCurrentWeek
                              ? 'bg-[#FFF5CC] font-bold'
                              : row.weekNumber % 2 === 1
                              ? 'bg-white'
                              : 'bg-[#FFF2F6]'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 tabular-nums font-bold">
                            {isCurrentWeek ? '👉 ' : ''}
                            {row.weekNumber}
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{row.rangeLabelTh}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{row.sundayLabelTh}</td>
                          <td className="py-1.5 px-3 whitespace-nowrap">{row.wednesdayLabelTh}</td>
                          <td
                            className={`py-1.5 px-3 font-bold whitespace-nowrap ${
                              isCurrentWeek
                                ? 'bg-[#FFE79E] text-[#4E3604]'
                                : isMine
                                ? 'bg-[#FCE0EA] text-[#6E1A37]'
                                : 'bg-[#E6E7F8] text-[#282B52]'
                            }`}
                          >
                            {isMine ? '⭐ ' : ''}
                            {lang === 'th' ? row.girlAssignee.displayNameTh : row.girlAssignee.displayNameEn}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-white py-2 px-3 text-center text-xs sm:text-sm font-extrabold text-[#D01F2F] border-t border-[#FCE6ED]">
                {lang === 'th' ? TRASH_DUTY_RULE_TH : TRASH_DUTY_RULE_EN}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB 2: MORNING COMPOUND / HOUSE ZONE DUTY ---------------- */}
      {activeTab === 'morning_zone' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#BCE6DE] bg-[#F2FBF9] px-4 py-3 text-xs text-[#194E46] space-y-1">
            <div className="font-extrabold text-sm">
              🧹 {lang === 'th' ? 'ตารางเวรทำเขตบริเวณตอนเช้า (หมุนเวียนประจำวัน)' : 'Morning Compound & House Zone Chores'}
            </div>
            <p>
              {lang === 'th'
                ? 'น้องๆ ช่วยกันดูแลความสะอาดเขตบริเวณต่างๆ ตอนเช้าตามรายการด้านล่าง ทำเสร็จกดรับ +5 ⭐ ได้ทุกวันค่ะ'
                : 'Daily rotating compound & house zone assignments (+5 stars upon completion).'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5DDD4] bg-white overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[540px]">
              <thead>
                <tr className="bg-[#EEF9F6] border-b border-[#CFECE6] text-[#1B5149]">
                  <th className="py-2.5 px-3 font-extrabold">{lang === 'th' ? 'น้อง' : 'Kid'}</th>
                  <th className="py-2.5 px-3 font-extrabold">{lang === 'th' ? 'กลุ่ม' : 'Group'}</th>
                  <th className="py-2.5 px-3 font-extrabold">{lang === 'th' ? 'เขตบริเวณที่รับผิดชอบวันนี้' : "Today's Assigned Zone"}</th>
                  <th className="py-2.5 px-3 text-center font-extrabold">{lang === 'th' ? 'สถานะวันนี้' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {sortedKidsForView.map((k) => {
                  const chore = getDailyHouseChoreForKid(k, kids, now);
                  const isMe = currentKid?.id === k.id;
                  return (
                    <tr
                      key={k.id}
                      className={`border-b border-[#F3EEE7] ${
                        isMe ? 'bg-[#FFFBE8] font-bold' : 'hover:bg-[#FFFDF9]'
                      }`}
                    >
                      <td className="py-2 px-3 whitespace-nowrap font-bold">
                        {isMe ? '⭐ ' : ''}
                        {k.emoji} {k.nickname}
                      </td>
                      <td className="py-2 px-3 text-[#6E5C52] whitespace-nowrap">
                        {k.group === 1 ? 'น้องเล็ก' : k.group === 2 ? 'ประถม/มัธยม' : 'พี่ใหญ่'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-[#2E3836]">
                          {chore.emoji} {lang === 'th' ? chore.titleTh : chore.titleEn}
                        </div>
                        <div className="text-[10px] text-[#75665D]">
                          {chore.id === 'custom'
                            ? lang === 'th'
                              ? '📌 พี่เลี้ยงมอบหมายเขตพิเศษ'
                              : '📌 Custom Staff Assignment'
                            : lang === 'th'
                            ? chore.detailTh
                            : chore.detailEn}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                            k.daily.houseChoreDone
                              ? 'bg-[#DDF7EF] text-[#175B4B]'
                              : 'bg-[#FFF3E0] text-[#804C13]'
                          }`}
                        >
                          {k.daily.houseChoreDone
                            ? lang === 'th'
                              ? '✅ เสร็จแล้ว'
                              : '✅ Done'
                            : lang === 'th'
                            ? '⏳ รอทำ'
                            : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {HOUSE_CHORES_POOL.map((zone) => (
              <div
                key={zone.id}
                className="rounded-xl border border-[#EAE1D8] bg-[#FFFDF9] p-2.5 text-xs"
              >
                <div className="font-bold text-[#3D322C]">
                  {zone.emoji} {lang === 'th' ? zone.titleTh : zone.titleEn}
                </div>
                <div className="text-[11px] text-[#7B695F] mt-0.5">
                  {lang === 'th' ? zone.detailTh : zone.detailEn}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: KITCHEN DUTY MATRIX ---------------- */}
      {activeTab === 'kitchen' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#F2D8B3] bg-[#FFF9EF] px-4 py-3 text-xs text-[#6B4311] space-y-1">
            <div className="font-extrabold text-sm">
              🍳 {lang === 'th' ? 'ตารางเวรห้องครัวประจำสัปดาห์ (แม่ครัวตรวจสอบ)' : 'Weekly Kitchen Duty Matrix'}
            </div>
            <p>
              {lang === 'th'
                ? 'แบ่งเป็น 3 รอบหลัก: เย็นวันธรรมดา 15:30 น. · เช้าเสาร์/นักขัตฤกษ์ 09:30 น. · เช้าวันอาทิตย์ 09:15 น.'
                : '3 slots: Weekday Evening 15:30 · Sat/Holiday Morning 09:30 · Sunday Morning 09:15'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#EBD8C3] bg-white overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-[#FFF4E2] border-b border-[#EBD8C3] text-[#5C3A12]">
                  <th className="py-2.5 px-3 text-left font-extrabold">{lang === 'th' ? 'น้อง' : 'Kid'}</th>
                  <th className="py-2.5 px-3 font-extrabold">🌆 {lang === 'th' ? 'เย็น 15:30 น.' : 'Evening 15:30'}</th>
                  <th className="py-2.5 px-3 font-extrabold">🌤️ {lang === 'th' ? 'เสาร์/นักขัตฯ 09:30' : 'Sat/Holiday 09:30'}</th>
                  <th className="py-2.5 px-3 font-extrabold">☀️ {lang === 'th' ? 'อาทิตย์ 09:15 น.' : 'Sunday 09:15'}</th>
                </tr>
              </thead>
              <tbody>
                {sortedKidsForView.map((k) => {
                  const isMe = currentKid?.id === k.id;
                  const slots: Array<{ key: keyof KitchenDutyAssignment; active: boolean }> = [
                    { key: 'evening1530', active: Boolean(k.kitchenDuty?.evening1530) },
                    { key: 'sat0930', active: Boolean(k.kitchenDuty?.sat0930) },
                    { key: 'sun0915', active: Boolean(k.kitchenDuty?.sun0915) },
                  ];
                  return (
                    <tr
                      key={`kitchen-${k.id}`}
                      className={`border-b border-[#F3ECE4] ${
                        isMe ? 'bg-[#FFFBE8] font-bold' : 'hover:bg-[#FFFDF9]'
                      }`}
                    >
                      <td className="py-2 px-3 text-left whitespace-nowrap font-bold">
                        {isMe ? '⭐ ' : ''}
                        {k.emoji} {k.nickname}
                      </td>
                      {slots.map((s) => (
                        <td key={s.key} className="py-2 px-3">
                          {onToggleKitchenSlot ? (
                            <input
                              type="checkbox"
                              checked={s.active}
                              onChange={(e) =>
                                onToggleKitchenSlot(k.id, s.key, e.target.checked)
                              }
                              className="h-4 w-4 accent-[#E66C85] cursor-pointer"
                            />
                          ) : s.active ? (
                            <span className="inline-block rounded-lg bg-[#FFE8CC] text-[#7A3F06] px-2.5 py-0.5 font-bold">
                              ✓ มีเวร
                            </span>
                          ) : (
                            <span className="text-[#BFB2A7]">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
