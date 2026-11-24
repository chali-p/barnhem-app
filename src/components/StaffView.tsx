import { User } from 'firebase/auth';
import React, { useState } from 'react';
import { createEmptyDaily, DEFAULT_SYNC_URL } from '../data/initialData';
import {
  Announcement,
  AppState,
  DeedRedemption,
  Gender,
  KidGroup,
  KindnessCard,
  Language,
  LostFoundItem,
  Member,
  ModalAlertPayload,
  OutingTrip,
  PrivateCareMessage,
  SecretPoll,
  SickReport,
  SnackBill,
  StaffLeaveRecord,
  SupplyRequest,
  WeeklyActivityLog,
} from '../types/barnhem';
import {
  formatLeaveKindTh,
  formatLeaveSpanTh,
  formatMinutesToHHMM,
  getShiftCoverageAtDateTime,
} from '../data/staffSchedule';
import { downloadKidsSummaryCsv } from '../utils/csvExport';
import { KioskResult, playKioskChime } from '../utils/expressKiosk';
import { getDailyHouseChoreForKid } from '../utils/houseChores';
import {
  computeGoldenPoolBalance,
  createInitialAllowanceState,
  ensureCurrentWeekAllowance,
  getEconomyConfig,
  getKidEconomyConfig,
  isKidAwayOnDate,
} from '../utils/piggyBank';
import {
  findPinConflict,
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';
import { getDateKey } from '../utils/timeRules';
import { CareCommunityPanel } from './CareCommunityPanel';
import { PinPadModal, QrScannerModal } from './CenteredAlertModal';
import { CloudSyncBanner } from './CloudSyncBanner';
import { GoldenPiggySvg, PinkPiggySvg } from './PiggyBankSvg';
import { KidDutySchedulesPanel } from './KidDutySchedulesPanel';
import { StaffLeavePanel } from './StaffLeavePanel';
import { StaffRosterPanel } from './StaffRosterPanel';
import { WeeklyActivityLogPanel } from './WeeklyActivityLogPanel';

interface StaffViewProps {
  state: AppState;
  cloudUser: User | null;
  cloudSyncing: boolean;
  onForceSeedCloud: () => Promise<void>;
  members: Member[];
  sickReports: SickReport[];
  snackBills: SnackBill[];
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
  loggedInStaff: Member | null;
  onLoginStaff: (staff: Member) => void;
  onLogoutStaff: () => void;
  onSwitchToCreatorMode?: () => void;
  onUpdateKid: (kidId: string, updater: (prev: Member) => Member, eventLabel: string) => void;
  onAddKid: (kid: Member) => void;
  onDeleteKid: (kidId: string) => void;
  onAddSickReport?: (report: SickReport) => void;
  onResolveSick: (reportId: string) => void;
  onFulfillBill: (billId: string) => void;
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
  onExpressKioskScan?: (code: string) => KioskResult | null;
  onQuickGoToSchool?: (kidId: string) => KioskResult | null;
  onUpdateSettings?: (partial: Partial<AppState['settings']>) => void;
  onRecordRulePenalty?: (
    kidId: string,
    amountThb: number,
    reason: string,
    recordedBy: string
  ) => void;
  onSimulateNextSchoolDay?: (kidId: string) => void;
  onTriggerMondayReset?: (kidId?: string) => void;
  onAddGoldenPoolPayout?: (amountThb: number, reason: string, recordedBy: string) => void;
  onSubmitStaffLeave: (leave: StaffLeaveRecord) => void;
  onUpdateLeaveSubstitute: (leaveId: string, substituteName: string) => void;
  onAcknowledgeLeave: (leaveId: string, byName: string) => void;
  onCancelLeave: (leaveId: string) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  orgName?: string;
  onAddWeeklyActivityLog?: (entry: WeeklyActivityLog) => void;
  onDeleteWeeklyActivityLog?: (logId: string) => void;
  onClearWeeklyActivityLogs?: () => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  state,
  cloudUser,
  cloudSyncing,
  onForceSeedCloud,
  members,
  sickReports,
  snackBills,
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
  loggedInStaff,
  onLoginStaff,
  onLogoutStaff,
  onSwitchToCreatorMode,
  onUpdateKid,
  onAddKid,
  onDeleteKid,
  onAddSickReport,
  onResolveSick,
  onFulfillBill,
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
  onExpressKioskScan,
  onQuickGoToSchool,
  onUpdateSettings,
  onRecordRulePenalty,
  onSimulateNextSchoolDay,
  onTriggerMondayReset,
  onAddGoldenPoolPayout,
  onSubmitStaffLeave,
  onUpdateLeaveSubstitute,
  onAcknowledgeLeave,
  onCancelLeave,
  onShowAlert,
  orgName = 'Barnhem Care & Kids',
  onAddWeeklyActivityLog,
  onDeleteWeeklyActivityLog,
  onClearWeeklyActivityLogs,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [staffQrOpen, setStaffQrOpen] = useState(false);
  const [quickKidSearch, setQuickKidSearch] = useState('');
  const [quickGroupFilter, setQuickGroupFilter] = useState<0 | KidGroup>(0);
  const [selectedQuickKidId, setSelectedQuickKidId] = useState<string | null>(null);
  const [quickCheckFeedback, setQuickCheckFeedback] = useState<string | null>(null);
  const [helperStarReason, setHelperStarReason] = useState('ช่วยงานบ้านพิเศษ / มีน้ำใจ');
  const [customHelperStars, setCustomHelperStars] = useState(2);
  const [customPenaltyThb, setCustomPenaltyThb] = useState(5);
  const [customPenaltyReason, setCustomPenaltyReason] = useState('มาสาย / ผิดกฎระเบียบ');
  const [poolPayoutThb, setPoolPayoutThb] = useState(50);
  const [poolPayoutReason, setPoolPayoutReason] = useState('จัดขนม/ไอศกรีมรวมให้เด็กๆ ทั้งบ้าน');
  const [editingHealthKidId, setEditingHealthKidId] = useState('');
  const [healthBlood, setHealthBlood] = useState('ไม่ระบุ');
  const [healthFoodAllergy, setHealthFoodAllergy] = useState('ไม่มี');
  const [healthDrugAllergy, setHealthDrugAllergy] = useState('ไม่มี');
  const [healthMeds, setHealthMeds] = useState('ไม่มี');
  const [healthCustomChore, setHealthCustomChore] = useState('');
  const [healthLinkedEmail, setHealthLinkedEmail] = useState('');

  // Add Kid Form State
  const [newId, setNewId] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newGender, setNewGender] = useState<Gender>('F');
  const [newGroup, setNewGroup] = useState<KidGroup>(1);
  const [newPin, setNewPin] = useState('');
  const [newEmoji, setNewEmoji] = useState('🐣');
  const [newLinkedEmail, setNewLinkedEmail] = useState('');
  const [newPersonalDrive, setNewPersonalDrive] = useState(DEFAULT_SYNC_URL);
  const [newRestrictedDocs, setNewRestrictedDocs] = useState(DEFAULT_SYNC_URL);

  const staffList = members.filter((m) => m.role === 'staff');
  const kids = members.filter((m) => m.role === 'kid');
  const todayKey = getDateKey(now);
  const activeSick = sickReports.filter((r) => !r.resolved);
  const todayBills = snackBills.filter((b) => b.category === 'snack');
  const eco = getEconomyConfig(state.settings);
  const goldenPoolLogs = state.goldenPoolLogs ?? [];
  const goldenPoolBalance = computeGoldenPoolBalance(goldenPoolLogs);
  const staffLeaves = state.staffLeaves ?? [];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayCoverage = getShiftCoverageAtDateTime(
    now,
    nowMinutes,
    staffLeaves,
    state.settings.isPublicHolidayToday
  );
  const todayActiveLeaves = staffLeaves.filter(
    (l) => l.status === 'active' && l.dateKey >= todayKey
  );
  const pinGuard = usePinGuard('staff');

  const filteredQuickKids = kids.filter((k) => {
    if (quickGroupFilter !== 0 && k.group !== quickGroupFilter) return false;
    const q = quickKidSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      k.nickname.toLowerCase().includes(q) ||
      k.fullName.toLowerCase().includes(q) ||
      k.id.toLowerCase().includes(q)
    );
  });
  const selectedQuickKid =
    selectedQuickKidId ? kids.find((k) => k.id === selectedQuickKidId) ?? null : null;

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
    const found = staffList.find((s) => s.pin === pin.trim());
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
          ? 'รหัส PIN พี่เลี้ยงไม่ถูกต้อง'
          : 'Invalid Staff PIN',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${lang === 'th' ? 'กรุณาใส่รหัส PIN 4 หลักประจำตัวพี่เลี้ยงให้ถูกต้อง' : 'Please enter a valid 4-digit staff PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
      return;
    }
    pinGuard.recordSuccess();
    setPinInput('');
    setPinModalOpen(false);
    onLoginStaff(found);
  };

  if (!loggedInStaff) {
    return (
      <div className="max-w-md mx-auto rounded-[36px] border-2 border-[#D4F0F0] bg-[#FFFDF9] p-7 text-center pastel-shadow">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#D4F0F0] text-3xl">
          👩‍🏫
        </div>
        <h2 className="text-2xl font-bold text-[#3D322C]">
          {lang === 'th' ? 'โหมดพี่เลี้ยง (Staff Mode)' : 'Staff Control Mode'}
        </h2>
        <p className="text-sm text-[#6E5C52] mt-1 mb-5">
          {lang === 'th'
            ? 'กรุณาเข้าสู่ระบบด้วยรหัส PIN 4 หลักประจำตัวพี่เลี้ยง'
            : 'Please log in with your 4-digit staff PIN.'}
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
            {lang === 'th' ? 'เข้าสู่ระบบพี่เลี้ยง' : 'Sign In as Staff'}
          </button>
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="w-full min-h-[44px] rounded-2xl bg-[#D4F0F0] text-[#2B4B48] font-bold text-sm cursor-pointer"
          >
            🔢 {lang === 'th' ? 'เปิดแป้นพิมพ์ PIN' : 'Open PIN Keypad'}
          </button>
        </form>

        <PinPadModal
          open={pinModalOpen}
          lang={lang}
          lockedRemainingSec={pinGuard.remainingSec}
          title={lang === 'th' ? 'เข้าสู่ระบบพี่เลี้ยง' : 'Staff PIN Login'}
          onCancel={() => setPinModalOpen(false)}
          onSubmitPin={tryLogin}
        />
      </div>
    );
  }

  const handleAddKidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idClean = newId.trim().toLowerCase();
    if (!idClean || !newNickname.trim() || !newFullName.trim() || !/^\d{4}$/.test(newPin)) {
      onShowAlert({
        icon: '📝',
        title: lang === 'th' ? 'กรอกข้อมูลไม่ครบ' : 'Incomplete Form',
        message: lang === 'th' ? 'กรุณากรอกรหัส ชื่อเล่น ชื่อจริง และรหัส PIN 4 หลักให้ครบถ้วน' : 'Please fill ID, nickname, full name, and 4-digit PIN.',
        tone: 'yellow',
      });
      return;
    }
    if (members.some((m) => m.id.toLowerCase() === idClean)) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'รหัสซ้ำในระบบ' : 'Duplicate ID',
        message: lang === 'th' ? `มีรหัส "${idClean}" อยู่ในระบบแล้ว` : `ID "${idClean}" already exists.`,
        tone: 'pink',
      });
      return;
    }
    const pinConflict = findPinConflict(newPin, members, state.settings.creatorPins);
    if (pinConflict.conflict) {
      onShowAlert({
        icon: '🔐',
        title: lang === 'th' ? 'รหัส PIN 4 หลักซ้ำในระบบ!' : 'Duplicate 4-Digit PIN!',
        message:
          lang === 'th'
            ? `รหัส "${newPin}" ถูกใช้งานโดย ${pinConflict.conflictOwnerLabel} อยู่แล้ว กรุณาตั้งรหัส PIN 4 หลักที่ไม่ซ้ำกับใคร`
            : `PIN "${newPin}" is already used by ${pinConflict.conflictOwnerLabel}. Please choose a unique PIN.`,
        tone: 'pink',
      });
      return;
    }

    const cleanNewEmail = newLinkedEmail.trim().toLowerCase();
    if (cleanNewEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'Invalid Email Format',
        message: lang === 'th' ? 'กรุณากรอกอีเมล Google ให้ถูกต้อง หรือเว้นว่างไว้ค่ะ' : 'Please enter a valid email or leave blank.',
        tone: 'pink',
      });
      return;
    }

    const kid: Member = {
      id: idClean,
      role: 'kid',
      group: newGroup,
      nickname: newNickname.trim(),
      fullName: newFullName.trim(),
      gender: newGender,
      pin: newPin,
      emoji: newEmoji || '🌟',
      stars: 50,
      linkedEmail: cleanNewEmail || undefined,
      personalDriveUrl: newPersonalDrive.trim() || DEFAULT_SYNC_URL,
      restrictedDocsUrl: newRestrictedDocs.trim() || DEFAULT_SYNC_URL,
      activeCoverStage: 1,
      unlockedCoverStages: [1],
      collectedSceneItems: [],
      ownedShopItemIds: [],
      avatar: {
        skinTone: 'warm',
        bodyType: 'regular',
        faceMood: 'happy',
        hairStyle: newGender === 'F' ? 'tied_ponytail' : 'neat_short',
        hairColor: '#2E231D',
        outfitMode: 'lounge',
      },
      mySpace: {
        favoriteColor: 'พาสเทล',
        favoriteFood: 'ข้าวผัด',
        favoritePet: 'ลูกแมว',
        futureDream: 'มีความสุขและประสบความสำเร็จ',
      },
      penalty: {
        lateFineThb: 0,
        phoneConfiscatedUntil1830Date: null,
        fridayFreeDayDeductedCount: 0,
        noEveningPhoneTomorrowDate: null,
        cartoonPrivilegeActive: true,
        phonePrivilegeActive: true,
      },
      kitchenDuty: {
        evening1530: false,
        sat0930: false,
        sun0915: false,
      },
      allowance: createInitialAllowanceState(now, state.settings),
      daily: createEmptyDaily(todayKey),
      starHistory: [],
    };

    onAddKid(kid);
    setNewId('');
    setNewNickname('');
    setNewFullName('');
    setNewPin('');
    setNewLinkedEmail('');
    onShowAlert({
      icon: '🎉',
      title: lang === 'th' ? 'เพิ่มรายชื่อน้องใหม่สำเร็จ' : 'Kid Added Successfully',
      message: `${kid.emoji} ${kid.nickname} (${kid.id})`,
      tone: 'mint',
    });
  };

  return (
    <div className="space-y-6">
      {/* Staff Top Bar */}
      <div className="rounded-[28px] border-2 border-[#D4F0F0] bg-[#FFFDF9] p-5 flex flex-wrap items-center justify-between gap-4 pastel-shadow">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{loggedInStaff.emoji}</span>
          <div>
            <h2 className="text-xl font-bold text-[#3D322C]">
              {lang === 'th' ? `สวัสดี ${loggedInStaff.nickname} — ศูนย์ควบคุมพี่เลี้ยง` : `Hello ${loggedInStaff.nickname} — Staff Center`}
            </h2>
            <p className="text-xs text-[#6E5C52]">{loggedInStaff.fullName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              document
                .getElementById('staff-leave-section')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`min-h-[42px] rounded-2xl border px-3.5 py-2 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
              todayCoverage.leavesForDate.length > 0 || todayCoverage.alertsTh.length > 0
                ? 'bg-[#FFE4E8] hover:bg-[#FFD0D8] border-[#EE9CAF] text-[#8B1D36]'
                : 'bg-[#FFF5BA] hover:bg-[#FCEB8E] border-[#F0D568] text-[#5A4208]'
            }`}
          >
            🏖️ {lang === 'th' ? 'แจ้งลางานพี่เลี้ยง' : 'Staff Leave'}
            {todayActiveLeaves.length > 0 ? ` (${todayActiveLeaves.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => downloadKidsSummaryCsv(state, now)}
            className="min-h-[42px] rounded-2xl bg-[#D4F0F0] hover:bg-[#BBE5E1] px-4 py-2 text-sm font-bold text-[#1D544C] cursor-pointer"
          >
            📥 {lang === 'th' ? 'ดาวน์โหลดรายงาน CSV' : 'Export Daily CSV'}
          </button>
          {onUpdateSettings && (
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ isPublicHolidayToday: !state.settings.isPublicHolidayToday })
              }
              className={`min-h-[42px] rounded-2xl border px-3.5 py-2 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                state.settings.isPublicHolidayToday
                  ? 'bg-[#FFF5BA] border-[#E8C149] text-[#5A4208]'
                  : 'bg-white border-[#EBD8C3] text-[#6E5C52] hover:bg-[#FFF8EB]'
              }`}
            >
              🏖️{' '}
              {state.settings.isPublicHolidayToday
                ? lang === 'th'
                  ? 'เปิดวันหยุด/ปิดเทอมอยู่ (งดหัก 70฿)'
                  : 'Holiday Mode ON (No 70฿ deduct)'
                : lang === 'th'
                ? 'ตั้งวันนี้เป็นวันหยุด/ปิดเทอม'
                : 'Set Today Holiday/Break'}
            </button>
          )}
          {onSwitchToCreatorMode &&
            (loggedInStaff.id === 'staff_kik' ||
              state.settings.creatorPins.includes(loggedInStaff.pin)) && (
              <button
                type="button"
                onClick={onSwitchToCreatorMode}
                className="min-h-[42px] rounded-2xl bg-[#EAE4F2] hover:bg-[#DBD0EB] px-4 py-2 text-sm font-bold text-[#3D322C] cursor-pointer"
              >
                👑 {lang === 'th' ? 'สลับไปโหมดผู้สร้างสูงสุด' : 'Switch to Creator Mode'}
              </button>
            )}
          <button
            type="button"
            onClick={onLogoutStaff}
            className="min-h-[42px] rounded-2xl bg-[#FADADD] hover:bg-[#F3B7C0] px-4 py-2 text-sm font-bold text-[#3D322C] cursor-pointer"
          >
            🚪 {lang === 'th' ? 'ออกจากโหมดพี่เลี้ยง' : 'Logout Staff'}
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

      {/* Urgent Staff Leave & Live On-Duty Alert Strip */}
      {(todayCoverage.leavesForDate.length > 0 || todayCoverage.alertsTh.length > 0) && (
        <section className="rounded-[24px] border-2 border-[#EE9CAF] bg-gradient-to-r from-[#FFF1F4] to-[#FFF9EE] p-4 pastel-shadow space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-extrabold text-[#8B1D36]">
              🚨 {lang === 'th' ? 'แจ้งเตือนพี่เลี้ยงลางาน & เวรเข้างานตอนนี้' : 'Active Staff Leave & Duty Coverage Alert'}
              <span className="ml-2 text-xs font-bold text-[#2B4B48]">
                · 🕒 เข้าเวรเวลา {formatMinutesToHHMM(nowMinutes)} น.:{' '}
                {todayCoverage.onDutyNowNames.length > 0
                  ? todayCoverage.onDutyNowNames.join(', ')
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
              className="rounded-xl bg-[#9E1C36] hover:bg-[#7D1429] text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              จัดการลา / ดูเรดาร์เวลา ↓
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
          <div className="flex flex-wrap gap-2">
            {todayCoverage.leavesForDate.map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-[#F3C5CE] bg-white px-3 py-1.5 text-xs flex flex-wrap items-center gap-2"
              >
                <span className="font-extrabold text-[#3D322C]">
                  {formatLeaveKindTh(l.kind)} · {l.staffName}
                </span>
                <span className="text-[#6E5C52]">{formatLeaveSpanTh(l)}</span>
                <span className="font-bold text-[#1A5E52]">
                  → แทน: {l.substituteName || 'ยังไม่ระบุคนแทน'}
                </span>
                {!l.acknowledgedBy && (
                  <button
                    type="button"
                    onClick={() => onAcknowledgeLeave(l.id, loggedInStaff.nickname)}
                    className="rounded-lg bg-[#D4F0F0] hover:bg-[#BBE5E1] px-2 py-0.5 text-[11px] font-bold text-[#144740] cursor-pointer"
                  >
                    ✓ รับทราบ
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weekly Attendance, Late/Absent/Leave Log + 1-Tap LINE Send & Sunday Reset */}
      {onAddWeeklyActivityLog && onDeleteWeeklyActivityLog && onClearWeeklyActivityLogs && (
        <WeeklyActivityLogPanel
          orgName={orgName}
          kids={kids}
          logs={state.weeklyActivityLogs ?? []}
          lastWeeklyClearedAt={state.settings.lastWeeklyClearedAt}
          now={now}
          lang={lang}
          staffName={loggedInStaff.nickname}
          onAddLog={onAddWeeklyActivityLog}
          onDeleteLog={onDeleteWeeklyActivityLog}
          onClearWeeklyLogs={onClearWeeklyActivityLogs}
          onShowAlert={onShowAlert}
        />
      )}

      {/* Staff Control: Tutor Daily Star Ceiling (0-10 ⭐/kid/day) */}
      {onUpdateSettings && (() => {
        const currentTutorCap = Math.min(
          10,
          Math.max(0, Math.floor(state.settings.tutorMaxStarsPerKidPerDay ?? 10))
        );
        const setTutorCap = (val: number) => {
          const clamped = Math.min(10, Math.max(0, Math.floor(Number.isFinite(val) ? val : 10)));
          onUpdateSettings({ tutorMaxStarsPerKidPerDay: clamped });
        };
        const presets: { value: number; labelTh: string; labelEn: string }[] = [
          { value: 0, labelTh: '0 ⭐ (เช็คชื่ออย่างเดียว)', labelEn: '0 ⭐ (Attendance only)' },
          { value: 3, labelTh: '3 ⭐ / วัน', labelEn: '3 ⭐ / day' },
          { value: 5, labelTh: '5 ⭐ / วัน', labelEn: '5 ⭐ / day' },
          { value: 10, labelTh: '10 ⭐ (สูงสุด)', labelEn: '10 ⭐ (Max)' },
        ];
        return (
          <section className="rounded-[28px] border-2 border-[#C8B7EB] bg-[#FFFDF9] p-5 pastel-shadow space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#3D322C]">
                  🎯 {lang === 'th' ? 'ตั้งค่าเพดานดาวจากคุณครูสอนพิเศษ (ไม่เกิน 10 ⭐/คน/วัน)' : 'Tutor Daily Star Ceiling (Max 10 ⭐/kid/day)'}
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5">
                  {lang === 'th'
                    ? 'เพื่อคุมงบประมาณขนมและทรัพย์สินของมูลนิธิ คุณครูจะไม่สามารถกรอกเลขดาวเองได้ และให้ได้ไม่เกินเพดานนี้ต่อวัน'
                    : 'Protects foundation snack budget: tutors cannot enter custom stars and are capped at this daily limit per kid.'}
                </p>
              </div>
              <span className="rounded-xl bg-[#EFE8FC] border border-[#C8B7EB] px-3.5 py-1.5 text-sm font-extrabold text-[#3E2B63]">
                {lang === 'th' ? `เพดานปัจจุบัน: ${currentTutorCap} ⭐/คน/วัน` : `Current Cap: ${currentTutorCap} ⭐/kid/day`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {presets.map((p) => {
                const active = currentTutorCap === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setTutorCap(p.value)}
                    className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#C8B7EB] border-[#9B82CF] text-[#2F1E52]'
                        : 'bg-white border-[#E5DBFA] hover:bg-[#EFE8FC] text-[#5B4B7A]'
                    }`}
                  >
                    {lang === 'th' ? p.labelTh : p.labelEn}
                  </button>
                );
              })}

              <label className="flex items-center gap-2 ml-auto bg-white border border-[#E5DBFA] rounded-xl px-3 py-1.5 text-xs font-bold text-[#3D322C]">
                <span>{lang === 'th' ? 'กำหนดเอง (0–10):' : 'Custom (0–10):'}</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={currentTutorCap}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (Number.isNaN(parsed)) {
                      setTutorCap(0);
                    } else {
                      setTutorCap(parsed);
                    }
                  }}
                  className="w-16 rounded-lg border border-[#C8B7EB] bg-[#FAF7FF] px-2 py-1 text-center text-sm font-extrabold text-[#3E2B63]"
                />
                <span>⭐</span>
              </label>
            </div>
          </section>
        );
      })()}

      {/* Quick Tap Kid Roster (Fallback when kid phone / barcode has an issue) */}
      <section className="rounded-[28px] border-2 border-[#B9E8DF] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#3D322C]">
              👆 {lang === 'th' ? `รายชื่อน้องสำหรับพี่เลี้ยงจิ้มเช็คอินแทน (${kids.length} คน)` : `Staff Quick-Tap Kid Roster (${kids.length})`}
            </h3>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'th'
                ? 'กรณีโทรศัพท์น้องใช้ไม่ได้หรือบาร์โค้ดมีปัญหา แตะชื่อน้องเพื่อเช็คอินแทนสแกน ตั้งสถานะป่วย/ลาพัก หรือบันทึกกฎระเบียบได้ทันที'
                : 'Tap any kid below to check in manually, update leave status, or record rules when a phone or barcode has an issue.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStaffQrOpen(true)}
              className="min-h-[36px] rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer"
            >
              📷 {lang === 'th' ? 'สแกน QR น้องเพื่อแจกดาว / หักกฎ' : 'Scan Kid QR'}
            </button>
            <input
              type="text"
              value={quickKidSearch}
              onChange={(e) => setQuickKidSearch(e.target.value)}
              placeholder={lang === 'th' ? '🔍 ค้นหาชื่อ / รหัส (เช่น j1)' : '🔍 Search name / ID'}
              className="rounded-xl border border-[#DCE8E4] bg-white px-3 py-1.5 text-xs text-[#3D322C] w-44 sm:w-52"
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
                  onClick={() => setQuickGroupFilter(tab.g)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                    quickGroupFilter === tab.g
                      ? 'bg-[#C5F3EB] border border-[#64CBB9] text-[#0F423A]'
                      : 'bg-white border border-[#EBD8C3] text-[#6E5C52] hover:bg-[#FFF5BA]/40'
                  }`}
                >
                  {lang === 'th' ? tab.labelTh : tab.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {filteredQuickKids.map((kid) => {
            const isSelected = selectedQuickKid?.id === kid.id;
            const isAway = isKidAwayOnDate(kid, todayKey);
            const doneCount = [
              kid.daily.breakfastChecked,
              kid.daily.vanOrMorningChecked,
              kid.daily.returnedHomeChecked,
              kid.daily.extraStudyChecked,
              kid.daily.choresChecked,
              kid.daily.phoneReturnedChecked,
            ].filter(Boolean).length;

            return (
              <button
                key={kid.id}
                type="button"
                onClick={() => {
                  setSelectedQuickKidId((prev) => (prev === kid.id ? null : kid.id));
                  setQuickCheckFeedback(null);
                }}
                className={`rounded-2xl border p-3 text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'border-2 border-[#64CBB9] bg-[#DCF7F2]'
                    : isAway
                    ? 'border-[#C8B7EB] bg-[#F6F2FD] hover:bg-[#EFE8FC]'
                    : 'border-[#EAE1D8] bg-[#FFF9F4] hover:bg-[#FFF3E6]'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-[#3D322C] truncate">
                    {kid.emoji} {kid.nickname}
                  </div>
                  <div className="text-[11px] text-[#7B695F] truncate">
                    {isAway ? `🏡 ลาพักถึง ${kid.allowance?.awayUntilDateKey}` : `${kid.id} · กลุ่ม ${kid.group}`}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                    isAway
                      ? 'bg-[#EAE4F2] text-[#463A59]'
                      : doneCount > 0
                      ? 'bg-[#B7EFE5] text-[#114A42]'
                      : 'bg-white border border-[#E5DAD0] text-[#7B695F]'
                  }`}
                >
                  {isAway ? '🏡 ลา' : `${doneCount}/6`}
                </span>
              </button>
            );
          })}
        </div>

        {selectedQuickKid && (
          <div className="rounded-2xl border-2 border-[#9FE2D6] bg-[#F3FCFA] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-extrabold text-[#114A42]">
                  {selectedQuickKid.emoji} น้อง{selectedQuickKid.nickname} ({selectedQuickKid.fullName}) · ⭐{' '}
                  {selectedQuickKid.stars.toLocaleString()}
                </div>
                <div className="text-xs text-[#2B665D]">
                  {lang === 'th'
                    ? `รหัส ${selectedQuickKid.id} · กลุ่ม ${selectedQuickKid.group} — จิ้มปุ่มด้านล่างเพื่อเช็คอินแทนบาร์โค้ด หรือบันทึกกฎระเบียบได้เลย`
                    : `ID ${selectedQuickKid.id} · Group ${selectedQuickKid.group} — Tap check-ins or record rules below`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onQuickGoToSchool && (
                  <button
                    type="button"
                    disabled={Boolean(selectedQuickKid.daily.vanOrMorningChecked)}
                    onClick={() => {
                      const res = onQuickGoToSchool(selectedQuickKid.id);
                      if (res) {
                        setQuickCheckFeedback(`${res.emoji} ${res.bannerTitle} — ${res.bannerSubtitle}`);
                      }
                    }}
                    className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      selectedQuickKid.daily.vanOrMorningChecked
                        ? 'bg-[#E5F7F2] border border-[#9FE2D6] text-[#1D5E52] cursor-default'
                        : 'bg-[#114A42] hover:bg-[#0D3A34] text-white cursor-pointer'
                    }`}
                  >
                    {selectedQuickKid.daily.vanOrMorningChecked
                      ? lang === 'th'
                        ? '✅ ไปโรงเรียนแล้ว'
                        : '✅ Gone to School'
                      : lang === 'th'
                      ? '🚌 ไปโรงเรียน'
                      : '🚌 Go to School'}
                  </button>
                )}
                {onExpressKioskScan && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = onExpressKioskScan(selectedQuickKid.id);
                      if (res) {
                        playKioskChime(res.success);
                        setQuickCheckFeedback(`${res.emoji} ${res.bannerTitle} — ${res.bannerSubtitle}`);
                      }
                    }}
                    className="min-h-[38px] rounded-xl bg-[#FFF8CC] hover:bg-[#FFF3B3] border border-[#F5DE93] px-3.5 py-1.5 text-xs font-bold text-[#5A4614] cursor-pointer"
                  >
                    ⚡ {lang === 'th' ? 'เช็คอินด่วนตามเวลาจริง' : 'Express Check-In Now'}
                  </button>
                )}
                {(() => {
                  const hasSundayLatePenaltyToday = selectedQuickKid.starHistory.some(
                    (tx) =>
                      tx.timestamp.slice(0, 10) === todayKey &&
                      tx.amount < 0 &&
                      tx.reason.includes('เช้าวันอาทิตย์เกิน')
                  );
                  const hasSundayWaiverToday = selectedQuickKid.starHistory.some(
                    (tx) =>
                      tx.timestamp.slice(0, 10) === todayKey &&
                      tx.amount > 0 &&
                      tx.reason.includes('ยกเว้นเหตุสุดวิสัยเช้าวันอาทิตย์')
                  );
                  if (!hasSundayLatePenaltyToday || hasSundayWaiverToday) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateKid(
                          selectedQuickKid.id,
                          (prev) => ({
                            ...prev,
                            stars: prev.stars + 5,
                            starHistory: [
                              {
                                id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                                timestamp: now.toISOString(),
                                reason: `พี่เลี้ยง (${loggedInStaff.nickname}) ยกเว้นเหตุสุดวิสัยเช้าวันอาทิตย์ (คืน +5 ⭐)`,
                                amount: 5,
                              },
                              ...prev.starHistory,
                            ].slice(0, 60),
                          }),
                          `Waive Sunday Morning Late (${selectedQuickKid.nickname})`
                        );
                        setQuickCheckFeedback(
                          lang === 'th'
                            ? `☀️ ยกเว้นเหตุสุดวิสัยวันอาทิตย์และคืน +5 ⭐ ให้น้อง${selectedQuickKid.nickname} แล้ว`
                            : `☀️ Waived Sunday accident & refunded +5 ⭐ for ${selectedQuickKid.nickname}`
                        );
                      }}
                      className="min-h-[38px] rounded-xl bg-[#FFEFE3] hover:bg-[#FFE1CC] border border-[#F2BE96] px-3.5 py-1.5 text-xs font-bold text-[#7A3B10] cursor-pointer"
                    >
                      ☀️ {lang === 'th' ? 'คืนดาวเหตุสุดวิสัยวันอาทิตย์ (+5 ⭐)' : 'Waive Sunday Late (+5 ⭐)'}
                    </button>
                  );
                })()}
              </div>
            </div>

            {quickCheckFeedback && (
              <div className="rounded-xl border border-[#9FE2D6] bg-white px-3.5 py-2 text-xs font-bold text-[#114A42]">
                {quickCheckFeedback}
              </div>
            )}

            {/* Leave / Away Status Toggle (Skip 70 THB school deduction & overdue step popups) */}
            {(() => {
              const isAwayNow = isKidAwayOnDate(selectedQuickKid, todayKey);
              const setAwayDays = (days: number, reason: string) => {
                const untilDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.max(0, days - 1));
                const untilKey = getDateKey(untilDate);
                onUpdateKid(
                  selectedQuickKid.id,
                  (prev) => {
                    const { allowance } = ensureCurrentWeekAllowance(prev, now, state.settings);
                    return {
                      ...prev,
                      allowance: {
                        ...allowance,
                        awayUntilDateKey: untilKey,
                        awayReason: reason,
                      },
                    };
                  },
                  `Set Away (${selectedQuickKid.nickname} until ${untilKey})`
                );
                setQuickCheckFeedback(
                  `🏡 ตั้งสถานะลาพักให้น้อง${selectedQuickKid.nickname} (${reason}) ถึง ${untilKey} — งดหัก 70 ฿/วัน & งดแจ้งเตือนสายแล้ว`
                );
              };
              const clearAway = () => {
                onUpdateKid(
                  selectedQuickKid.id,
                  (prev) => {
                    const { allowance } = ensureCurrentWeekAllowance(prev, now, state.settings);
                    return {
                      ...prev,
                      allowance: {
                        ...allowance,
                        awayUntilDateKey: null,
                        awayReason: '',
                      },
                    };
                  },
                  `Clear Away (${selectedQuickKid.nickname})`
                );
                setQuickCheckFeedback(
                  `🏠 ยกเลิกสถานะลาพัก — น้อง${selectedQuickKid.nickname} กลับมาอยู่บ้านตามปกติแล้ว`
                );
              };

              const selectedKidEco = getKidEconomyConfig(selectedQuickKid, state.settings);
              return (
                <div className="rounded-xl border border-[#D8CDF2] bg-[#FAF8FF] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-bold text-[#3E2B63]">
                    🏡{' '}
                    {isAwayNow
                      ? lang === 'th'
                        ? `กำลังลาพัก (${selectedQuickKid.allowance?.awayReason || 'ไม่อยู่บ้าน'}) ถึง ${selectedQuickKid.allowance?.awayUntilDateKey} · งดหัก ${selectedKidEco.dailyAllowanceThb} ฿ & งดเตือนสาย`
                        : `On leave (${selectedQuickKid.allowance?.awayReason || 'Away'}) until ${selectedQuickKid.allowance?.awayUntilDateKey}`
                      : lang === 'th'
                      ? `สถานะลาพัก / กลับบ้าน / ไปค่าย (งดหัก ${selectedKidEco.dailyAllowanceThb} ฿/วัน & งดเตือนสาย):`
                      : `Away / Camp Leave (Skip ${selectedKidEco.dailyAllowanceThb} THB deduction & alerts):`}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAwayDays(1, 'ลาหยุด / ไปกิจกรรมวันนี้')}
                      className="rounded-lg bg-white hover:bg-[#EFE8FC] border border-[#C8B7EB] px-2.5 py-1 font-bold text-[#3E2B63] cursor-pointer"
                    >
                      {lang === 'th' ? 'ลาวันนี้ (1 วัน)' : 'Today (1d)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwayDays(3, 'กลับบ้าน / ไปค่าย 3 วัน')}
                      className="rounded-lg bg-white hover:bg-[#EFE8FC] border border-[#C8B7EB] px-2.5 py-1 font-bold text-[#3E2B63] cursor-pointer"
                    >
                      {lang === 'th' ? 'กลับบ้าน/ค่าย 3 วัน' : '3 Days'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwayDays(7, 'ลาพัก 7 วัน')}
                      className="rounded-lg bg-white hover:bg-[#EFE8FC] border border-[#C8B7EB] px-2.5 py-1 font-bold text-[#3E2B63] cursor-pointer"
                    >
                      {lang === 'th' ? 'ลา 7 วัน' : '7 Days'}
                    </button>
                    {isAwayNow && (
                      <button
                        type="button"
                        onClick={clearAway}
                        className="rounded-lg bg-[#FADADD] hover:bg-[#F3B7C0] px-2.5 py-1 font-bold text-[#7B2E3B] cursor-pointer"
                      >
                        ✕ {lang === 'th' ? 'กลับมาอยู่บ้านแล้ว' : 'Back Home'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                {
                  key: 'morningPhonePickupChecked' as const,
                  emoji: '📱',
                  labelTh: 'รับมือถือเช้า',
                  labelEn: 'AM Phone',
                  onToggle: (prev: Member, nextVal: boolean): Member => ({
                    ...prev,
                    daily: { ...prev.daily, morningPhonePickupChecked: nextVal },
                  }),
                },
                {
                  key: 'breakfastChecked' as const,
                  emoji: '🍚',
                  labelTh: 'ข้าวเช้า',
                  labelEn: 'Breakfast',
                  onToggle: (prev: Member, nextVal: boolean): Member => ({
                    ...prev,
                    avatar: nextVal ? { ...prev.avatar, outfitMode: 'uniform' } : prev.avatar,
                    daily: { ...prev.daily, breakfastChecked: nextVal },
                  }),
                },
                {
                  key: 'vanOrMorningChecked' as const,
                  emoji: '🚐',
                  labelTh: 'รถตู้ / ไปเรียน',
                  labelEn: 'Van / School',
                  onToggle: (prev: Member, nextVal: boolean): Member => ({
                    ...prev,
                    avatar: nextVal ? { ...prev.avatar, outfitMode: 'uniform' } : prev.avatar,
                    daily: { ...prev.daily, vanOrMorningChecked: nextVal },
                  }),
                },
                {
                  key: 'returnedHomeChecked' as const,
                  emoji: '🏡',
                  labelTh: 'กลับบ้าน',
                  labelEn: 'Return Home',
                  onToggle: (prev: Member, nextVal: boolean): Member => ({
                    ...prev,
                    avatar: nextVal ? { ...prev.avatar, outfitMode: 'lounge' } : prev.avatar,
                    daily: {
                      ...prev.daily,
                      returnedHomeChecked: nextVal,
                      speedyNinjaStartMs: nextVal ? prev.daily.speedyNinjaStartMs ?? now.getTime() : null,
                    },
                  }),
                },
                {
                  key: 'extraStudyChecked' as const,
                  emoji: '📚',
                  labelTh: 'เรียนเสริม',
                  labelEn: 'Extra Study',
                  onToggle: (prev: Member, nextVal: boolean): Member => ({
                    ...prev,
                    daily: { ...prev.daily, extraStudyChecked: nextVal },
                  }),
                },
                {
                  key: 'choresChecked' as const,
                  emoji: '🧹',
                  labelTh: 'งานบ้าน',
                  labelEn: 'Chores',
                  onToggle: (prev: Member, nextVal: boolean): Member => ({
                    ...prev,
                    daily: { ...prev.daily, choresChecked: nextVal },
                  }),
                },
                {
                  key: 'phoneReturnedChecked' as const,
                  emoji: '📱',
                  labelTh: 'คืนมือถือ',
                  labelEn: 'Phone Return',
                  onToggle: (prev: Member, nextVal: boolean): Member => ({
                    ...prev,
                    daily: { ...prev.daily, phoneReturnedChecked: nextVal },
                  }),
                },
              ].map((stage) => {
                const checked = Boolean(selectedQuickKid.daily[stage.key]);
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => {
                      const nextVal = !checked;
                      onUpdateKid(
                        selectedQuickKid.id,
                        (prev) => stage.onToggle(prev, nextVal),
                        `Staff Tap ${stage.labelTh} (${selectedQuickKid.nickname}: ${nextVal ? 'ON' : 'OFF'} by ${loggedInStaff.nickname})`
                      );
                      setQuickCheckFeedback(
                        nextVal
                          ? `✅ พี่เลี้ยง${loggedInStaff.nickname} จิ้มเช็ค "${stage.labelTh}" ให้น้อง${selectedQuickKid.nickname} แล้ว`
                          : `↩️ ยกเลิกเช็ค "${stage.labelTh}" ของน้อง${selectedQuickKid.nickname} แล้ว`
                      );
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer transition-colors flex items-center justify-between gap-1.5 ${
                      checked
                        ? 'border-[#64CBB9] bg-[#C5F3EB] text-[#0F423A]'
                        : 'border-[#E8DDD3] bg-white hover:bg-[#FFF8F2] text-[#5E4E45]'
                    }`}
                  >
                    <span className="truncate">
                      {stage.emoji} {lang === 'th' ? stage.labelTh : stage.labelEn}
                    </span>
                    <span className="shrink-0">{checked ? '✅' : '○'}</span>
                  </button>
                );
              })}
            </div>

            {/* Instant Helper Stars + Pink Piggy Bank & Rule Penalty Controls */}
            {(() => {
              const selectedKidEco = getKidEconomyConfig(selectedQuickKid, state.settings);
              const { allowance: kidAllowance } = ensureCurrentWeekAllowance(
                selectedQuickKid,
                now,
                state.settings
              );
              const nextMonPreview = Math.max(0, selectedKidEco.weeklyBaseThb - kidAllowance.weeklyPenaltyThb);
              const grantHelperStars = (amt: number, customReason?: string) => {
                const cleanAmt = Math.max(1, Math.round(amt));
                const note = (customReason ?? helperStarReason).trim() || 'ช่วยงานบ้านพิเศษ';
                onUpdateKid(
                  selectedQuickKid.id,
                  (prev) => ({
                    ...prev,
                    stars: prev.stars + cleanAmt,
                    starHistory: [
                      {
                        id: `tx_help_${Date.now()}`,
                        timestamp: now.toISOString(),
                        reason: `🌟 พี่เลี้ยง (${loggedInStaff.nickname}) ให้ดาวพิเศษ: ${note} (+${cleanAmt} ⭐)`,
                        amount: cleanAmt,
                      },
                      ...prev.starHistory,
                    ].slice(0, 60),
                  }),
                  `Staff Helper Stars +${cleanAmt}`
                );
                setQuickCheckFeedback(
                  `🌟 ให้ดาวพิเศษ +${cleanAmt} ⭐ น้อง${selectedQuickKid.nickname} (${note}) เรียบร้อย!`
                );
              };

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                  {/* Helper Bonus Stars Card */}
                  <div className="rounded-2xl border border-[#F4DB73] bg-[#FFFDF0] p-3.5 space-y-2.5">
                    <div className="text-xs font-extrabold text-[#5A4208]">
                      ⭐ {lang === 'th' ? 'ให้ดาวพิเศษนอกเหนือคำสั่ง (ช่วยงาน / มาก่อน 15 นาที)' : 'Grant Extra Helper Stars'}
                    </div>
                    <input
                      type="text"
                      value={helperStarReason}
                      onChange={(e) => setHelperStarReason(e.target.value)}
                      placeholder={lang === 'th' ? 'เหตุผล เช่น ช่วยจัดของ / เตรียมตัวไว' : 'Reason'}
                      className="w-full rounded-xl border border-[#F4DB73] bg-white px-3 py-1.5 text-xs text-[#3D322C]"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[1, 2, 3, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => grantHelperStars(n)}
                          className="rounded-xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#EED27C] px-3 py-1.5 text-xs font-extrabold text-[#4A380D] cursor-pointer"
                        >
                          +{n} ⭐
                        </button>
                      ))}
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={customHelperStars}
                          onChange={(e) => setCustomHelperStars(Math.max(1, Number(e.target.value) || 1))}
                          className="w-12 rounded-lg border border-[#EBD8C3] bg-white px-1.5 py-1 text-center text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => grantHelperStars(customHelperStars)}
                          className="rounded-xl bg-[#3D322C] text-white px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                        >
                          {lang === 'th' ? 'ให้ดาว' : 'Give'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pink Piggy Bank & Rule Penalty Card */}
                  <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFF6F8] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-[#6E2638]">
                        <PinkPiggySvg className="w-6 h-6" isNegative={kidAllowance.coins < 0} />
                        <span>
                          {lang === 'th'
                            ? `กระปุกสีชมพู: ${kidAllowance.coins} ฿`
                            : `Pink Piggy: ${kidAllowance.coins} THB`}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[#7B5962] tabular-nums">
                        {lang === 'th'
                          ? `หักสะสม -${kidAllowance.weeklyPenaltyThb} ฿ · จันทร์หน้ารับ ${nextMonPreview} ฿`
                          : `Penalty -${kidAllowance.weeklyPenaltyThb} · Next Mon ${nextMonPreview}`}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {onRecordRulePenalty && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onRecordRulePenalty(
                                selectedQuickKid.id,
                                5,
                                'ไปโรงเรียนสาย (-5 ฿)',
                                loggedInStaff.nickname
                              );
                              setQuickCheckFeedback(
                                `🐷 หัก -5 ฿ น้อง${selectedQuickKid.nickname} โอนเข้ากระปุกหมูสีทองแล้ว!`
                              );
                            }}
                            className="rounded-xl bg-[#FFE0E6] hover:bg-[#FFC9D4] border border-[#EE9CAF] px-2.5 py-1.5 text-[11px] font-bold text-[#8B1D36] cursor-pointer"
                          >
                            ⏰ สาย (-5 ฿ → ทองคำ)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onRecordRulePenalty(
                                selectedQuickKid.id,
                                customPenaltyThb,
                                customPenaltyReason.trim() || 'ผิดกฎบ้าน',
                                loggedInStaff.nickname
                              );
                              setQuickCheckFeedback(
                                `🐷 หัก -${customPenaltyThb} ฿ น้อง${selectedQuickKid.nickname} เข้ากระปุกหมูสีทองแล้ว!`
                              );
                            }}
                            className="rounded-xl bg-[#FCE2E8] hover:bg-[#F7C7D2] border border-[#E598AB] px-2.5 py-1.5 text-[11px] font-bold text-[#7D1D35] cursor-pointer"
                          >
                            ⚖️ หัก {customPenaltyThb} ฿
                          </button>
                        </>
                      )}
                      <input
                        type="number"
                        min={1}
                        max={350}
                        value={customPenaltyThb}
                        onChange={(e) => setCustomPenaltyThb(Math.max(1, Number(e.target.value) || 1))}
                        className="w-14 rounded-lg border border-[#F3B7C0] bg-white px-1.5 py-1 text-center text-xs font-bold"
                        aria-label="Penalty THB"
                      />
                      <input
                        type="text"
                        value={customPenaltyReason}
                        onChange={(e) => setCustomPenaltyReason(e.target.value)}
                        placeholder={lang === 'th' ? 'เหตุผลหักเงิน' : 'Reason'}
                        className="flex-1 min-w-[110px] rounded-lg border border-[#F3B7C0] bg-white px-2 py-1 text-xs"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {onSimulateNextSchoolDay && (
                        <button
                          type="button"
                          onClick={() => {
                            onSimulateNextSchoolDay(selectedQuickKid.id);
                            setQuickCheckFeedback(
                              `🚌 จำลองหักค่าไปโรงเรียนวันถัดไป (-${selectedKidEco.dailyAllowanceThb} ฿) ให้น้อง${selectedQuickKid.nickname} แล้ว`
                            );
                          }}
                          className="rounded-xl bg-[#DCEEF8] hover:bg-[#C6E2F3] border border-[#9EC6E3] px-2.5 py-1.5 text-[11px] font-bold text-[#1B4A73] cursor-pointer"
                        >
                          🚌 {lang === 'th' ? `จำลองไป รร. ถัดไป (-${selectedKidEco.dailyAllowanceThb} ฿)` : `Simulate School Day (-${selectedKidEco.dailyAllowanceThb})`}
                        </button>
                      )}
                      {onTriggerMondayReset && (
                        <button
                          type="button"
                          onClick={() => {
                            onTriggerMondayReset(selectedQuickKid.id);
                            setQuickCheckFeedback(
                              `📅 จำลองเริ่มวันจันทร์สัปดาห์ใหม่ให้น้อง${selectedQuickKid.nickname} เรียบร้อย (${selectedKidEco.weeklyBaseThb} - ${kidAllowance.weeklyPenaltyThb} = ${nextMonPreview} ฿)`
                            );
                          }}
                          className="rounded-xl bg-[#D4F0F0] hover:bg-[#BDE6E2] border border-[#8AD1C9] px-2.5 py-1.5 text-[11px] font-bold text-[#154A42] cursor-pointer"
                        >
                          📅 {lang === 'th' ? 'จำลองวันจันทร์ใหม่ (คนนี้)' : 'Simulate Monday Reset'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* Shared Golden Piggy Bank Management & Weekly Monday Rollover */}
      <section className="rounded-[28px] border-2 border-[#F0C84B] bg-[#FFFDF4] p-5 pastel-shadow space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GoldenPiggySvg className="w-11 h-11 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-[#3D322C]">
                🪙🐷 {lang === 'th' ? `กระปุกหมูสีทอง (กองทุนกลาง): ${goldenPoolBalance.toLocaleString()} ฿` : `Golden Piggy Bank (Shared Pool): ${goldenPoolBalance.toLocaleString()} THB`}
              </h3>
              <p className="text-xs text-[#6E5C52]">
                {lang === 'th'
                  ? 'รวมยอดหักผิดกฎจากน้องๆ เพื่อใช้จัดกิจกรรมหรือขนมส่วนรวม และสามารถกดจำลองเริ่มสัปดาห์ใหม่วันจันทร์ได้ทั้งบ้าน'
                  : 'Collects penalty transfers for shared house treats; also triggers Monday carryover reset for all kids.'}
              </p>
            </div>
          </div>

          {onTriggerMondayReset && (
            <button
              type="button"
              onClick={() => onTriggerMondayReset()}
              className="min-h-[40px] rounded-2xl bg-[#FFF3C4] hover:bg-[#FFE680] border border-[#E8C149] px-4 py-2 text-xs sm:text-sm font-bold text-[#5A3B00] cursor-pointer"
            >
              📅 {lang === 'th' ? `เริ่มสัปดาห์ใหม่วันจันทร์ทั้งบ้าน (${eco.weeklyBaseThb} ฿ - โทษ)` : 'Start New Monday Week (All Kids)'}
            </button>
          )}
        </div>

        {onAddGoldenPoolPayout && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#F4DB73] bg-white p-3 text-xs">
            <span className="font-bold text-[#5A3B00]">
              🎁 {lang === 'th' ? 'เบิกกองทุนกลางจัดขนม/กิจกรรมรวม:' : 'Pool Treat Payout:'}
            </span>
            <input
              type="number"
              min={1}
              max={Math.max(1, goldenPoolBalance)}
              value={poolPayoutThb}
              onChange={(e) => setPoolPayoutThb(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-xl border border-[#EBD8C3] px-2 py-1.5 text-center font-bold"
            />
            <span>฿</span>
            <input
              type="text"
              value={poolPayoutReason}
              onChange={(e) => setPoolPayoutReason(e.target.value)}
              placeholder={lang === 'th' ? 'รายละเอียด เช่น ซื้อไอติมเย็นวันศุกร์' : 'Treat reason'}
              className="flex-1 min-w-[180px] rounded-xl border border-[#EBD8C3] px-3 py-1.5"
            />
            <button
              type="button"
              disabled={goldenPoolBalance <= 0}
              onClick={() => {
                if (poolPayoutThb > goldenPoolBalance) {
                  onShowAlert({
                    icon: '🪙',
                    title: lang === 'th' ? 'ยอดในกระปุกทองคำไม่พอ' : 'Insufficient Golden Pool',
                    message:
                      lang === 'th'
                        ? `กองทุนกลางมี ${goldenPoolBalance} ฿`
                        : `Pool balance is ${goldenPoolBalance} THB`,
                    tone: 'yellow',
                  });
                  return;
                }
                onAddGoldenPoolPayout(
                  poolPayoutThb,
                  poolPayoutReason.trim() || 'กิจกรรมส่วนรวมจากกองทุนกลาง',
                  loggedInStaff.nickname
                );
              }}
              className={`rounded-xl px-4 py-1.5 font-bold ${
                goldenPoolBalance > 0
                  ? 'bg-[#3D322C] text-white cursor-pointer'
                  : 'bg-[#EADBC8] text-[#8C7A6B] cursor-not-allowed'
              }`}
            >
              {lang === 'th' ? 'บันทึกเบิกกองทุน' : 'Record Payout'}
            </button>
          </div>
        )}
      </section>

      {/* Daily Sick Kids Alert Table */}
      <section className="rounded-[28px] border-2 border-[#F3C5AE] bg-[#FFFDF9] p-5 pastel-shadow">
        <h3 className="text-lg font-bold text-[#3D322C] mb-3">
          🤒 {lang === 'th' ? `แจ้งเตือนเด็กป่วยประจำวัน (${activeSick.length} เคส)` : `Daily Sick Kids Alerts (${activeSick.length})`}
        </h3>
        {activeSick.length === 0 ? (
          <div className="rounded-2xl bg-[#D4F0F0]/50 p-4 text-sm font-semibold text-[#2E524E]">
            ✨ {lang === 'th' ? 'วันนี้น้องๆ ทุกคนสุขภาพแข็งแรง ไม่มีเคสป่วยค้างอยู่' : 'All kids are healthy today!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EBD8C3] text-[#6E5C52]">
                  <th className="py-2.5 pr-4">{lang === 'th' ? 'ชื่อน้อง' : 'Name'}</th>
                  <th className="py-2.5 pr-4">{lang === 'th' ? 'อาการ' : 'Symptoms'}</th>
                  <th className="py-2.5 pr-4">{lang === 'th' ? 'รายละเอียด' : 'Details'}</th>
                  <th className="py-2.5 pr-4">{lang === 'th' ? 'เวลาที่แจ้ง' : 'Reported'}</th>
                  <th className="py-2.5 text-right">{lang === 'th' ? 'จัดการ' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {activeSick.map((rep) => (
                  <tr key={rep.id} className="border-b border-[#F5ECE2]">
                    <td className="py-3 pr-4 font-bold">{rep.kidNickname}</td>
                    <td className="py-3 pr-4">{rep.symptoms}</td>
                    <td className="py-3 pr-4 text-[#6E5C52]">{rep.details}</td>
                    <td className="py-3 pr-4 tabular-nums text-xs">
                      {new Date(rep.reportedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onResolveSick(rep.id);
                          onShowAlert({
                            icon: '💚',
                            title: lang === 'th' ? 'ปิดเคสอาการป่วยแล้ว' : 'Sick Case Closed',
                            message: `${rep.kidNickname} ${lang === 'th' ? 'หายป่วยเรียบร้อยแล้ว!' : 'recovered!'}`,
                            tone: 'mint',
                          });
                        }}
                        className="rounded-xl bg-[#D4F0F0] hover:bg-[#B8E5E1] px-3.5 py-2 text-xs font-bold text-[#214F4B] cursor-pointer whitespace-nowrap"
                      >
                        ✅ {lang === 'th' ? 'หายป่วยแล้ว' : 'Recovered'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 15+ Kids Control Table + Kitchen Duty Assignment (15:30 + Sat 09:30 + Sun 09:15) */}
      <section className="rounded-[28px] border-2 border-[#DCEEF8] bg-[#FFFDF9] p-5 pastel-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-lg font-bold text-[#3D322C]">
              👧👦 {lang === 'th' ? `ตารางควบคุมสถานะเด็ก (${kids.length} คน) & จัดเวรห้องครัว` : `Kids Status Control (${kids.length}) & Kitchen Duty`}
            </h3>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'th'
                ? 'ติ๊กเลือกรายชื่อน้องที่ได้รับมอบหมายเวรห้องครัว: เช้า เสาร์–นักขัตฤกษ์ 09:30 น. · อาทิตย์ 09:15 น. · เย็น 15:30 น. เท่ากันทั้ง 3 วัน (เสาร์/อาทิตย์/นักขัตฯ) เพื่อให้แม่ครัวยืนยันและเพิ่มดาว'
                : 'Assign kids to kitchen duty: Morning Sat/Public Holiday 09:30 · Morning Sun 09:15 · Evening 15:30 (same all 3 days).'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-[#EBD8C3] text-[#6E5C52] text-xs">
                <th className="py-2.5 pr-3">{lang === 'th' ? 'รหัส / ชื่อ' : 'ID / Name'}</th>
                <th className="py-2.5 px-2 text-right">{lang === 'th' ? 'ดาวสะสม' : 'Stars'}</th>
                <th className="py-2.5 px-2 text-right">{lang === 'th' ? 'ค่าปรับ (฿)' : 'Fine (THB)'}</th>
                <th className="py-2.5 px-2">{lang === 'th' ? 'สิทธิ์การ์ตูน/มือถือ' : 'Privileges'}</th>
                <th className="py-2.5 px-2 text-center">{lang === 'th' ? 'เย็น 15:30 (3 วัน)' : 'Eve 15:30'}</th>
                <th className="py-2.5 px-2 text-center">{lang === 'th' ? 'เสาร์–นักขัตฯ 09:30' : 'Sat/Hol 09:30'}</th>
                <th className="py-2.5 px-2 text-center">{lang === 'th' ? 'อาทิตย์ 09:15' : 'Sun 09:15'}</th>
                <th className="py-2.5 pl-2 text-right">{lang === 'th' ? 'การจัดการ' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {kids.map((kid) => {
                const phoneBlocked =
                  kid.penalty.phoneConfiscatedUntil1830Date === todayKey ||
                  kid.penalty.noEveningPhoneTomorrowDate === todayKey;
                return (
                  <tr key={kid.id} className="border-b border-[#F5ECE2] hover:bg-[#FFF5BA]/20">
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <div className="font-bold text-[#3D322C]">
                        {kid.emoji} {kid.nickname}{' '}
                        <span className="text-xs font-normal text-[#7B695F]">({kid.id})</span>
                      </div>
                      <div className="text-[11px] text-[#8D7B70]">
                        G{kid.group} · {kid.fullName}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-bold tabular-nums text-[#3D322C]">
                      ⭐ {kid.stars.toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-right font-bold tabular-nums text-[#B84A39]">
                      {kid.penalty.lateFineThb}
                    </td>
                    <td className="py-3 px-2 text-xs whitespace-nowrap">
                      {kid.group === 1 ? (
                        <span className={kid.daily.bossStageUnlocked ? 'text-[#2F685E] font-bold' : 'text-[#7B695F]'}>
                          📺 {kid.daily.bossStageUnlocked ? 'ปลดล็อกการ์ตูนแล้ว' : 'รอปลดล็อก 20:00'}
                        </span>
                      ) : (
                        <span className={phoneBlocked ? 'text-[#B84A39] font-bold' : 'text-[#2F685E] font-bold'}>
                          📱 {phoneBlocked ? 'ติดโทษงดมือถือ' : 'สิทธิ์ปกติ'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={kid.kitchenDuty.evening1530}
                        onChange={(e) =>
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              kitchenDuty: { ...prev.kitchenDuty, evening1530: e.target.checked },
                            }),
                            'Toggle Kitchen 15:30'
                          )
                        }
                        className="h-4 w-4 accent-[#3D322C] cursor-pointer"
                        aria-label={`${kid.nickname} kitchen 15:30`}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={kid.kitchenDuty.sat0930}
                        onChange={(e) =>
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              kitchenDuty: { ...prev.kitchenDuty, sat0930: e.target.checked },
                            }),
                            'Toggle Kitchen Sat 09:30'
                          )
                        }
                        className="h-4 w-4 accent-[#3D322C] cursor-pointer"
                        aria-label={`${kid.nickname} kitchen sat 09:30`}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={kid.kitchenDuty.sun0915}
                        onChange={(e) =>
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              kitchenDuty: { ...prev.kitchenDuty, sun0915: e.target.checked },
                            }),
                            'Toggle Kitchen Sun 09:15'
                          )
                        }
                        className="h-4 w-4 accent-[#3D322C] cursor-pointer"
                        aria-label={`${kid.nickname} kitchen sun 09:15`}
                      />
                    </td>
                    <td className="py-3 pl-2 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              stars: prev.stars + 10,
                              starHistory: [
                                {
                                  id: `tx_${Date.now()}`,
                                  timestamp: now.toISOString(),
                                  reason: `พี่เลี้ยง (${loggedInStaff.nickname}) เพิ่มดาวด่วน +10 ⭐`,
                                  amount: 10,
                                },
                                ...prev.starHistory,
                              ],
                            }),
                            'Staff Quick +10 Stars'
                          );
                          onShowAlert({
                            icon: '⭐',
                            title: lang === 'th' ? 'เพิ่ม +10 ดาวเรียบร้อย!' : 'Added +10 Stars!',
                            message: `${kid.nickname} (+10 ⭐)`,
                            tone: 'yellow',
                          });
                        }}
                        className="rounded-xl bg-[#FFF5BA] hover:bg-[#FCEB8E] px-2.5 py-1.5 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        +10⭐
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              penalty: {
                                lateFineThb: 0,
                                phoneConfiscatedUntil1830Date: null,
                                fridayFreeDayDeductedCount: 0,
                                noEveningPhoneTomorrowDate: null,
                                cartoonPrivilegeActive: true,
                                phonePrivilegeActive: true,
                              },
                            }),
                            'Staff Reset Penalties'
                          );
                          onShowAlert({
                            icon: '🧹',
                            title: lang === 'th' ? 'รีเซ็ตโทษ & เคลียร์ค่าปรับแล้ว' : 'Penalties Cleared',
                            message: `${kid.nickname}: 0 THB`,
                            tone: 'mint',
                          });
                        }}
                        className="rounded-xl bg-[#D4F0F0] hover:bg-[#B8E5E1] px-2.5 py-1.5 text-xs font-bold text-[#214F4B] cursor-pointer"
                      >
                        {lang === 'th' ? 'เคลียร์โทษ' : 'Clear'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onDeleteKid(kid.id);
                          onShowAlert({
                            icon: '🗑️',
                            title: lang === 'th' ? 'ลบรายชื่อแล้ว' : 'Kid Removed',
                            message: `${kid.nickname} (${kid.id})`,
                            tone: 'peach',
                          });
                        }}
                        className="rounded-xl bg-[#FADADD] hover:bg-[#F3B7C0] px-2.5 py-1.5 text-xs font-bold text-[#7B2E3B] cursor-pointer"
                      >
                        {lang === 'th' ? 'ลบ' : 'Del'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Daily Snack Redemption Bills Table & Add New Kid Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-6 rounded-[28px] border-2 border-[#FFF5BA] bg-[#FFFDF9] p-5 pastel-shadow">
          <h3 className="text-lg font-bold text-[#3D322C] mb-3">
            🏪 {lang === 'th' ? 'สรุปบิลแลกมินิมาร์ท & ขนมประจำวัน' : 'Daily Minimart & Snack Bills'}
          </h3>
          {todayBills.length === 0 ? (
            <p className="text-sm text-[#7B695F]">
              {lang === 'th' ? 'ยังไม่มีรายการแลกของมินิมาร์ทหรือขนมในวันนี้' : 'No minimart or snack redemptions yet.'}
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {todayBills.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-2xl border border-[#EBD8C3] bg-white px-4 py-2.5 text-sm"
                >
                  <div>
                    <div className="font-bold text-[#3D322C]">
                      {b.kidNickname} — {b.itemName}
                    </div>
                    <div className="text-xs text-[#7B695F] tabular-nums">
                      -{b.starsSpent} ⭐ · {new Date(b.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={b.fulfilled}
                    onClick={() => onFulfillBill(b.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                      b.fulfilled
                        ? 'bg-[#D4F0F0] text-[#214F4B]'
                        : 'bg-[#3D322C] text-white'
                    }`}
                  >
                    {b.fulfilled ? (lang === 'th' ? 'มอบแล้ว ✓' : 'Given ✓') : lang === 'th' ? 'ยืนยันมอบของ' : 'Fulfill'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 rounded-[28px] border-2 border-[#EAE4F2] bg-[#FFFDF9] p-5 pastel-shadow">
          <h3 className="text-lg font-bold text-[#3D322C] mb-3">
            ➕ {lang === 'th' ? 'เพิ่มรายชื่อเด็กใหม่ & แนบลิงก์เอกสาร' : 'Add Kid & Attach Document Links'}
          </h3>
          <form onSubmit={handleAddKidSubmit} className="space-y-3 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="ID (เช่น j6, s11)"
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
              />
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อเล่น' : 'Nickname'}
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
              />
              <input
                type="text"
                value={newPin}
                maxLength={4}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="PIN 4 หลัก"
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อ-นามสกุลจริง' : 'Full Name'}
                className="sm:col-span-2 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
              />
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(Number(e.target.value) as KidGroup)}
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
              >
                <option value={1}>กลุ่ม 1 (ประถม)</option>
                <option value={2}>กลุ่ม 2 (มัธยม)</option>
                <option value={3}>กลุ่ม 3 (วิทยาลัย)</option>
              </select>
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as Gender)}
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
              >
                <option value="F">หญิง (F)</option>
                <option value="M">ชาย (M)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                placeholder="อิโมจิ"
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-center"
              />
              <input
                type="url"
                value={newPersonalDrive}
                onChange={(e) => setNewPersonalDrive(e.target.value)}
                placeholder="ลิงก์ Personal Drive ผลงานน้อง"
                className="sm:col-span-3 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
              />
            </div>

            <input
              type="email"
              value={newLinkedEmail}
              onChange={(e) => setNewLinkedEmail(e.target.value)}
              placeholder={
                lang === 'th'
                  ? '📧 อีเมล Google ของน้อง (ไม่บังคับ — เพื่อให้น้องล็อกอินดูตัวการ์ตูนซิงค์สด)'
                  : '📧 Kid Google Email (Optional — for real-time personal device avatar sync)'
              }
              className="w-full rounded-xl border border-[#B5E5DC] bg-[#F5FCFA] px-3 py-2"
            />

            <input
              type="url"
              value={newRestrictedDocs}
              onChange={(e) => setNewRestrictedDocs(e.target.value)}
              placeholder="ลิงก์ Restricted Docs แฟ้มเอกสารราชการลับ"
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
            />

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white font-bold cursor-pointer"
            >
              ➕ {lang === 'th' ? 'เพิ่มรายชื่อน้องเข้ามูลนิธิ' : 'Add Kid to Foundation'}
            </button>
          </form>
        </section>
      </div>

      {/* Health Card & Custom House Chore Editor */}
      <section className="rounded-[28px] border-2 border-[#F3B7C0] bg-[#FFFDF9] p-5 pastel-shadow space-y-3">
        <h3 className="text-lg font-bold text-[#3D322C]">
          🩺🧹 {lang === 'th' ? 'อัปเดตบัตรสุขภาพ แพ้อาหาร/ยา & เวรบ้านเฉพาะวันของน้อง' : 'Update Kid Health/Allergy Card & Daily House Chore'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
          <select
            value={editingHealthKidId}
            onChange={(e) => {
              const id = e.target.value;
              setEditingHealthKidId(id);
              const k = kids.find((item) => item.id === id);
              if (k) {
                setHealthBlood(k.healthProfile?.bloodType || 'ไม่ระบุ');
                setHealthFoodAllergy(k.healthProfile?.foodAllergies || 'ไม่มี');
                setHealthDrugAllergy(k.healthProfile?.drugAllergies || 'ไม่มี');
                setHealthMeds(k.healthProfile?.regularMeds || 'ไม่มี');
                setHealthCustomChore(k.customHouseChore || '');
                setHealthLinkedEmail(k.linkedEmail || '');
              }
            }}
            className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 font-bold"
          >
            <option value="">-- เลือกชื่อน้อง --</option>
            {kids.map((k) => {
              const chore = getDailyHouseChoreForKid(k, kids, now, state.settings.isPublicHolidayToday);
              return (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.nickname} (เวรวันนี้: {chore.titleTh})
                </option>
              );
            })}
          </select>
          <input
            type="text"
            value={healthBlood}
            onChange={(e) => setHealthBlood(e.target.value)}
            placeholder="กรุ๊ปเลือด"
            className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
          />
          <input
            type="text"
            value={healthFoodAllergy}
            onChange={(e) => setHealthFoodAllergy(e.target.value)}
            placeholder="ประวัติแพ้อาหาร"
            className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
          />
          <input
            type="text"
            value={healthDrugAllergy}
            onChange={(e) => setHealthDrugAllergy(e.target.value)}
            placeholder="ประวัติแพ้ยา"
            className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
          />
          <input
            type="text"
            value={healthMeds}
            onChange={(e) => setHealthMeds(e.target.value)}
            placeholder="ยาประจำตัว / โรคประจำตัว"
            className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
          />
          <input
            type="text"
            value={healthCustomChore}
            onChange={(e) => setHealthCustomChore(e.target.value)}
            placeholder="กำหนดเวรบ้านพิเศษ (เว้นว่าง=เวรหมุนเวียน)"
            className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <input
            type="email"
            value={healthLinkedEmail}
            onChange={(e) => setHealthLinkedEmail(e.target.value)}
            placeholder={
              lang === 'th'
                ? '📧 อีเมล Google ของน้อง (เพื่อให้น้องล็อกอินดูตัวการ์ตูน Real-time บนมือถือตัวเอง)'
                : '📧 Kid Google Email (for real-time personal device sync)'
            }
            className="flex-1 min-w-[240px] rounded-xl border border-[#B5E5DC] bg-[#F5FCFA] px-3 py-2 text-xs text-[#3D322C]"
          />
          <button
            type="button"
            onClick={() => {
              const target = kids.find((k) => k.id === editingHealthKidId);
              if (!target) return;
              const cleanEmail = healthLinkedEmail.trim().toLowerCase();
              if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                onShowAlert({
                  icon: '⚠️',
                  title: lang === 'th' ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'Invalid Email Format',
                  message: lang === 'th' ? 'กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างไว้ค่ะ' : 'Please enter a valid email address.',
                  tone: 'pink',
                });
                return;
              }
              onUpdateKid(
                target.id,
                (prev) => ({
                  ...prev,
                  linkedEmail: cleanEmail || undefined,
                  customHouseChore: healthCustomChore.trim() || undefined,
                  healthProfile: {
                    bloodType: healthBlood.trim() || 'ไม่ระบุ',
                    foodAllergies: healthFoodAllergy.trim() || 'ไม่มี',
                    drugAllergies: healthDrugAllergy.trim() || 'ไม่มี',
                    chronicConditions: prev.healthProfile?.chronicConditions || 'ไม่มี',
                    regularMeds: healthMeds.trim() || 'ไม่มี',
                    emergencyNote: prev.healthProfile?.emergencyNote || 'สุขภาพแข็งแรงปกติ',
                  },
                }),
                `Staff Update Health, Chore & Email (${target.nickname})`
              );
              onShowAlert({
                icon: '🩺✅',
                title: lang === 'th' ? 'อัปเดตข้อมูลน้องและอีเมลซิงค์แล้ว!' : 'Updated Kid Profile & Sync Email!',
                message: cleanEmail
                  ? `บันทึกข้อมูลและผูกอีเมล ${cleanEmail} ให้น้อง${target.nickname} เรียบร้อยแล้ว`
                  : `บันทึกข้อมูลให้น้อง${target.nickname} เรียบร้อยแล้ว`,
                tone: 'mint',
              });
            }}
            className="min-h-[40px] rounded-xl bg-[#3D322C] text-white px-5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            💾 {lang === 'th' ? 'บันทึกข้อมูลสุขภาพ เวรบ้าน & อีเมล' : 'Save Health, Chore & Email'}
          </button>
        </div>
      </section>

      {/* Unified Kid Duty Schedules: Morning Zone, Holiday 14-Zone Cleaning, Kitchen Duty & Weekly Trash */}
      <section className="rounded-[28px] border-2 border-[#B8DEC9] bg-[#FFFDF9] p-5 pastel-shadow">
        <KidDutySchedulesPanel
          kids={kids}
          now={now}
          lang={lang}
          isPublicHolidayToday={state.settings.isPublicHolidayToday}
          onToggleKitchenSlot={(kidId, slot, checked) => {
            const target = kids.find((k) => k.id === kidId);
            if (!target) return;
            onUpdateKid(
              kidId,
              (prev) => ({
                ...prev,
                kitchenDuty: { ...prev.kitchenDuty, [slot]: checked },
              }),
              `Staff Update Kitchen Duty (${target.nickname})`
            );
          }}
        />
      </section>

      {/* Staff Sudden Leave & Substitute Planner */}
      <StaffLeavePanel
        actorName={loggedInStaff.nickname}
        defaultStaffName={loggedInStaff.nickname}
        members={members}
        staffLeaves={staffLeaves}
        now={now}
        lang={lang}
        isPublicHolidayToday={state.settings.isPublicHolidayToday}
        onSubmitLeave={onSubmitStaffLeave}
        onUpdateLeaveSubstitute={onUpdateLeaveSubstitute}
        onAcknowledgeLeave={onAcknowledgeLeave}
        onCancelLeave={onCancelLeave}
        onShowAlert={onShowAlert}
      />

      {/* Staff Working Hours, Night Watch & Driving Roster */}
      <section className="rounded-[28px] border-2 border-[#C4DCF0] bg-[#FFFDF9] p-5 pastel-shadow">
        <StaffRosterPanel
          now={now}
          lang={lang}
          isPublicHolidayToday={state.settings.isPublicHolidayToday}
          staffLeaves={staffLeaves}
        />
      </section>

      {/* Announcements, Secret Polls, Outing Trips & Confidential Backchannel Inbox */}
      <CareCommunityPanel
        authorName={loggedInStaff.nickname}
        authorRole="Staff"
        members={members}
        announcements={announcements}
        polls={polls}
        trips={trips}
        privateMessages={privateMessages}
        lostFoundItems={lostFoundItems}
        supplyRequests={supplyRequests}
        kindnessCards={kindnessCards}
        deedRedemptions={deedRedemptions}
        sickReports={sickReports}
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
        onAddSickReport={onAddSickReport}
        onResolveSick={onResolveSick}
        onShowAlert={onShowAlert}
      />

      <QrScannerModal
        open={staffQrOpen}
        lang={lang}
        initialKioskMode={false}
        onClose={() => setStaffQrOpen(false)}
        onExpressKioskScan={onExpressKioskScan}
        onDetectedCode={(code) => {
          const clean = code.trim().toLowerCase();
          const matchedKid = kids.find(
            (m) => m.id.toLowerCase() === clean || m.pin === code.trim()
          );
          if (matchedKid) {
            setStaffQrOpen(false);
            setSelectedQuickKidId(matchedKid.id);
            setQuickCheckFeedback(
              `📷 สแกนพบน้อง${matchedKid.nickname} (${matchedKid.id}) — พร้อมให้ดาวพิเศษหรือบันทึกกฎระเบียบด้านล่าง`
            );
          } else {
            onShowAlert({
              icon: '🔍',
              title: lang === 'th' ? 'ไม่พบรหัสน้อง' : 'Kid ID Not Found',
              message: lang === 'th' ? `ไม่พบรหัส "${code}"` : `ID "${code}" not found`,
              tone: 'pink',
            });
          }
        }}
      />
    </div>
  );
};
