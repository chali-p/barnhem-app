import React, { useMemo, useState } from 'react';
import {
  analyzeStaffLeaveImpact,
  CORE_ROSTER_STAFF,
  formatLeaveKindTh,
  formatLeaveSpanTh,
  formatMinutesToHHMM,
  getShiftCoverageAtDateTime,
} from '../data/staffSchedule';
import {
  Language,
  Member,
  ModalAlertPayload,
  StaffLeaveKind,
  StaffLeaveRecord,
  StaffLeaveSpan,
} from '../types/barnhem';
import { getDateKey, getTomorrowDateKey } from '../utils/timeRules';

interface StaffLeavePanelProps {
  actorName: string;
  defaultStaffName?: string;
  members: Member[];
  staffLeaves: StaffLeaveRecord[];
  now: Date;
  lang: Language;
  isPublicHolidayToday?: boolean;
  isLeadership?: boolean; // Manager or Creator
  onSubmitLeave: (leave: StaffLeaveRecord) => void;
  onUpdateLeaveSubstitute: (leaveId: string, substituteName: string) => void;
  onAcknowledgeLeave: (leaveId: string, byName: string) => void;
  onCancelLeave: (leaveId: string) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const StaffLeavePanel: React.FC<StaffLeavePanelProps> = ({
  actorName,
  defaultStaffName,
  members,
  staffLeaves,
  now,
  lang,
  isPublicHolidayToday = false,
  isLeadership = false,
  onSubmitLeave,
  onUpdateLeaveSubstitute,
  onAcknowledgeLeave,
  onCancelLeave,
  onShowAlert,
  collapsed = false,
  onToggleCollapse,
}) => {
  const todayKey = getDateKey(now);
  const tomorrowKey = getTomorrowDateKey(now);
  const currentHHMM = formatMinutesToHHMM(now.getHours() * 60 + now.getMinutes());

  const staffOptions = useMemo(() => {
    const names = new Set<string>([...CORE_ROSTER_STAFF]);
    members
      .filter((m) => m.role !== 'kid')
      .forEach((m) => {
        if (m.nickname?.trim()) names.add(m.nickname.trim());
      });
    return Array.from(names);
  }, [members]);

  const initialStaff =
    defaultStaffName && staffOptions.includes(defaultStaffName)
      ? defaultStaffName
      : staffOptions[0] ?? 'พี่เอก';

  const [formOpen, setFormOpen] = useState(false);
  const [selectedStaffName, setSelectedStaffName] = useState(initialStaff);
  const [leaveDateKey, setLeaveDateKey] = useState(todayKey);
  const [leaveKind, setLeaveKind] = useState<StaffLeaveKind>('emergency');
  const [leaveSpan, setLeaveSpan] = useState<StaffLeaveSpan>('afternoon_from_time');
  const [leaveFromTime, setLeaveFromTime] = useState('11:00');
  const [substituteName, setSubstituteName] = useState('');
  const [reason, setReason] = useState('');
  const [subDrafts, setSubDrafts] = useState<Record<string, string>>({});

  const activeLeaves = useMemo(
    () =>
      staffLeaves
        .filter((l) => l.status === 'active')
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || b.createdAt.localeCompare(a.createdAt)),
    [staffLeaves]
  );

  const todayAndFutureLeaves = useMemo(
    () => activeLeaves.filter((l) => l.dateKey >= todayKey),
    [activeLeaves, todayKey]
  );

  const currentMonthKey = todayKey.slice(0, 7); // YYYY-MM
  const monthlyTally = useMemo(() => {
    const map = new Map<string, number>();
    CORE_ROSTER_STAFF.forEach((n) => map.set(n, 0));
    activeLeaves
      .filter((l) => l.dateKey.startsWith(currentMonthKey))
      .forEach((l) => {
        map.set(l.staffName, (map.get(l.staffName) ?? 0) + 1);
      });
    return Array.from(map.entries());
  }, [activeLeaves, currentMonthKey]);

  const liveNowCoverage = useMemo(
    () =>
      getShiftCoverageAtDateTime(
        now,
        now.getHours() * 60 + now.getMinutes(),
        staffLeaves,
        isPublicHolidayToday
      ),
    [now, staffLeaves, isPublicHolidayToday]
  );

  const impactPreview = useMemo(
    () =>
      analyzeStaffLeaveImpact(
        selectedStaffName,
        leaveDateKey || todayKey,
        leaveSpan,
        leaveFromTime,
        isPublicHolidayToday
      ),
    [selectedStaffName, leaveDateKey, todayKey, leaveSpan, leaveFromTime, isPublicHolidayToday]
  );

  const handleSaveLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedMember = members.find(
      (m) => m.role !== 'kid' && m.nickname === selectedStaffName
    );
    const effectiveDate = leaveDateKey || todayKey;

    const record: StaffLeaveRecord = {
      id: `leave_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      staffId: matchedMember?.id ?? `roster_${selectedStaffName}`,
      staffName: selectedStaffName,
      dateKey: effectiveDate,
      kind: leaveKind,
      span: leaveSpan,
      leaveFromTime: leaveSpan === 'afternoon_from_time' ? leaveFromTime || '11:00' : undefined,
      reason:
        reason.trim() ||
        (leaveKind === 'emergency'
          ? 'ลากะทันหัน'
          : leaveKind === 'sick'
          ? 'ลาป่วย'
          : leaveKind === 'swap'
          ? 'แลกกะกับเพื่อน'
          : 'ลากิจ'),
      substituteName: substituteName.trim() || undefined,
      status: 'active',
      acknowledgedBy: isLeadership ? actorName : undefined,
      acknowledgedAt: isLeadership ? now.toISOString() : undefined,
      recordedBy: actorName,
      createdAt: now.toISOString(),
    };

    onSubmitLeave(record);
    setReason('');
    setSubstituteName('');
    setFormOpen(false);

    onShowAlert({
      icon: '🏖️🔔',
      title:
        lang === 'th'
          ? `บันทึกแจ้งลา "${selectedStaffName}" เรียบร้อยแล้ว`
          : `Leave Recorded for ${selectedStaffName}`,
      message: `${formatLeaveKindTh(record.kind)} · วันที่ ${record.dateKey} · ${formatLeaveSpanTh(
        record
      )}\n${impactPreview.summaryTh}${
        record.substituteName
          ? `\n🔁 คนเข้าแทน: ${record.substituteName}`
          : '\n⚠️ ระบบได้ส่งแจ้งเตือนไปที่หน้าผู้จัดการ/ตารางเวรเพื่อจัดคนเข้าแทนแล้วค่ะ'
      }`,
      tone: record.substituteName ? 'mint' : 'yellow',
    });
  };

  return (
    <section
      id="staff-leave-section"
      className="no-print rounded-[28px] border-2 border-[#F3B7C0] bg-[#FFFDF9] p-5 pastel-shadow space-y-4"
    >
      {/* Header + Primary Action Button + Optional Collapse */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-[#3D322C]">
            🏖️🔔 {lang === 'th' ? 'ระบบแจ้งลางานพี่เลี้ยง · แจ้งเตือน & เช็คคนเข้าเวร' : 'Staff Leave, Alerts & Shift Coverage'}
          </h3>
          <p className="text-xs text-[#6E5C52] mt-0.5">
            {lang === 'th'
              ? 'แจ้งลากะทันหันหรือลาล่วงหน้า พร้อมแจ้งเตือนผู้บริหารและคำนวณคนเข้าเวร/ไนท์วอช ณ ช่วงเวลานั้นอัตโนมัติ'
              : 'Submit sudden or planned leave with instant alerts, Night Watch checks, and live shift coverage.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!collapsed && (
            <button
              type="button"
              onClick={() => {
                setLeaveFromTime(currentHHMM);
                setFormOpen((v) => !v);
              }}
              className={`min-h-[42px] rounded-2xl px-4 py-2 text-xs sm:text-sm font-extrabold cursor-pointer border transition-colors ${
                formOpen
                  ? 'bg-[#FADADD] border-[#E6889F] text-[#5B1D2C]'
                  : 'bg-[#3D322C] hover:bg-[#2B221D] border-[#3D322C] text-white'
              }`}
            >
              {formOpen
                ? lang === 'th'
                  ? '✕ ปิดฟอร์มแจ้งลา'
                  : '✕ Close Leave Form'
                : lang === 'th'
                ? '🏖️ + กดแจ้งลางาน / ลากะทันหัน'
                : '🏖️ + Submit Staff Leave'}
            </button>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap border ${
                collapsed
                  ? 'bg-[#FADADD] hover:bg-[#F5C2C8] border-[#E6889F] text-[#6E2638]'
                  : 'bg-[#F7F1EB] hover:bg-[#EDE2D7] border-[#E2D4C5] text-[#5C4B42]'
              }`}
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
          {/* Live Snapshot Banner: Who is on duty RIGHT NOW */}
          <div className="rounded-2xl border border-[#BFE6DE] bg-[#F2FBF9] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-[#114A42]">
                🟢 {lang === 'th' ? `เข้าเวรอยู่ตอนนี้ (${liveNowCoverage.timeLabel} น.):` : `On Duty Now (${liveNowCoverage.timeLabel}):`}
              </span>
              {liveNowCoverage.onDutyNowNames.length > 0 ? (
                liveNowCoverage.onDutyNowNames.map((n) => (
                  <span
                    key={n}
                    className="rounded-xl bg-white border border-[#8AD9CA] px-2.5 py-0.5 font-extrabold text-[#0E4A40]"
                  >
                    {n}
                  </span>
                ))
              ) : (
                <span className="font-extrabold text-[#8B1D36]">
                  ⚠️ {lang === 'th' ? 'ไม่มีคนเข้าเวรในช่วงเวลานี้!' : 'No active staff covered'}
                </span>
              )}
            </div>
            {todayAndFutureLeaves.length > 0 && (
              <span className="rounded-xl bg-[#FFE8ED] border border-[#F3B7C0] px-2.5 py-1 font-extrabold text-[#8B1D36]">
                🔔 {lang === 'th' ? `มีรายการลาวันนี้/ล่วงหน้า ${todayAndFutureLeaves.length} รายการ` : `${todayAndFutureLeaves.length} active leave(s)`}
              </span>
            )}
          </div>

          {/* Alerts Strip */}
          {liveNowCoverage.alertsTh.length > 0 && (
            <div className="space-y-1.5">
              {liveNowCoverage.alertsTh.map((a, idx) => (
                <div
                  key={`${a.severity}_${idx}`}
                  className={`rounded-2xl border px-3.5 py-2 text-xs font-bold ${
                    a.severity === 'critical'
                      ? 'border-[#EE8CA3] bg-[#FFE8ED] text-[#8B1D36]'
                      : a.severity === 'warning'
                      ? 'border-[#F2C36B] bg-[#FFF5D6] text-[#6B4700]'
                      : 'border-[#C8B7EB] bg-[#F6F2FF] text-[#3E2B63]'
                  }`}
                >
                  {a.text}
                </div>
              ))}
            </div>
          )}

          {/* Leave Submission Form */}
          {formOpen && (
            <form
              onSubmit={handleSaveLeave}
              className="rounded-2xl border-2 border-[#F3B7C0] bg-[#FFF8FA] p-4 space-y-3 text-xs sm:text-sm"
            >
              <div className="font-extrabold text-[#7A2034]">
                ✍️ {lang === 'th' ? 'กรอกใบแจ้งลางาน / ลากะทันหัน (ใช้เวลา 10 วินาที)' : 'Quick Staff Leave Form'}
              </div>

              {/* 1. Who is taking leave */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#5A3942] block">
                  1️⃣ {lang === 'th' ? 'พี่เลี้ยงที่ขอลา:' : 'Staff Member:'}
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CORE_ROSTER_STAFF.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedStaffName(name)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold border cursor-pointer ${
                        selectedStaffName === name
                          ? 'bg-[#3D322C] border-[#3D322C] text-white'
                          : 'bg-white border-[#EBD8C3] text-[#3D322C] hover:bg-[#FFF5BA]/50'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                  <select
                    value={selectedStaffName}
                    onChange={(e) => setSelectedStaffName(e.target.value)}
                    className="rounded-xl border border-[#EBD8C3] bg-white px-2.5 py-1.5 text-xs font-bold"
                  >
                    {staffOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Date + Kind + Time Span */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#5A3942] block">
                    2️⃣ {lang === 'th' ? 'วันที่ลา (วันนี้ หรือ วันในอนาคต):' : 'Leave Date:'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLeaveDateKey(todayKey)}
                      className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border cursor-pointer ${
                        leaveDateKey === todayKey
                          ? 'bg-[#FFE4E9] border-[#E6889F] text-[#7A2034]'
                          : 'bg-white border-[#EBD8C3] text-[#5C4B42]'
                      }`}
                    >
                      วันนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveDateKey(tomorrowKey)}
                      className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border cursor-pointer ${
                        leaveDateKey === tomorrowKey
                          ? 'bg-[#FFE4E9] border-[#E6889F] text-[#7A2034]'
                          : 'bg-white border-[#EBD8C3] text-[#5C4B42]'
                      }`}
                    >
                      พรุ่งนี้
                    </button>
                    <input
                      type="date"
                      value={leaveDateKey}
                      onChange={(e) => setLeaveDateKey(e.target.value || todayKey)}
                      className="flex-1 rounded-xl border border-[#EBD8C3] bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#5A3942] block">
                    3️⃣ {lang === 'th' ? 'ประเภทการลา:' : 'Leave Type:'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'emergency', label: '⚡ ลากะทันหัน' },
                        { id: 'sick', label: '🤒 ลาป่วย' },
                        { id: 'personal', label: '📝 ลากิจ' },
                        { id: 'swap', label: '🔁 แลกกะ' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLeaveKind(opt.id)}
                        className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border cursor-pointer ${
                          leaveKind === opt.id
                            ? 'bg-[#3D322C] border-[#3D322C] text-white'
                            : 'bg-white border-[#EBD8C3] text-[#3D322C]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#5A3942] block">
                    4️⃣ {lang === 'th' ? 'ช่วงเวลาที่ลา:' : 'Time Span:'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'full_day', label: 'ทั้งวัน' },
                        { id: 'morning', label: 'ครึ่งเช้า' },
                        { id: 'afternoon_from_time', label: 'ตั้งแต่เวลา...' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLeaveSpan(opt.id)}
                        className={`rounded-xl px-2.5 py-1.5 text-xs font-bold border cursor-pointer ${
                          leaveSpan === opt.id
                            ? 'bg-[#5A3E8C] border-[#5A3E8C] text-white'
                            : 'bg-white border-[#EBD8C3] text-[#3D322C]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {leaveSpan === 'afternoon_from_time' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <input
                        type="time"
                        value={leaveFromTime}
                        onChange={(e) => setLeaveFromTime(e.target.value)}
                        className="rounded-xl border border-[#C8B7EB] bg-white px-2.5 py-1 text-xs font-extrabold tabular-nums"
                      />
                      {['11:00', '13:00', '15:00', '17:00'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLeaveFromTime(t)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold border cursor-pointer ${
                            leaveFromTime === t
                              ? 'bg-[#EFE8FC] border-[#9F84D6] text-[#3E2B63]'
                              : 'bg-white border-[#E5DDF5] text-[#5B4B7A]'
                          }`}
                        >
                          {t} น.
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* LIVE Shift Impact Preview */}
              <div
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                  impactPreview.hasNightWatch
                    ? 'border-[#EE8CA3] bg-[#FFE8ED] text-[#8B1D36]'
                    : impactPreview.affectedDuties.length > 0
                    ? 'border-[#F2C36B] bg-[#FFF8DB] text-[#6B4700]'
                    : 'border-[#BFE6DE] bg-[#F2FBF9] text-[#114A42]'
                }`}
              >
                🔍 <strong>{lang === 'th' ? 'ตรวจสอบผลกระทบเวรอัตโนมัติ:' : 'Auto Shift Impact:'}</strong>{' '}
                {impactPreview.summaryTh}
              </div>

              {/* 5. Substitute + Reason */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#5A3942] block">
                    5️⃣ {lang === 'th' ? 'ผู้เข้าเวรแทน (ถ้าตกลงกันแล้ว):' : 'Substitute Caretaker (Optional):'}
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    <button
                      type="button"
                      onClick={() => setSubstituteName('')}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold border cursor-pointer ${
                        !substituteName
                          ? 'bg-[#FFF5BA] border-[#E8C149] text-[#5A4208]'
                          : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                      }`}
                    >
                      ขอหัวหน้าช่วยจัด
                    </button>
                    {CORE_ROSTER_STAFF.filter((n) => n !== selectedStaffName).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSubstituteName(n)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold border cursor-pointer ${
                          substituteName === n
                            ? 'bg-[#D4F0F0] border-[#7ECBB9] text-[#114A42]'
                            : 'bg-white border-[#EBD8C3] text-[#3D322C]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={substituteName}
                    onChange={(e) => setSubstituteName(e.target.value)}
                    placeholder={lang === 'th' ? 'หรือพิมพ์ชื่อคนเข้าแทน...' : 'Or type substitute name...'}
                    className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#5A3942] block">
                    6️⃣ {lang === 'th' ? 'เหตุผล / หมายเหตุสั้นๆ:' : 'Reason / Note:'}
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {['ไม่สบายกะทันหัน', 'ธุระครอบครัวด่วน', 'ไปหาหมอ', 'แลกกะกับเพื่อน'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setReason(preset)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold border cursor-pointer ${
                          reason === preset
                            ? 'bg-[#FADADD] border-[#E6889F] text-[#5B1D2C]'
                            : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={lang === 'th' ? 'ระบุเหตุผลเพิ่มเติม...' : 'Short reason...'}
                    className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-[#EBD8C3] bg-white px-4 py-2 text-xs font-bold text-[#6E5C52] cursor-pointer"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-5 py-2 text-xs font-extrabold cursor-pointer"
                >
                  ✅ {lang === 'th' ? 'บันทึกแจ้งลา & ส่งแจ้งเตือน' : 'Save & Alert Team'}
                </button>
              </div>
            </form>
          )}

          {/* Active & Upcoming Leaves List */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-extrabold text-[#3D322C]">
                📋{' '}
                {lang === 'th'
                  ? `รายการลางานวันนี้ & ล่วงหน้า (${todayAndFutureLeaves.length} รายการ)`
                  : `Today & Upcoming Leaves (${todayAndFutureLeaves.length})`}
              </span>
              <span className="text-[11px] text-[#7B695F]">
                {lang === 'th'
                  ? `สถิติเดือนนี้ (${currentMonthKey}): ${monthlyTally
                      .map(([name, cnt]) => `${name} ${cnt}`)
                      .join(' · ')}`
                  : `Month (${currentMonthKey}): ${monthlyTally.map(([n, c]) => `${n}:${c}`).join(' ')}`}
              </span>
            </div>

            {todayAndFutureLeaves.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#DFD2C5] bg-[#FAF7F3] px-4 py-3 text-xs text-[#7B695F]">
                ✨ {lang === 'th' ? 'ยังไม่มีรายการพี่เลี้ยงลางานวันนี้หรือล่วงหน้า — ทุกคนเข้าเวรตามปกติค่ะ' : 'No active or upcoming leaves — full roster scheduled.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {todayAndFutureLeaves.map((lv) => {
                  const subDraft = subDrafts[lv.id] ?? lv.substituteName ?? '';
                  const impact = analyzeStaffLeaveImpact(
                    lv.staffName,
                    lv.dateKey,
                    lv.span,
                    lv.leaveFromTime,
                    isPublicHolidayToday
                  );
                  return (
                    <div
                      key={lv.id}
                      className={`rounded-2xl border p-3 text-xs space-y-2 ${
                        !lv.substituteName && impact.needsSubstitute
                          ? 'border-[#EE8CA3] bg-[#FFF5F7]'
                          : 'border-[#EBD8C3] bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-lg bg-[#3D322C] text-white px-2 py-0.5 font-extrabold">
                            {lv.staffName}
                          </span>
                          <span className="font-bold text-[#7A2034]">{formatLeaveKindTh(lv.kind)}</span>
                          <span className="font-bold text-[#3D322C]">
                            · 📅 {lv.dateKey} (วัน{impact.dayTh})
                          </span>
                          <span className="text-[#5A483E]">· ⏰ {formatLeaveSpanTh(lv)}</span>
                          {lv.reason && <span className="text-[#7B695F]">({lv.reason})</span>}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {lv.acknowledgedBy ? (
                            <span className="rounded-lg bg-[#DCF7F2] border border-[#8AD9CA] px-2 py-0.5 text-[11px] font-bold text-[#114A42]">
                              ✓ รับทราบโดย {lv.acknowledgedBy}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAcknowledgeLeave(lv.id, actorName)}
                              className="rounded-lg bg-[#EFE8FC] hover:bg-[#E1D4FA] border border-[#C8B7EB] px-2.5 py-1 text-[11px] font-bold text-[#3E2B63] cursor-pointer"
                            >
                              ✓ {lang === 'th' ? 'กดรับทราบ' : 'Acknowledge'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onCancelLeave(lv.id)}
                            className="rounded-lg bg-[#F5ECE2] hover:bg-[#E9D9C8] px-2.5 py-1 text-[11px] font-bold text-[#5C4B42] cursor-pointer"
                          >
                            ↩️ {lang === 'th' ? 'ยกเลิกลา / กลับมาแล้ว' : 'Cancel Leave'}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#F4ECE4]">
                        <div className="text-[11px] text-[#6E5C52]">
                          {impact.affectedDuties.length > 0
                            ? `เวรที่กระทบ: ${impact.affectedDuties.join(' · ')}`
                            : 'ไม่กระทบกะหลัก'}
                          <span className="ml-2 text-[#9A887E]">(บันทึกโดย {lv.recordedBy})</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[#114A42]">🔁 คนเข้าแทน:</span>
                          <input
                            type="text"
                            value={subDraft}
                            onChange={(e) =>
                              setSubDrafts((prev) => ({ ...prev, [lv.id]: e.target.value }))
                            }
                            placeholder="ระบุชื่อคนเข้าแทน..."
                            className="rounded-lg border border-[#D8C7B8] bg-white px-2 py-1 text-[11px] font-bold w-36"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateLeaveSubstitute(lv.id, subDraft.trim());
                              onShowAlert({
                                icon: '🔁✅',
                                title: lang === 'th' ? 'อัปเดตผู้เข้าเวรแทนแล้ว' : 'Substitute Updated',
                                message: subDraft.trim()
                                  ? `กำหนดให้ "${subDraft.trim()}" เข้าแทน "${lv.staffName}" วันที่ ${lv.dateKey} เรียบร้อยค่ะ`
                                  : `ล้างชื่อคนเข้าแทนของ ${lv.staffName} แล้ว`,
                                tone: 'mint',
                              });
                            }}
                            className="rounded-lg bg-[#114A42] hover:bg-[#0D3A34] text-white px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                          >
                            {lang === 'th' ? 'บันทึกแทน' : 'Save Sub'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
