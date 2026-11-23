import { User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  Announcement,
  AppState,
  DeedRedemption,
  FestivalId,
  Language,
  LostFoundItem,
  Member,
  ModalAlertPayload,
  OutingTrip,
  SecretPoll,
  ShopCategory,
  ShopItem,
  StaffLeaveRecord,
} from '../types/barnhem';
import {
  formatLeaveKindTh,
  formatLeaveSpanTh,
  formatMinutesToHHMM,
  getShiftCoverageAtDateTime,
} from '../data/staffSchedule';
import { FESTIVAL_CATALOG } from '../utils/festivalAndEvents';
import { ensureCurrentWeekAllowance, getKidEconomyConfig } from '../utils/piggyBank';
import {
  findPinConflict,
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';
import { getDateKey } from '../utils/timeRules';
import {
  copyTextToClipboard,
  downloadJsonBackup,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '../utils/syncStorage';
import { CareCommunityPanel } from './CareCommunityPanel';
import { PinPadModal } from './CenteredAlertModal';
import { CloudSyncBanner } from './CloudSyncBanner';
import { AdminRegistrationsPanel } from './PlatformPortalView';
import { MASTER_ADMIN_EMAIL } from '../services/firestoreSync';
import { QrBarcodeSheet } from './QrBarcodeSheet';
import { StaffLeavePanel } from './StaffLeavePanel';
import { StaffRosterPanel } from './StaffRosterPanel';
import { TimedScheduleEditorCard } from './TimedScheduleEditorCard';
import { CommandPermissionsEditorCard } from './CommandPermissionsEditorCard';

interface CreatorViewProps {
  state: AppState;
  cloudUser: User | null;
  cloudSyncing: boolean;
  onForceSeedCloud: () => Promise<void>;
  now: Date;
  lang: Language;
  unlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  onUpdateMemberPin: (memberId: string, newPin: string) => void;
  onUpdateKid: (kidId: string, updater: (prev: Member) => Member, eventLabel: string) => void;
  onAddShopItem: (item: ShopItem) => void;
  onUpdateShopItemPrice: (itemId: string, priceStars: number) => void;
  onDeleteShopItem: (itemId: string) => void;
  onUpdateSettings: (partial: Partial<AppState['settings']>) => void;
  onManualSync: () => Promise<void>;
  onOpenExpressKiosk: () => void;
  onSwitchToStaffMode?: () => void;
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
  onSubmitStaffLeave: (leave: StaffLeaveRecord) => void;
  onUpdateLeaveSubstitute: (leaveId: string, substituteName: string) => void;
  onAcknowledgeLeave: (leaveId: string, byName: string) => void;
  onCancelLeave: (leaveId: string) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  isExternalTenant?: boolean;
}

export const CreatorView: React.FC<CreatorViewProps> = ({
  state,
  cloudUser,
  cloudSyncing,
  onForceSeedCloud,
  now,
  lang,
  unlocked,
  onUnlock,
  onLock,
  onUpdateMemberPin,
  onUpdateKid,
  onAddShopItem,
  onUpdateShopItemPrice,
  onDeleteShopItem,
  onUpdateSettings,
  onManualSync,
  onOpenExpressKiosk,
  onSwitchToStaffMode,
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
  onSubmitStaffLeave,
  onUpdateLeaveSubstitute,
  onAcknowledgeLeave,
  onCancelLeave,
  onShowAlert,
  isExternalTenant = false,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);

  // Shop Item Creation State
  const [itemNameTh, setItemNameTh] = useState('');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemPrice, setItemPrice] = useState(30);
  const [itemCategory, setItemCategory] = useState<ShopCategory>('snack');
  const [itemEmoji, setItemEmoji] = useState('🧁');
  const [itemImageBase64, setItemImageBase64] = useState<string | undefined>(undefined);

  // Settings State
  const [webhookInput, setWebhookInput] = useState(state.settings.syncWebhookUrl);
  const [returnDriveInput, setReturnDriveInput] = useState(state.settings.returnHomeDriveUrl);
  const [showAppsScriptHelper, setShowAppsScriptHelper] = useState(false);

  useEffect(() => {
    setWebhookInput(state.settings.syncWebhookUrl);
  }, [state.settings.syncWebhookUrl]);

  useEffect(() => {
    setReturnDriveInput(state.settings.returnHomeDriveUrl);
  }, [state.settings.returnHomeDriveUrl]);
  const [piggyCoinsDrafts, setPiggyCoinsDrafts] = useState<Record<string, string>>({});
  const [piggyDailyDrafts, setPiggyDailyDrafts] = useState<Record<string, string>>({});
  const [piggyKidSearch, setPiggyKidSearch] = useState('');
  const [piggyGroupFilter, setPiggyGroupFilter] = useState<0 | 1 | 2 | 3>(0);
  const [creatorPin1, setCreatorPin1] = useState(state.settings.creatorPins[0] ?? '9292');
  const [creatorPin2, setCreatorPin2] = useState(state.settings.creatorPins[1] ?? '1629');
  const [showRosterRadar, setShowRosterRadar] = useState(false);
  const pinGuard = usePinGuard('creator');

  type CreatorSectionKey =
    | 'piggyRates'
    | 'piggyKids'
    | 'community'
    | 'staffLeave'
    | 'registrations'
    | 'pins'
    | 'shopAdd'
    | 'shopList'
    | 'qr'
    | 'settings'
    | 'cloud';

  const CREATOR_SECTION_KEYS: CreatorSectionKey[] = [
    'piggyRates',
    'piggyKids',
    'community',
    'staffLeave',
    'registrations',
    'pins',
    'shopAdd',
    'shopList',
    'qr',
    'settings',
    'cloud',
  ];

  const [hiddenSections, setHiddenSections] = useState<Partial<Record<CreatorSectionKey, boolean>>>(() => {
    try {
      const raw = window.localStorage.getItem('barnhem_creator_hidden_sections_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  });

  const persistHiddenSections = (next: Partial<Record<CreatorSectionKey, boolean>>) => {
    try {
      window.localStorage.setItem('barnhem_creator_hidden_sections_v1', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const toggleSection = (key: CreatorSectionKey) => {
    setHiddenSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      persistHiddenSections(next);
      return next;
    });
  };

  const setAllSectionsHidden = (hideAll: boolean) => {
    const next: Partial<Record<CreatorSectionKey, boolean>> = {};
    if (hideAll) {
      CREATOR_SECTION_KEYS.forEach((k) => {
        next[k] = true;
      });
    }
    persistHiddenSections(next);
    setHiddenSections(next);
  };

  const tryUnlock = (pin: string) => {
    if (pinGuard.isLocked) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
        message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
        tone: 'pink',
      });
      return;
    }
    if (state.settings.creatorPins.includes(pin.trim())) {
      pinGuard.recordSuccess();
      setPinInput('');
      setPinModalOpen(false);
      onUnlock();
      return;
    }
    const res = pinGuard.recordFailure();
    setPinInput('');
    onShowAlert({
      icon: res.lockedNow ? '🔒' : '👑',
      title: res.lockedNow
        ? lang === 'th'
          ? 'ล็อกชั่วคราว 30 วินาที'
          : 'Locked for 30 Seconds'
        : lang === 'th'
        ? 'รหัสลับผู้สร้างไม่ถูกต้อง'
        : 'Invalid Creator Secret Code',
      message: res.lockedNow
        ? formatPinLockoutMessage(res.lockSec, lang)
        : `${lang === 'th' ? 'กรุณาใส่รหัสลับ 4 หลักของผู้สร้างให้ถูกต้องค่ะ' : 'Please enter a valid 4-digit Creator Secret PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
      tone: 'pink',
    });
  };

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto rounded-[36px] border-2 border-[#EAE4F2] bg-[#FFFDF9] p-7 text-center pastel-shadow">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAE4F2] text-3xl">
          👑
        </div>
        <h2 className="text-2xl font-bold text-[#3D322C]">
          {lang === 'th' ? 'โหมดผู้สร้างสูงสุด (Creator Master Admin)' : 'Creator Master Admin'}
        </h2>
        <p className="text-sm text-[#6E5C52] mt-1 mb-5">
          {lang === 'th'
            ? 'สำหรับพี่กิ๊ก / Chali — กรุณาใส่รหัสลับ 4 หลักส่วนตัวเพื่อเข้าถึงระบบผู้สร้าง'
            : 'For P\'Kik / Chali — Enter your private 4-digit Creator Secret PIN.'}
        </p>

        {pinGuard.isLocked && (
          <div className="mb-3 rounded-2xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-2 text-xs font-bold text-[#8B1D36] tabular-nums">
            🔒 {formatPinLockoutMessage(pinGuard.remainingSec, lang)}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            tryUnlock(pinInput);
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
                ? 'รหัสลับ 4 หลัก'
                : '4-digit Secret PIN'
            }
            className="w-full rounded-2xl border-2 border-[#EBD8C3] bg-white px-4 py-3 text-center text-xl tracking-widest disabled:bg-[#F5ECE2]"
          />
          <button
            type="submit"
            disabled={pinGuard.isLocked}
            className="w-full min-h-[48px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {lang === 'th' ? 'ปลดล็อกโหมดผู้สร้างสูงสุด' : 'Unlock Creator Mode'}
          </button>
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="w-full min-h-[44px] rounded-2xl bg-[#EAE4F2] text-[#3D322C] font-bold text-sm cursor-pointer"
          >
            🔢 {lang === 'th' ? 'เปิดแป้นพิมพ์ PIN' : 'Open PIN Keypad'}
          </button>
        </form>

        <PinPadModal
          open={pinModalOpen}
          lang={lang}
          lockedRemainingSec={pinGuard.remainingSec}
          title={lang === 'th' ? 'รหัสลับโหมดผู้สร้างสูงสุด' : 'Creator Secret PIN'}
          onCancel={() => setPinModalOpen(false)}
          onSubmitPin={tryUnlock}
        />
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setItemImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNameTh.trim() || itemPrice <= 0) {
      onShowAlert({
        icon: '🏪',
        title: lang === 'th' ? 'กรุณากรอกข้อมูลสินค้าให้ครบ' : 'Incomplete Shop Item',
        message: lang === 'th' ? 'ใส่ชื่อสินค้าและราคาดาวมากกว่า 0 นะ' : 'Please provide item name and star price > 0.',
        tone: 'yellow',
      });
      return;
    }

    const newItem: ShopItem = {
      id: `custom_${Date.now()}`,
      nameTh: itemNameTh.trim(),
      nameEn: itemNameEn.trim() || itemNameTh.trim(),
      priceStars: Number(itemPrice),
      category: itemCategory,
      subType: itemCategory === 'cover_item' ? 'casual_outfit' : undefined,
      emoji: itemEmoji || '🎁',
      imageBase64: itemImageBase64,
      colorHex: '#FADADD',
      outfitVariant: 'hoodie',
      descriptionTh:
        itemCategory === 'snack'
          ? 'มินิมาร์ทมูลนิธิ · แลกด้วยดาว (ไม่ใช้เงิน)'
          : 'ไอเทมแต่งปก (เพิ่มโดยผู้สร้าง)',
      descriptionEn:
        itemCategory === 'snack' ? 'Foundation Minimart · Star Exchange' : 'Cover Item',
    };

    onAddShopItem(newItem);
    setItemNameTh('');
    setItemNameEn('');
    setItemImageBase64(undefined);
    onShowAlert({
      icon: '🛍️',
      title: lang === 'th' ? 'เพิ่มสินค้าเข้าร้านเรียบร้อย!' : 'Item Added to Shop!',
      message: `${newItem.emoji} ${newItem.nameTh} (${newItem.priceStars} ⭐)`,
      tone: 'mint',
    });
  };

  const kids = state.members.filter((m) => m.role === 'kid');
  const hiddenCount = CREATOR_SECTION_KEYS.filter((k) => Boolean(hiddenSections[k])).length;
  const allHidden = hiddenCount === CREATOR_SECTION_KEYS.length;
  const anyHidden = hiddenCount > 0;

  const renderSectionToggleButton = (key: CreatorSectionKey, accentClass = 'bg-[#FFF5BA] hover:bg-[#FCEB8E] border-[#F4DB73] text-[#3D322C]') => {
    const isHidden = Boolean(hiddenSections[key]);
    return (
      <button
        type="button"
        onClick={() => toggleSection(key)}
        className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap border ${
          isHidden
            ? accentClass
            : 'bg-[#F7F1EB] hover:bg-[#EDE2D7] border-[#E2D4C5] text-[#5C4B42]'
        }`}
      >
        {isHidden
          ? lang === 'th'
            ? '👁️ แสดง ▾'
            : '👁️ Show ▾'
          : lang === 'th'
          ? '🙈 ซ่อน ▴'
          : '🙈 Hide ▴'}
      </button>
    );
  };

  const allKids = kids;
  const filteredPiggyKids = allKids.filter((k) => {
    if (piggyGroupFilter !== 0 && k.group !== piggyGroupFilter) return false;
    const q = piggyKidSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      k.nickname.toLowerCase().includes(q) ||
      k.fullName.toLowerCase().includes(q) ||
      k.id.toLowerCase().includes(q)
    );
  });
  const globalDaily = Math.min(500, Math.max(10, Math.round(Number(state.settings.dailyAllowanceThb ?? 70))));
  const staffLeaves = state.staffLeaves ?? [];
  const todayKey = getDateKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayCoverage = getShiftCoverageAtDateTime(
    now,
    nowMinutes,
    staffLeaves,
    state.settings.isPublicHolidayToday
  );

  return (
    <div className="space-y-6">
      {/* Creator Top Header + Hide All / Show All */}
      <div className="no-print rounded-[28px] border-2 border-[#EAE4F2] bg-[#FFFDF9] p-5 flex flex-wrap items-center justify-between gap-4 pastel-shadow">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👑</span>
          <div>
            <h2 className="text-xl font-bold text-[#3D322C]">
              {lang === 'th' ? 'โหมดผู้สร้างสูงสุด (Creator Master Admin — พี่กิ๊ก / Chali)' : 'Creator Master Admin — P\'Kik / Chali'}
            </h2>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'th'
                ? `สมาชิกในระบบทั้งหมด ${state.members.length} คน · สินค้าในร้าน ${state.shopItems.length} รายการ`
                : `${state.members.length} Members · ${state.shopItems.length} Shop Items`}
              {anyHidden && (
                <span className="ml-2 font-bold text-[#6E2638]">
                  · {lang === 'th' ? `ซ่อนอยู่ ${hiddenCount}/${CREATOR_SECTION_KEYS.length} ส่วน` : `${hiddenCount}/${CREATOR_SECTION_KEYS.length} hidden`}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!allHidden && (
            <button
              type="button"
              onClick={() => setAllSectionsHidden(true)}
              className="min-h-[42px] rounded-2xl bg-[#F4ECE4] hover:bg-[#E7D8C8] border border-[#DECBB7] px-3.5 py-2 text-xs sm:text-sm font-bold text-[#3D322C] cursor-pointer"
            >
              🙈 {lang === 'th' ? 'ซ่อนทุกส่วน' : 'Hide All'}
            </button>
          )}
          {anyHidden && (
            <button
              type="button"
              onClick={() => setAllSectionsHidden(false)}
              className="min-h-[42px] rounded-2xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#F4DB73] px-3.5 py-2 text-xs sm:text-sm font-bold text-[#3D322C] cursor-pointer"
            >
              👁️ {lang === 'th' ? 'แสดงทั้งหมด' : 'Show All'}
            </button>
          )}
          {onSwitchToStaffMode && (
            <button
              type="button"
              onClick={onSwitchToStaffMode}
              className="min-h-[42px] rounded-2xl bg-[#D4F0F0] hover:bg-[#B8E5E1] px-4 py-2 text-sm font-bold text-[#214F4B] cursor-pointer"
            >
              👩‍🏫 {lang === 'th' ? 'สลับไปโหมดพี่เลี้ยง' : 'Switch to Staff Mode'}
            </button>
          )}
          <button
            type="button"
            onClick={onLock}
            className="min-h-[42px] rounded-2xl bg-[#FADADD] hover:bg-[#F3B7C0] px-4 py-2 text-sm font-bold text-[#3D322C] cursor-pointer"
          >
            🔒 {lang === 'th' ? 'ล็อกโหมดผู้สร้าง' : 'Lock Creator Mode'}
          </button>
        </div>
      </div>

      {/* Urgent Staff Leave & Live Duty Alert Strip for Creator */}
      {(todayCoverage.leavesForDate.length > 0 || todayCoverage.alertsTh.length > 0) && (
        <section className="no-print rounded-[24px] border-2 border-[#EE9CAF] bg-gradient-to-r from-[#FFF1F4] to-[#FFF9EE] p-4 pastel-shadow space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs sm:text-sm font-extrabold text-[#8B1D36]">
              🚨 {lang === 'th' ? 'แจ้งเตือนพี่เลี้ยงลางานวันนี้' : 'Staff Leave Alert Today'}
              <span className="ml-2 font-bold text-[#1B544A]">
                · 🕒 เข้าเวรเวลา {formatMinutesToHHMM(nowMinutes)} น.:{' '}
                {todayCoverage.onDutyNowNames.length > 0
                  ? todayCoverage.onDutyNowNames.join(', ')
                  : 'ยังไม่มีผู้เข้าเวร!'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (hiddenSections.staffLeave) {
                  setHiddenSections((prev) => {
                    const next = { ...prev, staffLeave: false };
                    persistHiddenSections(next);
                    return next;
                  });
                }
                window.setTimeout(() => {
                  document
                    .getElementById('staff-leave-section')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 40);
              }}
              className="rounded-xl bg-[#9E1C36] hover:bg-[#7D1429] text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
            >
              🏖️ {lang === 'th' ? 'เปิดส่วนจัดการลา & เช็คเวร ↓' : 'Open Leave & Roster ↓'}
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
                  [{l.dateKey === todayKey ? 'วันนี้' : l.dateKey}] {formatLeaveKindTh(l.kind)} · {l.staffName}
                </span>
                <span className="text-[#6E5C52]">{formatLeaveSpanTh(l)}</span>
                <span className="font-bold text-[#1A5E52]">
                  → แทน: {l.substituteName || 'ยังไม่ระบุคนแทน'}
                </span>
                {!l.acknowledgedBy && (
                  <button
                    type="button"
                    onClick={() => onAcknowledgeLeave(l.id, 'พี่กิ๊ก (Creator)')}
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

      {/* 1A. MOVED TO TOP: Piggy Bank & Star Economy Rates */}
      <section className="no-print rounded-[28px] border-2 border-[#F4DB73] bg-[#FFFBEB] p-5 pastel-shadow space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#5A4208]">
              🪙🐷 {lang === 'th' ? 'ตั้งค่ากระปุกหมู อัตราแลกดาวเป็นเหรียญ & เบี้ยขยัน' : 'Piggy Bank & Star Economy Settings'}
            </h3>
            <p className="text-xs text-[#7A5B14]">
              {lang === 'th'
                ? `ปรับแก้จำนวนดาวแลกเหรียญ ค่าไปโรงเรียนรายวัน (${globalDaily} ฿) และโบนัสมาก่อน 15 นาที (ค่าเริ่มต้น: 30 ⭐ = 5 ฿)`
                : `Customize Star-to-Coin exchange ratio, daily allowance (${globalDaily} THB), and 15-min early bonus.`}
            </p>
          </div>
          {renderSectionToggleButton('piggyRates', 'bg-[#FFF3B0] hover:bg-[#FDE68A] border-[#E8C84A] text-[#5A4208]')}
        </div>

        {/* Kid-facing Coins & Piggy Bank Master Switch (preserves all settings & balances) */}
        <div
          className={`rounded-2xl border-2 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
            state.settings.enableCoinsAndPiggyBank
              ? 'border-[#8AD1BA] bg-[#E8FAF3]'
              : 'border-[#F4C46A] bg-[#FFF5D6]'
          }`}
        >
          <div className="space-y-0.5 text-xs">
            <div className="font-extrabold text-[#3D322C] flex flex-wrap items-center gap-2">
              <span>
                {state.settings.enableCoinsAndPiggyBank
                  ? lang === 'th'
                    ? '🟢 สถานะฝั่งน้อง: เปิดใช้ระบบเหรียญ & กระปุกหมูอยู่'
                    : '🟢 Kid Screen Status: Coins & Piggy Bank ON'
                  : lang === 'th'
                  ? '⏸️ สถานะฝั่งน้อง: ปิดเรื่องเหรียญชั่วคราว (เปิดใช้เฉพาะ ⭐ ดาว)'
                  : '⏸️ Kid Screen Status: Coins & Piggy Bank OFF (Stars ⭐ Only)'}
              </span>
            </div>
            <p className="text-[11px] text-[#6B5749]">
              {lang === 'th'
                ? state.settings.enableCoinsAndPiggyBank
                  ? 'น้องๆ จะเห็นกระปุกหมูสีชมพู/สีทอง และปุ่มแลกดาวเป็นเหรียญในหน้าร้านค้าตามปกติ'
                  : 'ซ่อนกระปุกหมูและการแลก/หักเหรียญฝั่งน้องชั่วคราว โดยยังเก็บยอดเงิน อัตราแลกดาว และประวัติทั้งหมดไว้ในหน้าผู้สร้างสูงสุดครบถ้วน พร้อมเปิดใช้เมื่อต้องการค่ะ'
                : state.settings.enableCoinsAndPiggyBank
                ? 'Kids can see Pink/Golden Piggy Banks and Star-to-Coin conversion.'
                : 'Piggy banks and coin exchanges are hidden on kid screens while all rates and balances stay safely preserved here until you turn them ON.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                enableCoinsAndPiggyBank: !Boolean(state.settings.enableCoinsAndPiggyBank),
              })
            }
            className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
              state.settings.enableCoinsAndPiggyBank
                ? 'bg-[#3D322C] hover:bg-[#2A221D] text-white'
                : 'bg-[#1F6F58] hover:bg-[#175745] text-white'
            }`}
          >
            {state.settings.enableCoinsAndPiggyBank
              ? lang === 'th'
                ? '⏸️ ปิดระบบเหรียญฝั่งน้องชั่วคราว'
                : '⏸️ Turn OFF Coins for Kids'
              : lang === 'th'
              ? '🟢 เปิดระบบเหรียญให้น้องใช้งาน'
              : '🟢 Turn ON Coins for Kids'}
          </button>
        </div>

        {!hiddenSections.piggyRates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs pt-1">
            <label className="rounded-xl border border-[#F0D568] bg-white p-2.5 space-y-1">
              <span className="font-bold text-[#3D322C] block">
                ⭐ {lang === 'th' ? 'จำนวนดาวที่ใช้แลกเหรียญ' : 'Stars per Trade'}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={state.settings.starToCoinStars ?? 30}
                  onChange={(e) =>
                    onUpdateSettings({
                      starToCoinStars: Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 30)),
                    })
                  }
                  className="w-full rounded-lg border border-[#EBD8C3] px-2 py-1 font-extrabold tabular-nums text-center"
                />
                <span>⭐</span>
              </div>
            </label>

            <label className="rounded-xl border border-[#F0D568] bg-white p-2.5 space-y-1">
              <span className="font-bold text-[#3D322C] block">
                🪙 {lang === 'th' ? 'เหรียญที่ได้รับต่อครั้ง' : 'Coins Received (THB)'}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={state.settings.starToCoinThb ?? 5}
                  onChange={(e) =>
                    onUpdateSettings({
                      starToCoinThb: Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 5)),
                    })
                  }
                  className="w-full rounded-lg border border-[#EBD8C3] px-2 py-1 font-extrabold tabular-nums text-center"
                />
                <span>฿</span>
              </div>
            </label>

            <label className="rounded-xl border border-[#F3B7C0] bg-white p-2.5 space-y-1">
              <span className="font-bold text-[#3D322C] block">
                🚌 {lang === 'th' ? 'ค่าไปโรงเรียนต่อวัน' : 'Daily Allowance'}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={state.settings.dailyAllowanceThb ?? 70}
                  onChange={(e) =>
                    onUpdateSettings({
                      dailyAllowanceThb: Math.max(10, Math.min(500, parseInt(e.target.value, 10) || 70)),
                    })
                  }
                  className="w-full rounded-lg border border-[#EBD8C3] px-2 py-1 font-extrabold tabular-nums text-center"
                />
                <span>฿/วัน</span>
              </div>
            </label>

            <label className="rounded-xl border border-[#F3B7C0] bg-white p-2.5 space-y-1">
              <span className="font-bold text-[#3D322C] block">
                📅 {lang === 'th' ? 'จำนวนวันเรียน/สัปดาห์' : 'School Days / Week'}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={state.settings.schoolDaysPerWeek ?? 5}
                  onChange={(e) =>
                    onUpdateSettings({
                      schoolDaysPerWeek: Math.max(1, Math.min(7, parseInt(e.target.value, 10) || 5)),
                    })
                  }
                  className="w-full rounded-lg border border-[#EBD8C3] px-2 py-1 font-extrabold tabular-nums text-center"
                />
                <span>
                  ={' '}
                  {((state.settings.dailyAllowanceThb ?? 70) * (state.settings.schoolDaysPerWeek ?? 5)).toLocaleString()}{' '}
                  ฿
                </span>
              </div>
            </label>

            <label className="rounded-xl border border-[#8DD6C7] bg-white p-2.5 space-y-1">
              <span className="font-bold text-[#3D322C] block">
                ⏰ {lang === 'th' ? 'เบี้ยขยันมาก่อน 15 นาที' : '15-Min Early Bonus'}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={state.settings.early15MinBonusStars ?? 1}
                  onChange={(e) =>
                    onUpdateSettings({
                      early15MinBonusStars: Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0)),
                    })
                  }
                  className="w-full rounded-lg border border-[#EBD8C3] px-2 py-1 font-extrabold tabular-nums text-center"
                />
                <span>⭐</span>
              </div>
            </label>
          </div>
        )}
      </section>

      {/* 1B. MOVED TO TOP: Per-Kid Piggy Bank Balance & Custom Daily School Allowance Editor */}
      <section className="no-print rounded-[28px] border-2 border-[#F3B7C0] bg-[#FFF6F8] p-5 pastel-shadow space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#6E2638]">
              🐷 {lang === 'th' ? `แก้ไขยอดเงินในออมสิน & ค่าไปโรงเรียนรายคน (${allKids.length} คน)` : `Edit Individual Piggy Balance & Daily Allowance (${allKids.length})`}
            </h3>
            <p className="text-xs text-[#7D4B58]">
              {lang === 'th'
                ? `ปรับยอดเหรียญในกระปุกหมูสีชมพูของน้องแต่ละคน หรือกำหนดค่าไปโรงเรียนรายวันเฉพาะคนได้ (ค่ากลางตอนนี้ ${globalDaily} ฿/วัน)`
                : `Adjust each kid's pink piggy bank balance or set custom daily school allowance (global default: ${globalDaily} THB/day).`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {!hiddenSections.piggyKids && (
              <>
                <input
                  type="text"
                  value={piggyKidSearch}
                  onChange={(e) => setPiggyKidSearch(e.target.value)}
                  placeholder={lang === 'th' ? '🔍 ค้นหาน้อง...' : '🔍 Search kid...'}
                  className="rounded-xl border border-[#F3B7C0] bg-white px-2.5 py-1 text-xs w-36"
                />
                {[
                  { g: 0 as const, label: lang === 'th' ? 'ทั้งหมด' : 'All' },
                  { g: 1 as const, label: 'ก.1' },
                  { g: 2 as const, label: 'ก.2' },
                  { g: 3 as const, label: 'ก.3' },
                ].map((tab) => (
                  <button
                    key={tab.g}
                    type="button"
                    onClick={() => setPiggyGroupFilter(tab.g)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold cursor-pointer ${
                      piggyGroupFilter === tab.g
                        ? 'bg-[#FADADD] border border-[#E6889F] text-[#5B1D2C]'
                        : 'bg-white border border-[#F0D5DC] text-[#6E5C52]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </>
            )}
            {renderSectionToggleButton('piggyKids', 'bg-[#FADADD] hover:bg-[#F5C2C8] border-[#E6889F] text-[#6E2638]')}
          </div>
        </div>

        {!hiddenSections.piggyKids && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1 pt-1">
            {filteredPiggyKids.map((kid) => {
              const { allowance } = ensureCurrentWeekAllowance(kid, now, state.settings);
              const kidEco = getKidEconomyConfig(kid, state.settings);
              const hasCustomDaily = typeof kid.allowance?.customDailyAllowanceThb === 'number';
              const coinDraft = piggyCoinsDrafts[kid.id] ?? String(allowance.coins);
              const dailyDraft =
                piggyDailyDrafts[kid.id] ??
                (hasCustomDaily ? String(kid.allowance?.customDailyAllowanceThb) : String(kidEco.dailyAllowanceThb));

              return (
                <div
                  key={kid.id}
                  className="rounded-2xl border border-[#F0D5DC] bg-white p-3 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-extrabold text-[#3D322C] truncate">
                      {kid.emoji} {kid.nickname} ({kid.id}) · ก.{kid.group}
                    </div>
                    <span className="text-[11px] font-bold text-[#7A3548] tabular-nums shrink-0">
                      {lang === 'th'
                        ? `ออมสิน ${allowance.coins.toLocaleString()} ฿ · ${kidEco.dailyAllowanceThb} ฿/วัน`
                        : `${allowance.coins} THB · ${kidEco.dailyAllowanceThb}/day`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Edit Current Piggy Balance */}
                    <div className="rounded-xl border border-[#F5E1E6] bg-[#FFF9FA] p-2 space-y-1">
                      <span className="text-[11px] font-bold text-[#6E2638] block">
                        🪙 {lang === 'th' ? 'ยอดในออมสินตอนนี้ (฿)' : 'Current Piggy (THB)'}
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={-5000}
                          max={100000}
                          value={coinDraft}
                          onChange={(e) =>
                            setPiggyCoinsDrafts((prev) => ({ ...prev, [kid.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-[#EBD8C3] bg-white px-2 py-1 font-extrabold tabular-nums text-center"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = Math.round(Number(coinDraft));
                            if (!Number.isFinite(parsed)) return;
                            const clamped = Math.max(-5000, Math.min(100000, parsed));
                            onUpdateKid(
                              kid.id,
                              (prev) => {
                                const { allowance: cur } = ensureCurrentWeekAllowance(
                                  prev,
                                  now,
                                  state.settings
                                );
                                const diff = clamped - cur.coins;
                                return {
                                  ...prev,
                                  allowance: {
                                    ...cur,
                                    coins: clamped,
                                    coinHistory: [
                                      {
                                        id: `coin_adj_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                                        timestamp: now.toISOString(),
                                        reason: `👑 ผู้สร้างปรับยอดออมสิน (${cur.coins} → ${clamped} ฿)`,
                                        amount: diff,
                                        kind: 'admin_adjust' as const,
                                      },
                                      ...cur.coinHistory,
                                    ].slice(0, 40),
                                  },
                                };
                              },
                              `Creator Adjust Piggy (${kid.nickname} -> ${clamped})`
                            );
                            setPiggyCoinsDrafts((prev) => {
                              const next = { ...prev };
                              delete next[kid.id];
                              return next;
                            });
                            onShowAlert({
                              icon: '🐷✅',
                              title: lang === 'th' ? 'อัปเดตยอดเงินออมสินแล้ว' : 'Piggy Balance Updated',
                              message:
                                lang === 'th'
                                  ? `ตั้งค่ายอดเงินในออมสินของน้อง${kid.nickname} เป็น ${clamped.toLocaleString()} ฿ เรียบร้อยค่ะ`
                                  : `${kid.nickname}'s piggy balance set to ${clamped.toLocaleString()} THB.`,
                              tone: 'mint',
                            });
                          }}
                          className="rounded-lg bg-[#3D322C] hover:bg-[#2B221D] text-white px-2.5 py-1 font-bold cursor-pointer whitespace-nowrap"
                        >
                          {lang === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    </div>

                    {/* Edit Per-Kid Daily School Allowance */}
                    <div className="rounded-xl border border-[#E8DFF6] bg-[#FAF8FF] p-2 space-y-1">
                      <span className="text-[11px] font-bold text-[#452F73] block">
                        🚌 {lang === 'th' ? 'ค่าไปโรงเรียน/วัน (฿)' : 'Daily School Rate (THB)'}
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={10}
                          max={500}
                          value={dailyDraft}
                          onChange={(e) =>
                            setPiggyDailyDrafts((prev) => ({ ...prev, [kid.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-[#D8CDF2] bg-white px-2 py-1 font-extrabold tabular-nums text-center"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const parsed = Math.round(Number(dailyDraft));
                            if (!Number.isFinite(parsed)) return;
                            const clamped = Math.max(10, Math.min(500, parsed));
                            onUpdateKid(
                              kid.id,
                              (prev) => {
                                const { allowance: cur } = ensureCurrentWeekAllowance(
                                  prev,
                                  now,
                                  state.settings
                                );
                                return {
                                  ...prev,
                                  allowance: {
                                    ...cur,
                                    customDailyAllowanceThb: clamped,
                                  },
                                };
                              },
                              `Set Custom Daily Allowance (${kid.nickname} = ${clamped})`
                            );
                            setPiggyDailyDrafts((prev) => {
                              const next = { ...prev };
                              delete next[kid.id];
                              return next;
                            });
                            onShowAlert({
                              icon: '🚌✅',
                              title: lang === 'th' ? 'บันทึกค่าไปโรงเรียนรายคนแล้ว' : 'Custom Daily Rate Saved',
                              message:
                                lang === 'th'
                                  ? `ตั้งค่าไปโรงเรียนของน้อง${kid.nickname} เป็นวันละ ${clamped} ฿ เรียบร้อยค่ะ`
                                  : `${kid.nickname}'s daily school rate set to ${clamped} THB/day.`,
                              tone: 'mint',
                            });
                          }}
                          className="rounded-lg bg-[#5A3E8C] hover:bg-[#472F72] text-white px-2 py-1 font-bold cursor-pointer whitespace-nowrap"
                        >
                          {lang === 'th' ? 'ตั้งค่า' : 'Set'}
                        </button>
                        {hasCustomDaily && (
                          <button
                            type="button"
                            title={lang === 'th' ? 'กลับไปใช้ค่ามาตรฐานกลาง' : 'Reset to global default'}
                            onClick={() => {
                              onUpdateKid(
                                kid.id,
                                (prev) => {
                                  const { allowance: cur } = ensureCurrentWeekAllowance(
                                    prev,
                                    now,
                                    state.settings
                                  );
                                  const nextAllowance = { ...cur };
                                  delete nextAllowance.customDailyAllowanceThb;
                                  return {
                                    ...prev,
                                    allowance: nextAllowance,
                                  };
                                },
                                `Reset Daily Allowance (${kid.nickname})`
                              );
                              setPiggyDailyDrafts((prev) => {
                                const next = { ...prev };
                                delete next[kid.id];
                                return next;
                              });
                            }}
                            className="rounded-lg bg-[#EEE7FA] hover:bg-[#E1D4F5] text-[#452F73] px-1.5 py-1 font-bold cursor-pointer"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. MOVED TO TOP: Announcements, Secret Polls, Outing Trips & Confidential Backchannel Inbox */}
      <div className="no-print">
        <CareCommunityPanel
          authorName="พี่กิ๊ก (Creator)"
          authorRole="Creator"
          members={state.members}
          announcements={state.announcements}
          polls={state.polls}
          trips={state.trips}
          privateMessages={state.privateMessages}
          lostFoundItems={state.lostFoundItems}
          supplyRequests={state.supplyRequests}
          kindnessCards={state.kindnessCards}
          deedRedemptions={state.deedRedemptions}
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
          collapsed={Boolean(hiddenSections.community)}
          onToggleCollapse={() => toggleSection('community')}
        />
      </div>

      {/* 2B. Staff Sudden Leave, Substitutes & Live/Future Time Duty Radar */}
      <div className="no-print space-y-3">
        <StaffLeavePanel
          actorName="พี่กิ๊ก (Creator)"
          members={state.members}
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
          collapsed={Boolean(hiddenSections.staffLeave)}
          onToggleCollapse={() => toggleSection('staffLeave')}
        />
        {!hiddenSections.staffLeave && (
          <div className="rounded-[24px] border-2 border-[#C4DCF0] bg-[#FFFDF9] p-4 pastel-shadow space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-[#1E445C]">
                🕒 {lang === 'th' ? 'เรดาร์เช็คผู้เข้าเวร ณ วันที่/เวลาที่ต้องการ & ตารางกะพี่เลี้ยง' : 'Future Date-Time Duty Radar & Full Shift Roster'}
              </span>
              <button
                type="button"
                onClick={() => setShowRosterRadar((v) => !v)}
                className="rounded-xl border border-[#A7D3EC] bg-[#DCEEF8] hover:bg-[#C6E2F3] px-3 py-1.5 text-xs font-bold text-[#1E445C] cursor-pointer"
              >
                {showRosterRadar
                  ? lang === 'th'
                    ? 'ซ่อนเรดาร์เวลา ▴'
                    : 'Hide Time Radar ▴'
                  : lang === 'th'
                  ? 'เปิดเรดาร์เช็คเวรตามเวลา ▾'
                  : 'Open Time Duty Radar ▾'}
              </button>
            </div>
            {showRosterRadar && (
              <StaffRosterPanel
                now={now}
                lang={lang}
                isPublicHolidayToday={state.settings.isPublicHolidayToday}
                staffLeaves={staffLeaves}
                compactHeader
              />
            )}
          </div>
        )}
      </div>

      {/* 2C. Platform Sign-Up & Organization Approval Console (Platform Creator Only) */}
      {!isExternalTenant && cloudUser?.email === MASTER_ADMIN_EMAIL && (
        <section className="no-print rounded-[28px] border-2 border-[#9FE2D6] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-[#114A42]">
                🏛️ {lang === 'th' ? 'ศูนย์เปิดสิทธิ์ให้มูลนิธิ / องค์กรอื่นใช้งาน' : 'External Organization Access Approvals'}
              </h3>
              <p className="text-xs text-[#6E5C52] mt-0.5">
                {lang === 'th'
                  ? 'เห็นเฉพาะคำขอเปิดสิทธิ์และสถานะเท่านั้น — ระบบแยกฐานข้อมูลไม่ให้คุณเข้าดูข้อมูลภายในขององค์กรอื่นค่ะ'
                  : 'Manage organization access approvals only. Internal data of other foundations remains strictly private.'}
              </p>
            </div>
            {renderSectionToggleButton('registrations', 'bg-[#E8FAF6] hover:bg-[#DCF7F2] border-[#8FD4C6] text-[#114A42]')}
          </div>
          {!hiddenSections.registrations && (
            <AdminRegistrationsPanel
              cloudUser={cloudUser}
              lang={lang}
              onShowAlert={onShowAlert}
            />
          )}
        </section>
      )}

      {/* 3. Master Members & PIN Table */}
      <section className="no-print rounded-[28px] border-2 border-[#DCEEF8] bg-[#FFFDF9] p-5 pastel-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#3D322C]">
            🔑 {lang === 'th' ? `ตารางรวมรหัส PIN 4 หลัก (ทั้งหมด ${state.members.length} คน)` : `Master 4-Digit PIN Directory (${state.members.length} Members)`}
          </h3>
          {renderSectionToggleButton('pins', 'bg-[#DCEEF8] hover:bg-[#C6E2F3] border-[#A7D3EC] text-[#1E445C]')}
        </div>
        {!hiddenSections.pins && (
          <div className="overflow-x-auto max-h-96 overflow-y-auto mt-3">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 bg-[#FFFDF9]">
                <tr className="border-b-2 border-[#EBD8C3] text-xs text-[#6E5C52]">
                  <th className="py-2 pr-3">{lang === 'th' ? 'ตำแหน่ง / กลุ่ม' : 'Role / Group'}</th>
                  <th className="py-2 px-2">{lang === 'th' ? 'ชื่อเล่น' : 'Nickname'}</th>
                  <th className="py-2 px-2">{lang === 'th' ? 'ชื่อเต็ม' : 'Full Name'}</th>
                  <th className="py-2 px-2">{lang === 'th' ? 'เพศ' : 'Gender'}</th>
                  <th className="py-2 pl-2 text-right">PIN 4 หลัก</th>
                </tr>
              </thead>
              <tbody>
                {state.members.map((m) => (
                  <tr key={m.id} className="border-b border-[#F5ECE2] hover:bg-[#FFF5BA]/20">
                    <td className="py-2 pr-3 text-xs">
                      {m.role === 'manager'
                        ? 'ผู้จัดการ'
                        : m.role === 'staff'
                        ? 'พี่เลี้ยง'
                        : m.role === 'chef'
                        ? 'แม่ครัว'
                        : m.role === 'tutor'
                        ? 'ครูสอนพิเศษ'
                        : `เด็ก กลุ่ม ${m.group}`}
                    </td>
                    <td className="py-2 px-2 font-bold">
                      {m.emoji} {m.nickname}
                    </td>
                    <td className="py-2 px-2 text-xs text-[#6E5C52]">{m.fullName}</td>
                    <td className="py-2 px-2 text-xs">{m.gender}</td>
                    <td className="py-2 pl-2 text-right">
                      <input
                        type="text"
                        maxLength={4}
                        value={m.pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                          if (val.length === 4) {
                            const conflict = findPinConflict(
                              val,
                              state.members,
                              state.settings.creatorPins,
                              m.id
                            );
                            if (conflict.conflict) {
                              onShowAlert({
                                icon: '⚠️',
                                title: lang === 'th' ? 'รหัส PIN ซ้ำกับผู้ใช้อื่น!' : 'Duplicate PIN!',
                                message:
                                  lang === 'th'
                                    ? `รหัส "${val}" ถูกใช้งานโดย ${conflict.conflictOwnerLabel} อยู่แล้ว กรุณาใช้รหัสอื่นเพื่อไม่ให้สับสนเวลาล็อกอิน`
                                    : `PIN "${val}" is already used by ${conflict.conflictOwnerLabel}.`,
                                tone: 'pink',
                              });
                              return;
                            }
                          }
                          if (val.length <= 4) onUpdateMemberPin(m.id, val);
                        }}
                        className="w-20 rounded-xl border border-[#EBD8C3] bg-white px-2 py-1 text-center font-mono font-bold tabular-nums"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Barnhem Care & Kids Shop Manager */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <section className="lg:col-span-5 self-start rounded-[28px] border-2 border-[#FFF5BA] bg-[#FFFDF9] p-5 pastel-shadow">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-[#3D322C]">
              🏪 {lang === 'th' ? 'เพิ่มสินค้าเข้าร้าน Barnhem Shop' : 'Add Product to Barnhem Shop'}
            </h3>
            {renderSectionToggleButton('shopAdd', 'bg-[#FFF5BA] hover:bg-[#FCEB8E] border-[#F4DB73] text-[#5A4208]')}
          </div>
          {!hiddenSections.shopAdd && (
            <form onSubmit={handleCreateItem} className="space-y-3 text-sm mt-3">
              <input
                type="text"
                value={itemNameTh}
                onChange={(e) => setItemNameTh(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อสินค้า (ภาษาไทย)' : 'Product Name (TH)'}
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5"
              />
              <input
                type="text"
                value={itemNameEn}
                onChange={(e) => setItemNameEn(e.target.value)}
                placeholder={lang === 'th' ? 'ชื่อสินค้า (English - ถ้ามี)' : 'Product Name (EN)'}
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  value={itemPrice}
                  onChange={(e) => setItemPrice(Number(e.target.value))}
                  placeholder="ราคาดาว"
                  className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
                />
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value as ShopCategory)}
                  className="rounded-xl border border-[#EBD8C3] bg-white px-2 py-2"
                >
                  <option value="snack">มินิมาร์ท / ขนม</option>
                  <option value="cover_item">ไอเทมแต่งปก</option>
                </select>
                <input
                  type="text"
                  value={itemEmoji}
                  onChange={(e) => setItemEmoji(e.target.value)}
                  placeholder="อิโมจิ"
                  className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-center"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-[#D6BFA8] bg-[#FFFDF9] p-3">
                <label className="block text-xs font-bold text-[#6E5C52] mb-1.5">
                  📷 {lang === 'th' ? 'อัปโหลดรูปภาพสินค้าจากเครื่อง (แปลงเป็น Base64)' : 'Upload Product Image (Saved as Base64)'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="text-xs w-full"
                />
                {itemImageBase64 && (
                  <img
                    src={itemImageBase64}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="mt-2 h-16 w-16 rounded-xl object-cover border border-[#EBD8C3]"
                  />
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer"
              >
                ➕ {lang === 'th' ? 'เพิ่มรายการสินค้า' : 'Add Shop Item'}
              </button>
            </form>
          )}
        </section>

        <section className="lg:col-span-7 self-start rounded-[28px] border-2 border-[#FADADD] bg-[#FFFDF9] p-5 pastel-shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-[#3D322C]">
                🛍️ {lang === 'th' ? `รายการสินค้ามินิมาร์ท & ร้านค้า (${state.shopItems.length})` : `All Minimart & Shop Products (${state.shopItems.length})`}
              </h3>
              {!hiddenSections.shopList && (
                <span className="text-[11px] font-semibold text-[#7B695F]">
                  {lang === 'th' ? '✏️ แก้ไขยอดดาวได้ทันทีในช่อง ⭐' : '✏️ Edit star prices inline'}
                </span>
              )}
            </div>
            {renderSectionToggleButton('shopList', 'bg-[#FADADD] hover:bg-[#F5C2C8] border-[#E6889F] text-[#6E2638]')}
          </div>
          {!hiddenSections.shopList && (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 mt-3">
              {state.shopItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-[#EBD8C3] bg-white px-3.5 py-2 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-[#FFF5BA]/70 flex items-center justify-center text-xl overflow-hidden">
                      {item.imageBase64 ? (
                        <img
                          src={item.imageBase64}
                          alt={item.nameTh}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        item.emoji
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#3D322C] truncate">{item.nameTh}</div>
                      <div className="text-xs text-[#7B695F] tabular-nums">
                        {item.category === 'snack' ? '🏪 มินิมาร์ท & ขนม (ใช้ดาว)' : '🎨 ไอเทมแต่งปก'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1 rounded-xl border border-[#F4DB73] bg-[#FFF5BA]/60 px-2 py-1 text-xs font-bold text-[#3D322C]">
                      <span>⭐</span>
                      <input
                        type="number"
                        min={1}
                        max={99999}
                        value={item.priceStars}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!Number.isNaN(val) && val >= 1) {
                            onUpdateShopItemPrice(item.id, val);
                          }
                        }}
                        aria-label={`แก้ไขจำนวนดาวสำหรับ ${item.nameTh}`}
                        className="w-14 bg-white rounded-lg border border-[#EBD8C3] px-1.5 py-0.5 text-center font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#FADADD]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onDeleteShopItem(item.id)}
                      className="rounded-xl bg-[#FADADD] hover:bg-[#F3B7C0] px-3 py-1.5 text-xs font-bold text-[#7B2E3B] cursor-pointer"
                    >
                      {lang === 'th' ? 'ลบ' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 5. MOVED DOWN: QR Code & A4 Barcode Print Studio + Express Kiosk Launcher */}
      <QrBarcodeSheet
        kids={kids}
        lang={lang}
        onOpenExpressKiosk={onOpenExpressKiosk}
        collapsed={Boolean(hiddenSections.qr)}
        onToggleCollapse={() => toggleSection('qr')}
      />

      {/* 6. Settings, Passwords, Backup & Holiday / Festival */}
      <section className="no-print rounded-[28px] border-2 border-[#D4F0F0] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#3D322C]">
            ⚙️ {lang === 'th' ? 'ตั้งค่ารหัสผ่าน การสำรองข้อมูล & เชื่อมต่อ Google Drive / Sheets' : 'Passwords, Backup & Sync Settings'}
          </h3>
          {renderSectionToggleButton('settings', 'bg-[#D4F0F0] hover:bg-[#B8E5E1] border-[#8AD9CA] text-[#114A42]')}
        </div>

        {!hiddenSections.settings && (
          <>
            {/* Per-Org Storage Mode & Free Space Optimization Banner */}
            <div className="rounded-2xl border-2 border-[#B9E8DF] bg-[#F2FCF9] p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 max-w-2xl">
                  <div className="text-sm font-extrabold text-[#114A42]">
                    💾 {lang === 'th' ? 'โหมดจัดเก็บข้อมูลขององค์กร (ประหยัดพื้นที่ฟรี)' : 'Organization Storage Mode (Space Saver)'}
                  </div>
                  <p className="text-xs text-[#2E5D55] leading-relaxed">
                    {isExternalTenant
                      ? lang === 'th'
                        ? 'เลือกเก็บข้อมูลไว้บนเครื่อง + Google Sheet/Drive ขององค์กรคุณเอง (0 KB บนระบบกลาง) หรือใช้คลาวด์ระบบกลางแบบตัดประวัติอัตโนมัติเหลือ 7-14 วันล่าสุด'
                        : 'Store locally + your own Google Sheet/Drive (0 KB central cloud), or use central sync (auto-trimmed to recent 7-14 days).'
                      : lang === 'th'
                      ? 'ระบบคลาวด์กลางจะตัดประวัติรายวัน/รายสัปดาห์ที่เก่ากว่า 7-14 วันอัตโนมัติเพื่อให้องค์กรใช้งานได้ฟรี และแต่ละองค์กรยังสามารถเชื่อมต่อ Google Sheet / Drive ของตัวเองได้ด้วยค่ะ'
                      : 'Central cloud sync automatically trims daily/weekly logs older than 7-14 days to preserve free tier quota.'}
                  </p>
                </div>

                {isExternalTenant && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ useOwnStorageOnly: false })}
                      className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                        !state.settings.useOwnStorageOnly
                          ? 'bg-[#114A42] text-white border-[#114A42]'
                          : 'bg-white text-[#3D322C] border-[#B9E8DF] hover:bg-[#E8FAF6]'
                      }`}
                    >
                      ☁️ {lang === 'th' ? 'ซิงก์หลายเครื่อง (เก็บประวัติ 7 วัน)' : 'Cloud Sync (7-Day History)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ useOwnStorageOnly: true });
                        onShowAlert({
                          icon: '💾',
                          title: lang === 'th' ? 'เปิดโหมดประหยัดพื้นที่องค์กรแล้ว (0%)' : 'Own Storage Mode Enabled',
                          message:
                            lang === 'th'
                              ? 'ข้อมูลขององค์กรคุณจะเก็บในเครื่องนี้และส่งเข้า Google Sheet ขององค์กรคุณเองเท่านั้น โดยไม่ใช้พื้นที่คลาวด์กลางค่ะ'
                              : 'Data will stay local and sync only to your organization Google Sheet.',
                          tone: 'mint',
                        });
                      }}
                      className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                        state.settings.useOwnStorageOnly
                          ? 'bg-[#114A42] text-white border-[#114A42]'
                          : 'bg-white text-[#3D322C] border-[#B9E8DF] hover:bg-[#E8FAF6]'
                      }`}
                    >
                      🏠 {lang === 'th' ? 'เก็บเอง + Google Sheet (ไม่ใช้พื้นที่กลาง 0%)' : 'Local + Own Google Sheet (0% Cloud)'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAppsScriptHelper((v) => !v)}
                  className="min-h-[36px] rounded-xl border border-[#8FD4C6] bg-white hover:bg-[#E8FAF6] px-3 py-1.5 text-xs font-bold text-[#114A42] cursor-pointer"
                >
                  📄 {showAppsScriptHelper
                    ? lang === 'th'
                      ? 'ซ่อนคู่มือต่อ Google Sheet ของตัวเอง'
                      : 'Hide Google Sheet Guide'
                    : lang === 'th'
                    ? 'ดูวิธีผูก Google Sheet ขององค์กรเอง (ฟรี 100%)'
                    : 'How to Connect Your Own Google Sheet (Free)'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyTextToClipboard(GOOGLE_APPS_SCRIPT_TEMPLATE);
                    onShowAlert({
                      icon: '📋',
                      title: ok
                        ? lang === 'th'
                          ? 'คัดลอกโค้ด Google Apps Script แล้ว!'
                          : 'Apps Script Code Copied!'
                        : lang === 'th'
                        ? 'คัดลอกโค้ดสำหรับ Google Sheet'
                        : 'Apps Script Code',
                      message:
                        lang === 'th'
                          ? 'นำไปวางใน Google Sheet ขององค์กร > ส่วนขยาย (Extensions) > Apps Script แล้วกด Deploy เป็น Web App (Anyone) จากนั้นนำ URL มาวางในช่องลิงก์ซิงค์ด้านล่างค่ะ'
                          : 'Paste into Google Sheets > Extensions > Apps Script, deploy as Web App (Anyone), and paste the URL below.',
                      tone: 'mint',
                    });
                  }}
                  className="min-h-[36px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
                >
                  📋 {lang === 'th' ? 'คัดลอกโค้ด Apps Script สำเร็จรูป' : 'Copy Apps Script Template'}
                </button>
              </div>

              {showAppsScriptHelper && (
                <div className="rounded-xl border border-[#B9E8DF] bg-white p-3 space-y-2 text-xs text-[#3D322C]">
                  <div className="font-bold text-[#114A42]">
                    {lang === 'th'
                      ? 'ขั้นตอนเชื่อมต่อ Google Sheet ของมูลนิธิคุณเอง (ทำครั้งเดียว 2 นาที):'
                      : '3-Step Own Google Sheet Setup:'}
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[#4F433C]">
                    <li>
                      {lang === 'th'
                        ? 'สร้าง Google Sheet ใหม่ในบัญชี Google ขององค์กรคุณ (เช่น อีเมลขององค์กร)'
                        : 'Create a new Google Sheet inside your organization Google account.'}
                    </li>
                    <li>
                      {lang === 'th'
                        ? 'กดเมนู ส่วนขยาย (Extensions) → Apps Script แล้ววางโค้ดที่คัดลอกจากปุ่มด้านบน'
                        : 'Open Extensions → Apps Script and paste the copied script.'}
                    </li>
                    <li>
                      {lang === 'th'
                        ? 'กด ทำให้ใช้งานได้ (Deploy) → รายการใหม่ → Web app (ผู้มีสิทธิ์เข้าถึง: ทุกคน / Anyone) แล้วนำลิงก์ Web app URL มาวางช่องด้านล่าง'
                        : 'Deploy → New deployment → Web app (Who has access: Anyone), then paste the Web app URL below.'}
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <label className="font-bold text-[#3D322C] block">
                  🔗 {lang === 'th' ? 'ลิงก์ซิงค์ฐานข้อมูล / Google Sheet ขององค์กร (POST JSON)' : 'Organization Google Sheet Webhook URL (POST JSON)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ syncWebhookUrl: webhookInput.trim() });
                      onShowAlert({
                        icon: '🔗',
                        title: lang === 'th' ? 'บันทึกลิงก์เชื่อมต่อ Google Sheet แล้ว' : 'Sync URL Saved',
                        message: webhookInput.trim() || (lang === 'th' ? 'ล้างลิงก์เรียบร้อยแล้ว' : 'Cleared.'),
                        tone: 'mint',
                      });
                    }}
                    className="rounded-xl bg-[#3D322C] text-white px-4 py-2 font-bold cursor-pointer"
                  >
                    {lang === 'th' ? 'บันทึก' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-[#3D322C] block">
                  📸 {lang === 'th' ? 'โฟลเดอร์ Google Drive ขององค์กร (เก็บรูป/เอกสาร)' : 'Organization Google Drive Folder URL'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={returnDriveInput}
                    onChange={(e) => setReturnDriveInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="flex-1 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ returnHomeDriveUrl: returnDriveInput.trim() });
                      onShowAlert({
                        icon: '📸',
                        title: lang === 'th' ? 'บันทึกลิงก์โฟลเดอร์ Google Drive แล้ว' : 'Drive URL Saved',
                        message: returnDriveInput.trim() || (lang === 'th' ? 'ล้างลิงก์เรียบร้อยแล้ว' : 'Cleared.'),
                        tone: 'mint',
                      });
                    }}
                    className="rounded-xl bg-[#3D322C] text-white px-4 py-2 font-bold cursor-pointer"
                  >
                    {lang === 'th' ? 'บันทึก' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-[#3D322C] block">
                  🔐 {lang === 'th' ? 'ตั้งค่ารหัสผ่านโหมดผู้สร้าง (2 รหัส)' : 'Creator Access PINs (2 Codes)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={creatorPin1}
                    onChange={(e) => setCreatorPin1(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-24 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-center font-mono font-bold"
                  />
                  <input
                    type="text"
                    maxLength={4}
                    value={creatorPin2}
                    onChange={(e) => setCreatorPin2(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-24 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-center font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!/^\d{4}$/.test(creatorPin1) || !/^\d{4}$/.test(creatorPin2)) {
                        onShowAlert({
                          icon: '⚠️',
                          title: 'PIN ต้องเป็นตัวเลข 4 หลัก',
                          message: 'กรุณาใส่รหัสตัวเลข 4 หลักทั้ง 2 ช่อง',
                          tone: 'yellow',
                        });
                        return;
                      }
                      if (creatorPin1 === creatorPin2) {
                        onShowAlert({
                          icon: '⚠️',
                          title: lang === 'th' ? 'รหัส 2 ช่องห้ามซ้ำกัน' : 'PINs Must Differ',
                          message: lang === 'th' ? 'กรุณาตั้งรหัสลับทั้ง 2 รหัสให้แตกต่างกัน' : 'Please use two different 4-digit PINs.',
                          tone: 'yellow',
                        });
                        return;
                      }
                      const c1 = findPinConflict(creatorPin1, state.members, []);
                      const c2 = findPinConflict(creatorPin2, state.members, []);
                      if (c1.conflict || c2.conflict) {
                        const who = c1.conflict ? c1.conflictOwnerLabel : c2.conflictOwnerLabel;
                        onShowAlert({
                          icon: '⚠️',
                          title: lang === 'th' ? 'รหัสชนกับสมาชิกในบ้าน!' : 'PIN Collides with Member!',
                          message:
                            lang === 'th'
                              ? `รหัสนี้ถูกใช้งานโดย ${who} อยู่แล้ว กรุณาใช้รหัสอื่น`
                              : `PIN collides with ${who}.`,
                          tone: 'pink',
                        });
                        return;
                      }
                      onUpdateSettings({ creatorPins: [creatorPin1, creatorPin2] });
                      onShowAlert({
                        icon: '🔐',
                        title: lang === 'th' ? 'อัปเดตรหัสผ่านแล้ว' : 'Creator PINs Updated',
                        message: lang === 'th' ? 'บันทึกรหัสผ่านโหมดผู้สร้างเรียบร้อยแล้ว' : 'Creator PINs updated successfully.',
                        tone: 'mint',
                      });
                    }}
                    className="rounded-xl bg-[#3D322C] text-white px-4 py-2 font-bold cursor-pointer"
                  >
                    {lang === 'th' ? 'อัปเดต PIN' : 'Update'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => downloadJsonBackup(state)}
                className="min-h-[44px] rounded-2xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#F4DB73] px-5 py-2 text-sm font-bold text-[#3D322C] cursor-pointer"
              >
                💾 {lang === 'th' ? 'ดาวน์โหลดไฟล์สำรองข้อมูล (.json)' : 'Download Backup (.json)'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!state.settings.syncWebhookUrl?.trim()) {
                    onShowAlert({
                      icon: '⚠️',
                      title: lang === 'th' ? 'ยังไม่ได้ใส่ลิงก์ Google Sheet' : 'No Sync URL Configured',
                      message:
                        lang === 'th'
                          ? 'กรุณานำลิงก์ Web App URL จาก Google Sheet ขององค์กรมาวางในช่องด้านบนและกด "บันทึก" ก่อนค่ะ'
                          : 'Please save your organization Google Sheet Web App URL above first.',
                      tone: 'yellow',
                    });
                    return;
                  }
                  await onManualSync();
                  onShowAlert({
                    icon: '📤',
                    title: lang === 'th' ? 'ทดสอบส่งเข้า Google Sheet แล้ว!' : 'Sync Dispatched!',
                    message:
                      lang === 'th'
                        ? 'ส่งข้อมูลแบบ POST (JSON) ไปยัง Google Sheet ที่ตั้งค่าไว้เรียบร้อยแล้ว กรุณาตรวจเช็กแท็บ Logs ในชีตของคุณค่ะ'
                        : 'POST (JSON) sync request dispatched to configured Google Sheet URL.',
                    tone: 'blue',
                  });
                }}
                className="min-h-[44px] rounded-2xl bg-[#DCEEF8] hover:bg-[#C6E2F3] border border-[#BEDBF0] px-5 py-2 text-sm font-bold text-[#28445A] cursor-pointer"
              >
                📤 {lang === 'th' ? 'ทดสอบส่งเข้า Google Sheet ทันที (POST JSON)' : 'Test Sync to Google Sheet (POST JSON)'}
              </button>

              <label className="inline-flex items-center gap-2 rounded-2xl bg-[#FADADD]/60 px-4 py-2.5 text-sm font-bold text-[#3D322C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.settings.isPublicHolidayToday}
                  onChange={(e) => onUpdateSettings({ isPublicHolidayToday: e.target.checked })}
                  className="h-4 w-4 accent-[#3D322C]"
                />
                <span>🏖️ {lang === 'th' ? 'กำหนดให้วันนี้เป็นวันหยุดนักขัตฤกษ์ (ปลดล็อกชุดใส่เที่ยว)' : 'Mark Today as Public Holiday'}</span>
              </label>

              <div className="inline-flex items-center gap-2 rounded-2xl bg-[#EFE8FC]/80 border border-[#C8B7EB] px-4 py-2 text-sm font-bold text-[#3E2B63]">
                <span>🎊 {lang === 'th' ? 'โหมดเทศกาล:' : 'Festival Mode:'}</span>
                <select
                  value={state.settings.activeFestivalOverride ?? 'auto'}
                  onChange={(e) =>
                    onUpdateSettings({
                      activeFestivalOverride: e.target.value as FestivalId | 'auto' | 'none',
                    })
                  }
                  className="rounded-xl border border-[#C8B7EB] bg-white px-2.5 py-1 text-xs font-bold text-[#3D322C]"
                >
                  <option value="auto">
                    🤖 {lang === 'th' ? 'อัตโนมัติตามวันเทศกาลจริง (แนะนำ)' : 'Auto by Calendar (Recommended)'}
                  </option>
                  {FESTIVAL_CATALOG.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.emoji} {lang === 'th' ? `${f.nameTh} (${f.dateWindowTh})` : `${f.nameEn} (${f.dateWindowEn})`}
                    </option>
                  ))}
                  <option value="none">
                    ⛔ {lang === 'th' ? 'ปิดโหมดเทศกาลชั่วคราว' : 'Disable Festival Mode'}
                  </option>
                </select>
              </div>
            </div>

            <TimedScheduleEditorCard
              settings={state.settings}
              lang={lang}
              onSave={(timedCommandSchedule, homeworkCurfewMins) => {
                onUpdateSettings({ timedCommandSchedule, homeworkCurfewMins });
                onShowAlert({
                  icon: '⚙️',
                  title: lang === 'th' ? 'อัปเดตตารางเวลาคำสั่งทั้งหมดแล้ว!' : 'Schedules Updated!',
                  message:
                    lang === 'th'
                      ? 'ระบบได้บันทึกเวลาเปิด–ปิดของทุกคำสั่งและเส้นตายคืนมือถือเรียบร้อยแล้ว มีผลทันทีทั้งหน้าแรกและหน้าของน้องค่ะ'
                      : 'All core command windows and curfew deadlines are now live across all views.',
                  tone: 'mint',
                });
              }}
            />

            <CommandPermissionsEditorCard
              members={state.members}
              settings={state.settings}
              lang={lang}
              onSave={(kidsWithoutPhoneIds, commandPermissions) => {
                onUpdateSettings({ kidsWithoutPhoneIds, commandPermissions });
                onShowAlert({
                  icon: '👥📱',
                  title:
                    lang === 'th'
                      ? 'บันทึกสถานะมือถือและสิทธิ์การกดปุ่มแล้ว!'
                      : 'Phone Status & Permissions Saved!',
                  message:
                    lang === 'th'
                      ? 'อัปเดตรายชื่อน้องที่มี/ไม่มีมือถือ และสิทธิ์การกดของแต่ละปุ่มเรียบร้อยแล้ว มีผลทันทีทั้งหน้าแรกและหน้าของน้องค่ะ'
                      : 'Kid phone ownership and per-button permissions are now active.',
                  tone: 'mint',
                });
              }}
            />
          </>
        )}
      </section>

      {/* 7. Real-time Cloud Sync & 1-Click LINE Executive Digest */}
      <CloudSyncBanner
        cloudUser={cloudUser}
        cloudSyncing={cloudSyncing}
        state={state}
        now={now}
        lang={lang}
        onForceSeedCloud={onForceSeedCloud}
        onShowAlert={onShowAlert}
        collapsed={Boolean(hiddenSections.cloud)}
        onToggleCollapse={() => toggleSection('cloud')}
      />
    </div>
  );
};
