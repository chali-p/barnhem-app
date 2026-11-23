import React, { useEffect, useMemo, useState } from 'react';
import {
  AppSettings,
  CommandAccessRule,
  Language,
  Member,
} from '../types/barnhem';
import {
  getCommandPermissionSummary,
  getEffectiveCustomQuickCommands,
  getEffectiveHomeQuickActions,
} from '../utils/expressKiosk';

interface CommandPermissionsEditorCardProps {
  members: Member[];
  settings?: Partial<AppSettings>;
  lang: Language;
  onSave: (
    nextKidsWithoutPhoneIds: string[],
    nextCommandPermissions: Record<string, CommandAccessRule>
  ) => void;
  onClose?: () => void;
}

const PHONE_COMMAND_IDS = [
  'evening_uniform_phone',
  'night_homework_permission',
  'night_return_phone',
] as const;

export const CommandPermissionsEditorCard: React.FC<CommandPermissionsEditorCardProps> = ({
  members,
  settings,
  lang,
  onSave,
  onClose,
}) => {
  const kids = useMemo(() => members.filter((m) => m.role === 'kid'), [members]);

  const [activeTab, setActiveTab] = useState<'phones' | 'buttons'>('phones');
  const [groupFilter, setGroupFilter] = useState<0 | 1 | 2 | 3>(0);
  const [searchText, setSearchText] = useState('');

  const [draftWithoutPhoneIds, setDraftWithoutPhoneIds] = useState<string[]>(() =>
    Array.isArray(settings?.kidsWithoutPhoneIds) ? settings.kidsWithoutPhoneIds : []
  );
  const [draftPermissions, setDraftPermissions] = useState<Record<string, CommandAccessRule>>(
    () => ({ ...(settings?.commandPermissions ?? {}) })
  );

  const effectiveCoreActions = useMemo(
    () => getEffectiveHomeQuickActions(settings),
    [settings]
  );
  const customCommands = useMemo(
    () => getEffectiveCustomQuickCommands(settings),
    [settings]
  );

  const allCommandEntries = useMemo(
    () => [
      ...effectiveCoreActions.map((a) => ({
        id: a.id as string,
        emoji: a.emoji,
        titleTh: a.titleTh,
        titleEn: a.titleEn,
        isCustom: false,
      })),
      ...customCommands.map((c) => ({
        id: c.id,
        emoji: c.emoji,
        titleTh: c.titleTh,
        titleEn: c.titleEn,
        isCustom: true,
      })),
    ],
    [effectiveCoreActions, customCommands]
  );

  const [selectedCmdId, setSelectedCmdId] = useState<string>('evening_uniform_phone');

  useEffect(() => {
    setDraftWithoutPhoneIds(
      Array.isArray(settings?.kidsWithoutPhoneIds) ? settings.kidsWithoutPhoneIds : []
    );
    setDraftPermissions({ ...(settings?.commandPermissions ?? {}) });
  }, [settings]);

  const draftSettingsPreview = useMemo<Partial<AppSettings>>(
    () => ({
      ...settings,
      kidsWithoutPhoneIds: draftWithoutPhoneIds,
      commandPermissions: draftPermissions,
    }),
    [settings, draftWithoutPhoneIds, draftPermissions]
  );

  const filteredKids = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return kids.filter((k) => {
      if (groupFilter !== 0 && k.group !== groupFilter) return false;
      if (!q) return true;
      return (
        k.nickname.toLowerCase().includes(q) ||
        k.fullName.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q)
      );
    });
  }, [kids, groupFilter, searchText]);

  const withoutPhoneSet = useMemo(
    () => new Set(draftWithoutPhoneIds),
    [draftWithoutPhoneIds]
  );

  const phoneCount = kids.filter((k) => !withoutPhoneSet.has(k.id)).length;
  const noPhoneCount = kids.length - phoneCount;

  const toggleKidHasPhone = (kidId: string) => {
    setDraftWithoutPhoneIds((prev) =>
      prev.includes(kidId) ? prev.filter((id) => id !== kidId) : [...prev, kidId]
    );
  };

  const applyPhoneCommandsOnlyHasPhone = () => {
    setDraftPermissions((prev) => {
      const next = { ...prev };
      for (const cid of PHONE_COMMAND_IDS) {
        next[cid] = { phoneFilter: 'has_phone', restrictToKidIds: false };
      }
      for (const cmd of customCommands) {
        if (cmd.kind === 'homework_permission') {
          next[cmd.id] = { phoneFilter: 'has_phone', restrictToKidIds: false };
        }
      }
      return next;
    });
  };

  const currentRule: CommandAccessRule = draftPermissions[selectedCmdId] ?? {
    phoneFilter: 'all',
    restrictToKidIds: false,
  };

  const setRuleForSelected = (nextRule: CommandAccessRule) => {
    setDraftPermissions((prev) => ({
      ...prev,
      [selectedCmdId]: nextRule,
    }));
  };

  const toggleKidAllowedOnSelected = (kidId: string) => {
    const existingAllowed = Array.isArray(currentRule.allowedKidIds)
      ? currentRule.allowedKidIds
      : kids.map((k) => k.id);
    const exists = existingAllowed.includes(kidId);
    const nextAllowed = exists
      ? existingAllowed.filter((id) => id !== kidId)
      : [...existingAllowed, kidId];
    setRuleForSelected({
      phoneFilter: 'all',
      restrictToKidIds: true,
      allowedKidIds: nextAllowed,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draftWithoutPhoneIds.slice(0, 100), draftPermissions);
  };

  const activeCmdMeta =
    allCommandEntries.find((c) => c.id === selectedCmdId) ?? allCommandEntries[0];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border-2 border-[#7CC6B8] bg-[#F2FCF9] p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-extrabold text-[#114A42]">
            👥📱 {lang === 'th' ? 'ตั้งค่าเด็กที่มีมือถือ & สิทธิ์การกดแต่ละปุ่ม' : 'Kid Phone Status & Button Permissions'}
          </div>
          <p className="text-[11px] text-[#2E5D55] mt-0.5">
            {lang === 'th'
              ? 'เลือกว่าน้องคนไหนมี/ไม่มีมือถือ และกำหนดรายชื่อน้องที่มีสิทธิ์กดแต่ละคำสั่งได้เลยค่ะ'
              : 'Mark which kids have phones and choose exactly who can tap each command.'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#6E5C52] hover:text-[#3D322C] cursor-pointer shrink-0"
          >
            {lang === 'th' ? 'ปิด' : 'Close'}
          </button>
        )}
      </div>

      {/* Mode Switch Tabs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('phones')}
          className={`min-h-[40px] rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold cursor-pointer transition-colors ${
            activeTab === 'phones'
              ? 'border-[#114A42] bg-[#114A42] text-white'
              : 'border-[#B9E8DF] bg-white text-[#114A42] hover:bg-[#E8FAF6]'
          }`}
        >
          📱 {lang === 'th' ? `สถานะมือถือ (${phoneCount}/${kids.length})` : `Phones (${phoneCount}/${kids.length})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('buttons')}
          className={`min-h-[40px] rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold cursor-pointer transition-colors ${
            activeTab === 'buttons'
              ? 'border-[#114A42] bg-[#114A42] text-white'
              : 'border-[#B9E8DF] bg-white text-[#114A42] hover:bg-[#E8FAF6]'
          }`}
        >
          🎯 {lang === 'th' ? `สิทธิ์รายปุ่ม (${allCommandEntries.length} ปุ่ม)` : `Button Access (${allCommandEntries.length})`}
        </button>
      </div>

      {/* Group Filter + Search (shared by both tabs) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {[
            { g: 0 as const, th: 'ทั้งหมด', en: 'All' },
            { g: 1 as const, th: 'ก.1 ประถม', en: 'G1' },
            { g: 2 as const, th: 'ก.2 มัธยม', en: 'G2' },
            { g: 3 as const, th: 'ก.3 วิทยาลัย', en: 'G3' },
          ].map((tab) => (
            <button
              key={tab.g}
              type="button"
              onClick={() => setGroupFilter(tab.g)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                groupFilter === tab.g
                  ? 'bg-[#114A42] text-white'
                  : 'bg-white border border-[#C9E6DF] text-[#2E5D55] hover:bg-[#E8FAF6]'
              }`}
            >
              {lang === 'th' ? tab.th : tab.en}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={lang === 'th' ? '🔍 ค้นหาชื่อเล่นน้อง...' : '🔍 Search kid...'}
          className="rounded-lg border border-[#B9E8DF] bg-white px-2.5 py-1 text-xs text-[#3D322C] w-full sm:w-44 focus:outline-none"
        />
      </div>

      {/* TAB 1: PHONE STATUS PER KID */}
      {activeTab === 'phones' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#D4EFE9] bg-white p-2.5 text-[11px]">
            <span className="font-bold text-[#114A42] mr-1">
              ⚡ {lang === 'th' ? 'ตั้งค่าด่วน:' : 'Quick Actions:'}
            </span>
            <button
              type="button"
              onClick={() => {
                const g1Ids = kids.filter((k) => k.group === 1).map((k) => k.id);
                setDraftWithoutPhoneIds((prev) => Array.from(new Set([...prev, ...g1Ids])));
              }}
              className="rounded-lg border border-[#F3B7C0] bg-[#FFF0F3] hover:bg-[#FADADD] px-2.5 py-1 font-bold text-[#8B1D36] cursor-pointer"
            >
              📵 {lang === 'th' ? 'ตั้งกลุ่ม 1 (ประถม) ไม่มีมือถือ' : 'Mark G1 No Phone'}
            </button>
            <button
              type="button"
              onClick={() => setDraftWithoutPhoneIds([])}
              className="rounded-lg border border-[#A5DFD3] bg-[#E8FAF6] hover:bg-[#D5F4EE] px-2.5 py-1 font-bold text-[#114A42] cursor-pointer"
            >
              📱 {lang === 'th' ? 'ตั้งทุกคนมีมือถือ' : 'All Have Phones'}
            </button>
            <button
              type="button"
              onClick={applyPhoneCommandsOnlyHasPhone}
              className="rounded-lg border border-[#C8B7EB] bg-[#F5F0FF] hover:bg-[#EAE1FA] px-2.5 py-1 font-bold text-[#3E2B63] cursor-pointer"
            >
              🔒 {lang === 'th' ? 'ล็อกปุ่มมือถือให้กดได้เฉพาะคนมีมือถือ' : 'Restrict Phone Buttons to Phone Owners'}
            </button>
          </div>

          <div className="text-[11px] font-bold text-[#2E5D55] flex items-center justify-between">
            <span>
              {lang === 'th'
                ? `แตะชื่อน้องเพื่อสลับสถานะ: 📱 มีมือถือ (${phoneCount} คน) · 📵 ไม่มีมือถือ (${noPhoneCount} คน)`
                : `Tap kid to toggle: 📱 Has Phone (${phoneCount}) · 📵 No Phone (${noPhoneCount})`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-0.5">
            {filteredKids.map((kid) => {
              const hasPhone = !withoutPhoneSet.has(kid.id);
              return (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => toggleKidHasPhone(kid.id)}
                  className={`rounded-xl border-2 px-2.5 py-2 text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                    hasPhone
                      ? 'border-[#8FD4C6] bg-white hover:bg-[#E8FAF6] text-[#114A42]'
                      : 'border-[#F3B7C0] bg-[#FFF2F5] hover:bg-[#FFE4EA] text-[#8B1D36]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">
                      {kid.emoji} {kid.nickname}
                    </div>
                    <div className="text-[10px] opacity-75">
                      {lang === 'th' ? `กลุ่ม ${kid.group}` : `G${kid.group}`}
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                      hasPhone
                        ? 'bg-[#D6F5EE] text-[#114A42]'
                        : 'bg-[#FADADD] text-[#8B1D36]'
                    }`}
                  >
                    {hasPhone
                      ? lang === 'th'
                        ? '📱 มีมือถือ'
                        : '📱 Phone'
                      : lang === 'th'
                      ? '📵 ไม่มี'
                      : '📵 None'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PER-BUTTON ELIGIBLE KIDS */}
      {activeTab === 'buttons' && (
        <div className="space-y-3">
          {/* Command Selector Pills */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-[#114A42]">
              1. {lang === 'th' ? 'เลือกปุ่มคำสั่งที่ต้องการกำหนดสิทธิ์:' : 'Select a command button:'}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 rounded-xl border border-[#D4EFE9] bg-white">
              {allCommandEntries.map((cmd) => {
                const isSelected = cmd.id === selectedCmdId;
                const summary = getCommandPermissionSummary(
                  cmd.id,
                  kids,
                  lang,
                  draftSettingsPreview
                );
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => setSelectedCmdId(cmd.id)}
                    className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#114A42] bg-[#114A42] text-white'
                        : summary.restricted
                        ? 'border-[#C8B7EB] bg-[#F6F1FF] text-[#3E2B63] hover:bg-[#EAE1FA]'
                        : 'border-[#DCE8E4] bg-[#FAFDFC] text-[#3D322C] hover:bg-[#E8FAF6]'
                    }`}
                  >
                    <span>{cmd.emoji}</span>
                    <span>{lang === 'th' ? cmd.titleTh : cmd.titleEn}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : summary.restricted
                          ? 'bg-white text-[#3E2B63]'
                          : 'bg-[#E8FAF6] text-[#2E5D55]'
                      }`}
                    >
                      {summary.eligibleCount}/{kids.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rule Mode Selector for Active Button */}
          {activeCmdMeta && (
            <div className="rounded-xl border border-[#B9E8DF] bg-white p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-[#114A42]">
                  2. {activeCmdMeta.emoji}{' '}
                  {lang === 'th'
                    ? `ใครมีสิทธิ์กด "${activeCmdMeta.titleTh}" บ้าง?`
                    : `Who can tap "${activeCmdMeta.titleEn}"?`}
                </div>
                <span className="text-[11px] font-bold text-[#3E2B63]">
                  {
                    getCommandPermissionSummary(
                      activeCmdMeta.id,
                      kids,
                      lang,
                      draftSettingsPreview
                    ).badge
                  }
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  {
                    key: 'all',
                    labelTh: '🌐 กดได้ทุกคน',
                    labelEn: '🌐 All Kids',
                    active:
                      (currentRule.phoneFilter ?? 'all') === 'all' &&
                      !currentRule.restrictToKidIds,
                    onClick: () =>
                      setRuleForSelected({ phoneFilter: 'all', restrictToKidIds: false }),
                  },
                  {
                    key: 'has_phone',
                    labelTh: '📱 เฉพาะมีมือถือ',
                    labelEn: '📱 Has Phone',
                    active:
                      currentRule.phoneFilter === 'has_phone' &&
                      !currentRule.restrictToKidIds,
                    onClick: () =>
                      setRuleForSelected({ phoneFilter: 'has_phone', restrictToKidIds: false }),
                  },
                  {
                    key: 'no_phone',
                    labelTh: '📵 เฉพาะไม่มีมือถือ',
                    labelEn: '📵 No Phone',
                    active:
                      currentRule.phoneFilter === 'no_phone' &&
                      !currentRule.restrictToKidIds,
                    onClick: () =>
                      setRuleForSelected({ phoneFilter: 'no_phone', restrictToKidIds: false }),
                  },
                  {
                    key: 'custom',
                    labelTh: '✅ เลือกรายชื่อเอง',
                    labelEn: '✅ Pick Names',
                    active: Boolean(currentRule.restrictToKidIds),
                    onClick: () => {
                      const seedIds = Array.isArray(currentRule.allowedKidIds)
                        ? currentRule.allowedKidIds
                        : currentRule.phoneFilter === 'has_phone'
                        ? kids.filter((k) => !withoutPhoneSet.has(k.id)).map((k) => k.id)
                        : currentRule.phoneFilter === 'no_phone'
                        ? kids.filter((k) => withoutPhoneSet.has(k.id)).map((k) => k.id)
                        : kids.map((k) => k.id);
                      setRuleForSelected({
                        phoneFilter: 'all',
                        restrictToKidIds: true,
                        allowedKidIds: seedIds,
                      });
                    },
                  },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={opt.onClick}
                    className={`min-h-[36px] rounded-xl border px-2 py-1.5 text-[11px] font-extrabold cursor-pointer transition-colors ${
                      opt.active
                        ? 'border-[#114A42] bg-[#114A42] text-white'
                        : 'border-[#DCE8E4] bg-[#F8FCFB] text-[#2E5D55] hover:bg-[#E8FAF6]'
                    }`}
                  >
                    {lang === 'th' ? opt.labelTh : opt.labelEn}
                  </button>
                ))}
              </div>

              {/* Individual Kid Name Checkboxes when 'Pick Names' mode is enabled */}
              {currentRule.restrictToKidIds && (
                <div className="space-y-2 pt-1 border-t border-[#E8F4F1]">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-bold text-[#6E5C52]">
                      {lang === 'th' ? 'เติมรายชื่อด่วน:' : 'Quick Fill:'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRuleForSelected({
                          phoneFilter: 'all',
                          restrictToKidIds: true,
                          allowedKidIds: kids
                            .filter((k) => !withoutPhoneSet.has(k.id))
                            .map((k) => k.id),
                        })
                      }
                      className="rounded-lg border border-[#8FD4C6] bg-[#E8FAF6] px-2 py-0.5 font-bold text-[#114A42] cursor-pointer"
                    >
                      📱 {lang === 'th' ? 'เฉพาะมีมือถือ' : 'Phone Owners'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRuleForSelected({
                          phoneFilter: 'all',
                          restrictToKidIds: true,
                          allowedKidIds: kids
                            .filter((k) => withoutPhoneSet.has(k.id))
                            .map((k) => k.id),
                        })
                      }
                      className="rounded-lg border border-[#F3B7C0] bg-[#FFF0F3] px-2 py-0.5 font-bold text-[#8B1D36] cursor-pointer"
                    >
                      📵 {lang === 'th' ? 'เฉพาะไม่มีมือถือ' : 'No-Phone Kids'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRuleForSelected({
                          phoneFilter: 'all',
                          restrictToKidIds: true,
                          allowedKidIds: kids.map((k) => k.id),
                        })
                      }
                      className="rounded-lg border border-[#D4C5B4] bg-white px-2 py-0.5 font-bold text-[#3D322C] cursor-pointer"
                    >
                      ✓ {lang === 'th' ? 'ทั้งหมด' : 'All'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRuleForSelected({
                          phoneFilter: 'all',
                          restrictToKidIds: true,
                          allowedKidIds: [],
                        })
                      }
                      className="rounded-lg border border-[#D4C5B4] bg-white px-2 py-0.5 font-bold text-[#7B695F] cursor-pointer"
                    >
                      ✕ {lang === 'th' ? 'ล้าง' : 'Clear'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                    {filteredKids.map((kid) => {
                      const allowedSet = new Set(currentRule.allowedKidIds ?? []);
                      const checked = allowedSet.has(kid.id);
                      const hasPhone = !withoutPhoneSet.has(kid.id);
                      return (
                        <button
                          key={kid.id}
                          type="button"
                          onClick={() => toggleKidAllowedOnSelected(kid.id)}
                          className={`rounded-xl border px-2.5 py-1.5 text-left flex items-center justify-between gap-1 cursor-pointer transition-colors ${
                            checked
                              ? 'border-[#114A42] bg-[#E8FAF6] text-[#114A42]'
                              : 'border-[#E6DCD2] bg-[#FAF7F4] text-[#8B796E] opacity-75'
                          }`}
                        >
                          <span className="text-xs font-bold truncate">
                            {checked ? '☑️' : '⬜'} {kid.emoji} {kid.nickname}
                          </span>
                          <span className="text-[10px] shrink-0" title={hasPhone ? 'มีมือถือ' : 'ไม่มีมือถือ'}>
                            {hasPhone ? '📱' : '📵'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 min-h-[42px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white text-xs sm:text-sm font-extrabold px-4 py-2 cursor-pointer"
        >
          💾 {lang === 'th' ? 'บันทึกสถานะมือถือ & สิทธิ์ปุ่มทั้งหมด' : 'Save Phone Status & Permissions'}
        </button>
      </div>
    </form>
  );
};
