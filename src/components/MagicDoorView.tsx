import { User } from 'firebase/auth';
import React, { useEffect, useMemo, useState } from 'react';
import { DAILY_WORDS_4_LANG } from '../data/dailyWords';
import { signInWithGoogleCloud, signOutCloud } from '../firebase';
import { MASTER_ADMIN_EMAIL } from '../services/firestoreSync';
import {
  AppState,
  Language,
  LinkedKidSession,
  Member,
  ModalAlertPayload,
  PastelTheme,
} from '../types/barnhem';
import {
  HOME_QUICK_ACTIONS,
  HomeQuickActionId,
  isHomeActionDoneForKid,
  isHomeActionOpenAt,
  KioskResult,
} from '../utils/expressKiosk';
import { isKidAwayOnDate } from '../utils/piggyBank';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';
import {
  formatDigitalClock,
  formatReadableDate,
  getDateKey,
  getLaundryQueueInfo,
} from '../utils/timeRules';
import { PinPadModal, QrScannerModal } from './CenteredAlertModal';
import { CloudSyncBanner } from './CloudSyncBanner';

export interface ThemeSwatchOption {
  id: PastelTheme;
  swatch: string;
  labelTh: string;
  labelEn: string;
}

interface MagicDoorViewProps {
  members: Member[];
  creatorPins: string[];
  now: Date;
  lang: Language;
  pastelTheme: PastelTheme;
  themeOptions: ThemeSwatchOption[];
  onChangeTheme: (theme: PastelTheme) => void;
  appState: AppState;
  cloudUser: User | null;
  cloudSyncing: boolean;
  onForceSeedCloud: () => Promise<void>;
  onSelectKid: (kidId: string) => void;
  onAutoLoginRole: (member: Member | 'creator') => void;
  onExpressKioskScan: (code: string) => KioskResult | null;
  onQuickGoToSchool: (kidId: string) => KioskResult | null;
  onQuickHomeAction?: (actionId: HomeQuickActionId, kidId: string) => KioskResult | null;
  onShowAlert: (payload: ModalAlertPayload) => void;
  organizationName?: string;
  linkedKidSession?: LinkedKidSession | null;
  linkedKidMember?: Member | null;
  onOpenLinkedKid?: () => void;
  onSignOutLinkedKid?: () => void;
}

export const MagicDoorView: React.FC<MagicDoorViewProps> = ({
  members,
  creatorPins,
  now,
  lang,
  pastelTheme,
  themeOptions,
  onChangeTheme,
  appState,
  cloudUser,
  cloudSyncing,
  onForceSeedCloud,
  onSelectKid,
  onAutoLoginRole,
  onExpressKioskScan,
  onQuickGoToSchool,
  onQuickHomeAction,
  onShowAlert,
  organizationName,
  linkedKidSession = null,
  linkedKidMember = null,
  onOpenLinkedKid,
  onSignOutLinkedKid,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [kidGoogleBusy, setKidGoogleBusy] = useState(false);
  const [showPinText, setShowPinText] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [activeBoardAction, setActiveBoardAction] = useState<HomeQuickActionId>('morning_school');
  const [schoolBoardOpen, setSchoolBoardOpen] = useState(false);
  const [schoolBoardGroup, setSchoolBoardGroup] = useState<0 | 1 | 2 | 3>(0);
  const [schoolBoardSearch, setSchoolBoardSearch] = useState('');
  const [schoolBoardResult, setSchoolBoardResult] = useState<KioskResult | null>(null);
  const [pendingKid, setPendingKid] = useState<Member | null>(null);
  const [quickActionsMenuOpen, setQuickActionsMenuOpen] = useState(false);
  const [pendingBoardUnlockAction, setPendingBoardUnlockAction] =
    useState<HomeQuickActionId | null>(null);
  const [showCloudSync, setShowCloudSync] = useState(false);
  const pinGuard = usePinGuard('magic_door');
  const staffBoardPinGuard = usePinGuard('magic_door_staff_board');

  const defaultWordIndex = useMemo(() => {
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return dayOfYear % DAILY_WORDS_4_LANG.length;
  }, [now]);

  const [wordOffset, setWordOffset] = useState(0);
  const activeWordIdx =
    (((defaultWordIndex + wordOffset) % DAILY_WORDS_4_LANG.length) + DAILY_WORDS_4_LANG.length) %
    DAILY_WORDS_4_LANG.length;
  const dailyWord = DAILY_WORDS_4_LANG[activeWordIdx];

  const kids = members.filter((m) => m.role === 'kid');
  const staffPins = useMemo(
    () =>
      Array.from(
        new Set([
          ...members.filter((m) => m.role === 'staff' || m.role === 'manager').map((m) => m.pin),
          ...creatorPins,
        ])
      ),
    [members, creatorPins]
  );
  const todayKey = getDateKey(now);
  const openHomeActions = useMemo(
    () => HOME_QUICK_ACTIONS.filter((a) => isHomeActionOpenAt(a.id, now)),
    [now]
  );
  const modalActionConfig =
    HOME_QUICK_ACTIONS.find((a) => a.id === activeBoardAction) ?? openHomeActions[0] ?? null;
  const isModalActionOpen = Boolean(
    modalActionConfig && isHomeActionOpenAt(modalActionConfig.id, now)
  );
  const closeAndLockBoard = () => {
    setSchoolBoardOpen(false);
    setSchoolBoardResult(null);
    setSchoolBoardSearch('');
  };
  useEffect(() => {
    if (schoolBoardOpen && !isModalActionOpen) {
      setSchoolBoardOpen(false);
      setSchoolBoardResult(null);
      setSchoolBoardSearch('');
    }
  }, [schoolBoardOpen, isModalActionOpen]);
  const runHomeAction = (actionId: HomeQuickActionId, kidId: string): KioskResult | null => {
    if (!isHomeActionOpenAt(actionId, now)) return null;
    if (onQuickHomeAction) return onQuickHomeAction(actionId, kidId);
    if (actionId === 'morning_school') return onQuickGoToSchool(kidId);
    return null;
  };
  const filteredSchoolKids = useMemo(() => {
    const q = schoolBoardSearch.trim().toLowerCase();
    return kids.filter((k) => {
      if (schoolBoardGroup !== 0 && k.group !== schoolBoardGroup) return false;
      if (!q) return true;
      return (
        k.nickname.toLowerCase().includes(q) ||
        k.fullName.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q)
      );
    });
  }, [kids, schoolBoardGroup, schoolBoardSearch]);
  const laundry = getLaundryQueueInfo(now, lang);

  const speakWord = (text: string, speechLang: string) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = speechLang;
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore speech synthesis errors
    }
  };

  const resolvePinLogin = (pin: string): boolean => {
    if (pinGuard.isLocked) return false;
    if (creatorPins.includes(pin)) {
      pinGuard.recordSuccess();
      onAutoLoginRole('creator');
      return true;
    }
    const matchedMember = members.find((m) => m.pin === pin);
    if (!matchedMember) return false;
    pinGuard.recordSuccess();
    if (matchedMember.role === 'kid') {
      onSelectKid(matchedMember.id);
    } else {
      onAutoLoginRole(matchedMember);
    }
    return true;
  };

  const handleQuickLookup = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      onShowAlert({
        icon: '🔑',
        title: lang === 'th' ? 'กรุณากรอกรหัส PIN' : 'Enter 4-digit PIN',
        message:
          lang === 'th'
            ? 'กรุณาใส่รหัส PIN 4 หลักของคุณเพื่อเข้าสู่ระบบ'
            : 'Please enter your 4-digit PIN to sign in.',
        tone: 'pink',
      });
      return;
    }

    if (/^\d{4}$/.test(code)) {
      if (pinGuard.isLocked) {
        onShowAlert({
          icon: '🔒',
          title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
          message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
          tone: 'pink',
        });
        return;
      }
      if (resolvePinLogin(code)) {
        setQuickInput('');
        return;
      }
      const res = pinGuard.recordFailure();
      setQuickInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '🔐',
        title: res.lockedNow
          ? lang === 'th'
            ? 'ล็อกชั่วคราว 30 วินาที'
            : 'Locked for 30 Seconds'
          : lang === 'th'
          ? 'ไม่พบรหัส PIN นี้'
          : 'PIN Not Found',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${lang === 'th' ? 'กรุณาตรวจสอบรหัส PIN 4 หลักอีกครั้ง' : 'Please check your 4-digit PIN again.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
      return;
    }

    onShowAlert({
      icon: '🔑',
      title: lang === 'th' ? 'กรุณากรอกรหัส PIN 4 หลัก' : '4-Digit PIN Required',
      message:
        lang === 'th'
          ? 'กรุณาใส่เฉพาะรหัส PIN ตัวเลข 4 หลักค่ะ'
          : 'Please enter a 4-digit numeric PIN.',
      tone: 'pink',
    });
  };

  const handleQrCodeDetected = (rawCode: string) => {
    const code = rawCode.trim().toLowerCase();
    if (/^\d{4}$/.test(code)) {
      handleQuickLookup(code);
      return;
    }
    const matchedById = kids.find((k) => k.id.toLowerCase() === code);
    if (matchedById) {
      setPendingKid(matchedById);
      return;
    }
    const matchedOther = members.find((m) => m.id.toLowerCase() === code);
    if (matchedOther) {
      onShowAlert({
        icon: '🔐',
        title: lang === 'th' ? `กรุณากรอกรหัส PIN 4 หลักของ ${matchedOther.nickname}` : `Enter PIN for ${matchedOther.nickname}`,
        message:
          lang === 'th'
            ? 'เพื่อความปลอดภัย กรุณากรอกรหัส PIN 4 หลักลงในช่องเข้าสู่ระบบได้เลยค่ะ'
            : 'Please enter your 4-digit PIN into the login box.',
        tone: 'pink',
      });
      return;
    }
    handleQuickLookup(rawCode);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pt-2 sm:pt-6">
      {/* Main Hero Frame Card with Right Theme Swatch Strip */}
      <div
        className="rounded-[34px] border-2 p-4 sm:p-5 pastel-shadow transition-colors"
        style={{
          backgroundColor: 'var(--theme-frame-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-stretch gap-3.5">
          {/* Inner White Login & Live Clock Card */}
          <div className="flex-1 rounded-[26px] bg-white border border-white/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch justify-between gap-5">
            {/* Left Column: Date, Brand, PIN/ID Input, 2 Action Buttons */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickLookup(quickInput);
              }}
              className="flex-1 flex flex-col justify-between gap-3.5 min-w-0"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E5C52]">
                  <span>🛡️</span>
                  <span>{formatReadableDate(now, lang)}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C] mt-1 tracking-tight">
                  {organizationName || 'Barnhem Care & Kids'}
                </h1>
              </div>

              {/* Pill PIN/ID Input with Key Icon & Eye Toggle */}
              <div
                className="relative flex items-center rounded-2xl border bg-white px-3.5 h-12 transition-colors focus-within:ring-2 focus-within:ring-[#F4B6C2]/50"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <span className="text-base mr-2.5 shrink-0 opacity-75">🗝️</span>
                <input
                  type={showPinText ? 'text' : 'password'}
                  disabled={pinGuard.isLocked}
                  value={quickInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickInput(val);
                    const trimmed = val.trim();
                    if (/^\d{4}$/.test(trimmed)) {
                      if (resolvePinLogin(trimmed)) {
                        setQuickInput('');
                      } else {
                        const res = pinGuard.recordFailure();
                        setQuickInput('');
                        onShowAlert({
                          icon: res.lockedNow ? '🔒' : '🔐',
                          title: res.lockedNow
                            ? lang === 'th'
                              ? 'ล็อกชั่วคราว 30 วินาที'
                              : 'Locked for 30 Seconds'
                            : lang === 'th'
                            ? 'ไม่พบรหัส PIN นี้'
                            : 'PIN Not Found',
                          message: res.lockedNow
                            ? formatPinLockoutMessage(res.lockSec, lang)
                            : `${lang === 'th' ? 'กรุณาตรวจสอบรหัส PIN 4 หลักอีกครั้ง' : 'Please check your 4-digit PIN again.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
                          tone: 'pink',
                        });
                      }
                    }
                  }}
                  placeholder={
                    pinGuard.isLocked
                      ? lang === 'th'
                        ? `🔒 รอ ${pinGuard.remainingSec} วินาที...`
                        : `🔒 Wait ${pinGuard.remainingSec}s...`
                      : lang === 'th'
                      ? 'กรอกรหัส PIN 4 หลัก'
                      : 'Enter 4-digit PIN'
                  }
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-[#3D322C] placeholder:text-[#9B897E] focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPinText((p) => !p)}
                  aria-label={showPinText ? 'Hide PIN' : 'Show PIN'}
                  className="ml-2 text-sm text-[#7B695F] hover:text-[#3D322C] cursor-pointer shrink-0 p-1"
                >
                  {showPinText ? '🙈' : '👁️'}
                </button>
              </div>
              {pinGuard.isLocked && (
                <div className="rounded-xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-1.5 text-xs font-bold text-[#8B1D36] tabular-nums">
                  🔒 {formatPinLockoutMessage(pinGuard.remainingSec, lang)}
                </div>
              )}

              {/* Login Button & Scan QR Button */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="submit"
                  className="h-12 rounded-2xl border font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:brightness-[0.97] active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--theme-btn-bg)',
                    borderColor: 'var(--theme-btn-border)',
                    color: 'var(--theme-accent-text)',
                  }}
                >
                  <span>{lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign In'}</span>
                  <span>✨</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  className="h-12 rounded-2xl border bg-white hover:bg-[#FAF6F2] font-bold text-sm text-[#3D322C] flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--theme-border-alt)' }}
                >
                  <span>📷</span>
                  <span>{lang === 'th' ? 'สแกน QR Code' : 'Scan QR Code'}</span>
                </button>
              </div>

              {/* Single Unified Launcher Button for All 5 Time-Locked Commands */}
              <button
                type="button"
                onClick={() => setQuickActionsMenuOpen(true)}
                className={`min-h-[46px] w-full rounded-2xl border px-4 py-2 text-xs sm:text-sm font-extrabold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  openHomeActions.length > 0
                    ? 'border-[#8FD4C6] bg-[#E8FAF6] hover:bg-[#D8F5EE] text-[#114A42]'
                    : 'border-[#E6DCD2] bg-[#F7F3EE] hover:bg-[#EFE9E1] text-[#6E5C52]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">
                    {openHomeActions.length > 0 ? '📋' : '🔒'}
                  </span>
                  <span className="truncate">
                    {openHomeActions.length > 0
                      ? lang === 'th'
                        ? `คำสั่งเช็คชื่อตามเวลา (เปิด ${openHomeActions.length} คำสั่ง)`
                        : `Timed Check-In Commands (${openHomeActions.length} Open)`
                      : lang === 'th'
                      ? 'คำสั่งเช็คชื่อตามเวลา (รวม 6 คำสั่ง)'
                      : 'Timed Check-In Commands (6 Schedules)'}
                  </span>
                </span>
                <span
                  className={`rounded-xl px-2.5 py-0.5 text-[11px] font-bold shrink-0 ${
                    openHomeActions.length > 0
                      ? 'bg-white text-[#114A42]'
                      : 'bg-white/80 text-[#8B796E]'
                  }`}
                >
                  {openHomeActions.length > 0
                    ? lang === 'th'
                      ? 'เลือกคำสั่ง ▾'
                      : 'Open ▾'
                    : lang === 'th'
                    ? 'นอกเวลา ▾'
                    : 'Locked ▾'}
                </span>
              </button>

              {linkedKidSession && linkedKidMember ? (
                <div className="rounded-2xl border-2 border-[#8FD4C6] bg-[#E8FAF6] p-3 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-[#114A42]">
                      {linkedKidMember.emoji}{' '}
                      {lang === 'th'
                        ? `สวัสดี น้อง${linkedKidMember.nickname} (${linkedKidSession.email})`
                        : `Welcome, ${linkedKidMember.nickname} (${linkedKidSession.email})`}
                    </div>
                    <div className="text-[11px] text-[#215C52]">
                      {lang === 'th'
                        ? 'ตัวการ์ตูนและข้อมูลของคุณพร้อมซิงค์แบบเรียลไทม์แล้วค่ะ'
                        : 'Your live cartoon character is synced and ready.'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenLinkedKid && (
                      <button
                        type="button"
                        onClick={onOpenLinkedKid}
                        className="min-h-[38px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        ✨ {lang === 'th' ? 'เปิดดูตัวการ์ตูนของฉัน' : 'Open My Cartoon'}
                      </button>
                    )}
                    {onSignOutLinkedKid && (
                      <button
                        type="button"
                        onClick={onSignOutLinkedKid}
                        className="min-h-[38px] rounded-xl border border-[#F3B7C0] bg-white hover:bg-[#FFF0F3] text-[#8B1D36] px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        🚪 {lang === 'th' ? 'ออกจากระบบ' : 'Sign Out'}
                      </button>
                    )}
                  </div>
                </div>
              ) : !cloudUser ? (
                <button
                  type="button"
                  disabled={kidGoogleBusy}
                  onClick={async () => {
                    setKidGoogleBusy(true);
                    try {
                      await signInWithGoogleCloud();
                    } catch (err) {
                      onShowAlert({
                        icon: '⚠️',
                        title: lang === 'th' ? 'เข้าสู่ระบบ Google ไม่สำเร็จ' : 'Google Sign-In Failed',
                        message: err instanceof Error ? err.message : String(err),
                        tone: 'pink',
                      });
                    } finally {
                      setKidGoogleBusy(false);
                    }
                  }}
                  className="min-h-[44px] w-full rounded-2xl border border-[#B5E5DC] bg-[#F2FCF9] hover:bg-[#E2F7F2] px-4 py-2 text-xs sm:text-sm font-extrabold text-[#114A42] flex items-center justify-between gap-2 cursor-pointer transition-colors disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span>📧</span>
                    <span className="truncate">
                      {kidGoogleBusy
                        ? lang === 'th'
                          ? 'กำลังเปิดหน้าต่าง Google...'
                          : 'Opening Google Sign-In...'
                        : lang === 'th'
                        ? 'น้องๆ ล็อกอินด้วย Google Email (รับ +1,000 ⭐ ช็อปปิ้งมินิมาร์ท · อัปเดตก่อนใคร)'
                        : 'Kid Google Sign-In (+1,000 ⭐ Minimart & Early Updates)'}
                    </span>
                  </span>
                  <span className="rounded-xl bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#114A42] shrink-0">
                    {lang === 'th' ? 'ล็อกอิน →' : 'Sign In →'}
                  </span>
                </button>
              ) : cloudUser.email !== MASTER_ADMIN_EMAIL && !organizationName ? (
                <div className="rounded-2xl border border-[#F2DA84] bg-[#FFFBEB] p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E5311]">
                  <span className="min-w-0">
                    {cloudSyncing
                      ? lang === 'th'
                        ? `⏳ กำลังค้นหาตัวการ์ตูนของ ${cloudUser.email}...`
                        : `⏳ Looking up character for ${cloudUser.email}...`
                      : lang === 'th'
                      ? `📧 ล็อกอินด้วย ${cloudUser.email} แล้ว (หากยังไม่เห็นตัวการ์ตูน กรุณาเพิ่มอีเมลนี้ในช่องโปรไฟล์ของน้องก่อนนะคะ)`
                      : `📧 Signed in as ${cloudUser.email} (Add this email in the kid profile first to sync your cartoon)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => void signOutCloud()}
                    className="rounded-xl border border-[#E5C97B] bg-white hover:bg-[#FFF5CC] px-2.5 py-1 text-[11px] font-bold text-[#6E5311] cursor-pointer shrink-0"
                  >
                    {lang === 'th' ? 'เปลี่ยนบัญชี' : 'Switch Account'}
                  </button>
                </div>
              ) : null}
            </form>

            {/* Right Column: Live Current Clock + Laundry Queue Box */}
            <div
              className="rounded-[22px] border px-6 py-5 flex flex-col items-center justify-center text-center md:w-[270px] shrink-0"
              style={{
                backgroundColor: 'var(--theme-soft-bg)',
                borderColor: 'var(--theme-border-alt)',
              }}
            >
              <div className="text-xs font-medium text-[#7B695F]">
                {lang === 'th' ? 'เวลาจริงปัจจุบัน' : 'Current Time'}
              </div>
              <div className="text-4xl sm:text-[42px] font-extrabold tracking-tight text-[#3D322C] tabular-nums leading-none my-2.5">
                {formatDigitalClock(now)}
              </div>
              <div
                className="inline-flex items-center gap-1.5 rounded-xl bg-white border px-3.5 py-1.5 text-xs font-bold shadow-2xs"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-accent-text)',
                }}
              >
                <span>{laundry.emoji}</span>
                <span>{laundry.label}</span>
              </div>
            </div>
          </div>

          {/* Right Vertical Pastel Color Switcher Dots */}
          <div
            className="flex sm:flex-col items-center justify-center gap-2.5 px-1 py-1 shrink-0"
            role="group"
            aria-label={lang === 'th' ? 'เลือกโทนสี' : 'Select Pastel Theme'}
          >
            {themeOptions.map((t) => {
              const active = pastelTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeTheme(t.id)}
                  title={lang === 'th' ? t.labelTh : t.labelEn}
                  aria-label={lang === 'th' ? t.labelTh : t.labelEn}
                  className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                    active
                      ? 'border-[#3D322C] scale-110 shadow-xs'
                      : 'border-white/90 hover:scale-105'
                  }`}
                  style={{ backgroundColor: t.swatch }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Second Card: Daily 4-Language Vocabulary with Prev/Next Controls */}
      <div
        className="rounded-[28px] border-2 bg-white p-5 sm:p-6 pastel-shadow"
        style={{ borderColor: 'var(--theme-border-alt)' }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#3D322C]">
            <span>📖</span>
            <span>
              {lang === 'th' ? 'คำศัพท์ประจำวัน 4 ภาษา' : 'Word of the Day (4 Languages)'}
            </span>
            <span className="text-xs font-medium text-[#9B897E] tabular-nums">
              · {activeWordIdx + 1}/{DAILY_WORDS_4_LANG.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWordOffset((p) => p - 1)}
              aria-label={lang === 'th' ? 'คำศัพท์ก่อนหน้า' : 'Previous Word'}
              className="h-8 w-8 rounded-full border bg-white hover:bg-[#FAF6F2] text-sm font-bold text-[#6E5C52] flex items-center justify-center cursor-pointer"
              style={{ borderColor: 'var(--theme-border-alt)' }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setWordOffset((p) => p + 1)}
              aria-label={lang === 'th' ? 'คำศัพท์ถัดไป' : 'Next Word'}
              className="h-8 w-8 rounded-full border bg-white hover:bg-[#FAF6F2] text-sm font-bold text-[#6E5C52] flex items-center justify-center cursor-pointer"
              style={{ borderColor: 'var(--theme-border-alt)' }}
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => speakWord(dailyWord.jp, 'ja-JP')}
            className="rounded-[18px] border px-4 py-3 text-left transition-colors hover:brightness-[0.98] cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-soft-bg)',
              borderColor: 'var(--theme-border-alt)',
            }}
          >
            <div className="text-[11px] font-medium text-[#7B695F]">日本語 · ญี่ปุ่น</div>
            <div className="text-lg font-extrabold text-[#3D322C] mt-1">{dailyWord.jp}</div>
            <div className="text-[11px] text-[#7B695F] mt-0.5">{dailyWord.jpReading}</div>
          </button>

          <button
            type="button"
            onClick={() => speakWord(dailyWord.cn, 'zh-CN')}
            className="rounded-[18px] border px-4 py-3 text-left transition-colors hover:brightness-[0.98] cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-soft-bg)',
              borderColor: 'var(--theme-border-alt)',
            }}
          >
            <div className="text-[11px] font-medium text-[#7B695F]">中文 · จีน</div>
            <div className="text-lg font-extrabold text-[#3D322C] mt-1">{dailyWord.cn}</div>
            <div className="text-[11px] text-[#7B695F] mt-0.5">{dailyWord.cnReading}</div>
          </button>

          <button
            type="button"
            onClick={() => speakWord(dailyWord.en, 'en-US')}
            className="rounded-[18px] border px-4 py-3 text-left transition-colors hover:brightness-[0.98] cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-soft-bg)',
              borderColor: 'var(--theme-border-alt)',
            }}
          >
            <div className="text-[11px] font-medium text-[#7B695F]">English · อังกฤษ</div>
            <div className="text-lg font-extrabold text-[#3D322C] mt-1">{dailyWord.en}</div>
          </button>

          <button
            type="button"
            onClick={() => speakWord(dailyWord.th, 'th-TH')}
            className="rounded-[18px] border px-4 py-3 text-left transition-colors hover:brightness-[0.98] cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-soft-bg)',
              borderColor: 'var(--theme-border-alt)',
            }}
          >
            <div className="text-[11px] font-medium text-[#7B695F]">ภาษาไทย · Thai</div>
            <div
              className="text-lg font-extrabold mt-1"
              style={{ color: 'var(--theme-accent-text)' }}
            >
              {dailyWord.th}
            </div>
          </button>
        </div>
      </div>

      {/* Collapsible Cloud Sync Settings Link */}
      <div className="space-y-3 pt-1">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowCloudSync((p) => !p)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7B695F] hover:text-[#3D322C] cursor-pointer transition-colors"
          >
            <span>☁️</span>
            <span>
              {lang === 'th'
                ? 'ตั้งค่าซิงก์ข้อมูล (Cloud Sync)'
                : 'Cloud Sync Settings'}
            </span>
            <span>{showCloudSync ? '⌃' : '⌄'}</span>
          </button>
        </div>

        {showCloudSync && (
          <CloudSyncBanner
            cloudUser={cloudUser}
            cloudSyncing={cloudSyncing}
            state={appState}
            now={now}
            lang={lang}
            onForceSeedCloud={onForceSeedCloud}
            onShowAlert={onShowAlert}
          />
        )}
      </div>

      {/* PIN Confirmation Modal when QR was scanned */}
      <PinPadModal
        open={Boolean(pendingKid)}
        lang={lang}
        lockedRemainingSec={pinGuard.remainingSec}
        title={
          pendingKid
            ? `${lang === 'th' ? 'ยืนยันรหัส PIN สำหรับ น้อง' : 'Confirm PIN for '}${pendingKid.nickname}`
            : ''
        }
        onCancel={() => setPendingKid(null)}
        onSubmitPin={(pin) => {
          if (!pendingKid) return;
          if (pinGuard.isLocked) {
            onShowAlert({
              icon: '🔒',
              title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
              message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
              tone: 'pink',
            });
            return;
          }
          if (pin === pendingKid.pin) {
            pinGuard.recordSuccess();
            const targetId = pendingKid.id;
            setPendingKid(null);
            onSelectKid(targetId);
          } else {
            const res = pinGuard.recordFailure();
            onShowAlert({
              icon: res.lockedNow ? '🔒' : '🙈',
              title: res.lockedNow
                ? lang === 'th'
                  ? 'ล็อกชั่วคราว 30 วินาที'
                  : 'Locked for 30 Seconds'
                : lang === 'th'
                ? 'รหัส PIN ไม่ถูกต้อง'
                : 'Incorrect PIN',
              message: res.lockedNow
                ? formatPinLockoutMessage(res.lockSec, lang)
                : `${lang === 'th' ? 'รหัส PIN ไม่ถูกต้อง ลองใหม่อีกครั้งนะ' : 'Incorrect PIN. Please try again.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
              tone: 'pink',
            });
          }
        }}
      />

      <QrScannerModal
        open={qrOpen}
        lang={lang}
        initialKioskMode={true}
        onClose={() => setQrOpen(false)}
        onDetectedCode={(code) => {
          setQrOpen(false);
          handleQrCodeDetected(code);
        }}
        onExpressKioskScan={onExpressKioskScan}
      />

      {/* Unified Time-Locked Commands Menu Modal (All 5 buttons grouped neatly in one place) */}
      {quickActionsMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[30px] border-4 border-[#B9E8DF] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
              <div>
                <h3 className="text-lg font-extrabold text-[#114A42] flex items-center gap-2">
                  <span>📋</span>
                  <span>
                    {lang === 'th'
                      ? 'รวมคำสั่งเช็คชื่อตามเวลา (6 คำสั่ง)'
                      : 'All Timed Check-In Commands (6)'}
                  </span>
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
                  {lang === 'th'
                    ? `ขณะนี้ ${formatDigitalClock(now)} น. · เปิดให้กดเฉพาะช่วงเวลา และต้องใส่รหัสพี่เลี้ยงทุกครั้ง`
                    : `Time ${formatDigitalClock(now)} · Open during scheduled windows with Staff PIN`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickActionsMenuOpen(false)}
                className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              {HOME_QUICK_ACTIONS.map((action) => {
                const isOpen = isHomeActionOpenAt(action.id, now);
                const doneCount = kids.filter((k) => isHomeActionDoneForKid(action.id, k)).length;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      if (!isOpen) {
                        onShowAlert({
                          icon: '🔒',
                          title:
                            lang === 'th'
                              ? `คำสั่ง "${action.titleTh}" ล็อกอยู่นอกเวลา`
                              : `"${action.titleEn}" Locked`,
                          message:
                            lang === 'th'
                              ? `เปิดให้กดเฉพาะช่วงเวลา ${action.windowLabelTh} เท่านั้นค่ะ (ขณะนี้เวลา ${formatDigitalClock(now)} น.)`
                              : `Only open during ${action.windowLabelEn} (currently ${formatDigitalClock(now)}).`,
                          tone: 'pink',
                        });
                        return;
                      }
                      setQuickActionsMenuOpen(false);
                      setPendingBoardUnlockAction(action.id);
                    }}
                    aria-disabled={!isOpen}
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isOpen
                        ? 'border-[#7CC6B8] bg-[#E8FAF6] hover:bg-[#D5F4EE] text-[#114A42]'
                        : 'border-[#E6DCD2] bg-[#F7F3EE] hover:bg-[#EFE9E1] text-[#7B695F] opacity-85'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{isOpen ? action.emoji : '🔒'}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold truncate">
                          {lang === 'th' ? action.titleTh : action.titleEn}
                        </div>
                        <div className="text-[11px] font-medium opacity-85 tabular-nums">
                          ⏰ {lang === 'th' ? action.windowLabelTh : action.windowLabelEn}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold shrink-0 tabular-nums ${
                        isOpen
                          ? 'bg-[#114A42] text-white'
                          : 'bg-white/90 text-[#8B796E] border border-[#E6DCD2]'
                      }`}
                    >
                      {isOpen
                        ? `🔐 ${doneCount}/${kids.length}`
                        : lang === 'th'
                        ? 'ล็อกนอกเวลา'
                        : 'Locked'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Staff PIN Gate Modal — Required EVERY TIME before showing kids' names */}
      <PinPadModal
        open={Boolean(pendingBoardUnlockAction)}
        lang={lang}
        lockedRemainingSec={staffBoardPinGuard.remainingSec}
        title={
          lang === 'th'
            ? '🔐 ใส่รหัส PIN พี่เลี้ยงเพื่อแสดงรายชื่อน้อง'
            : '🔐 Enter Staff PIN to Show Kids’ Names'
        }
        onCancel={() => setPendingBoardUnlockAction(null)}
        onSubmitPin={(pin) => {
          if (!pendingBoardUnlockAction) return;
          if (staffBoardPinGuard.isLocked) {
            onShowAlert({
              icon: '🔒',
              title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
              message: formatPinLockoutMessage(staffBoardPinGuard.remainingSec, lang),
              tone: 'pink',
            });
            return;
          }
          if (staffPins.includes(pin)) {
            staffBoardPinGuard.recordSuccess();
            const targetAction = pendingBoardUnlockAction;
            setPendingBoardUnlockAction(null);
            setActiveBoardAction(targetAction);
            setSchoolBoardResult(null);
            setSchoolBoardSearch('');
            setSchoolBoardOpen(true);
          } else {
            const res = staffBoardPinGuard.recordFailure();
            onShowAlert({
              icon: res.lockedNow ? '🔒' : '🔐',
              title: res.lockedNow
                ? lang === 'th'
                  ? 'ล็อกชั่วคราว 30 วินาที'
                  : 'Locked for 30 Seconds'
                : lang === 'th'
                ? 'รหัสพี่เลี้ยงไม่ถูกต้อง'
                : 'Incorrect Staff PIN',
              message: res.lockedNow
                ? formatPinLockoutMessage(res.lockSec, lang)
                : `${lang === 'th' ? 'กรุณาใช้รหัส PIN ของพี่เลี้ยงหรือผู้ดูแลค่ะ' : 'Please enter a valid Staff or Manager PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
              tone: 'pink',
            });
          }
        }}
      />

      {/* 1-Tap Time-Window Name Board Modal (Strictly locked outside each action's window & requires Staff PIN every open) */}
      {schoolBoardOpen && modalActionConfig && isModalActionOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[32px] border-4 border-[#B9E8DF] bg-[#FFFDF9] p-4 sm:p-6 pastel-shadow overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#114A42] flex items-center gap-2">
                  <span>{modalActionConfig.emoji}</span>
                  <span>
                    {lang === 'th'
                      ? `${modalActionConfig.titleTh} — กดที่ชื่อตัวเอง 1 ครั้ง`
                      : `${modalActionConfig.titleEn} — Tap Your Name Once`}
                  </span>
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
                  {lang === 'th'
                    ? `เปิดเฉพาะ ${modalActionConfig.windowLabelTh} · ขณะนี้ ${formatDigitalClock(now)} น. · ทำแล้ว ${
                        kids.filter((k) => isHomeActionDoneForKid(modalActionConfig.id, k)).length
                      }/${kids.length} คน`
                    : `Open ${modalActionConfig.windowLabelEn} · Time ${formatDigitalClock(now)} · Checked ${
                        kids.filter((k) => isHomeActionDoneForKid(modalActionConfig.id, k)).length
                      }/${kids.length} kids`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeAndLockBoard}
                  className="rounded-xl border border-[#F3B7C0] bg-[#FFE8ED] hover:bg-[#FADADD] px-3 py-2 text-xs font-extrabold text-[#8B1D36] cursor-pointer transition-colors"
                >
                  🔒 {lang === 'th' ? 'ซ่อนรายชื่อ' : 'Hide Names'}
                </button>
                <button
                  type="button"
                  onClick={closeAndLockBoard}
                  className="min-h-[40px] min-w-[40px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {openHomeActions.length > 1 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {openHomeActions.map((act) => {
                  const isSelected = modalActionConfig.id === act.id;
                  const cnt = kids.filter((k) => isHomeActionDoneForKid(act.id, k)).length;
                  return (
                    <button
                      key={`modal-tab-${act.id}`}
                      type="button"
                      onClick={() => {
                        setActiveBoardAction(act.id);
                        setSchoolBoardResult(null);
                      }}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-extrabold cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-[#114A42] bg-[#114A42] text-white'
                          : 'border-[#9FE2D6] bg-[#F3FCFA] text-[#114A42] hover:bg-[#DCF7F2]'
                      }`}
                    >
                      {act.emoji} {lang === 'th' ? act.titleTh : act.titleEn} ({cnt}/{kids.length})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Instant Confirmation Banner */}
            {schoolBoardResult && (
              <div
                className={`mt-3 rounded-2xl border-2 px-4 py-3 flex items-center justify-between gap-3 ${
                  schoolBoardResult.success
                    ? 'border-[#7CC6B8] bg-[#DCF7F2] text-[#114A42]'
                    : 'border-[#F3B7C0] bg-[#FADADD] text-[#6B2D39]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-3xl shrink-0">{schoolBoardResult.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-extrabold truncate">
                      {schoolBoardResult.bannerTitle}
                    </div>
                    <div className="text-xs opacity-90 truncate">
                      {schoolBoardResult.bannerSubtitle}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSchoolBoardResult(null)}
                  className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Group Tabs + Search */}
            <div className="flex flex-wrap items-center justify-between gap-2 my-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { g: 0 as const, th: 'ทั้งหมด', en: 'All' },
                  { g: 1 as const, th: 'กลุ่ม 1 ประถม', en: 'G1' },
                  { g: 2 as const, th: 'กลุ่ม 2 มัธยม', en: 'G2' },
                  { g: 3 as const, th: 'กลุ่ม 3 วิทยาลัย', en: 'G3' },
                ].map((tab) => (
                  <button
                    key={tab.g}
                    type="button"
                    onClick={() => setSchoolBoardGroup(tab.g)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                      schoolBoardGroup === tab.g
                        ? 'bg-[#B7EFE5] border border-[#64CBB9] text-[#0F423A]'
                        : 'bg-white border border-[#EBD8C3] text-[#6E5C52] hover:bg-[#FFF5BA]/40'
                    }`}
                  >
                    {lang === 'th' ? tab.th : tab.en}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={schoolBoardSearch}
                onChange={(e) => setSchoolBoardSearch(e.target.value)}
                placeholder={lang === 'th' ? '🔍 ค้นหาชื่อเล่น / ชื่อจริง...' : '🔍 Search nickname / name...'}
                className="rounded-xl border border-[#DCE8E4] bg-white px-3 py-1.5 text-xs text-[#3D322C] w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-[#B9E8DF]"
              />
            </div>

            {/* Large Finger-Friendly 1-Tap Name Grid */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pb-2">
                {filteredSchoolKids.map((kid) => {
                  const done = isHomeActionDoneForKid(modalActionConfig.id, kid);
                  const isAway = isKidAwayOnDate(kid, todayKey);
                  return (
                    <button
                      key={kid.id}
                      type="button"
                      disabled={done || !isModalActionOpen}
                      onClick={() => {
                        if (!isModalActionOpen) return;
                        const res = runHomeAction(modalActionConfig.id, kid.id);
                        if (res) setSchoolBoardResult(res);
                      }}
                      className={`rounded-2xl border-2 p-3 text-left transition-all flex flex-col justify-between gap-2 ${
                        done
                          ? 'border-[#C5EAE2] bg-[#F2FBF9] opacity-75 cursor-default'
                          : isAway
                          ? 'border-[#D9CCE8] bg-[#F7F3FC] hover:bg-[#EFE8FC] cursor-pointer active:scale-[0.98]'
                          : 'border-[#B9E8DF] bg-white hover:bg-[#E8FAF6] hover:border-[#64CBB9] cursor-pointer active:scale-[0.98] shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-2xl leading-none">{kid.emoji}</span>
                        <span className="text-[10px] font-bold text-[#7B695F]">
                          {lang === 'th' ? `กลุ่ม ${kid.group}` : `G${kid.group}`}
                        </span>
                      </div>
                      <div className="font-extrabold text-base text-[#3D322C] truncate">
                        {kid.nickname}
                      </div>
                      <div
                        className={`rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-center ${
                          done
                            ? 'bg-[#D6F5EE] text-[#1B5E52]'
                            : isAway
                            ? 'bg-[#EAE4F2] text-[#463A59]'
                            : 'bg-[#114A42] text-white'
                        }`}
                      >
                        {done
                          ? lang === 'th'
                            ? modalActionConfig.doneLabelTh
                            : modalActionConfig.doneLabelEn
                          : isAway
                          ? lang === 'th'
                            ? '🏡 ลา (กดเช็ค)'
                            : '🏡 Away'
                          : lang === 'th'
                          ? modalActionConfig.tapLabelTh
                          : modalActionConfig.tapLabelEn}
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredSchoolKids.length === 0 && (
                <div className="py-10 text-center text-sm text-[#7B695F]">
                  {lang === 'th' ? 'ไม่พบรายชื่อที่ค้นหา' : 'No matching names'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
