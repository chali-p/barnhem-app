import React, { useState } from 'react';
import {
  formatLeaveKindTh,
  formatLeaveSpanTh,
  formatMinutesToHHMM,
  getMorningStaffInfo,
  getShiftCoverageAtDateTime,
  getStaffScheduleForDate,
  parseDateKeyToLocalDate,
  parseTimeToMinutes,
  WEEKLY_STAFF_SCHEDULE,
} from '../data/staffSchedule';
import { Language, StaffLeaveRecord } from '../types/barnhem';
import { getDateKey } from '../utils/timeRules';
import { TimeAmPmInput } from './TimeAmPmInput';

interface StaffRosterPanelProps {
  now: Date;
  lang: Language;
  isPublicHolidayToday?: boolean;
  compactHeader?: boolean;
  staffLeaves?: StaffLeaveRecord[];
}

export const StaffRosterPanel: React.FC<StaffRosterPanelProps> = ({
  now,
  lang,
  isPublicHolidayToday = false,
  compactHeader = false,
  staffLeaves = [],
}) => {
  const [simulateMorningAbsent, setSimulateMorningAbsent] = useState(false);
  const [useCustomDateTime, setUseCustomDateTime] = useState(false);
  const [inspectDateKey, setInspectDateKey] = useState(() => getDateKey(now));
  const [inspectTimeStr, setInspectTimeStr] = useState(() =>
    formatMinutesToHHMM(now.getHours() * 60 + now.getMinutes())
  );

  const effectiveDate = useCustomDateTime ? parseDateKeyToLocalDate(inspectDateKey) : now;
  const effectiveMinutes = useCustomDateTime
    ? parseTimeToMinutes(inspectTimeStr)
    : now.getHours() * 60 + now.getMinutes();

  const todayRow = getStaffScheduleForDate(effectiveDate);
  const coverage = getShiftCoverageAtDateTime(
    effectiveDate,
    effectiveMinutes,
    staffLeaves,
    isPublicHolidayToday
  );

  const morningInfo = getMorningStaffInfo(todayRow, {
    lang,
    isHolidayOrSchoolBreak: isPublicHolidayToday,
    morningAbsentSubstitute: simulateMorningAbsent,
  });

  const morningLabel =
    lang === 'th' ? todayRow.drivingMorningTh : todayRow.drivingMorningEn;
  const eveningLabel =
    lang === 'th' ? todayRow.drivingEveningTh : todayRow.drivingEveningEn;
  const shiftDLabel = lang === 'th' ? todayRow.shiftDTh : todayRow.shiftDEn;
  const shiftCLabel = lang === 'th' ? todayRow.shiftCTh : todayRow.shiftCEn;
  const nightWatchLabel =
    lang === 'th' ? todayRow.nightWatchTh : todayRow.nightWatchEn;
  const dayOffLabel = lang === 'th' ? todayRow.dayOffTh : todayRow.dayOffEn;

  return (
    <div className="space-y-4 text-[#3D322C]">
      {!compactHeader && (
        <div>
          <h3 className="text-lg font-bold">
            👩‍🏫🚐 {lang === 'th' ? 'ตารางพี่เลี้ยง ไนท์วอช & ตารางขับรถ' : 'Staff Shift, Night Watch & Driving Roster'}
          </h3>
          <p className="text-xs text-[#6E5C52] mt-0.5">
            {lang === 'th'
              ? 'เช็คได้แบบเรียลไทม์หรือเลือกวัน-เวลาในอนาคต เพื่อดูว่า ณ ช่วงเวลานั้นใครเข้าเวรอยู่บ้าง ใครลางาน และใครเข้าแทนค่ะ'
              : 'Real-time & future shift checker: see who is on duty at any specific time, who is on leave, and who is covering.'}
          </p>
        </div>
      )}

      {/* Alerts from Leaves / Uncovered Shifts */}
      {coverage.alertsTh.length > 0 && (
        <div className="space-y-2">
          {coverage.alertsTh.map((alert, idx) => (
            <div
              key={`${alert.severity}_${idx}`}
              className={`rounded-2xl border-2 px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 ${
                alert.severity === 'critical'
                  ? 'border-[#EE8CA3] bg-[#FFE8ED] text-[#8B1D36]'
                  : alert.severity === 'warning'
                  ? 'border-[#F2C36B] bg-[#FFF5D6] text-[#6B4700]'
                  : 'border-[#B89FE8] bg-[#F5F0FF] text-[#3E2B63]'
              }`}
            >
              <span>{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Live / Any Date-Time Duty Radar ("ใครเข้าเวร ณ ช่วงเวลานั้น") */}
      <div className="rounded-2xl border-2 border-[#9AD3C8] bg-[#F2FBF9] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm sm:text-base font-extrabold text-[#114A42]">
              🕒{' '}
              {lang === 'th'
                ? `ใครเข้าเวรอยู่ ณ ${useCustomDateTime ? `วันที่ ${coverage.dateKey}` : 'ตอนนี้'} เวลา ${coverage.timeLabel} น. (วัน${todayRow.dayTh})`
                : `On Duty at ${coverage.dateKey} ${coverage.timeLabel} (${todayRow.dayEn})`}
            </div>
            <p className="text-[11px] text-[#2A665D]">
              {lang === 'th'
                ? 'เลือกวันและเวลาอื่นได้เพื่อเช็คเวรล่วงหน้าหรือจำลองช่วงเวลาที่ต้องการ'
                : 'Switch to any future date & time to inspect shift coverage ahead of time.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setUseCustomDateTime(false)}
              className={`rounded-xl px-2.5 py-1.5 font-bold border cursor-pointer ${
                !useCustomDateTime
                  ? 'bg-[#114A42] border-[#114A42] text-white'
                  : 'bg-white border-[#B9E2DA] text-[#114A42]'
              }`}
            >
              🔴 {lang === 'th' ? 'เวลาจริงตอนนี้' : 'Live Now'}
            </button>
            {['06:30', '11:00', '15:30', '20:00', '23:15'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setInspectTimeStr(t);
                  setUseCustomDateTime(true);
                }}
                className={`rounded-xl px-2 py-1.5 font-bold border cursor-pointer tabular-nums ${
                  useCustomDateTime && inspectTimeStr === t
                    ? 'bg-[#2C7A6F] border-[#2C7A6F] text-white'
                    : 'bg-white border-[#C9E8E1] text-[#225E55] hover:bg-[#E4F7F3]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Date + Custom Time Selector Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[#B9E2DA] px-2.5 py-1 font-bold text-[#114A42]">
            <span>📅 {lang === 'th' ? 'วันที่:' : 'Date:'}</span>
            <input
              type="date"
              value={useCustomDateTime ? inspectDateKey : getDateKey(now)}
              onChange={(e) => {
                if (e.target.value) {
                  setInspectDateKey(e.target.value);
                  setUseCustomDateTime(true);
                }
              }}
              className="bg-transparent font-bold outline-none"
            />
          </label>
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-white border border-[#B9E2DA] px-2.5 py-1 font-bold text-[#114A42]">
            <span>⏰ {lang === 'th' ? 'เวลา:' : 'Time:'}</span>
            <TimeAmPmInput
              value={useCustomDateTime ? inspectTimeStr : coverage.timeLabel}
              tone="mint"
              compact
              lang={lang}
              onChange={(nextHHMM) => {
                setInspectTimeStr(nextHHMM);
                setUseCustomDateTime(true);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            <span className="font-bold text-[#114A42]">
              ✅ {lang === 'th' ? 'ผู้เข้าเวร ณ เวลานี้:' : 'On Duty:'}
            </span>
            {coverage.onDutyNowNames.length > 0 ? (
              coverage.onDutyNowNames.map((name) => (
                <span
                  key={name}
                  className="rounded-xl bg-[#D2F4EC] border border-[#7ECBB9] px-2.5 py-0.5 font-extrabold text-[#0E4A40]"
                >
                  {name}
                </span>
              ))
            ) : (
              <span className="rounded-xl bg-[#FFE8ED] border border-[#EE8CA3] px-2.5 py-0.5 font-extrabold text-[#8B1D36]">
                ⚠️ {lang === 'th' ? 'ไม่มีคนเข้าเวร' : 'Uncovered'}
              </span>
            )}
          </div>
        </div>

        {/* Active Shift Slots Detail at Selected Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {coverage.activeSlots.map((slot) => (
            <div
              key={`${slot.slotCode}_${slot.timeRange}`}
              className={`rounded-xl border p-3 space-y-1.5 bg-white ${
                slot.warningTh ? 'border-[#F0B45A]' : 'border-[#CBEAE3]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-[#114A42]">{slot.labelTh}</span>
                <span className="text-[11px] font-mono font-bold text-[#4D7870]">{slot.timeRange}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {slot.entries.map((entry, idx) => (
                  <span
                    key={`${entry.name}_${idx}`}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                      entry.status === 'on_duty'
                        ? 'bg-[#E9F9F5] border border-[#A3DFD3] text-[#114A42]'
                        : entry.status === 'substitute'
                        ? 'bg-[#EFE8FC] border border-[#C8B7EB] text-[#3E2B63]'
                        : 'bg-[#FFE8ED] border border-[#F3B7C0] text-[#8B1D36] line-through'
                    }`}
                    title={
                      entry.status === 'on_leave' && entry.leave
                        ? `${formatLeaveKindTh(entry.leave.kind)} (${formatLeaveSpanTh(entry.leave)})`
                        : entry.status === 'substitute'
                        ? `เข้าแทน ${entry.replacingName}`
                        : undefined
                    }
                  >
                    {entry.status === 'substitute'
                      ? `🔁 ${entry.name} (แทน ${entry.replacingName})`
                      : entry.status === 'on_leave' && entry.leave
                      ? `${entry.name} · ลา (${entry.leave.span === 'afternoon_from_time' ? `ตั้งแต่ ${entry.leave.leaveFromTime || '11:00'}` : formatLeaveSpanTh(entry.leave)})`
                      : `✅ ${entry.name}`}
                  </span>
                ))}
              </div>
              {slot.warningTh && (
                <div className="text-[11px] font-bold text-[#9A4B00]">{slot.warningTh}</div>
              )}
            </div>
          ))}
        </div>

        {/* Leaves Listed for That Date */}
        {coverage.leavesForDate.length > 0 && (
          <div className="rounded-xl border border-[#F3B7C0] bg-[#FFF8FA] px-3 py-2 text-xs space-y-1">
            <div className="font-extrabold text-[#7A2034]">
              🏖️ {lang === 'th' ? `รายการลางานวันที่ ${coverage.dateKey} (${coverage.leavesForDate.length} รายการ)` : `Leaves on ${coverage.dateKey}`}
            </div>
            {coverage.leavesForDate.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 text-[#4E393F]">
                <span className="font-extrabold">{l.staffName}</span>
                <span>· {formatLeaveKindTh(l.kind)}</span>
                <span>· {formatLeaveSpanTh(l)}</span>
                {l.reason && <span className="text-[#7B5D66]">({l.reason})</span>}
                {l.substituteName ? (
                  <span className="rounded-lg bg-[#DCF7F2] border border-[#8AD9CA] px-2 py-0.5 text-[11px] font-bold text-[#114A42]">
                    🔁 แทนโดย: {l.substituteName}
                  </span>
                ) : (
                  <span className="rounded-lg bg-[#FFE8ED] border border-[#EE8CA3] px-2 py-0.5 text-[11px] font-bold text-[#8B1D36]">
                    ⚠️ ยังไม่ระบุคนเข้าแทน
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Highlight Card */}
      <div className="rounded-2xl border-2 border-[#C4DCF0] bg-[#F4F9FF] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm sm:text-base font-extrabold text-[#1E4769]">
            📅{' '}
            {lang === 'th'
              ? `${useCustomDateTime ? `วันที่ ${coverage.dateKey}` : 'วันนี้'}: วัน${todayRow.dayTh}${isPublicHolidayToday ? ' (วันหยุดนักขัตฤกษ์)' : ''}`
              : `Date: ${todayRow.dayEn}${isPublicHolidayToday ? ' (Public Holiday)' : ''}`}
          </div>

          <button
            type="button"
            onClick={() => setSimulateMorningAbsent((v) => !v)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
              simulateMorningAbsent
                ? 'bg-[#EFE8FC] border-[#B89FE8] text-[#3E2B63]'
                : 'bg-white border-[#C4DCF0] hover:bg-[#EAF4FF] text-[#2B5478]'
            }`}
          >
            {simulateMorningAbsent
              ? lang === 'th'
                ? '🔁 กำลังดูกรณี: พี่เลี้ยงเข้าเช้าไม่อยู่ (คลิกกลับปกติ)'
                : '🔁 Viewing: Morning Substitute'
              : lang === 'th'
              ? '👀 ลองดูกรณี: วันนี้พี่เลี้ยงเข้าเช้าไม่อยู่'
              : '👀 Preview Morning Substitute'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          <div className="rounded-xl bg-white border border-[#DCEEF8] p-3 space-y-1">
            <div className="text-[#6E5C52] font-semibold">
              🌅 {lang === 'th' ? `พี่เลี้ยงกะเช้า (${morningInfo.shiftTime})` : 'Morning Shift'}
            </div>
            <div className="text-sm font-extrabold text-[#1D4D73]">
              {morningInfo.effectiveStaff}
            </div>
            {morningInfo.substituteNote && (
              <div className="text-[11px] font-semibold text-[#5B3E96]">
                {morningInfo.substituteNote}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white border border-[#DCEEF8] p-3 space-y-1">
            <div className="text-[#6E5C52] font-semibold">
              🌆 {lang === 'th' ? 'พี่เลี้ยงกะเย็น (D 15:00–23:00 น.)' : 'Afternoon / Evening (D 15:00-23:00)'}
            </div>
            <div className="text-sm font-extrabold text-[#3D322C]">{shiftDLabel}</div>
            {shiftCLabel !== '—' && (
              <div className="text-[11px] font-semibold text-[#6E5C52]">
                {lang === 'th' ? `กะ C (09:00–17:00): ${shiftCLabel}` : `C (09:00-17:00): ${shiftCLabel}`}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white border border-[#DCEEF8] p-3 space-y-1">
            <div className="text-[#6E5C52] font-semibold">
              🌙 {lang === 'th' ? 'ไนท์วอชคืนนี้ · วันหยุด' : 'Night Watch · Day Off'}
            </div>
            <div className="text-sm font-extrabold text-[#3E2B63]">
              {lang === 'th' ? `ไนท์วอช: ${nightWatchLabel}` : `Night Watch: ${nightWatchLabel}`}
            </div>
            <div className="text-[11px] text-[#6E5C52]">
              {lang === 'th' ? `วันหยุดประจำวัน: ${dayOffLabel}` : `Day off: ${dayOffLabel}`}
            </div>
          </div>

          <div className="rounded-xl bg-[#FFFDF2] border border-[#F2DF9F] p-3 space-y-1 sm:col-span-2 lg:col-span-3">
            <div className="text-[#6B4D0A] font-bold">
              🚐 {lang === 'th' ? 'ตารางคนขับรถวันนี้' : "Today's Drivers"}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-extrabold text-[#3D322C]">
              <span>
                ☀️ {lang === 'th' ? 'เช้า:' : 'Morning:'}{' '}
                <span className="text-[#1D4D73]">{morningLabel}</span>
              </span>
              <span>
                🌇 {lang === 'th' ? 'เย็น:' : 'Evening:'}{' '}
                <span className={todayRow.eveningDriverHighlight ? 'text-[#B8253E]' : 'text-[#2F685E]'}>
                  {eveningLabel}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Morning Substitute Rule Highlight */}
      <div className="rounded-2xl border border-[#C8B7EB] bg-[#FAF7FF] px-4 py-3 text-xs space-y-1.5">
        <div className="font-extrabold text-[#3E2B63] text-sm">
          🔁 {lang === 'th' ? 'กติกาวันแทนกะเช้า (สำหรับเด็กๆ และพี่เลี้ยง)' : 'Morning Substitute Rules'}
        </div>
        <p>
          •{' '}
          {lang === 'th'
            ? 'ถ้าวันนั้นพี่เลี้ยงเข้าเช้าไม่อยู่: พี่กิ๊กจะเป็นคนเข้าแทนทั้งหมดค่ะ'
            : "If the scheduled morning staff is away, P'Kik covers all morning shifts."}
        </p>
        <p>
          •{' '}
          {lang === 'th'
            ? 'วันพฤหัสบดี (ปกติพี่กิ๊กเข้าเช้า): หากพี่กิ๊กเข้าเช้าไม่อยู่ พี่กุ๊กจะเป็นคนแทนทุกวันพฤหัสบดีเพิ่มอีก 1 วันค่ะ'
            : "On Thursdays (normally P'Kik), if P'Kik is away in the morning, P'Kuk covers Thursday morning as an extra substitute day."}
        </p>
      </div>

      {/* Full Weekly Schedule Table */}
      <div className="rounded-2xl border border-[#EBD8C3] bg-white overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[780px]">
          <thead>
            <tr className="bg-[#FAF4ED] border-b-2 border-[#EBD8C3] text-[#5A483E]">
              <th className="py-2.5 px-3 font-extrabold">{lang === 'th' ? 'วัน' : 'Day'}</th>
              <th className="py-2.5 px-2.5 text-center bg-[#FFF8EB]">A 05:30–13:30</th>
              <th className="py-2.5 px-2.5 text-center bg-[#FFF1EE]">B 07:00–15:00</th>
              <th className="py-2.5 px-2.5 text-center bg-[#FFFCE6]">C 09:00–17:00</th>
              <th className="py-2.5 px-2.5 bg-[#FFF6D6]">D 15:00–23:00</th>
              <th className="py-2.5 px-2.5 text-center bg-[#FDE7E7]">
                {lang === 'th' ? 'วันหยุด' : 'Off'}
              </th>
              <th className="py-2.5 px-2.5 text-center bg-[#F6F4FF]">
                {lang === 'th' ? 'ไนท์วอช' : 'Night Watch'}
              </th>
              <th className="py-2.5 px-2.5 text-center bg-[#F1F9F7]">
                {lang === 'th' ? 'ขับรถเช้า' : 'Morn. Drive'}
              </th>
              <th className="py-2.5 px-2.5 text-center bg-[#F1F9F7]">
                {lang === 'th' ? 'ขับรถเย็น' : 'Eve. Drive'}
              </th>
            </tr>
          </thead>
          <tbody>
            {WEEKLY_STAFF_SCHEDULE.map((row) => {
              const isToday = row.dayIndex === todayRow.dayIndex;
              return (
                <tr
                  key={row.dayIndex}
                  className={`border-b border-[#F2E9DF] ${
                    isToday ? 'bg-[#FFFBE6] font-bold' : 'hover:bg-[#FFFDF9]'
                  }`}
                >
                  <td className="py-2.5 px-3 whitespace-nowrap font-bold">
                    {isToday ? '👉 ' : ''}
                    {lang === 'th' ? row.dayTh : row.dayEn}
                  </td>
                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                    {lang === 'th' ? row.shiftATh : row.shiftAEn}
                  </td>
                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                    {lang === 'th' ? row.shiftBTh : row.shiftBEn}
                  </td>
                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                    {lang === 'th' ? row.shiftCTh : row.shiftCEn}
                  </td>
                  <td className="py-2.5 px-2.5 whitespace-nowrap">
                    {lang === 'th' ? row.shiftDTh : row.shiftDEn}
                  </td>
                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap text-[#8C3745]">
                    {lang === 'th' ? row.dayOffTh : row.dayOffEn}
                  </td>
                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap text-[#3E2B63] font-semibold">
                    {lang === 'th' ? row.nightWatchTh : row.nightWatchEn}
                  </td>
                  <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                    {lang === 'th' ? row.drivingMorningTh : row.drivingMorningEn}
                  </td>
                  <td
                    className={`py-2.5 px-2.5 text-center whitespace-nowrap ${
                      row.eveningDriverHighlight ? 'font-extrabold text-[#C22B3F]' : ''
                    }`}
                  >
                    {lang === 'th' ? row.drivingEveningTh : row.drivingEveningEn}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Holiday Shift Swap & Leave Guidelines from Schedule Sheet */}
      <div className="rounded-2xl border border-[#D4F0F0] bg-[#F3FBF9] px-4 py-3 text-xs text-[#214F4B] space-y-1.5">
        <div className="font-extrabold text-sm">
          📌 {lang === 'th' ? 'หมายเหตุการเปลี่ยนกะช่วงหยุดเรียน & การแลกกะ' : 'Holiday Shift Changes & Leave Notes'}
        </div>
        <p>
          <strong>1. {lang === 'th' ? 'การเปลี่ยนกะช่วงหยุดเรียน:' : 'School Holidays:'}</strong>{' '}
          {lang === 'th'
            ? 'วันหยุดนักขัตฤกษ์ / ปิดเทอม / วันหยุดโรงเรียน คนเข้ากะ A ต้องเปลี่ยนเป็นกะ B · ถ้ามีเด็กไปโรงเรียนวันเสาร์–อาทิตย์ คนเข้ากะ B ต้องย้ายมากะ A (หรือเวลาตามที่โรงเรียนกำหนด) เพื่อสอดคล้องกับตารางไนท์วอช'
            : 'On public holidays / school breaks, Shift A moves to Shift B (07:00-15:00). If kids have school on Sat/Sun, Shift B adjusts to Shift A (05:30-13:30) or school time.'}
        </p>
        <p>
          <strong>2. {lang === 'th' ? 'การลาและการแลกกะ:' : 'Leave & Shift Swap:'}</strong>{' '}
          {lang === 'th'
            ? 'ลากะทันหันทำได้เพราะมีพี่เลี้ยงทำงานทุกวัน (รบกวนแจ้งหัวหน้างานและเพื่อนร่วมงานกะเดียวกันในวันนั้น · หากลาหยุดยาวโปรดเช็คคนเข้าบ่ายและงดหยุดวันที่ไม่มีคนทำงาน · สามารถตกลงแลกกะกันเองได้)'
            : 'Emergency leave is possible (please notify supervisor and same-shift teammates; for long leave ensure afternoon coverage; staff may mutually swap shifts).'}
        </p>
      </div>
    </div>
  );
};
