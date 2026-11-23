import { User } from 'firebase/auth';
import React, { useEffect, useMemo, useState } from 'react';
import { DAILY_WORDS_4_LANG } from '../data/dailyWords';
import { signInWithGoogleCloud, signOutCloud } from '../firebase';
import { MASTER_ADMIN_EMAIL } from '../services/firestoreSync';
import {
  AppState,
  CommandAccessRule,
  CustomQuickCommand,
  Language,
  LinkedKidSession,
  Member,
  ModalAlertPayload,
  PastelTheme,
  TimedScheduleSlot,
} from '../types/barnhem';
import {
  canKidUseCommand,
  doesKidHavePhone,
  formatCustomCommandWindow,
  formatThaiCurfewClock,
  getCommandDenialReason,
  getCommandPermissionSummary,
  getEffectiveCustomQuickCommands,
  getEffectiveHomeQuickActions,
  getEffectiveHomeworkCurfewMins,
  getEffectiveHomeworkPermissionWindow,
  HomeQuickActionId,
  isCustomCommandDoneForKid,
  isCustomCommandOpenAt,
  isHomeActionDoneForKid,
  isHomeActionOpenAt,
  KioskResult,
  minsToHHMM,
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
import { CommandPermissionsEditorCard } from './CommandPermissionsEditorCard';
import { TimedScheduleEditorCard } from './TimedScheduleEditorCard';

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
  onQuickHomeAction?: (actionId: HomeQuickActionId, kidId: string, detailOverride?: string) => KioskResult | null;
  onRunCustomQuickCommand?: (
    cmd: CustomQuickCommand,
    kidId: string,
    subjectOrNote?: string
  ) => KioskResult | null;
  onSaveCustomQuickCommands?: (nextCommands: CustomQuickCommand[]) => void;
  onSaveTimedSchedule?: (nextSchedule: Record<string, TimedScheduleSlot>, nextCurfewMins: number) => void;
  onSaveCommandPermissions?: (
    nextKidsWithoutPhoneIds: string[],
    nextCommandPermissions: Record<string, CommandAccessRule>
  ) => void;
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
  onRunCustomQuickCommand,
  onSaveCustomQuickCommands,
  onSaveTimedSchedule,
  onSaveCommandPermissions,
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
  const [activeCustomCmdId, setActiveCustomCmdId] = useState<string | null>(null);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [schoolBoardOpen, setSchoolBoardOpen] = useState(false);
  const [schoolBoardGroup, setSchoolBoardGroup] = useState<0 | 1 | 2 | 3>(0);
  const [schoolBoardSearch, setSchoolBoardSearch] = useState('');
  const [showOnlyEligibleKids, setShowOnlyEligibleKids] = useState(false);
  const [schoolBoardResult, setSchoolBoardResult] = useState<KioskResult | null>(null);
  const [pendingHwKidId, setPendingHwKidId] = useState<string | null>(null);
  const [homeHwNoteInput, setHomeHwNoteInput] = useState('');
  const [pendingKid, setPendingKid] = useState<Member | null>(null);
  const [quickActionsMenuOpen, setQuickActionsMenuOpen] = useState(false);
  const [pendingBoardUnlock, setPendingBoardUnlock] = useState<
    | null
    | { type: 'core'; actionId: HomeQuickActionId }
    | { type: 'custom'; cmdId: string }
    | { type: 'add_custom' }
    | { type: 'delete_custom'; cmdId: string }
    | { type: 'edit_schedule' }
    | { type: 'edit_permissions' }
  >(null);
  const [addCommandOpen, setAddCommandOpen] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [permissionsEditorOpen, setPermissionsEditorOpen] = useState(false);
  const [newCmdEmoji, setNewCmdEmoji] = useState('📝');
  const [newCmdTitleTh, setNewCmdTitleTh] = useState('');
  const [newCmdKind, setNewCmdKind] = useState<CustomQuickCommand['kind']>('homework_permission');
  const [newCmdAlwaysOpen, setNewCmdAlwaysOpen] = useState(true);
  const [newCmdStartTime, setNewCmdStartTime] = useState('17:00');
  const [newCmdEndTime, setNewCmdEndTime] = useState('21:30');
  const [newCmdStars, setNewCmdStars] = useState(0);
  const [newCmdDefaultNote, setNewCmdDefaultNote] = useState('');
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
  const customQuickCommands = useMemo(
    () => getEffectiveCustomQuickCommands(appState.settings),
    [appState.settings]
  );
  const openCustomCommands = useMemo(
    () => customQuickCommands.filter((c) => isCustomCommandOpenAt(c, now)),
    [customQuickCommands, now]
  );
  const effectiveHomeActions = useMemo(
    () => getEffectiveHomeQuickActions(appState.settings),
    [appState.settings]
  );
  const hwPermWin = useMemo(
    () => getEffectiveHomeworkPermissionWindow(appState.settings),
    [appState.settings]
  );
  const hwCurfewMins = useMemo(
    () => getEffectiveHomeworkCurfewMins(appState.settings),
    [appState.settings]
  );
  const hwCurfewTh = formatThaiCurfewClock(hwCurfewMins);
  const hwCurfewEn = minsToHHMM(hwCurfewMins);
  const openHomeActions = useMemo(
    () => effectiveHomeActions.filter((a) => isHomeActionOpenAt(a.id, now, appState.settings)),
    [effectiveHomeActions, now, appState.settings]
  );
  const totalCommandCount = effectiveHomeActions.length + customQuickCommands.length;
  const totalOpenCount = openHomeActions.length + openCustomCommands.length;
  const activeCustomCmd = useMemo(
    () =>
      activeCustomCmdId
        ? customQuickCommands.find((c) => c.id === activeCustomCmdId) ?? null
        : null,
    [activeCustomCmdId, customQuickCommands]
  );
  const modalActionConfig = activeCustomCmd
    ? null
    : effectiveHomeActions.find((a) => a.id === activeBoardAction) ?? openHomeActions[0] ?? null;
  const isModalActionOpen = activeCustomCmd
    ? isCustomCommandOpenAt(activeCustomCmd, now)
    : Boolean(modalActionConfig && isHomeActionOpenAt(modalActionConfig.id, now, appState.settings));
  const closeAndLockBoard = () => {
    setSchoolBoardOpen(false);
    setSchoolBoardResult(null);
    setSchoolBoardSearch('');
    setActiveCustomCmdId(null);
    setCustomSubjectInput('');
    setPendingHwKidId(null);
    setHomeHwNoteInput('');
  };
  useEffect(() => {
    if (schoolBoardOpen && !isModalActionOpen) {
      setSchoolBoardOpen(false);
      setSchoolBoardResult(null);
      setSchoolBoardSearch('');
      setActiveCustomCmdId(null);
      setCustomSubjectInput('');
      setPendingHwKidId(null);
      setHomeHwNoteInput('');
    }
  }, [schoolBoardOpen, isModalActionOpen]);
  const runHomeAction = (
    actionId: HomeQuickActionId,
    kidId: string,
    detailOverride?: string
  ): KioskResult | null => {
    if (!isHomeActionOpenAt(actionId, now, appState.settings)) return null;
    if (onQuickHomeAction) return onQuickHomeAction(actionId, kidId, detailOverride);
    if (actionId === 'morning_school') return onQuickGoToSchool(kidId);
    return null;
  };
  const parseHHMMToMins = (hhmm: string, fallback: number): number => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return fallback;
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    return h * 60 + min;
  };
  const applyPresetToNewCommand = (preset: {
    emoji: string;
    titleTh: string;
    kind: CustomQuickCommand['kind'];
    alwaysOpen: boolean;
    defaultNote: string;
    stars: number;
  }) => {
    setNewCmdEmoji(preset.emoji);
    setNewCmdTitleTh(preset.titleTh);
    setNewCmdKind(preset.kind);
    setNewCmdAlwaysOpen(preset.alwaysOpen);
    setNewCmdDefaultNote(preset.defaultNote);
    setNewCmdStars(preset.stars);
  };
  const handleCreateCustomCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newCmdTitleTh.trim();
    if (!cleanTitle) {
      onShowAlert({
        icon: '📝',
        title: lang === 'th' ? 'กรุณาตั้งชื่อคำสั่งคีย์ลัด' : 'Command Title Required',
        message:
          lang === 'th'
            ? 'พิมพ์ชื่อคำสั่งที่ต้องการ เช่น "ขออนุญาตทำการบ้าน" ก่อนกดบันทึกค่ะ'
            : 'Please enter a shortcut title first.',
        tone: 'yellow',
      });
      return;
    }
    if (customQuickCommands.length >= 20) {
      onShowAlert({
        icon: '📋',
        title: lang === 'th' ? 'ครบจำนวนสูงสุด 20 คำสั่งแล้ว' : 'Max 20 Custom Commands Reached',
        message:
          lang === 'th'
            ? 'สามารถลบคำสั่งเก่าที่ไม่ใช้แล้วออกก่อนเพื่อเพิ่มคำสั่งใหม่ได้ค่ะ'
            : 'Please remove an unused custom command first.',
        tone: 'yellow',
      });
      return;
    }
    const created: CustomQuickCommand = {
      id: `cmd_${Date.now()}`,
      emoji: newCmdEmoji.trim() || (newCmdKind === 'homework_permission' ? '📝' : '⚡'),
      titleTh: cleanTitle.slice(0, 60),
      titleEn: cleanTitle.slice(0, 60),
      kind: newCmdKind,
      alwaysOpen: newCmdAlwaysOpen,
      ...(newCmdAlwaysOpen
        ? {}
        : {
            startMins: parseHHMMToMins(newCmdStartTime, 17 * 60),
            endMins: parseHHMMToMins(newCmdEndTime, 21 * 60 + 30),
          }),
      starsDelta: Math.max(0, Math.min(20, Math.round(Number(newCmdStars || 0)))),
      ...(newCmdDefaultNote.trim() ? { defaultNote: newCmdDefaultNote.trim().slice(0, 80) } : {}),
    };
    const nextList = [...customQuickCommands, created];
    onSaveCustomQuickCommands?.(nextList);
    setAddCommandOpen(false);
    setNewCmdTitleTh('');
    setNewCmdDefaultNote('');
    setNewCmdStars(0);
    onShowAlert({
      icon: created.emoji,
      title: lang === 'th' ? `เพิ่มคีย์ลัด "${created.titleTh}" แล้ว!` : `Added "${created.titleEn}"!`,
      message:
        lang === 'th'
          ? 'กดใช้งานจากหน้าแรกได้ทันทีเลยค่ะ'
          : 'Ready to use from the Quick Commands menu.',
      tone: 'mint',
    });
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
        className="rounded-[26px] sm:rounded-[34px] border-2 p-3 sm:p-5 pastel-shadow transition-colors"
        style={{
          backgroundColor: 'var(--theme-frame-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-3.5">
          {/* Inner White Login & Live Clock Card */}
          <div className="flex-1 rounded-[22px] sm:rounded-[26px] bg-white border border-white/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-stretch justify-between gap-4 sm:gap-5">
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

              {/* Single Unified Launcher Button for Timed + Custom Quick Commands */}
              <button
                type="button"
                onClick={() => setQuickActionsMenuOpen(true)}
                className={`min-h-[46px] w-full rounded-2xl border px-4 py-2 text-xs sm:text-sm font-extrabold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  totalOpenCount > 0
                    ? 'border-[#8FD4C6] bg-[#E8FAF6] hover:bg-[#D8F5EE] text-[#114A42]'
                    : 'border-[#E6DCD2] bg-[#F7F3EE] hover:bg-[#EFE9E1] text-[#6E5C52]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">
                    {totalOpenCount > 0 ? '📋' : '🔒'}
                  </span>
                  <span className="truncate">
                    {totalOpenCount > 0
                      ? lang === 'th'
                        ? `คำสั่งเช็คชื่อ & คีย์ลัด (${totalOpenCount}/${totalCommandCount} เปิดอยู่)`
                        : `Quick Check-In & Shortcuts (${totalOpenCount}/${totalCommandCount} Open)`
                      : lang === 'th'
                      ? `คำสั่งเช็คชื่อตามเวลา & คีย์ลัด (รวม ${totalCommandCount} คำสั่ง)`
                      : `Timed Check-In & Shortcuts (${totalCommandCount})`}
                  </span>
                </span>
                <span
                  className={`rounded-xl px-2.5 py-0.5 text-[11px] font-bold shrink-0 ${
                    totalOpenCount > 0
                      ? 'bg-white text-[#114A42]'
                      : 'bg-white/80 text-[#8B796E]'
                  }`}
                >
                  {totalOpenCount > 0
                    ? lang === 'th'
                      ? 'เลือกคำสั่ง ▾'
                      : 'Open ▾'
                    : lang === 'th'
                    ? 'ตั้งค่า/+เพิ่ม ▾'
                    : 'View / +Add ▾'}
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

      {/* Unified Timed + Custom Quick Shortcut Commands Menu Modal with '+' Add Button */}
      {quickActionsMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-[24px] sm:rounded-[30px] border-4 border-[#B9E8DF] bg-[#FFFDF9] p-4 sm:p-6 pastel-shadow space-y-3.5 sm:space-y-4 overflow-hidden">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#EFE6DC]">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold text-[#114A42] flex flex-wrap items-center gap-2">
                  <span>📋</span>
                  <span>
                    {lang === 'th'
                      ? `รวมคำสั่งเช็คชื่อ & คีย์ลัด (${totalCommandCount} คำสั่ง)`
                      : `Check-In & Quick Shortcuts (${totalCommandCount})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (addCommandOpen) {
                        setAddCommandOpen(false);
                        return;
                      }
                      setScheduleEditorOpen(false);
                      setPermissionsEditorOpen(false);
                      setPendingBoardUnlock({ type: 'add_custom' });
                    }}
                    title={lang === 'th' ? 'เพิ่มคำสั่งคีย์ลัดใหม่ (ตอนรีบ / ขออนุญาต)' : 'Add Quick Shortcut Command'}
                    aria-label={lang === 'th' ? 'เพิ่มคำสั่งคีย์ลัดใหม่' : 'Add Quick Command'}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                      addCommandOpen
                        ? 'border-[#114A42] bg-[#114A42] text-white'
                        : 'border-[#E86F87] bg-[#FFF0F3] hover:bg-[#FADADD] text-[#B01E3D]'
                    }`}
                  >
                    <span className="text-sm leading-none font-black">{addCommandOpen ? '−' : '+'}</span>
                    <span>{lang === 'th' ? 'เพิ่มคำสั่ง' : 'Add'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (scheduleEditorOpen) {
                        setScheduleEditorOpen(false);
                        return;
                      }
                      setAddCommandOpen(false);
                      setPermissionsEditorOpen(false);
                      setPendingBoardUnlock({ type: 'edit_schedule' });
                    }}
                    title={lang === 'th' ? 'แก้ไขเวลาเปิด–ปิดคำสั่งหลักทั้งหมด' : 'Edit Core Command Times'}
                    aria-label={lang === 'th' ? 'ตั้งเวลาคำสั่งหลัก' : 'Edit Schedule'}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                      scheduleEditorOpen
                        ? 'border-[#3E2B63] bg-[#3E2B63] text-white'
                        : 'border-[#C8B7EB] bg-[#F5F0FF] hover:bg-[#EAE1FA] text-[#3E2B63]'
                    }`}
                  >
                    <span>⚙️</span>
                    <span>{lang === 'th' ? 'ตั้งเวลา' : 'Schedule'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (permissionsEditorOpen) {
                        setPermissionsEditorOpen(false);
                        return;
                      }
                      setAddCommandOpen(false);
                      setScheduleEditorOpen(false);
                      setPendingBoardUnlock({ type: 'edit_permissions' });
                    }}
                    title={lang === 'th' ? 'ตั้งค่าเด็กที่มี/ไม่มีมือถือ และเลือกชื่อคนมีสิทธิ์กดแต่ละปุ่ม' : 'Phone Status & Per-Command Permissions'}
                    aria-label={lang === 'th' ? 'สิทธิ์และมือถือเด็ก' : 'Kid Permissions'}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                      permissionsEditorOpen
                        ? 'border-[#1B5E52] bg-[#1B5E52] text-white'
                        : 'border-[#9AD8CD] bg-[#E8FAF6] hover:bg-[#D2F4EE] text-[#114A42]'
                    }`}
                  >
                    <span>👥</span>
                    <span>{lang === 'th' ? 'สิทธิ์ & มือถือ' : 'Access'}</span>
                  </button>
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
                  {lang === 'th'
                    ? `ขณะนี้ ${formatDigitalClock(now)} น. · กด + เพิ่มคีย์ลัด, ⚙️ ตั้งเวลา หรือ 👥 สิทธิ์ & มือถือ`
                    : `Time ${formatDigitalClock(now)} · + Add shortcut, ⚙️ Schedule, 👥 Kid access`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddCommandOpen(false);
                  setScheduleEditorOpen(false);
                  setPermissionsEditorOpen(false);
                  setQuickActionsMenuOpen(false);
                }}
                className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
              {/* Inline '⚙️' Core Timed Schedule Editor (Unlocked via Staff/Creator PIN) */}
              {scheduleEditorOpen && (
                <TimedScheduleEditorCard
                  settings={appState.settings}
                  lang={lang}
                  onClose={() => setScheduleEditorOpen(false)}
                  onSave={(nextSched, nextCurfew) => {
                    onSaveTimedSchedule?.(nextSched, nextCurfew);
                    setScheduleEditorOpen(false);
                    onShowAlert({
                      icon: '⚙️',
                      title: lang === 'th' ? 'บันทึกเวลาใหม่เรียบร้อยแล้ว!' : 'Schedule Updated!',
                      message:
                        lang === 'th'
                          ? 'เวลาเปิด–ปิดของคำสั่งหลักและเส้นตายคืนมือถืออัปเดตทันทีทั่วทั้งระบบแล้วค่ะ'
                          : 'Core command time windows and curfew deadline have been updated everywhere.',
                      tone: 'mint',
                    });
                  }}
                />
              )}

              {/* Inline '👥' Kid Phone Status & Per-Command Permissions Editor */}
              {permissionsEditorOpen && (
                <CommandPermissionsEditorCard
                  members={members}
                  settings={appState.settings}
                  lang={lang}
                  onClose={() => setPermissionsEditorOpen(false)}
                  onSave={(nextNoPhoneIds, nextPerms) => {
                    onSaveCommandPermissions?.(nextNoPhoneIds, nextPerms);
                    setPermissionsEditorOpen(false);
                    onShowAlert({
                      icon: '👥',
                      title: lang === 'th' ? 'บันทึกสิทธิ์และสถานะมือถือแล้ว!' : 'Permissions Saved!',
                      message:
                        lang === 'th'
                          ? 'ระบบอัปเดตสถานะมือถือ (📱/📵) และรายชื่อเด็กที่มีสิทธิ์กดแต่ละปุ่มเรียบร้อยแล้วค่ะ'
                          : 'Kid phone status and per-command eligibility have been updated everywhere.',
                      tone: 'mint',
                    });
                  }}
                />
              )}

              {/* Inline '+' Add Custom Shortcut Form (Unlocked via Staff PIN) */}
              {addCommandOpen && (
                <form
                  onSubmit={handleCreateCustomCommand}
                  className="rounded-2xl border-2 border-[#8FD4C6] bg-[#F2FCF9] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-[#114A42]">
                      ➕ {lang === 'th' ? 'เพิ่มคำสั่งใหม่ในคีย์ลัด' : 'Create Custom Quick Command'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddCommandOpen(false)}
                      className="text-xs font-bold text-[#6E5C52] hover:text-[#3D322C] cursor-pointer"
                    >
                      {lang === 'th' ? 'ปิด' : 'Cancel'}
                    </button>
                  </div>

                  {/* Quick 1-Tap Starter Templates */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-[#2E5D55]">
                      {lang === 'th' ? '⚡ เลือกตัวอย่างสำเร็จรูปได้ใน 1 แตะ:' : '⚡ Quick Presets:'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        {
                          emoji: '📝',
                          titleTh: 'ขออนุญาตทำการบ้าน',
                          kind: 'homework_permission' as const,
                          alwaysOpen: true,
                          defaultNote: 'ทำการบ้าน / ทบทวนบทเรียน',
                          stars: 0,
                        },
                        {
                          emoji: '💊',
                          titleTh: 'แจ้งกินยา / พักผ่อน',
                          kind: 'custom_checkin' as const,
                          alwaysOpen: true,
                          defaultNote: 'กินยาตามเวลาเรียบร้อย',
                          stars: 2,
                        },
                        {
                          emoji: '🔑',
                          titleTh: 'ขออนุญาตออกธุระด่วน',
                          kind: 'custom_checkin' as const,
                          alwaysOpen: true,
                          defaultNote: 'แจ้งขออนุญาตผู้ดูแลเรียบร้อย',
                          stars: 0,
                        },
                        {
                          emoji: '🏪',
                          titleTh: 'เปิด-ปิดกะ / เติมสต๊อกร้าน',
                          kind: 'custom_checkin' as const,
                          alwaysOpen: true,
                          defaultNote: 'เช็คสต๊อกและประตูอัตโนมัติเรียบร้อย',
                          stars: 5,
                        },
                      ].map((p) => (
                        <button
                          key={p.titleTh}
                          type="button"
                          onClick={() => applyPresetToNewCommand(p)}
                          className="rounded-xl border border-[#B9E8DF] bg-white hover:bg-[#DCF7F2] px-2.5 py-1 text-[11px] font-bold text-[#114A42] cursor-pointer"
                        >
                          {p.emoji} {p.titleTh}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-[#3D322C] mb-1">
                        {lang === 'th' ? 'ไอคอน' : 'Icon'}
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={newCmdEmoji}
                        onChange={(e) => setNewCmdEmoji(e.target.value)}
                        className="w-full rounded-xl border border-[#D4C5B4] bg-white px-2 py-2 text-center text-base"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[11px] font-bold text-[#3D322C] mb-1">
                        {lang === 'th' ? 'ชื่อปุ่มคำสั่งคีย์ลัด *' : 'Shortcut Title *'}
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        required
                        value={newCmdTitleTh}
                        onChange={(e) => setNewCmdTitleTh(e.target.value)}
                        placeholder={lang === 'th' ? 'เช่น ขออนุญาตทำการบ้าน' : 'e.g. Homework Permission'}
                        className="w-full rounded-xl border border-[#D4C5B4] bg-white px-3 py-2 text-xs text-[#3D322C]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-[#3D322C] mb-1">
                        {lang === 'th' ? 'รูปแบบการทำงาน' : 'Action Type'}
                      </label>
                      <select
                        value={newCmdKind}
                        onChange={(e) =>
                          setNewCmdKind(e.target.value as CustomQuickCommand['kind'])
                        }
                        className="w-full rounded-xl border border-[#D4C5B4] bg-white px-2.5 py-2 text-xs font-bold text-[#3D322C]"
                      >
                        <option value="homework_permission">
                          📝 ขออนุญาตทำการบ้าน (ใช้เพิ่มถึง {hwCurfewTh})
                        </option>
                        <option value="custom_checkin">
                          ⚡ บันทึกคีย์ลัดทั่วไป (เช็คอิน / กินยา / เติมสต๊อก)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#3D322C] mb-1">
                        {lang === 'th' ? 'โบนัสดาว (ถ้ามี)' : 'Bonus Stars'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={newCmdStars}
                        onChange={(e) => setNewCmdStars(Number(e.target.value))}
                        className="w-full rounded-xl border border-[#D4C5B4] bg-white px-3 py-2 text-xs font-bold tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#3D322C] mb-1">
                      {newCmdKind === 'homework_permission'
                        ? lang === 'th'
                          ? 'วิชา / หมายเหตุเริ่มต้น (ไม่บังคับ)'
                          : 'Default Subject / Note'
                        : lang === 'th'
                        ? 'ข้อความบันทึกเริ่มต้น (ไม่บังคับ)'
                        : 'Default Note'}
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={newCmdDefaultNote}
                      onChange={(e) => setNewCmdDefaultNote(e.target.value)}
                      placeholder={
                        newCmdKind === 'homework_permission'
                          ? lang === 'th'
                            ? 'เช่น ทำการบ้าน / อ่านหนังสือเตรียมสอบ'
                            : 'Homework / Study'
                          : lang === 'th'
                          ? 'เช่น บันทึกด่วนโดยพี่เลี้ยง'
                          : 'Quick note'
                      }
                      className="w-full rounded-xl border border-[#D4C5B4] bg-white px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="space-y-2 rounded-xl border border-[#D4EFE9] bg-white p-2.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#114A42] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCmdAlwaysOpen}
                        onChange={(e) => setNewCmdAlwaysOpen(e.target.checked)}
                        className="h-4 w-4 accent-[#114A42]"
                      />
                      <span>
                        ⚡{' '}
                        {lang === 'th'
                          ? 'เปิดให้กดได้ตลอดเวลา 24 ชม. (แนะนำสำหรับคำสั่งตอนรีบ)'
                          : 'Always Open 24/7 (Best for urgent/quick actions)'}
                      </span>
                    </label>
                    {!newCmdAlwaysOpen && (
                      <div className="flex items-center gap-2 text-xs pl-6">
                        <span>{lang === 'th' ? 'ช่วงเวลา:' : 'Window:'}</span>
                        <input
                          type="time"
                          value={newCmdStartTime}
                          onChange={(e) => setNewCmdStartTime(e.target.value)}
                          className="rounded-lg border border-[#D4C5B4] px-2 py-1"
                        />
                        <span>–</span>
                        <input
                          type="time"
                          value={newCmdEndTime}
                          onChange={(e) => setNewCmdEndTime(e.target.value)}
                          className="rounded-lg border border-[#D4C5B4] px-2 py-1"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[42px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                  >
                    💾 {lang === 'th' ? 'บันทึกคำสั่งเข้าคีย์ลัดทันที' : 'Save Custom Quick Command'}
                  </button>
                </form>
              )}

              {/* Custom Quick Shortcuts Section (Ready for rush moments like Homework Permission!) */}
              {customQuickCommands.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-extrabold text-[#114A42] flex items-center justify-between">
                    <span>⚡ {lang === 'th' ? 'คีย์ลัดพิเศษ / ตอนรีบ (เพิ่มเองได้)' : 'Custom Quick Shortcuts'}</span>
                    <span className="text-[11px] font-semibold text-[#6E5C52]">
                      {customQuickCommands.length}/20
                    </span>
                  </div>
                  {customQuickCommands.map((cmd) => {
                    const isOpen = isCustomCommandOpenAt(cmd, now);
                    const eligibleKids = kids.filter((k) => canKidUseCommand(cmd.id, k, appState.settings));
                    const doneCount = eligibleKids.filter((k) => isCustomCommandDoneForKid(cmd, k, now)).length;
                    const permSummary = getCommandPermissionSummary(cmd.id, kids, lang, appState.settings);
                    return (
                      <div key={cmd.id} className="flex items-stretch gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isOpen) {
                              onShowAlert({
                                icon: '🔒',
                                title:
                                  lang === 'th'
                                    ? `คำสั่ง "${cmd.titleTh}" ล็อกอยู่นอกเวลา`
                                    : `"${cmd.titleEn}" Locked`,
                                message:
                                  lang === 'th'
                                    ? `เปิดให้กดช่วงเวลา ${formatCustomCommandWindow(cmd, lang)} ค่ะ`
                                    : `Open during ${formatCustomCommandWindow(cmd, lang)}.`,
                                tone: 'pink',
                              });
                              return;
                            }
                            setQuickActionsMenuOpen(false);
                            setPendingBoardUnlock({ type: 'custom', cmdId: cmd.id });
                          }}
                          aria-disabled={!isOpen}
                          className={`flex-1 rounded-2xl border-2 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isOpen
                              ? 'border-[#7CC6B8] bg-[#E8FAF6] hover:bg-[#D5F4EE] text-[#114A42]'
                              : 'border-[#E6DCD2] bg-[#F7F3EE] hover:bg-[#EFE9E1] text-[#7B695F] opacity-85'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl shrink-0">{isOpen ? cmd.emoji : '🔒'}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold truncate flex items-center gap-1.5">
                                <span className="truncate">{lang === 'th' ? cmd.titleTh : cmd.titleEn}</span>
                                {permSummary.restricted && (
                                  <span className="rounded-md bg-[#FFF5E1] border border-[#ECC98B] px-1.5 py-0.5 text-[10px] font-bold text-[#7A5411] shrink-0">
                                    {permSummary.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-medium opacity-85 tabular-nums">
                                {cmd.alwaysOpen ? '⚡' : '⏰'} {formatCustomCommandWindow(cmd, lang)}
                                {cmd.starsDelta && cmd.starsDelta > 0 ? ` · +${cmd.starsDelta} ⭐` : ''}
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
                              ? `🔐 ${doneCount}/${eligibleKids.length}`
                              : lang === 'th'
                              ? 'ล็อกนอกเวลา'
                              : 'Locked'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingBoardUnlock({ type: 'delete_custom', cmdId: cmd.id })
                          }
                          title={lang === 'th' ? 'ลบคีย์ลัดนี้' : 'Delete Shortcut'}
                          className="rounded-2xl border border-[#F3C5CE] bg-[#FFF2F5] hover:bg-[#FADADD] px-3 text-xs font-bold text-[#8B1D36] cursor-pointer shrink-0"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Core Timed Commands */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-extrabold text-[#6E5C52]">
                  ⏰{' '}
                  {lang === 'th'
                    ? `คำสั่งเช็คชื่อตามเวลาหลัก (${effectiveHomeActions.length} คำสั่ง)`
                    : `Core Timed Schedules (${effectiveHomeActions.length})`}
                </div>
                {effectiveHomeActions.map((action) => {
                  const isOpen = isHomeActionOpenAt(action.id, now, appState.settings);
                  const eligibleKids = kids.filter((k) => canKidUseCommand(action.id, k, appState.settings));
                  const doneCount = eligibleKids.filter((k) => isHomeActionDoneForKid(action.id, k)).length;
                  const permSummary = getCommandPermissionSummary(action.id, kids, lang, appState.settings);
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
                        setPendingBoardUnlock({ type: 'core', actionId: action.id });
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
                          <div className="text-sm font-extrabold truncate flex items-center gap-1.5">
                            <span className="truncate">{lang === 'th' ? action.titleTh : action.titleEn}</span>
                            {permSummary.restricted && (
                              <span className="rounded-md bg-[#FFF5E1] border border-[#ECC98B] px-1.5 py-0.5 text-[10px] font-bold text-[#7A5411] shrink-0">
                                {permSummary.badge}
                              </span>
                            )}
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
                          ? `🔐 ${doneCount}/${eligibleKids.length}`
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
        </div>
      )}

      {/* Staff PIN Gate Modal — Required before showing kids' names or adding/deleting shortcuts */}
      <PinPadModal
        open={Boolean(pendingBoardUnlock)}
        lang={lang}
        lockedRemainingSec={staffBoardPinGuard.remainingSec}
        title={
          pendingBoardUnlock?.type === 'add_custom'
            ? lang === 'th'
              ? '🔐 ใส่รหัส PIN พี่เลี้ยงเพื่อเพิ่มคำสั่งคีย์ลัด'
              : '🔐 Staff PIN to Add Quick Shortcut'
            : pendingBoardUnlock?.type === 'delete_custom'
            ? lang === 'th'
              ? '🔐 ใส่รหัส PIN พี่เลี้ยงเพื่อลบคำสั่งคีย์ลัด'
              : '🔐 Staff PIN to Delete Shortcut'
            : pendingBoardUnlock?.type === 'edit_schedule'
            ? lang === 'th'
              ? '🔐 ใส่รหัส PIN พี่เลี้ยง/ผู้ดูแลเพื่อตั้งเวลาคำสั่ง'
              : '🔐 Staff PIN to Edit Command Schedule'
            : pendingBoardUnlock?.type === 'edit_permissions'
            ? lang === 'th'
              ? '🔐 ใส่รหัส PIN พี่เลี้ยง/ผู้ดูแลเพื่อตั้งค่าสิทธิ์ & มือถือ'
              : '🔐 Staff PIN to Edit Kid Permissions'
            : lang === 'th'
            ? '🔐 ใส่รหัส PIN พี่เลี้ยงเพื่อแสดงรายชื่อน้อง'
            : '🔐 Enter Staff PIN to Show Kids’ Names'
        }
        onCancel={() => setPendingBoardUnlock(null)}
        onSubmitPin={(pin) => {
          if (!pendingBoardUnlock) return;
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
            const unlockJob = pendingBoardUnlock;
            setPendingBoardUnlock(null);
            if (unlockJob.type === 'add_custom') {
              setScheduleEditorOpen(false);
              setPermissionsEditorOpen(false);
              setAddCommandOpen(true);
              return;
            }
            if (unlockJob.type === 'edit_schedule') {
              setAddCommandOpen(false);
              setPermissionsEditorOpen(false);
              setScheduleEditorOpen(true);
              return;
            }
            if (unlockJob.type === 'edit_permissions') {
              setAddCommandOpen(false);
              setScheduleEditorOpen(false);
              setPermissionsEditorOpen(true);
              return;
            }
            if (unlockJob.type === 'delete_custom') {
              const nextList = customQuickCommands.filter((c) => c.id !== unlockJob.cmdId);
              onSaveCustomQuickCommands?.(nextList);
              return;
            }
            if (unlockJob.type === 'custom') {
              setActiveCustomCmdId(unlockJob.cmdId);
              const foundCmd = customQuickCommands.find((c) => c.id === unlockJob.cmdId);
              setCustomSubjectInput(foundCmd?.defaultNote ?? '');
            } else {
              setActiveCustomCmdId(null);
              setActiveBoardAction(unlockJob.actionId);
            }
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

      {/* 1-Tap Command Name Board Modal (Supports both core timed actions and custom quick commands) */}
      {schoolBoardOpen && (activeCustomCmd || modalActionConfig) && isModalActionOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-[24px] sm:rounded-[32px] border-4 border-[#B9E8DF] bg-[#FFFDF9] p-4 sm:p-6 pastel-shadow overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#114A42] flex items-center gap-2">
                  <span>{activeCustomCmd ? activeCustomCmd.emoji : modalActionConfig!.emoji}</span>
                  <span>
                    {activeCustomCmd
                      ? lang === 'th'
                        ? `${activeCustomCmd.titleTh} — แตะชื่อเพื่อบันทึกทันที`
                        : `${activeCustomCmd.titleEn} — Tap Name`
                      : lang === 'th'
                      ? `${modalActionConfig!.titleTh} — กดที่ชื่อตัวเอง 1 ครั้ง`
                      : `${modalActionConfig!.titleEn} — Tap Your Name Once`}
                  </span>
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
                  {activeCustomCmd
                    ? lang === 'th'
                      ? `${formatCustomCommandWindow(activeCustomCmd, lang)} · ขณะนี้ ${formatDigitalClock(now)} น. · ทำแล้ว ${
                          kids.filter((k) => isCustomCommandDoneForKid(activeCustomCmd, k, now)).length
                        }/${kids.length} คน`
                      : `${formatCustomCommandWindow(activeCustomCmd, lang)} · Time ${formatDigitalClock(now)}`
                    : lang === 'th'
                    ? `เปิดเฉพาะ ${modalActionConfig!.windowLabelTh} · ขณะนี้ ${formatDigitalClock(now)} น. · ทำแล้ว ${
                        kids.filter((k) => isHomeActionDoneForKid(modalActionConfig!.id, k)).length
                      }/${kids.length} คน`
                    : `Open ${modalActionConfig!.windowLabelEn} · Time ${formatDigitalClock(now)} · Checked ${
                        kids.filter((k) => isHomeActionDoneForKid(modalActionConfig!.id, k)).length
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

            {(openHomeActions.length + openCustomCommands.length) > 1 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {openCustomCommands.map((cmd) => {
                  const isSelected = activeCustomCmd?.id === cmd.id;
                  const cnt = kids.filter((k) => isCustomCommandDoneForKid(cmd, k, now)).length;
                  return (
                    <button
                      key={`modal-cmd-${cmd.id}`}
                      type="button"
                      onClick={() => {
                        setActiveCustomCmdId(cmd.id);
                        setCustomSubjectInput(cmd.defaultNote ?? '');
                        setSchoolBoardResult(null);
                      }}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-extrabold cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-[#114A42] bg-[#114A42] text-white'
                          : 'border-[#9FE2D6] bg-[#F3FCFA] text-[#114A42] hover:bg-[#DCF7F2]'
                      }`}
                    >
                      {cmd.emoji} {lang === 'th' ? cmd.titleTh : cmd.titleEn} ({cnt}/{kids.length})
                    </button>
                  );
                })}
                {openHomeActions.map((act) => {
                  const isSelected = !activeCustomCmd && modalActionConfig?.id === act.id;
                  const cnt = kids.filter((k) => isHomeActionDoneForKid(act.id, k)).length;
                  return (
                    <button
                      key={`modal-tab-${act.id}`}
                      type="button"
                      onClick={() => {
                        setActiveCustomCmdId(null);
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

            {/* Quick Subject/Note Input for Homework Permission or Custom Shortcut */}
            {activeCustomCmd && (
              <div className="mt-3 rounded-2xl border border-[#B9E8DF] bg-[#F3FCFA] p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold text-[#114A42]">
                    {activeCustomCmd.kind === 'homework_permission'
                      ? lang === 'th'
                        ? '📝 วิชาที่ขออนุญาตทำการบ้าน (ไม่บังคับ):'
                        : '📝 Homework Subject (Optional):'
                      : lang === 'th'
                      ? '🗒️ หมายเหตุสั้นๆ (ไม่บังคับ):'
                      : '🗒️ Quick Note (Optional):'}
                  </span>
                  <input
                    type="text"
                    maxLength={80}
                    value={customSubjectInput}
                    onChange={(e) => setCustomSubjectInput(e.target.value)}
                    placeholder={
                      activeCustomCmd.defaultNote ||
                      (lang === 'th' ? 'พิมพ์วิชาหรือข้อความสั้นๆ...' : 'Enter subject or note...')
                    }
                    className="flex-1 min-w-[180px] rounded-xl border border-[#8FD4C6] bg-white px-3 py-1.5 text-xs text-[#3D322C]"
                  />
                </div>
                {activeCustomCmd.kind === 'homework_permission' && (
                  <div className="flex flex-wrap gap-1.5">
                    {['ทำการบ้าน', 'หาข้อมูล', 'เรียนพิเศษ', 'คณิตศาสตร์', 'ภาษาอังกฤษ', 'วิทยาศาสตร์'].map(
                      (subj) => (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => setCustomSubjectInput(subj)}
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                            customSubjectInput === subj
                              ? 'border-[#114A42] bg-[#114A42] text-white'
                              : 'border-[#B9E8DF] bg-white text-[#114A42] hover:bg-[#E8FAF6]'
                          }`}
                        >
                          {subj}
                        </button>
                      )
                    )}
                  </div>
                )}
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

            {/* Group Tabs + Eligible Filter + Search */}
            {(() => {
              const activePermCmdId = activeCustomCmd ? activeCustomCmd.id : modalActionConfig!.id;
              const eligibleAllCount = kids.filter((k) =>
                canKidUseCommand(activePermCmdId, k, appState.settings)
              ).length;
              const displayedBoardKids = showOnlyEligibleKids
                ? filteredSchoolKids.filter((k) => canKidUseCommand(activePermCmdId, k, appState.settings))
                : filteredSchoolKids;

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 my-3">
                    <div className="flex flex-wrap items-center gap-1.5">
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
                      <button
                        type="button"
                        onClick={() => setShowOnlyEligibleKids((prev) => !prev)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors border ${
                          showOnlyEligibleKids
                            ? 'bg-[#114A42] border-[#114A42] text-white'
                            : 'bg-[#FFF9ED] border-[#E7CFA2] text-[#6D4C14] hover:bg-[#FFF1D6]'
                        }`}
                      >
                        {showOnlyEligibleKids
                          ? lang === 'th'
                            ? `🎯 เฉพาะคนมีสิทธิ์ (${eligibleAllCount})`
                            : `🎯 Eligible (${eligibleAllCount})`
                          : lang === 'th'
                          ? `👁️ ซ่อนคนไม่มีสิทธิ์ (${eligibleAllCount}/${kids.length})`
                          : `👁️ Eligible Only (${eligibleAllCount}/${kids.length})`}
                      </button>
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
                      {displayedBoardKids.map((kid) => {
                        const isEligible = canKidUseCommand(activePermCmdId, kid, appState.settings);
                        const kidHasPhone = doesKidHavePhone(kid.id, appState.settings);
                        const denialReason = isEligible
                          ? null
                          : getCommandDenialReason(activePermCmdId, kid, lang, appState.settings);
                        const done = activeCustomCmd
                          ? isCustomCommandDoneForKid(activeCustomCmd, kid, now)
                          : isHomeActionDoneForKid(modalActionConfig!.id, kid);
                        const isHwPermCore =
                          !activeCustomCmd && modalActionConfig?.id === 'night_homework_permission';
                        const isAway = isKidAwayOnDate(kid, todayKey);
                        const canTap =
                          isEligible &&
                          (activeCustomCmd
                            ? isModalActionOpen && !(done && activeCustomCmd.kind !== 'homework_permission')
                            : isHwPermCore
                            ? isModalActionOpen
                            : !done && isModalActionOpen);
                        return (
                          <button
                            key={kid.id}
                            type="button"
                            disabled={!canTap}
                            onClick={() => {
                              if (!canTap) return;
                              if (activeCustomCmd) {
                                const res = onRunCustomQuickCommand?.(
                                  activeCustomCmd,
                                  kid.id,
                                  customSubjectInput
                                );
                                if (res) setSchoolBoardResult(res);
                                return;
                              }
                              if (isHwPermCore) {
                                setHomeHwNoteInput('');
                                setPendingHwKidId(kid.id);
                                return;
                              }
                              const res = runHomeAction(modalActionConfig!.id, kid.id);
                              if (res) setSchoolBoardResult(res);
                            }}
                            className={`rounded-2xl border-2 p-3 text-left transition-all flex flex-col justify-between gap-2 ${
                              !isEligible
                                ? 'border-[#E6DCD2] bg-[#F5F1EC] opacity-65 cursor-not-allowed'
                                : done &&
                                  !isHwPermCore &&
                                  !(activeCustomCmd?.kind === 'homework_permission' && customSubjectInput.trim())
                                ? 'border-[#C5EAE2] bg-[#F2FBF9] opacity-80 cursor-default'
                                : isAway
                                ? 'border-[#D9CCE8] bg-[#F7F3FC] hover:bg-[#EFE8FC] cursor-pointer active:scale-[0.98]'
                                : 'border-[#B9E8DF] bg-white hover:bg-[#E8FAF6] hover:border-[#64CBB9] cursor-pointer active:scale-[0.98] shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-2xl leading-none">{kid.emoji}</span>
                              <span className="text-[10px] font-bold text-[#7B695F] flex items-center gap-1">
                                <span>{kidHasPhone ? '📱' : '📵'}</span>
                                <span>{lang === 'th' ? `กลุ่ม ${kid.group}` : `G${kid.group}`}</span>
                              </span>
                            </div>
                            <div className="font-extrabold text-base text-[#3D322C] truncate">
                              {kid.nickname}
                            </div>
                            <div
                              className={`rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-center ${
                                !isEligible
                                  ? 'bg-[#EAE2D9] text-[#7D6C62]'
                                  : done
                                  ? 'bg-[#D6F5EE] text-[#1B5E52]'
                                  : isAway
                                  ? 'bg-[#EAE4F2] text-[#463A59]'
                                  : 'bg-[#114A42] text-white'
                              }`}
                            >
                              {!isEligible
                                ? (lang === 'th' ? denialReason?.badgeTh : denialReason?.badgeEn) ??
                                  (lang === 'th' ? '🚫 ไม่มีสิทธิ์' : '🚫 Restricted')
                                : done
                                ? activeCustomCmd
                                  ? lang === 'th'
                                    ? '✅ บันทึกแล้ว'
                                    : '✅ Done'
                                  : lang === 'th'
                                  ? modalActionConfig!.doneLabelTh
                                  : modalActionConfig!.doneLabelEn
                                : isAway
                                ? lang === 'th'
                                  ? '🏡 ลา (กดเช็ค)'
                                  : '🏡 Away'
                                : activeCustomCmd
                                ? `${activeCustomCmd.emoji} ${
                                    lang === 'th' ? activeCustomCmd.titleTh : activeCustomCmd.titleEn
                                  }`
                                : lang === 'th'
                                ? modalActionConfig!.tapLabelTh
                                : modalActionConfig!.tapLabelEn}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {displayedBoardKids.length === 0 && (
                      <div className="py-10 text-center text-sm text-[#7B695F]">
                        {lang === 'th' ? 'ไม่พบรายชื่อที่ค้นหา / มีสิทธิ์ในเงื่อนไขนี้' : 'No matching names'}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Pop-up 3 Sub-Buttons for "ขออนุญาตทำการบ้าน" from Home Quick Board */}
      {pendingHwKidId && (() => {
        const targetHwKid = kids.find((k) => k.id === pendingHwKidId);
        if (!targetHwKid) return null;
        const submitChoice = (choice: 'ทำการบ้าน' | 'หาข้อมูล' | 'เรียนพิเศษ') => {
          const note = homeHwNoteInput.trim();
          const finalLabel = note ? `${choice} (${note})` : choice;
          const res = runHomeAction('night_homework_permission', targetHwKid.id, finalLabel);
          if (res) setSchoolBoardResult(res);
          setHomeHwNoteInput('');
          setPendingHwKidId(null);
        };
        return (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#3D322C]/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-[28px] border-4 border-[#8FD4C6] bg-[#FFFDF9] p-6 pastel-shadow space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-[#114A42]">
                    📝 {targetHwKid.emoji} น้อง{targetHwKid.nickname} · ขออนุญาตทำการบ้าน
                  </h3>
                  <p className="text-xs text-[#4B7069] mt-0.5">
                    {lang === 'th'
                      ? `เลือกเหตุผลที่ต้องการใช้งาน (เปิดเฉพาะ ${hwPermWin.labelTh})`
                      : `Choose permission type (${hwPermWin.labelEn})`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingHwKidId(null)}
                  className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F5C5CF] font-bold text-[#3D322C] cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFF0F3] px-3.5 py-2.5 text-xs text-[#8B1D36] space-y-1 leading-relaxed">
                <div className="font-extrabold">
                  ⏰ {lang === 'th' ? `ใช้เพิ่มได้ถึงเวลา ${hwCurfewTh}` : `Extension until ${hwCurfewEn}`}
                </div>
                <div>
                  ⚖️{' '}
                  {lang === 'th'
                    ? `หากเกิน ${hwCurfewTh} ยังไม่นำมือถือมาเก็บ จะถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วัน`
                    : `Keeping phone past ${hwCurfewEn} forfeits 1 Free Day phone privilege.`}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3D322C] mb-1">
                  {lang === 'th' ? 'รายละเอียด / วิชา (ไม่บังคับ)' : 'Subject / Note (Optional)'}
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={homeHwNoteInput}
                  onChange={(e) => setHomeHwNoteInput(e.target.value)}
                  placeholder={lang === 'th' ? 'เช่น คณิตศาสตร์ / ค้นคว้าโครงงาน...' : 'e.g. Math / Project...'}
                  className="w-full rounded-xl border border-[#BFE6DE] bg-white px-3 py-2 text-sm text-[#3D322C]"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => submitChoice('ทำการบ้าน')}
                  className="w-full min-h-[52px] rounded-2xl border-2 border-[#7EBCE6] bg-[#E8F5FD] hover:bg-[#D5ECFA] px-4 py-3 font-extrabold text-[#1D4D73] flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-base">
                    <span className="text-xl">✍️</span>
                    <span>{lang === 'th' ? 'ปุ่มทำการบ้าน' : 'Do Homework'}</span>
                  </span>
                  <span className="text-xs font-bold bg-white/90 px-2.5 py-1 rounded-xl border border-[#B6DBF2]">
                    เลือก →
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => submitChoice('หาข้อมูล')}
                  className="w-full min-h-[52px] rounded-2xl border-2 border-[#7CC6B8] bg-[#E8FAF6] hover:bg-[#D5F4EE] px-4 py-3 font-extrabold text-[#114A42] flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-base">
                    <span className="text-xl">🔍</span>
                    <span>{lang === 'th' ? 'ปุ่มหาข้อมูล' : 'Research Info'}</span>
                  </span>
                  <span className="text-xs font-bold bg-white/90 px-2.5 py-1 rounded-xl border border-[#A5DFD3]">
                    เลือก →
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => submitChoice('เรียนพิเศษ')}
                  className="w-full min-h-[52px] rounded-2xl border-2 border-[#C5B2E8] bg-[#F5F1FC] hover:bg-[#EAE1FA] px-4 py-3 font-extrabold text-[#3E2B63] flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 text-base">
                    <span className="text-xl">📚</span>
                    <span>{lang === 'th' ? 'ปุ่มเรียนพิเศษ' : 'Extra Tutoring'}</span>
                  </span>
                  <span className="text-xs font-bold bg-white/90 px-2.5 py-1 rounded-xl border border-[#D4C5F2]">
                    เลือก →
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
