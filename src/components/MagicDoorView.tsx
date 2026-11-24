import { User } from 'firebase/auth';
import React, { useEffect, useMemo, useState } from 'react';
import {
  CORE_ROSTER_STAFF,
  getShiftCoverageAtDateTime,
  getStaffScheduleForDate,
} from '../data/staffSchedule';
import { signInWithGoogleCloud, signOutCloud } from '../firebase';
import { MASTER_ADMIN_EMAIL } from '../services/firestoreSync';
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
  SickReport,
  StaffLeaveRecord,
  TimedScheduleSlot,
} from '../types/barnhem';
import {
  canKidUseCommand,
  doesKidHavePhone,
  formatCustomCommandWindow,
  formatThaiCurfewClock,
  getCommandAuthMode,
  getCommandAuthModeMeta,
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
import {
  getActiveFestival,
  getAnnouncementScheduleStatus,
  getDynamicTimeEventAnnouncement,
} from '../utils/festivalAndEvents';
import { isKidAwayOnDate } from '../utils/piggyBank';
import {
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
} from '../utils/timeRules';
import { copyTextToClipboard } from '../utils/syncStorage';
import {
  getTrashDutyInfoForDate,
  TRASH_DUTY_RULE_EN,
  TRASH_DUTY_RULE_TH,
} from '../utils/trashDuty';
import { PinPadModal, QrScannerModal } from './CenteredAlertModal';
import { CloudSyncBanner } from './CloudSyncBanner';
import { CommandPermissionsEditorCard } from './CommandPermissionsEditorCard';
import { KidDutySchedulesPanel } from './KidDutySchedulesPanel';
import { StaffLeavePanel } from './StaffLeavePanel';
import { StaffRosterPanel } from './StaffRosterPanel';
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
  onAddSickReport?: (report: SickReport) => void;
  onUpdateKid?: (kidId: string, updater: (prev: Member) => Member, eventLabel: string) => void;
  onSubmitStaffLeave?: (leave: StaffLeaveRecord) => void;
  onUpdateLeaveSubstitute?: (leaveId: string, substituteName: string) => void;
  onAcknowledgeLeave?: (leaveId: string, byName: string) => void;
  onCancelLeave?: (leaveId: string) => void;
  onAddAnnouncement?: (ann: Announcement) => void;
  onDeleteAnnouncement?: (annId: string) => void;
  onToggleStaffTaskDone?: (annId: string, actorName: string) => void;
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
  onAddSickReport,
  onUpdateKid,
  onSubmitStaffLeave,
  onUpdateLeaveSubstitute,
  onAcknowledgeLeave,
  onCancelLeave,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onToggleStaffTaskDone,
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
  const [homeSickOpen, setHomeSickOpen] = useState(false);
  const [homeSickStep, setHomeSickStep] = useState<'pin' | 'pick_kid' | 'form' | 'line_copy'>('pin');
  const [homeSickPinInput, setHomeSickPinInput] = useState('');
  const [homeSickKidId, setHomeSickKidId] = useState<string | null>(null);
  const [homeSickGroupFilter, setHomeSickGroupFilter] = useState<0 | 1 | 2 | 3>(0);
  const [homeSickSymptoms, setHomeSickSymptoms] = useState('มีไข้ / ตัวร้อน');
  const [homeSickDetails, setHomeSickDetails] = useState('');
  const [homeSickLineText, setHomeSickLineText] = useState<string | null>(null);
  const [homeSickLineCopied, setHomeSickLineCopied] = useState(false);
  const [usefulInfoOpen, setUsefulInfoOpen] = useState(false);
  const [usefulInfoTab, setUsefulInfoTab] = useState<
    'hub' | 'announcements' | 'staff_roster' | 'duties' | 'rules_schedule' | 'trips' | 'lost_found'
  >('hub');
  const [homeCommunityTab, setHomeCommunityTab] = useState<
    'announcements' | 'polls' | 'trips' | 'inbox' | 'lost_found' | 'supplies' | 'deeds' | 'sick'
  >('announcements');
  const [homeCommunityCollapsed, setHomeCommunityCollapsed] = useState(false);
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
    nextDone: boolean;
  } | null>(null);
  const [trashPinInput, setTrashPinInput] = useState('');
  const pinGuard = usePinGuard('magic_door');
  const staffBoardPinGuard = usePinGuard('magic_door_staff_board');
  const kidCmdPinGuard = usePinGuard('magic_door_kid_cmd');
  const homeSickPinGuard = usePinGuard('magic_door_sick');
  const homeStaffWorkPinGuard = usePinGuard('magic_door_staff_work');
  const trashPinGuard = usePinGuard('magic_door_trash');

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
  const activeAwaySecretCode = useMemo(
    () => getActiveKidAwaySecretCode(appState.settings, todayKey),
    [appState.settings, todayKey]
  );
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
  const isPublicHolidayToday = Boolean(appState.settings.isPublicHolidayToday);
  const activeFestival = useMemo(
    () => getActiveFestival(now, appState.settings.activeFestivalOverride ?? 'auto'),
    [now, appState.settings.activeFestivalOverride]
  );
  const sortedHomeAnnouncements = useMemo(() => {
    const active = appState.announcements.filter(
      (a) => a.audience !== 'staff_only' && getAnnouncementScheduleStatus(a, now) === 'active'
    );
    return [...active].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [appState.announcements, now]);
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
  const urgentHomeAnnouncementsCount = useMemo(
    () => sortedHomeAnnouncements.filter((a) => a.priority === 'urgent').length,
    [sortedHomeAnnouncements]
  );
  const openHomeLostCount = useMemo(
    () => appState.lostFoundItems.filter((i) => i.status !== 'claimed').length,
    [appState.lostFoundItems]
  );
  const activeHomeSickCount = useMemo(
    () => appState.sickReports.filter((r) => !r.resolved).length,
    [appState.sickReports]
  );
  const openHomePollsCount = useMemo(
    () => appState.polls.filter((p) => !p.closed).length,
    [appState.polls]
  );
  const unreadHomeInboxCount = useMemo(
    () => appState.privateMessages.filter((m) => !m.readByStaff).length,
    [appState.privateMessages]
  );
  const pendingHomeSuppliesCount = useMemo(
    () => appState.supplyRequests.filter((s) => s.status === 'pending').length,
    [appState.supplyRequests]
  );
  const pendingHomeDeedsCount = useMemo(
    () => appState.deedRedemptions.filter((d) => d.status !== 'approved').length,
    [appState.deedRedemptions]
  );
  const homeDynamicEventAnnouncement = useMemo(() => {
    const refKid = kids[0] ?? members[0];
    if (!refKid) return null;
    return getDynamicTimeEventAnnouncement(
      now,
      { ...refKid, group: 2 },
      'เวรดูแลบ้านประจำวัน',
      'Daily House Chore',
      isPublicHolidayToday,
      activeFestival
    );
  }, [now, kids, members, isPublicHolidayToday, activeFestival]);
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
  const boyTrashMember = useMemo(
    () => kids.find((k) => k.id === trashToday.boyAssignee.kidId) ?? null,
    [kids, trashToday.boyAssignee.kidId]
  );
  const girlTrashMember = useMemo(
    () => kids.find((k) => k.id === trashToday.girlAssignee.kidId) ?? null,
    [kids, trashToday.girlAssignee.kidId]
  );
  const boyTrashDone = Boolean(
    boyTrashMember?.daily.dateKey === todayKey && boyTrashMember.daily.trashDutyDone
  );
  const girlTrashDone = Boolean(
    girlTrashMember?.daily.dateKey === todayKey && girlTrashMember.daily.trashDutyDone
  );
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
    } else {
      setActiveCustomCmdId(null);
      setActiveBoardAction(target.actionId);
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

  type PinLoginOutcome = 'logged_in' | 'staff_only_kid_blocked' | 'not_found';

  const resolvePinLogin = (pin: string): PinLoginOutcome => {
    if (pinGuard.isLocked) return 'not_found';
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
            ? 'ช่องกรอก PIN 4 หลักนี้สงวนไว้สำหรับพนักงานและผู้ดูแลทุกคนค่ะ\nน้องๆ กดใช้งานได้ผ่านปุ่ม "📋 คำสั่งเช็คชื่อ & คีย์ลัด" และ "📢 ประกาศ & ข้อมูล" บนหน้านี้ได้เลยค่ะ'
            : 'This 4-digit PIN login is reserved for staff & caregivers. Kids can use Check-In Commands and Notices on this screen.'
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
                    ? 'สงวนสิทธิ์เข้าสู่ระบบสำหรับพนักงาน · น้องๆ กดใช้ปุ่มคำสั่ง & ประกาศได้เลยค่ะ'
                    : 'Staff login only · Kids can use Quick Commands & Notices below'}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              zone: 'boys' as const,
              icon: '👨',
              zoneLabelTh: 'เขตผู้ชาย',
              zoneLabelEn: 'Boys Zone',
              assignee: trashToday.boyAssignee,
              member: boyTrashMember,
              done: boyTrashDone,
              boxCls: boyTrashDone
                ? 'border-[#8AD9CA] bg-[#F1FBF8]'
                : 'border-[#C4DCF0] bg-[#F6FAFF]',
              titleCls: 'text-[#163B59]',
            },
            {
              zone: 'girls' as const,
              icon: '👩',
              zoneLabelTh: 'เขตผู้หญิง',
              zoneLabelEn: 'Girls Zone',
              assignee: trashToday.girlAssignee,
              member: girlTrashMember,
              done: girlTrashDone,
              boxCls: girlTrashDone
                ? 'border-[#8AD9CA] bg-[#F1FBF8]'
                : 'border-[#F3C6D6] bg-[#FFF7FA]',
              titleCls: 'text-[#6E1F3A]',
            },
          ].map((z) => {
            const doneTime = z.member?.daily.trashDutyDoneAt
              ? new Date(z.member.daily.trashDutyDoneAt).toLocaleTimeString(
                  lang === 'th' ? 'th-TH' : 'en-US',
                  { hour: '2-digit', minute: '2-digit' }
                )
              : null;
            return (
              <div
                key={z.zone}
                className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-2.5 ${z.boxCls}`}
              >
                <div className="min-w-0">
                  <div className={`text-xs font-extrabold truncate ${z.titleCls}`}>
                    {z.icon} {lang === 'th' ? z.zoneLabelTh : z.zoneLabelEn}:{' '}
                    {lang === 'th' ? z.assignee.displayNameTh : z.assignee.displayNameEn}
                  </div>
                  <div
                    className={`text-[11px] font-bold mt-0.5 tabular-nums truncate ${
                      z.done
                        ? 'text-[#146850]'
                        : trashToday.isTrashDayToday
                        ? 'text-[#9E3818]'
                        : 'text-[#6E5C52]'
                    }`}
                  >
                    {z.done
                      ? `✅ ${lang === 'th' ? 'ทิ้งขยะแล้ว' : 'Cleared'}${doneTime ? ` · ${doneTime}` : ''}${
                          z.member?.daily.trashDutyConfirmedBy
                            ? ` (${z.member.daily.trashDutyConfirmedBy})`
                            : ''
                        }`
                      : trashToday.isTrashDayToday
                      ? `⏳ ${lang === 'th' ? 'รอทิ้งขยะวันนี้ (เย็น)' : 'Pending today'}`
                      : `🕒 ${lang === 'th' ? 'รอรอบวันพุธ / อาทิตย์' : 'Next Wed / Sun'}`}
                  </div>
                </div>
                {onUpdateKid && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextDone = !z.done;
                      if (linkedKidMember && linkedKidMember.id === z.assignee.kidId) {
                        onUpdateKid(
                          z.assignee.kidId,
                          (prev) => ({
                            ...prev,
                            daily: {
                              ...prev.daily,
                              dateKey: todayKey,
                              trashDutyDone: nextDone,
                              trashDutyDoneAt: nextDone ? now.toISOString() : null,
                              trashDutyConfirmedBy: nextDone ? linkedKidMember.nickname : null,
                            },
                          }),
                          `Home Trash Duty (${z.zone}: ${nextDone ? 'Done' : 'Reset'})`
                        );
                        onShowAlert({
                          icon: nextDone ? '🗑️✅' : '↩️',
                          title: nextDone
                            ? lang === 'th'
                              ? 'บันทึกทิ้งขยะแล้ว!'
                              : 'Trash Cleared!'
                            : lang === 'th'
                            ? 'รีเซ็ตสถานะทิ้งขยะแล้ว'
                            : 'Trash Status Reset',
                          message: `${lang === 'th' ? z.zoneLabelTh : z.zoneLabelEn} (${
                            lang === 'th' ? z.assignee.displayNameTh : z.assignee.displayNameEn
                          })`,
                          tone: nextDone ? 'mint' : 'yellow',
                        });
                        return;
                      }
                      setTrashPinInput('');
                      setTrashConfirmTarget({
                        zone: z.zone,
                        kidId: z.assignee.kidId,
                        displayName:
                          lang === 'th' ? z.assignee.displayNameTh : z.assignee.displayNameEn,
                        nextDone,
                      });
                    }}
                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-[11px] font-extrabold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                      z.done
                        ? 'border-[#C9DDD7] bg-white hover:bg-[#FAF5EF] text-[#5E4E45]'
                        : 'border-[#8AD9CA] bg-white hover:bg-[#E2F7F1] text-[#114A42]'
                    }`}
                  >
                    {z.done
                      ? lang === 'th'
                        ? '↩️ แก้ไข'
                        : 'Undo'
                      : lang === 'th'
                      ? '✓ ทิ้งแล้ว'
                      : '✓ Done'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-[#7B695F]">
          {lang === 'th' ? TRASH_DUTY_RULE_TH : TRASH_DUTY_RULE_EN}
        </div>
        </div>
      </div>

      {/* Home Community Message Hub (Below Trash Duty) + 3 Main Action Buttons */}
      <section
        className="rounded-[24px] border-2 bg-white px-4 py-4 sm:px-5 sm:py-5 pastel-shadow space-y-3.5"
        style={{ borderColor: 'var(--theme-border-alt)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-extrabold text-[#3D322C]">
              💬 {lang === 'th' ? 'ศูนย์ประกาศ · โหวตลับ · ทริปเที่ยว · ของหาย & แจ้งเรื่อง' : 'Notices · Polls · Trips · Lost & Found & Reports'}
            </h3>
            <p className="text-xs text-[#6E5C52] mt-0.5">
              {lang === 'th'
                ? 'รวมประกาศบ้าน ของหาย ทริปเที่ยว พร้อมปุ่มแจ้งเจ็บป่วย และประกาศ & ข้อมูลไว้ในจุดเดียวค่ะ'
                : 'House announcements, lost & found, outings, illness reports, and useful info in one place.'}
            </p>
          </div>

          {/* Action Buttons + Hide/Show Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {onAddSickReport && (
              <button
                type="button"
                onClick={() => {
                  setHomeSickPinInput('');
                  setHomeSickSymptoms('มีไข้ / ตัวร้อน');
                  setHomeSickDetails('');
                  setHomeSickLineText(null);
                  setHomeSickLineCopied(false);
                  setHomeSickGroupFilter(0);
                  if (linkedKidMember) {
                    setHomeSickKidId(linkedKidMember.id);
                    setHomeSickStep('form');
                  } else {
                    setHomeSickKidId(null);
                    setHomeSickStep('pin');
                  }
                  setHomeSickOpen(true);
                }}
                className="min-h-[38px] rounded-xl border border-[#F2B8C3] bg-[#FFF0F3] hover:bg-[#FADADD] px-3 py-1.5 text-xs font-extrabold text-[#8B1D36] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>🤒</span>
                <span>{lang === 'th' ? 'แจ้งเจ็บป่วย / ไม่สบาย' : 'Report Illness'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setUsefulInfoTab('hub');
                setUsefulInfoOpen(true);
              }}
              title={
                lang === 'th'
                  ? 'เปิดดูประกาศบ้าน ตารางพี่เลี้ยง ตารางเวร กฎบ้าน กิจกรรม และของหาย'
                  : 'Announcements, Rosters, Duties, Rules, Trips & Lost/Found'
              }
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#E5D3BA] bg-[#FFFDF9] hover:bg-[#FFF5E4] px-3 py-1.5 text-xs font-bold text-[#5E411D] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>📢</span>
              <span>{lang === 'th' ? 'ประกาศ & ข้อมูล' : 'Notices & Info'}</span>
              <span className="font-extrabold text-[#7A5411] tabular-nums">
                ({sortedHomeAnnouncements.length + 1})
              </span>
              <span className="text-[10px] opacity-75">▾</span>
            </button>

            <button
              type="button"
              onClick={() => setHomeCommunityCollapsed((prev) => !prev)}
              className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                homeCommunityCollapsed
                  ? 'bg-[#EAE4F2] hover:bg-[#DDD3EA] border-[#C8B7EB] text-[#3E2B63]'
                  : 'bg-[#F7F1EB] hover:bg-[#EDE2D7] border-[#E2D4C5] text-[#5C4B42]'
              }`}
            >
              {homeCommunityCollapsed
                ? lang === 'th'
                  ? '👁️ แสดง ▾'
                  : '👁️ Show ▾'
                : lang === 'th'
                ? '🙈 ซ่อน ▴'
                : '🙈 Hide ▴'}
            </button>
          </div>
        </div>

        {!homeCommunityCollapsed && (
          <div className="space-y-3">
            {/* 8-Tab Bar (Kindness removed, Illness Report added in its place) */}
            <div className="flex flex-wrap gap-1.5 rounded-2xl bg-[#F4ECE4] p-1">
              {(
                [
                  {
                    id: 'announcements',
                    th: `📢 ประกาศ (${sortedHomeAnnouncements.length + (homeDynamicEventAnnouncement ? 1 : 0)})`,
                    en: `📢 Notices (${sortedHomeAnnouncements.length + (homeDynamicEventAnnouncement ? 1 : 0)})`,
                  },
                  {
                    id: 'polls',
                    th: `🗳️ โหวตลับ (${openHomePollsCount})`,
                    en: `🗳️ Polls (${openHomePollsCount})`,
                  },
                  {
                    id: 'trips',
                    th: `🗺️ ทริปเที่ยว (${appState.trips.length})`,
                    en: `🗺️ Trips (${appState.trips.length})`,
                  },
                  {
                    id: 'inbox',
                    th: `💌 หลังไมค์ (${unreadHomeInboxCount > 0 ? `${unreadHomeInboxCount} ใหม่` : appState.privateMessages.length})`,
                    en: `💌 Inbox (${unreadHomeInboxCount})`,
                  },
                  {
                    id: 'lost_found',
                    th: `🔎 ของหาย (${openHomeLostCount})`,
                    en: `🔎 Lost & Found (${openHomeLostCount})`,
                  },
                  {
                    id: 'supplies',
                    th: `📦 ขอเบิกของ (${pendingHomeSuppliesCount})`,
                    en: `📦 Supplies (${pendingHomeSuppliesCount})`,
                  },
                  {
                    id: 'deeds',
                    th: `⚖️ ไถ่ค่าปรับ (${pendingHomeDeedsCount})`,
                    en: `⚖️ Fine Deeds (${pendingHomeDeedsCount})`,
                  },
                  {
                    id: 'sick',
                    th: `🤒 แจ้งเจ็บป่วย (${activeHomeSickCount})`,
                    en: `🤒 Illness (${activeHomeSickCount})`,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHomeCommunityTab(item.id)}
                  className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors tabular-nums ${
                    homeCommunityTab === item.id
                      ? 'bg-white text-[#3D322C] shadow-xs'
                      : 'text-[#6E5C52] hover:text-[#3D322C]'
                  }`}
                >
                  {lang === 'th' ? item.th : item.en}
                </button>
              ))}
            </div>

            {/* Tab 1: Announcements */}
            {homeCommunityTab === 'announcements' && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
                {homeDynamicEventAnnouncement && (
                  <div
                    className={`rounded-2xl border p-3.5 space-y-1 ${
                      homeDynamicEventAnnouncement.isFestival
                        ? 'border-[#E6B8D0]'
                        : 'border-[#96C3E6] bg-[#EFF7FF]'
                    }`}
                    style={
                      homeDynamicEventAnnouncement.isFestival && activeFestival
                        ? { background: activeFestival.bannerGradient }
                        : undefined
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#5E4E45]">
                      <span>
                        {lang === 'th'
                          ? homeDynamicEventAnnouncement.badgeTh
                          : homeDynamicEventAnnouncement.badgeEn}
                      </span>
                      <span className="tabular-nums">
                        ⏰{' '}
                        {lang === 'th'
                          ? homeDynamicEventAnnouncement.windowLabelTh
                          : homeDynamicEventAnnouncement.windowLabelEn}
                      </span>
                    </div>
                    <div className="font-extrabold text-sm text-[#3D322C]">
                      {lang === 'th'
                        ? homeDynamicEventAnnouncement.titleTh
                        : homeDynamicEventAnnouncement.titleEn}
                    </div>
                    <p className="text-xs text-[#4E3F38] whitespace-pre-line leading-relaxed">
                      {lang === 'th'
                        ? homeDynamicEventAnnouncement.bodyTh
                        : homeDynamicEventAnnouncement.bodyEn}
                    </p>
                  </div>
                )}

                {sortedHomeAnnouncements.length === 0 ? (
                  <p className="text-xs text-[#7B695F] text-center py-3">
                    {lang === 'th'
                      ? 'ยังไม่มีประกาศเพิ่มเติมจากพี่เลี้ยงในเวลานี้'
                      : 'No additional staff announcements right now.'}
                  </p>
                ) : (
                  sortedHomeAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      className={`rounded-2xl border p-3.5 space-y-1 ${
                        ann.priority === 'urgent'
                          ? 'border-[#F3B7C0] bg-[#FFF4F6]'
                          : 'border-[#F0D999] bg-[#FFFDF2]'
                      }`}
                    >
                      <div className="font-bold text-sm text-[#3D322C]">
                        {ann.pinned ? '📌 ' : ''}
                        {ann.priority === 'urgent' ? '🚨 ' : '📢 '}
                        {ann.title}
                      </div>
                      <p className="text-xs text-[#53433A] whitespace-pre-line leading-relaxed">
                        {ann.body}
                      </p>
                      <div className="text-[11px] text-[#7B695F] tabular-nums">
                        {ann.authorName} ·{' '}
                        {new Date(ann.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Outing Trips */}
            {homeCommunityTab === 'trips' && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
                {appState.trips.length === 0 ? (
                  <p className="text-xs text-[#7B695F] text-center py-4">
                    {lang === 'th' ? 'ยังไม่มีทริปสถานที่เที่ยวในตอนนี้' : 'No upcoming trips posted yet.'}
                  </p>
                ) : (
                  appState.trips.map((trip) => (
                    <div
                      key={trip.id}
                      className="rounded-2xl border border-[#B3E0DC] bg-[#F7FCFB] p-3.5 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-[#3D322C]">
                            🗺️ {trip.title}
                          </div>
                          <div className="text-xs text-[#6E5C52] mt-0.5">
                            📍 {trip.location} · 🗓️ {trip.dateText} · 👩‍🏫 {trip.chaperone}
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-[#19534B] tabular-nums">
                          👥 {lang === 'th' ? `ลงชื่อแล้ว ${trip.attendeeIds.length} คน` : `${trip.attendeeIds.length} going`}
                        </span>
                      </div>
                      <p className="text-xs text-[#5E4E45] whitespace-pre-line">{trip.details}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 5: Lost & Found Board */}
            {homeCommunityTab === 'lost_found' && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
                {appState.lostFoundItems.length === 0 ? (
                  <p className="text-xs text-[#7B695F] text-center py-4">
                    {lang === 'th' ? 'ยังไม่มีรายการของหายในตอนนี้ค่ะ' : 'No lost & found items right now.'}
                  </p>
                ) : (
                  appState.lostFoundItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] p-3.5 flex items-start gap-3 text-xs"
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
                        <div className="text-[#5E4E45]">{item.description}</div>
                        <div className="text-[11px] text-[#7B695F]">
                          📍 {item.locationFound} · {item.postedByName}
                          {item.claimedByNickname ? ` · คืนให้น้อง${item.claimedByNickname} แล้ว` : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 8: Illness Report (Replaced Kindness) */}
            {homeCommunityTab === 'sick' && (
              <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFF7F9] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-xs text-[#5E2832]">
                  <div className="font-extrabold text-sm text-[#8B1D36]">
                    🤒 {lang === 'th' ? 'แจ้งอาการเจ็บป่วย / ไม่สบายด่วน' : 'Quick Illness Report'}
                  </div>
                  <p className="text-[#6E5C52]">
                    {activeHomeSickCount > 0
                      ? lang === 'th'
                        ? `ขณะนี้มีรายการแจ้งป่วยรอติดตามดูแล ${activeHomeSickCount} รายการ · กดปุ่มเพื่อยืนยัน PIN และแจ้งอาการส่งพี่เลี้ยง + ยกเว้นค่าปรับสายวันนี้ค่ะ`
                        : `${activeHomeSickCount} active sick report(s). Tap to verify PIN and submit.`
                      : lang === 'th'
                      ? 'หากน้องมีไข้ ปวดหัว ปวดท้อง หรือไม่สบาย กดปุ่มแจ้งอาการเพื่อส่งแจ้งพี่เลี้ยงและยกเว้นค่าปรับสายวันนี้ทันทีค่ะ'
                      : 'Report fever or symptoms to notify caregivers immediately and waive today’s late fine.'}
                  </p>
                </div>
                {onAddSickReport && (
                  <button
                    type="button"
                    onClick={() => {
                      setHomeSickPinInput('');
                      setHomeSickSymptoms('มีไข้ / ตัวร้อน');
                      setHomeSickDetails('');
                      setHomeSickLineText(null);
                      setHomeSickLineCopied(false);
                      setHomeSickGroupFilter(0);
                      if (linkedKidMember) {
                        setHomeSickKidId(linkedKidMember.id);
                        setHomeSickStep('form');
                      } else {
                        setHomeSickKidId(null);
                        setHomeSickStep('pin');
                      }
                      setHomeSickOpen(true);
                    }}
                    className="min-h-[42px] rounded-2xl bg-[#8B1D36] hover:bg-[#6E1529] text-white px-4 py-2 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    🤒 {lang === 'th' ? 'แจ้งเจ็บป่วย / ไม่สบาย' : 'Report Illness'}
                  </button>
                )}
              </div>
            )}

            {/* Tabs 2, 4, 6, 7: Polls, Inbox, Supplies, Fine Deeds (PIN-protected personal data) */}
            {(homeCommunityTab === 'polls' ||
              homeCommunityTab === 'inbox' ||
              homeCommunityTab === 'supplies' ||
              homeCommunityTab === 'deeds') && (
              <div className="rounded-2xl border border-[#E6DCD2] bg-[#FAF7F3] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-xs text-[#5E4E45]">
                  <div className="font-extrabold text-sm text-[#3D322C]">
                    {homeCommunityTab === 'polls' &&
                      (lang === 'th'
                        ? `🗳️ โหวตลับ (${openHomePollsCount} หัวข้อที่เปิดอยู่)`
                        : `🗳️ Secret Polls (${openHomePollsCount} open)`)}
                    {homeCommunityTab === 'inbox' &&
                      (lang === 'th'
                        ? `💌 กล่องข้อความหลังไมค์ถึงพี่เลี้ยง`
                        : `💌 Private Caretaker Inbox`)}
                    {homeCommunityTab === 'supplies' &&
                      (lang === 'th'
                        ? `📦 ขอเบิกของใช้ส่วนตัว (${pendingHomeSuppliesCount} รอตรวจ)`
                        : `📦 Supply Requests (${pendingHomeSuppliesCount} pending)`)}
                    {homeCommunityTab === 'deeds' &&
                      (lang === 'th'
                        ? `⚖️ กิจกรรมไถ่ค่าปรับด้วยความดี (${pendingHomeDeedsCount} รายการ)`
                        : `⚖️ Good-Deed Fine Redemption (${pendingHomeDeedsCount})`)}
                  </div>
                  <p className="text-[#6E5C52]">
                    {lang === 'th'
                      ? 'เพื่อความเป็นส่วนตัวบนเครื่องใช้รวม ส่วนโหวตลับ หลังไมค์ ขอเบิกของ และไถ่ค่าปรับจะแสดงเฉพาะหลังเข้าสู่ระบบบัญชีส่วนตัวหรือโหมดพนักงานค่ะ'
                      : 'For privacy on shared devices, polls, private inbox, supply requests, and fine redemptions stay behind personal account sign-in.'}
                  </p>
                </div>
                {linkedKidMember && onOpenLinkedKid && (
                  <button
                    type="button"
                    onClick={onOpenLinkedKid}
                    className="min-h-[40px] rounded-xl bg-[#114A42] hover:bg-[#0C3832] text-white px-4 py-2 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {lang === 'th'
                      ? `เปิดหน้าของน้อง${linkedKidMember.nickname} →`
                      : `Open ${linkedKidMember.nickname}'s Page →`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

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

      {/* Home Quick Illness Report Modal (Inserted from Clock & Laundry Box) */}
      {homeSickOpen && (() => {
        const selectedSickKid = homeSickKidId ? kids.find((k) => k.id === homeSickKidId) ?? null : null;
        const canSubmitHomeSickPin = (rawPin: string) => {
          const clean = rawPin.trim();
          if (homeSickPinGuard.isLocked) {
            onShowAlert({
              icon: '🔒',
              title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
              message: formatPinLockoutMessage(homeSickPinGuard.remainingSec, lang),
              tone: 'pink',
            });
            return;
          }
          if (!/^\d{4}$/.test(clean)) {
            onShowAlert({
              icon: '🔑',
              title: lang === 'th' ? 'กรุณากรอกเลข 4 หลัก' : '4-Digit PIN Required',
              message:
                lang === 'th'
                  ? 'กรอกรหัส PIN 4 หลักของน้อง หรือรหัสพี่เลี้ยง/รหัสลับค่ะ'
                  : 'Enter kid 4-digit PIN, staff PIN, or active away code.',
              tone: 'yellow',
            });
            return;
          }
          const matchedKid = kids.find((k) => k.pin === clean);
          if (matchedKid) {
            homeSickPinGuard.recordSuccess();
            setHomeSickPinInput('');
            setHomeSickKidId(matchedKid.id);
            setHomeSickStep('form');
            return;
          }
          if (staffPins.includes(clean) || (activeAwaySecretCode !== null && clean === activeAwaySecretCode)) {
            homeSickPinGuard.recordSuccess();
            setHomeSickPinInput('');
            setHomeSickStep('pick_kid');
            return;
          }
          const res = homeSickPinGuard.recordFailure();
          setHomeSickPinInput('');
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
              : `${lang === 'th' ? 'กรุณากรอก PIN 4 หลักของน้อง หรือรหัสพี่เลี้ยงให้ถูกต้อง' : 'Please check the 4-digit PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
            tone: 'pink',
          });
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#3D322C]/45 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-[28px] border-4 border-[#F5C5CF] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
                <div>
                  <h3 className="text-lg font-extrabold text-[#702D22] flex items-center gap-2">
                    <span>🤒</span>
                    <span>{lang === 'th' ? 'แจ้งอาการเจ็บป่วยด่วน (หน้าแรก)' : 'Quick Illness Report'}</span>
                  </h3>
                  <p className="text-xs text-[#6E5C52] mt-0.5">
                    {lang === 'th'
                      ? 'แจ้งพี่เลี้ยงทันที พร้อมยกเว้นค่าปรับสายวันนี้ให้อัตโนมัติค่ะ'
                      : 'Notifies caregivers immediately and waives today’s late fines.'}
                  </p>
                </div>
                {!(homeSickStep === 'line_copy' && !homeSickLineCopied) && (
                  <button
                    type="button"
                    onClick={() => setHomeSickOpen(false)}
                    className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                )}
              </div>

              {homeSickStep === 'pin' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    canSubmitHomeSickPin(homeSickPinInput);
                  }}
                  className="space-y-3"
                >
                  <div className="rounded-2xl border border-[#F2C9C2] bg-[#FFF8F6] p-3.5 text-xs text-[#702D22] space-y-1">
                    <div className="font-bold">
                      🔐 {lang === 'th' ? 'ยืนยันตัวตนก่อนแจ้งเจ็บป่วย' : 'Verify Identity First'}
                    </div>
                    <div>
                      {lang === 'th'
                        ? activeAwaySecretCode
                          ? 'ใส่รหัส PIN 4 หลักของน้องเอง หรือรหัสพี่เลี้ยง / รหัสลับวันที่พี่เลี้ยงไม่อยู่ได้เลยค่ะ'
                          : 'ใส่รหัส PIN 4 หลักของน้องเอง (เพื่อเข้าแจ้งของตัวเอง) หรือใส่ PIN พี่เลี้ยงเพื่อเลือกชื่อน้องค่ะ'
                        : 'Enter your 4-digit kid PIN or a staff PIN to select a kid.'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      autoFocus
                      value={homeSickPinInput}
                      onChange={(e) => setHomeSickPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder={lang === 'th' ? 'กรอก PIN 4 หลัก...' : '4-digit PIN...'}
                      className="flex-1 rounded-2xl border-2 border-[#F2C9C2] bg-white px-4 py-3 text-center font-mono text-xl font-extrabold tracking-widest text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#E66C84]"
                    />
                    <button
                      type="submit"
                      className="min-h-[50px] rounded-2xl bg-[#8B1D36] hover:bg-[#6E1529] text-white px-5 py-3 text-sm font-extrabold cursor-pointer shrink-0"
                    >
                      {lang === 'th' ? 'ถัดไป →' : 'Next →'}
                    </button>
                  </div>
                </form>
              )}

              {homeSickStep === 'pick_kid' && (
                <div className="space-y-3">
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
                        onClick={() => setHomeSickGroupFilter(tab.g)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          homeSickGroupFilter === tab.g
                            ? 'bg-[#FADADD] border border-[#E66C84] text-[#702D22]'
                            : 'bg-white border border-[#EBD8C3] text-[#6E5C52]'
                        }`}
                      >
                        {lang === 'th' ? tab.th : tab.en}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-0.5">
                    {kids
                      .filter((k) => homeSickGroupFilter === 0 || k.group === homeSickGroupFilter)
                      .map((k) => {
                        const alreadySick = appState.sickReports.some(
                          (r) => r.kidId === k.id && r.dateKey === todayKey && !r.resolved
                        );
                        return (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => {
                              setHomeSickKidId(k.id);
                              setHomeSickStep('form');
                            }}
                            className={`rounded-2xl border-2 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                              alreadySick
                                ? 'border-[#A5DFD4] bg-[#EFFAF7] text-[#19534B]'
                                : 'border-[#F2C9C2] bg-white hover:bg-[#FFF0F3] text-[#3D322C]'
                            }`}
                          >
                            <div className="text-sm font-extrabold truncate">
                              {k.emoji} {k.nickname}
                            </div>
                            <div className="text-[11px] opacity-75">
                              {alreadySick
                                ? lang === 'th'
                                  ? 'แจ้งป่วยวันนี้แล้ว'
                                  : 'Reported Today'
                                : lang === 'th'
                                ? `กลุ่ม ${k.group}`
                                : `Group ${k.group}`}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {homeSickStep === 'form' && selectedSickKid && (
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-[#F5C5CF] bg-[#FADADD]/45 p-3.5 text-xs text-[#5E2832] space-y-1">
                    <div className="font-bold flex items-center justify-between gap-2">
                      <span>
                        🩺 ข้อมูลสุขภาพ & การแพ้ยาของน้อง{selectedSickKid.nickname}
                      </span>
                      <span className="text-[11px] opacity-75">กลุ่ม {selectedSickKid.group}</span>
                    </div>
                    <div>
                      🩸 กรุ๊ปเลือด: <strong>{selectedSickKid.healthProfile?.bloodType ?? 'ไม่ระบุ'}</strong> · 💊 แพ้ยา:{' '}
                      <strong>{selectedSickKid.healthProfile?.drugAllergies ?? 'ไม่มี'}</strong> · 🍽️ แพ้อาหาร:{' '}
                      <strong>{selectedSickKid.healthProfile?.foodAllergies ?? 'ไม่มี'}</strong>
                    </div>
                    {selectedSickKid.healthProfile?.regularMeds &&
                      selectedSickKid.healthProfile.regularMeds !== 'ไม่มี' && (
                        <div>
                          💉 ยาประจำตัว: <strong>{selectedSickKid.healthProfile.regularMeds}</strong>
                        </div>
                      )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {['มีไข้ / ตัวร้อน', 'ปวดหัว / เวียนหัว', 'ปวดท้อง', 'เจ็บคอ / ไอ', 'ปวดเมื่อย / บาดเจ็บ'].map(
                      (sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => setHomeSickSymptoms(sym)}
                          className={`rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-semibold border-2 cursor-pointer ${
                            homeSickSymptoms === sym
                              ? 'bg-[#FADADD] border-[#E66C84] text-[#3D322C]'
                              : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                          }`}
                        >
                          {sym}
                        </button>
                      )
                    )}
                  </div>

                  <textarea
                    rows={3}
                    value={homeSickDetails}
                    onChange={(e) => setHomeSickDetails(e.target.value)}
                    placeholder={
                      lang === 'th'
                        ? 'ระบุอาการเพิ่มเติม เช่น ปวดตั้งแต่เมื่อคืน ต้องการยา...'
                        : 'Additional symptom details...'
                    }
                    className="w-full rounded-2xl border-2 border-[#F3C5AE] bg-white p-3.5 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const cleanDetails = homeSickDetails.trim() || '-';
                      onAddSickReport?.({
                        id: `sick_${Date.now()}`,
                        kidId: selectedSickKid.id,
                        kidNickname: selectedSickKid.nickname,
                        dateKey: todayKey,
                        reportedAt: now.toISOString(),
                        symptoms: homeSickSymptoms,
                        details: cleanDetails,
                        resolved: false,
                      });
                      const lineMsg = [
                        '🚨 [แจ้งอาการเจ็บป่วยด่วน - Barnhem]',
                        `👤 ชื่อเล่น: น้อง${selectedSickKid.nickname} (${selectedSickKid.id.toUpperCase()} | กลุ่ม ${selectedSickKid.group})`,
                        `🤒 อาการ: ${homeSickSymptoms}`,
                        `📝 รายละเอียด: ${cleanDetails}`,
                        `⏰ เวลาที่แจ้ง: ${formatDigitalClock(now)} น. (${todayKey})`,
                        '💚 ระบบยกเว้นค่าปรับสายวันนี้ให้อัตโนมัติแล้วค่ะ',
                      ].join('\n');
                      setHomeSickDetails('');
                      setHomeSickLineCopied(false);
                      setHomeSickLineText(lineMsg);
                      setHomeSickStep('line_copy');
                    }}
                    className="w-full min-h-[50px] rounded-2xl bg-[#3D322C] hover:bg-[#2C241F] text-white font-bold cursor-pointer"
                  >
                    🚑{' '}
                    {lang === 'th'
                      ? 'ส่งแจ้งอาการเจ็บป่วย & สร้างข้อความส่ง LINE'
                      : 'Submit Sick Report & Prepare LINE Alert'}
                  </button>
                </div>
              )}

              {homeSickStep === 'line_copy' && homeSickLineText && (
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-[#E66C84] bg-[#FADADD]/60 p-4 text-sm text-[#6B2D39] space-y-1">
                    <div className="font-bold text-base">
                      🚨{' '}
                      {lang === 'th'
                        ? 'ขั้นตอนสำคัญ (บังคับ): คัดลอกส่งเข้ากลุ่ม LINE ทันที!'
                        : 'Urgent Mandatory Step: Copy for LINE Group!'}
                    </div>
                    <p className="text-xs">
                      {lang === 'th'
                        ? 'กรุณากดปุ่ม "คัดลอกข้อความส่ง LINE" ด้านล่าง แล้วนำไปวาง (Paste) ในกลุ่ม LINE บ้าน Barnhem ก่อนปิดหน้าต่างนี้'
                        : 'Tap Copy below and paste into the Barnhem LINE group before closing.'}
                    </p>
                  </div>

                  <textarea
                    readOnly
                    rows={6}
                    value={homeSickLineText}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded-2xl border-2 border-[#EBD8C3] bg-white p-3.5 text-xs sm:text-sm font-medium text-[#3D322C]"
                  />

                  <button
                    type="button"
                    onClick={async () => {
                      await copyTextToClipboard(homeSickLineText);
                      setHomeSickLineCopied(true);
                    }}
                    className={`w-full min-h-[52px] rounded-2xl font-bold text-sm sm:text-base cursor-pointer transition-colors ${
                      homeSickLineCopied
                        ? 'bg-[#2F685E] text-white'
                        : 'bg-[#C93B4E] hover:bg-[#AE2F40] text-white shadow-md'
                    }`}
                  >
                    {homeSickLineCopied
                      ? lang === 'th'
                        ? '✅ คัดลอกข้อความส่ง LINE สำเร็จแล้ว! กดวางในแชท LINE ได้เลย'
                        : '✅ Copied for LINE! Ready to Paste'
                      : lang === 'th'
                      ? '📋 คัดลอกข้อความแจ้งป่วยส่ง LINE กลุ่มทันที (บังคับกด)'
                      : '📋 Copy Urgent Sick Alert for LINE Now (Required)'}
                  </button>

                  <button
                    type="button"
                    disabled={!homeSickLineCopied}
                    onClick={() => {
                      setHomeSickOpen(false);
                      onShowAlert({
                        icon: '🤒💚',
                        title: lang === 'th' ? 'แจ้งป่วยและคัดลอกส่ง LINE เรียบร้อย!' : 'Sick Alert Complete!',
                        message:
                          lang === 'th'
                            ? 'อย่าลืมกดวางข้อความในกลุ่ม LINE ด้วยนะ พี่เลี้ยงได้รับแจ้งแล้ว และระบบยกเว้นค่าปรับสายวันนี้ให้เรียบร้อย พักผ่อนเยอะๆ นะคนเก่ง'
                            : 'Please paste into LINE group. Late fines are waived today. Rest well!',
                        tone: 'mint',
                      });
                    }}
                    className="w-full min-h-[48px] rounded-2xl bg-[#3D322C] disabled:bg-[#C9BEB5] disabled:cursor-not-allowed text-white font-bold cursor-pointer"
                  >
                    {homeSickLineCopied
                      ? lang === 'th'
                        ? '✓ เสร็จสิ้น & ปิดหน้าต่าง'
                        : '✓ Done & Close'
                      : lang === 'th'
                      ? '🔒 กดปุ่มคัดลอกข้อความส่ง LINE ด้านบนก่อนจึงจะปิดได้'
                      : '🔒 Tap Copy button above to unlock close'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
                    title={
                      lang === 'th'
                        ? 'ตั้งค่าแต่ละปุ่ม: พี่เลี้ยงใส่ PIN / น้องใส่ PIN 4 หลัก / กดชื่อตัวเองได้เลย และสิทธิ์รายคน'
                        : 'Configure per-button PIN/1-Tap mode, eligibility & phones'
                    }
                    aria-label={lang === 'th' ? 'สิทธิ์และรหัสกดแต่ละปุ่ม' : 'Button Access'}
                    className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-xs font-extrabold cursor-pointer transition-transform active:scale-95 ${
                      permissionsEditorOpen
                        ? 'border-[#1B5E52] bg-[#1B5E52] text-white'
                        : 'border-[#9AD8CD] bg-[#E8FAF6] hover:bg-[#D2F4EE] text-[#114A42]'
                    }`}
                  >
                    <span>👥</span>
                    <span>{lang === 'th' ? 'สิทธิ์ & รหัสกด' : 'Access & PIN'}</span>
                  </button>
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
                  {lang === 'th'
                    ? `ขณะนี้ ${formatDigitalClock(now)} น. · กด + เพิ่มคีย์ลัด, ⚙️ ตั้งเวลา หรือ 👥 สิทธิ์ & รหัสกด`
                    : `Time ${formatDigitalClock(now)} · + Add shortcut, ⚙️ Schedule, 👥 Access & PIN`}
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

              {/* Inline '👥' Per-Button Access, Auth Mode & Kid Phone Status Editor */}
              {permissionsEditorOpen && (
                <CommandPermissionsEditorCard
                  members={members}
                  settings={appState.settings}
                  lang={lang}
                  initialTab="buttons"
                  onClose={() => setPermissionsEditorOpen(false)}
                  onSave={(nextNoPhoneIds, nextPerms) => {
                    onSaveCommandPermissions?.(nextNoPhoneIds, nextPerms);
                    setPermissionsEditorOpen(false);
                    onShowAlert({
                      icon: '👥',
                      title: lang === 'th' ? 'บันทึกการตั้งค่าปุ่ม & มือถือแล้ว!' : 'Button Settings Saved!',
                      message:
                        lang === 'th'
                          ? 'อัปเดตรูปแบบการใส่รหัส/กดชื่อเอง สิทธิ์รายคน และสถานะมือถือเรียบร้อยแล้วค่ะ'
                          : 'Button auth mode, kid eligibility, and phone status have been updated everywhere.',
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
                                {cmd.starsDelta && cmd.starsDelta > 0 ? ` · +${cmd.starsDelta} ⭐` : ''} ·{' '}
                                {authMeta.icon} {authMeta.shortLabel}
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
                              ? `${authMeta.icon} ${doneCount}/${eligibleKids.length}`
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
                            ⏰ {lang === 'th' ? action.windowLabelTh : action.windowLabelEn} ·{' '}
                            {authMeta.icon} {authMeta.shortLabel}
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
                          ? `${authMeta.icon} ${doneCount}/${eligibleKids.length}`
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
              ? '🔐 ใส่รหัส PIN พี่เลี้ยง/ผู้ดูแลเพื่อตั้งค่าสิทธิ์ & รหัสกด'
              : '🔐 Staff PIN to Edit Button Access & PIN Mode'
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
            ? lang === 'th'
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
          const isValidKidPin = pin === targetKid.pin;
          const isValidStaffOrAway =
            staffPins.includes(pin) ||
            (activeAwaySecretCode !== null && pin === activeAwaySecretCode);

          if (isValidKidPin || isValidStaffOrAway) {
            kidCmdPinGuard.recordSuccess();
            setPendingKidPinAction(null);
            if (activeCustomCmd) {
              const res = onRunCustomQuickCommand?.(
                activeCustomCmd,
                targetKid.id,
                customSubjectInput
              );
              if (res) setSchoolBoardResult(res);
              return;
            }
            if (modalActionConfig) {
              const res = runHomeAction(modalActionConfig.id, targetKid.id);
              if (res) setSchoolBoardResult(res);
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
                      ? `กรุณาใส่รหัส PIN 4 หลักของน้อง${targetKid.nickname} ค่ะ`
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
        const activeAuthMode = getCommandAuthMode(activePermCmdId, appState.settings);
        const activeAuthMeta = getCommandAuthModeMeta(activeAuthMode, lang);
        const requiresKidPin = activeAuthMode === 'kid_pin' && !boardUnlockedByStaff;
        const eligibleAllCount = kids.filter((k) =>
          canKidUseCommand(activePermCmdId, k, appState.settings)
        ).length;
        const displayedBoardKids = showOnlyEligibleKids
          ? filteredSchoolKids.filter((k) => canKidUseCommand(activePermCmdId, k, appState.settings))
          : filteredSchoolKids;

        const executeBoardCheckInForKid = (targetKid: Member) => {
          if (activeCustomCmd) {
            const res = onRunCustomQuickCommand?.(
              activeCustomCmd,
              targetKid.id,
              customSubjectInput
            );
            if (res) setSchoolBoardResult(res);
            return;
          }
          if (modalActionConfig) {
            const res = runHomeAction(modalActionConfig.id, targetKid.id);
            if (res) setSchoolBoardResult(res);
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
            staffPins.includes(clean) ||
            (activeAwaySecretCode !== null && clean === activeAwaySecretCode)
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

            {(openHomeActions.length + openCustomCommands.length) > 1 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {openCustomCommands.map((cmd) => {
                  const isSelected = activeCustomCmd?.id === cmd.id;
                  const cnt = kids.filter((k) => isCustomCommandDoneForKid(cmd, k, now)).length;
                  const tabMode = getCommandAuthMode(cmd.id, appState.settings);
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
                })}
                {openHomeActions.map((act) => {
                  const isSelected = !activeCustomCmd && modalActionConfig?.id === act.id;
                  const cnt = kids.filter((k) => isHomeActionDoneForKid(act.id, k)).length;
                  const tabMode = getCommandAuthMode(act.id, appState.settings);
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
                  return (
                    <button
                      key={kid.id}
                      type="button"
                      disabled={!canTap}
                      onClick={() => {
                        if (!canTap) return;
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
                <div className="py-10 text-center text-sm text-[#7B695F]">
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
                        ? '📢 ประกาศบ้าน & ข้อมูลที่เป็นประโยชน์'
                        : '📢 House Announcements & Useful Info')}
                    {usefulInfoTab === 'announcements' &&
                      (lang === 'th'
                        ? '📢 ประกาศอัปเดตบ้าน Barnhem'
                        : '📢 Barnhem House Announcements')}
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
                        ? 'รวมประกาศสำคัญ ตารางเวร กฎบ้าน กิจกรรม และของหายไว้ในปุ่มเดียว'
                        : 'House notices, staff & duty schedules, rules, outings, and lost & found'
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
                  {/* Spotlight Top Announcement / Live Notice */}
                  {(() => {
                    const topPinOrUrgent =
                      sortedHomeAnnouncements.find(
                        (a) => a.priority === 'urgent' || a.pinned
                      ) ?? sortedHomeAnnouncements[0];
                    return (
                      <button
                        type="button"
                        onClick={() => setUsefulInfoTab('announcements')}
                        className={`w-full rounded-2xl border-2 p-4 text-left space-y-1.5 cursor-pointer transition-colors ${
                          topPinOrUrgent?.priority === 'urgent'
                            ? 'border-[#F3B7C0] bg-[#FFF2F4] hover:bg-[#FFE6EA]'
                            : 'border-[#F3D86B] bg-[#FFFBEB] hover:bg-[#FFF5CC]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold">
                          <span className="text-[#7A5411]">
                            {topPinOrUrgent
                              ? topPinOrUrgent.priority === 'urgent'
                                ? '🚨 ประกาศด่วนล่าสุด'
                                : '📌 ประกาศปักหมุดล่าสุด'
                              : homeDynamicEventAnnouncement?.badgeTh ?? '📢 ประกาศประจำวัน'}
                          </span>
                          <span className="text-[#5E411D] shrink-0">
                            {lang === 'th'
                              ? `ดูทั้งหมด (${sortedHomeAnnouncements.length + 1}) →`
                              : `View All (${sortedHomeAnnouncements.length + 1}) →`}
                          </span>
                        </div>
                        <div className="font-extrabold text-sm sm:text-base text-[#3D322C]">
                          {topPinOrUrgent
                            ? topPinOrUrgent.title
                            : lang === 'th'
                            ? homeDynamicEventAnnouncement?.titleTh
                            : homeDynamicEventAnnouncement?.titleEn}
                        </div>
                        <p className="text-xs text-[#5E4E45] line-clamp-2 whitespace-pre-line">
                          {topPinOrUrgent
                            ? topPinOrUrgent.body
                            : lang === 'th'
                            ? homeDynamicEventAnnouncement?.bodyTh
                            : homeDynamicEventAnnouncement?.bodyEn}
                        </p>
                      </button>
                    );
                  })()}

                  {/* All Public Announcements & Helpful House Utilities in One Place */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setUsefulInfoTab('announcements')}
                      className="min-h-[64px] rounded-2xl border-2 border-[#F4DB73] bg-[#FFFDF0] hover:bg-[#FFF5BA]/60 px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">📢</span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[#3D322C] truncate">
                            {lang === 'th' ? 'ประกาศบ้าน Barnhem' : 'House Announcements'}
                          </div>
                          <div className="text-[11px] text-[#6E5C52] truncate">
                            {lang === 'th'
                              ? `${sortedHomeAnnouncements.length} ประกาศพี่เลี้ยง · +1 เวลาบ้านตอนนี้`
                              : `${sortedHomeAnnouncements.length} staff notices · Live event`}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#7A5411] shrink-0">
                        {sortedHomeAnnouncements.length + 1} →
                      </span>
                    </button>

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
                            {lang === 'th' ? 'กฎบ้าน & ตารางเวลาคำสั่ง' : 'Rules & Command Hours'}
                          </div>
                          <div className="text-[11px] text-[#5B4782] truncate">
                            {lang === 'th'
                              ? `กติกา 3 กลุ่ม · เส้นตายการบ้าน ${hwCurfewTh}`
                              : `3 Groups · Curfew ${hwCurfewEn}`}
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

              {/* SUB-VIEW 1: HOUSE ANNOUNCEMENTS */}
              {usefulInfoTab === 'announcements' && (
                <div className="space-y-3">
                  {homeDynamicEventAnnouncement && (
                    <div
                      className={`rounded-2xl border-2 p-4 space-y-2 ${
                        homeDynamicEventAnnouncement.isFestival
                          ? 'border-[#E6B8D0]'
                          : 'border-[#96C3E6] bg-[#EFF7FF]'
                      }`}
                      style={
                        homeDynamicEventAnnouncement.isFestival && activeFestival
                          ? { background: activeFestival.bannerGradient }
                          : undefined
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-lg bg-white/85 border border-[#E5DAD0] px-2.5 py-0.5 text-[11px] font-extrabold text-[#3D322C]">
                          {lang === 'th'
                            ? homeDynamicEventAnnouncement.badgeTh
                            : homeDynamicEventAnnouncement.badgeEn}
                        </span>
                        <span className="text-[11px] font-bold text-[#5E4E45]">
                          ⏰{' '}
                          {lang === 'th'
                            ? homeDynamicEventAnnouncement.windowLabelTh
                            : homeDynamicEventAnnouncement.windowLabelEn}
                        </span>
                      </div>
                      <div className="font-extrabold text-base text-[#3D322C]">
                        {lang === 'th'
                          ? homeDynamicEventAnnouncement.titleTh
                          : homeDynamicEventAnnouncement.titleEn}
                      </div>
                      <p className="text-sm text-[#4E3F38] whitespace-pre-line leading-relaxed">
                        {lang === 'th'
                          ? homeDynamicEventAnnouncement.bodyTh
                          : homeDynamicEventAnnouncement.bodyEn}
                      </p>
                    </div>
                  )}

                  {sortedHomeAnnouncements.length === 0 ? (
                    <p className="text-sm text-[#7B695F] text-center py-4">
                      {lang === 'th'
                        ? 'ยังไม่มีประกาศเพิ่มเติมจากพี่เลี้ยงในเวลานี้'
                        : 'No additional staff announcements right now.'}
                    </p>
                  ) : (
                    sortedHomeAnnouncements.map((ann) => (
                      <div
                        key={ann.id}
                        className={`rounded-2xl border-2 p-4 space-y-1.5 ${
                          ann.priority === 'urgent'
                            ? 'border-[#F3B7C0] bg-[#FADADD]/45'
                            : 'border-[#F4DB73] bg-[#FFF5BA]/45'
                        }`}
                      >
                        <div className="font-bold text-base text-[#3D322C]">
                          {ann.pinned ? '📌 ' : ''}
                          {ann.priority === 'urgent' ? '🚨 ' : '📢 '}
                          {ann.title}
                        </div>
                        <p className="text-sm text-[#53433A] whitespace-pre-line leading-relaxed">
                          {ann.body}
                        </p>
                        {(ann.startAt || ann.endAt) && (
                          <div className="text-[11px] font-semibold text-[#456D8F]">
                            🗓️{' '}
                            {ann.startAt
                              ? new Date(ann.startAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')
                              : '—'}{' '}
                            →{' '}
                            {ann.endAt
                              ? new Date(ann.endAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')
                              : '—'}
                          </div>
                        )}
                        <div className="text-xs text-[#7B695F] pt-1">
                          {ann.authorName} ·{' '}
                          {new Date(ann.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                        </div>
                      </div>
                    ))
                  )}
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

                  <div className="rounded-2xl bg-[#FFF5BA]/60 p-4 space-y-1.5 text-xs sm:text-sm">
                    <h4 className="font-extrabold text-sm sm:text-base">
                      🐣 {lang === 'th' ? 'กติกาทีมน้องเล็ก (กลุ่ม 1 ประถม)' : 'Group 1 Rules'}
                    </h4>
                    <p>• กินข้าวเช้าก่อน 06:40 น. (+5 ⭐) และขึ้นรถตู้ไม่เกิน 07:01 น. (+10 ⭐)</p>
                    <p>• กลับบ้าน 16:30 น. จับเวลา Speedy Ninja 20 นาที เรียนเสริมไม่เกิน 16:50 น.</p>
                    <p>• งานบ้าน & ตากชุดนักเรียนก่อน 18:15 น. (+10 ⭐) / ด่านบอส 20:00 น. / เข้านอน 21:00 น.</p>
                  </div>

                  <div className="rounded-2xl bg-[#DCEEF8]/60 p-4 space-y-1.5 text-xs sm:text-sm">
                    <h4 className="font-extrabold text-sm sm:text-base">
                      🌟 {lang === 'th' ? 'กติกาทีมพี่โต (กลุ่ม 2 มัธยม)' : 'Group 2 Rules'}
                    </h4>
                    <p>• จ–ศ: ขอรับมือถือตามรอบเวลา และเช็คชื่อไปโรงเรียนไม่เกิน 07:21 น. (+10 ⭐)</p>
                    <p>• เช้าเสาร์: 08:00–08:30 น. | เช้าอาทิตย์: 08:00–08:15 น. (+15 ⭐)</p>
                    <p>• กลับบ้านเก็บมือถือเข้ากล่อง (+5 ⭐) และเช็คลิสต์ครบ 4 ข้อรับมือถือรอบเย็น 18:30 น.</p>
                    <p>
                      • ขออนุญาตทำการบ้าน ({hwPermWin.labelTh}) ใช้เพิ่มได้ถึง {hwCurfewTh} (หากเกินถือว่ายินยอมงดใช้มือถือวัน Free Day 1 วัน)
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#EAE4F2]/70 p-4 space-y-1.5 text-xs sm:text-sm">
                    <h4 className="font-extrabold text-sm sm:text-base">
                      🎓 {lang === 'th' ? 'กติกาทีมพี่ใหญ่ (กลุ่ม 3 วิทยาลัย / ฝึกงาน)' : 'Group 3 Rules'}
                    </h4>
                    <p>• กะเช้า: เช็คอินไปฝึกงาน/เรียน (+10 ⭐) · กะเย็น: เก็บมือถือเข้าตู้ (+20 ⭐)</p>
                    <p>• กะค่ำ: คืนมือถือเข้าตู้พี่เลี้ยงไม่เกิน Curfew 22:45 น. ทุกวัน</p>
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
                      ? `ยืนยันทิ้งขยะ (${trashConfirmTarget.displayName})`
                      : `Confirm Trash Cleared (${trashConfirmTarget.displayName})`
                    : lang === 'th'
                    ? `แก้ไขสถานะทิ้งขยะ (${trashConfirmTarget.displayName})`
                    : `Reset Trash Status (${trashConfirmTarget.displayName})`}
                </h3>
                <p className="text-xs text-[#6E5C52] mt-0.5">
                  {lang === 'th'
                    ? 'กรอกรหัส PIN 4 หลักของน้องเจ้าของเวร หรือรหัส PIN พี่เลี้ยงค่ะ'
                    : 'Enter the assigned kid 4-digit PIN or a staff PIN.'}
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
                const { kidId, displayName, nextDone } = trashConfirmTarget;
                onUpdateKid(
                  kidId,
                  (prev) => ({
                    ...prev,
                    daily: {
                      ...prev.daily,
                      dateKey: todayKey,
                      trashDutyDone: nextDone,
                      trashDutyDoneAt: nextDone ? now.toISOString() : null,
                      trashDutyConfirmedBy: nextDone ? confirmer : null,
                    },
                  }),
                  `Home Trash Duty (${displayName}: ${nextDone ? 'Done' : 'Reset'} by ${confirmer})`
                );
                setTrashConfirmTarget(null);
                setTrashPinInput('');
                onShowAlert({
                  icon: nextDone ? '🗑️✅' : '↩️',
                  title: nextDone
                    ? lang === 'th'
                      ? 'บันทึกสถานะทิ้งขยะแล้ว!'
                      : 'Trash Duty Confirmed!'
                    : lang === 'th'
                    ? 'อัปเดตสถานะเป็นรอทิ้งขยะแล้ว'
                    : 'Reset to Pending',
                  message: `${displayName} · ${lang === 'th' ? 'โดย' : 'By'} ${confirmer}`,
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
    </div>
  );
};
