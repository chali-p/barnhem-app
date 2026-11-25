import React, { useMemo, useState } from 'react';
import {
  AppSettings,
  CommandAccessRule,
  CommandAuthMode,
  CustomQuickCommand,
  Language,
  LoginCommandType,
  Member,
  ModalAlertPayload,
  TimedScheduleSlot,
} from '../types/barnhem';
import {
  DEFAULT_HOMEWORK_CURFEW_MINS,
  getCommandAuthMode,
  getCommandAuthModeMeta,
  getEffectiveCustomQuickCommands,
  getEffectiveHomeQuickActions,
  getPenaltyPresetMeta,
  getPenaltySummaryText,
  HOME_QUICK_ACTIONS,
  HomeQuickActionId,
  minsToHHMM,
  PENALTY_PRESET_OPTIONS,
} from '../utils/expressKiosk';

interface LoginCommandsSettingsCardProps {
  members: Member[];
  settings: AppSettings;
  lang: Language;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onClose?: () => void;
  initialCreateType?: LoginCommandType | null;
  directModalOnly?: boolean;
}

interface UnifiedLoginCommandItem {
  id: string;
  isCore: boolean;
  emoji: string;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  startMins: number;
  endMins: number;
  earlyGraceMins: number;
  deadlineMins: number;
  rewardStars: number;
  penaltyPreset: string;
  penaltyNote: string;
  commandType: LoginCommandType;
  authMode: CommandAuthMode;
  enabled: boolean;
  eligibleKidIds: string[];
  customKind?: CustomQuickCommand['kind'];
  alwaysOpen?: boolean;
  defaultNote?: string;
}

interface EditorDraftState {
  mode: 'edit' | 'create';
  isCore: boolean;
  targetId?: string;
  customKind: CustomQuickCommand['kind'];
  commandType: LoginCommandType;
  emoji: string;
  titleTh: string;
  descriptionTh: string;
  startHHMM: string;
  earlyGraceMins: number;
  deadlineHHMM: string;
  endHHMM: string;
  authMode: CommandAuthMode;
  rewardStars: number;
  penaltyPreset: string;
  penaltyNote: string;
  allowedKidIds: string[];
  enabled: boolean;
  alwaysOpen: boolean;
  defaultNote: string;
}

const QUICK_EMOJI_CHOICES = [
  '📱',
  '🍚',
  '🚌',
  '🏡',
  '👕',
  '📺',
  '📝',
  '🌙',
  '⚖️',
  '📚',
  '🧹',
  '🚿',
  '⚡',
  '🔔',
  '📵',
  '⏰',
];

function parseHHMMToMins(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return h * 60 + min;
}

function getInitialEligibleKidIds(
  commandId: string,
  kids: Member[],
  settings: Partial<AppSettings>
): string[] {
  const rule = settings.commandPermissions?.[commandId];
  const withoutSet = new Set(settings.kidsWithoutPhoneIds ?? []);
  if (!rule) return kids.map((k) => k.id);
  if (rule.restrictToKidIds && Array.isArray(rule.allowedKidIds)) {
    const allowedSet = new Set(rule.allowedKidIds);
    return kids.filter((k) => allowedSet.has(k.id)).map((k) => k.id);
  }
  if (rule.phoneFilter === 'has_phone') {
    return kids.filter((k) => !withoutSet.has(k.id)).map((k) => k.id);
  }
  if (rule.phoneFilter === 'no_phone') {
    return kids.filter((k) => withoutSet.has(k.id)).map((k) => k.id);
  }
  return kids.map((k) => k.id);
}

function createDefaultDraft(
  initialType: LoginCommandType,
  kids: Member[]
): EditorDraftState {
  const isPenalty = initialType === 'penalty';
  return {
    mode: 'create',
    isCore: false,
    customKind: isPenalty ? 'penalty' : 'custom_checkin',
    commandType: initialType,
    emoji: isPenalty ? '⚖️' : '⚡',
    titleTh: '',
    descriptionTh: isPenalty ? 'บันทึกบทลงโทษทันทีเมื่อกดยืนยัน' : '',
    startHHMM: isPenalty ? '00:00' : '08:00',
    earlyGraceMins: isPenalty ? 0 : 5,
    deadlineHHMM: isPenalty ? '23:59' : '08:30',
    endHHMM: isPenalty ? '23:59' : '09:00',
    authMode: isPenalty ? 'staff_pin' : 'self_tap',
    rewardStars: isPenalty ? 0 : 5,
    penaltyPreset: isPenalty ? 'deduct_free_day' : 'no_fine_zero_stars',
    penaltyNote: isPenalty ? 'หัก Free Day 1 วัน' : 'ไม่ได้ดาวเมื่อเลยเส้นตาย',
    allowedKidIds: kids.map((k) => k.id),
    enabled: true,
    alwaysOpen: false,
    defaultNote: '',
  };
}

export const LoginCommandsSettingsCard: React.FC<LoginCommandsSettingsCardProps> = ({
  members,
  settings,
  lang,
  onUpdateSettings,
  onShowAlert,
  onClose,
  initialCreateType = null,
  directModalOnly = false,
}) => {
  const kids = useMemo(() => members.filter((m) => m.role === 'kid'), [members]);

  const effectiveCoreActions = useMemo(
    () => getEffectiveHomeQuickActions(settings, false),
    [settings]
  );
  const customCommands = useMemo(
    () => getEffectiveCustomQuickCommands(settings),
    [settings]
  );
  const customPenaltyPresets = useMemo(
    () =>
      Array.isArray(settings.customPenaltyPresets)
        ? settings.customPenaltyPresets.filter((x) => typeof x === 'string' && x.trim().length > 0)
        : [],
    [settings.customPenaltyPresets]
  );

  const unifiedCommands = useMemo<UnifiedLoginCommandItem[]>(() => {
    const coreItems: UnifiedLoginCommandItem[] = effectiveCoreActions.map((act) => ({
      id: act.id,
      isCore: true,
      emoji: act.emoji,
      titleTh: act.titleTh,
      titleEn: act.titleEn,
      descriptionTh: act.descriptionTh,
      descriptionEn: act.descriptionEn,
      startMins: act.startMins,
      endMins: act.endMins,
      earlyGraceMins: act.earlyGraceMins,
      deadlineMins: act.deadlineMins,
      rewardStars: act.rewardStars,
      penaltyPreset: act.penaltyPreset,
      penaltyNote: act.penaltyNote,
      commandType: act.commandType,
      authMode: getCommandAuthMode(act.id, settings),
      enabled: act.enabled,
      eligibleKidIds: getInitialEligibleKidIds(act.id, kids, settings),
    }));

    const customItems: UnifiedLoginCommandItem[] = customCommands.map((cmd) => ({
      id: cmd.id,
      isCore: false,
      emoji: cmd.emoji,
      titleTh: cmd.titleTh,
      titleEn: cmd.titleEn,
      descriptionTh:
        cmd.descriptionTh ||
        cmd.defaultNote ||
        (cmd.kind === 'penalty'
          ? 'บันทึกบทลงโทษเพิ่มเติม (ยืนยันแล้วบันทึกผลทันที)'
          : 'คำสั่งเช็คชื่อเพิ่มเติมหน้าแรก'),
      descriptionEn: cmd.descriptionEn || cmd.defaultNote || 'Custom login command.',
      startMins: cmd.alwaysOpen ? 0 : cmd.startMins ?? 0,
      endMins: cmd.alwaysOpen ? 23 * 60 + 59 : cmd.endMins ?? 23 * 60 + 59,
      earlyGraceMins: cmd.earlyGraceMins ?? 0,
      deadlineMins:
        cmd.deadlineMins ?? (cmd.alwaysOpen ? 23 * 60 + 59 : cmd.endMins ?? 23 * 60 + 59),
      rewardStars: cmd.starsDelta ?? 0,
      penaltyPreset:
        cmd.penaltyPreset ?? (cmd.kind === 'penalty' ? 'deduct_free_day' : 'no_fine_zero_stars'),
      penaltyNote:
        cmd.penaltyNote ??
        (cmd.kind === 'penalty' ? 'หัก Free Day 1 วัน' : 'ไม่ได้ดาวเมื่อเลยเส้นตาย'),
      commandType: cmd.kind === 'penalty' ? 'penalty' : 'routine',
      authMode: getCommandAuthMode(cmd.id, settings),
      enabled: cmd.enabled !== false,
      eligibleKidIds: getInitialEligibleKidIds(cmd.id, kids, settings),
      customKind: cmd.kind,
      alwaysOpen: cmd.alwaysOpen,
      defaultNote: cmd.defaultNote,
    }));

    return [...coreItems, ...customItems];
  }, [effectiveCoreActions, customCommands, kids, settings]);

  const [draft, setDraft] = useState<EditorDraftState | null>(() =>
    initialCreateType ? createDefaultDraft(initialCreateType, members.filter((m) => m.role === 'kid')) : null
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingPenaltyText, setAddingPenaltyText] = useState(false);
  const [newPenaltyTextInput, setNewPenaltyTextInput] = useState('');

  const closeDraftModal = () => {
    setDraft(null);
    setShowEmojiPicker(false);
    if (directModalOnly && onClose) {
      onClose();
    }
  };

  const openCreateModal = (initialType: LoginCommandType) => {
    setAddingPenaltyText(false);
    setNewPenaltyTextInput('');
    setShowEmojiPicker(false);
    setDraft(createDefaultDraft(initialType, kids));
  };

  const openEditModal = (item: UnifiedLoginCommandItem) => {
    setAddingPenaltyText(false);
    setNewPenaltyTextInput('');
    setShowEmojiPicker(false);
    setDraft({
      mode: 'edit',
      isCore: item.isCore,
      targetId: item.id,
      customKind:
        item.customKind ?? (item.commandType === 'penalty' ? 'penalty' : 'custom_checkin'),
      commandType: item.commandType,
      emoji: item.emoji,
      titleTh: item.titleTh,
      descriptionTh: item.descriptionTh,
      startHHMM: minsToHHMM(item.startMins),
      earlyGraceMins: item.earlyGraceMins,
      deadlineHHMM: minsToHHMM(item.deadlineMins),
      endHHMM: minsToHHMM(item.endMins),
      authMode: item.authMode,
      rewardStars: item.rewardStars,
      penaltyPreset: item.penaltyPreset,
      penaltyNote: item.penaltyNote,
      allowedKidIds: item.eligibleKidIds,
      enabled: item.enabled,
      alwaysOpen: Boolean(item.alwaysOpen),
      defaultNote: item.defaultNote ?? '',
    });
  };

  const handleToggleItemEnabled = (item: UnifiedLoginCommandItem, nextEnabled: boolean) => {
    if (item.isCore) {
      const existingSchedule = { ...(settings.timedCommandSchedule ?? {}) };
      const prevSlot = existingSchedule[item.id];
      existingSchedule[item.id] = {
        startMins: prevSlot?.startMins ?? item.startMins,
        endMins: prevSlot?.endMins ?? item.endMins,
        earlyGraceMins: prevSlot?.earlyGraceMins ?? item.earlyGraceMins,
        deadlineMins: prevSlot?.deadlineMins ?? item.deadlineMins,
        emoji: prevSlot?.emoji ?? item.emoji,
        titleTh: prevSlot?.titleTh ?? item.titleTh,
        titleEn: prevSlot?.titleEn ?? item.titleEn,
        descriptionTh: prevSlot?.descriptionTh ?? item.descriptionTh,
        descriptionEn: prevSlot?.descriptionEn ?? item.descriptionEn,
        rewardStars: prevSlot?.rewardStars ?? item.rewardStars,
        penaltyPreset: prevSlot?.penaltyPreset ?? item.penaltyPreset,
        penaltyNote: prevSlot?.penaltyNote ?? item.penaltyNote,
        commandType: prevSlot?.commandType ?? item.commandType,
        hidden: prevSlot?.hidden ?? false,
        enabled: nextEnabled,
      };
      onUpdateSettings({ timedCommandSchedule: existingSchedule });
      return;
    }

    const nextCustoms = customCommands.map((c) =>
      c.id === item.id ? { ...c, enabled: nextEnabled } : c
    );
    onUpdateSettings({ customQuickCommands: nextCustoms });
  };

  const handleDeleteItem = (item: UnifiedLoginCommandItem) => {
    onShowAlert({
      icon: '🗑️',
      title:
        lang === 'th'
          ? `ยืนยันลบปุ่ม "${item.titleTh}"?`
          : `Delete "${item.titleEn}"?`,
      message: item.isCore
        ? lang === 'th'
          ? 'ปุ่มนี้จะถูกซ่อนออกจากหน้าล็อคอิน สามารถกด "รีเซ็ตปุ่มมาตรฐาน (9 ปุ่ม)" เพื่อกู้คืนได้ทุกเมื่อค่ะ'
          : 'This button will be hidden from the login screen. Use Reset Standard Buttons to restore anytime.'
        : lang === 'th'
        ? 'ปุ่มคำสั่งที่เพิ่มเองนี้จะถูกลบออกจากหน้าล็อคอินค่ะ'
        : 'This custom command button will be deleted.',
      tone: 'pink',
      confirmLabel: lang === 'th' ? 'ลบปุ่มนี้' : 'Delete',
      onConfirm: () => {
        if (item.isCore) {
          const existingSchedule = { ...(settings.timedCommandSchedule ?? {}) };
          const prevSlot = existingSchedule[item.id];
          existingSchedule[item.id] = {
            ...(prevSlot ?? {}),
            startMins: prevSlot?.startMins ?? item.startMins,
            endMins: prevSlot?.endMins ?? item.endMins,
            enabled: false,
            hidden: true,
          };
          onUpdateSettings({ timedCommandSchedule: existingSchedule });
          return;
        }
        const nextCustoms = customCommands.filter((c) => c.id !== item.id);
        const nextPerms = { ...(settings.commandPermissions ?? {}) };
        delete nextPerms[item.id];
        onUpdateSettings({
          customQuickCommands: nextCustoms,
          commandPermissions: nextPerms,
        });
      },
    });
  };

  const handleResetStandardButtons = () => {
    onShowAlert({
      icon: '🔄',
      title:
        lang === 'th'
          ? 'รีเซ็ตปุ่มมาตรฐานทั้ง 9 ปุ่ม?'
          : 'Reset All 9 Standard Buttons?',
      message:
        lang === 'th'
          ? 'คืนค่าชื่อปุ่ม เวลาเปิด-ปิด กดก่อนเวลา เส้นตาย ดาวรางวัล บทลงโทษ และสิทธิ์การกดของปุ่มมาตรฐานทั้งหมดกลับเป็นค่าเริ่มต้นค่ะ'
          : 'Restore all 9 standard buttons to default schedules, rewards, penalties, and permissions.',
      tone: 'lavender',
      confirmLabel: lang === 'th' ? '🔄 ยืนยันรีเซ็ต (9 ปุ่ม)' : 'Reset 9 Buttons',
      onConfirm: () => {
        const nextSchedule: Record<string, TimedScheduleSlot> = {};
        const nextPerms: Record<string, CommandAccessRule> = {
          ...(settings.commandPermissions ?? {}),
        };
        for (const core of HOME_QUICK_ACTIONS) {
          delete nextPerms[core.id];
        }
        onUpdateSettings({
          timedCommandSchedule: nextSchedule,
          homeworkCurfewMins: DEFAULT_HOMEWORK_CURFEW_MINS,
          commandPermissions: nextPerms,
        });
      },
    });
  };

  const handleAddCustomPenaltyPreset = () => {
    const clean = newPenaltyTextInput.trim().slice(0, 120);
    if (!clean) return;
    const nextPresets = Array.from(new Set([...customPenaltyPresets, clean])).slice(0, 30);
    onUpdateSettings({ customPenaltyPresets: nextPresets });
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            penaltyPreset: clean,
            penaltyNote: clean,
          }
        : prev
    );
    setNewPenaltyTextInput('');
    setAddingPenaltyText(false);
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;

    const cleanTitle = draft.titleTh.trim().slice(0, 60);
    if (!cleanTitle) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'กรุณาระบุชื่อปุ่มคำสั่ง' : 'Button Title Required',
        message:
          lang === 'th'
            ? 'กรุณาพิมพ์ชื่อปุ่มคำสั่งก่อนบันทึกค่ะ'
            : 'Please enter a button name before saving.',
        tone: 'yellow',
      });
      return;
    }

    const startMins = parseHHMMToMins(draft.startHHMM, 6 * 60);
    const endMins = parseHHMMToMins(draft.endHHMM, 23 * 60 + 59);
    const deadlineMins = parseHHMMToMins(draft.deadlineHHMM, endMins);
    const earlyGraceMins = Math.max(0, Math.min(120, Math.round(Number(draft.earlyGraceMins) || 0)));
    const rewardStars =
      draft.commandType === 'penalty'
        ? 0
        : Math.max(0, Math.min(50, Math.round(Number(draft.rewardStars) || 0)));
    const cleanEmoji = draft.emoji.trim() || (draft.commandType === 'penalty' ? '⚖️' : '⚡');
    const cleanDesc = draft.descriptionTh.trim().slice(0, 140);
    const cleanPenaltyNote = draft.penaltyNote.trim().slice(0, 120);

    const allKidIds = kids.map((k) => k.id);
    const selectedSet = new Set(draft.allowedKidIds);
    const isAllKidsSelected =
      allKidIds.length > 0 && allKidIds.every((id) => selectedSet.has(id));

    const nextPermRule: CommandAccessRule = {
      phoneFilter: 'all',
      restrictToKidIds: !isAllKidsSelected,
      allowedKidIds: isAllKidsSelected ? allKidIds : draft.allowedKidIds,
      authMode: draft.authMode,
    };

    if (draft.mode === 'edit' && draft.isCore && draft.targetId) {
      const actionId = draft.targetId as HomeQuickActionId;
      const nextSchedule: Record<string, TimedScheduleSlot> = {
        ...(settings.timedCommandSchedule ?? {}),
        [actionId]: {
          startMins,
          endMins,
          earlyGraceMins,
          deadlineMins,
          emoji: cleanEmoji,
          titleTh: cleanTitle,
          titleEn: cleanTitle,
          descriptionTh: cleanDesc,
          descriptionEn: cleanDesc,
          rewardStars,
          penaltyPreset: draft.penaltyPreset,
          penaltyNote: cleanPenaltyNote,
          commandType: draft.commandType,
          enabled: draft.enabled,
          hidden: false,
        },
      };
      const nextPerms: Record<string, CommandAccessRule> = {
        ...(settings.commandPermissions ?? {}),
        [actionId]: nextPermRule,
      };
      onUpdateSettings({
        timedCommandSchedule: nextSchedule,
        ...(actionId === 'night_return_phone' ? { homeworkCurfewMins: deadlineMins } : {}),
        commandPermissions: nextPerms,
      });
      closeDraftModal();
      return;
    }

    if (draft.mode === 'create' && customCommands.length >= 20) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'เพิ่มคีย์ลัดครบ 20 ปุ่มแล้ว' : 'Custom Limit Reached (20)',
        message:
          lang === 'th'
            ? 'กรุณาลบปุ่มคำสั่งเดิมที่ไม่ใช้แล้วก่อนเพิ่มปุ่มใหม่ค่ะ'
            : 'Please delete an unused custom command before adding more.',
        tone: 'yellow',
      });
      return;
    }

    const cmdId =
      draft.mode === 'edit' && draft.targetId
        ? draft.targetId
        : `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    const builtCustom: CustomQuickCommand = {
      id: cmdId,
      emoji: cleanEmoji,
      titleTh: cleanTitle,
      titleEn: cleanTitle,
      descriptionTh: cleanDesc,
      descriptionEn: cleanDesc,
      kind:
        draft.commandType === 'penalty'
          ? 'penalty'
          : draft.customKind === 'homework_permission'
          ? 'homework_permission'
          : 'custom_checkin',
      alwaysOpen: false,
      startMins,
      endMins,
      earlyGraceMins,
      deadlineMins,
      starsDelta: rewardStars,
      penaltyPreset: draft.penaltyPreset,
      penaltyNote: cleanPenaltyNote,
      enabled: draft.enabled,
      defaultNote: draft.defaultNote || cleanDesc,
    };

    const nextCustoms =
      draft.mode === 'edit'
        ? customCommands.map((c) => (c.id === cmdId ? builtCustom : c))
        : [...customCommands, builtCustom];

    const nextPerms: Record<string, CommandAccessRule> = {
      ...(settings.commandPermissions ?? {}),
      [cmdId]: nextPermRule,
    };

    onUpdateSettings({
      customQuickCommands: nextCustoms.slice(0, 20),
      commandPermissions: nextPerms,
    });
    closeDraftModal();
  };

  return (
    <>
      {!directModalOnly && (
        <section className="no-print rounded-[28px] border-2 border-[#C8B7EB] bg-[#FFFDF9] p-4 sm:p-5 pastel-shadow space-y-4">
        {/* Card Header matching Screenshot 3 */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#3D322C] flex items-center gap-2">
              <span aria-hidden="true">🎛️</span>
              <span>
                {lang === 'th'
                  ? `ตั้งค่าปุ่มคำสั่งหน้าล็อคอิน (${unifiedCommands.length} ปุ่ม)`
                  : `Login Command Buttons (${unifiedCommands.length})`}
              </span>
            </h3>
            <p className="text-xs text-[#6E5C52] mt-0.5">
              {lang === 'th'
                ? 'กำหนดชื่อปุ่ม · รายละเอียด · เวลาเปิด-ปิด · กดก่อนเวลา · เส้นตาย · บทลงโทษ · และเลือกรายชื่อน้องที่มีสิทธิ์กด'
                : 'Configure button labels, descriptions, windows, early grace, deadlines, penalties & eligible kids.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetStandardButtons}
              className="rounded-xl border border-[#DDD0C0] bg-white hover:bg-[#FAF5EF] px-3 py-2 text-xs font-bold text-[#3D322C] cursor-pointer transition-colors"
            >
              🔄 {lang === 'th' ? 'รีเซ็ตปุ่มมาตรฐาน (9 ปุ่ม)' : 'Reset Standard (9)'}
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('penalty')}
              className="rounded-xl border border-[#F3B7C0] bg-[#FFE8EE] hover:bg-[#FFD6E0] px-3.5 py-2 text-xs font-extrabold text-[#7D1D36] cursor-pointer transition-colors"
            >
              + ⚖️ {lang === 'th' ? 'เพิ่มปุ่มบทลงโทษ' : 'Add Penalty Button'}
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('routine')}
              className="rounded-xl border border-[#7ED3C0] bg-[#D9F6EE] hover:bg-[#C3EFE3] px-3.5 py-2 text-xs font-extrabold text-[#0F4C42] cursor-pointer transition-colors"
            >
              + {lang === 'th' ? 'เพิ่มปุ่มคำสั่งใหม่' : 'Add New Command'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="h-9 w-9 rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer flex items-center justify-center shrink-0"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Grid of Command Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {unifiedCommands.map((item) => {
            const isPenalty = item.commandType === 'penalty';
            const authMeta = getCommandAuthModeMeta(item.authMode, lang);
            const penaltySummary = getPenaltySummaryText(
              item.penaltyPreset,
              item.penaltyNote,
              lang
            );
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3.5 sm:p-4 space-y-1.5 transition-all ${
                  isPenalty
                    ? 'border-[#F0B8C3] bg-[#FFF8FA]'
                    : 'border-[#E7DACB] bg-white'
                } ${!item.enabled ? 'opacity-65' : ''}`}
              >
                {/* Row 1: Title + Badges + Controls */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-base shrink-0">{item.emoji}</span>
                    <span className="text-sm font-extrabold text-[#3D322C] truncate">
                      {lang === 'th' ? item.titleTh : item.titleEn}
                    </span>
                    {isPenalty && (
                      <span className="rounded-full bg-[#FFE4EC] border border-[#F3B7C0] px-2 py-0.5 text-[10px] font-extrabold text-[#8B1D36] shrink-0">
                        {lang === 'th' ? 'บทลงโทษ' : 'Penalty'}
                      </span>
                    )}
                    <span className="rounded-full bg-[#FFF2C2] border border-[#F0D983] px-2 py-0.5 text-[10px] font-extrabold text-[#6E4F05] shrink-0 tabular-nums">
                      👥 ({item.eligibleKidIds.length}/{kids.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <label className="inline-flex items-center gap-1 text-xs font-extrabold text-[#3D322C] cursor-pointer select-none mr-1">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => handleToggleItemEnabled(item, e.target.checked)}
                        className="h-4 w-4 accent-[#2F2824] rounded cursor-pointer"
                      />
                      <span>{lang === 'th' ? 'เปิด' : 'On'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="rounded-lg border border-[#BBDDF2] bg-[#E8F4FC] hover:bg-[#D5ECFA] px-2.5 py-1 text-[11px] font-extrabold text-[#1F4E78] cursor-pointer transition-colors"
                    >
                      ✏️ {lang === 'th' ? 'แก้ไข' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      title={lang === 'th' ? 'ลบปุ่มนี้' : 'Delete'}
                      className="rounded-lg border border-[#F3C5CE] bg-[#FFEFF3] hover:bg-[#FADADD] px-2 py-1 text-[11px] font-bold text-[#8B1D36] cursor-pointer transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Row 2: Description */}
                {item.descriptionTh && (
                  <p className="text-xs text-[#6E5C52] leading-snug">
                    {lang === 'th' ? item.descriptionTh : item.descriptionEn}
                  </p>
                )}

                {/* Row 3: Timing details */}
                <div className="text-[11px] text-[#6E5C52] tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5">
                  <span>
                    ⏰ {minsToHHMM(item.startMins)}–{minsToHHMM(item.endMins)}{' '}
                    {lang === 'th' ? 'น.' : ''}
                  </span>
                  <span>·</span>
                  <span>
                    {lang === 'th'
                      ? `กดก่อนเวลา ${item.earlyGraceMins} น.`
                      : `Early ${item.earlyGraceMins}m`}
                  </span>
                  <span>·</span>
                  <span className="font-extrabold text-[#9D174D]">
                    {lang === 'th'
                      ? `เส้นตาย ${minsToHHMM(item.deadlineMins)} น.`
                      : `Deadline ${minsToHHMM(item.deadlineMins)}`}
                  </span>
                </div>

                {/* Row 4: Auth mode + Reward + Penalty summary */}
                <div className="text-[11px] text-[#5E4E45] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="font-semibold">
                    {authMeta.icon} {authMeta.shortLabel}
                  </span>
                  {!isPenalty && item.rewardStars > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-bold text-[#8B5E00]">+{item.rewardStars} ⭐</span>
                    </>
                  )}
                  <span>·</span>
                  <span
                    className={
                      isPenalty
                        ? 'font-bold text-[#9D174D]'
                        : 'text-[#6E5C52]'
                    }
                  >
                    {penaltySummary}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        </section>
      )}

      {/* Add / Edit Command Button Modal matching Screenshots 1 & 2 */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={closeDraftModal}
        >
          <form
            onSubmit={handleSaveDraft}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-[28px] border-2 border-[#E6D5C3] bg-[#FFFDF9] shadow-2xl overflow-hidden"
          >
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* 1. Command Type Toggle */}
              <div className="rounded-2xl border border-[#EADCCB] bg-white p-3.5 space-y-2">
                <div className="text-xs font-extrabold text-[#3D322C]">
                  {lang === 'th' ? 'ประเภทปุ่มคำสั่ง' : 'Command Button Type'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              commandType: 'routine',
                              customKind:
                                prev.customKind === 'homework_permission'
                                  ? 'homework_permission'
                                  : 'custom_checkin',
                              rewardStars: prev.rewardStars || 5,
                            }
                          : prev
                      )
                    }
                    className={`rounded-xl border-2 px-3.5 py-2.5 text-xs font-extrabold text-left flex items-center gap-2 cursor-pointer transition-colors ${
                      draft.commandType === 'routine'
                        ? 'border-[#6ECAB6] bg-[#E3F8F3] text-[#0F4C42]'
                        : 'border-[#EAE0D5] bg-[#FAF7F2] text-[#7B695F] hover:bg-[#F3ECE3]'
                    }`}
                  >
                    <span>✅</span>
                    <span>
                      {lang === 'th'
                        ? 'คำสั่งกิจวัตร (เช็คอิน / รับดาว)'
                        : 'Routine Check-In (+Stars)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              commandType: 'penalty',
                              customKind: 'penalty',
                              rewardStars: 0,
                              authMode: 'staff_pin',
                              penaltyPreset:
                                prev.penaltyPreset === 'lock_after_deadline' ||
                                prev.penaltyPreset === 'no_fine_zero_stars'
                                  ? 'deduct_free_day'
                                  : prev.penaltyPreset,
                              penaltyNote:
                                prev.penaltyPreset === 'lock_after_deadline' ||
                                prev.penaltyPreset === 'no_fine_zero_stars'
                                  ? 'หัก Free Day 1 วัน'
                                  : prev.penaltyNote,
                            }
                          : prev
                      )
                    }
                    className={`rounded-xl border-2 px-3.5 py-2.5 text-xs font-extrabold text-left flex items-center gap-2 cursor-pointer transition-colors ${
                      draft.commandType === 'penalty'
                        ? 'border-[#F0A8B8] bg-[#FFE9EE] text-[#8B1D36]'
                        : 'border-[#EAE0D5] bg-[#FAF7F2] text-[#7B695F] hover:bg-[#F3ECE3]'
                    }`}
                  >
                    <span>⚖️</span>
                    <span>
                      {lang === 'th'
                        ? 'ปุ่มบทลงโทษ (บันทึกโทษทันทีเมื่อกด)'
                        : 'Penalty Button (Record Immediately)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. Emoji + Title + Description */}
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4 sm:col-span-3 space-y-1 relative">
                    <label className="block text-xs font-extrabold text-[#3D322C]">
                      {lang === 'th' ? 'อีโมจิ' : 'Emoji'}
                    </label>
                    <div className="flex items-center rounded-xl border border-[#DFD2C3] bg-white overflow-hidden focus-within:border-[#7CC6B8]">
                      <input
                        type="text"
                        value={draft.emoji}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, emoji: e.target.value.slice(0, 6) } : prev
                          )
                        }
                        className="w-full px-2 py-2.5 text-center text-lg bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((v) => !v)}
                        title={lang === 'th' ? 'เลือกอีโมจิด่วน' : 'Pick emoji'}
                        className="px-2 py-2.5 text-[11px] font-bold text-[#7B695F] hover:text-[#3D322C] hover:bg-[#FAF5EF] cursor-pointer shrink-0 border-l border-[#EFE5D9]"
                      >
                        ▾
                      </button>
                    </div>
                    {showEmojiPicker && (
                      <div className="absolute left-0 top-full mt-1.5 z-20 w-56 rounded-2xl border border-[#DFD2C3] bg-white p-2 shadow-xl grid grid-cols-8 gap-1">
                        {QUICK_EMOJI_CHOICES.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => {
                              setDraft((prev) => (prev ? { ...prev, emoji: em } : prev));
                              setShowEmojiPicker(false);
                            }}
                            className={`h-6 w-6 rounded-md text-sm flex items-center justify-center cursor-pointer transition-colors ${
                              draft.emoji === em
                                ? 'bg-[#D9F6EE] border border-[#6ECAB6]'
                                : 'hover:bg-[#FAF5EF]'
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-8 sm:col-span-9 space-y-1">
                    <label className="block text-xs font-extrabold text-[#3D322C]">
                      {lang === 'th' ? 'ชื่อปุ่มคำสั่ง *' : 'Button Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={draft.titleTh}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, titleTh: e.target.value } : prev))
                      }
                      placeholder={lang === 'th' ? 'เช่น มาขอรับมือถือ' : 'e.g., Morning Phone Pickup'}
                      className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm font-bold text-[#3D322C] focus:outline-none focus:border-[#7CC6B8]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-[#3D322C]">
                    {lang === 'th' ? 'รายละเอียดปุ่ม' : 'Description'}
                  </label>
                  <input
                    type="text"
                    value={draft.descriptionTh}
                    onChange={(e) =>
                      setDraft((prev) => (prev ? { ...prev, descriptionTh: e.target.value } : prev))
                    }
                    placeholder={
                      lang === 'th'
                        ? 'เช่น เช็คอินรับมือถือช่วงเช้าก่อนไปโรงเรียน / ฝึกงาน'
                        : 'Brief description shown on Creator dashboard'
                    }
                    className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#3D322C] focus:outline-none focus:border-[#7CC6B8]"
                  />
                </div>
              </div>

              {/* 3. 4-Column Time Box */}
              <div className="rounded-2xl border border-[#EADCCB] bg-white p-3.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-[#3D322C]">
                      {lang === 'th' ? 'เวลาเริ่มเปิด' : 'Open Time'}
                    </label>
                    <input
                      type="time"
                      value={draft.startHHMM}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, startHHMM: e.target.value } : prev))
                      }
                      className="w-full rounded-xl border border-[#DFD2C3] bg-[#FFFDF9] px-2.5 py-2 text-xs font-extrabold tabular-nums text-[#3D322C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-[#3D322C]">
                      {lang === 'th' ? 'กดก่อนเวลา (นาที)' : 'Early Grace (min)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={draft.earlyGraceMins}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, earlyGraceMins: Number(e.target.value) } : prev
                        )
                      }
                      className="w-full rounded-xl border-2 border-[#A8D5EE] bg-white px-3 py-2 text-xs font-extrabold tabular-nums text-[#3D322C] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-[#9D174D]">
                      {lang === 'th' ? 'เส้นตายห้ามเกินเวลา' : 'Deadline'}
                    </label>
                    <input
                      type="time"
                      value={draft.deadlineHHMM}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, deadlineHHMM: e.target.value } : prev))
                      }
                      className="w-full rounded-xl border-2 border-[#E7B5C2] bg-[#FFF9FB] px-2.5 py-2 text-xs font-extrabold tabular-nums text-[#3D322C]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-[#3D322C]">
                      {lang === 'th' ? 'เวลาปิดปุ่ม' : 'Close Time'}
                    </label>
                    <input
                      type="time"
                      value={draft.endHHMM}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, endHHMM: e.target.value } : prev))
                      }
                      className="w-full rounded-xl border border-[#DFD2C3] bg-[#FFFDF9] px-2.5 py-2 text-xs font-extrabold tabular-nums text-[#3D322C]"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Verification Mode & Reward Stars */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7 space-y-1">
                  <label className="block text-xs font-extrabold text-[#3D322C]">
                    {lang === 'th' ? 'รูปแบบการยืนยันปุ่ม' : 'Verification Mode'}
                  </label>
                  <select
                    value={draft.authMode}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, authMode: e.target.value as CommandAuthMode } : prev
                      )
                    }
                    className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-[#3D322C]"
                  >
                    <option value="self_tap">
                      👆 {lang === 'th' ? 'กดชื่อได้เลย (ไม่ต้องใส่ PIN)' : 'Direct Name Tap (No PIN)'}
                    </option>
                    <option value="kid_pin">
                      🔑 {lang === 'th' ? 'น้องใส่ PIN เอง (4 หลัก)' : 'Kid Enters 4-Digit PIN'}
                    </option>
                    <option value="staff_pin">
                      🔐 {lang === 'th' ? 'พี่เลี้ยงใส่ PIN ยืนยัน' : 'Staff PIN Required'}
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-5 space-y-1">
                  <label className="block text-xs font-extrabold text-[#3D322C]">
                    {lang === 'th' ? 'ดาวรางวัลเมื่อกดตรงเวลา (⭐)' : 'On-Time Star Reward (⭐)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    disabled={draft.commandType === 'penalty'}
                    value={draft.commandType === 'penalty' ? 0 : draft.rewardStars}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev ? { ...prev, rewardStars: Number(e.target.value) } : prev
                      )
                    }
                    className="w-full rounded-xl border-2 border-[#E6D16C] bg-white px-3 py-2 text-sm font-extrabold tabular-nums text-[#3D322C] disabled:bg-[#F5F1EB] disabled:text-[#9B8D84]"
                  />
                </div>
              </div>

              {/* 5. Penalty Condition Section (Pink Border Card) */}
              <div className="rounded-2xl border border-[#F0B8C3] bg-[#FFF8FA] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-[#9D174D]">
                    {draft.commandType === 'penalty'
                      ? lang === 'th'
                        ? 'เงื่อนไขบทลงโทษเมื่อกดปุ่มนี้'
                        : 'Penalty Action When Pressed'
                      : lang === 'th'
                      ? 'เงื่อนไขบทลงโทษเมื่อเกินเส้นตาย'
                      : 'Penalty Rule Past Deadline'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingPenaltyText(true);
                      setNewPenaltyTextInput('');
                    }}
                    className="rounded-xl border border-[#DFC7CD] bg-white hover:bg-[#FFF0F4] px-3 py-1.5 text-[11px] font-extrabold text-[#3D322C] cursor-pointer transition-colors"
                  >
                    + {lang === 'th' ? 'เพิ่มข้อความคำสั่งในช่องนี้' : 'Add Custom Option Here'}
                  </button>
                </div>

                <select
                  value={draft.penaltyPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__add_new__') {
                      setAddingPenaltyText(true);
                      setNewPenaltyTextInput('');
                      return;
                    }
                    const presetMeta = getPenaltyPresetMeta(val);
                    const nextNote = presetMeta
                      ? lang === 'th'
                        ? presetMeta.defaultNoteTh
                        : presetMeta.defaultNoteEn
                      : val;
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            penaltyPreset: val,
                            penaltyNote: nextNote,
                          }
                        : prev
                    );
                  }}
                  className="w-full rounded-xl border-2 border-[#3D322C]/75 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold text-[#3D322C]"
                >
                  {PENALTY_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.emoji} {lang === 'th' ? opt.labelTh : opt.labelEn}
                    </option>
                  ))}
                  {customPenaltyPresets.map((customText) => (
                    <option key={`custom-${customText}`} value={customText}>
                      ✨ {customText}
                    </option>
                  ))}
                  <option value="__add_new__">
                    ➕ {lang === 'th' ? 'เพิ่มข้อความคำสั่งใหม่...' : 'Add new command text...'}
                  </option>
                </select>

                {addingPenaltyText && (
                  <div className="rounded-xl border border-[#E7B5C2] bg-white p-2.5 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newPenaltyTextInput}
                      onChange={(e) => setNewPenaltyTextInput(e.target.value)}
                      placeholder={
                        lang === 'th'
                          ? 'พิมพ์ข้อความบทลงโทษใหม่ เช่น งดดูทีวี 1 วัน...'
                          : 'Enter custom penalty option...'
                      }
                      className="flex-1 min-w-[180px] rounded-lg border border-[#DFD2C3] px-3 py-1.5 text-xs text-[#3D322C] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPenaltyPreset}
                      className="rounded-lg bg-[#8B1D36] hover:bg-[#6E162A] text-white px-3 py-1.5 text-xs font-extrabold cursor-pointer"
                    >
                      {lang === 'th' ? 'เพิ่มข้อความ' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingPenaltyText(false)}
                      className="rounded-lg border border-[#DDD0C0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#6E5C52] cursor-pointer"
                    >
                      {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[11px] font-extrabold text-[#3D322C]">
                    {lang === 'th' ? 'ข้อความอธิบายบทลงโทษ' : 'Penalty Description'}
                  </label>
                  <input
                    type="text"
                    value={draft.penaltyNote}
                    onChange={(e) =>
                      setDraft((prev) => (prev ? { ...prev, penaltyNote: e.target.value } : prev))
                    }
                    placeholder={lang === 'th' ? 'เช่น ล็อกเมื่อเลย 07:00 น.' : 'Penalty summary text'}
                    className="w-full rounded-xl border border-[#E6CFD4] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#3D322C] focus:outline-none"
                  />
                </div>
              </div>

              {/* 6. Kid Eligibility Picker */}
              <div className="rounded-2xl border border-[#EADCCB] bg-white p-3.5 space-y-2.5">
                <div className="text-xs font-extrabold text-[#3D322C]">
                  👥{' '}
                  {lang === 'th'
                    ? `เลือกรายชื่อน้องที่มีสิทธิ์กดปุ่มนี้ (${draft.allowedKidIds.length}/${kids.length} คน)`
                    : `Select Eligible Kids (${draft.allowedKidIds.length}/${kids.length})`}
                </div>

                {/* Quick Group Selector Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: lang === 'th' ? 'ทั้งหมด' : 'All',
                      onClick: () =>
                        setDraft((prev) =>
                          prev ? { ...prev, allowedKidIds: kids.map((k) => k.id) } : prev
                        ),
                    },
                    {
                      label: lang === 'th' ? 'กลุ่ม 1' : 'Group 1',
                      onClick: () =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                allowedKidIds: kids
                                  .filter((k) => k.group === 1)
                                  .map((k) => k.id),
                              }
                            : prev
                        ),
                    },
                    {
                      label: lang === 'th' ? 'กลุ่ม 2' : 'Group 2',
                      onClick: () =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                allowedKidIds: kids
                                  .filter((k) => k.group === 2)
                                  .map((k) => k.id),
                              }
                            : prev
                        ),
                    },
                    {
                      label: lang === 'th' ? 'กลุ่ม 3' : 'Group 3',
                      onClick: () =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                allowedKidIds: kids
                                  .filter((k) => k.group === 3)
                                  .map((k) => k.id),
                              }
                            : prev
                        ),
                    },
                    {
                      label: lang === 'th' ? 'กลุ่ม 2+3' : 'Group 2+3',
                      onClick: () =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                allowedKidIds: kids
                                  .filter((k) => k.group === 2 || k.group === 3)
                                  .map((k) => k.id),
                              }
                            : prev
                        ),
                    },
                    {
                      label: lang === 'th' ? 'ล้าง' : 'Clear',
                      onClick: () =>
                        setDraft((prev) => (prev ? { ...prev, allowedKidIds: [] } : prev)),
                    },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={btn.onClick}
                      className="rounded-lg border border-[#E2D6C8] bg-[#FAF6F0] hover:bg-[#EFE7DC] px-2.5 py-1 text-[11px] font-bold text-[#4E3F38] cursor-pointer transition-colors"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* 3-Column Kid Checkboxes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-0.5">
                  {kids.map((kid) => {
                    const checked = draft.allowedKidIds.includes(kid.id);
                    return (
                      <button
                        key={kid.id}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => {
                            if (!prev) return prev;
                            const exists = prev.allowedKidIds.includes(kid.id);
                            return {
                              ...prev,
                              allowedKidIds: exists
                                ? prev.allowedKidIds.filter((id) => id !== kid.id)
                                : [...prev.allowedKidIds, kid.id],
                            };
                          })
                        }
                        className={`rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#6ECAB6] bg-[#E8FAF6] text-[#0F4C42]'
                            : 'border-[#E6DCD2] bg-white text-[#5E4E45] hover:bg-[#FAF6F0]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-4 w-4 rounded flex items-center justify-center text-[10px] font-extrabold shrink-0 border ${
                              checked
                                ? 'bg-[#2F2824] border-[#2F2824] text-white'
                                : 'bg-white border-[#B9ABA0] text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="text-xs font-extrabold truncate">
                            {kid.emoji} {kid.nickname}
                          </span>
                        </span>
                        <span className="text-[10px] font-bold opacity-65 shrink-0">
                          {lang === 'th' ? `ก.${kid.group ?? 1}` : `G${kid.group ?? 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Modal Footer */}
            <div className="border-t border-[#EFE5D9] bg-[#FFFDF9] px-5 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={closeDraftModal}
                className="rounded-xl border border-[#DFD2C3] bg-white hover:bg-[#FAF5EF] px-5 py-2.5 text-xs sm:text-sm font-extrabold text-[#4E3F38] cursor-pointer transition-colors"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#3D322C] hover:bg-[#2B221E] text-white px-5 py-2.5 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors"
              >
                💾 {lang === 'th' ? 'บันทึกปุ่มคำสั่ง' : 'Save Command'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
