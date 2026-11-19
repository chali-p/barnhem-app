import React, { useState } from 'react';
import { KidGroup, Language, Member, ModalAlertPayload } from '../types/barnhem';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';
import { getDateKey } from '../utils/timeRules';
import { PinPadModal } from './CenteredAlertModal';

interface TutorViewProps {
  members: Member[];
  now: Date;
  lang: Language;
  maxStarsPerKidPerDay: number;
  loggedInTutor: Member | null;
  onLoginTutor: (tutor: Member) => void;
  onLogoutTutor: () => void;
  onAwardStudyStars: (
    kidId: string,
    stars: number,
    reason: string,
    markExtraStudy?: boolean
  ) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

export const TutorView: React.FC<TutorViewProps> = ({
  members,
  now,
  lang,
  maxStarsPerKidPerDay,
  loggedInTutor,
  onLoginTutor,
  onLogoutTutor,
  onAwardStudyStars,
  onShowAlert,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<0 | KidGroup>(0);
  const pinGuard = usePinGuard('tutor');

  const dailyCap = Math.min(10, Math.max(0, Math.floor(maxStarsPerKidPerDay)));
  const todayKey = getDateKey(now);

  const tutors = members.filter((m) => m.role === 'tutor');
  // Strict PDPA + Asset Protection: expose ONLY nickname, id, group, study status & today's tutor-awarded count (NO wallet stars)
  const safeStudyKids = members
    .filter((m) => m.role === 'kid')
    .map((k) => {
      const history = k.starHistory ?? [];
      const tutorUsedToday = history
        .filter(
          (tx) =>
            tx.timestamp.slice(0, 10) === todayKey &&
            (tx.reason.includes('คุณครู') || tx.reason.includes('Tutor'))
        )
        .reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);

      return {
        id: k.id,
        emoji: k.emoji,
        nickname: k.nickname,
        group: k.group ?? 1,
        extraStudyChecked: Boolean(k.daily?.extraStudyChecked),
        homeworkSubject: k.daily?.homeworkRegisteredSubject ?? null,
        tutorUsedToday,
        starHistory: history,
      };
    });

  const tryLogin = (pin: string) => {
    if (pinGuard.isLocked) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
        message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
        tone: 'pink',
      });
      return;
    }
    const found = tutors.find((t) => t.pin === pin.trim());
    if (!found) {
      const res = pinGuard.recordFailure();
      setPinInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '👩‍🏫',
        title: res.lockedNow
          ? lang === 'th'
            ? 'ล็อกชั่วคราว 30 วินาที'
            : 'Locked for 30 Seconds'
          : lang === 'th'
          ? 'รหัส PIN คุณครูไม่ถูกต้อง'
          : 'Invalid Tutor PIN',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${lang === 'th' ? 'กรุณาใส่รหัส PIN 4 หลักประจำตัวคุณครูสอนพิเศษให้ถูกต้อง' : 'Please enter your valid 4-digit Tutor PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'lavender',
      });
      return;
    }
    pinGuard.recordSuccess();
    setPinInput('');
    setPinModalOpen(false);
    onLoginTutor(found);
  };

  if (!loggedInTutor) {
    return (
      <div className="max-w-md mx-auto rounded-[36px] border-2 border-[#C8B7EB] bg-[#FFFDF9] p-7 text-center pastel-shadow">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFE8FC] text-3xl">
          👩‍🏫
        </div>
        <h2 className="text-2xl font-bold text-[#3D322C]">
          {lang === 'th' ? 'โหมดคุณครูสอนพิเศษ' : 'Tutor Study Mode'}
        </h2>
        <p className="text-sm text-[#6E5C52] mt-1 mb-5">
          {lang === 'th'
            ? 'สำหรับคุณครูสอนพิเศษประจำบ้าน ใช้เช็คชื่อเข้าเรียนเสริมและให้ดาวตามเพดานที่พี่เลี้ยงกำหนด'
            : 'For regular tutors to take extra-study attendance & award stars within the staff-set cap.'}
        </p>

        {pinGuard.isLocked && (
          <div className="mb-3 rounded-2xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-2 text-xs font-bold text-[#8B1D36] tabular-nums">
            🔒 {formatPinLockoutMessage(pinGuard.remainingSec, lang)}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin(pinInput);
          }}
          className="space-y-3"
        >
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            disabled={pinGuard.isLocked}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={
              pinGuard.isLocked
                ? lang === 'th'
                  ? `รอ ${pinGuard.remainingSec} วินาที...`
                  : `Wait ${pinGuard.remainingSec}s...`
                : lang === 'th'
                ? 'รหัส PIN คุณครู 4 หลัก'
                : '4-digit Tutor PIN'
            }
            className="w-full rounded-2xl border-2 border-[#EBD8C3] bg-white px-4 py-3 text-center text-xl tracking-widest disabled:bg-[#F5ECE2]"
          />
          <button
            type="submit"
            disabled={pinGuard.isLocked}
            className="w-full min-h-[48px] rounded-2xl bg-[#EFE8FC] hover:bg-[#E5DBFA] border border-[#C8B7EB] text-[#3E2B63] font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            {lang === 'th' ? 'เข้าสู่ระบบคุณครู' : 'Sign In as Tutor'}
          </button>
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="w-full min-h-[44px] rounded-2xl bg-[#FFF8CC] hover:bg-[#FFF3B3] border border-[#F5DE93] text-[#5A4614] font-bold text-sm cursor-pointer transition-colors"
          >
            🔢 {lang === 'th' ? 'เปิดแป้นพิมพ์ PIN' : 'Open PIN Keypad'}
          </button>
        </form>

        <PinPadModal
          open={pinModalOpen}
          lang={lang}
          lockedRemainingSec={pinGuard.remainingSec}
          title={lang === 'th' ? 'เข้าสู่ระบบคุณครูสอนพิเศษ' : 'Tutor PIN Login'}
          onCancel={() => setPinModalOpen(false)}
          onSubmitPin={tryLogin}
        />
      </div>
    );
  }

  const filteredKids = safeStudyKids.filter((k) => {
    if (groupFilter !== 0 && k.group !== groupFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return k.nickname.toLowerCase().includes(q) || k.id.toLowerCase().includes(q);
  });

  const todayTutorLogs = safeStudyKids
    .flatMap((k) =>
      k.starHistory
        .filter(
          (tx) =>
            tx.timestamp.slice(0, 10) === todayKey &&
            (tx.reason.includes('คุณครู') || tx.reason.includes('Tutor'))
        )
        .map((tx) => ({
          ...tx,
          kidNickname: k.nickname,
          kidEmoji: k.emoji,
        }))
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const checkedStudyCount = safeStudyKids.filter((k) => k.extraStudyChecked).length;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="rounded-[28px] border-2 border-[#C8B7EB] bg-[#FFFDF9] p-5 flex flex-wrap items-center justify-between gap-4 pastel-shadow">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-2xl bg-[#EFE8FC] flex items-center justify-center text-2xl shrink-0">
            {loggedInTutor.emoji}
          </span>
          <div>
            <h2 className="text-xl font-bold text-[#3D322C]">
              {lang === 'th'
                ? `สวัสดี ${loggedInTutor.nickname} — โหมดคุณครูสอนพิเศษ`
                : `Hello ${loggedInTutor.nickname} — Tutor Study Mode`}
            </h2>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'th'
                ? `เข้าเรียนเสริมวันนี้แล้ว ${checkedStudyCount}/${safeStudyKids.length} คน · เพดานดาวจากพี่เลี้ยงวันนี้: สูงสุด ${dailyCap} ⭐/คน/วัน`
                : `Attended today: ${checkedStudyCount}/${safeStudyKids.length} · Staff star ceiling: ${dailyCap} ⭐/kid/day`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogoutTutor}
          className="min-h-[42px] rounded-2xl bg-[#FADADD] hover:bg-[#F3B7C0] px-4 py-2 text-sm font-bold text-[#5B1D2C] cursor-pointer transition-colors"
        >
          🚪 {lang === 'th' ? 'ออกจากโหมดคุณครู' : 'Logout Tutor'}
        </button>
      </div>

      {/* PDPA + Star Budget Guard Notice */}
      <div className="rounded-2xl border border-[#D3DDF7] bg-[#F7F9FF] px-4 py-3 text-xs text-[#2E3E6E] flex items-start gap-2.5">
        <span className="text-base shrink-0">🛡️</span>
        <span>
          {lang === 'th'
            ? `โหมดคุณครูสอนพิเศษแสดงเฉพาะชื่อเล่น กลุ่มชั้น การบ้าน และสถานะเรียนเสริม (ซ่อนเอกสารลับ ประวัติส่วนตัว บทลงโทษ และยอดดาวสะสม) โดยจำกัดการให้ดาวตามเพดานที่พี่เลี้ยงตั้งไว้สูงสุดไม่เกิน ${dailyCap} ⭐/คน/วัน`
            : `Privacy-safe study view only. Star rewards are strictly capped at ${dailyCap} ⭐ per student per day by Staff.`}
        </span>
      </div>

      {/* Filter & Kid Study Grid */}
      <section className="rounded-[28px] border-2 border-[#D8CDF2] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#3D322C]">
            📚 {lang === 'th' ? 'รายชื่อน้องสำหรับเช็คชื่อ & ให้ดาวการเรียน' : 'Students — Attendance & Study Stars'}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'th' ? '🔍 ค้นหาชื่อเล่น / รหัส...' : '🔍 Search nickname / ID...'}
              className="rounded-xl border border-[#DED5EF] bg-white px-3 py-1.5 text-xs text-[#3D322C] w-44 sm:w-52"
            />
            <div className="flex flex-wrap gap-1">
              {[
                { g: 0 as const, labelTh: 'ทั้งหมด', labelEn: 'All' },
                { g: 1 as const, labelTh: 'กลุ่ม 1 ประถม', labelEn: 'G1' },
                { g: 2 as const, labelTh: 'กลุ่ม 2 มัธยม', labelEn: 'G2' },
                { g: 3 as const, labelTh: 'กลุ่ม 3 วิทยาลัย', labelEn: 'G3' },
              ].map((tab) => (
                <button
                  key={tab.g}
                  type="button"
                  onClick={() => setGroupFilter(tab.g)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                    groupFilter === tab.g
                      ? 'bg-[#EFE8FC] border border-[#C8B7EB] text-[#3E2B63]'
                      : 'bg-white border border-[#EBD8C3] text-[#6E5C52] hover:bg-[#F7F3FD]'
                  }`}
                >
                  {lang === 'th' ? tab.labelTh : tab.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredKids.map((kid) => {
            const remainingQuota = Math.max(0, dailyCap - kid.tutorUsedToday);
            const attendanceBonus = Math.min(5, remainingQuota);
            const canGive5 = remainingQuota >= 5;
            const canGive10 = remainingQuota >= 10;

            return (
              <div
                key={kid.id}
                className="rounded-[22px] border border-[#E7DFF7] bg-[#FAF8FF] p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-extrabold text-[#3D322C]">
                        {kid.emoji} น้อง{kid.nickname}{' '}
                        <span className="text-xs font-normal text-[#7B695F]">({kid.id})</span>
                      </div>
                      <div className="text-xs text-[#6E5C52]">
                        {lang === 'th'
                          ? `กลุ่ม ${kid.group} (${
                              kid.group === 1 ? 'ประถม' : kid.group === 2 ? 'มัธยม' : 'วิทยาลัย/ฝึกงาน'
                            })`
                          : `Group ${kid.group}`}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold shrink-0 ${
                        remainingQuota > 0
                          ? 'bg-[#FFF8CC] border-[#F5DE93] text-[#5A4614]'
                          : 'bg-[#F3ECE6] border-[#DFD4C8] text-[#7B695F]'
                      }`}
                    >
                      {lang === 'th'
                        ? `โควต้าครู ${kid.tutorUsedToday}/${dailyCap} ⭐`
                        : `Today ${kid.tutorUsedToday}/${dailyCap} ⭐`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-bold ${
                        kid.extraStudyChecked
                          ? 'bg-[#DCF7F2] text-[#19534B] border border-[#9FE2D6]'
                          : 'bg-white text-[#7B695F] border border-[#E5DAD0]'
                      }`}
                    >
                      {kid.extraStudyChecked
                        ? lang === 'th'
                          ? '📚 เข้าเรียนเสริมแล้ว'
                          : '📚 Attended'
                        : lang === 'th'
                        ? '⏳ ยังไม่เช็คเข้าเรียน'
                        : '⏳ Not checked'}
                    </span>

                    <span className="rounded-full bg-white border border-[#E7DFF7] px-2.5 py-0.5 font-medium text-[#5B4782]">
                      📝{' '}
                      {kid.homeworkSubject
                        ? lang === 'th'
                          ? `การบ้าน: ${kid.homeworkSubject}`
                          : `HW: ${kid.homeworkSubject}`
                        : lang === 'th'
                        ? 'ยังไม่ระบุวิชาการบ้าน'
                        : 'No homework noted'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={kid.extraStudyChecked}
                    onClick={() => {
                      onAwardStudyStars(
                        kid.id,
                        attendanceBonus,
                        attendanceBonus > 0
                          ? `👩‍🏫 คุณครู${loggedInTutor.nickname}: เช็คชื่อเข้าเรียนเสริม (+${attendanceBonus} ⭐)`
                          : `👩‍🏫 คุณครู${loggedInTutor.nickname}: เช็คชื่อเข้าเรียนเสริม (0 ⭐)`,
                        true
                      );
                      onShowAlert({
                        icon: '📚✨',
                        title:
                          attendanceBonus > 0
                            ? lang === 'th'
                              ? `เช็คชื่อเรียนเสริมแล้ว (+${attendanceBonus} ⭐)`
                              : `Study Attendance Saved (+${attendanceBonus} ⭐)`
                            : lang === 'th'
                            ? 'เช็คชื่อเรียนเสริมแล้ว'
                            : 'Study Attendance Saved',
                        message: `${kid.emoji} น้อง${kid.nickname}${attendanceBonus > 0 ? ` (+${attendanceBonus} ⭐)` : ''}`,
                        tone: 'mint',
                      });
                    }}
                    className={`w-full min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      kid.extraStudyChecked
                        ? 'bg-[#DCF7F2] border border-[#9FE2D6] text-[#19534B] cursor-default'
                        : 'bg-[#C5F3EB] hover:bg-[#B2ECE2] border border-[#64CBB9] text-[#0F423A] cursor-pointer'
                    }`}
                  >
                    {kid.extraStudyChecked
                      ? lang === 'th'
                        ? '✅ เช็คเข้าเรียนเสริมแล้ว'
                        : '✅ Study Checked'
                      : attendanceBonus > 0
                      ? lang === 'th'
                        ? `📚 เช็คเข้าเรียนเสริม (+${attendanceBonus} ⭐)`
                        : `📚 Mark Extra Study (+${attendanceBonus} ⭐)`
                      : lang === 'th'
                      ? '📚 เช็คเข้าเรียนเสริม (เช็คชื่ออย่างเดียว)'
                      : '📚 Mark Attendance Only'}
                  </button>

                  {dailyCap === 0 ? (
                    <div className="rounded-xl bg-white border border-[#E8DDD3] px-3 py-2 text-center text-[11px] font-semibold text-[#7B695F]">
                      🔒 {lang === 'th' ? 'พี่เลี้ยงตั้งเพดานดาวครูไว้ที่ 0 ⭐ (เช็คชื่อได้อย่างเดียว)' : 'Star cap set to 0 by Staff'}
                    </div>
                  ) : remainingQuota === 0 ? (
                    <div className="rounded-xl bg-[#F5F1EB] border border-[#E5DAD0] px-3 py-2 text-center text-[11px] font-bold text-[#6E5C52]">
                      🔒 {lang === 'th' ? `ครบเพดาน ${dailyCap} ⭐ วันนี้แล้ว` : `Reached today's ${dailyCap} ⭐ cap`}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={!canGive5}
                        onClick={() => {
                          onAwardStudyStars(
                            kid.id,
                            5,
                            `👩‍🏫 คุณครู${loggedInTutor.nickname}: ตั้งใจเรียนดีมาก (+5 ⭐)`
                          );
                          onShowAlert({
                            icon: '⭐',
                            title: lang === 'th' ? 'ให้ดาวตั้งใจเรียนแล้ว!' : 'Awarded +5 Study Stars!',
                            message: `${kid.emoji} น้อง${kid.nickname} (+5 ⭐)`,
                            tone: 'yellow',
                          });
                        }}
                        className={`rounded-xl border py-1.5 px-2 text-[11px] font-bold transition-colors ${
                          canGive5
                            ? 'bg-[#FFF8CC] hover:bg-[#FFF3B3] border-[#F5DE93] text-[#5A4614] cursor-pointer'
                            : 'bg-[#F5F1EB] border-[#E5DAD0] text-[#9B897E] cursor-not-allowed'
                        }`}
                      >
                        +5⭐ ตั้งใจเรียน
                      </button>

                      <button
                        type="button"
                        disabled={!canGive10}
                        onClick={() => {
                          onAwardStudyStars(
                            kid.id,
                            10,
                            `👩‍🏫 คุณครู${loggedInTutor.nickname}: ส่งการบ้าน/ทำแบบฝึกหัดครบ (+10 ⭐)`
                          );
                          onShowAlert({
                            icon: '🌟',
                            title: lang === 'th' ? 'ให้ดาวทำการบ้านครบแล้ว!' : 'Awarded +10 Homework Stars!',
                            message: `${kid.emoji} น้อง${kid.nickname} (+10 ⭐)`,
                            tone: 'lavender',
                          });
                        }}
                        className={`rounded-xl border py-1.5 px-2 text-[11px] font-bold transition-colors ${
                          canGive10
                            ? 'bg-[#EFE8FC] hover:bg-[#E5DBFA] border-[#C8B7EB] text-[#3E2B63] cursor-pointer'
                            : 'bg-[#F5F1EB] border-[#E5DAD0] text-[#9B897E] cursor-not-allowed'
                        }`}
                      >
                        +10⭐ ส่งการบ้าน
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Today's Study Star Log */}
      <section className="rounded-[28px] border-2 border-[#EBD8C3] bg-[#FFFDF9] p-5 pastel-shadow">
        <h3 className="text-base font-bold text-[#3D322C] mb-3">
          📝 {lang === 'th' ? `บันทึกการเรียน & ดาวจากคุณครูวันนี้ (${todayTutorLogs.length} รายการ)` : `Today's Tutor Log (${todayTutorLogs.length})`}
        </h3>
        {todayTutorLogs.length === 0 ? (
          <p className="text-xs text-[#7B695F]">
            {lang === 'th' ? 'ยังไม่มีรายการจากคุณครูในวันนี้' : 'No tutor logs today yet.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {todayTutorLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-[#EFE5DB] bg-white px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-bold text-[#3D322C]">
                    {log.kidEmoji} น้อง{log.kidNickname}
                  </span>
                  <span className="text-[#6E5C52] ml-2">{log.reason}</span>
                </div>
                <span className="font-bold text-[#2F685E] shrink-0">+{log.amount} ⭐</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
