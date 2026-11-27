import { User } from 'firebase/auth';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CORE_ROSTER_STAFF,
  getShiftCoverageAtDateTime,
  getStaffScheduleForDate,
} from '../data/staffSchedule';
import { signOutCloud } from '../firebase';
import { isMasterAdminEmail, MASTER_ADMIN_EMAIL } from '../services/firestoreSync';
import {
  Announcement,
  AppState,
  CommandAccessRule,
  CustomQuickCommand,
  Language,
  LinkedKidSession,
  Member,
  ModalAlertPayload,
  PastelTheme,
  ReturnHomePhoto,
  SickReport,
  StaffLeaveRecord,
  TimedScheduleSlot,
  TrashDutyDayEntry,
} from '../types/barnhem';
import {
  canKidUseCommand,
  compareLoginCommandsByTime,
  doesKidHavePhone,
  evaluateKidReturnPhoneSchedule,
  formatCustomCommandWindow,
  formatThaiCurfewClock,
  getAutoReturnPhoneRuleConfig,
  getCommandAuthMode,
  getCommandAuthModeMeta,
  getCommandDenialReason,
  getCommandPermissionSummary,
  getComputerHomeworkPrereqStatus,
  getEffectiveCustomQuickCommands,
  getEffectiveHomeQuickActions,
  getEffectiveHomeworkCurfewMins,
  getEffectiveHomeworkPermissionWindow,
  HomeQuickActionId,
  isCustomCommandDoneForKid,
  isCustomCommandExpiredAt,
  isCustomCommandOpenAt,
  isHomeActionDoneForKid,
  isHomeActionExpiredAt,
  isHomeActionOpenAt,
  KioskPenaltyAlert,
  KioskResult,
  minsToHHMM,
} from '../utils/expressKiosk';
import { isKidAwayOnDate } from '../utils/piggyBank';
import {
  ACTIVITY_LOG_VIEWER_PIN,
  HOUSE_RULES_GUIDE_PIN,
  KIDS_DUTY_ROSTER_PIN,
  KIDS_STAR_SUMMARY_PIN,
  LOST_FOUND_PIN,
  SECRET_VOTE_PIN,
  SHORTCUT_MANUAL_PIN,
  STAFF_SYSTEM_GUIDE_PIN,
  SUPPLY_REQUEST_PIN,
  TIMESTAMP_CAMERA_PIN,
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  getActiveKidAwaySecretCode,
  usePinGuard,
} from '../utils/pinGuard';
import {
  formatDigitalClock,
  formatReadableDate,
  getDateKey,
  getLaundryQueueInfo,
  isPublicHoliday,
} from '../utils/timeRules';
import {
  getMemberTrashDutyStatusForDate,
  getTrashDutyDaySlots,
  getTrashDutyInfoForDate,
  TRASH_DUTY_RULE_EN,
  TRASH_DUTY_RULE_TH,
} from '../utils/trashDuty';
import { PinPadModal, QrScannerModal } from './CenteredAlertModal';
import { CloudSyncBanner } from './CloudSyncBanner';
import { FridayBalloonBanner } from './FridayBalloonBanner';
import { HomeAnnouncementBox } from './HomeAnnouncementBox';
import { HouseRulesGuideView } from './HouseRulesGuideView';
import { KidDutySchedulesPanel } from './KidDutySchedulesPanel';
import { LoginCommandsSettingsCard } from './LoginCommandsSettingsCard';
import { PenaltyNoticeModal } from './PenaltyNoticeModal';
import { StaffLeavePanel } from './StaffLeavePanel';
import { StaffRosterPanel } from './StaffRosterPanel';
import { TimestampCameraModal } from './TimestampCameraModal';

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
  cloudSyncError?: string | null;
  onForceSeedCloud: () => Promise<void>;
  onPullFromCloud?: () => Promise<void>;
  onSelectKid: (kidId: string) => void;
  onAutoLoginRole: (
    member:
      | Member
      | 'creator'
      | 'activity_log'
      | 'star_summary'
      | 'duty_roster'
      | 'secret_vote'
      | 'supply_request'
      | 'lost_found'
      | 'house_rules_guide'
      | 'staff_system_guide'
      | 'shortcut_manual'
  ) => void;
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
  onAddSickReport?: (report: SickReport) => void;
  onUpdateKid?: (kidId: string, updater: (prev: Member) => Member, eventLabel: string) => void;
  onSubmitStaffLeave?: (leave: StaffLeaveRecord) => void;
  onUpdateLeaveSubstitute?: (leaveId: string, substituteName: string) => void;
  onAcknowledgeLeave?: (leaveId: string, byName: string) => void;
  onCancelLeave?: (leaveId: string) => void;
  onAddAnnouncement?: (ann: Announcement) => void;
  onUpdateAnnouncement?: (annId: string, updates: Partial<Announcement>) => void;
  onTogglePinAnnouncement?: (annId: string) => void;
  onDeleteAnnouncement?: (annId: string) => void;
  onToggleStaffTaskDone?: (annId: string, actorName: string) => void;
  onUpdateSettings?: (partial: Partial<AppState['settings']>) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onSaveReturnHomePhoto?: (photo: ReturnHomePhoto) => void;
  onDeleteReturnHomePhoto?: (photoId: string) => void;
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
  cloudSyncError = null,
  onForceSeedCloud,
  onPullFromCloud,
  onSelectKid,
  onAutoLoginRole,
  onExpressKioskScan,
  onQuickGoToSchool,
  onQuickHomeAction,
  onRunCustomQuickCommand,
  onSaveCustomQuickCommands,
  onSaveTimedSchedule,
  onSaveCommandPermissions,
  onUpdateKid,
  onSubmitStaffLeave,
  onUpdateLeaveSubstitute,
  onAcknowledgeLeave,
  onCancelLeave,
  onAddAnnouncement,
  onUpdateAnnouncement,
  onTogglePinAnnouncement,
  onDeleteAnnouncement,
  onToggleStaffTaskDone,
  onUpdateSettings,
  onShowAlert,
  onSaveReturnHomePhoto,
  onDeleteReturnHomePhoto,
  organizationName,
  linkedKidSession = null,
  linkedKidMember = null,
  onOpenLinkedKid,
  onSignOutLinkedKid,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [showPinText, setShowPinText] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [activeBoardAction, setActiveBoardAction] = useState<HomeQuickActionId>('morning_school');
  const [activeCustomCmdId, setActiveCustomCmdId] = useState<string | null>(null);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [schoolBoardOpen, setSchoolBoardOpen] = useState(false);
  const [boardUnlockedByStaff, setBoardUnlockedByStaff] = useState(false);
  const [pendingKidPinAction, setPendingKidPinAction] = useState<{ kid: Member } | null>(null);
  const [boardKidPinInput, setBoardKidPinInput] = useState('');
  const [schoolBoardGroup, setSchoolBoardGroup] = useState<0 | 1 | 2 | 3>(0);
  const [schoolBoardSearch, setSchoolBoardSearch] = useState('');
  const [showOnlyEligibleKids, setShowOnlyEligibleKids] = useState(false);
  const [schoolBoardResult, setSchoolBoardResult] = useState<KioskResult | null>(null);
  const [pendingKid, setPendingKid] = useState<Member | null>(null);
  const [quickActionsMenuOpen, setQuickActionsMenuOpen] = useState(false);
  const [pendingBoardUnlock, setPendingBoardUnlock] = useState<
    | null
    | { type: 'core'; actionId: HomeQuickActionId }
    | { type: 'custom'; cmdId: string }
    | { type: 'add_custom' }
    | { type: 'delete_custom'; cmdId: string }
    | { type: 'manage_commands' }
  >(null);
  const [commandManagerMode, setCommandManagerMode] = useState<null | 'add_direct' | 'manager'>(null);
  const [showCloudSync, setShowCloudSync] = useState(false);
  const [usefulInfoOpen, setUsefulInfoOpen] = useState(false);
  const [usefulInfoTab, setUsefulInfoTab] = useState<
    'hub' | 'staff_roster' | 'duties' | 'rules_schedule' | 'trips' | 'lost_found'
  >('hub');
  const [homeStaffWorkOpen, setHomeStaffWorkOpen] = useState(false);
  const [homeStaffWorkTab, setHomeStaffWorkTab] = useState<'tasks' | 'leave'>('tasks');
  const [homeStaffWorkPinInput, setHomeStaffWorkPinInput] = useState('');
  const [homeStaffWorkActor, setHomeStaffWorkActor] = useState<string | null>(null);
  const [staffTaskTarget, setStaffTaskTarget] = useState('ทุกกะ / พี่เลี้ยงทั้งหมด');
  const [staffTaskTitle, setStaffTaskTitle] = useState('');
  const [staffTaskBody, setStaffTaskBody] = useState('');
  const [staffTaskUrgent, setStaffTaskUrgent] = useState(false);
  const [trashConfirmTarget, setTrashConfirmTarget] = useState<{
    zone: 'boys' | 'girls';
    kidId: string;
    displayName: string;
    dateKey: string;
    dayLabelTh: string;
    dayLabelEn: string;
    nextDone: boolean;
  } | null>(null);
  const [trashPinInput, setTrashPinInput] = useState('');
  const [penaltyNoticePopup, setPenaltyNoticePopup] = useState<KioskPenaltyAlert | null>(null);
  const [timestampCamOpen, setTimestampCamOpen] = useState(false);
  const cloudSyncSectionRef = useRef<HTMLDivElement | null>(null);
  const pinGuard = usePinGuard('magic_door');
  const staffBoardPinGuard = usePinGuard('magic_door_staff_board');
  const kidCmdPinGuard = usePinGuard('magic_door_kid_cmd');
  const homeStaffWorkPinGuard = usePinGuard('magic_door_staff_work');
  const trashPinGuard = usePinGuard('magic_door_trash');

  const isCloudAccountAuthorized = Boolean(
    cloudUser && (organizationName || isMasterAdminEmail(cloudUser.email))
  );
  const isMainCloudSyncActive = Boolean(
    isCloudAccountAuthorized && !appState.settings.useOwnStorageOnly
  );
  const openCloudSyncSettings = () => {
    setShowCloudSync(true);
    window.setTimeout(() => {
      cloudSyncSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

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
  const todayTimestampPhotos = useMemo(
    () => (appState.returnHomePhotos ?? []).filter((p) => p.dateKey === todayKey),
    [appState.returnHomePhotos, todayKey]
  );
  const activeAwaySecretCode = useMemo(
    () => getActiveKidAwaySecretCode(appState.settings, todayKey),
    [appState.settings, todayKey]
  );
  const customQuickCommands = useMemo(
    () => getEffectiveCustomQuickCommands(appState.settings).filter((c) => c.enabled !== false),
    [appState.settings]
  );
  const visibleCustomCommands = useMemo(
    () => customQuickCommands.filter((c) => !isCustomCommandExpiredAt(c, now)),
    [customQuickCommands, now]
  );
  const openCustomCommands = useMemo(
    () => customQuickCommands.filter((c) => isCustomCommandOpenAt(c, now)),
    [customQuickCommands, now]
  );
  const effectiveHomeActions = useMemo(
    () => getEffectiveHomeQuickActions(appState.settings, false, now).filter((a) => a.enabled),
    [appState.settings, now]
  );
  const visibleHomeActions = useMemo(
    () => effectiveHomeActions.filter((a) => !isHomeActionExpiredAt(a.id, now, appState.settings)),
    [effectiveHomeActions, now, appState.settings]
  );
  const hiddenExpiredCount =
    effectiveHomeActions.length -
    visibleHomeActions.length +
    (customQuickCommands.length - visibleCustomCommands.length);
  const hwPermWin = useMemo(
    () => getEffectiveHomeworkPermissionWindow(appState.settings),
    [appState.settings]
  );
  const hwCurfewMins = useMemo(
    () => getEffectiveHomeworkCurfewMins(appState.settings),
    [appState.settings]
  );
  const autoReturnRule = useMemo(
    () => getAutoReturnPhoneRuleConfig(appState.settings),
    [appState.settings]
  );
  const hwCurfewTh = formatThaiCurfewClock(hwCurfewMins);
  const hwCurfewEn = minsToHHMM(hwCurfewMins);
  const openHomeActions = useMemo(
    () => effectiveHomeActions.filter((a) => isHomeActionOpenAt(a.id, now, appState.settings)),
    [effectiveHomeActions, now, appState.settings]
  );
  const totalCommandCount = visibleHomeActions.length + visibleCustomCommands.length;
  const totalOpenCount = openHomeActions.length + openCustomCommands.length;
  const openRoutineCount =
    openHomeActions.filter((a) => a.commandType !== 'penalty').length +
    openCustomCommands.filter((c) => c.kind !== 'penalty').length;
  const visibleUnifiedCommands = useMemo(() => {
    const coreEntries = visibleHomeActions.map((action) => ({
      source: 'core' as const,
      startMins: action.startMins,
      endMins: action.endMins,
      deadlineMins: action.deadlineMins,
      alwaysOpen: false,
      commandType: action.commandType,
      action,
    }));
    const customEntries = visibleCustomCommands.map((cmd) => ({
      source: 'custom' as const,
      startMins: cmd.alwaysOpen ? 0 : cmd.startMins ?? 0,
      endMins: cmd.alwaysOpen ? 23 * 60 + 59 : cmd.endMins ?? 23 * 60 + 59,
      deadlineMins: cmd.deadlineMins,
      alwaysOpen: cmd.alwaysOpen,
      kind: cmd.kind,
      cmd,
    }));
    return [...coreEntries, ...customEntries].sort(compareLoginCommandsByTime);
  }, [visibleHomeActions, visibleCustomCommands]);
  const openUnifiedCommands = useMemo(() => {
    const coreEntries = openHomeActions.map((action) => ({
      source: 'core' as const,
      startMins: action.startMins,
      endMins: action.endMins,
      deadlineMins: action.deadlineMins,
      alwaysOpen: false,
      commandType: action.commandType,
      action,
    }));
    const customEntries = openCustomCommands.map((cmd) => ({
      source: 'custom' as const,
      startMins: cmd.alwaysOpen ? 0 : cmd.startMins ?? 0,
      endMins: cmd.alwaysOpen ? 23 * 60 + 59 : cmd.endMins ?? 23 * 60 + 59,
      deadlineMins: cmd.deadlineMins,
      alwaysOpen: cmd.alwaysOpen,
      kind: cmd.kind,
      cmd,
    }));
    return [...coreEntries, ...customEntries].sort(compareLoginCommandsByTime);
  }, [openHomeActions, openCustomCommands]);
  const isPublicHolidayToday = Boolean(appState.settings.isPublicHolidayToday);
  const staffWorkTasks = useMemo(() => {
    const items = appState.announcements.filter((a) => a.audience === 'staff_only');
    return [...items].sort((a, b) => {
      const aDone = Boolean(a.taskCompleted);
      const bDone = Boolean(b.taskCompleted);
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [appState.announcements]);
  const openStaffWorkCount = useMemo(
    () => staffWorkTasks.filter((t) => !t.taskCompleted).length,
    [staffWorkTasks]
  );
  const urgentStaffTaskCount = useMemo(
    () => staffWorkTasks.filter((t) => !t.taskCompleted && t.priority === 'urgent').length,
    [staffWorkTasks]
  );
  const openHomeLostCount = useMemo(
    () => appState.lostFoundItems.filter((i) => i.status !== 'claimed').length,
    [appState.lostFoundItems]
  );
  const todayStaffRow = useMemo(() => getStaffScheduleForDate(now), [now]);
  const todayCoverage = useMemo(
    () =>
      getShiftCoverageAtDateTime(
        now,
        now.getHours() * 60 + now.getMinutes(),
        appState.staffLeaves ?? [],
        isPublicHolidayToday
      ),
    [now, appState.staffLeaves, isPublicHolidayToday]
  );
  const staffOptionsForWork = useMemo(() => {
    const set = new Set<string>(['ทุกกะ / พี่เลี้ยงทั้งหมด', ...CORE_ROSTER_STAFF]);
    members
      .filter((m) => m.role !== 'kid')
      .forEach((m) => {
        if (m.nickname?.trim()) set.add(m.nickname.trim());
      });
    return Array.from(set);
  }, [members]);
  const trashToday = useMemo(() => getTrashDutyInfoForDate(now), [now]);
  const trashDaySlots = useMemo(() => getTrashDutyDaySlots(now), [now]);
  const todayMorningCarerLabel =
    todayStaffRow.shiftATh !== '—'
      ? lang === 'th'
        ? todayStaffRow.shiftATh
        : todayStaffRow.shiftAEn
      : lang === 'th'
      ? todayStaffRow.shiftBTh
      : todayStaffRow.shiftBEn;
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
    setBoardUnlockedByStaff(false);
    setPendingKidPinAction(null);
    setBoardKidPinInput('');
    setSchoolBoardResult(null);
    setSchoolBoardSearch('');
    setSchoolBoardGroup(0);
    setActiveCustomCmdId(null);
    setCustomSubjectInput('');
  };
  const openCommandBoardDirect = (
    target: { type: 'core'; actionId: HomeQuickActionId } | { type: 'custom'; cmdId: string },
    unlockedByStaff: boolean
  ) => {
    setBoardUnlockedByStaff(unlockedByStaff);
    setPendingKidPinAction(null);
    setBoardKidPinInput('');
    if (target.type === 'custom') {
      setActiveCustomCmdId(target.cmdId);
      const foundCmd = customQuickCommands.find((c) => c.id === target.cmdId);
      setCustomSubjectInput(foundCmd?.defaultNote ?? '');
      setSchoolBoardGroup(0);
    } else {
      setActiveCustomCmdId(null);
      setActiveBoardAction(target.actionId);
      setSchoolBoardGroup(target.actionId === 'evening_computer_homework' ? 2 : 0);
    }
    setSchoolBoardResult(null);
    setSchoolBoardSearch('');
    setSchoolBoardOpen(true);
  };
  useEffect(() => {
    if (schoolBoardOpen && !isModalActionOpen) {
      setSchoolBoardOpen(false);
      setBoardUnlockedByStaff(false);
      setPendingKidPinAction(null);
      setBoardKidPinInput('');
      setSchoolBoardResult(null);
      setSchoolBoardSearch('');
      setActiveCustomCmdId(null);
      setCustomSubjectInput('');
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
  const handleCommandSettingsUpdate = (partial: Partial<AppState['settings']>) => {
    if (onUpdateSettings) {
      onUpdateSettings(partial);
      return;
    }
    if (partial.customQuickCommands) {
      onSaveCustomQuickCommands?.(partial.customQuickCommands);
    }
    if (partial.timedCommandSchedule) {
      onSaveTimedSchedule?.(partial.timedCommandSchedule, partial.homeworkCurfewMins ?? hwCurfewMins);
    }
    if (partial.commandPermissions || partial.kidsWithoutPhoneIds) {
      onSaveCommandPermissions?.(
        partial.kidsWithoutPhoneIds ?? appState.settings.kidsWithoutPhoneIds ?? [],
        partial.commandPermissions ?? appState.settings.commandPermissions ?? {}
      );
    }
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

  type PinLoginOutcome = 'logged_in' | 'staff_only_kid_blocked' | 'not_found';

  const resolvePinLogin = (pin: string): PinLoginOutcome => {
    if (pinGuard.isLocked) return 'not_found';
    if (pin === ACTIVITY_LOG_VIEWER_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('activity_log');
      return 'logged_in';
    }
    if (pin === KIDS_STAR_SUMMARY_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('star_summary');
      return 'logged_in';
    }
    if (pin === KIDS_DUTY_ROSTER_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('duty_roster');
      return 'logged_in';
    }
    if (pin === SECRET_VOTE_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('secret_vote');
      return 'logged_in';
    }
    if (pin === SUPPLY_REQUEST_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('supply_request');
      return 'logged_in';
    }
    if (pin === LOST_FOUND_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('lost_found');
      return 'logged_in';
    }
    if (pin === HOUSE_RULES_GUIDE_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('house_rules_guide');
      return 'logged_in';
    }
    if (pin === TIMESTAMP_CAMERA_PIN) {
      pinGuard.recordSuccess();
      setQuickInput('');
      setTimestampCamOpen(true);
      return 'logged_in';
    }
    if (pin === SHORTCUT_MANUAL_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('shortcut_manual');
      return 'logged_in';
    }
    if (pin === STAFF_SYSTEM_GUIDE_PIN) {
      pinGuard.recordSuccess();
      onAutoLoginRole('staff_system_guide');
      return 'logged_in';
    }
    if (creatorPins.includes(pin)) {
      pinGuard.recordSuccess();
      onAutoLoginRole('creator');
      return 'logged_in';
    }
    const matchedMember = members.find((m) => m.pin === pin);
    if (!matchedMember) return 'not_found';
    if (matchedMember.role === 'kid') {
      return 'staff_only_kid_blocked';
    }
    pinGuard.recordSuccess();
    onAutoLoginRole(matchedMember);
    return 'logged_in';
  };

  const showTopPinRejectedAlert = (outcome: 'staff_only_kid_blocked' | 'not_found') => {
    const res = pinGuard.recordFailure();
    setQuickInput('');
    if (res.lockedNow) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ล็อกชั่วคราว 30 วินาที' : 'Locked for 30 Seconds',
        message: formatPinLockoutMessage(res.lockSec, lang),
        tone: 'pink',
      });
      return;
    }
    if (outcome === 'staff_only_kid_blocked') {
      onShowAlert({
        icon: '👩‍🏫',
        title:
          lang === 'th'
            ? 'ช่องนี้สงวนสิทธิ์สำหรับพนักงานเท่านั้นค่ะ'
            : 'Staff & Caregiver Login Only',
        message: `${
          lang === 'th'
            ? 'ช่องกรอก PIN 4 หลักนี้สงวนไว้สำหรับพนักงานและผู้ดูแลทุกคนค่ะ\nน้องๆ กดใช้งานได้ผ่านปุ่ม "📋 คำสั่งเช็คชื่อ & คีย์ลัด" หรือกรอกรหัสลัด 4 หลักได้เลยค่ะ'
            : 'This 4-digit PIN login is reserved for staff & caregivers. Kids can use Check-In Commands or 4-digit shortcut PINs.'
        }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
      return;
    }
    onShowAlert({
      icon: '🔐',
      title: lang === 'th' ? 'ไม่พบรหัส PIN พนักงานนี้' : 'Staff PIN Not Found',
      message: `${
        lang === 'th'
          ? 'กรุณาตรวจสอบรหัส PIN 4 หลักของพนักงาน/ผู้ดูแลอีกครั้งค่ะ'
          : 'Please check your 4-digit staff PIN again.'
      }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
      tone: 'pink',
    });
  };

  const handleQuickLookup = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) {
      onShowAlert({
        icon: '🔑',
        title: lang === 'th' ? 'กรุณากรอกรหัส PIN พนักงาน' : 'Enter Staff 4-digit PIN',
        message:
          lang === 'th'
            ? 'ช่องนี้สงวนไว้สำหรับพนักงาน/ผู้ดูแล กรุณาใส่รหัส PIN 4 หลักเพื่อเข้าสู่ระบบค่ะ'
            : 'Please enter a 4-digit staff PIN to sign in.',
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
      const outcome = resolvePinLogin(code);
      if (outcome === 'logged_in') {
        setQuickInput('');
        return;
      }
      showTopPinRejectedAlert(outcome);
      return;
    }

    onShowAlert({
      icon: '🔑',
      title: lang === 'th' ? 'กรุณากรอกรหัส PIN 4 หลัก' : '4-Digit PIN Required',
      message:
        lang === 'th'
          ? 'กรุณาใส่เฉพาะรหัส PIN ตัวเลข 4 หลักของพนักงานค่ะ'
          : 'Please enter a 4-digit numeric staff PIN.',
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
      onShowAlert({
        icon: '👩‍🏫',
        title:
          lang === 'th'
            ? 'ปิดการเข้าโปรไฟล์เด็กบนเครื่องรวมค่ะ'
            : 'Kid Profile Login Disabled on Shared Device',
        message:
          lang === 'th'
            ? 'หน้านี้สงวนสิทธิ์เข้าสู่ระบบสำหรับพนักงานทุกคนเท่านั้นค่ะ น้องๆ ใช้ปุ่ม "📋 คำสั่งเช็คชื่อ & คีย์ลัด" หรือสแกนโหมด Kiosk ได้เลยค่ะ'
            : 'Account login is reserved for staff on this shared kiosk. Kids can use Check-In Commands or Kiosk scan.',
        tone: 'pink',
      });
      return;
    }
    const matchedOther = members.find((m) => m.id.toLowerCase() === code);
    if (matchedOther) {
      onShowAlert({
        icon: '🔐',
        title: lang === 'th' ? `กรุณากรอกรหัส PIN 4 หลักของ ${matchedOther.nickname}` : `Enter PIN for ${matchedOther.nickname}`,
        message:
          lang === 'th'
            ? 'เพื่อความปลอดภัย กรุณากรอกรหัส PIN 4 หลักของพนักงานลงในช่องเข้าสู่ระบบได้เลยค่ะ'
            : 'Please enter your 4-digit staff PIN into the login box.',
        tone: 'pink',
      });
      return;
    }
    handleQuickLookup(rawCode);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pt-2 sm:pt-6">
      {now.getDay() === 5 && <FridayBalloonBanner lang={lang} variant="home" />}

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

              {/* Pill Staff-Only PIN Input with Key Icon & Eye Toggle */}
              <div className="space-y-1.5">
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
                        const outcome = resolvePinLogin(trimmed);
                        if (outcome === 'logged_in') {
                          setQuickInput('');
                        } else {
                          showTopPinRejectedAlert(outcome);
                        }
                      }
                    }}
                    placeholder={
                      pinGuard.isLocked
                        ? lang === 'th'
                          ? `🔒 รอ ${pinGuard.remainingSec} วินาที...`
                          : `🔒 Wait ${pinGuard.remainingSec}s...`
                        : lang === 'th'
                        ? 'กรอกรหัส PIN พนักงาน 4 หลัก'
                        : 'Enter Staff 4-digit PIN'
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
                <div className="text-[11px] text-[#7B695F] px-1">
                  👩‍🏫{' '}
                  {lang === 'th'
                    ? 'สงวนสิทธิ์เข้าสู่ระบบสำหรับพนักงาน · พิมพ์ 0000 เพื่อเปิดคู่มือรวมรหัสลัด (0001–0009) ค่ะ'
                    : 'Staff login only · Enter 0000 to open the Shortcut Manual (0001–0009)'}
                </div>
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
                className={`min-h-[46px] w-full rounded-2xl border-2 px-4 py-2 text-xs sm:text-sm font-extrabold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                  openRoutineCount > 0
                    ? 'border-[#49AD9A] bg-[#C5EFE6] hover:bg-[#B2E7DC] text-[#0B3B34] shadow-xs'
                    : 'border-[#D1BFAE] bg-[#EBE2D7] hover:bg-[#E1D5C7] text-[#4E3F38]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {openRoutineCount > 0 ? (
                    <span
                      className="relative flex h-2.5 w-2.5 shrink-0"
                      aria-hidden="true"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-85" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#059669]" />
                    </span>
                  ) : null}
                  <span className="shrink-0">
                    {openRoutineCount > 0 ? '📋' : '🔒'}
                  </span>
                  <span className="truncate">
                    {openRoutineCount > 0
                      ? lang === 'th'
                        ? `คำสั่งเช็คชื่อ & คีย์ลัด (${openRoutineCount}/${totalCommandCount} เปิดอยู่)`
                        : `Quick Check-In & Shortcuts (${openRoutineCount}/${totalCommandCount} Open)`
                      : lang === 'th'
                      ? `คำสั่งเช็คชื่อตามเวลา & คีย์ลัด (รวม ${totalCommandCount} คำสั่ง)`
                      : `Timed Check-In & Shortcuts (${totalCommandCount})`}
                  </span>
                </span>
                <span
                  className={`rounded-xl px-2.5 py-0.5 text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1.5 ${
                    openRoutineCount > 0
                      ? 'bg-[#0F4C42] text-white'
                      : 'bg-white/90 text-[#5E4E45] border border-[#D4C4B4]'
                  }`}
                >
                  {openRoutineCount > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6EE7B7] animate-pulse" />
                  )}
                  {openRoutineCount > 0
                    ? lang === 'th'
                      ? 'เปิดระบบแล้ว ▾'
                      : 'Open Now ▾'
                    : totalOpenCount > 0
                    ? lang === 'th'
                      ? `เปิดเมนู (${totalOpenCount}) ▾`
                      : `Menu (${totalOpenCount}) ▾`
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
              ) : cloudUser && !isMasterAdminEmail(cloudUser.email) && !organizationName ? (
                <div className="rounded-2xl border border-[#F2DA84] bg-[#FFFBEB] p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E5311]">
                  <span className="min-w-0">
                    {cloudSyncing
                      ? lang === 'th'
                        ? `⏳ กำลังค้นหาตัวการ์ตูนของ ${cloudUser.email}...`
                        : `⏳ Looking up character for ${cloudUser.email}...`
                      : lang === 'th'
                      ? `📧 ล็อกอินด้วย ${cloudUser.email} อยู่ (หากต้องการซิงค์ข้อมูลบ้านหลักข้ามแท็บเล็ตกับคอม กรุณาใช้บัญชี ${MASTER_ADMIN_EMAIL} หรือเพิ่มอีเมลในโปรไฟล์น้องค่ะ)`
                      : `📧 Signed in as ${cloudUser.email} (Use ${MASTER_ADMIN_EMAIL} for house-wide sync, or link this email to a kid profile)`}
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

            {/* Right Column: Live Current Clock + Laundry Queue + Live Staff On-Duty Status */}
            <div
              className="rounded-[22px] border px-5 py-4 flex flex-col items-center justify-center text-center md:w-[290px] shrink-0"
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
              <div className="w-full space-y-2 mt-0.5">
                <div
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border px-3 py-1.5 text-xs font-bold shadow-2xs"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-accent-text)',
                  }}
                >
                  <span>{laundry.emoji}</span>
                  <span>{laundry.label}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHomeStaffWorkPinInput('');
                    setHomeStaffWorkActor(null);
                    setHomeStaffWorkTab('tasks');
                    setHomeStaffWorkOpen(true);
                  }}
                  title={
                    lang === 'th'
                      ? todayCoverage.onDutyNowNames.length > 0
                        ? `สถานะพี่เลี้ยงที่กำลังทำงานอยู่ (${todayCoverage.timeLabel} น.): ${todayCoverage.onDutyNowNames.join(', ')} — กดเพื่อดูรายละเอียดหรือแจ้งงาน`
                        : 'สถานะพี่เลี้ยงที่กำลังทำงานอยู่ — กดเพื่อดูตารางเวรหรือแจ้งงาน'
                      : `Staff on duty (${todayCoverage.timeLabel}): ${todayCoverage.onDutyNowNames.join(', ') || 'None'}`
                  }
                  className={`w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold leading-snug transition-colors cursor-pointer ${
                    todayCoverage.onDutyNowNames.length === 0 || todayCoverage.alertsTh.length > 0
                      ? 'border-[#EE9CAF] bg-[#FFF1F4] hover:bg-[#FFE3EA] text-[#8B1D36]'
                      : 'border-[#B9E2DA] bg-[#F2FBF9] hover:bg-[#E1F6F1] text-[#114A42]'
                  }`}
                >
                  <span className="shrink-0">👩‍🏫</span>
                  <span className="text-center">
                    {lang === 'th'
                      ? todayCoverage.onDutyNowNames.length > 0
                        ? `พี่เลี้ยงทำงานอยู่: ${todayCoverage.onDutyNowNames.join(', ')}`
                        : 'สถานะพี่เลี้ยง: ไม่มีผู้เข้าเวรตอนนี้'
                      : todayCoverage.onDutyNowNames.length > 0
                      ? `On Duty: ${todayCoverage.onDutyNowNames.join(', ')}`
                      : 'Staff Status: Off Duty'}
                  </span>
                </button>
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

      {/* Live Home Trash Duty Status Card with Clinging Teddy Bear Mascot */}
      <div className="relative pt-8 sm:pt-9">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute right-5 sm:right-10 top-0 z-10 w-[86px] h-[58px] drop-shadow-xs"
        >
          <svg
            viewBox="0 0 110 74"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full overflow-visible"
          >
            {/* Left & Right Round Ears */}
            <circle cx="29" cy="21" r="11" fill="#C98A5B" stroke="#7A4C2A" strokeWidth="2.4" />
            <circle cx="29" cy="21" r="6" fill="#FAD4D8" />
            <circle cx="81" cy="21" r="11" fill="#C98A5B" stroke="#7A4C2A" strokeWidth="2.4" />
            <circle cx="81" cy="21" r="6" fill="#FAD4D8" />

            {/* Soft Bear Head */}
            <ellipse cx="55" cy="34" rx="28" ry="23" fill="#D99B6C" stroke="#7A4C2A" strokeWidth="2.4" />
            {/* Cute Pastel Mint Bandana Neck Collar */}
            <path
              d="M36 51 C46 57, 64 57, 74 51 L69 60 C60 64, 50 64, 41 60 Z"
              fill="#9FE2D6"
              stroke="#48998B"
              strokeWidth="2"
            />
            <circle cx="55" cy="56" r="3" fill="#FFF3B8" stroke="#D9A338" strokeWidth="1.4" />

            {/* Creamy Muzzle */}
            <ellipse cx="55" cy="40" rx="11.5" ry="8.5" fill="#FFF2E2" />
            {/* Shiny Eyes */}
            <circle cx="43.5" cy="32.5" r="3.4" fill="#3D2618" />
            <circle cx="42.4" cy="31.3" r="1.2" fill="#FFFFFF" />
            <circle cx="66.5" cy="32.5" r="3.4" fill="#3D2618" />
            <circle cx="65.4" cy="31.3" r="1.2" fill="#FFFFFF" />

            {/* Rosy Cheeks */}
            <ellipse cx="36.5" cy="38.5" rx="4.5" ry="2.6" fill="#F7A7BA" opacity="0.8" />
            <ellipse cx="73.5" cy="38.5" rx="4.5" ry="2.6" fill="#F7A7BA" opacity="0.8" />

            {/* Nose & Sweet Smile */}
            <ellipse cx="55" cy="36.8" rx="4.2" ry="3" fill="#5A331C" />
            <ellipse cx="53.8" cy="35.8" rx="1.2" ry="0.7" fill="#FFFFFF" opacity="0.65" />
            <path
              d="M55 39.8 V42 M51 42.2 Q55 45.8 59 42.2"
              stroke="#5A331C"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Two Cute Bear Paws Clinging Over Top Edge of the Trash Sign */}
            <g>
              <ellipse cx="29" cy="60" rx="10.5" ry="8.5" fill="#D99B6C" stroke="#7A4C2A" strokeWidth="2.4" />
              <ellipse cx="29" cy="61.5" rx="4.5" ry="3" fill="#FAD4D8" />
              <circle cx="24" cy="57.5" r="1.5" fill="#FAD4D8" />
              <circle cx="29" cy="56.2" r="1.5" fill="#FAD4D8" />
              <circle cx="34" cy="57.5" r="1.5" fill="#FAD4D8" />
            </g>
            <g>
              <ellipse cx="81" cy="60" rx="10.5" ry="8.5" fill="#D99B6C" stroke="#7A4C2A" strokeWidth="2.4" />
              <ellipse cx="81" cy="61.5" rx="4.5" ry="3" fill="#FAD4D8" />
              <circle cx="76" cy="57.5" r="1.5" fill="#FAD4D8" />
              <circle cx="81" cy="56.2" r="1.5" fill="#FAD4D8" />
              <circle cx="86" cy="57.5" r="1.5" fill="#FAD4D8" />
            </g>
          </svg>
        </div>

        <div
          className="rounded-[24px] border-2 bg-white px-4 pt-5 pb-4 sm:px-5 sm:pt-5 sm:pb-4 pastel-shadow space-y-3"
          style={{ borderColor: 'var(--theme-border-alt)' }}
        >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <span className="text-sm font-extrabold text-[#3D322C]">
              🗑️ {lang === 'th' ? 'สถานะทิ้งขยะ' : 'Trash Duty Status'}
            </span>
            <span className="text-xs font-medium text-[#7B695F] tabular-nums">
              · {lang === 'th' ? `สัปดาห์ที่ ${trashToday.weekNumber}` : `Week ${trashToday.weekNumber}`}
            </span>
            <span
              className={`text-xs font-extrabold ${
                trashToday.isTrashDayToday ? 'text-[#B8295B]' : 'text-[#245A80]'
              }`}
            >
              · {lang === 'th' ? trashToday.nextTrashDayLabelTh : trashToday.nextTrashDayLabelEn}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isMainCloudSyncActive && !linkedKidSession && !appState.settings.useOwnStorageOnly && (
              <button
                type="button"
                onClick={openCloudSyncSettings}
                className="rounded-xl border border-[#F2DA84] bg-[#FFFBEB] hover:bg-[#FFF3C4] px-2.5 py-1 text-[11px] font-extrabold text-[#7A5411] cursor-pointer whitespace-nowrap"
                title={
                  lang === 'th'
                    ? 'เครื่องนี้ยังไม่ได้เชื่อม Google Cloud Sync ข้อมูลจึงยังไม่เด้งไปเครื่องอื่น'
                    : 'Device is not connected to Cloud Sync'
                }
              >
                📴 {lang === 'th' ? 'ยังไม่ซิงค์ข้ามเครื่อง · เชื่อมต่อ' : 'Offline · Connect Sync'}
              </button>
            )}
            {isMainCloudSyncActive && onPullFromCloud && (
              <button
                type="button"
                disabled={cloudSyncing}
                onClick={() => void onPullFromCloud()}
                className="rounded-xl border border-[#C4DCF0] bg-[#F4FAFF] hover:bg-[#E4F2FC] px-2.5 py-1 text-[11px] font-bold text-[#1E445C] cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {cloudSyncing
                  ? lang === 'th'
                    ? '⏳ กำลังซิงค์...'
                    : '⏳ Syncing...'
                  : lang === 'th'
                  ? '🔄 รีเฟรชสถานะ'
                  : '🔄 Refresh'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setUsefulInfoTab('duties');
                setUsefulInfoOpen(true);
              }}
              className="text-xs font-bold text-[#245A80] hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              {lang === 'th' ? 'ดูตารางเวรทั้งหมด →' : 'Full Schedule →'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              zone: 'boys' as const,
              icon: '👨',
              zoneLabelTh: 'เขตผู้ชาย',
              zoneLabelEn: 'Boys Zone',
              boxCls: 'border-[#C4DCF0] bg-[#F6FAFF]',
              titleCls: 'text-[#163B59]',
            },
            {
              zone: 'girls' as const,
              icon: '👩',
              zoneLabelTh: 'เขตผู้หญิง',
              zoneLabelEn: 'Girls Zone',
              boxCls: 'border-[#F3C6D6] bg-[#FFF7FA]',
              titleCls: 'text-[#6E1F3A]',
            },
          ].map((z) => {
            const allSlotsDone = trashDaySlots.every((slot) => {
              const assignee = z.zone === 'boys' ? slot.boyAssignee : slot.girlAssignee;
              const member = kids.find((k) => k.id === assignee.kidId);
              return getMemberTrashDutyStatusForDate(member, slot.dateKey).done;
            });
            return (
              <div
                key={z.zone}
                className={`rounded-2xl border px-3.5 py-2.5 space-y-2 ${
                  allSlotsDone ? 'border-[#8AD9CA] bg-[#F1FBF8]' : z.boxCls
                }`}
              >
                <div className={`text-xs font-extrabold flex items-center justify-between gap-2 ${z.titleCls}`}>
                  <span>
                    {z.icon} {lang === 'th' ? z.zoneLabelTh : z.zoneLabelEn}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {trashDaySlots.map((slot) => {
                    const assignee = z.zone === 'boys' ? slot.boyAssignee : slot.girlAssignee;
                    const member = kids.find((k) => k.id === assignee.kidId) ?? null;
                    const status = getMemberTrashDutyStatusForDate(member, slot.dateKey);
                    const doneTime = status.doneAt
                      ? new Date(status.doneAt).toLocaleTimeString(
                          lang === 'th' ? 'th-TH' : 'en-US',
                          { hour: '2-digit', minute: '2-digit' }
                        )
                      : null;
                    const assigneeName =
                      lang === 'th' ? assignee.displayNameTh : assignee.displayNameEn;
                    const statusLabel = status.done
                      ? lang === 'th'
                        ? `✅ ${slot.dayNameTh}ทิ้งแล้ว${doneTime ? ` · ${doneTime}` : ''}${
                            status.confirmedBy ? ` (${status.confirmedBy})` : ''
                          }`
                        : `✅ ${slot.dayNameEn} cleared${doneTime ? ` · ${doneTime}` : ''}${
                            status.confirmedBy ? ` (${status.confirmedBy})` : ''
                          }`
                      : slot.isToday
                      ? lang === 'th'
                        ? `⏳ ${slot.dayNameTh}ยังไม่ทิ้ง · เวรวันนี้ (เย็น)`
                        : `⏳ ${slot.dayNameEn} pending · Today (evening)`
                      : slot.isUpcoming
                      ? lang === 'th'
                        ? `🕒 ${slot.dayNameTh}รอดำเนินการ`
                        : `🕒 ${slot.dayNameEn} pending (upcoming)`
                      : lang === 'th'
                      ? `⏳ ${slot.dayNameTh}ยังไม่ยืนยัน`
                      : `⏳ ${slot.dayNameEn} not confirmed`;

                    return (
                      <div
                        key={`${z.zone}-${slot.dateKey}`}
                        className={`rounded-xl border px-2.5 py-2 flex items-center justify-between gap-2 ${
                          status.done
                            ? 'border-[#8AD9CA] bg-white/90'
                            : slot.isToday
                            ? 'border-[#F2C38B] bg-white'
                            : 'border-[#E6DED5] bg-white/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold text-[#3D322C] truncate">
                            {lang === 'th' ? slot.dayWithDateTh : slot.dayWithDateEn} · {assigneeName}
                          </div>
                          <div
                            className={`text-[11px] font-bold mt-0.5 tabular-nums truncate ${
                              status.done
                                ? 'text-[#146850]'
                                : slot.isToday || slot.isPast
                                ? 'text-[#9E3818]'
                                : 'text-[#4B6175]'
                            }`}
                          >
                            {statusLabel}
                          </div>
                        </div>
                        {onUpdateKid && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextDone = !status.done;
                              setTrashPinInput('');
                              setTrashConfirmTarget({
                                zone: z.zone,
                                kidId: assignee.kidId,
                                displayName: assigneeName,
                                dateKey: slot.dateKey,
                                dayLabelTh: slot.dayWithDateTh,
                                dayLabelEn: slot.dayWithDateEn,
                                nextDone,
                              });
                            }}
                            title={
                              status.done
                                ? lang === 'th'
                                  ? 'ทิ้งแล้ว · กดเพื่อแก้ไขสถานะ (ยืนยันด้วยรหัส PIN)'
                                  : 'Cleared · Click to reset with PIN'
                                : lang === 'th'
                                ? 'กดเพื่อกรอกรหัส PIN ยืนยันการทิ้งขยะรอบนี้'
                                : 'Click to verify with 4-digit PIN for this day'
                            }
                            className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-[11px] font-extrabold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                              status.done
                                ? 'border-[#8AD9CA] bg-[#E2F7F1] hover:bg-[#D0F1E8] text-[#114A42]'
                                : slot.isUpcoming
                                ? 'border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#334155]'
                                : 'border-[#E6C87A] bg-[#FFFDF5] hover:bg-[#FFF8E1] text-[#7A5411]'
                            }`}
                          >
                            {status.done
                              ? lang === 'th'
                                ? '✅ ทิ้งแล้ว'
                                : '✅ Cleared'
                              : slot.isUpcoming
                              ? lang === 'th'
                                ? '⏳ รอดำเนินการ'
                                : '⏳ Pending'
                              : lang === 'th'
                              ? '🔑 ยืนยันรหัส'
                              : '🔑 Verify PIN'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-[#7B695F]">
          {lang === 'th' ? TRASH_DUTY_RULE_TH : TRASH_DUTY_RULE_EN}
        </div>
        </div>
      </div>

      {/* Home Announcement Box (Photos + Editable Text, Shown/Stopped by Creator) */}
      <HomeAnnouncementBox
        announcements={appState.announcements}
        showOnHome={appState.settings.showHomeAnnouncementBox !== false}
        lang={lang}
        now={now}
        variant="home"
        onAddAnnouncement={(ann) => onAddAnnouncement?.(ann)}
        onUpdateAnnouncement={(annId, updates) => onUpdateAnnouncement?.(annId, updates)}
        onTogglePinAnnouncement={(annId) => onTogglePinAnnouncement?.(annId)}
        onDeleteAnnouncement={(annId) => onDeleteAnnouncement?.(annId)}
        onToggleShowOnHome={
          onUpdateSettings
            ? (nextShow) => onUpdateSettings({ showHomeAnnouncementBox: nextShow })
            : undefined
        }
        onShowAlert={onShowAlert}
      />

      {/* Collapsible Cloud Sync Settings Link */}
      <div ref={cloudSyncSectionRef} className="space-y-3 pt-1">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowCloudSync((p) => !p)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
              cloudSyncError
                ? 'border-[#EE9CAF] bg-[#FFE8ED] text-[#8B1D36] hover:bg-[#FFD6DF]'
                : isMainCloudSyncActive
                ? 'border-[#B9E8DF] bg-[#F1FBF8] text-[#114A42] hover:bg-[#E2F7F1]'
                : appState.settings.useOwnStorageOnly
                ? 'border-[#DCEEF8] bg-[#F4FAFF] text-[#1E445C] hover:bg-[#E4F2FC]'
                : 'border-[#F2DA84] bg-[#FFFBEB] text-[#7A5411] hover:bg-[#FFF3C4]'
            }`}
          >
            <span>
              {cloudSyncError
                ? '⚠️'
                : isMainCloudSyncActive
                ? '☁️'
                : appState.settings.useOwnStorageOnly
                ? '💾'
                : '📲'}
            </span>
            <span>
              {cloudSyncError
                ? lang === 'th'
                  ? 'การซิงค์คลาวด์ขัดข้อง · แตะเพื่อตรวจสอบ'
                  : 'Cloud Sync Error · Tap to Retry'
                : isMainCloudSyncActive
                ? lang === 'th'
                  ? `ซิงค์ข้ามเครื่องเปิดอยู่ (${cloudUser?.email})`
                  : `Cloud Sync Active (${cloudUser?.email})`
                : cloudUser && !isCloudAccountAuthorized && !linkedKidSession
                ? lang === 'th'
                  ? `บัญชี ${cloudUser.email} ยังไม่ได้ซิงค์บ้านหลัก · แตะเพื่อเปลี่ยน`
                  : `${cloudUser.email} not syncing main house`
                : appState.settings.useOwnStorageOnly
                ? lang === 'th'
                  ? 'โหมดเก็บข้อมูลองค์กรเอง (Cloud Sync)'
                  : 'Own Org Storage (Cloud Sync)'
                : lang === 'th'
                ? 'ยังไม่เชื่อม Cloud Sync (ข้อมูลอยู่แค่ในเครื่องนี้) · แตะเพื่อเชื่อมต่อ'
                : 'Cloud Sync Off (Local Only) · Tap to Connect'}
            </span>
            <span>{showCloudSync ? '⌃' : '⌄'}</span>
          </button>
        </div>

        {showCloudSync && (
          <CloudSyncBanner
            cloudUser={cloudUser}
            cloudSyncing={cloudSyncing}
            cloudSyncError={cloudSyncError}
            isCloudAccountAuthorized={isCloudAccountAuthorized}
            state={appState}
            now={now}
            lang={lang}
            onForceSeedCloud={onForceSeedCloud}
            onPullFromCloud={onPullFromCloud}
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
                      if (commandManagerMode === 'add_direct') {
                        setCommandManagerMode(null);
                        return;
                      }
                      setPendingBoardUnlock({ type: 'add_custom' });
                    }}
                    title={lang === 'th' ? 'เพิ่มปุ่มคำสั่งใหม่' : 'Add New Command Button'}
                    aria-label={lang === 'th' ? 'เพิ่มปุ่มคำสั่งใหม่' : 'Add Command Button'}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                      commandManagerMode === 'add_direct'
                        ? 'border-[#114A42] bg-[#114A42] text-white'
                        : 'border-[#7ED3C0] bg-[#E8FAF5] hover:bg-[#CEF3EA] text-[#0F4C42]'
                    }`}
                  >
                    <span className="text-sm leading-none font-black">+</span>
                    <span>{lang === 'th' ? 'เพิ่มปุ่มคำสั่ง' : 'Add Button'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (commandManagerMode === 'manager') {
                        setCommandManagerMode(null);
                        return;
                      }
                      setPendingBoardUnlock({ type: 'manage_commands' });
                    }}
                    title={
                      lang === 'th'
                        ? 'ตั้งค่าปุ่มคำสั่ง เวลาเปิด-ปิด เส้นตาย บทลงโทษ และสิทธิ์น้องรายคน'
                        : 'Configure command buttons, schedules, deadlines, penalties & eligible kids'
                    }
                    aria-label={lang === 'th' ? 'ตั้งค่าปุ่มคำสั่งทั้งหมด' : 'Manage Commands'}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                      commandManagerMode === 'manager'
                        ? 'border-[#3E2B63] bg-[#3E2B63] text-white'
                        : 'border-[#C8B7EB] bg-[#F5F0FF] hover:bg-[#EAE1FA] text-[#3E2B63]'
                    }`}
                  >
                    <span>🎛️</span>
                    <span>{lang === 'th' ? 'ตั้งค่าปุ่มคำสั่ง' : 'Command Settings'}</span>
                  </button>
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
                  {lang === 'th'
                    ? `ขณะนี้ ${formatDigitalClock(now)} น. · กด + เพิ่มปุ่มคำสั่ง หรือ 🎛️ ตั้งค่าปุ่มคำสั่ง${
                        hiddenExpiredCount > 0 ? ` (ซ่อน ${hiddenExpiredCount} ปุ่มที่เลยเวลาปิดแล้ว)` : ''
                      }`
                    : `Time ${formatDigitalClock(now)} · + Add Button or 🎛️ Command Settings${
                        hiddenExpiredCount > 0 ? ` (${hiddenExpiredCount} closed hidden)` : ''
                      }`}
                </p>
                {activeAwaySecretCode && (
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#F5F0FF] border border-[#C8B7EB] px-2 py-0.5 text-[11px] font-bold text-[#3E2B63]">
                    <span>🔑</span>
                    <span>
                      {lang === 'th'
                        ? 'วันที่พี่เลี้ยงไม่อยู่: ใช้รหัสลับ 4 หลักจากผู้สร้างเปิดช่องคำสั่งนี้ได้ค่ะ'
                        : 'Staff away today: Creator daily secret code is active for these commands.'}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCommandManagerMode(null);
                  setQuickActionsMenuOpen(false);
                }}
                className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
              {now.getDay() === 5 && <FridayBalloonBanner lang={lang} variant="menu" />}

              {/* Unified Login Command Settings Card / Modal (Unlocked via Staff/Creator PIN) */}
              {commandManagerMode === 'manager' && (
                <LoginCommandsSettingsCard
                  members={members}
                  settings={appState.settings}
                  lang={lang}
                  onUpdateSettings={handleCommandSettingsUpdate}
                  onShowAlert={onShowAlert}
                  onClose={() => setCommandManagerMode(null)}
                />
              )}
              {commandManagerMode === 'add_direct' && (
                <LoginCommandsSettingsCard
                  members={members}
                  settings={appState.settings}
                  lang={lang}
                  initialCreateType="routine"
                  directModalOnly
                  onUpdateSettings={handleCommandSettingsUpdate}
                  onShowAlert={onShowAlert}
                  onClose={() => setCommandManagerMode(null)}
                />
              )}

              {/* Unified Chronological Command Buttons (Sorted Earliest -> Latest) */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-extrabold text-[#6E5C52] flex items-center justify-between gap-2">
                  <span>
                    ⏰{' '}
                    {lang === 'th'
                      ? `ปุ่มคำสั่งเรียงตามเวลา (${visibleUnifiedCommands.length} คำสั่ง)`
                      : `Commands in Time Order (${visibleUnifiedCommands.length})`}
                  </span>
                  {visibleCustomCommands.length > 0 && (
                    <span className="text-[11px] font-semibold text-[#6E5C52]">
                      ⚡ {lang === 'th' ? `เพิ่มเอง ${visibleCustomCommands.length}/20` : `${visibleCustomCommands.length}/20 custom`}
                    </span>
                  )}
                </div>
                {visibleUnifiedCommands.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#DFD2C3] bg-[#FAF6F0] px-4 py-4 text-center text-xs font-semibold text-[#7B695F]">
                    {lang === 'th'
                      ? 'คำสั่งเช็คชื่อตามเวลาของวันนี้เลยเวลาปิดระบบหมดแล้วค่ะ (กด "🎛️ ตั้งค่าปุ่มคำสั่ง" เพื่อแก้ไขเวลาได้)'
                      : 'All timed check-in buttons for today have passed their closing time.'}
                  </div>
                )}
                {visibleUnifiedCommands.map((entry) => {
                  if (entry.source === 'custom') {
                    const cmd = entry.cmd;
                    const isOpen = isCustomCommandOpenAt(cmd, now);
                    const isPenaltyCmd = cmd.kind === 'penalty';
                    const eligibleKids = kids.filter((k) => canKidUseCommand(cmd.id, k, appState.settings));
                    const doneCount = eligibleKids.filter((k) => isCustomCommandDoneForKid(cmd, k, now)).length;
                    const permSummary = getCommandPermissionSummary(cmd.id, kids, lang, appState.settings, now);
                    const authMeta = getCommandAuthModeMeta(permSummary.authMode, lang);
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
                            if (permSummary.authMode === 'staff_pin') {
                              setPendingBoardUnlock({ type: 'custom', cmdId: cmd.id });
                            } else {
                              openCommandBoardDirect({ type: 'custom', cmdId: cmd.id }, false);
                            }
                          }}
                          aria-disabled={!isOpen}
                          className={`flex-1 rounded-2xl border-2 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isOpen
                              ? isPenaltyCmd
                                ? 'border-[#E89EB0] bg-[#FFE8EE] hover:bg-[#FFD8E2] text-[#7D1D36]'
                                : 'border-[#49AD9A] bg-[#C5EFE6] hover:bg-[#B2E7DC] text-[#0B3B34]'
                              : 'border-[#D4C4B4] bg-[#EBE2D7] hover:bg-[#E1D5C7] text-[#5E4E45] opacity-90'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isOpen && !isPenaltyCmd && (
                              <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-85" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#059669]" />
                              </span>
                            )}
                            <span className="text-2xl shrink-0">{isOpen ? cmd.emoji : '🔒'}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold truncate flex items-center gap-1.5">
                                <span className="truncate">{lang === 'th' ? cmd.titleTh : cmd.titleEn}</span>
                                {isPenaltyCmd && (
                                  <span className="rounded-md bg-[#FFE2E8] border border-[#EE9CAF] px-1.5 py-0.5 text-[10px] font-extrabold text-[#8B1D36] shrink-0">
                                    {lang === 'th' ? 'บทลงโทษ' : 'Penalty'}
                                  </span>
                                )}
                                {permSummary.restricted && (
                                  <span className="rounded-md bg-[#FFF5E1] border border-[#ECC98B] px-1.5 py-0.5 text-[10px] font-bold text-[#7A5411] shrink-0">
                                    {permSummary.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-medium opacity-85 tabular-nums">
                                {cmd.alwaysOpen ? '⚡' : '⏰'} {formatCustomCommandWindow(cmd, lang)}
                                {!isPenaltyCmd && cmd.starsDelta && cmd.starsDelta > 0
                                  ? ` · +${cmd.starsDelta} ⭐`
                                  : ''}{' '}
                                · {authMeta.icon} {authMeta.shortLabel}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold shrink-0 tabular-nums ${
                              isOpen
                                ? isPenaltyCmd
                                  ? 'bg-[#8B1D36] text-white'
                                  : 'bg-[#114A42] text-white'
                                : 'bg-white/90 text-[#8B796E] border border-[#E6DCD2]'
                            }`}
                          >
                            {isOpen
                              ? isPenaltyCmd
                                ? `${authMeta.icon} ${lang === 'th' ? 'บันทึกโทษ' : 'Log'}`
                                : `${authMeta.icon} ${doneCount}/${eligibleKids.length}`
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
                  }

                  const action = entry.action;
                  const isOpen = isHomeActionOpenAt(action.id, now, appState.settings);
                  const isPenaltyBtn = action.commandType === 'penalty';
                  const eligibleKids = kids.filter((k) =>
                    canKidUseCommand(action.id, k, appState.settings)
                  );
                  const doneCount = eligibleKids.filter((k) => isHomeActionDoneForKid(action.id, k)).length;
                  const permSummary = getCommandPermissionSummary(action.id, kids, lang, appState.settings, now);
                  const authMeta = getCommandAuthModeMeta(permSummary.authMode, lang);
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
                        if (permSummary.authMode === 'staff_pin') {
                          setPendingBoardUnlock({ type: 'core', actionId: action.id });
                        } else {
                          openCommandBoardDirect({ type: 'core', actionId: action.id }, false);
                        }
                      }}
                      aria-disabled={!isOpen}
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isOpen
                          ? isPenaltyBtn
                            ? 'border-[#E89EB0] bg-[#FFE8EE] hover:bg-[#FFD8E2] text-[#7D1D36]'
                            : 'border-[#49AD9A] bg-[#C5EFE6] hover:bg-[#B2E7DC] text-[#0B3B34]'
                          : 'border-[#D4C4B4] bg-[#EBE2D7] hover:bg-[#E1D5C7] text-[#5E4E45] opacity-90'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isOpen && !isPenaltyBtn && (
                          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-85" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#059669]" />
                          </span>
                        )}
                        <span className="text-2xl shrink-0">{isOpen ? action.emoji : '🔒'}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold truncate flex items-center gap-1.5">
                            <span className="truncate">{lang === 'th' ? action.titleTh : action.titleEn}</span>
                            {isPenaltyBtn && (
                              <span className="rounded-md bg-[#FFE2E8] border border-[#EE9CAF] px-1.5 py-0.5 text-[10px] font-extrabold text-[#8B1D36] shrink-0">
                                {lang === 'th' ? 'บทลงโทษ' : 'Penalty'}
                              </span>
                            )}
                            {permSummary.restricted && (
                              <span className="rounded-md bg-[#FFF5E1] border border-[#ECC98B] px-1.5 py-0.5 text-[10px] font-bold text-[#7A5411] shrink-0">
                                {permSummary.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-medium opacity-85 tabular-nums">
                            ⏰ {lang === 'th' ? action.windowLabelTh : action.windowLabelEn} ·{' '}
                            {authMeta.icon} {authMeta.shortLabel}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`rounded-xl px-2.5 py-1 text-[11px] font-extrabold shrink-0 tabular-nums ${
                          isOpen
                            ? isPenaltyBtn
                              ? 'bg-[#8B1D36] text-white'
                              : 'bg-[#114A42] text-white'
                            : 'bg-white/90 text-[#8B796E] border border-[#E6DCD2]'
                        }`}
                      >
                        {isOpen
                          ? isPenaltyBtn
                            ? `${authMeta.icon} ${lang === 'th' ? 'บันทึกโทษ' : 'Log'}`
                            : `${authMeta.icon} ${doneCount}/${eligibleKids.length}`
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

      {/* Staff PIN Gate Modal — Required for staff_pin commands or adding/deleting/editing settings */}
      <PinPadModal
        open={Boolean(pendingBoardUnlock)}
        lang={lang}
        lockedRemainingSec={staffBoardPinGuard.remainingSec}
        title={
          pendingBoardUnlock?.type === 'add_custom'
            ? lang === 'th'
              ? '🔐 ใส่รหัส PIN พี่เลี้ยง/ผู้สร้างเพื่อเพิ่มปุ่มคำสั่งใหม่'
              : '🔐 Staff PIN to Add Command Button'
            : pendingBoardUnlock?.type === 'delete_custom'
            ? lang === 'th'
              ? '🔐 ใส่รหัส PIN พี่เลี้ยงเพื่อลบคำสั่งคีย์ลัด'
              : '🔐 Staff PIN to Delete Shortcut'
            : pendingBoardUnlock?.type === 'manage_commands'
            ? lang === 'th'
              ? '🔐 ใส่รหัส PIN พี่เลี้ยง/ผู้สร้างเพื่อตั้งค่าปุ่มคำสั่ง'
              : '🔐 Staff PIN to Manage Command Buttons'
            : lang === 'th'
            ? '🔐 ใส่รหัส PIN พี่เลี้ยงเพื่อแสดงรายชื่อน้อง'
            : '🔐 Enter Staff PIN to Show Kids’ Names'
        }
        subtitle={
          (pendingBoardUnlock?.type === 'core' || pendingBoardUnlock?.type === 'custom') &&
          activeAwaySecretCode
            ? lang === 'th'
              ? '🔑 วันที่พี่เลี้ยงไม่อยู่: สามารถใช้รหัสลับ 4 หลักจากผู้สร้างได้ค่ะ'
              : '🔑 Staff away today: Creator daily 4-digit secret code is accepted.'
            : undefined
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
          const isCheckInBoardUnlock =
            pendingBoardUnlock.type === 'core' || pendingBoardUnlock.type === 'custom';
          const isValidAwayCode =
            isCheckInBoardUnlock && activeAwaySecretCode !== null && pin === activeAwaySecretCode;

          if (staffPins.includes(pin) || isValidAwayCode) {
            staffBoardPinGuard.recordSuccess();
            const unlockJob = pendingBoardUnlock;
            setPendingBoardUnlock(null);
            if (unlockJob.type === 'add_custom') {
              setCommandManagerMode('add_direct');
              return;
            }
            if (unlockJob.type === 'manage_commands') {
              setCommandManagerMode('manager');
              return;
            }
            if (unlockJob.type === 'delete_custom') {
              const nextList = customQuickCommands.filter((c) => c.id !== unlockJob.cmdId);
              onSaveCustomQuickCommands?.(nextList);
              return;
            }
            openCommandBoardDirect(unlockJob, true);
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

      {/* Kid 4-Digit PIN Modal — When command authMode is 'kid_pin' and not unlocked by Staff */}
      <PinPadModal
        open={Boolean(pendingKidPinAction && schoolBoardOpen)}
        lang={lang}
        lockedRemainingSec={kidCmdPinGuard.remainingSec}
        title={
          pendingKidPinAction
            ? lang === 'th'
              ? `🔑 น้อง${pendingKidPinAction.kid.nickname} · ใส่รหัส PIN 4 หลัก`
              : `🔑 ${pendingKidPinAction.kid.nickname} · Enter 4-Digit PIN`
            : ''
        }
        subtitle={
          pendingKidPinAction
            ? !activeCustomCmd && modalActionConfig?.id === 'evening_computer_homework'
              ? lang === 'th'
                ? `น้อง${pendingKidPinAction.kid.nickname} ต้องใส่รหัส PIN 4 หลักของตนเองเพื่อยืนยัน "${modalActionConfig.titleTh}" (+10 ⭐)`
                : `${pendingKidPinAction.kid.nickname} must enter your own 4-digit PIN for "${modalActionConfig.titleEn}" (+10 ⭐)`
              : lang === 'th'
              ? `เพื่อยืนยัน "${activeCustomCmd ? activeCustomCmd.titleTh : modalActionConfig?.titleTh ?? ''}" ด้วยตัวเอง (หรือใช้รหัสพี่เลี้ยงค่ะ)`
              : `Confirm "${activeCustomCmd ? activeCustomCmd.titleEn : modalActionConfig?.titleEn ?? ''}"`
            : undefined
        }
        onCancel={() => setPendingKidPinAction(null)}
        onSubmitPin={(pin) => {
          if (!pendingKidPinAction) return;
          if (kidCmdPinGuard.isLocked) {
            onShowAlert({
              icon: '🔒',
              title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
              message: formatPinLockoutMessage(kidCmdPinGuard.remainingSec, lang),
              tone: 'pink',
            });
            return;
          }
          const targetKid = pendingKidPinAction.kid;
          const isSelfPinOnly =
            !activeCustomCmd && modalActionConfig?.id === 'evening_computer_homework';
          const isValidKidPin = pin === targetKid.pin;
          const isValidStaffOrAway =
            staffPins.includes(pin) ||
            (activeAwaySecretCode !== null && pin === activeAwaySecretCode);
          const pinAccepted = isSelfPinOnly
            ? isValidKidPin
            : isValidKidPin || isValidStaffOrAway;

          if (pinAccepted) {
            kidCmdPinGuard.recordSuccess();
            setPendingKidPinAction(null);
            if (activeCustomCmd) {
              const res = onRunCustomQuickCommand?.(
                activeCustomCmd,
                targetKid.id,
                customSubjectInput
              );
              if (res) {
                setSchoolBoardResult(res);
                if (res.penaltyAlert) setPenaltyNoticePopup(res.penaltyAlert);
              }
              return;
            }
            if (modalActionConfig) {
              const res = runHomeAction(modalActionConfig.id, targetKid.id);
              if (res) {
                setSchoolBoardResult(res);
                if (!res.success) {
                  onShowAlert({
                    icon: res.emoji,
                    title: res.bannerTitle,
                    message: res.bannerSubtitle,
                    tone: 'yellow',
                  });
                }
                if (res.penaltyAlert) setPenaltyNoticePopup(res.penaltyAlert);
              }
            }
          } else {
            const res = kidCmdPinGuard.recordFailure();
            onShowAlert({
              icon: res.lockedNow ? '🔒' : '🔑',
              title: res.lockedNow
                ? lang === 'th'
                  ? 'ล็อกชั่วคราว 30 วินาที'
                  : 'Locked for 30 Seconds'
                : lang === 'th'
                ? 'รหัส PIN ไม่ถูกต้อง'
                : 'Incorrect PIN',
              message: res.lockedNow
                ? formatPinLockoutMessage(res.lockSec, lang)
                : `${
                    lang === 'th'
                      ? isSelfPinOnly
                        ? `คำสั่งนี้ให้น้อง${targetKid.nickname} ใส่รหัส PIN 4 หลักของตัวเองด้วยตนเองเท่านั้นค่ะ`
                        : `กรุณาใส่รหัส PIN 4 หลักของน้อง${targetKid.nickname} ค่ะ`
                      : `Please enter ${targetKid.nickname}'s 4-digit PIN.`
                  }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
              tone: 'pink',
            });
          }
        }}
      />

      {/* 1-Tap Command Name Board Modal (Supports staff_pin, kid_pin, and self_tap modes) */}
      {schoolBoardOpen && (activeCustomCmd || modalActionConfig) && isModalActionOpen && (() => {
        const activePermCmdId = activeCustomCmd ? activeCustomCmd.id : modalActionConfig!.id;
        const activeAuthMode = getCommandAuthMode(activePermCmdId, appState.settings, now);
        const activeAuthMeta = getCommandAuthModeMeta(activeAuthMode, lang);
        const isComputerHwBoard =
          !activeCustomCmd && modalActionConfig?.id === 'evening_computer_homework';
        const requiresKidPin =
          isComputerHwBoard || (activeAuthMode === 'kid_pin' && !boardUnlockedByStaff);
        const isReturnPhoneBoard = !activeCustomCmd && modalActionConfig?.id === 'night_return_phone';
        const isSaturdayBoard =
          !activeCustomCmd && modalActionConfig?.id === 'morning_school' && now.getDay() === 6;
        const isHolidayMorningBoard =
          !activeCustomCmd &&
          modalActionConfig?.id === 'morning_school' &&
          (now.getDay() === 6 ||
            now.getDay() === 0 ||
            isPublicHoliday(now, Boolean(appState.settings.isPublicHolidayToday)));
        const eligibleAllCount = kids.filter((k) =>
          canKidUseCommand(activePermCmdId, k, appState.settings)
        ).length;
        const displayedBoardKids = showOnlyEligibleKids
          ? filteredSchoolKids.filter((k) =>
              canKidUseCommand(activePermCmdId, k, appState.settings)
            )
          : filteredSchoolKids;

        const executeBoardCheckInForKid = (targetKid: Member) => {
          if (activeCustomCmd) {
            const res = onRunCustomQuickCommand?.(
              activeCustomCmd,
              targetKid.id,
              customSubjectInput
            );
            if (res) {
              setSchoolBoardResult(res);
              if (res.penaltyAlert) setPenaltyNoticePopup(res.penaltyAlert);
            }
            return;
          }
          if (modalActionConfig) {
            const res = runHomeAction(modalActionConfig.id, targetKid.id);
            if (res) {
              setSchoolBoardResult(res);
              if (!res.success) {
                onShowAlert({
                  icon: res.emoji,
                  title: res.bannerTitle,
                  message: res.bannerSubtitle,
                  tone: 'yellow',
                });
              }
              if (res.penaltyAlert) setPenaltyNoticePopup(res.penaltyAlert);
            }
          }
        };

        const handleFastKidPinSubmit = (rawPin: string) => {
          const clean = rawPin.trim();
          if (kidCmdPinGuard.isLocked) {
            onShowAlert({
              icon: '🔒',
              title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
              message: formatPinLockoutMessage(kidCmdPinGuard.remainingSec, lang),
              tone: 'pink',
            });
            return;
          }
          if (!/^\d{4}$/.test(clean)) {
            onShowAlert({
              icon: '🔑',
              title: lang === 'th' ? 'กรุณาใส่รหัส 4 หลัก' : '4-Digit PIN Required',
              message:
                lang === 'th'
                  ? 'ใส่รหัส PIN 4 หลักของตัวเองเพื่อเช็คชื่อได้เลยค่ะ'
                  : 'Enter your 4-digit PIN to check in.',
              tone: 'yellow',
            });
            return;
          }
          if (
            !isComputerHwBoard &&
            (staffPins.includes(clean) ||
              (activeAwaySecretCode !== null && clean === activeAwaySecretCode))
          ) {
            kidCmdPinGuard.recordSuccess();
            setBoardKidPinInput('');
            setBoardUnlockedByStaff(true);
            setSchoolBoardResult({
              success: true,
              emoji: '🔓',
              starsDelta: 0,
              bannerTitle:
                lang === 'th'
                  ? 'พี่เลี้ยงปลดล็อคกระดานนี้แล้ว'
                  : 'Board Unlocked by Staff',
              bannerSubtitle:
                lang === 'th'
                  ? 'แตะชื่อน้องเพื่อเช็คชื่อได้ทันทีโดยไม่ต้องถาม PIN ค่ะ'
                  : 'Staff can now tap kids directly.',
            });
            return;
          }
          const matchedKid = kids.find((k) => k.pin === clean);
          if (!matchedKid) {
            setBoardKidPinInput('');
            const res = kidCmdPinGuard.recordFailure();
            onShowAlert({
              icon: res.lockedNow ? '🔒' : '🔑',
              title: res.lockedNow
                ? lang === 'th'
                  ? 'ล็อกชั่วคราว 30 วินาที'
                  : 'Locked for 30 Seconds'
                : lang === 'th'
                ? 'ไม่พบรหัส PIN นี้'
                : 'PIN Not Found',
              message: res.lockedNow
                ? formatPinLockoutMessage(res.lockSec, lang)
                : `${
                    lang === 'th'
                      ? 'กรุณาตรวจสอบรหัส PIN 4 หลักของตัวเองอีกครั้งค่ะ'
                      : 'Please verify your 4-digit PIN.'
                  }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
              tone: 'pink',
            });
            return;
          }
          kidCmdPinGuard.recordSuccess();
          setBoardKidPinInput('');
          if (!canKidUseCommand(activePermCmdId, matchedKid, appState.settings)) {
            const denied = getCommandDenialReason(activePermCmdId, matchedKid, lang, appState.settings);
            onShowAlert({
              icon: '🚫',
              title: denied.title,
              message: denied.subtitle,
              tone: 'pink',
            });
            return;
          }
          executeBoardCheckInForKid(matchedKid);
        };

        return (
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
                        ? `${activeCustomCmd.titleTh} — ${
                            requiresKidPin ? 'ใส่ PIN หรือแตะชื่อตัวเอง' : 'แตะชื่อเพื่อบันทึกทันที'
                          }`
                        : `${activeCustomCmd.titleEn}`
                      : lang === 'th'
                      ? `${modalActionConfig!.titleTh} — ${
                          requiresKidPin ? 'ใส่ PIN หรือแตะชื่อตัวเอง' : 'กดที่ชื่อตัวเอง 1 ครั้ง'
                        }`
                      : `${modalActionConfig!.titleEn}`}
                  </span>
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
                  {activeCustomCmd
                    ? lang === 'th'
                      ? `${formatCustomCommandWindow(activeCustomCmd, lang)} · ขณะนี้ ${formatDigitalClock(now)} น. · ทำแล้ว ${
                          kids.filter((k) => isCustomCommandDoneForKid(activeCustomCmd, k, now)).length
                        }/${kids.length} คน · ${
                          boardUnlockedByStaff ? '🔐 พี่เลี้ยงปลดล็อคแล้ว' : `${activeAuthMeta.icon} ${activeAuthMeta.shortLabel}`
                        }`
                      : `${formatCustomCommandWindow(activeCustomCmd, lang)} · Time ${formatDigitalClock(now)}`
                    : lang === 'th'
                    ? `เปิดเฉพาะ ${modalActionConfig!.windowLabelTh} · ขณะนี้ ${formatDigitalClock(now)} น. · ทำแล้ว ${
                        kids.filter((k) => isHomeActionDoneForKid(modalActionConfig!.id, k)).length
                      }/${kids.length} คน · ${
                        boardUnlockedByStaff ? '🔐 พี่เลี้ยงปลดล็อคแล้ว' : `${activeAuthMeta.icon} ${activeAuthMeta.shortLabel}`
                      }`
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

            {openUnifiedCommands.length > 1 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {openUnifiedCommands.map((entry) => {
                  if (entry.source === 'custom') {
                    const cmd = entry.cmd;
                    const isSelected = activeCustomCmd?.id === cmd.id;
                    const cnt = kids.filter((k) => isCustomCommandDoneForKid(cmd, k, now)).length;
                    const tabMode = getCommandAuthMode(cmd.id, appState.settings, now);
                    const needsStaff = tabMode === 'staff_pin' && !boardUnlockedByStaff;
                    return (
                      <button
                        key={`modal-cmd-${cmd.id}`}
                        type="button"
                        onClick={() => {
                          if (needsStaff) {
                            setSchoolBoardOpen(false);
                            setPendingBoardUnlock({ type: 'custom', cmdId: cmd.id });
                            return;
                          }
                          openCommandBoardDirect({ type: 'custom', cmdId: cmd.id }, boardUnlockedByStaff);
                        }}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-extrabold cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-[#114A42] bg-[#114A42] text-white'
                            : 'border-[#9FE2D6] bg-[#F3FCFA] text-[#114A42] hover:bg-[#DCF7F2]'
                        }`}
                      >
                        {needsStaff ? '🔐 ' : ''}
                        {cmd.emoji} {lang === 'th' ? cmd.titleTh : cmd.titleEn} ({cnt}/{kids.length})
                      </button>
                    );
                  }
                  const act = entry.action;
                  const isSelected = !activeCustomCmd && modalActionConfig?.id === act.id;
                  const cnt = kids.filter((k) => isHomeActionDoneForKid(act.id, k)).length;
                  const tabMode = getCommandAuthMode(act.id, appState.settings, now);
                  const needsStaff = tabMode === 'staff_pin' && !boardUnlockedByStaff;
                  return (
                    <button
                      key={`modal-tab-${act.id}`}
                      type="button"
                      onClick={() => {
                        if (needsStaff) {
                          setSchoolBoardOpen(false);
                          setPendingBoardUnlock({ type: 'core', actionId: act.id });
                          return;
                        }
                        openCommandBoardDirect({ type: 'core', actionId: act.id }, boardUnlockedByStaff);
                      }}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-extrabold cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-[#114A42] bg-[#114A42] text-white'
                          : 'border-[#9FE2D6] bg-[#F3FCFA] text-[#114A42] hover:bg-[#DCF7F2]'
                      }`}
                    >
                      {needsStaff ? '🔐 ' : ''}
                      {act.emoji} {lang === 'th' ? act.titleTh : act.titleEn} ({cnt}/{kids.length})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Fast Kid 4-Digit PIN Bar when button requires Kid PIN */}
            {requiresKidPin && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleFastKidPinSubmit(boardKidPinInput);
                }}
                className="mt-3 rounded-2xl border-2 border-[#E7CFA2] bg-[#FFFDF2] p-3 flex flex-wrap items-center justify-between gap-2.5"
              >
                <div className="text-xs font-extrabold text-[#5E411D]">
                  🔑{' '}
                  {lang === 'th'
                    ? 'โหมดน้องใส่รหัสเอง: พิมพ์ PIN 4 หลักเพื่อเช็คชื่อทันที หรือแตะชื่อตัวเองด้านล่างค่ะ'
                    : 'Kid PIN Mode: Enter your 4-digit PIN directly or tap your name below'}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={boardKidPinInput}
                    onChange={(e) => {
                      const nextVal = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setBoardKidPinInput(nextVal);
                      if (nextVal.length === 4) {
                        handleFastKidPinSubmit(nextVal);
                      }
                    }}
                    placeholder={lang === 'th' ? 'PIN 4 หลัก...' : '4-digit PIN...'}
                    className="w-32 rounded-xl border border-[#D4B98B] bg-white px-3 py-1.5 text-center font-mono text-sm font-extrabold tracking-widest text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#D4A762]"
                  />
                  <button
                    type="submit"
                    className="min-h-[36px] rounded-xl bg-[#7A5411] hover:bg-[#5E411D] text-white px-3.5 py-1.5 text-xs font-extrabold cursor-pointer shrink-0"
                  >
                    {lang === 'th' ? '✓ ยืนยัน PIN' : '✓ Confirm'}
                  </button>
                </div>
              </form>
            )}

            {/* Auto Phone Return Rule Info Banner */}
            {isReturnPhoneBoard && autoReturnRule?.enabled && (
              <div className="mt-3 rounded-2xl border border-[#E7CFA2] bg-[#FFF8EA] px-3.5 py-2.5 text-xs font-bold text-[#6D4C14]">
                🤖{' '}
                {lang === 'th'
                  ? `ระบบคำนวณอัตโนมัติ: ไม่ได้ขอทำการบ้านก่อน ${minsToHHMM(hwPermWin.endMins)} น. เล่นได้ถึง ${minsToHHMM(autoReturnRule.noHomeworkDeadlineMins)} น. · ขอทำการบ้านแล้วใช้ได้ถึง ${minsToHHMM(autoReturnRule.homeworkExtendedDeadlineMins)} น. (คืนเกินกำหนดทั้งคู่ถูกลงโทษทันทีค่ะ)`
                  : `Auto Rule: No homework request before ${minsToHHMM(hwPermWin.endMins)} limited to ${minsToHHMM(autoReturnRule.noHomeworkDeadlineMins)} · Registered homework until ${minsToHHMM(autoReturnRule.homeworkExtendedDeadlineMins)} (both penalized past deadline).`}
              </div>
            )}

            {/* Weekend & Holiday Self-Tap, Anti-Proxy-Tap & Schedule Banner */}
            {isHolidayMorningBoard && (
              <div className="mt-3 rounded-2xl border border-[#F5C58A] bg-[#FFF8EA] px-3.5 py-2.5 text-xs font-bold text-[#6D4C14] space-y-1">
                <div>
                  👆{' '}
                  {isSaturdayBoard
                    ? lang === 'th'
                      ? 'วันเสาร์: ระบบเปิด 08:15–08:35 น. (อนุโลมได้ไม่เกิน 1 นาที / ถึง 08:36 น.) · กดเลือกชื่อตัวเองได้เลย ไม่ต้องใส่รหัส (+10 ⭐) · เกิน 08:36 น. ลงโทษตามที่ตัวเองโหวตค่ะ'
                      : 'Saturday: Opens 08:15–08:35 (1-min grace to 08:36) · Tap your own name directly without PIN (+10 ⭐) · Past 08:36 applies your voted penalty.'
                    : lang === 'th'
                    ? 'วันอาทิตย์ & วันนักขัตฤกษ์: เช็คอินไม่เกิน 08:15 น. (อนุโลมได้ไม่เกิน 10 นาที / ถึง 08:25 น. เนื่องจากพี่เกดเดินปลุกและไขกุญแจ) · กดเลือกชื่อตัวเองได้เลย ไม่ต้องใส่รหัส'
                    : "Sunday & Public Holidays: By 08:15 (10-min grace to 08:25 as P'Ked wakes kids & unlocks) · Tap your own name directly without PIN."}
                </div>
                <div className="text-[#9F1239]">
                  🚫{' '}
                  {lang === 'th'
                    ? 'ห้ามกดชื่อแทนเพื่อนเด็ดขาด! หากพบการกดแทนกันจะกลับไปใช้ระบบใส่รหัสยืนยันตามเดิม · ⏰ ตั้งนาฬิกาปลุกและรีบลุกมากดชื่อด้วยตัวเองให้ทันเวลา'
                    : 'Never tap for a friend! Proxy tapping will revert to PIN verification. Set your alarm and check in on time.'}
                </div>
              </div>
            )}

            {/* Computer Homework Prerequisite Banner */}
            {isComputerHwBoard && (
              <div className="mt-3 rounded-2xl border border-[#38BDF8] bg-[#EEF8FF] px-3.5 py-2.5 text-xs font-bold text-[#0C4A6E]">
                💻🌟{' '}
                {lang === 'th'
                  ? `เฉพาะรุ่นเด็กโต (+${modalActionConfig?.rewardStars ?? 10} ⭐ · เปิด ${modalActionConfig?.windowLabelTh}): ต้องซักผ้า / ตากผ้า / รีดผ้า / อาบน้ำ / ตรวจชุด เรียบร้อยครบทั้ง 5 ข้อก่อน และน้องต้องใส่รหัส PIN 4 หลักด้วยตนเองค่ะ`
                  : `Older Kids Only (+${modalActionConfig?.rewardStars ?? 10} ⭐ · ${modalActionConfig?.windowLabelEn}): Must complete Washing, Hanging Dry, Ironing, Shower & Uniform Check, then verify with your own 4-digit PIN.`}
              </div>
            )}

            {/* Quick Note Input for Custom Check-In Shortcut */}
            {activeCustomCmd && activeCustomCmd.kind !== 'homework_permission' && (
              <div className="mt-3 rounded-2xl border border-[#B9E8DF] bg-[#F3FCFA] p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-extrabold text-[#114A42]">
                    {lang === 'th' ? '🗒️ หมายเหตุสั้นๆ (ไม่บังคับ):' : '🗒️ Quick Note (Optional):'}
                  </span>
                  <input
                    type="text"
                    maxLength={80}
                    value={customSubjectInput}
                    onChange={(e) => setCustomSubjectInput(e.target.value)}
                    placeholder={
                      activeCustomCmd.defaultNote ||
                      (lang === 'th' ? 'พิมพ์ข้อความสั้นๆ...' : 'Enter note...')
                    }
                    className="flex-1 min-w-[180px] rounded-xl border border-[#8FD4C6] bg-white px-3 py-1.5 text-xs text-[#3D322C]"
                  />
                </div>
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

            {/* Large Finger-Friendly Name Grid */}
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
                  const isAway = isKidAwayOnDate(kid, todayKey);
                  const canTap = isEligible && !done && isModalActionOpen;
                  const returnEval =
                    isReturnPhoneBoard && isEligible && !done
                      ? evaluateKidReturnPhoneSchedule(kid, now, appState.settings, lang)
                      : null;
                  const compPrereq =
                    isComputerHwBoard && isEligible && !done
                      ? getComputerHomeworkPrereqStatus(kid)
                      : null;
                  return (
                    <button
                      key={kid.id}
                      type="button"
                      disabled={!canTap}
                      onClick={() => {
                        if (!canTap) return;
                        if (compPrereq && !compPrereq.ready) {
                          onShowAlert({
                            icon: '🧺⏳',
                            title:
                              lang === 'th'
                                ? `น้อง${kid.nickname} ยังทำเงื่อนไขก่อนใช้คอมไม่ครบค่ะ`
                                : `${kid.nickname}: Checklist Incomplete`,
                            message:
                              lang === 'th'
                                ? `ยังขาด: ${compPrereq.missingLabelsTh.join(' · ')}\n(ต้องซักผ้า / ตากผ้า / รีดผ้า / อาบน้ำ / ตรวจชุด ให้เรียบร้อยก่อน จึงจะใส่รหัสขอใช้คอมได้ค่ะ)`
                                : `Missing: ${compPrereq.missingLabelsEn.join(', ')}`,
                            tone: 'yellow',
                          });
                          return;
                        }
                        if (requiresKidPin) {
                          setPendingKidPinAction({ kid });
                          return;
                        }
                        executeBoardCheckInForKid(kid);
                      }}
                      className={`rounded-2xl border-2 p-3 text-left transition-all flex flex-col justify-between gap-2 ${
                        !isEligible
                          ? 'border-[#E6DCD2] bg-[#F5F1EC] opacity-65 cursor-not-allowed'
                          : done
                          ? 'border-[#C5EAE2] bg-[#F2FBF9] opacity-80 cursor-default'
                          : isAway
                          ? 'border-[#D9CCE8] bg-[#F7F3FC] hover:bg-[#EFE8FC] cursor-pointer active:scale-[0.98]'
                          : returnEval?.isPastDeadline
                          ? 'border-[#EEB4C0] bg-[#FFF8FA] hover:bg-[#FFEFF3] hover:border-[#DE8096] cursor-pointer active:scale-[0.98] shadow-2xs'
                          : compPrereq && !compPrereq.ready
                          ? 'border-[#F2DA84] bg-[#FFFDF2] hover:bg-[#FFF8DF] cursor-pointer active:scale-[0.98]'
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
                      {returnEval && (
                        <div
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold truncate ${
                            returnEval.isPastDeadline
                              ? 'bg-[#FFE5EC] text-[#8B1D36]'
                              : returnEval.caseKind === 'homework_registered'
                              ? 'bg-[#E3F8F3] text-[#0F4C42]'
                              : 'bg-[#FFF3D6] text-[#7A5411]'
                          }`}
                        >
                          {lang === 'th' ? returnEval.statusBadgeTh : returnEval.statusBadgeEn}
                        </div>
                      )}
                      {compPrereq && (
                        <div
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold truncate ${
                            compPrereq.ready
                              ? 'bg-[#E3F8F3] text-[#0F4C42]'
                              : 'bg-[#FFF3D6] text-[#8B5312]'
                          }`}
                        >
                          {compPrereq.ready
                            ? lang === 'th'
                              ? '✅ ครบ 5 เงื่อนไข · ใส่ PIN ได้'
                              : '✅ All 5 Done · Ready'
                            : lang === 'th'
                            ? `⏳ ขาด: ${compPrereq.missingLabelsTh.join(', ')}`
                            : `⏳ Need: ${compPrereq.missingLabelsEn.join(', ')}`}
                        </div>
                      )}
                      <div
                        className={`rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-center ${
                          !isEligible
                            ? 'bg-[#EAE2D9] text-[#7D6C62]'
                            : done
                            ? 'bg-[#D6F5EE] text-[#1B5E52]'
                            : isAway
                            ? 'bg-[#EAE4F2] text-[#463A59]'
                            : returnEval?.isPastDeadline
                            ? 'bg-[#8B1D36] text-white'
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
                          ? `${requiresKidPin ? '🔑 ' : ''}${
                              lang === 'th' ? '🏡 ลา (กดเช็ค)' : '🏡 Away'
                            }`
                          : activeCustomCmd
                          ? `${requiresKidPin ? '🔑 ' : `${activeCustomCmd.emoji} `}${
                              lang === 'th' ? activeCustomCmd.titleTh : activeCustomCmd.titleEn
                            }`
                          : `${requiresKidPin ? '🔑 ' : ''}${
                              lang === 'th'
                                ? modalActionConfig!.tapLabelTh
                                : modalActionConfig!.tapLabelEn
                            }`}
                      </div>
                    </button>
                  );
                })}
              </div>
              {displayedBoardKids.length === 0 && (
                <div className="py-10 px-4 text-center text-sm font-semibold text-[#7B695F]">
                  {lang === 'th' ? 'ไม่พบรายชื่อที่ค้นหา / มีสิทธิ์ในเงื่อนไขนี้' : 'No matching names'}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}



      {/* Single Collapsed Modal: House Announcements & Useful Public Information */}
      {usefulInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full ${
              usefulInfoTab === 'staff_roster' || usefulInfoTab === 'duties'
                ? 'max-w-4xl'
                : 'max-w-2xl'
            } max-h-[92dvh] flex flex-col rounded-[24px] sm:rounded-[30px] border-4 border-[#EAD9C5] bg-[#FFFDF9] p-4 sm:p-6 pastel-shadow space-y-4 overflow-hidden`}
          >
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#EFE6DC]">
              <div className="flex items-start gap-2.5 min-w-0">
                {usefulInfoTab !== 'hub' && (
                  <button
                    type="button"
                    onClick={() => setUsefulInfoTab('hub')}
                    className="min-h-[36px] rounded-xl border border-[#E5DAD0] bg-white hover:bg-[#FAF5EF] px-3 py-1.5 text-xs font-extrabold text-[#5E4E45] cursor-pointer shrink-0"
                  >
                    ← {lang === 'th' ? 'หน้ารวม' : 'Back'}
                  </button>
                )}
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#3D322C] truncate">
                    {usefulInfoTab === 'hub' &&
                      (lang === 'th'
                        ? '📋 ตารางเวร กฎบ้าน & ข้อมูลที่เป็นประโยชน์'
                        : '📋 House Schedules, Rules & Useful Info')}
                    {usefulInfoTab === 'staff_roster' &&
                      (lang === 'th'
                        ? '👩‍🏫🚐 ตารางพี่เลี้ยง ไนท์วอช & ตารางขับรถ'
                        : '👩‍🏫🚐 Staff Shift, Night Watch & Driving Roster')}
                    {usefulInfoTab === 'duties' &&
                      (lang === 'th'
                        ? '🧹 ตารางเวรต่างๆ ของบ้าน (14 โซน · ห้องครัว · ทิ้งขยะ)'
                        : '🧹 House Duty Schedules (Weekend · Kitchen · Trash)')}
                    {usefulInfoTab === 'rules_schedule' &&
                      (lang === 'th'
                        ? '📜 กฎบ้าน & ตารางเวลาเปิด–ปิดคำสั่ง'
                        : '📜 House Rules & Command Schedule')}
                    {usefulInfoTab === 'trips' &&
                      (lang === 'th'
                        ? '🗺️ กิจกรรม & สถานที่เที่ยว'
                        : '🗺️ Outings & Activities')}
                    {usefulInfoTab === 'lost_found' &&
                      (lang === 'th'
                        ? '🔎 กระดานของหาย / เก็บของได้'
                        : '🔎 Lost & Found Board')}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#6E5C52] mt-0.5 truncate">
                    {usefulInfoTab === 'hub'
                      ? lang === 'th'
                        ? 'รวมตารางพี่เลี้ยง ตารางเวร กฎบ้าน กิจกรรม และของหายไว้ในปุ่มเดียว'
                        : 'Staff & duty schedules, rules, outings, and lost & found'
                      : lang === 'th'
                      ? `อัปเดตเรียลไทม์ · ขณะนี้เวลา ${formatDigitalClock(now)} น.`
                      : `Live update · ${formatDigitalClock(now)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUsefulInfoOpen(false)}
                className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
              {/* HUB OVERVIEW */}
              {usefulInfoTab === 'hub' && (
                <div className="space-y-4">
                  {/* Helpful House Utilities in One Place */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setUsefulInfoTab('staff_roster')}
                      className="min-h-[64px] rounded-2xl border-2 border-[#BEDBF0] bg-[#F5FAFF] hover:bg-[#EAF4FF] px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">📅</span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[#1D4D73] truncate">
                            {lang === 'th' ? 'ตารางพี่เลี้ยง & ขับรถ' : 'Staff & Driving Roster'}
                          </div>
                          <div className="text-[11px] text-[#456D8F] truncate">
                            {lang === 'th'
                              ? `เวรเช้าวันนี้: ${todayMorningCarerLabel}`
                              : `Today morning: ${todayMorningCarerLabel}`}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#1D4D73] shrink-0">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUsefulInfoTab('duties')}
                      className="min-h-[64px] rounded-2xl border-2 border-[#B3E0DC] bg-[#F0FAF8] hover:bg-[#E0F5F1] px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">🧹</span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[#19534B] truncate">
                            {lang === 'th' ? 'ตารางเวรต่างๆ ของบ้าน' : 'House Duty Schedules'}
                          </div>
                          <div className="text-[11px] text-[#356964] truncate">
                            {lang === 'th'
                              ? 'เวรวันหยุด 14 โซน · ห้องครัว · ทิ้งขยะ'
                              : '14-Zone Weekend · Kitchen · Trash'}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#19534B] shrink-0">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUsefulInfoTab('rules_schedule')}
                      className="min-h-[64px] rounded-2xl border-2 border-[#D4C7EA] bg-[#FAF7FD] hover:bg-[#F2ECFA] px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">📜</span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[#3E2B63] truncate">
                            {lang === 'th' ? 'กฎบ้าน & ขั้นตอนกดระบบ (PIN 0007)' : 'Rules & Check-In Guide (PIN 0007)'}
                          </div>
                          <div className="text-[11px] text-[#5B4782] truncate">
                            {lang === 'th'
                              ? 'สรุปแยกช่วงเช้า · เย็น · ค่ำ + กดรหัส 0007 ดูได้ทันที'
                              : 'Morning · Evening · Night shifts · Dial 0007 anytime'}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#3E2B63] shrink-0">→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUsefulInfoTab('trips')}
                      className="min-h-[64px] rounded-2xl border-2 border-[#C3DFEC] bg-[#F5FBFE] hover:bg-[#E7F4FB] px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">🗺️</span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[#1B4A73] truncate">
                            {lang === 'th' ? 'กิจกรรม & สถานที่เที่ยว' : 'Outings & Trips'}
                          </div>
                          <div className="text-[11px] text-[#456D8F] truncate">
                            {lang === 'th'
                              ? `ทริปที่กำลังเปิด ${appState.trips.length} รายการ`
                              : `${appState.trips.length} upcoming trip(s)`}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#1B4A73] shrink-0">
                        {appState.trips.length} →
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUsefulInfoTab('lost_found')}
                      className="min-h-[64px] rounded-2xl border-2 border-[#EBD8C3] bg-white hover:bg-[#FAF5EF] px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">🔎</span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[#3D322C] truncate">
                            {lang === 'th' ? 'กระดานของหาย / เก็บของได้' : 'Lost & Found Board'}
                          </div>
                          <div className="text-[11px] text-[#7B695F] truncate">
                            {lang === 'th'
                              ? openHomeLostCount > 0
                                ? `รอเจ้าของมารับ ${openHomeLostCount} รายการ`
                                : 'ไม่มีรายการรอรับในตอนนี้'
                              : `${openHomeLostCount} open item(s)`}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#6E5C52] shrink-0">
                        {openHomeLostCount} →
                      </span>
                    </button>
                  </div>

                  <div className="rounded-2xl border border-[#EAE1D8] bg-[#FAF7F3] px-4 py-2.5 text-[11px] text-[#6E5C52]">
                    💡{' '}
                    {lang === 'th'
                      ? 'ข้อมูลส่วนตัวของน้อง (แชทหลังไมค์ คะแนนดาวส่วนตัว บทลงโทษ และโหวตลับ) จะเข้าดูได้เฉพาะหลังล็อกอินด้วย PIN 4 หลักเท่านั้นค่ะ'
                      : 'Private kid info (personal stars, DMs, penalties, and secret votes) remains protected behind your 4-digit PIN.'}
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: STAFF & DRIVING ROSTER */}
              {usefulInfoTab === 'staff_roster' && (
                <StaffRosterPanel
                  now={now}
                  lang={lang}
                  isPublicHolidayToday={isPublicHolidayToday}
                  staffLeaves={appState.staffLeaves ?? []}
                  compactHeader
                />
              )}

              {/* SUB-VIEW 3: KID DUTY SCHEDULES */}
              {usefulInfoTab === 'duties' && (
                <KidDutySchedulesPanel
                  kids={kids}
                  now={now}
                  lang={lang}
                  isPublicHolidayToday={isPublicHolidayToday}
                  compactHeader
                />
              )}

              {/* SUB-VIEW 4: HOUSE RULES & LIVE COMMAND SCHEDULE */}
              {usefulInfoTab === 'rules_schedule' && (
                <div className="space-y-4 text-sm text-[#3D322C] leading-relaxed">
                  <HouseRulesGuideView
                    orgName={organizationName || 'Barnhem Care & Kids'}
                    now={now}
                    lang={lang}
                    settings={appState.settings}
                    compactEmbedded
                  />

                  <div className="rounded-2xl border-2 border-[#B9E8DF] bg-[#F2FCF9] p-4 space-y-2.5">
                    <div className="font-extrabold text-[#114A42]">
                      ⏰ {lang === 'th' ? 'ตารางเวลาเปิด–ปิดคำสั่งหน้าแรก (ตั้งค่าปัจจุบัน)' : 'Live Command Hours'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {effectiveHomeActions.map((act) => {
                        const isOpenNow = isHomeActionOpenAt(act.id, now, appState.settings);
                        return (
                          <div
                            key={`rule-win-${act.id}`}
                            className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
                              isOpenNow
                                ? 'border-[#64CBB9] bg-white text-[#114A42]'
                                : 'border-[#E6DCD2] bg-white/80 text-[#6E5C52]'
                            }`}
                          >
                            <span className="font-bold truncate">
                              {act.emoji} {lang === 'th' ? act.titleTh : act.titleEn}
                            </span>
                            <span className="tabular-nums font-bold shrink-0">
                              {lang === 'th' ? act.windowLabelTh : act.windowLabelEn}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 5: OUTING TRIPS */}
              {usefulInfoTab === 'trips' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#C3DFEC] bg-[#F5FBFE] px-4 py-2.5 text-xs text-[#1B4A73]">
                    💡{' '}
                    {lang === 'th'
                      ? 'น้องสามารถดูรายละเอียดกิจกรรมและพี่เลี้ยงดูแลได้ที่นี่ หากต้องการกดลงชื่อไปด้วย หรือส่งข้อความหลังไมค์ถึงพี่เลี้ยง ให้เข้าสู่ระบบด้วยรหัส PIN 4 หลักก่อนนะคะ'
                      : 'Sign in with your 4-digit PIN to RSVP or send a private question about any trip.'}
                  </div>
                  {appState.trips.length === 0 ? (
                    <p className="text-sm text-[#7B695F] text-center py-6">
                      {lang === 'th' ? 'ยังไม่มีทริปสถานที่เที่ยวในตอนนี้' : 'No trips posted yet.'}
                    </p>
                  ) : (
                    appState.trips.map((trip) => (
                      <div
                        key={trip.id}
                        className="rounded-2xl border-2 border-[#B3E0DC] bg-white p-4 space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-base text-[#3D322C]">
                              🗺️ {trip.title}
                            </div>
                            <div className="text-xs text-[#6E5C52] mt-0.5">
                              📍 {trip.location} · 🗓️ {trip.dateText}
                            </div>
                            <div className="text-xs text-[#6E5C52]">
                              👩‍🏫 {lang === 'th' ? 'พี่เลี้ยงดูแล:' : 'Chaperones:'} {trip.chaperone}
                            </div>
                          </div>
                          <span className="rounded-xl bg-[#D4F0F0] px-3 py-1 text-xs font-extrabold text-[#214F4B]">
                            👥 {lang === 'th' ? `ลงชื่อแล้ว ${trip.attendeeIds.length} คน` : `${trip.attendeeIds.length} going`}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#5E4E45] whitespace-pre-line">
                          {trip.details}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* SUB-VIEW 6: LOST & FOUND BOARD */}
              {usefulInfoTab === 'lost_found' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#F4DB73] bg-[#FFFDF0] px-4 py-2.5 text-xs text-[#6B5412]">
                    💡{' '}
                    {lang === 'th'
                      ? 'หากเห็นของตัวเองในรายการด้านล่าง หรือต้องการโพสต์แจ้งของหาย/เก็บของได้ ให้เข้าสู่ระบบด้วยรหัส PIN 4 หลักของน้องเพื่อกดรับคืนได้เลยค่ะ'
                      : 'Sign in with your 4-digit PIN to post or claim an item.'}
                  </div>
                  {appState.lostFoundItems.length === 0 ? (
                    <p className="text-sm text-[#7B695F] text-center py-6">
                      {lang === 'th' ? 'ยังไม่มีรายการของหายในตอนนี้' : 'No lost & found items.'}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {appState.lostFoundItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[#EBD8C3] bg-white p-3.5 flex items-start gap-3 text-xs"
                        >
                          {item.photoBase64 && (
                            <img
                              src={item.photoBase64}
                              alt={item.title}
                              className="h-14 w-14 rounded-xl object-cover border shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="font-bold text-sm text-[#3D322C]">
                              {item.status === 'claimed'
                                ? '✅ [คืนเจ้าของแล้ว] '
                                : item.status === 'found'
                                ? '✨ [เจอของ] '
                                : '❓ [ตามหา] '}
                              {item.title}
                            </div>
                            <div className="text-[#6E5C52]">
                              📍 {item.locationFound} · โพสต์โดย {item.postedByName}
                            </div>
                            {item.description && item.description !== '-' && (
                              <div className="text-[#53433A]">{item.description}</div>
                            )}
                            {item.claimedByNickname && (
                              <div className="text-[#2F685E] font-bold">
                                🙋‍♀️ {item.claimedByNickname} แสดงตัวรับคืนแล้ว
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Quick Trash Duty Confirmation Modal */}
      {trashConfirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[26px] border-4 border-[#B9E8DF] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#114A42]">
                  🗑️{' '}
                  {trashConfirmTarget.nextDone
                    ? lang === 'th'
                      ? `ยืนยันรหัสหลังทิ้งขยะ · ${trashConfirmTarget.dayLabelTh} (${trashConfirmTarget.displayName})`
                      : `Verify Trash Cleared · ${trashConfirmTarget.dayLabelEn} (${trashConfirmTarget.displayName})`
                    : lang === 'th'
                    ? `แก้ไขสถานะ · ${trashConfirmTarget.dayLabelTh} (${trashConfirmTarget.displayName})`
                    : `Reset Trash Status · ${trashConfirmTarget.dayLabelEn} (${trashConfirmTarget.displayName})`}
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5">
                  {trashConfirmTarget.nextDone
                    ? lang === 'th'
                      ? `กรอกรหัส PIN 4 หลักของ ${trashConfirmTarget.displayName} หรือรหัสพี่เลี้ยง เพื่อยืนยันว่าทิ้งขยะรอบ${trashConfirmTarget.dayLabelTh}เรียบร้อยแล้วค่ะ`
                      : `Enter ${trashConfirmTarget.displayName}'s 4-digit PIN or a staff PIN to mark ${trashConfirmTarget.dayLabelEn} as Cleared.`
                    : lang === 'th'
                    ? `กรอกรหัส PIN 4 หลักของเจ้าของเวรหรือพี่เลี้ยง เพื่อเปลี่ยนสถานะรอบ${trashConfirmTarget.dayLabelTh}กลับเป็น "รอดำเนินการ" ค่ะ`
                    : `Enter the assigned kid 4-digit PIN or a staff PIN to reset ${trashConfirmTarget.dayLabelEn} status.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrashConfirmTarget(null)}
                className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {trashPinGuard.isLocked && (
              <div className="rounded-xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-2 text-xs font-bold text-[#8B1D36] tabular-nums">
                🔒 {formatPinLockoutMessage(trashPinGuard.remainingSec, lang)}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onUpdateKid || !trashConfirmTarget) return;
                if (trashPinGuard.isLocked) {
                  onShowAlert({
                    icon: '🔒',
                    title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
                    message: formatPinLockoutMessage(trashPinGuard.remainingSec, lang),
                    tone: 'pink',
                  });
                  return;
                }
                const clean = trashPinInput.trim();
                const assignedKid = kids.find((k) => k.id === trashConfirmTarget.kidId);
                const staffMatch = members.find(
                  (m) => (m.role === 'staff' || m.role === 'manager') && m.pin === clean
                );
                const creatorMatch = creatorPins.includes(clean);
                const kidMatch = Boolean(assignedKid && assignedKid.pin === clean);

                if (!kidMatch && !staffMatch && !creatorMatch) {
                  const res = trashPinGuard.recordFailure();
                  setTrashPinInput('');
                  onShowAlert({
                    icon: res.lockedNow ? '🔒' : '🔐',
                    title: res.lockedNow
                      ? lang === 'th'
                        ? 'ล็อกชั่วคราว 30 วินาที'
                        : 'Locked for 30 Seconds'
                      : lang === 'th'
                      ? 'รหัส PIN ไม่ถูกต้อง'
                      : 'Incorrect PIN',
                    message: res.lockedNow
                      ? formatPinLockoutMessage(res.lockSec, lang)
                      : `${
                          lang === 'th'
                            ? `กรุณากรอกรหัส PIN ของ ${trashConfirmTarget.displayName} หรือรหัสพี่เลี้ยงค่ะ`
                            : 'Enter assigned kid PIN or staff PIN.'
                        }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
                    tone: 'pink',
                  });
                  return;
                }

                trashPinGuard.recordSuccess();
                const confirmer = creatorMatch
                  ? 'ผู้สร้าง'
                  : staffMatch
                  ? staffMatch.nickname
                  : assignedKid?.nickname ?? trashConfirmTarget.displayName;
                const {
                  kidId,
                  displayName,
                  dateKey: targetDateKey,
                  dayLabelTh,
                  dayLabelEn,
                  nextDone,
                } = trashConfirmTarget;
                const doneIso = nextDone ? now.toISOString() : null;
                onUpdateKid(
                  kidId,
                  (prev) => {
                    const nextByDate: Record<string, TrashDutyDayEntry> = {
                      ...(prev.daily.trashDutyByDate ?? {}),
                      [targetDateKey]: nextDone
                        ? { done: true, doneAt: doneIso, confirmedBy: confirmer }
                        : { done: false, doneAt: null, confirmedBy: null },
                    };
                    const isTargetToday = targetDateKey === todayKey;
                    return {
                      ...prev,
                      daily: {
                        ...prev.daily,
                        dateKey: todayKey,
                        trashDutyByDate: nextByDate,
                        ...(isTargetToday
                          ? {
                              trashDutyDone: nextDone,
                              trashDutyDoneAt: doneIso,
                              trashDutyConfirmedBy: nextDone ? confirmer : null,
                            }
                          : {}),
                      },
                    };
                  },
                  `Home Trash Duty [${targetDateKey}] (${displayName}: ${nextDone ? 'Done' : 'Reset'} by ${confirmer})`
                );
                setTrashConfirmTarget(null);
                setTrashPinInput('');
                const syncNote =
                  !isMainCloudSyncActive && !linkedKidSession && !appState.settings.useOwnStorageOnly
                    ? lang === 'th'
                      ? `\n\n⚠️ หมายเหตุ: เครื่องนี้ยังไม่ได้เชื่อมต่อ Cloud Sync (${MASTER_ADMIN_EMAIL}) สถานะจะบันทึกเฉพาะในเครื่องนี้ ยังไม่เด้งไปเครื่องอื่นค่ะ`
                      : `\n\n⚠️ Note: This device is not connected to Cloud Sync (${MASTER_ADMIN_EMAIL}). Saved locally only.`
                    : cloudSyncError
                    ? lang === 'th'
                      ? '\n\n⚠️ ขณะนี้คลาวด์เชื่อมต่อขัดข้องชั่วคราว ระบบบันทึกในเครื่องไว้แล้ว และจะพยายามซิงค์ให้อัตโนมัติเมื่อออนไลน์ค่ะ'
                      : '\n\n⚠️ Cloud connection issue detected. Saved locally and will retry when online.'
                    : '';
                onShowAlert({
                  icon: nextDone ? '🗑️✅' : '↩️',
                  title: nextDone
                    ? lang === 'th'
                      ? `บันทึกสถานะ${dayLabelTh}แล้ว!`
                      : `${dayLabelEn} Trash Duty Confirmed!`
                    : lang === 'th'
                    ? `อัปเดตสถานะ${dayLabelTh}เป็นรอดำเนินการแล้ว`
                    : `${dayLabelEn} Reset to Pending`,
                  message: `${displayName} · ${lang === 'th' ? dayLabelTh : dayLabelEn} · ${lang === 'th' ? 'โดย' : 'By'} ${confirmer}${syncNote}`,
                  tone: nextDone ? 'mint' : 'yellow',
                });
              }}
              className="flex items-center gap-2"
            >
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                disabled={trashPinGuard.isLocked}
                value={trashPinInput}
                onChange={(e) => setTrashPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={lang === 'th' ? 'PIN 4 หลัก...' : '4-digit PIN...'}
                className="flex-1 rounded-2xl border-2 border-[#B9E8DF] bg-white px-4 py-3 text-center font-mono text-xl font-extrabold tracking-widest text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#64CBB9]"
              />
              <button
                type="submit"
                disabled={trashPinGuard.isLocked}
                className="min-h-[50px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-5 py-3 text-sm font-extrabold cursor-pointer shrink-0 disabled:opacity-50"
              >
                {lang === 'th' ? 'ยืนยัน' : 'Confirm'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Home Staff Work Notification & Leave Modal */}
      {homeStaffWorkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl max-h-[92dvh] flex flex-col rounded-[24px] sm:rounded-[30px] border-4 border-[#B9E8DF] bg-[#FFFDF9] p-4 sm:p-6 pastel-shadow space-y-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold text-[#114A42] truncate">
                  👩‍🏫{' '}
                  {lang === 'th'
                    ? 'สถานะพี่เลี้ยงที่กำลังทำงานอยู่ & แจ้งงาน'
                    : 'Live Staff Duty Status & Handover'}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#6E5C52] mt-0.5 truncate tabular-nums">
                  {lang === 'th'
                    ? `เข้าเวรเวลา ${todayCoverage.timeLabel} น.: ${
                        todayCoverage.onDutyNowNames.length > 0
                          ? todayCoverage.onDutyNowNames.join(', ')
                          : 'ไม่มีผู้เข้าเวร'
                      }`
                    : `On duty at ${todayCoverage.timeLabel}: ${
                        todayCoverage.onDutyNowNames.join(', ') || 'None'
                      }`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHomeStaffWorkOpen(false);
                  setHomeStaffWorkActor(null);
                  setHomeStaffWorkPinInput('');
                }}
                className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {!homeStaffWorkActor ? (
              <div className="space-y-3 overflow-y-auto pr-0.5">
                {/* Public Live Caregiver Working Status */}
                <div className="rounded-2xl border border-[#B9E8DF] bg-white p-3.5 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold text-[#114A42]">
                    <span>
                      🕒 {lang === 'th' ? `กะงานที่กำลังดูแลอยู่ขณะนี้ (${todayCoverage.timeLabel} น.)` : `Active Shifts Now (${todayCoverage.timeLabel})`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setHomeStaffWorkOpen(false);
                        setUsefulInfoTab('staff_roster');
                        setUsefulInfoOpen(true);
                      }}
                      className="text-[11px] font-bold text-[#245A80] hover:underline cursor-pointer"
                    >
                      {lang === 'th' ? 'ดูตารางเวรทั้งหมด →' : 'Full Roster →'}
                    </button>
                  </div>
                  {todayCoverage.activeSlots.length === 0 ? (
                    <p className="text-[#6E5C52]">
                      {lang === 'th' ? 'ไม่มีกะเวรที่เปิดใช้งานในช่วงเวลานี้ค่ะ' : 'No active shift slot right now.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {todayCoverage.activeSlots.map((slot) => (
                        <div
                          key={slot.slotCode}
                          className="rounded-xl border border-[#DCEEE9] bg-[#F7FCFA] px-3 py-2 space-y-0.5"
                        >
                          <div className="font-bold text-[#114A42] tabular-nums">
                            {slot.labelTh} · {slot.timeRange}
                          </div>
                          <div className="text-[#3D322C] font-semibold">
                            {slot.entries
                              .filter((e) => e.status !== 'on_leave')
                              .map((e) =>
                                e.status === 'substitute'
                                  ? `${e.name} (แทน ${e.replacingName})`
                                  : e.name
                              )
                              .join(', ') || (lang === 'th' ? 'ยังไม่มีผู้เข้าเวร' : 'No staff')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                  e.preventDefault();
                  if (homeStaffWorkPinGuard.isLocked) {
                    onShowAlert({
                      icon: '🔒',
                      title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
                      message: formatPinLockoutMessage(homeStaffWorkPinGuard.remainingSec, lang),
                      tone: 'pink',
                    });
                    return;
                  }
                  const clean = homeStaffWorkPinInput.trim();
                  if (!/^\d{4}$/.test(clean)) {
                    onShowAlert({
                      icon: '🔑',
                      title: lang === 'th' ? 'กรุณากรอก PIN 4 หลัก' : '4-Digit PIN Required',
                      message:
                        lang === 'th'
                          ? 'กรุณาใส่รหัส PIN 4 หลักของพี่เลี้ยง ผู้จัดการ หรือผู้สร้างค่ะ'
                          : 'Enter a 4-digit staff, manager, or creator PIN.',
                      tone: 'yellow',
                    });
                    return;
                  }
                  const matchedStaff = members.find(
                    (m) => (m.role === 'staff' || m.role === 'manager') && m.pin === clean
                  );
                  if (matchedStaff) {
                    homeStaffWorkPinGuard.recordSuccess();
                    setHomeStaffWorkActor(matchedStaff.nickname);
                    setHomeStaffWorkPinInput('');
                    return;
                  }
                  if (creatorPins.includes(clean)) {
                    homeStaffWorkPinGuard.recordSuccess();
                    setHomeStaffWorkActor('ผู้สร้าง');
                    setHomeStaffWorkPinInput('');
                    return;
                  }
                  const res = homeStaffWorkPinGuard.recordFailure();
                  setHomeStaffWorkPinInput('');
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
                      : `${
                          lang === 'th'
                            ? 'เฉพาะพี่เลี้ยง ผู้จัดการ หรือผู้สร้างที่เข้าใช้งานได้ค่ะ'
                            : 'Staff, manager, or creator PIN only.'
                        }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
                    tone: 'pink',
                  });
                }}
                className="space-y-3"
              >
                <div className="rounded-2xl border border-[#B9E8DF] bg-[#F2FCF9] p-3.5 text-xs text-[#114A42] space-y-1">
                  <div className="font-bold">
                    🔐 {lang === 'th' ? 'ยืนยันตัวตนพี่เลี้ยงก่อนแจ้งงาน / แจ้งลา' : 'Staff PIN Verification'}
                  </div>
                  <div>
                    {lang === 'th'
                      ? 'ใส่รหัส PIN 4 หลักของพี่เลี้ยง ผู้จัดการ หรือผู้สร้าง เพื่อส่งต่องาน แจ้งลางาน หรือเช็คคนเข้าเวรแทนได้เลยค่ะ'
                      : 'Enter a staff, manager, or creator PIN to submit tasks, leave, or check coverage.'}
                  </div>
                </div>
                {homeStaffWorkPinGuard.isLocked && (
                  <div className="rounded-xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-2 text-xs font-bold text-[#8B1D36] tabular-nums">
                    🔒 {formatPinLockoutMessage(homeStaffWorkPinGuard.remainingSec, lang)}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    autoFocus
                    disabled={homeStaffWorkPinGuard.isLocked}
                    value={homeStaffWorkPinInput}
                    onChange={(e) =>
                      setHomeStaffWorkPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder={lang === 'th' ? 'กรอก PIN พี่เลี้ยง 4 หลัก...' : '4-digit Staff PIN...'}
                    className="flex-1 rounded-2xl border-2 border-[#B9E8DF] bg-white px-4 py-3 text-center font-mono text-xl font-extrabold tracking-widest text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#64CBB9]"
                  />
                  <button
                    type="submit"
                    disabled={homeStaffWorkPinGuard.isLocked}
                    className="min-h-[50px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-5 py-3 text-sm font-extrabold cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {lang === 'th' ? 'เปิดใช้งาน →' : 'Unlock →'}
                  </button>
                </div>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4EFE9]">
                    <button
                      type="button"
                      onClick={() => setHomeStaffWorkTab('tasks')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                        homeStaffWorkTab === 'tasks'
                          ? 'bg-white text-[#114A42] shadow-2xs'
                          : 'text-[#6E5C52] hover:text-[#3D322C]'
                      }`}
                    >
                      📋 {lang === 'th' ? `แจ้งงาน / ฝากงาน (${openStaffWorkCount})` : `Work Notices (${openStaffWorkCount})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHomeStaffWorkTab('leave')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                        homeStaffWorkTab === 'leave'
                          ? 'bg-white text-[#8B1D36] shadow-2xs'
                          : 'text-[#6E5C52] hover:text-[#3D322C]'
                      }`}
                    >
                      🏖️ {lang === 'th' ? `แจ้งลางาน / เช็คเวร (${todayCoverage.leavesForDate.length})` : `Staff Leave (${todayCoverage.leavesForDate.length})`}
                    </button>
                  </div>
                  <span className="text-xs font-bold text-[#6E5C52]">
                    {lang === 'th' ? `ผู้ใช้งาน: ${homeStaffWorkActor}` : `Signed in: ${homeStaffWorkActor}`}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
                  {homeStaffWorkTab === 'tasks' && (
                    <div className="space-y-4">
                      {onAddAnnouncement && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const cleanTitle = staffTaskTitle.trim();
                            if (!cleanTitle) {
                              onShowAlert({
                                icon: '📝',
                                title: lang === 'th' ? 'กรุณากรอกหัวข้องาน' : 'Task Title Required',
                                message:
                                  lang === 'th'
                                    ? 'พิมพ์หัวข้องานที่ต้องการแจ้งพี่เลี้ยงก่อนกดบันทึกค่ะ'
                                    : 'Please enter a work notice title.',
                                tone: 'yellow',
                              });
                              return;
                            }
                            const item: Announcement = {
                              id: `staff_task_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                              title: cleanTitle,
                              body:
                                staffTaskBody.trim() ||
                                (lang === 'th' ? 'แจ้งงานผ่านระบบหน้าแรก' : 'Staff handover notice'),
                              priority: staffTaskUrgent ? 'urgent' : 'normal',
                              pinned: staffTaskUrgent,
                              authorName: homeStaffWorkActor,
                              authorRole: 'Staff',
                              createdAt: now.toISOString(),
                              audience: 'staff_only',
                              assignedTo: staffTaskTarget,
                              taskCompleted: false,
                            };
                            onAddAnnouncement(item);
                            setStaffTaskTitle('');
                            setStaffTaskBody('');
                            setStaffTaskUrgent(false);
                            onShowAlert({
                              icon: '📋✅',
                              title: lang === 'th' ? 'แจ้งงานพี่เลี้ยงแล้ว!' : 'Staff Task Posted!',
                              message: `${item.title} → ${item.assignedTo}`,
                              tone: 'mint',
                            });
                          }}
                          className="rounded-2xl border border-[#B9E8DF] bg-[#F5FCFA] p-4 space-y-2.5 text-xs"
                        >
                          <div className="font-extrabold text-sm text-[#114A42]">
                            ✍️ {lang === 'th' ? 'แจ้งงาน / ส่งต่องานพี่เลี้ยง' : 'Post Staff Work / Handover'}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="space-y-1">
                              <span className="font-bold text-[#2B5850]">
                                {lang === 'th' ? 'แจ้งถึง:' : 'Assign to:'}
                              </span>
                              <select
                                value={staffTaskTarget}
                                onChange={(e) => setStaffTaskTarget(e.target.value)}
                                className="w-full rounded-xl border border-[#B9E2DA] bg-white px-3 py-2 font-bold text-[#3D322C]"
                              >
                                {staffOptionsForWork.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="space-y-1">
                              <span className="font-bold text-[#2B5850]">
                                {lang === 'th' ? 'ระดับความเร่งด่วน:' : 'Priority:'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setStaffTaskUrgent((v) => !v)}
                                className={`w-full rounded-xl border px-3 py-2 font-extrabold cursor-pointer text-left ${
                                  staffTaskUrgent
                                    ? 'border-[#EE9CAF] bg-[#FFE8ED] text-[#8B1D36]'
                                    : 'border-[#B9E2DA] bg-white text-[#2B5850]'
                                }`}
                              >
                                {staffTaskUrgent
                                  ? lang === 'th'
                                    ? '🚨 งานด่วน (ปักหมุดแจ้งเตือน)'
                                    : '🚨 Urgent Task'
                                  : lang === 'th'
                                  ? '📌 งานปกติ (คลิกสลับเป็นด่วน)'
                                  : '📌 Normal Priority'}
                              </button>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={staffTaskTitle}
                            onChange={(e) => setStaffTaskTitle(e.target.value)}
                            placeholder={
                              lang === 'th'
                                ? 'หัวข้องาน เช่น ฝากตรวจยา / รับส่งน้องไปคลินิก / เตรียมรถตู้'
                                : 'Work title...'
                            }
                            className="w-full rounded-xl border border-[#B9E2DA] bg-white px-3 py-2 text-sm text-[#3D322C]"
                          />
                          <textarea
                            rows={2}
                            value={staffTaskBody}
                            onChange={(e) => setStaffTaskBody(e.target.value)}
                            placeholder={
                              lang === 'th'
                                ? 'รายละเอียดเพิ่มเติม (เวลา สถานที่ หรือสิ่งที่ต้องทำต่อ)...'
                                : 'Details, time, notes...'
                            }
                            className="w-full rounded-xl border border-[#B9E2DA] bg-white px-3 py-2 text-xs text-[#3D322C]"
                          />
                          <button
                            type="submit"
                            className="min-h-[42px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-4 py-2 text-xs sm:text-sm font-extrabold cursor-pointer"
                          >
                            📤 {lang === 'th' ? 'ส่งแจ้งงานพี่เลี้ยง' : 'Send Staff Notice'}
                          </button>
                        </form>
                      )}

                      <div className="space-y-2">
                        <div className="text-xs font-extrabold text-[#3D322C]">
                          📋 {lang === 'th' ? `รายการแจ้งงานพี่เลี้ยง (${staffWorkTasks.length})` : `Staff Work List (${staffWorkTasks.length})`}
                        </div>
                        {staffWorkTasks.length === 0 ? (
                          <div className="rounded-2xl border border-[#EFE6DC] bg-white p-4 text-xs text-[#7B695F] text-center">
                            {lang === 'th'
                              ? 'ยังไม่มีรายการแจ้งงานพี่เลี้ยงในตอนนี้ค่ะ'
                              : 'No staff work notices yet.'}
                          </div>
                        ) : (
                          staffWorkTasks.map((task) => {
                            const done = Boolean(task.taskCompleted);
                            return (
                              <div
                                key={task.id}
                                className={`rounded-2xl border p-3.5 text-xs space-y-1.5 ${
                                  done
                                    ? 'border-[#D9E6E1] bg-[#F7FAF9] opacity-80'
                                    : task.priority === 'urgent'
                                    ? 'border-[#F3B7C0] bg-[#FFF2F5]'
                                    : 'border-[#EBD8C3] bg-white'
                                }`}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-extrabold text-sm text-[#3D322C]">
                                      {done ? '✅ ' : task.priority === 'urgent' ? '🚨 ' : '📌 '}
                                      {task.title}
                                    </div>
                                    <div className="text-[11px] text-[#6E5C52] mt-0.5">
                                      {lang === 'th' ? 'ถึง:' : 'To:'} <strong>{task.assignedTo || 'ทีมพี่เลี้ยง'}</strong> ·{' '}
                                      {lang === 'th' ? 'โดย' : 'By'} {task.authorName} ·{' '}
                                      {new Date(task.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {onToggleStaffTaskDone && (
                                      <button
                                        type="button"
                                        onClick={() => onToggleStaffTaskDone(task.id, homeStaffWorkActor)}
                                        className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                                          done
                                            ? 'border-[#D6CEC5] bg-white text-[#5E4E45]'
                                            : 'border-[#8AD9CA] bg-[#E8FAF6] hover:bg-[#D4F3EC] text-[#114A42]'
                                        }`}
                                      >
                                        {done
                                          ? lang === 'th'
                                            ? '↩️ เปิดใหม่'
                                            : 'Reopen'
                                          : lang === 'th'
                                          ? '✓ เสร็จแล้ว'
                                          : '✓ Done'}
                                      </button>
                                    )}
                                    {onDeleteAnnouncement && (
                                      <button
                                        type="button"
                                        onClick={() => onDeleteAnnouncement(task.id)}
                                        className="rounded-xl border border-[#F3C5CE] bg-white hover:bg-[#FFF0F3] px-2.5 py-1 text-[11px] font-bold text-[#8B1D36] cursor-pointer"
                                      >
                                        {lang === 'th' ? 'ลบ' : 'Del'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {task.body && (
                                  <p className="text-xs text-[#4E3F38] whitespace-pre-line">{task.body}</p>
                                )}
                                {done && task.taskCompletedBy && (
                                  <div className="text-[11px] font-bold text-[#146850]">
                                    ✓ {lang === 'th' ? `ทำเสร็จแล้วโดย ${task.taskCompletedBy}` : `Completed by ${task.taskCompletedBy}`}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {homeStaffWorkTab === 'leave' &&
                    onSubmitStaffLeave &&
                    onUpdateLeaveSubstitute &&
                    onAcknowledgeLeave &&
                    onCancelLeave && (
                      <StaffLeavePanel
                        actorName={homeStaffWorkActor}
                        defaultStaffName={homeStaffWorkActor}
                        members={members}
                        staffLeaves={appState.staffLeaves ?? []}
                        now={now}
                        lang={lang}
                        isPublicHolidayToday={isPublicHolidayToday}
                        isLeadership={homeStaffWorkActor === 'ผู้สร้าง'}
                        onSubmitLeave={onSubmitStaffLeave}
                        onUpdateLeaveSubstitute={onUpdateLeaveSubstitute}
                        onAcknowledgeLeave={onAcknowledgeLeave}
                        onCancelLeave={onCancelLeave}
                        onShowAlert={onShowAlert}
                      />
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <PenaltyNoticeModal
        notice={penaltyNoticePopup}
        lang={lang}
        onClose={() => setPenaltyNoticePopup(null)}
      />

      <TimestampCameraModal
        open={timestampCamOpen}
        kids={kids}
        staffPins={staffPins}
        now={now}
        lang={lang}
        orgName={organizationName || 'Barnhem Care & Kids'}
        todayPhotos={todayTimestampPhotos}
        allPhotos={appState.returnHomePhotos ?? []}
        returnHomeDriveUrl={appState.settings.returnHomeDriveUrl}
        syncWebhookUrl={appState.settings.syncWebhookUrl}
        onSavePhoto={(photo) => onSaveReturnHomePhoto?.(photo)}
        onDeletePhoto={onDeleteReturnHomePhoto}
        onClose={() => setTimestampCamOpen(false)}
        onShowAlert={onShowAlert}
      />
    </div>
  );
};
