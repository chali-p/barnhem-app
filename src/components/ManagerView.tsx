import { User } from 'firebase/auth';
import React, { useState } from 'react';
import {
  Announcement,
  AppState,
  DeedRedemption,
  KindnessCard,
  KitchenVerificationLog,
  Language,
  LostFoundItem,
  Member,
  ModalAlertPayload,
  OutingTrip,
  PrivateCareMessage,
  SecretPoll,
  SickReport,
  StaffLeaveRecord,
  SupplyRequest,
} from '../types/barnhem';
import {
  formatLeaveKindTh,
  formatLeaveSpanTh,
  formatMinutesToHHMM,
  getShiftCoverageAtDateTime,
} from '../data/staffSchedule';
import { downloadKidsSummaryCsv } from '../utils/csvExport';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';
import { getDateKey } from '../utils/timeRules';
import { CareCommunityPanel } from './CareCommunityPanel';
import { PinPadModal } from './CenteredAlertModal';
import { CloudSyncBanner } from './CloudSyncBanner';
import { KidDutySchedulesPanel } from './KidDutySchedulesPanel';
import { StaffLeavePanel } from './StaffLeavePanel';
import { StaffRosterPanel } from './StaffRosterPanel';

interface ManagerViewProps {
  state: AppState;
  cloudUser: User | null;
  cloudSyncing: boolean;
  onForceSeedCloud: () => Promise<void>;
  members: Member[];
  sickReports: SickReport[];
  kitchenLogs: KitchenVerificationLog[];
  announcements: Announcement[];
  polls: SecretPoll[];
  trips: OutingTrip[];
  privateMessages: PrivateCareMessage[];
  lostFoundItems: LostFoundItem[];
  supplyRequests: SupplyRequest[];
  kindnessCards: KindnessCard[];
  deedRedemptions: DeedRedemption[];
  now: Date;
  lang: Language;
  loggedInManager: Member | null;
  onLoginManager: (mgr: Member) => void;
  onLogoutManager: () => void;
  onSetLanguage: (lang: Language) => void;
  onAddAnnouncement: (ann: Announcement) => void;
  onTogglePinAnnouncement: (annId: string) => void;
  onDeleteAnnouncement: (annId: string) => void;
  onCreatePoll: (poll: SecretPoll) => void;
  onToggleClosePoll: (pollId: string) => void;
  onDeletePoll: (pollId: string) => void;
  onCreateTrip: (trip: OutingTrip) => void;
  onDeleteTrip: (tripId: string) => void;
  onReplyPrivateMessage: (msgId: string, replyText: string, staffName: string) => void;
  onMarkMessageRead: (msgId: string) => void;
  onAddLostFound: (item: LostFoundItem) => void;
  onResolveLostFound: (itemId: string) => void;
  onDeleteLostFound: (itemId: string) => void;
  onUpdateSupplyStatus: (reqId: string, status: 'approved' | 'delivered', staffName: string) => void;
  onAssignDeedRedemption: (deed: DeedRedemption) => void;
  onApproveDeedRedemption: (deedId: string) => void;
  onOpenKidProfile: (kidId: string) => void;
  onSendManagerGift: (params: {
    target: 'all' | 'group1' | 'group2' | 'group3' | string;
    mode: 'angpao' | 'gift';
    emoji: string;
    title: string;
    message: string;
    amountThb: number;
    bonusStars: number;
    senderName: string;
  }) => void;
  onSubmitStaffLeave: (leave: StaffLeaveRecord) => void;
  onUpdateLeaveSubstitute: (leaveId: string, substituteName: string) => void;
  onAcknowledgeLeave: (leaveId: string, byName: string) => void;
  onCancelLeave: (leaveId: string) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  state,
  cloudUser,
  cloudSyncing,
  onForceSeedCloud,
  members,
  sickReports,
  kitchenLogs,
  announcements,
  polls,
  trips,
  privateMessages,
  lostFoundItems,
  supplyRequests,
  kindnessCards,
  deedRedemptions,
  now,
  lang,
  loggedInManager,
  onLoginManager,
  onLogoutManager,
  onSetLanguage,
  onAddAnnouncement,
  onTogglePinAnnouncement,
  onDeleteAnnouncement,
  onCreatePoll,
  onToggleClosePoll,
  onDeletePoll,
  onCreateTrip,
  onDeleteTrip,
  onReplyPrivateMessage,
  onMarkMessageRead,
  onAddLostFound,
  onResolveLostFound,
  onDeleteLostFound,
  onUpdateSupplyStatus,
  onAssignDeedRedemption,
  onApproveDeedRedemption,
  onOpenKidProfile,
  onSendManagerGift,
  onSubmitStaffLeave,
  onUpdateLeaveSubstitute,
  onAcknowledgeLeave,
  onCancelLeave,
  onShowAlert,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const pinGuard = usePinGuard('manager');

  const managers = members.filter((m) => m.role === 'manager');
  const kids = members.filter((m) => m.role === 'kid');
  const todayKey = getDateKey(now);

  // Angpao & Gift Sender State
  const [giftTarget, setGiftTarget] = useState<string>('all');
  const [giftMode, setGiftMode] = useState<'angpao' | 'gift'>('angpao');
  const [giftEmoji, setGiftEmoji] = useState('🧧');
  const [giftTitle, setGiftTitle] = useState('อั่งเปาวันปีใหม่');
  const [giftAmountInput, setGiftAmountInput] = useState('100');
  const [giftBonusStars, setGiftBonusStars] = useState('0');
  const [giftMessage, setGiftMessage] = useState('ขอให้น้องมีความสุข สุขภาพแข็งแรง ตั้งใจเรียนนะคะ!');

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
    const found = managers.find((m) => m.pin === pin.trim());
    if (!found) {
      const res = pinGuard.recordFailure();
      setPinInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '🔐',
        title: res.lockedNow
          ? lang === 'th'
            ? 'ล็อกชั่วคราว 30 วินาที'
            : 'Locked for 30 Seconds'
          : lang === 'th'
          ? 'รหัส PIN ผู้จัดการไม่ถูกต้อง'
          : 'Invalid Manager PIN',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${lang === 'th' ? 'กรุณาใส่รหัส PIN 4 หลักประจำตัวผู้จัดการให้ถูกต้อง' : 'Please enter your valid 4-digit Manager PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
      return;
    }
    pinGuard.recordSuccess();
    setPinInput('');
    setPinModalOpen(false);
    // SuSan auto-switches UI to English; P'Wao displays Thai
    if (found.id === 'mgr_susan') {
      onSetLanguage('en');
    } else if (found.id === 'mgr_wao') {
      onSetLanguage('th');
    }
    onLoginManager(found);
  };

  if (!loggedInManager) {
    return (
      <div className="max-w-md mx-auto rounded-[36px] border-2 border-[#DCEEF8] bg-[#FFFDF9] p-7 text-center pastel-shadow">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#DCEEF8] text-3xl">
          📊
        </div>
        <h2 className="text-2xl font-bold text-[#3D322C]">
          {lang === 'th' ? 'โหมดผู้จัดการ (Manager Dashboard)' : 'Foundation Manager Dashboard'}
        </h2>
        <p className="text-sm text-[#6E5C52] mt-1 mb-5">
          {lang === 'th'
            ? 'ใส่รหัส PIN 4 หลักส่วนตัวของผู้จัดการเพื่อเข้าสู่ระบบ (สำหรับ SuSan / พี่เหว่า)'
            : 'Enter your personal 4-digit Manager PIN (SuSan / P\'Wao).'}
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
                ? 'รหัส PIN 4 หลัก'
                : '4-digit PIN'
            }
            className="w-full rounded-2xl border-2 border-[#EBD8C3] bg-white px-4 py-3 text-center text-xl tracking-widest disabled:bg-[#F5ECE2]"
          />
          <button
            type="submit"
            disabled={pinGuard.isLocked}
            className="w-full min-h-[48px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {lang === 'th' ? 'เข้าสู่แดชบอร์ดผู้จัดการ' : 'Sign In to Manager Dashboard'}
          </button>
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="w-full min-h-[44px] rounded-2xl bg-[#DCEEF8] text-[#28445A] font-bold text-sm cursor-pointer"
          >
            🔢 {lang === 'th' ? 'เปิดแป้นพิมพ์ PIN' : 'Open PIN Keypad'}
          </button>
        </form>

        <PinPadModal
          open={pinModalOpen}
          lang={lang}
          lockedRemainingSec={pinGuard.remainingSec}
          title={lang === 'th' ? 'เข้าสู่ระบบผู้จัดการ' : 'Manager PIN Login'}
          onCancel={() => setPinModalOpen(false)}
          onSubmitPin={tryLogin}
        />
      </div>
    );
  }

  const activeSickToday = sickReports.filter((r) => !r.resolved && r.dateKey === todayKey);
  const allActiveSick = sickReports.filter((r) => !r.resolved);
  const totalStars = kids.reduce((acc, k) => acc + k.stars, 0);
  const totalFines = kids.reduce((acc, k) => acc + k.penalty.lateFineThb, 0);
  const staffLeaves = state.staffLeaves ?? [];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayCoverage = getShiftCoverageAtDateTime(
    now,
    nowMinutes,
    staffLeaves,
    state.settings.isPublicHolidayToday
  );
  const upcomingLeaves = staffLeaves.filter(
    (l) => l.status === 'active' && l.dateKey >= todayKey
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[28px] border-2 border-[#DCEEF8] bg-[#FFFDF9] p-5 flex flex-wrap items-center justify-between gap-4 pastel-shadow">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{loggedInManager.emoji}</span>
          <div>
            <h2 className="text-xl font-bold text-[#3D322C]">
              {lang === 'en'
                ? `Welcome, ${loggedInManager.nickname} — Executive Overview`
                : `สวัสดี ${loggedInManager.nickname} — ภาพรวมผู้บริหารมูลนิธิ`}
            </h2>
            <p className="text-xs text-[#6E5C52]">{loggedInManager.fullName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadKidsSummaryCsv(state, now)}
            className="min-h-[42px] rounded-2xl bg-[#D4F0F0] hover:bg-[#BBE5E1] px-4 py-2 text-sm font-bold text-[#1D544C] cursor-pointer"
          >
            📥 {lang === 'en' ? 'Export Daily CSV' : 'ดาวน์โหลดรายงาน CSV'}
          </button>
          <button
            type="button"
            onClick={onLogoutManager}
            className="min-h-[42px] rounded-2xl bg-[#FADADD] hover:bg-[#F3B7C0] px-4 py-2 text-sm font-bold text-[#3D322C] cursor-pointer"
          >
            🚪 {lang === 'en' ? 'Logout Manager' : 'ออกจากโหมดผู้จัดการ'}
          </button>
        </div>
      </div>

      {/* Real-time Cloud Sync & 1-Click LINE Executive Digest */}
      <CloudSyncBanner
        cloudUser={cloudUser}
        cloudSyncing={cloudSyncing}
        state={state}
        now={now}
        lang={lang}
        onForceSeedCloud={onForceSeedCloud}
        onShowAlert={onShowAlert}
      />

      {/* Live On-Duty Snapshot & Urgent Staff Leave Alerts */}
      <section
        className={`rounded-[24px] border-2 p-4 pastel-shadow space-y-2 ${
          todayCoverage.leavesForDate.length > 0 || todayCoverage.alertsTh.length > 0
            ? 'border-[#EE9CAF] bg-gradient-to-r from-[#FFF1F4] to-[#FFF9EE]'
            : 'border-[#B8DEC9] bg-gradient-to-r from-[#EFFAF6] to-[#F7FBFF]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-extrabold text-[#3D322C]">
            {todayCoverage.leavesForDate.length > 0 || todayCoverage.alertsTh.length > 0
              ? lang === 'en'
                ? '🚨 Staff Leave Alert & Live Shift Duty'
                : '🚨 แจ้งเตือนพี่เลี้ยงลางาน & ผู้เข้าเวรตอนนี้'
              : lang === 'en'
              ? '🛡️ Live Staff Duty Status'
              : '🛡️ สถานะเวรพี่เลี้ยงเข้างานตอนนี้'}
            <span className="ml-2 font-bold text-[#1B544A]">
              · 🕒 {formatMinutesToHHMM(nowMinutes)} น.:{' '}
              {todayCoverage.onDutyNowNames.length > 0
                ? todayCoverage.onDutyNowNames.join(', ')
                : lang === 'en'
                ? 'No active duty covered!'
                : 'ยังไม่มีผู้เข้าเวร!'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              document
                .getElementById('staff-leave-section')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="rounded-xl bg-[#3D322C] hover:bg-[#29201B] text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
          >
            {lang === 'en'
              ? `Staff Leave & Future Duty (${upcomingLeaves.length}) ↓`
              : `จัดการการลา / เช็คเวรล่วงหน้า (${upcomingLeaves.length}) ↓`}
          </button>
        </div>

        {todayCoverage.alertsTh.map((a, idx) => (
          <div
            key={idx}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
              a.severity === 'critical'
                ? 'bg-[#FFE2E8] border border-[#E58AA0] text-[#8B1D36]'
                : 'bg-[#FFF5BA] border border-[#E8C84A] text-[#5A4208]'
            }`}
          >
            {a.text}
          </div>
        ))}

        {upcomingLeaves.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {upcomingLeaves.slice(0, 6).map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-[#F3C5CE] bg-white px-3 py-1.5 text-xs flex flex-wrap items-center gap-2"
              >
                <span className="font-extrabold text-[#3D322C]">
                  [{l.dateKey === todayKey ? 'วันนี้' : l.dateKey}] {formatLeaveKindTh(l.kind)} · {l.staffName}
                </span>
                <span className="text-[#6E5C52]">{formatLeaveSpanTh(l)}</span>
                <span className="font-bold text-[#1A5E52]">
                  → แทน: {l.substituteName || 'ยังไม่ระบุคนแทน'}
                </span>
                {!l.acknowledgedBy ? (
                  <button
                    type="button"
                    onClick={() => onAcknowledgeLeave(l.id, loggedInManager.nickname)}
                    className="rounded-lg bg-[#D4F0F0] hover:bg-[#BBE5E1] px-2 py-0.5 text-[11px] font-bold text-[#144740] cursor-pointer"
                  >
                    ✓ {lang === 'en' ? 'Acknowledge' : 'กดรับทราบ'}
                  </button>
                ) : (
                  <span className="text-[11px] font-bold text-[#1D544C]">
                    ✓ {l.acknowledgedBy}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4 KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[28px] border-2 border-[#DCEEF8] bg-[#DCEEF8]/60 p-5 pastel-shadow">
          <div className="text-xs font-semibold text-[#415C73]">
            {lang === 'en' ? 'Total Kids' : 'จำนวนเด็กทั้งหมด'}
          </div>
          <div className="text-4xl font-bold text-[#3D322C] mt-1 tabular-nums">{kids.length}</div>
          <div className="text-xs text-[#5E6E7A] mt-1">
            {lang === 'en' ? 'Across 3 age groups' : 'แบ่งเป็น 3 กลุ่มวัย'}
          </div>
        </div>

        <div className="rounded-[28px] border-2 border-[#FADADD] bg-[#FADADD]/60 p-5 pastel-shadow">
          <div className="text-xs font-semibold text-[#7A3F4B]">
            {lang === 'en' ? 'Sick Kids Today' : 'จำนวนเด็กป่วยวันนี้'}
          </div>
          <div className="text-4xl font-bold text-[#3D322C] mt-1 tabular-nums">
            {activeSickToday.length}
          </div>
          <div className="text-xs text-[#7A4E57] mt-1">
            {lang === 'en' ? `${allActiveSick.length} total active alerts` : `เคสป่วยที่กำลังดูแล ${allActiveSick.length} เคส`}
          </div>
        </div>

        <div className="rounded-[28px] border-2 border-[#F4DB73] bg-[#FFF5BA]/80 p-5 pastel-shadow">
          <div className="text-xs font-semibold text-[#755F1D]">
            {lang === 'en' ? 'Total Goodness Stars' : 'ยอดดาวความดีรวมทั้งหมด'}
          </div>
          <div className="text-4xl font-bold text-[#3D322C] mt-1 tabular-nums">
            ⭐ {totalStars.toLocaleString()}
          </div>
          <div className="text-xs text-[#755F1D] mt-1">
            {lang === 'en' ? 'Combined active balance' : 'ยอดสะสมรวมของน้องทุกคน'}
          </div>
        </div>

        <div className="rounded-[28px] border-2 border-[#F3C5AE] bg-[#FDE2D2]/80 p-5 pastel-shadow">
          <div className="text-xs font-semibold text-[#784632]">
            {lang === 'en' ? 'Accumulated Late Fines' : 'ยอดค่าปรับสายสะสม (THB)'}
          </div>
          <div className="text-4xl font-bold text-[#3D322C] mt-1 tabular-nums">
            ฿{totalFines.toLocaleString()}
          </div>
          <div className="text-xs text-[#784632] mt-1">
            {lang === 'en' ? '5 THB/min (max 50 THB/day)' : 'นาทีละ 5 บ. เพดาน 50 บ.'}
          </div>
        </div>
      </div>

      {/* Angpao & Gift Sender (Shows on Kid Profile Box for 1 Day of Sent Date) */}
      <section className="rounded-[28px] border-2 border-[#F3B7C0] bg-gradient-to-br from-[#FFF9F2] to-[#FFF2F5] p-5 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold text-[#7A2034]">
              🧧🎁 {lang === 'en' ? 'Send Angpao / Gift to Kids (1-Day Profile Badge)' : 'มอบอั่งเปา & ของขวัญให้เด็ก (แสดงที่โปรไฟล์เด็ก 1 วัน)'}
            </h3>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'en'
                ? 'Type any Angpao amount (adds to Pink Piggy Bank) or pick a Gift icon. Appears in the kid profile box on the date sent!'
                : 'ผู้จัดการสามารถพิมพ์ยอดเงินอั่งเปา (โอนเข้าออมสินทันที) หรือส่งรูปของขวัญพร้อมคำอวยพร โดยรูปจะแสดงในช่องโปรไฟล์เด็กตลอดวันนี้ 1 วันค่ะ'}
            </p>
          </div>
          <div className="inline-flex rounded-2xl bg-white border border-[#F3B7C0] p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                setGiftMode('angpao');
                setGiftEmoji('🧧');
                if (!giftTitle || giftTitle === 'ของขวัญพิเศษจากผู้จัดการ') {
                  setGiftTitle('อั่งเปาวันปีใหม่');
                }
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold cursor-pointer transition-colors ${
                giftMode === 'angpao' ? 'bg-[#FFE4E9] text-[#8B1D36]' : 'text-[#6E5C52]'
              }`}
            >
              🧧 {lang === 'en' ? 'Angpao (THB)' : 'ให้อั่งเปา (พิมพ์ยอด)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setGiftMode('gift');
                setGiftEmoji('🎁');
                if (!giftTitle || giftTitle === 'อั่งเปาวันปีใหม่') {
                  setGiftTitle('ของขวัญพิเศษจากผู้จัดการ');
                }
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold cursor-pointer transition-colors ${
                giftMode === 'gift' ? 'bg-[#FFF3C4] text-[#6E4500]' : 'text-[#6E5C52]'
              }`}
            >
              🎁 {lang === 'en' ? 'Gift Icon' : 'ส่งของขวัญ'}
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsedAmount = giftMode === 'angpao' ? Math.max(0, Math.round(Number(giftAmountInput) || 0)) : 0;
            const parsedStars = Math.max(0, Math.round(Number(giftBonusStars) || 0));
            if (giftMode === 'angpao' && parsedAmount <= 0) {
              onShowAlert({
                icon: '🧧',
                title: lang === 'en' ? 'Enter Angpao Amount' : 'กรุณาระบุยอดเงินอั่งเปา',
                message: lang === 'en' ? 'Please enter an amount greater than 0 THB.' : 'กรุณาพิมพ์ยอดเงินอั่งเปามากกว่า 0 บาทค่ะ',
                tone: 'yellow',
              });
              return;
            }
            const cleanTitle = giftTitle.trim() || (giftMode === 'angpao' ? 'อั่งเปาพิเศษ' : 'ของขวัญพิเศษ');
            onSendManagerGift({
              target: giftTarget,
              mode: giftMode,
              emoji: giftEmoji,
              title: cleanTitle,
              message: giftMessage.trim(),
              amountThb: parsedAmount,
              bonusStars: parsedStars,
              senderName: loggedInManager.nickname,
            });
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs"
        >
          <div className="md:col-span-3 space-y-1">
            <label className="font-bold text-[#3D322C] block">
              {lang === 'en' ? 'Recipient' : 'ผู้รับ'}
            </label>
            <select
              value={giftTarget}
              onChange={(e) => setGiftTarget(e.target.value)}
              className="w-full rounded-xl border border-[#F3B7C0] bg-white px-3 py-2 text-xs font-bold text-[#3D322C]"
            >
              <option value="all">🏡 {lang === 'en' ? `All Kids (${kids.length})` : `เด็กทุกคนทั้งบ้าน (${kids.length} คน)`}</option>
              <option value="group1">🐣 {lang === 'en' ? 'Group 1 Primary' : 'กลุ่ม 1 ประถมทุกคน'}</option>
              <option value="group2">🎒 {lang === 'en' ? 'Group 2 High School' : 'กลุ่ม 2 มัธยมทุกคน'}</option>
              <option value="group3">🎓 {lang === 'en' ? 'Group 3 College' : 'กลุ่ม 3 วิทยาลัยทุกคน'}</option>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} น้อง{k.nickname} ({k.id})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="font-bold text-[#3D322C] block">
              {lang === 'en' ? 'Gift Icon' : 'รูปของขวัญบนโปรไฟล์'}
            </label>
            <div className="flex flex-wrap gap-1">
              {['🧧', '🎁', '🧸', '🎂', '🎒', '👟', '🍫', '🎀'].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setGiftEmoji(em)}
                  className={`h-8 w-8 rounded-lg border text-base cursor-pointer transition-transform ${
                    giftEmoji === em
                      ? 'border-[#C63D55] bg-[#FFE4E9] scale-110'
                      : 'border-[#EBD8C3] bg-white hover:bg-[#FFF5BA]/50'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="font-bold text-[#3D322C] block">
              {giftMode === 'angpao'
                ? lang === 'en'
                  ? 'Angpao Amount (THB)'
                  : 'ยอดเงินอั่งเปา (บาท)'
                : lang === 'en'
                ? 'Gift Title'
                : 'ชื่อของขวัญ'}
            </label>
            {giftMode === 'angpao' ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={giftAmountInput}
                  onChange={(e) => setGiftAmountInput(e.target.value)}
                  placeholder="100"
                  className="w-full rounded-xl border border-[#F3B7C0] bg-white px-3 py-2 text-sm font-extrabold text-[#8B1D36] tabular-nums"
                />
                <span className="font-bold text-[#6E5C52]">฿</span>
              </div>
            ) : (
              <input
                type="text"
                value={giftTitle}
                onChange={(e) => setGiftTitle(e.target.value)}
                placeholder={lang === 'en' ? 'New Year Gift...' : 'เช่น ของขวัญปีใหม่ / เค้กวันเกิด'}
                className="w-full rounded-xl border border-[#F3B7C0] bg-white px-3 py-2 text-xs font-bold text-[#3D322C]"
              />
            )}
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="font-bold text-[#3D322C] block">
              ⭐ {lang === 'en' ? 'Bonus Stars (optional)' : 'แถมดาวพิเศษ (ถ้ามี)'}
            </label>
            <input
              type="number"
              min={0}
              max={1000}
              value={giftBonusStars}
              onChange={(e) => setGiftBonusStars(e.target.value)}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs font-bold text-[#3D322C] tabular-nums"
            />
          </div>

          {giftMode === 'angpao' && (
            <div className="md:col-span-4 space-y-1">
              <label className="font-bold text-[#3D322C] block">
                {lang === 'en' ? 'Occasion / Label' : 'ชื่อโอกาส / ป้ายกำกับ'}
              </label>
              <input
                type="text"
                value={giftTitle}
                onChange={(e) => setGiftTitle(e.target.value)}
                placeholder="อั่งเปาวันปีใหม่"
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
              />
            </div>
          )}

          <div className={`${giftMode === 'angpao' ? 'md:col-span-5' : 'md:col-span-9'} space-y-1`}>
            <label className="font-bold text-[#3D322C] block">
              💌 {lang === 'en' ? 'Blessing / Message' : 'คำอวยพร / ข้อความถึงน้อง'}
            </label>
            <input
              type="text"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder={lang === 'en' ? 'Happy New Year!' : 'ขอให้น้องมีความสุขมากๆ นะคะ'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
            />
          </div>

          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              className="w-full min-h-[38px] rounded-xl bg-[#9E1C36] hover:bg-[#7E1429] text-white px-4 py-2 text-xs font-extrabold cursor-pointer transition-colors"
            >
              {giftMode === 'angpao'
                ? lang === 'en'
                  ? `🧧 Send ${giftAmountInput || 0} THB`
                  : `🧧 ส่งอั่งเปา (${giftAmountInput || 0} ฿)`
                : lang === 'en'
                ? '🎁 Send Gift'
                : '🎁 ส่งของขวัญวันนี้'}
            </button>
          </div>
        </form>

        {/* Active Gifts Today Summary */}
        {(() => {
          const giftedToday = kids.filter((k) => k.mySpace?.activeGift?.sentDateKey === todayKey);
          if (giftedToday.length === 0) return null;
          return (
            <div className="rounded-2xl border border-[#F4DB73] bg-[#FFFBEB] px-3.5 py-2.5 text-xs">
              <div className="font-bold text-[#6E4500] mb-1">
                ✨ {lang === 'en' ? `Active Profile Gifts Today (${giftedToday.length})` : `ของขวัญที่แสดงบนโปรไฟล์น้องวันนี้ (${giftedToday.length} คน)`}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {giftedToday.map((k) => {
                  const g = k.mySpace.activeGift!;
                  return (
                    <span
                      key={k.id}
                      className="inline-flex items-center gap-1 rounded-xl bg-white border border-[#F0D568] px-2.5 py-1 text-[11px] font-bold text-[#3D322C]"
                    >
                      <span>{g.emoji}</span>
                      <span>น้อง{k.nickname}:</span>
                      <span className="text-[#8B1D36]">
                        {g.title}
                        {g.amountThb && g.amountThb > 0 ? ` (+${g.amountThb} ฿)` : ''}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </section>

      {/* Health Alerts Table */}
      <section className="rounded-[28px] border-2 border-[#F3C5AE] bg-[#FFFDF9] p-5 pastel-shadow">
        <h3 className="text-lg font-bold text-[#3D322C] mb-3">
          🩺 {lang === 'en' ? 'Kids Health Alert Log' : 'ตารางแจ้งเตือนสุขภาพเด็ก'}
        </h3>
        {sickReports.length === 0 ? (
          <p className="text-sm text-[#7B695F]">
            {lang === 'en' ? 'No illness reports recorded.' : 'ไม่มีประวัติแจ้งป่วยในระบบ'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EBD8C3] text-xs text-[#6E5C52]">
                  <th className="py-2 pr-4">{lang === 'en' ? 'Child' : 'ชื่อน้อง'}</th>
                  <th className="py-2 px-3">{lang === 'en' ? 'Symptoms' : 'อาการ'}</th>
                  <th className="py-2 px-3">{lang === 'en' ? 'Details' : 'รายละเอียด'}</th>
                  <th className="py-2 px-3">{lang === 'en' ? 'Date' : 'วันที่'}</th>
                  <th className="py-2 pl-3 text-right">{lang === 'en' ? 'Status' : 'สถานะ'}</th>
                </tr>
              </thead>
              <tbody>
                {sickReports.slice(0, 15).map((r) => (
                  <tr key={r.id} className="border-b border-[#F5ECE2]">
                    <td className="py-2.5 pr-4 font-bold">{r.kidNickname}</td>
                    <td className="py-2.5 px-3">{r.symptoms}</td>
                    <td className="py-2.5 px-3 text-[#6E5C52]">{r.details}</td>
                    <td className="py-2.5 px-3 tabular-nums">{r.dateKey}</td>
                    <td className="py-2.5 pl-3 text-right font-bold">
                      {r.resolved ? (
                        <span className="text-[#2F685E]">
                          ✅ {lang === 'en' ? 'Recovered' : 'หายป่วยแล้ว'}
                        </span>
                      ) : (
                        <span className="text-[#B84A39]">
                          🤒 {lang === 'en' ? 'Active Care' : 'กำลังพักรักษา'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Full Behavior, Stars, Fines & Document Links Table (15+ Kids) */}
      <section className="rounded-[28px] border-2 border-[#DCEEF8] bg-[#FFFDF9] p-5 pastel-shadow">
        <h3 className="text-lg font-bold text-[#3D322C] mb-3">
          📑 {lang === 'en' ? 'All Kids Behavior, Stars, Fines & Document Folders' : 'ภาพรวมความประพฤติ ดาวสะสม ค่าปรับ & แฟ้มเอกสาร (ทุกคน)'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-[#EBD8C3] text-xs text-[#6E5C52]">
                <th className="py-2.5 pr-3">{lang === 'en' ? 'Member' : 'รายชื่อ'}</th>
                <th className="py-2.5 px-2">{lang === 'en' ? 'Group' : 'กลุ่ม'}</th>
                <th className="py-2.5 px-2 text-right">{lang === 'en' ? 'Stars' : 'ดาว'}</th>
                <th className="py-2.5 px-2 text-right">{lang === 'en' ? 'Fines (THB)' : 'ค่าปรับ'}</th>
                <th className="py-2.5 px-2">{lang === 'en' ? 'Kitchen Verified' : 'เวรครัวที่ยืนยัน'}</th>
                <th className="py-2.5 pl-2 text-right">{lang === 'en' ? 'View & Folders' : 'มุมมองเด็ก & แฟ้มเอกสาร'}</th>
              </tr>
            </thead>
            <tbody>
              {kids.map((kid) => {
                const kidKitchenCount = kitchenLogs.filter((l) => l.kidId === kid.id).length;
                return (
                  <tr key={kid.id} className="border-b border-[#F5ECE2] hover:bg-[#DCEEF8]/20">
                    <td className="py-3 pr-3">
                      <div className="font-bold text-[#3D322C]">
                        {kid.emoji} {kid.nickname} ({kid.id})
                      </div>
                      <div className="text-xs text-[#7B695F]">{kid.fullName}</div>
                    </td>
                    <td className="py-3 px-2 text-xs">
                      {kid.group === 1
                        ? lang === 'en'
                          ? 'G1 Primary'
                          : 'กลุ่ม 1 ประถม'
                        : kid.group === 2
                        ? lang === 'en'
                          ? 'G2 High School'
                          : 'กลุ่ม 2 มัธยม'
                        : lang === 'en'
                        ? 'G3 College'
                        : 'กลุ่ม 3 วิทยาลัย'}
                    </td>
                    <td className="py-3 px-2 text-right font-bold tabular-nums">
                      ⭐ {kid.stars.toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-right font-bold tabular-nums text-[#B84A39]">
                      ฿{kid.penalty.lateFineThb}
                    </td>
                    <td className="py-3 px-2 text-xs tabular-nums">
                      🍳 {kidKitchenCount} {lang === 'en' ? 'verified' : 'ครั้ง'}
                    </td>
                    <td className="py-3 pl-2 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenKidProfile(kid.id)}
                        className="inline-block rounded-xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#F4DB73] px-3 py-1.5 text-xs font-extrabold text-[#5A4208] cursor-pointer"
                      >
                        👁️ {lang === 'en' ? 'Kid View' : 'ดูมุมมองเด็ก'}
                      </button>
                      <a
                        href={kid.personalDriveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-xl bg-[#D4F0F0] px-3 py-1.5 text-xs font-bold text-[#214F4B]"
                      >
                        ☁️ {lang === 'en' ? 'Personal Drive' : 'ผลงานน้อง'}
                      </a>
                      <a
                        href={kid.restrictedDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block rounded-xl bg-[#EAE4F2] px-3 py-1.5 text-xs font-bold text-[#463A59]"
                      >
                        🔒 {lang === 'en' ? 'Official Docs' : 'เอกสารราชการ'}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Staff Sudden Leave & Live/Future Shift Duty Radar */}
      <StaffLeavePanel
        actorName={loggedInManager.nickname}
        members={members}
        staffLeaves={staffLeaves}
        now={now}
        lang={lang}
        isPublicHolidayToday={state.settings.isPublicHolidayToday}
        isLeadership
        onSubmitLeave={onSubmitStaffLeave}
        onUpdateLeaveSubstitute={onUpdateLeaveSubstitute}
        onAcknowledgeLeave={onAcknowledgeLeave}
        onCancelLeave={onCancelLeave}
        onShowAlert={onShowAlert}
      />

      <section className="rounded-[28px] border-2 border-[#C4DCF0] bg-[#FFFDF9] p-5 pastel-shadow">
        <StaffRosterPanel
          now={now}
          lang={lang}
          isPublicHolidayToday={state.settings.isPublicHolidayToday}
          staffLeaves={staffLeaves}
        />
      </section>

      <section className="rounded-[28px] border-2 border-[#F2B8CB] bg-[#FFFDF9] p-5 pastel-shadow">
        <KidDutySchedulesPanel
          kids={kids}
          now={now}
          lang={lang}
          isPublicHolidayToday={state.settings.isPublicHolidayToday}
        />
      </section>

      {/* Announcements, Secret Polls, Outing Trips & Confidential Backchannel Inbox */}
      <CareCommunityPanel
        authorName={loggedInManager.nickname}
        authorRole="Manager"
        members={members}
        announcements={announcements}
        polls={polls}
        trips={trips}
        privateMessages={privateMessages}
        lostFoundItems={lostFoundItems}
        supplyRequests={supplyRequests}
        kindnessCards={kindnessCards}
        deedRedemptions={deedRedemptions}
        lang={lang}
        onAddAnnouncement={onAddAnnouncement}
        onTogglePinAnnouncement={onTogglePinAnnouncement}
        onDeleteAnnouncement={onDeleteAnnouncement}
        onCreatePoll={onCreatePoll}
        onToggleClosePoll={onToggleClosePoll}
        onDeletePoll={onDeletePoll}
        onCreateTrip={onCreateTrip}
        onDeleteTrip={onDeleteTrip}
        onReplyPrivateMessage={onReplyPrivateMessage}
        onMarkMessageRead={onMarkMessageRead}
        onAddLostFound={onAddLostFound}
        onResolveLostFound={onResolveLostFound}
        onDeleteLostFound={onDeleteLostFound}
        onUpdateSupplyStatus={onUpdateSupplyStatus}
        onAssignDeedRedemption={onAssignDeedRedemption}
        onApproveDeedRedemption={onApproveDeedRedemption}
        onShowAlert={onShowAlert}
      />
    </div>
  );
};
