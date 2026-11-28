import React, { useEffect, useRef, useState } from 'react';
import { COVER_SCENES } from '../data/initialData';
import { signInWithGoogleCloud } from '../firebase';
import {
  Announcement,
  AppSettings,
  AvatarBodyType,
  AvatarFaceMood,
  AvatarSkinTone,
  CustomOutfitDesign,
  DeedRedemption,
  FestivalId,
  FriendVisitActivity,
  FriendVisitRequest,
  GoldenPoolLog,
  HealthProfile,
  KindnessCard,
  Language,
  LinkedKidSession,
  LostFoundItem,
  Member,
  ModalAlertPayload,
  OutfitMode,
  OutingTrip,
  PetCompanionConfig,
  PrivateCareMessage,
  ReturnHomePhoto,
  SecretPoll,
  ShopItem,
  SickReport,
  SnackBill,
  StaffLeaveRecord,
  SupplyRequest,
} from '../types/barnhem';
import { applyMorningStreakOnTime, getDailyHouseChoreForKid } from '../utils/houseChores';
import { getTrashDutyInfoForDate, isKidAssignedTrashWeek } from '../utils/trashDuty';
import {
  getActiveFestival,
  getAnnouncementScheduleStatus,
  getDynamicTimeEventAnnouncement,
} from '../utils/festivalAndEvents';
import {
  applyDailySchoolDeduction,
  computeGoldenPoolBalance,
  ensureCurrentWeekAllowance,
  getKidEconomyConfig,
  isKidAwayOnDate,
} from '../utils/piggyBank';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  getActiveKidAwaySecretCode,
  usePinGuard,
} from '../utils/pinGuard';
import {
  canWearCasualOutfitNow,
  formatDigitalClock,
  getBossStageLanguageLesson,
  getDateKey,
  getLaundryQueueInfo,
  getMinutesOfDay,
  getTomorrowDateKey,
  isPublicHoliday,
} from '../utils/timeRules';
import { getStaffScheduleForDate } from '../data/staffSchedule';
import {
  computeLivePetStats,
  createAdoptedPet,
  getNextFedPetState,
  getPetFeedStarStatus,
  getPetSpeciesInfo,
  PET_DAILY_FEED_STAR_CAP,
  PET_FEED_STAR_REWARD,
  PET_SPECIES_CATALOG,
} from '../utils/petCare';
import {
  applyWeekendHolidayLatePenaltyToMember,
  canKidUseCommand,
  doesKidHavePhone,
  evaluateKidReturnPhoneSchedule,
  evaluateOneTapHomeAction,
  formatThaiCurfewClock,
  getAutoReturnPhoneRuleConfig,
  getComputerHomeworkPrereqStatus,
  getEffectiveHomeQuickActions,
  getEffectiveHomeworkPermissionWindow,
  getEffectiveMorningPhoneWindow,
  getEffectiveWeekendLatePenaltyPreset,
  getPenaltySummaryText,
  isHomeActionOpenAt,
  KioskPenaltyAlert,
  minsToHHMM,
  resolveSaturdayLatePenaltyFromPolls,
} from '../utils/expressKiosk';
import { evaluateKidStepReminders } from '../utils/stepReminders';
import { PinPadModal } from './CenteredAlertModal';
import { CustomOutfitStudio } from './CustomOutfitStudio';
import { FridayBalloonBanner } from './FridayBalloonBanner';
import { HolidayCheckInNoticeCard } from './HolidayCheckInNoticeCard';
import { HouseRulesGuideView } from './HouseRulesGuideView';
import { KidDutySchedulesPanel } from './KidDutySchedulesPanel';
import { PenaltyNoticeModal } from './PenaltyNoticeModal';
import { PetCanvasSvg } from './PetCanvasSvg';
import { PetTamagotchiModal } from './PetTamagotchiModal';
import { PiggyBankModals } from './PiggyBankModals';
import { StaffRosterPanel } from './StaffRosterPanel';

interface KidHubViewProps {
  kid: Member;
  allMembers: Member[];
  creatorPins: string[];
  shopItems: ShopItem[];
  snackBills: SnackBill[];
  sickReports: SickReport[];
  returnHomePhotos: ReturnHomePhoto[];
  returnHomeDriveUrl: string;
  announcements: Announcement[];
  polls: SecretPoll[];
  trips: OutingTrip[];
  privateMessages: PrivateCareMessage[];
  lostFoundItems: LostFoundItem[];
  supplyRequests: SupplyRequest[];
  kindnessCards: KindnessCard[];
  deedRedemptions: DeedRedemption[];
  friendVisits: FriendVisitRequest[];
  goldenPoolLogs?: GoldenPoolLog[];
  staffLeaves?: StaffLeaveRecord[];
  settings?: AppSettings;
  now: Date;
  isPublicHolidayToday: boolean;
  activeFestivalOverride?: FestivalId | 'auto' | 'none';
  lang: Language;
  openedFromManager?: boolean;
  linkedKidSession?: LinkedKidSession | null;
  cloudUserEmail?: string | null;
  onSignOutLinkedKid?: () => void;
  onBack: () => void;
  onUpdateKid: (kidId: string, updater: (prev: Member) => Member, eventLabel: string) => void;
  onRecordRulePenalty?: (
    kidId: string,
    amountThb: number,
    reason: string,
    recordedBy: string,
    extraMemberUpdater?: (prev: Member) => Member
  ) => void;
  onAddSickReport: (report: SickReport) => void;
  onAddSnackBill: (bill: SnackBill) => void;
  onSaveReturnHomePhoto: (photo: ReturnHomePhoto) => void;
  onCastSecretVote: (pollId: string, optionId: string, kidId: string) => void;
  onToggleTripRsvp: (tripId: string, kidId: string) => void;
  onSendPrivateMessage: (msg: PrivateCareMessage) => void;
  onAddLostFound: (item: LostFoundItem) => void;
  onClaimLostFound: (itemId: string, kid: Member) => void;
  onSubmitSupplyRequest: (req: SupplyRequest) => void;
  onSendKindnessCard: (card: KindnessCard) => void;
  onSubmitDeedRedemption: (deedId: string) => void;
  onSendFriendVisitRequest: (req: FriendVisitRequest) => void;
  onRespondFriendVisit: (visitId: string, decision: 'accepted' | 'declined' | 'ended') => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

type ActiveSubModal =
  | null
  | 'all_tools_modal'
  | 'shift_morning'
  | 'shift_afternoon'
  | 'shift_night'
  | 'my_space'
  | 'sick_report'
  | 'star_history'
  | 'drive_docs'
  | 'penalty_status'
  | 'rules_schedule'
  | 'shop_modal'
  | 'wardrobe_modal'
  | 'announcements_modal'
  | 'vote_modal'
  | 'trips_modal'
  | 'health_card'
  | 'supply_wishlist'
  | 'lost_found_modal'
  | 'kindness_deed_modal'
  | 'friend_visit_modal'
  | 'staff_roster'
  | 'kid_duties_modal'
  | 'pet_modal'
  | 'profile_modal';

export const KidHubView: React.FC<KidHubViewProps> = ({
  kid,
  allMembers,
  creatorPins,
  shopItems,
  snackBills,
  sickReports,
  returnHomePhotos,
  returnHomeDriveUrl,
  announcements,
  polls,
  trips,
  privateMessages,
  lostFoundItems,
  supplyRequests,
  kindnessCards,
  deedRedemptions,
  friendVisits,
  goldenPoolLogs = [],
  staffLeaves = [],
  settings,
  now,
  isPublicHolidayToday,
  activeFestivalOverride = 'auto',
  lang,
  openedFromManager,
  linkedKidSession = null,
  cloudUserEmail = null,
  onSignOutLinkedKid,
  onBack,
  onUpdateKid,
  onRecordRulePenalty,
  onAddSickReport,
  onAddSnackBill,
  onSaveReturnHomePhoto,
  onCastSecretVote,
  onToggleTripRsvp,
  onSendPrivateMessage,
  onAddLostFound,
  onClaimLostFound,
  onSubmitSupplyRequest,
  onSendKindnessCard,
  onSubmitDeedRedemption,
  onSendFriendVisitRequest,
  onRespondFriendVisit,
  onShowAlert,
}) => {
  const [subModal, setSubModal] = useState<ActiveSubModal>(null);
  const [piggyModal, setPiggyModal] = useState<'pink' | 'gold' | null>(null);
  const [shopFilter, setShopFilter] = useState<'all' | 'snack' | 'wardrobe' | 'festival' | 'scene' | 'history'>('all');
  const [hwSubject, setHwSubject] = useState('');
  const [hwPermPopupOpen, setHwPermPopupOpen] = useState(false);
  const [sickSymptoms, setSickSymptoms] = useState('มีไข้ / ตัวร้อน');
  const [sickDetails, setSickDetails] = useState('');
  const [pendingSickLineText, setPendingSickLineText] = useState<string | null>(null);
  const [sickLineCopied, setSickLineCopied] = useState(false);
  const [selectedVoteOptions, setSelectedVoteOptions] = useState<Record<string, string>>({});
  const [dmText, setDmText] = useState('');
  const [dmTripId, setDmTripId] = useState<string>('');
  const [mySpaceForm, setMySpaceForm] = useState(kid.mySpace);
  const [linkedEmailForm, setLinkedEmailForm] = useState(kid.linkedEmail ?? '');
  const [emailLoginBusy, setEmailLoginBusy] = useState(false);
  const [petHeroToast, setPetHeroToast] = useState<string | null>(null);
  const [pinRequestAction, setPinRequestAction] = useState<
    null | { type: 'boss_stage' | 'g2_evening_phone' | 'computer_homework' }
  >(null);

  const isKidSignedInWithEmail =
    Boolean(linkedKidSession && linkedKidSession.memberId === kid.id) ||
    Boolean(
      cloudUserEmail &&
        kid.linkedEmail &&
        cloudUserEmail.trim().toLowerCase() === kid.linkedEmail.trim().toLowerCase()
    );
  const displayStars = isKidSignedInWithEmail ? kid.stars : 0;
  const coinsEnabled = Boolean(settings?.enableCoinsAndPiggyBank);

  useEffect(() => {
    setLinkedEmailForm(kid.linkedEmail ?? '');
  }, [kid.id, kid.linkedEmail]);

  // Health profile editor state
  const [healthForm, setHealthForm] = useState<HealthProfile>(
    kid.healthProfile ?? {
      bloodType: 'ไม่ระบุ',
      foodAllergies: 'ไม่มี',
      drugAllergies: 'ไม่มี',
      chronicConditions: 'ไม่มี',
      regularMeds: 'ไม่มี',
      emergencyNote: '',
    }
  );

  // Supply wishlist composer state
  const [supplyName, setSupplyName] = useState('');
  const [supplyCat, setSupplyCat] = useState<SupplyRequest['category']>('hygiene');
  const [supplyUrgency, setSupplyUrgency] = useState<SupplyRequest['urgency']>('normal');
  const [supplyNote, setSupplyNote] = useState('');

  // Lost & found composer state
  const [lfTitle, setLfTitle] = useState('');
  const [lfDesc, setLfDesc] = useState('');
  const [lfLocation, setLfLocation] = useState('');
  const [lfStatus, setLfStatus] = useState<'lost' | 'found'>('lost');
  const [lfPhotoBase64, setLfPhotoBase64] = useState<string | undefined>(undefined);

  // Kindness shout-out composer state
  const [kindTargetId, setKindTargetId] = useState('');
  const [kindMessage, setKindMessage] = useState('');

  // Friend Visit composer state
  const [visitTargetKidId, setVisitTargetKidId] = useState('');
  const [visitActivity, setVisitActivity] = useState<FriendVisitActivity>('study');
  const [visitNote, setVisitNote] = useState('');
  const [stepPopupOpen, setStepPopupOpen] = useState(false);
  const [penaltyNoticePopup, setPenaltyNoticePopup] = useState<KioskPenaltyAlert | null>(null);
  const actionLockRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const staffPinGuard = usePinGuard('kid_staff_pin');

  const handleLfPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 420;
        const w = Math.min(maxW, img.width || maxW);
        const h = Math.round(((img.height || 300) / (img.width || maxW)) * w);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        setLfPhotoBase64(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Return Home Camera state
  const returnCamVideoRef = useRef<HTMLVideoElement | null>(null);
  const returnCamStreamRef = useRef<MediaStream | null>(null);
  const [returnCamActive, setReturnCamActive] = useState(false);
  const [returnCamError, setReturnCamError] = useState<string | null>(null);
  const [capturedPhotoDataUrl, setCapturedPhotoDataUrl] = useState<string | null>(null);

  const stopReturnCamera = () => {
    if (returnCamStreamRef.current) {
      returnCamStreamRef.current.getTracks().forEach((t) => t.stop());
      returnCamStreamRef.current = null;
    }
    setReturnCamActive(false);
  };

  useEffect(() => {
    if (subModal !== 'shift_afternoon') {
      stopReturnCamera();
    }
    return () => {
      if (returnCamStreamRef.current) {
        returnCamStreamRef.current.getTracks().forEach((t) => t.stop());
        returnCamStreamRef.current = null;
      }
    };
  }, [subModal]);

  const startReturnCamera = async () => {
    setReturnCamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setReturnCamError(
        lang === 'th'
          ? 'อุปกรณ์นี้ไม่รองรับการเปิดกล้องสด กรุณาใช้ปุ่ม "เลือกรูป / ถ่ายจากกล้องเครื่อง" ด้านล่างได้เลย'
          : 'Live camera unavailable. Please use the "Choose / Take Photo" button below.'
      );
      return;
    }
    try {
      stopReturnCamera();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      returnCamStreamRef.current = stream;
      setReturnCamActive(true);
      window.setTimeout(async () => {
        if (returnCamVideoRef.current) {
          returnCamVideoRef.current.srcObject = stream;
          try {
            await returnCamVideoRef.current.play();
          } catch {
            // ignore autoplay errors
          }
        }
      }, 60);
    } catch {
      setReturnCamError(
        lang === 'th'
          ? 'ไม่สามารถเข้าถึงกล้องสดได้ (อาจถูกบล็อกสิทธิ์ในเบราว์เซอร์) สามารถกดปุ่ม "ถ่ายรูป / เลือกรูปภาพ" ด้านล่างแทนได้เลย!'
          : 'Camera permission blocked. Use the "Take / Upload Photo" button below instead!'
      );
    }
  };

  const stampAndSavePreview = (drawSource: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSource(ctx, w, h);

    // Stamp kid nickname & timestamp at bottom
    const barH = Math.max(36, Math.round(h * 0.11));
    ctx.fillStyle = 'rgba(61, 50, 44, 0.72)';
    ctx.fillRect(0, h - barH, w, barH);
    ctx.fillStyle = '#FFFDF9';
    ctx.font = `bold ${Math.max(13, Math.round(barH * 0.46))}px sans-serif`;
    const stampText = `Barnhem Check-in · ${kid.nickname} (${kid.id.toUpperCase()}) · ${formatDigitalClock(now)}`;
    ctx.fillText(stampText, 12, h - Math.round(barH * 0.34));

    setCapturedPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.86));
  };

  const captureReturnPhoto = () => {
    const video = returnCamVideoRef.current;
    if (!video || !video.videoWidth) return;
    const targetW = Math.min(640, video.videoWidth);
    const targetH = Math.round((video.videoHeight / video.videoWidth) * targetW);
    stampAndSavePreview(
      (ctx, w, h) => {
        ctx.drawImage(video, 0, 0, w, h);
      },
      targetW,
      targetH
    );
    stopReturnCamera();
  };

  const handleReturnPhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const targetW = Math.min(640, img.width || 640);
        const targetH = Math.round(((img.height || 480) / (img.width || 640)) * targetW);
        stampAndSavePreview(
          (ctx, w, h) => {
            ctx.drawImage(img, 0, 0, w, h);
          },
          targetW,
          targetH
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmitReturnPhotoToDrive = () => {
    if (!capturedPhotoDataUrl) return;
    const photoEntry: ReturnHomePhoto = {
      id: `rhp_${Date.now()}`,
      kidId: kid.id,
      kidNickname: kid.nickname,
      dateKey: todayKey,
      capturedAt: now.toISOString(),
      imageBase64: capturedPhotoDataUrl,
      driveFolderUrl: returnHomeDriveUrl,
    };
    onSaveReturnHomePhoto(photoEntry);
    setCapturedPhotoDataUrl(null);

    if (kid.group === 2 && !kid.daily.returnedHomeChecked) {
      const applied = addStars(
        5,
        'ถ่ายรูปเช็คอินกลับบ้าน (+5 ⭐)',
        (prev) => ({
          avatar: { ...prev.avatar, outfitMode: 'lounge' },
          daily: { ...prev.daily, returnedHomeChecked: true },
        }),
        (prev) => !prev.daily.returnedHomeChecked
      );
      if (applied) {
        onShowAlert({
          icon: '📸🏡',
          title: lang === 'th' ? 'ถ่ายรูปเช็คอินกลับบ้านเรียบร้อย! (+5 ⭐)' : 'Return Home Photo Checked In! (+5 ⭐)',
          message:
            lang === 'th'
              ? `บันทึกรูปและเปลี่ยนตัวละครเป็นชุดอยู่บ้านเรียบร้อย รับ +5 ⭐!\n${laundry.label}\n(อย่าลืมทำเช็คลิสต์ครบ 4 ข้อ เพื่อรับมือถือรอบเย็นเวลา 18:30 น. นะ)`
              : `Photo saved, switched to home lounge wear, +5 ⭐!\n${laundry.label}\n(Complete all 4 evening checklist items for 18:30 phone pickup!)`,
          tone: 'mint',
        });
        return;
      }
    }

    onShowAlert({
      icon: '📸✨',
      title: lang === 'th' ? 'บันทึกรูปเช็คอินกลับบ้านแล้ว!' : 'Return Home Photo Saved!',
      message:
        lang === 'th'
          ? 'บันทึกรูปภาพเช็คอินกลับบ้านเข้าระบบเรียบร้อยแล้วค่ะ'
          : 'Your return-home check-in photo has been saved.',
      tone: 'mint',
    });
  };

  const todayKey = getDateKey(now);
  const laundry = getLaundryQueueInfo(now, lang);
  const isSickToday = sickReports.some((r) => r.kidId === kid.id && r.dateKey === todayKey && !r.resolved);
  const isAwayToday = isKidAwayOnDate(kid, todayKey);
  const stepReminder = evaluateKidStepReminders(
    kid,
    now,
    isSickToday,
    isPublicHolidayToday,
    settings,
    polls
  );
  const kidHasPhone = doesKidHavePhone(kid.id, settings);
  const allowMorningPhonePickup = kidHasPhone && canKidUseCommand('morning_phone_pickup', kid, settings, now);
  const allowEveningPhone = kidHasPhone && canKidUseCommand('evening_uniform_phone', kid, settings, now);
  const allowComputerHomework = canKidUseCommand('evening_computer_homework', kid, settings, now);
  const allowHwPerm = kidHasPhone && canKidUseCommand('night_homework_permission', kid, settings, now);
  const allowReturnPhone = kidHasPhone && canKidUseCommand('night_return_phone', kid, settings, now);
  const computerHwConfig =
    getEffectiveHomeQuickActions(settings, true).find((a) => a.id === 'evening_computer_homework')!;
  const isComputerHwOpen = isHomeActionOpenAt('evening_computer_homework', now, settings);
  const computerHwPrereq = getComputerHomeworkPrereqStatus(kid);
  const morningPhoneWin = getEffectiveMorningPhoneWindow(settings);
  const isMorningPhoneOpen = isHomeActionOpenAt('morning_phone_pickup', now, settings);
  const hwPermWin = getEffectiveHomeworkPermissionWindow(settings);
  const autoReturnRule = getAutoReturnPhoneRuleConfig(settings);
  const returnScheduleEval = evaluateKidReturnPhoneSchedule(kid, now, settings, lang);
  const hwCurfewMins = autoReturnRule.homeworkExtendedDeadlineMins;
  const hwCurfewTh = formatThaiCurfewClock(hwCurfewMins);
  const hwCurfewEn = minsToHHMM(hwCurfewMins);

  const shownOverdueKeyRef = useRef<string>('');

  // Reminder stays quietly on top header badge (no auto-popup modal); only opens when clicked
  useEffect(() => {
    setStepPopupOpen(false);
    setPenaltyNoticePopup(null);
  }, [kid.id]);

  useEffect(() => {
    const isReturnWindowOpen = isHomeActionOpenAt('night_return_phone', now, settings);
    if (
      now.getDay() === 5 ||
      !isReturnWindowOpen ||
      !allowReturnPhone ||
      kid.daily.phoneReturnedChecked ||
      isSickToday ||
      isAwayToday ||
      !returnScheduleEval.isPastDeadline
    ) {
      return;
    }
    const key = `${kid.id}|${todayKey}|${returnScheduleEval.caseKind}`;
    if (shownOverdueKeyRef.current === key) return;
    shownOverdueKeyRef.current = key;
    const minsNow = getMinutesOfDay(now);
    const minsLate = Math.max(1, minsNow - returnScheduleEval.deadlineMins);
    const penaltyDesc = getPenaltySummaryText(
      returnScheduleEval.penaltyPreset,
      returnScheduleEval.penaltyNote,
      lang
    );
    setPenaltyNoticePopup({
      kidNickname: kid.nickname,
      kidEmoji: kid.emoji,
      headline:
        lang === 'th'
          ? 'เลยกำหนดเวลาคืนมือถือแล้ว!'
          : 'Past Phone Return Deadline!',
      reasonLine:
        lang === 'th'
          ? returnScheduleEval.caseKind === 'homework_registered'
            ? `ขออนุญาตทำการบ้านไว้ถึง ${returnScheduleEval.deadlineEn} น. (เกินเวลามาแล้ว ${minsLate} นาที) — กรุณารีบนำมือถือมาคืนทันทีค่ะ`
            : `ไม่ได้กดขอทำการบ้านก่อนเวลา → เล่นได้ถึง ${returnScheduleEval.deadlineEn} น. (เกินเวลามาแล้ว ${minsLate} นาที) — กรุณารีบนำมือถือมาคืนทันทีค่ะ`
          : `Phone return deadline was ${returnScheduleEval.deadlineEn} (${minsLate} min overdue). Please return your phone immediately.`,
      penaltyText: penaltyDesc,
      clockNote:
        lang === 'th'
          ? `เวลาปัจจุบัน ${minsToHHMM(minsNow)} น.`
          : `Current time ${minsToHHMM(minsNow)}`,
    });
  }, [
    kid.id,
    kid.nickname,
    kid.emoji,
    kid.daily.phoneReturnedChecked,
    todayKey,
    now,
    settings,
    allowReturnPhone,
    isSickToday,
    isAwayToday,
    returnScheduleEval,
    lang,
  ]);

  const dismissStepPopup = () => {
    setStepPopupOpen(false);
  };

  const activeAwaySecretCode = getActiveKidAwaySecretCode(settings, todayKey);
  const staffPins = Array.from(
    new Set([
      ...allMembers.filter((m) => m.role === 'staff' || m.role === 'manager').map((m) => m.pin),
      ...creatorPins,
    ])
  );

  // Speedy Ninja 20-min countdown calculation
  const speedyRemainingSec = kid.daily.speedyNinjaStartMs
    ? Math.max(0, Math.floor((kid.daily.speedyNinjaStartMs + 20 * 60 * 1000 - now.getTime()) / 1000))
    : null;
  const speedyMM = speedyRemainingSec !== null ? String(Math.floor(speedyRemainingSec / 60)).padStart(2, '0') : '00';
  const speedySS = speedyRemainingSec !== null ? String(speedyRemainingSec % 60).padStart(2, '0') : '00';

  const groupLabel =
    kid.group === 1
      ? lang === 'th'
        ? 'กลุ่ม 1: ทีมน้องเล็ก'
        : 'Group 1: Little Stars'
      : kid.group === 2
      ? lang === 'th'
        ? 'กลุ่ม 2: ทีมพี่โต'
        : 'Group 2: Junior Teens'
      : lang === 'th'
      ? 'กลุ่ม 3: ทีมพี่ใหญ่'
      : 'Group 3: Senior Youth';

  const addStars = (
    amount: number,
    reason: string,
    extraUpdate?: (prev: Member) => Partial<Member>,
    canApply?: (prev: Member) => boolean
  ): boolean => {
    let applied = false;
    onUpdateKid(
      kid.id,
      (prev) => {
        if (canApply && !canApply(prev)) return prev;
        applied = true;
        return {
          ...prev,
          stars: Math.max(0, prev.stars + amount),
          ...(extraUpdate ? extraUpdate(prev) : {}),
          starHistory: [
            {
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: now.toISOString(),
              reason,
              amount,
            },
            ...prev.starHistory,
          ].slice(0, 60),
        };
      },
      reason
    );
    return applied;
  };

  const eco = getKidEconomyConfig(kid, settings);
  const earlyBonus = eco.early15MinBonusStars;
  const { allowance: liveAllowance } = ensureCurrentWeekAllowance(kid, now, settings);
  const goldenPoolBalance = computeGoldenPoolBalance(goldenPoolLogs);
  const activeProfileGift =
    kid.mySpace?.activeGift && kid.mySpace.activeGift.sentDateKey === todayKey
      ? kid.mySpace.activeGift
      : null;

  // --- SHIFT 1: MORNING HANDLERS ---
  const handleGroup1Breakfast = () => {
    if (kid.daily.breakfastChecked) {
      onShowAlert({
        icon: '🍚',
        title: lang === 'th' ? 'เช็คอินข้าวเช้าไปแล้ว' : 'Already Checked Breakfast',
        message: lang === 'th' ? 'วันนี้เก่งมาก เช็คอินมื้อเช้าเรียบร้อยแล้ว' : 'Breakfast already recorded today.',
        tone: 'mint',
      });
      return;
    }
    const mins = getMinutesOfDay(now);
    const onTime = mins < 6 * 60 + 40; // Before 06:40
    const isEarly15 = onTime && mins <= 6 * 60 + 25 && earlyBonus > 0;
    const streakRes = onTime ? applyMorningStreakOnTime(kid, now) : null;
    const earned = (onTime ? 5 : 0) + (isEarly15 ? earlyBonus : 0) + (streakRes?.milestoneBonusStars ?? 0);

    let applied = false;
    onUpdateKid(
      kid.id,
      (prev) => {
        if (prev.daily.breakfastChecked) return prev;
        applied = true;
        return {
          ...prev,
          stars: prev.stars + earned,
          avatar: { ...prev.avatar, outfitMode: 'uniform' },
          streak: streakRes ? streakRes.nextStreak : prev.streak,
          daily: { ...prev.daily, breakfastChecked: true },
          starHistory: [
            ...(streakRes?.milestoneBonusStars
              ? [
                  {
                    id: `tx_streak_${Date.now()}`,
                    timestamp: now.toISOString(),
                    reason: streakRes.streakTextTh ?? 'โบนัสมาเช้าต่อเนื่อง 5 วันติด (+25 ⭐)',
                    amount: streakRes.milestoneBonusStars,
                  },
                ]
              : []),
            {
              id: `tx_${Date.now()}`,
              timestamp: now.toISOString(),
              reason: onTime
                ? `กินข้าวเช้าทันก่อน 06:40 น.${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐ เบี้ยขยัน)` : ''}`
                : 'กินข้าวเช้าหลัง 06:40 น. (0 ดาว)',
              amount: (onTime ? 5 : 0) + (isEarly15 ? earlyBonus : 0),
            },
            ...prev.starHistory,
          ].slice(0, 60),
        };
      },
      'Group 1 Breakfast'
    );
    if (!applied) return;

    if (onTime) {
      onShowAlert({
        icon: streakRes?.milestoneBonusStars ? '🔥🍚✨' : '🍚✨',
        title:
          lang === 'th'
            ? `เยี่ยมมาก! ทานข้าวเช้าทันเวลา (+${earned} ⭐)`
            : `Great Job! Breakfast On Time (+${earned} ⭐)`,
        message:
          lang === 'th'
            ? `รับ +5 ดาวความดี${isEarly15 ? ` + โบนัสมาก่อน 15 นาที (+${earlyBonus} ⭐)` : ''} และเปลี่ยนตัวละครเป็นชุดนักเรียนเรียบร้อยแล้ว!${
                streakRes?.streakTextTh ? `\n${streakRes.streakTextTh}` : ''
              }`
            : `Earned +${earned} stars and switched character into School Uniform!`,
        tone: 'mint',
      });
    } else {
      onShowAlert({
        icon: '😜🍚',
        title: lang === 'th' ? 'อ๊ะ! เลย 06:40 น. แล้วนะ!' : 'Oops! Past 06:40 AM!',
        message:
          lang === 'th'
            ? 'กินข้าวช้าระวังงบค่าขนมไม่พอนะคนเก่ง รอบนี้ไม่ได้ดาว แต่ใส่ชุดนักเรียนพร้อมไปโรงเรียนแล้วจ้า!'
            : 'Past 06:40! Watch out for your snack allowance—no stars this time, but your School Uniform is ready!',
        tone: 'yellow',
      });
    }
  };

  const handleGroup1Van = () => {
    if (kid.daily.vanOrMorningChecked) {
      onShowAlert({
        icon: '🚐',
        title: lang === 'th' ? 'เช็คอินกะเช้าวันนี้แล้ว' : 'Morning Check-In Done',
        message: lang === 'th' ? 'บันทึกเช็คอินช่วงเช้าวันนี้เรียบร้อยแล้วค่ะ' : 'Already checked in this morning.',
        tone: 'blue',
      });
      return;
    }
    const mins = getMinutesOfDay(now);
    const day = now.getDay();
    const isHolidayToday = isPublicHoliday(now, isPublicHolidayToday);
    const isWeekendOrHoliday = day === 0 || day === 6 || isHolidayToday;

    if (isWeekendOrHoliday) {
      const isSat = day === 6;
      if (isSat && mins < 8 * 60 + 15) {
        onShowAlert({
          icon: '⏰',
          title:
            lang === 'th'
              ? 'ยังไม่ถึงเวลาเปิดเช็คอินเช้าวันเสาร์ (เปิด 08:15 น.)'
              : 'Saturday Check-In Opens at 08:15',
          message:
            lang === 'th'
              ? 'วันเสาร์ระบบจะเปิดตื่นทุก 08:15–08:35 น. ห้ามเกิน 08:36 น. น้องๆ สามารถกดชื่อตัวเองได้เลยค่ะ'
              : 'Saturday morning check-in opens 08:15–08:35 (strictly no later than 08:36).',
          tone: 'yellow',
        });
        return;
      }
      const deadlineMins = isSat ? 8 * 60 + 35 : 8 * 60 + 15;
      const graceMins = isSat ? 8 * 60 + 36 : 8 * 60 + 25;
      const dayLabel = isSat ? 'วันเสาร์' : isHolidayToday ? 'วันนักขัตฤกษ์/วันหยุด' : 'วันอาทิตย์';
      const satResolution = isSat ? resolveSaturdayLatePenaltyFromPolls(kid, polls, settings) : null;
      const effectivePreset = satResolution
        ? satResolution.preset
        : getEffectiveWeekendLatePenaltyPreset(settings);

      if (mins <= deadlineMins) {
        const applied = addStars(
          10,
          `☀️ เช็คอินเช้า${dayLabel}ตรงเวลา (เด็กเล็ก +10 ⭐)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '☀️🌟',
          title:
            lang === 'th'
              ? `เช็คอินเช้า${dayLabel}สำเร็จ! (+10 ⭐)`
              : `Holiday/Weekend Check-In (+10 ⭐)`,
          message:
            lang === 'th'
              ? isSat
                ? 'เก่งมากเลย! ตื่นมาเช็คอินช่วง 08:15–08:35 น. รับ +10 ดาวจ้า'
                : 'เก่งมากเลย! ตื่นมาเช็คอินไม่เกิน 08:15 น. รับ +10 ดาวจ้า'
              : `Great job checking in on time! +10 stars added.`,
          tone: 'mint',
        });
        return;
      }

      if (mins <= graceMins) {
        const applied = addStars(
          0,
          `⚠️ เช็คอินเช้า${dayLabel}ช่วงอนุโลม (${minsToHHMM(mins)} น. · 0 ⭐)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '⚠️⏰',
          title:
            lang === 'th'
              ? `เช็คอินช่วงอนุโลม (${minsToHHMM(mins)} น.)`
              : `Grace Window Check-In (${minsToHHMM(mins)})`,
          message:
            lang === 'th'
              ? isSat
                ? 'อนุโลมได้ไม่เกิน 1 นาที (ถึง 08:36 น. · ยังไม่ลงโทษ) รีบตื่นให้ทันช่วง 08:15–08:35 น. นะคะ'
                : 'อนุโลมได้ไม่เกิน 10 นาที (ถึง 08:25 น.) เนื่องจากพี่เกดต้องเดินปลุกและไขกุญแจ เด็กๆ ต้องรีบทำเวลาลุกมาเช็คอินนะคะ'
              : 'Within grace window (no penalty). Please hurry to check in on time!',
          tone: 'yellow',
        });
        return;
      }

      if (isSickToday || isAwayToday) {
        const applied = addStars(
          0,
          `☀️ เช็คอินเช้า${dayLabel} (${minsToHHMM(mins)} น. · ยกเว้นโทษป่วย/ลาพัก)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '💚',
          title: lang === 'th' ? 'ยกเว้นโทษ (แจ้งป่วย / ลาพัก)' : 'Penalty Waived (Sick / Leave)',
          message:
            lang === 'th'
              ? 'แจ้งป่วยหรือลาพักไว้ ระบบยกเว้นบทลงโทษตื่นสายวันหยุดให้ค่ะ'
              : 'Weekend/holiday late penalty waived due to sick report or leave.',
          tone: 'mint',
        });
        return;
      }

      let applied = false;
      const reasonPrefix = isSat
        ? `ตื่นสายเช้าวันเสาร์ (${minsToHHMM(mins)} น. · เกิน 08:36 น. · ${satResolution!.reasonTagTh})`
        : `ตื่นสายเช้า${dayLabel} (${minsToHHMM(mins)} น. · เกิน 08:25 น.)`;
      const res = applyWeekendHolidayLatePenaltyToMember(
        kid,
        now,
        lang,
        reasonPrefix,
        effectivePreset
      );
      onUpdateKid(
        kid.id,
        (prev) => {
          if (prev.daily.vanOrMorningChecked) return prev;
          applied = true;
          const prevApplied = applyWeekendHolidayLatePenaltyToMember(
            prev,
            now,
            lang,
            reasonPrefix,
            effectivePreset
          );
          return {
            ...prevApplied.updatedKid,
            daily: { ...prevApplied.updatedKid.daily, vanOrMorningChecked: true },
          };
        },
        `Group 1 ${dayLabel} Late`
      );
      if (!applied) return;
      onShowAlert({
        icon: '🚫🏪',
        title:
          lang === 'th'
            ? `ตื่นสาย${dayLabel} — ${res.shortTag}`
            : `Holiday Late — ${res.shortTag}`,
        message: satResolution
          ? `${res.penaltyText} (${lang === 'th' ? satResolution.reasonTagTh : satResolution.reasonTagEn})`
          : res.penaltyText,
        tone: 'pink',
      });
      return;
    }

    const onTime = mins <= 7 * 60 + 1; // <= 07:01
    const isEarly15 = onTime && mins <= 6 * 60 + 46 && earlyBonus > 0;
    const streakRes = onTime ? applyMorningStreakOnTime(kid, now) : null;
    const earned = (onTime ? 10 : 0) + (isEarly15 ? earlyBonus : 0) + (streakRes?.milestoneBonusStars ?? 0);
    const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);

    const applied = addStars(
      earned,
      onTime
        ? `ขึ้นรถตู้ตรงเวลา (ไม่เกิน 07:01 น.)${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐ เบี้ยขยัน)` : ''}${streakRes?.streakTextTh ? ` · ${streakRes.streakTextTh}` : ''}`
        : 'ขึ้นรถตู้สาย (ตั้งแต่ 07:02 น.)',
      (prev) => ({
        streak: streakRes ? streakRes.nextStreak : prev.streak,
        allowance: applyDailySchoolDeduction(prev, now, settings, false, isSickToday).allowance,
        daily: { ...prev.daily, vanOrMorningChecked: true },
      }),
      (prev) => !prev.daily.vanOrMorningChecked
    );
    if (!applied) return;
    onShowAlert({
      icon: onTime ? '🚐🌟' : '⏰🚐',
      title: onTime
        ? lang === 'th'
          ? `ขึ้นรถตู้ทันเวลา! (+${earned} ⭐)`
          : `On Time for School Van! (+${earned} ⭐)`
        : lang === 'th'
        ? 'ขึ้นรถตู้สาย (07:02 น. ขึ้นไป)'
        : 'School Van Late (07:02+)',
      message: onTime
        ? lang === 'th'
          ? `เก่งมากเลย! รับไปเลย +${earned} ดาว${isEarly15 ? ` (รวมเบี้ยขยันมาก่อน 15 นาที +${earlyBonus} ⭐)` : ''}${
              coinsEnabled && schoolDeduct.deducted
                ? `\n🐷 หักค่าไปโรงเรียนวันนี้ -${schoolDeduct.amount} ฿ (เหลือในกระปุกสีชมพู ${schoolDeduct.allowance.coins} ฿)`
                : ''
            }${streakRes?.streakTextTh ? `\n${streakRes.streakTextTh}` : ''}`
          : `Awesome! +${earned} stars added. Enjoy school today!`
        : lang === 'th'
        ? `วันนี้เลย 07:01 น. จึงไม่ได้รับดาว${
            coinsEnabled && schoolDeduct.deducted
              ? ` · หักค่าไปโรงเรียนวันนี้ -${schoolDeduct.amount} ฿ (เหลือ ${schoolDeduct.allowance.coins} ฿)`
              : ''
          } พรุ่งนี้รีบเตรียมตัวให้ไวขึ้นอีกนิดนะ!`
        : 'Past 07:01 today so no stars earned. Let us get ready faster tomorrow!',
      tone: onTime ? 'mint' : 'peach',
    });
  };

  const handleGroup2Morning = () => {
    if (kid.daily.vanOrMorningChecked) {
      onShowAlert({
        icon: '📱',
        title: lang === 'th' ? 'เช็คอินกะเช้าไปแล้ว' : 'Morning Check-in Done',
        message: lang === 'th' ? 'วันนี้บันทึกกะเช้าเรียบร้อยแล้ว' : 'Already checked in this morning.',
        tone: 'blue',
      });
      return;
    }
    const day = now.getDay(); // 0 Sun, 6 Sat
    const mins = getMinutesOfDay(now);
    const isHolidayToday = isPublicHoliday(now, isPublicHolidayToday);
    const weekendPreset = getEffectiveWeekendLatePenaltyPreset(settings);

    if (day === 6) {
      if (mins < 8 * 60 + 15) {
        onShowAlert({
          icon: '⏰',
          title:
            lang === 'th'
              ? 'ยังไม่ถึงเวลาเปิดเช็คอินเช้าวันเสาร์ (เปิด 08:15 น.)'
              : 'Saturday Check-In Opens at 08:15',
          message:
            lang === 'th'
              ? 'วันเสาร์ระบบจะเปิดตื่นทุก 08:15–08:35 น. ห้ามเกิน 08:36 น. น้องๆ สามารถกดชื่อตัวเองได้เลยค่ะ'
              : 'Saturday check-in opens 08:15–08:35 (strictly no later than 08:36).',
          tone: 'yellow',
        });
        return;
      }
      if (mins <= 8 * 60 + 35) {
        const applied = addStars(
          10,
          'เช็คอินเช้าวันเสาร์ตรงเวลา (08:15–08:35 น.)',
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '🎉📱',
          title: lang === 'th' ? 'เช็คอินเช้าวันเสาร์สำเร็จ (+10 ⭐)' : 'Saturday Check-in On Time (+10 ⭐)',
          message:
            lang === 'th'
              ? 'รับ +10 ดาว! ตื่นมาเช็คอินช่วง 08:15–08:35 น. เรียบร้อยค่ะ'
              : 'Earned +10 stars! Checked in during 08:15–08:35!',
          tone: 'mint',
        });
      } else if (mins <= 8 * 60 + 36) {
        const applied = addStars(
          0,
          '⚠️ เช็คอินเช้าวันเสาร์ช่วงอนุโลม (08:36 น. · ไม่เกิน 1 นาที)',
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '⚠️⏰',
          title: lang === 'th' ? 'เช็คอินวันเสาร์ช่วงอนุโลม (08:36 น.)' : 'Saturday 1-Min Grace (08:36)',
          message:
            lang === 'th'
              ? 'อนุโลมได้ไม่เกิน 1 นาที (ถึง 08:36 น. · ยังไม่ลงโทษ) รีบตื่นให้ทันช่วง 08:15–08:35 น. นะคะ'
              : 'Within 1-min grace (until 08:36, no penalty). Aim for 08:15–08:35!',
          tone: 'yellow',
        });
      } else if (isSickToday || isAwayToday) {
        const applied = addStars(
          0,
          `☀️ เช็คอินเช้าวันเสาร์ (${minsToHHMM(mins)} น. · ยกเว้นโทษป่วย/ลาพัก)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '💚',
          title: lang === 'th' ? 'ยกเว้นโทษ (แจ้งป่วย / ลาพัก)' : 'Penalty Waived (Sick / Leave)',
          message:
            lang === 'th'
              ? 'ระบบยกเว้นบทลงโทษให้อัตโนมัติค่ะ'
              : 'Penalties are automatically waived.',
          tone: 'mint',
        });
      } else {
        const satResolution = resolveSaturdayLatePenaltyFromPolls(kid, polls, settings);
        let applied = false;
        const satReason = `ตื่นสายเช้าวันเสาร์ (${minsToHHMM(mins)} น. · เกิน 08:36 น. · ${satResolution.reasonTagTh})`;
        const preview = applyWeekendHolidayLatePenaltyToMember(
          kid,
          now,
          lang,
          satReason,
          satResolution.preset
        );
        onUpdateKid(
          kid.id,
          (prev) => {
            if (prev.daily.vanOrMorningChecked) return prev;
            applied = true;
            const appliedRes = applyWeekendHolidayLatePenaltyToMember(
              prev,
              now,
              lang,
              satReason,
              satResolution.preset
            );
            return {
              ...appliedRes.updatedKid,
              daily: { ...appliedRes.updatedKid.daily, vanOrMorningChecked: true },
            };
          },
          'Saturday Late >=08:36'
        );
        if (!applied) return;
        onShowAlert({
          icon: '📵⚖️',
          title:
            lang === 'th'
              ? `ตื่นสายวันเสาร์ — ${preview.shortTag}`
              : `Saturday Late — ${preview.shortTag}`,
          message: `${preview.penaltyText}\n(${lang === 'th' ? satResolution.reasonTagTh : satResolution.reasonTagEn})`,
          tone: 'pink',
        });
      }
      return;
    }

    if (day === 0 && !isHolidayToday) {
      // Sunday: <= 08:15 (+15), 08:16-08:25 (10-min grace warn), >08:25 (weekend/holiday penalty + -5 ⭐)
      if (mins <= 8 * 60 + 15) {
        const applied = addStars(
          15,
          'เช็คอินเช้าวันอาทิตย์ตรงเวลา (ไม่เกิน 08:15 น. +15 ⭐)',
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '☀️⭐',
          title: lang === 'th' ? 'เช็คอินเช้าวันอาทิตย์สำเร็จ (+15 ⭐)' : 'Sunday Check-in On Time (+15 ⭐)',
          message:
            lang === 'th'
              ? 'รับ +15 ดาว! เช็คอินไม่เกิน 08:15 น. ทำเวร+อาบน้ำ+เช็คเวรครัวเรียบร้อย เยี่ยมมากจ้า'
              : 'Earned +15 stars! Chores, shower & kitchen check done by 08:15!',
          tone: 'mint',
        });
      } else if (mins <= 8 * 60 + 25) {
        const applied = addStars(
          0,
          'เช็คอินเช้าวันอาทิตย์ช่วงอนุโลม (08:16–08:25 น.)',
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '⚠️⏰',
          title: lang === 'th' ? `ช่วงอนุโลมวันอาทิตย์ (${minsToHHMM(mins)} น.)` : 'Sunday 10-Min Grace (08:16–08:25)',
          message:
            lang === 'th'
              ? 'อนุโลมได้ไม่เกิน 10 นาที (ถึง 08:25 น.) เนื่องจากพี่เกดต้องเดินปลุกและไขกุญแจ เด็กๆ ต้องรีบทำเวลาลุกมาเช็คอินนะคะ'
              : "Within 10-min grace (until 08:25 as P'Ked walks to wake kids & unlock doors). Hurry to check in!",
          tone: 'yellow',
        });
      } else if (isSickToday || isAwayToday) {
        const applied = addStars(
          0,
          'เช็คอินเช้าวันอาทิตย์เกิน 08:25 น. (ยกเว้นเพราะแจ้งป่วย/ลาพัก)',
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '🤒💚',
          title: lang === 'th' ? 'ยกเว้นโทษเนื่องจากแจ้งป่วย / ลาพัก' : 'Penalty Waived (Sick / Leave)',
          message:
            lang === 'th'
              ? 'ระบบยกเว้นบทลงโทษให้ในวันแจ้งป่วยหรือลาพัก พักผ่อนเยอะๆ นะ'
              : 'Penalty waived due to active sick report or leave today.',
          tone: 'mint',
        });
      } else {
        let applied = false;
        const preview = applyWeekendHolidayLatePenaltyToMember(
          kid,
          now,
          lang,
          `ตื่นสายเช้าวันอาทิตย์ (${minsToHHMM(mins)} น. · เกิน 08:25 น.)`,
          weekendPreset,
          -5
        );
        onUpdateKid(
          kid.id,
          (prev) => {
            if (prev.daily.vanOrMorningChecked) return prev;
            applied = true;
            const appliedRes = applyWeekendHolidayLatePenaltyToMember(
              prev,
              now,
              lang,
              `ตื่นสายเช้าวันอาทิตย์ (${minsToHHMM(mins)} น. · เกิน 08:25 น.)`,
              weekendPreset,
              -5
            );
            return {
              ...appliedRes.updatedKid,
              daily: { ...appliedRes.updatedKid.daily, vanOrMorningChecked: true },
            };
          },
          'Sunday Late >08:25'
        );
        if (!applied) return;
        onShowAlert({
          icon: '📵⚖️',
          title:
            lang === 'th'
              ? `ตื่นสายวันอาทิตย์ — ${preview.shortTag} (-5 ⭐)`
              : `Sunday Late — ${preview.shortTag} (-5 ⭐)`,
          message:
            lang === 'th'
              ? `${preview.penaltyText} (และลด -5 ดาว หากเกิดเหตุสุดวิสัยแจ้งพี่เลี้ยงได้ค่ะ)`
              : `${preview.penaltyText} (-5 stars deducted; staff can waive unexpected accidents).`,
          tone: 'peach',
        });
      }
      return;
    }

    if (isHolidayToday) {
      if (mins <= 8 * 60 + 15) {
        const applied = addStars(
          10,
          'เช็คอินกะเช้าวันหยุดตรงเวลา (ไม่เกิน 08:15 น. +10 ⭐)',
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '🎉📱',
          title: lang === 'th' ? 'เช็คอินกะเช้าวันหยุดสำเร็จ (+10 ⭐)' : 'Holiday Check-In (+10 ⭐)',
          message:
            lang === 'th'
              ? 'วันหยุดนักขัตฤกษ์/ปิดเทอม — ตื่นเช็คอินไม่เกิน 08:15 น. รับ +10 ดาวจ้า'
              : 'Public holiday today — checked in by 08:15 (+10 stars)!',
          tone: 'mint',
        });
      } else if (mins <= 8 * 60 + 25) {
        const applied = addStars(
          0,
          `⚠️ เช็คอินกะเช้าวันหยุดช่วงอนุโลม (${minsToHHMM(mins)} น. · 0 ⭐)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '⚠️⏰',
          title: lang === 'th' ? `ช่วงอนุโลมวันหยุด (${minsToHHMM(mins)} น.)` : 'Holiday 10-Min Grace (08:16–08:25)',
          message:
            lang === 'th'
              ? 'อนุโลมได้ไม่เกิน 10 นาที (ถึง 08:25 น.) เนื่องจากพี่เกดต้องเดินปลุกและไขกุญแจ เด็กๆ ต้องรีบทำเวลาลุกมาเช็คอินนะคะ'
              : "Within 10-min grace (until 08:25 as P'Ked wakes kids & unlocks). Hurry to check in!",
          tone: 'yellow',
        });
      } else if (isSickToday || isAwayToday) {
        const applied = addStars(
          0,
          `🎉 เช็คอินเช้าวันหยุด (${minsToHHMM(mins)} น. · ยกเว้นโทษป่วย/ลาพัก)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '💚',
          title: lang === 'th' ? 'ยกเว้นโทษ (แจ้งป่วย / ลาพัก)' : 'Penalty Waived (Sick / Leave)',
          message:
            lang === 'th'
              ? 'แจ้งป่วยหรือลาพักไว้ ระบบยกเว้นบทลงโทษตื่นสายวันหยุดให้ค่ะ'
              : 'Holiday late penalty waived due to sick report or leave.',
          tone: 'mint',
        });
      } else {
        let applied = false;
        const preview = applyWeekendHolidayLatePenaltyToMember(
          kid,
          now,
          lang,
          `ตื่นสายวันนักขัตฤกษ์/วันหยุด (${minsToHHMM(mins)} น. · เกิน 08:25 น.)`,
          weekendPreset
        );
        onUpdateKid(
          kid.id,
          (prev) => {
            if (prev.daily.vanOrMorningChecked) return prev;
            applied = true;
            const appliedRes = applyWeekendHolidayLatePenaltyToMember(
              prev,
              now,
              lang,
              `ตื่นสายวันนักขัตฤกษ์/วันหยุด (${minsToHHMM(mins)} น. · เกิน 08:25 น.)`,
              weekendPreset
            );
            return {
              ...appliedRes.updatedKid,
              daily: { ...appliedRes.updatedKid.daily, vanOrMorningChecked: true },
            };
          },
          'Holiday Late >08:25'
        );
        if (!applied) return;
        onShowAlert({
          icon: '📵⚖️',
          title:
            lang === 'th'
              ? `ตื่นสายวันหยุด — ${preview.shortTag}`
              : `Holiday Late — ${preview.shortTag}`,
          message: preview.penaltyText,
          tone: 'pink',
        });
      }
      return;
    }

    // Weekday school morning: require morningDressedConfirmed (from Button 1: Shower/Dress & Phone Pickup)
    if (!kid.daily.morningDressedConfirmed) {
      onShowAlert({
        icon: '📱',
        title: lang === 'th' ? 'กรุณากดขอรับมือถือก่อนนะ' : 'Tap Ready & Phone Pickup First',
        message:
          lang === 'th'
            ? 'กรุณากดปุ่ม "อาบน้ำ แต่งตัวชุดนักเรียน & ขอรับมือถือ" ด้านบนให้เรียบร้อยก่อนกด "เช็คชื่อไปโรงเรียน" ค่ะ'
            : 'Please tap "Showered, Dressed & Phone Pickup" first before tapping School Check-In.',
        tone: 'yellow',
      });
      return;
    }

    if (mins <= 7 * 60 + 21) {
      const isEarly15 = mins <= 7 * 60 + 6 && earlyBonus > 0;
      const streakRes = applyMorningStreakOnTime(kid, now);
      const earned = 10 + (isEarly15 ? earlyBonus : 0) + streakRes.milestoneBonusStars;
      const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);
      const applied = addStars(
        earned,
        `เช็คชื่อไปโรงเรียนตรงเวลา (ไม่เกิน 07:21 น.)${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐ เบี้ยขยัน)` : ''}${streakRes.streakTextTh ? ` · ${streakRes.streakTextTh}` : ''}`,
        (prev) => ({
          avatar: { ...prev.avatar, outfitMode: 'uniform' },
          streak: streakRes.nextStreak,
          allowance: applyDailySchoolDeduction(prev, now, settings, false, isSickToday).allowance,
          daily: { ...prev.daily, vanOrMorningChecked: true },
        }),
        (prev) => !prev.daily.vanOrMorningChecked
      );
      if (!applied) return;
      onShowAlert({
        icon: streakRes.milestoneBonusStars > 0 ? '🔥🚌✨' : '🚌✨',
        title:
          lang === 'th'
            ? `เช็คชื่อไปโรงเรียนตรงเวลา (+${earned} ⭐)`
            : `School Check-In On Time (+${earned} ⭐)`,
        message:
          lang === 'th'
            ? `ขอบคุณที่รักษาสัญญาความเชื่อใจ! รับ +${earned} ดาว${
                isEarly15 ? ` (รวมเบี้ยขยันมาก่อน 15 นาที +${earlyBonus} ⭐)` : ''
              }${
                coinsEnabled && schoolDeduct.deducted
                  ? `\n🐷 หักค่าไปโรงเรียนวันนี้ -${schoolDeduct.amount} ฿ (เหลือในกระปุกสีชมพู ${schoolDeduct.allowance.coins} ฿)`
                  : ''
              }${streakRes.streakTextTh ? `\n${streakRes.streakTextTh}` : ''}`
            : `Earned +${earned} stars! School check-in complete.`,
        tone: 'mint',
      });
    } else {
      // School-day morning late ceiling is 08:00 AM
      const SCHOOL_LATE_CEILING = 8 * 60;
      const cappedMins = Math.min(mins, SCHOOL_LATE_CEILING);
      const minsLate = Math.max(1, cappedMins - (7 * 60 + 21));
      const pastCeiling = mins > SCHOOL_LATE_CEILING;
      const fine = !coinsEnabled || isSickToday || isAwayToday ? 0 : Math.min(minsLate * 5, 50);
      const applyMemberBase = (prev: Member): Member => {
        if (prev.daily.vanOrMorningChecked) return prev;
        return {
          ...prev,
          avatar: { ...prev.avatar, outfitMode: 'uniform' },
          allowance: applyDailySchoolDeduction(prev, now, settings, false, isSickToday).allowance,
          penalty: {
            ...prev.penalty,
            lateFineThb: prev.penalty.lateFineThb + fine,
          },
          daily: { ...prev.daily, vanOrMorningChecked: true },
          starHistory: [
            {
              id: `tx_${Date.now()}`,
              timestamp: now.toISOString(),
              reason: isSickToday || isAwayToday
                ? `ไปโรงเรียนสาย ${minsLate} นาที (ยกเว้นค่าปรับเพราะ${isSickToday ? 'ป่วย' : 'ลาพัก'})`
                : coinsEnabled
                ? `ไปโรงเรียนสาย ${minsLate} นาที${pastCeiling ? ' (เพดานสาย 08:00 น.)' : ''} (หักกระปุกหมู ${fine} ฿ → เข้ากระปุกทองคำ)`
                : `ไปโรงเรียนสาย ${minsLate} นาที${pastCeiling ? ' (เพดานสาย 08:00 น.)' : ''}`,
              amount: 0,
            },
            ...prev.starHistory,
          ].slice(0, 60),
        };
      };

      if (coinsEnabled && !isSickToday && !isAwayToday && fine > 0 && onRecordRulePenalty) {
        onRecordRulePenalty(
          kid.id,
          fine,
          `ไปโรงเรียนสาย ${minsLate} นาที${pastCeiling ? ' (เพดานสาย 08:00 น.)' : ''}`,
          'ระบบเช็คอินอัตโนมัติ',
          applyMemberBase
        );
      } else {
        onUpdateKid(kid.id, applyMemberBase, 'Group 2 Weekday Late');
      }

      onShowAlert({
        icon: isSickToday ? '🤒💚' : coinsEnabled ? '💸⏰' : '⏰🚌',
        title: isSickToday
          ? lang === 'th'
            ? 'ยกเว้นค่าปรับสาย (แจ้งป่วยวันนี้)'
            : 'Late Fine Waived (Sick Today)'
          : coinsEnabled
          ? lang === 'th'
            ? `สายวันไปโรงเรียน ${minsLate} นาที — หักกระปุกหมู ${fine} ฿`
            : `School Late ${minsLate} min — Fine ${fine} THB`
          : lang === 'th'
          ? `เช็คชื่อไปโรงเรียนสาย ${minsLate} นาที`
          : `School Late ${minsLate} min`,
        message: isSickToday
          ? lang === 'th'
            ? 'เพราะแจ้งป่วยไว้ ระบบไม่คิดค่าปรับสายในวันนี้ พักผ่อนให้หายไวๆ นะ'
            : 'No late fine charged today because you reported sick.'
          : coinsEnabled
          ? lang === 'th'
            ? `เลยเวลา 07:21 น. (วันไปโรงเรียนตั้งเพดานเวลาสายถึง 08:00 น.) ระบบหักค่าปรับ ${fine} ฿ จากกระปุกหมูสีชมพูโอนเข้ากระปุกหมูสีทอง (กองทุนกลาง) แล้ว`
            : `Past 07:21 (school-day late ceiling 08:00). Deducted ${fine} THB into Shared Golden Piggy Bank.`
          : lang === 'th'
          ? 'บันทึกการเช็คอินไปโรงเรียนแล้ว (เลยเวลา 07:21 น. จึงไม่ได้รับดาว) พรุ่งนี้รีบเตรียมตัวให้ไวขึ้นอีกนิดนะ!'
          : 'School check-in recorded (past 07:21 so no stars awarded). Let us get ready faster tomorrow!',
        tone: isSickToday ? 'mint' : 'peach',
      });
    }
  };

  const handleGroup3Morning = () => {
    if (kid.daily.vanOrMorningChecked) {
      onShowAlert({
        icon: '🎓',
        title: lang === 'th' ? 'เช็คอินกะเช้าแล้ว' : 'Already Checked Morning Shift',
        message: lang === 'th' ? 'บันทึกการไปเรียน/ฝึกงานวันนี้แล้ว สู้ๆ นะ!' : 'Have a great internship/college day!',
        tone: 'lavender',
      });
      return;
    }
    const mins = getMinutesOfDay(now);
    const day = now.getDay();
    const isHolidayToday = isPublicHoliday(now, isPublicHolidayToday);
    const isWeekendOrHoliday = day === 0 || day === 6 || isHolidayToday;

    if (isWeekendOrHoliday) {
      const isSat = day === 6;
      if (isSat && mins < 8 * 60 + 15) {
        onShowAlert({
          icon: '⏰',
          title:
            lang === 'th'
              ? 'ยังไม่ถึงเวลาเปิดเช็คอินเช้าวันเสาร์ (เปิด 08:15 น.)'
              : 'Saturday Check-In Opens at 08:15',
          message:
            lang === 'th'
              ? 'วันเสาร์ระบบจะเปิดตื่นทุก 08:15–08:35 น. ห้ามเกิน 08:36 น. น้องๆ สามารถกดชื่อตัวเองได้เลยค่ะ'
              : 'Saturday check-in opens 08:15–08:35 (strictly no later than 08:36).',
          tone: 'yellow',
        });
        return;
      }
      const deadlineMins = isSat ? 8 * 60 + 35 : 8 * 60 + 15;
      const graceMins = isSat ? 8 * 60 + 36 : 8 * 60 + 25;
      const dayLabel = isSat ? 'วันเสาร์' : isHolidayToday ? 'วันนักขัตฤกษ์/วันหยุด' : 'วันอาทิตย์';
      const satResolution = isSat ? resolveSaturdayLatePenaltyFromPolls(kid, polls, settings) : null;
      const effectivePreset = satResolution
        ? satResolution.preset
        : getEffectiveWeekendLatePenaltyPreset(settings);

      if (mins <= deadlineMins) {
        const applied = addStars(
          10,
          `☀️ เช็คอินกะเช้า${dayLabel}ตรงเวลา (ทีมพี่ใหญ่ +10 ⭐)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '🎓✨',
          title: lang === 'th' ? `เช็คอินเช้า${dayLabel}สำเร็จ (+10 ⭐)` : `Holiday Check-in (+10 ⭐)`,
          message:
            lang === 'th'
              ? isSat
                ? 'ตื่นมาเช็คอินช่วง 08:15–08:35 น. รับ +10 ดาวเรียบร้อยค่ะ'
                : 'ตื่นมาเช็คอินไม่เกิน 08:15 น. รับ +10 ดาวเรียบร้อยค่ะ'
              : `Checked in on time! +10 stars awarded.`,
          tone: 'mint',
        });
        return;
      }

      if (mins <= graceMins) {
        const applied = addStars(
          0,
          `⚠️ เช็คอินกะเช้า${dayLabel}ช่วงอนุโลม (${minsToHHMM(mins)} น. · 0 ⭐)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '⚠️⏰',
          title:
            lang === 'th'
              ? `เช็คอินช่วงอนุโลม (${minsToHHMM(mins)} น.)`
              : `Grace Window (${minsToHHMM(mins)})`,
          message:
            lang === 'th'
              ? isSat
                ? 'อนุโลมได้ไม่เกิน 1 นาที (ถึง 08:36 น. · ยังไม่ลงโทษ) รีบตื่นให้ทันช่วง 08:15–08:35 น. นะคะ'
                : 'อนุโลมได้ไม่เกิน 10 นาที (ถึง 08:25 น.) เนื่องจากพี่เกดต้องเดินปลุกและไขกุญแจ เด็กๆ ต้องรีบทำเวลาลุกมาเช็คอินนะคะ'
              : 'Within grace window (no penalty). Please check in on time!',
          tone: 'yellow',
        });
        return;
      }

      if (isSickToday || isAwayToday) {
        const applied = addStars(
          0,
          `☀️ เช็คอินกะเช้า${dayLabel} (${minsToHHMM(mins)} น. · ยกเว้นโทษป่วย/ลาพัก)`,
          (prev) => ({
            daily: { ...prev.daily, vanOrMorningChecked: true },
          }),
          (prev) => !prev.daily.vanOrMorningChecked
        );
        if (!applied) return;
        onShowAlert({
          icon: '💚',
          title: lang === 'th' ? 'ยกเว้นโทษ (แจ้งป่วย / ลาพัก)' : 'Penalty Waived (Sick / Leave)',
          message:
            lang === 'th'
              ? 'แจ้งป่วยหรือลาพักไว้ ระบบยกเว้นบทลงโทษตื่นสายวันหยุดให้ค่ะ'
              : 'Weekend/holiday late penalty waived due to sick report or leave.',
          tone: 'mint',
        });
        return;
      }

      let applied = false;
      const reasonText = isSat
        ? `ตื่นสายเช้าวันเสาร์ (${minsToHHMM(mins)} น. · เกิน 08:36 น. · ${satResolution!.reasonTagTh})`
        : `ตื่นสายเช้า${dayLabel} (${minsToHHMM(mins)} น. · เกิน 08:25 น.)`;
      const preview = applyWeekendHolidayLatePenaltyToMember(
        kid,
        now,
        lang,
        reasonText,
        effectivePreset
      );
      onUpdateKid(
        kid.id,
        (prev) => {
          if (prev.daily.vanOrMorningChecked) return prev;
          applied = true;
          const res = applyWeekendHolidayLatePenaltyToMember(
            prev,
            now,
            lang,
            reasonText,
            effectivePreset
          );
          return {
            ...res.updatedKid,
            daily: { ...res.updatedKid.daily, vanOrMorningChecked: true },
          };
        },
        `Group 3 ${dayLabel} Late`
      );
      if (!applied) return;
      onShowAlert({
        icon: '📵⚖️',
        title:
          lang === 'th'
            ? `ตื่นสาย${dayLabel} — ${preview.shortTag}`
            : `Holiday Late — ${preview.shortTag}`,
        message: satResolution
          ? `${preview.penaltyText} (${lang === 'th' ? satResolution.reasonTagTh : satResolution.reasonTagEn})`
          : preview.penaltyText,
        tone: 'pink',
      });
      return;
    }

    const isEarly15 = mins <= 7 * 60 + 15 && earlyBonus > 0;
    const earned = 10 + (isEarly15 ? earlyBonus : 0);
    const schoolDeduct = applyDailySchoolDeduction(kid, now, settings, false, isSickToday);
    const applied = addStars(
      earned,
      `ไปเรียน / ฝึกงานกะเช้า (ทีมพี่ใหญ่)${isEarly15 ? ` · เช้าก่อนเวลา 15 นาที (+${earlyBonus} ⭐)` : ''}`,
      (prev) => ({
        avatar: { ...prev.avatar, outfitMode: 'uniform' },
        allowance: applyDailySchoolDeduction(prev, now, settings, false, isSickToday).allowance,
        daily: { ...prev.daily, vanOrMorningChecked: true },
      }),
      (prev) => !prev.daily.vanOrMorningChecked
    );
    if (!applied) return;
    onShowAlert({
      icon: '🎓✨',
      title: lang === 'th' ? `เช็คอินไปฝึกงาน/เรียนสำเร็จ (+${earned} ⭐)` : `College/Internship Check-in (+${earned} ⭐)`,
      message:
        lang === 'th'
          ? `ไม่มีหักสายตอนเช้า รับ +${earned} ดาว${
              coinsEnabled && schoolDeduct.deducted
                ? `\n🐷 หักค่าไปเรียนวันนี้ -${schoolDeduct.amount} ฿ (เหลือในกระปุก ${schoolDeduct.allowance.coins} ฿)`
                : ''
            } ขอให้เป็นวันที่ยอดเยี่ยมในการเรียนรู้!`
          : `No morning deduction! +${earned} stars awarded. Have a productive day!`,
      tone: 'mint',
    });
  };

  // --- SHIFT 2: AFTERNOON RETURN HOME ---
  const handleReturnHome = () => {
    if (kid.daily.returnedHomeChecked) {
      onShowAlert({
        icon: '🏡',
        title: lang === 'th' ? 'เช็คอินกลับบ้านวันนี้แล้ว' : 'Already Checked Return Home',
        message: lang === 'th' ? 'กลับบ้านเรียบร้อยแล้ว อย่าลืมเช็คคิวซักผ้าด้วยนะ' : 'Already checked in at home today.',
        tone: 'mint',
      });
      return;
    }

    if (kid.group === 1) {
      let applied = false;
      onUpdateKid(
        kid.id,
        (prev) => {
          if (prev.daily.returnedHomeChecked) return prev;
          applied = true;
          return {
            ...prev,
            avatar: { ...prev.avatar, outfitMode: 'lounge' },
            daily: {
              ...prev.daily,
              returnedHomeChecked: true,
              speedyNinjaStartMs: now.getTime(),
            },
          };
        },
        'Group 1 Return Home Speedy Ninja'
      );
      if (!applied) return;
      onShowAlert({
        icon: '🥷⏱️',
        title: lang === 'th' ? 'เริ่มภารกิจ Speedy Ninja 20 นาที!' : 'Speedy Ninja 20-Min Timer Started!',
        message:
          lang === 'th'
            ? `เปลี่ยนตัวละครเป็นเสื้อซับกับกางเกงขาสั้นแล้ว!\nรีบถอดชุด ซักชุด และเปลี่ยนชุดภายใน 20 นาทีนะ!\n${laundry.label}`
            : `Changed back into shorts & undershirt!\nUndress, wash uniform, and change within 20 minutes!\n${laundry.label}`,
        tone: 'yellow',
      });
      return;
    }

    if (kid.group === 2) {
      const applied = addStars(
        5,
        'กลับบ้าน & เก็บมือถือเข้ากล่อง (+5 ⭐)',
        (prev) => ({
          avatar: { ...prev.avatar, outfitMode: 'lounge' },
          daily: { ...prev.daily, returnedHomeChecked: true },
        }),
        (prev) => !prev.daily.returnedHomeChecked
      );
      if (!applied) return;
      onShowAlert({
        icon: '🏡📱',
        title: lang === 'th' ? 'กลับบ้าน & เก็บมือถือเข้ากล่อง (+5 ⭐)' : 'Returned Home & Stored Phone (+5 ⭐)',
        message:
          lang === 'th'
            ? `รับ +5 ดาว! เปลี่ยนเป็นชุดอยู่บ้านเรียบร้อย\n${laundry.label}\n(วันเสาร์-อาทิตย์ เก็บมือถือเข้ากล่องไม่เกิน 14:00 น. และห้ามนอนกลางวันนะ)`
            : `Earned +5 stars! Switched to lounge shorts & undershirt.\n${laundry.label}\n(Weekends: store phone by 14:00, no afternoon naps!)`,
        tone: 'mint',
      });
      return;
    }

    // Group 3
    const applied = addStars(
      20,
      'กลับจากฝึกงาน & เก็บมือถือเข้าตู้ทันที (+20 ⭐)',
      (prev) => ({
        avatar: { ...prev.avatar, outfitMode: 'lounge' },
        daily: { ...prev.daily, returnedHomeChecked: true },
      }),
      (prev) => !prev.daily.returnedHomeChecked
    );
    if (!applied) return;
    onShowAlert({
      icon: '🏡🌟',
      title: lang === 'th' ? 'กลับถึงบ้าน & เก็บมือถือเข้าตู้ (+20 ⭐)' : 'Returned from Internship (+20 ⭐)',
      message:
        lang === 'th'
          ? `สุดยอด! รับ +20 ดาว ทำภารกิจส่วนตัวได้เลย\n${laundry.label}`
          : `Awesome! +20 stars awarded. Time for personal tasks!\n${laundry.label}`,
      tone: 'mint',
    });
  };

  // --- SHIFT 3: NIGHT / HOMEWORK / CURFEW ---
  const handleGroup1ExtraStudy = () => {
    if (kid.daily.extraStudyChecked) return;
    const mins = getMinutesOfDay(now);
    const onTime = mins <= 16 * 60 + 50;
    const isEarly15 = onTime && mins <= 16 * 60 + 35 && earlyBonus > 0;
    const earned = (onTime ? 10 : 0) + (isEarly15 ? earlyBonus : 0);
    const applied = addStars(
      earned,
      onTime
        ? `เข้าด่านเรียนเสริมทันเวลา (ไม่เกิน 16:50 น.)${isEarly15 ? ` · มาก่อน 15 นาที (+${earlyBonus} ⭐)` : ''}`
        : 'เข้าเรียนเสริมหลัง 16:50 น.',
      (prev) => ({
        daily: { ...prev.daily, extraStudyChecked: true },
      }),
      (prev) => !prev.daily.extraStudyChecked
    );
    if (!applied) return;
    onShowAlert({
      icon: onTime ? '📚🌟' : '⏰📚',
      title: onTime
        ? lang === 'th'
          ? `เรียนเสริมทันเวลา (+${earned} ⭐)`
          : `Extra Study On Time (+${earned} ⭐)`
        : lang === 'th'
        ? 'เลย 16:50 น. แล้ว'
        : 'Past 16:50',
      message: onTime
        ? lang === 'th'
          ? `ตั้งใจเรียนมาก! รับ +${earned} ดาว${isEarly15 ? ` (รวมเบี้ยขยันมาก่อน 15 นาที +${earlyBonus} ⭐)` : ''}`
          : `Great focus! +${earned} stars added.`
        : lang === 'th'
        ? 'เกิน 16:50 น. รอบนี้ไม่ได้ดาวนะ แต่รีบทบทวนบทเรียนให้เสร็จไวๆ จ้า'
        : 'Past 16:50 so no stars earned, finish your study carefully!',
      tone: onTime ? 'mint' : 'yellow',
    });
  };

  const handleGroup1Chores = () => {
    if (kid.daily.choresChecked) return;
    const mins = getMinutesOfDay(now);
    const isEarly15 = mins <= 18 * 60 && earlyBonus > 0;
    let earned = 0;
    let title = lang === 'th' ? 'เกิน 18:50 น. หมดเวลาวิ่งเล่นแล้ว!' : 'Past 18:50 — Playtime Over!';
    let tone: ModalAlertPayload['tone'] = 'peach';
    if (mins < 18 * 60 + 15) {
      earned = 10 + (isEarly15 ? earlyBonus : 0);
      title =
        lang === 'th'
          ? `เวลาทองคำ! งานบ้านเสร็จก่อน 18:15 น. (+${earned} ⭐)`
          : `Golden Time! Chores Done Before 18:15 (+${earned} ⭐)`;
      tone = 'mint';
    } else if (mins <= 18 * 60 + 50) {
      earned = 3;
      title = lang === 'th' ? 'ทำงานบ้านเสร็จก่อน 18:50 น. (+3 ⭐)' : 'Chores Done Before 18:50 (+3 ⭐)';
      tone = 'yellow';
    }
    const applied = addStars(
      earned,
      `งานบ้าน & ตากชุดนักเรียน${isEarly15 ? ` · เสร็จก่อน 15 นาที (+${earlyBonus} ⭐)` : ''} (+${earned} ⭐)`,
      (prev) => ({
        daily: { ...prev.daily, choresChecked: true },
      }),
      (prev) => !prev.daily.choresChecked
    );
    if (!applied) return;
    onShowAlert({
      icon: earned >= 10 ? '🧺🌟' : earned > 0 ? '🧺✨' : '🌙',
      title,
      message:
        lang === 'th'
          ? earned > 0
            ? `รับ +${earned} ดาว! ตากชุดนักเรียนเรียบร้อย${isEarly15 ? ` (รวมเบี้ยขยัน +${earlyBonus} ⭐)` : ''}`
            : 'เกิน 18:50 น. แล้ว หมดเวลาวิ่งเล่น เตรียมตัวเข้าด่านบอส 20:00 น. นะ'
          : earned > 0
          ? `Earned +${earned} stars!`
          : 'Past 18:50 — prepare for the 20:00 Boss Stage.',
      tone,
    });
  };

  const handleSelectHomeworkPermission = (category: 'ทำการบ้าน' | 'หาข้อมูล' | 'เรียนพิเศษ') => {
    if (!allowHwPerm) {
      setHwPermPopupOpen(false);
      onShowAlert({
        icon: kidHasPhone ? '🚫' : '📵',
        title: !kidHasPhone
          ? lang === 'th'
            ? 'ไม่มีมือถือในโปรไฟล์นี้'
            : 'No Mobile Phone Assigned'
          : lang === 'th'
          ? 'ปุ่มนี้ไม่ได้เปิดสิทธิ์ให้น้อง'
          : 'Permission Not Enabled',
        message: !kidHasPhone
          ? lang === 'th'
            ? `น้อง${kid.nickname} ถูกตั้งค่าว่า "ไม่มีมือถือ" จึงไม่สามารถใช้ปุ่มขออนุญาตใช้มือถือทำการบ้านได้ค่ะ`
            : `${kid.nickname} is marked as having no mobile phone.`
          : lang === 'th'
          ? `ผู้ดูแลตั้งค่าไม่ให้โปรไฟล์นี้กดปุ่ม "ขออนุญาตทำการบ้าน" ค่ะ`
          : 'This button is restricted for your profile.',
        tone: 'yellow',
      });
      return;
    }
    const mins = getMinutesOfDay(now);
    const inAllowedWindow =
      hwPermWin.startMins <= hwPermWin.endMins
        ? mins >= hwPermWin.startMins && mins <= hwPermWin.endMins
        : mins >= hwPermWin.startMins || mins <= hwPermWin.endMins;
    if (!inAllowedWindow) {
      setHwPermPopupOpen(false);
      onShowAlert({
        icon: '⏰',
        title: lang === 'th' ? `อยู่นอกเวลาขออนุญาต (${hwPermWin.labelTh})` : `Outside Permission Window (${hwPermWin.labelEn})`,
        message:
          lang === 'th'
            ? `ปุ่มขออนุญาตทำการบ้านเปิดให้กดเฉพาะช่วงเวลา ${hwPermWin.labelTh} ค่ะ`
            : `Homework permission is only available between ${hwPermWin.labelEn}.`,
        tone: 'yellow',
      });
      return;
    }

    const detail = hwSubject.trim();
    const recordedLabel = detail ? `${category} (${detail})` : category;

    onUpdateKid(
      kid.id,
      (prev) => ({
        ...prev,
        daily: { ...prev.daily, homeworkRegisteredSubject: recordedLabel },
      }),
      `Homework Permission: ${recordedLabel}`
    );

    setHwSubject('');
    setHwPermPopupOpen(false);

    onShowAlert({
      icon: '📝✨',
      title:
        lang === 'th'
          ? `ขออนุญาต "${category}" สำเร็จ!`
          : `"${category}" Permission Approved!`,
      message:
        lang === 'th'
          ? `บันทึกเรียบร้อย: ${recordedLabel}\n⏰ ใช้มือถือเพิ่มได้จนถึงเวลา ${hwCurfewTh}\n⚖️ หากเกิน ${hwCurfewTh} ยังไม่นำมือถือมาเก็บ จะถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วัน`
          : `Recorded: ${recordedLabel}\nExtended until ${hwCurfewEn}. Keeping phone past ${hwCurfewEn} forfeits 1 Free Day phone privilege.`,
      tone: 'blue',
    });
  };

  const handleReturnPhoneCurfew = () => {
    if (!allowReturnPhone) {
      onShowAlert({
        icon: kidHasPhone ? '🚫' : '📵',
        title: !kidHasPhone
          ? lang === 'th'
            ? 'ไม่มีมือถือในโปรไฟล์นี้'
            : 'No Mobile Phone Assigned'
          : lang === 'th'
          ? 'ไม่มีสิทธิ์ใช้ปุ่มคืนมือถือ'
          : 'Command Restricted',
        message: !kidHasPhone
          ? lang === 'th'
            ? `น้อง${kid.nickname} ถูกตั้งค่าว่าไม่มีมือถือ จึงไม่ต้องกดปุ่มคืนมือถือค่ะ`
            : `${kid.nickname} has no mobile phone assigned.`
          : lang === 'th'
          ? 'ผู้ดูแลตั้งค่าจำกัดสิทธิ์ปุ่มนี้ไว้ค่ะ'
          : 'This button is restricted for your profile.',
        tone: 'yellow',
      });
      return;
    }
    if (kid.daily.phoneReturnedChecked) {
      onShowAlert({
        icon: '📱',
        title: lang === 'th' ? 'ส่งคืนมือถือวันนี้แล้ว' : 'Phone Already Returned',
        message: lang === 'th' ? 'ส่งคืนเข้าตู้พี่เลี้ยงเรียบร้อยแล้ว ฝันดีนะ!' : 'Phone safely returned. Good night!',
        tone: 'mint',
      });
      return;
    }
    let latestResult: ReturnType<typeof evaluateOneTapHomeAction> | null = null;
    let applied = false;
    onUpdateKid(
      kid.id,
      (prev) => {
        if (prev.daily.phoneReturnedChecked) return prev;
        const res = evaluateOneTapHomeAction(
          'night_return_phone',
          prev,
          now,
          lang,
          settings,
          isSickToday
        );
        latestResult = res;
        if (!res.updatedKid) return prev;
        applied = true;
        return res.updatedKid;
      },
      'Phone Return (Hub Auto Curfew)'
    );
    const preview =
      latestResult ??
      evaluateOneTapHomeAction('night_return_phone', kid, now, lang, settings, isSickToday);
    if (!applied && !preview.success) return;
    if (preview.penaltyAlert) {
      setPenaltyNoticePopup(preview.penaltyAlert);
      return;
    }
    onShowAlert({
      icon: preview.emoji,
      title: preview.bannerTitle,
      message: preview.bannerSubtitle,
      tone: preview.fineReason ? 'pink' : 'mint',
    });
  };

  // --- STAR TO COIN EXCHANGE ---
  const handleExchangeStarsToCoins = () => {
    if (!coinsEnabled) return;
    if (!isKidSignedInWithEmail) {
      onShowAlert({
        icon: '🔒⭐',
        title: lang === 'th' ? 'กรุณาล็อกอินอีเมลเพื่อปลดล็อกดาว (0 ⭐)' : 'Sign In with Email to Unlock Stars',
        message:
          lang === 'th'
            ? 'ตัวละครที่ยังไม่ล็อกอิน ดาวจะอยู่ที่ 0 ⭐ ค่ะ เมื่อล็อกอินด้วยอีเมลแล้วจึงจะนำดาวที่สะสมมาแลกของในร้านมินิมาร์ทและออมสินได้ค่ะ'
            : 'Stars remain at 0 ⭐ until you sign in with your email to access Minimart and piggy bank exchanges.',
        tone: 'yellow',
      });
      return;
    }
    if (kid.stars < eco.starToCoinStars) {
      onShowAlert({
        icon: '⭐',
        title: lang === 'th' ? 'ดาวความดียังไม่พอแลกเหรียญ' : 'Not Enough Stars to Convert',
        message:
          lang === 'th'
            ? `ต้องใช้ ${eco.starToCoinStars} ⭐ เพื่อแลก +${eco.starToCoinThb} ฿ (ตอนนี้มี ${kid.stars} ⭐)`
            : `Needs ${eco.starToCoinStars} ⭐ for +${eco.starToCoinThb} THB (current: ${kid.stars} ⭐).`,
        tone: 'yellow',
      });
      return;
    }

    let exchanged = false;
    onUpdateKid(
      kid.id,
      (prev) => {
        if (prev.stars < eco.starToCoinStars) return prev;
        exchanged = true;
        const { allowance: currentAllow } = ensureCurrentWeekAllowance(prev, now, settings);
        return {
          ...prev,
          stars: prev.stars - eco.starToCoinStars,
          allowance: {
            ...currentAllow,
            coins: currentAllow.coins + eco.starToCoinThb,
            coinHistory: [
              {
                id: `coin_ex_${Date.now()}`,
                timestamp: now.toISOString(),
                reason: `แลก ${eco.starToCoinStars} ⭐ → เหรียญเข้ากระปุกหมูสีชมพู (+${eco.starToCoinThb} ฿)`,
                amount: eco.starToCoinThb,
                kind: 'star_exchange' as const,
              },
              ...currentAllow.coinHistory,
            ].slice(0, 40),
          },
          starHistory: [
            {
              id: `tx_ex_${Date.now()}`,
              timestamp: now.toISOString(),
              reason: `แลกดาวเป็นเหรียญกระปุกหมูสีชมพู (-${eco.starToCoinStars} ⭐ → +${eco.starToCoinThb} ฿)`,
              amount: -eco.starToCoinStars,
            },
            ...prev.starHistory,
          ].slice(0, 60),
        };
      },
      'Exchange Stars to Pink Piggy Coins'
    );
    if (!exchanged) return;

    onShowAlert({
      icon: '🐷🪙✨',
      title:
        lang === 'th'
          ? `แลก ${eco.starToCoinStars} ⭐ → +${eco.starToCoinThb} ฿ สำเร็จ!`
          : `Converted ${eco.starToCoinStars} ⭐ → +${eco.starToCoinThb} THB!`,
      message:
        lang === 'th'
          ? 'เติมเหรียญเข้ากระปุกหมูสีชมพูของหนูเรียบร้อยแล้วจ้า!'
          : 'Coins added to your personal Pink Piggy Bank!',
      tone: 'mint',
    });
  };

  // --- SHOP PURCHASE ---
  const handleBuyShopItem = (item: ShopItem) => {
    const nowMs = Date.now();
    // Guard against accidental double-clicks within 1s on the exact same item
    if (actionLockRef.current.key === `buy_${item.id}` && nowMs - actionLockRef.current.at < 1000) {
      return;
    }
    actionLockRef.current = { key: `buy_${item.id}`, at: nowMs };

    if (!isKidSignedInWithEmail) {
      onShowAlert({
        icon: '🔒🏪',
        title:
          lang === 'th'
            ? 'ล็อกอินอีเมลเพื่อปลดล็อกดาวช็อปปิ้งมินิมาร์ท!'
            : 'Sign In to Unlock Stars & Minimart!',
        message:
          lang === 'th'
            ? 'ตอนนี้ยอดดาวอยู่ที่ 0 ⭐ เพราะยังไม่ได้ล็อกอินอีเมลค่ะ เมื่อล็อกอินด้วย Google Email ของหนูแล้ว ดาวที่สะสมไว้จะปลดล็อกให้นำมาช็อปปิ้งที่ร้านมินิมาร์ทได้เลยค่ะ'
            : 'Your stars are at 0 ⭐ until you sign in with your Google email to unlock Minimart shopping.',
        tone: 'yellow',
      });
      return;
    }

    if (kid.stars < item.priceStars) {
      onShowAlert({
        icon: '⭐',
        title: lang === 'th' ? 'ดาวสะสมยังไม่พอจ้า' : 'Not Enough Stars Yet',
        message:
          lang === 'th'
            ? `ต้องการ ${item.priceStars} ⭐ แต่ตอนนี้มี ${kid.stars} ⭐ สะสมเพิ่มอีกนิดนะ!`
            : `Needs ${item.priceStars} ⭐, you currently have ${kid.stars} ⭐.`,
        tone: 'yellow',
      });
      return;
    }

    if (item.category === 'cover_item') {
      const alreadyOwned =
        item.subType === 'scene_item'
          ? kid.collectedSceneItems.includes(item.id)
          : kid.ownedShopItemIds.includes(item.id);
      if (alreadyOwned) {
        onShowAlert({
          icon: '🎁',
          title: lang === 'th' ? 'มีไอเทมนี้แล้ว!' : 'Already Owned!',
          message: lang === 'th' ? 'ไปกดสวมใส่หรือตกแต่งได้ที่เมนูแต่งตัวละครเลย' : 'You can equip it in the Wardrobe tab!',
          tone: 'blue',
        });
        return;
      }
    }

    let unlockedNewStage: number | null = null;
    let purchased = false;

    onUpdateKid(
      kid.id,
      (prev) => {
        if (prev.stars < item.priceStars) return prev;
        if (item.category === 'cover_item') {
          const alreadyOwnedPrev =
            item.subType === 'scene_item'
              ? prev.collectedSceneItems.includes(item.id)
              : prev.ownedShopItemIds.includes(item.id);
          if (alreadyOwnedPrev) return prev;
        }
        purchased = true;

        const nextCollected =
          item.subType === 'scene_item'
            ? [...prev.collectedSceneItems, item.id]
            : prev.collectedSceneItems;
        const nextOwned =
          item.category === 'cover_item' && item.subType !== 'scene_item'
            ? [...prev.ownedShopItemIds, item.id]
            : prev.ownedShopItemIds;

        // Check if 7 items in item.sceneStage are all collected -> unlock next stage!
        const nextUnlocked = [...prev.unlockedCoverStages];
        if (item.subType === 'scene_item' && item.sceneStage && item.sceneStage < 7) {
          const stageAllIds = shopItems
            .filter((s) => s.subType === 'scene_item' && s.sceneStage === item.sceneStage)
            .map((s) => s.id);
          const countInStage = stageAllIds.filter((id) => nextCollected.includes(id)).length;
          if (countInStage >= 7 && !nextUnlocked.includes(item.sceneStage + 1)) {
            nextUnlocked.push(item.sceneStage + 1);
            unlockedNewStage = item.sceneStage + 1;
          }
        }

        return {
          ...prev,
          stars: Math.max(0, prev.stars - item.priceStars),
          collectedSceneItems: nextCollected,
          ownedShopItemIds: nextOwned,
          unlockedCoverStages: nextUnlocked,
          starHistory: [
            {
              id: `tx_${Date.now()}`,
              timestamp: now.toISOString(),
              reason: `แลก: ${item.nameTh}`,
              amount: -item.priceStars,
            },
            ...prev.starHistory,
          ].slice(0, 60),
        };
      },
      `Purchase ${item.nameTh}`
    );

    if (!purchased) {
      onShowAlert({
        icon: '⭐',
        title: lang === 'th' ? 'ไม่สามารถทำรายการซ้ำหรือดาวไม่พอ' : 'Purchase Skipped',
        message: lang === 'th' ? 'ยอดดาวไม่พอหรือคุณมีไอเทมนี้แล้วค่ะ' : 'Not enough stars or already owned.',
        tone: 'yellow',
      });
      return;
    }

    onAddSnackBill({
      id: `bill_${Date.now()}`,
      kidId: kid.id,
      kidNickname: kid.nickname,
      itemId: item.id,
      itemName: item.nameTh,
      starsSpent: item.priceStars,
      category: item.category,
      dateKey: todayKey,
      createdAt: now.toISOString(),
      fulfilled: item.category === 'cover_item',
    });

    onShowAlert({
      icon: unlockedNewStage ? '🎉🏰' : item.emoji,
      title: unlockedNewStage
        ? lang === 'th'
          ? `ปลดล็อกหน้าปกฉากที่ ${unlockedNewStage} แล้ว!`
          : `Unlocked Cover Stage ${unlockedNewStage}!`
        : lang === 'th'
        ? 'แลกของรางวัลสำเร็จ!'
        : 'Redeemed Successfully!',
      message: unlockedNewStage
        ? lang === 'th'
          ? `สะสมครบ 7 ไอเทมแล้ว! สามารถเปลี่ยนฉากหลังเป็นฉากที่ ${unlockedNewStage} ได้เลย`
          : `Collected all 7 items! You unlocked Cover Stage ${unlockedNewStage}!`
        : item.category === 'snack'
        ? lang === 'th'
          ? `แลก "${item.nameTh}" (-${item.priceStars} ⭐) ส่งบิลไปที่หน้าพี่เลี้ยงแล้ว!`
          : `Redeemed "${item.nameEn}" (-${item.priceStars} ⭐). Sent to Staff snack list!`
        : lang === 'th'
        ? `ได้รับ "${item.nameTh}" (-${item.priceStars} ⭐) เข้าคลังของฉันแล้ว!`
        : `Unlocked "${item.nameEn}" (-${item.priceStars} ⭐)!`,
      tone: 'mint',
    });
  };

  // --- WARDROBE CASUAL & FESTIVAL DRESS RULES ---
  const activeFestival = getActiveFestival(now, activeFestivalOverride);

  const handleToggleOutfitMode = (mode: OutfitMode, itemId?: string) => {
    if (mode === 'casual' || mode === 'custom_design') {
      const check = canWearCasualOutfitNow(now, isPublicHolidayToday);
      if (!check.allowed) {
        onShowAlert({
          icon: '🏫⏰',
          title: lang === 'th' ? 'ยังไม่ถึงเวลาใส่ชุดเที่ยว / ชุดออกแบบเอง' : 'Casual Outfit Locked',
          message: lang === 'th' ? check.reasonTh : check.reasonEn,
          tone: 'yellow',
        });
        return;
      }
    }
    if (mode === 'festival') {
      const targetOutfitId = itemId ?? activeFestival?.defaultOutfitId;
      const targetItem = shopItems.find((s) => s.id === targetOutfitId);
      const isCurrentActiveFestivalOutfit = Boolean(
        activeFestival && targetItem?.festivalId === activeFestival.id
      );
      const isOwned = Boolean(targetOutfitId && kid.ownedShopItemIds.includes(targetOutfitId));
      if (!isCurrentActiveFestivalOutfit && !isOwned) {
        onShowAlert({
          icon: '🎊',
          title: lang === 'th' ? 'ปลดล็อกชุดเทศกาลในร้านค้าก่อนนะคะ' : 'Unlock Festival Outfit in Shop',
          message:
            lang === 'th'
              ? 'ชุดที่ตรงกับเทศกาลปัจจุบันใส่ได้ฟรีทันที! ส่วนชุดเทศกาลอื่นๆ สามารถแลกด้วยดาวเพื่อใส่ได้ตลอดปีค่ะ'
              : 'Current festival outfits are free to wear! Other festival outfits can be unlocked in the Star Shop.',
          tone: 'lavender',
        });
        return;
      }
      onUpdateKid(
        kid.id,
        (prev) => ({
          ...prev,
          avatar: {
            ...prev.avatar,
            outfitMode: 'festival',
            equippedFestivalId: targetOutfitId ?? prev.avatar.equippedFestivalId,
          },
        }),
        `Wear Festival Outfit (${targetItem?.nameTh ?? mode})`
      );
      return;
    }

    onUpdateKid(
      kid.id,
      (prev) => ({
        ...prev,
        avatar: {
          ...prev.avatar,
          outfitMode: mode,
          equippedCasualId: mode === 'casual' ? itemId ?? prev.avatar.equippedCasualId : prev.avatar.equippedCasualId,
        },
      }),
      `Change Outfit ${mode}`
    );
  };

  const handleSaveCustomOutfit = (design: CustomOutfitDesign, equipNow: boolean) => {
    const check = canWearCasualOutfitNow(now, isPublicHolidayToday);
    const shouldEquip = equipNow && check.allowed;

    onUpdateKid(
      kid.id,
      (prev) => ({
        ...prev,
        avatar: {
          ...prev.avatar,
          customOutfit: design,
          outfitMode: shouldEquip ? 'custom_design' : prev.avatar.outfitMode,
        },
      }),
      equipNow ? 'Save & Wear Custom Anime Outfit' : 'Save Custom Anime Outfit'
    );

    if (equipNow && !check.allowed) {
      onShowAlert({
        icon: '🎨⏰',
        title: lang === 'th' ? 'บันทึกแบบชุดแล้ว! (ใส่ได้หลัง 18:30 น.)' : 'Design Saved! (Wearable after 18:30)',
        message: lang === 'th' ? check.reasonTh : check.reasonEn,
        tone: 'yellow',
      });
      return;
    }

    onShowAlert({
      icon: '✨🎨',
      title: shouldEquip
        ? lang === 'th'
          ? 'สวมใส่ชุดออกแบบเองแล้ว!'
          : 'Wearing Custom Design!'
        : lang === 'th'
        ? 'บันทึกแบบชุดของฉันแล้ว!'
        : 'Custom Design Saved!',
      message: shouldEquip
        ? lang === 'th'
          ? 'ตัวละครอนิเมะของหนูใส่ชุดที่ออกแบบเองเรียบร้อย น่ารักสุดๆ!'
          : 'Your anime avatar is now wearing your custom-designed outfit!'
        : lang === 'th'
        ? 'บันทึกชุดสวยๆ ไว้ในตู้เสื้อผ้าเรียบร้อย'
        : 'Saved safely in your wardrobe!',
      tone: 'mint',
    });
  };

  const todayReturnPhotos = returnHomePhotos.filter(
    (p) => p.kidId === kid.id && p.dateKey === todayKey
  );

  const kidBills = snackBills.filter((b) => b.kidId === kid.id);
  const hasKitchenDuty =
    kid.kitchenDuty.evening1530 || kid.kitchenDuty.sat0930 || kid.kitchenDuty.sun0915;

  const isCleanPenalty =
    (!coinsEnabled || kid.penalty.lateFineThb === 0) &&
    kid.penalty.phoneConfiscatedUntil1830Date !== todayKey &&
    kid.penalty.noEveningPhoneTomorrowDate !== todayKey &&
    kid.penalty.noEveningPhone1830To2245Date !== todayKey &&
    kid.penalty.noSevenElevenDate !== todayKey &&
    kid.penalty.fridayFreeDayDeductedCount === 0;

  const activeScheduledAnnouncements = announcements.filter(
    (a) => a.audience !== 'staff_only' && getAnnouncementScheduleStatus(a, now) === 'active'
  );
  const sortedAnnouncements = [...activeScheduledAnnouncements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const unvotedOpenPolls = polls.filter((p) => !p.closed && !p.votedKidIds.includes(kid.id));
  const myPrivateMessages = privateMessages.filter((m) => m.kidId === kid.id);
  const repliedCount = myPrivateMessages.filter((m) => Boolean(m.staffReply)).length;
  const kidsList = allMembers.filter((m) => m.role === 'kid');
  const dailyHouseChore = getDailyHouseChoreForKid(kid, kidsList, now, isPublicHolidayToday);
  const trashDutyInfo = getTrashDutyInfoForDate(now);
  const isMyTrashWeek = isKidAssignedTrashWeek(kid, trashDutyInfo);
  const dynamicEventAnnouncement = getDynamicTimeEventAnnouncement(
    now,
    kid,
    dailyHouseChore.titleTh,
    dailyHouseChore.titleEn,
    isPublicHolidayToday,
    activeFestival
  );
  const priorityStaffAnnouncement =
    sortedAnnouncements.find(
      (a) => a.id !== 'ann_welcome' && (a.priority === 'urgent' || a.pinned || Boolean(a.startAt || a.endAt))
    ) ?? null;
  const topAnnouncement = priorityStaffAnnouncement;
  const streakCount = kid.streak?.currentMorningStreak ?? 0;
  const kidHealth: HealthProfile = kid.healthProfile ?? {
    bloodType: 'ไม่ระบุ',
    foodAllergies: 'ไม่มี',
    drugAllergies: 'ไม่มี',
    chronicConditions: 'ไม่มี',
    regularMeds: 'ไม่มี',
    emergencyNote: '',
  };
  const mySupplyRequests = supplyRequests.filter((r) => r.kidId === kid.id);
  const openLostCount = lostFoundItems.filter((i) => i.status !== 'claimed').length;
  const myDeedRedemptions = deedRedemptions.filter((d) => d.kidId === kid.id);
  const pendingDeedsCount = myDeedRedemptions.filter((d) => d.status === 'assigned').length;
  const hasSentKindnessToday = kindnessCards.some(
    (c) => c.fromKidId === kid.id && c.dateKey === todayKey
  );

  // Friend Home Visit computations
  const incomingPendingVisits = friendVisits.filter(
    (v) => v.toKidId === kid.id && v.status === 'pending'
  );
  const mySentVisits = friendVisits.filter((v) => v.fromKidId === kid.id);
  const activeAcceptedVisit =
    friendVisits.find(
      (v) => v.status === 'accepted' && (v.toKidId === kid.id || v.fromKidId === kid.id)
    ) ?? null;

  const visitingBuddy: {
    member: Member;
    activity: FriendVisitActivity;
    isHost: boolean;
  } | null = (() => {
    if (!activeAcceptedVisit) return null;
    const isHost = activeAcceptedVisit.toKidId === kid.id;
    const buddyId = isHost ? activeAcceptedVisit.fromKidId : activeAcceptedVisit.toKidId;
    const buddyMember = kidsList.find((m) => m.id === buddyId);
    if (!buddyMember) return null;
    return {
      member: buddyMember,
      activity: activeAcceptedVisit.activity,
      isHost,
    };
  })();

  const handleSavePetWithStars = (
    nextPet: PetCompanionConfig,
    actionLabel: string,
    bonusStars?: number,
    starReason?: string
  ) => {
    const earned = bonusStars && bonusStars > 0 ? bonusStars : 0;
    onUpdateKid(
      kid.id,
      (prev) => ({
        ...prev,
        pet: nextPet,
        stars: earned > 0 ? Math.max(0, prev.stars + earned) : prev.stars,
        starHistory:
          earned > 0
            ? [
                {
                  id: `tx_pet_feed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: now.toISOString(),
                  reason: starReason || `🐾 ให้อาหารสัตว์เลี้ยง (+${earned} ⭐)`,
                  amount: earned,
                },
                ...prev.starHistory,
              ].slice(0, 60)
            : prev.starHistory,
      }),
      actionLabel
    );
  };

  const handleCopyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const isPrivacyBlurred = Boolean(pinRequestAction);

  return (
    <div className="space-y-5">
      <div
        className={`space-y-5 transition-all duration-150 ${
          isPrivacyBlurred ? 'blur-xl opacity-20 pointer-events-none select-none' : ''
        }`}
        aria-hidden={isPrivacyBlurred}
      >
      {/* Top Bar Inside Kid Hub: Mobile-Friendly Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] sm:min-h-[46px] rounded-[18px] sm:rounded-[20px] bg-white hover:bg-[#FADADD]/40 border-2 border-[#EBD8C3] px-3.5 sm:px-5 py-1.5 text-xs sm:text-sm font-bold text-[#3D322C] shadow-sm cursor-pointer whitespace-nowrap"
          >
            ←{' '}
            {openedFromManager
              ? lang === 'th'
                ? 'กลับหน้าผู้จัดการ'
                : 'Back to Manager'
              : lang === 'th'
              ? 'กลับหน้าแรก'
              : 'Back to Home'}
          </button>

          {linkedKidSession && (
            <span className="inline-flex items-center gap-1 rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] px-2.5 py-1 text-[11px] font-extrabold text-[#114A42]">
              <span>☁️</span>
              <span className="truncate max-w-[160px] sm:max-w-none">
                {cloudUserEmail || linkedKidSession.email}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm font-semibold text-[#6E5C52]">
          <span className="hidden sm:inline">{groupLabel}</span>
          <span className="text-xs font-bold tabular-nums text-[#7B695F] bg-white/90 border border-[#EBD8C3] rounded-xl px-2.5 py-1">
            🕒 {formatDigitalClock(now)}
          </span>
        </div>
      </div>

      {now.getDay() === 5 && <FridayBalloonBanner lang={lang} variant="kid" />}

      {/* 2-SECTION LAYOUT: LEFT = Profile + Tamagotchi + 3 Pet Buttons | RIGHT = 4 Main Vertical Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch">
      {/* LEFT SECTION: PROFILE + TAMAGOTCHI + 3 PET BUTTONS */}
      <div className="md:col-span-6 rounded-[24px] sm:rounded-[32px] border-2 border-[#F2C6D0] bg-gradient-to-br from-[#FFFDF9] via-[#FFF9FA] to-[#F7FCFB] p-3.5 sm:p-5 pastel-shadow flex flex-col justify-between gap-3.5">
        {/* Compact Kid Identity, Star Wallet & Google Sign-In Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#F3E6DE]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-white border border-[#EBD8C3] flex items-center justify-center text-xl shrink-0 shadow-2xs">
              {kid.emoji}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-base sm:text-lg font-extrabold text-[#3D322C] truncate">
                  {lang === 'th' ? `น้อง${kid.nickname}` : kid.nickname}
                </span>
                {activeProfileGift && (
                  <button
                    type="button"
                    onClick={() =>
                      onShowAlert({
                        icon: activeProfileGift.emoji,
                        title: `${activeProfileGift.title}${
                          activeProfileGift.amountThb && activeProfileGift.amountThb > 0
                            ? ` (+${activeProfileGift.amountThb.toLocaleString()} ฿)`
                            : ''
                        }`,
                        message: `${lang === 'th' ? 'จาก' : 'From'}: ${activeProfileGift.senderName}\n${
                          activeProfileGift.message ||
                          (lang === 'th'
                            ? 'ขอให้น้องมีความสุขมากๆ นะคะ! (แสดงบนโปรไฟล์วันนี้ 1 วัน)'
                            : 'Wishing you a wonderful day!')
                        }`,
                        tone: 'yellow',
                      })
                    }
                    className="rounded-full bg-[#FFF5BA] border border-[#F0D568] px-2 py-0.5 text-[11px] font-extrabold text-[#5A4614] cursor-pointer"
                  >
                    {activeProfileGift.emoji} {lang === 'th' ? 'ของขวัญวันนี้' : 'Gift'}
                  </button>
                )}
              </div>
              <div className="text-[11px] font-semibold text-[#7B695F] truncate">{groupLabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSubModal('star_history')}
              className="min-h-[36px] rounded-xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#E7C958] px-3 py-1 text-xs sm:text-sm font-extrabold text-[#4A380D] tabular-nums cursor-pointer flex items-center gap-1"
            >
              <span>⭐</span>
              <span>{kid.stars.toLocaleString()}</span>
              {!isKidSignedInWithEmail && (
                <span className="text-[10px] font-bold text-[#8A5A00]">
                  {lang === 'th' ? '(ซิงค์อีเมล)' : '(Sync)'}
                </span>
              )}
            </button>

            {coinsEnabled && (
              <>
                <button
                  type="button"
                  onClick={() => setPiggyModal('pink')}
                  className="min-h-[36px] rounded-xl bg-[#FFE8EF] hover:bg-[#FFD8E4] border border-[#F3B7C0] px-2.5 py-1 text-xs font-extrabold text-[#7B2E3B] tabular-nums cursor-pointer"
                >
                  🐷 {liveAllowance.coins.toLocaleString()} ฿
                </button>
                <button
                  type="button"
                  onClick={() => setPiggyModal('gold')}
                  className="min-h-[36px] rounded-xl bg-[#FFF7D6] hover:bg-[#FCEFA8] border border-[#E7C958] px-2.5 py-1 text-xs font-extrabold text-[#6B4800] tabular-nums cursor-pointer"
                >
                  🪙 {goldenPoolBalance.toLocaleString()}
                </button>
              </>
            )}

            {!isKidSignedInWithEmail && (
              <button
                type="button"
                disabled={emailLoginBusy}
                onClick={async () => {
                  if (kid.linkedEmail) {
                    setEmailLoginBusy(true);
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
                      setEmailLoginBusy(false);
                    }
                  } else {
                    setMySpaceForm(kid.mySpace);
                    setLinkedEmailForm(kid.linkedEmail ?? '');
                    setSubModal('profile_modal');
                  }
                }}
                className="min-h-[36px] rounded-xl bg-[#E8FAF6] hover:bg-[#D5F5ED] border border-[#8FD4C6] px-2.5 py-1 text-[11px] font-extrabold text-[#114A42] cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {emailLoginBusy
                  ? '⏳...'
                  : kid.linkedEmail
                  ? lang === 'th'
                    ? '📧 ล็อกอินอีเมล'
                    : '📧 Sign In Email'
                  : lang === 'th'
                  ? '📧 ผูกอีเมล'
                  : '📧 Sync Email'}
              </button>
            )}
          </div>
        </div>

        {/* Tamagotchi Virtual Pet Stage */}
        {(() => {
          if (!kid.pet) {
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm sm:text-base font-extrabold text-[#6B3242]">
                      🐾{' '}
                      {lang === 'th'
                        ? 'เลือกเลี้ยงสัตว์ทามาก๊อตจิ (10 สายพันธุ์ · ฟรี!)'
                        : 'Pick Your Tamagotchi Companion (10 Species · Free!)'}
                    </div>
                    <div className="text-xs text-[#7B695F]">
                      {lang === 'th'
                        ? `เข้ามาให้อาหารทุกวันรับ +${PET_FEED_STAR_REWARD} ⭐/มื้อ (สูงสุด ${PET_DAILY_FEED_STAR_CAP} มื้อ/วัน = +${PET_FEED_STAR_REWARD * PET_DAILY_FEED_STAR_CAP} ⭐)`
                        : `Feed daily to earn +${PET_FEED_STAR_REWARD} ⭐/meal (up to ${PET_DAILY_FEED_STAR_CAP}/day)`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubModal('pet_modal')}
                    className="rounded-xl bg-white hover:bg-[#FFF5F7] border border-[#F2C6D0] px-3 py-1.5 text-xs font-bold text-[#7B2E3B] cursor-pointer"
                  >
                    ✏️ {lang === 'th' ? 'ตั้งชื่อ & เลือกสีขนเอง' : 'Customize First'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PET_SPECIES_CATALOG.map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => {
                        const adopted = createAdoptedPet(sp.id, now);
                        handleSavePetWithStars(
                          adopted,
                          `Adopt Tamagotchi: ${sp.nameTh} (${adopted.name})`
                        );
                        setPetHeroToast(
                          lang === 'th'
                            ? `${sp.soundTh} รับเลี้ยง "${adopted.name}" (${sp.nameTh}) แล้ว! กดให้อาหารเพื่อรับ +${PET_FEED_STAR_REWARD} ⭐ เลย`
                            : `Adopted ${adopted.name} (${sp.nameEn})!`
                        );
                      }}
                      className="min-h-[52px] rounded-2xl border-2 px-3 py-2 text-left flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98] hover:shadow-xs"
                      style={{
                        backgroundColor: sp.badgeBg,
                        borderColor: sp.borderColor,
                        color: sp.badgeText,
                      }}
                    >
                      <span className="text-2xl shrink-0">{sp.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate">
                          {lang === 'th' ? sp.nameTh : sp.nameEn}
                        </div>
                        <div className="text-[10px] opacity-80 truncate">
                          {lang === 'th' ? 'แตะรับเลี้ยง' : 'Tap adopt'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          const pet = kid.pet;
          const speciesInfo = getPetSpeciesInfo(pet.species);
          const livePet = computeLivePetStats(pet, now);
          const feedStars = getPetFeedStarStatus(pet, todayKey);
          const moodSpeech =
            petHeroToast ??
            (livePet.mood === 'hungry'
              ? lang === 'th'
                ? `${pet.name} หิวจังเลย~ ป้อนข้าวรับ +${PET_FEED_STAR_REWARD} ⭐ นะ!`
                : `${pet.name} is hungry! Feed for +${PET_FEED_STAR_REWARD} ⭐!`
              : livePet.mood === 'lonely'
              ? lang === 'th'
                ? `${pet.name} อยากเล่นด้วย~ กดเล่นกันหน่อยสิ 💕`
                : `${pet.name} wants to play!`
              : feedStars.canEarnStars
              ? lang === 'th'
                ? `${speciesInfo.soundTh} ให้อาหารวันนี้ได้อีก ${feedStars.remainingToday} มื้อ (มื้อละ +${PET_FEED_STAR_REWARD} ⭐)`
                : `Feed today to earn +${PET_FEED_STAR_REWARD} ⭐ (${feedStars.remainingToday} left)!`
              : lang === 'th'
              ? `${pet.name} อิ่มแปล้ & มีความสุขสุดๆ เลยวันนี้ 💖`
              : `${pet.name} is full & happy today! 💖`);

          return (
            <div className="flex flex-col gap-3 flex-1 justify-between">
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                {/* LCD Tamagotchi Pod */}
                <div className="rounded-[22px] border-2 border-[#F2C6D0] bg-white px-3.5 py-3 flex sm:flex-col items-center justify-between sm:justify-center gap-2.5 sm:w-40 shrink-0 shadow-2xs">
                  <PetCanvasSvg
                    pet={pet}
                    mood={livePet.mood}
                    sizeClass="w-20 h-20 sm:w-24 sm:h-24 shrink-0"
                  />
                  <div className="flex-1 sm:flex-none text-left sm:text-center space-y-1 min-w-0">
                    <div className="flex sm:justify-center items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-[#3D322C] truncate">
                        {pet.name}
                      </span>
                      <span className="rounded-full bg-[#FFF0F4] border border-[#F3B7C0] px-2 py-0.5 text-[10px] font-extrabold text-[#7B2E3B]">
                        Lv.{livePet.level}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
                      style={{
                        backgroundColor: speciesInfo.badgeBg,
                        color: speciesInfo.badgeText,
                        borderColor: speciesInfo.borderColor,
                      }}
                    >
                      <span>{speciesInfo.emoji}</span>
                      <span>{lang === 'th' ? speciesInfo.nameTh : speciesInfo.nameEn}</span>
                    </div>
                    <div className="text-[11px] font-bold text-[#8C5262] tabular-nums">
                      ❤️ {livePet.affection}/{livePet.nextLevelAffection}
                    </div>
                  </div>
                </div>

                {/* Speech + Fullness/Happiness Bars */}
                <div className="flex-1 flex flex-col justify-center gap-2.5 min-w-0">
                  <div className="rounded-2xl bg-[#FFF8CC] border border-[#F5DE93] px-3 py-2 text-xs font-bold text-[#5A4614] leading-snug">
                    💬 “{moodSpeech}”
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="rounded-xl bg-white/90 border border-[#EAE0D8] px-3 py-2 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>🥣 {lang === 'th' ? 'ความอิ่ม' : 'Full'}</span>
                        <span className="tabular-nums">{livePet.hunger}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F3E9DF] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#6CCBC0] transition-all"
                          style={{ width: `${livePet.hunger}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/90 border border-[#EAE0D8] px-3 py-2 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>💖 {lang === 'th' ? 'ความสุข' : 'Happy'}</span>
                        <span className="tabular-nums">{livePet.happiness}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F3E9DF] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#F28B9C] transition-all"
                          style={{ width: `${livePet.happiness}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Quick Pet Care Buttons in Left Section */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const treatName = lang === 'th' ? speciesInfo.treatTh : speciesInfo.treatEn;
                    const { nextPet, earnedStars, remainingAfter } = getNextFedPetState(
                      pet,
                      25,
                      15,
                      6,
                      now,
                      todayKey
                    );
                    handleSavePetWithStars(
                      nextPet,
                      `Quick Feed Pet (${treatName})`,
                      earnedStars,
                      earnedStars > 0
                        ? `🐾 ให้อาหาร ${pet.name} (${treatName}) (+${earnedStars} ⭐)`
                        : undefined
                    );
                    setPetHeroToast(
                      lang === 'th'
                        ? earnedStars > 0
                          ? `${speciesInfo.soundTh} ป้อน${treatName}ให้ ${pet.name} แล้ว! รับ +${earnedStars} ⭐ (เหลือรับดาวได้อีก ${remainingAfter} มื้อวันนี้)`
                          : `${speciesInfo.soundTh} ${pet.name} กิน${treatName} อร่อยจัง! (+6 ❤️ · วันนี้รับดาวครบ 3 มื้อแล้ว)`
                        : earnedStars > 0
                        ? `Fed ${pet.name}! +${earnedStars} ⭐ (${remainingAfter} left today)`
                        : `Fed ${pet.name}!`
                    );
                  }}
                  className="min-h-[46px] rounded-2xl border-2 border-[#6CCBC0] bg-[#DCF7F2] hover:bg-[#C9F0E9] px-2 py-2 text-[11px] sm:text-xs font-extrabold text-[#114A42] cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  <span className="shrink-0">{speciesInfo.treatEmoji}</span>
                  <span className="truncate">
                    {feedStars.canEarnStars
                      ? lang === 'th'
                        ? `ให้อาหาร (+${PET_FEED_STAR_REWARD}⭐)`
                        : `Feed (+${PET_FEED_STAR_REWARD}⭐)`
                      : lang === 'th'
                      ? `ให้อาหาร (${feedStars.usedToday}/3 ✓)`
                      : `Feed (${feedStars.usedToday}/3)`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextPet: PetCompanionConfig = {
                      ...pet,
                      hunger: livePet.hunger,
                      happiness: Math.min(100, livePet.happiness + 18),
                      affection: livePet.affection + 5,
                      lastPlayedAt: now.toISOString(),
                    };
                    handleSavePetWithStars(nextPet, `Quick Play Pet (${pet.name})`);
                    setPetHeroToast(
                      lang === 'th'
                        ? `${speciesInfo.soundTh} เล่นกับ ${pet.name} สนุกสุดๆ (+18% สุข · +5 ❤️)`
                        : `Played with ${pet.name}! (+18% Happy)`
                    );
                  }}
                  className="min-h-[46px] rounded-2xl border-2 border-[#F3B7C0] bg-[#FFF0F4] hover:bg-[#FFE3EB] px-2 py-2 text-[11px] sm:text-xs font-extrabold text-[#7B2E3B] cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  <span className="shrink-0">🎾</span>
                  <span className="truncate">{lang === 'th' ? 'เล่นกับน้อง' : 'Play'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubModal('pet_modal')}
                  className="min-h-[46px] rounded-2xl border-2 border-[#C8B7EB] bg-[#EFE8FC] hover:bg-[#E4DAF9] px-2 py-2 text-[11px] sm:text-xs font-extrabold text-[#3E2B63] cursor-pointer flex items-center justify-center gap-1 active:scale-[0.98]"
                >
                  <span className="shrink-0">🐾</span>
                  <span className="truncate">
                    {lang === 'th' ? '10 สายพันธุ์' : '10 Breeds'}
                  </span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* RIGHT SECTION: 4 MAIN ACTION BUTTONS VERTICAL (ไปโรงเรียน · กลับบ้าน · ทำการบ้าน · รวมปุ่มทั้งหมด) */}
      <div className="md:col-span-6 grid grid-cols-1 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setSubModal('shift_morning')}
            className="min-h-[66px] sm:min-h-[74px] rounded-2xl border-2 border-[#F0D98D] bg-[#FFFBEA] hover:bg-[#FFF5CC] px-3.5 sm:px-4 py-2.5 sm:py-3 text-left flex items-center justify-between gap-3 transition-colors active:scale-[0.99] cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white border border-[#F3E4AF] flex items-center justify-center text-xl sm:text-2xl shrink-0">
                🚌
              </span>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-[#4D3B10] leading-tight truncate">
                  {lang === 'th' ? 'ไปโรงเรียน' : 'Go to School'}
                </div>
                <p className="text-[11px] font-medium text-[#7A6428] mt-0.5 truncate">
                  {kid.group === 1
                    ? lang === 'th'
                      ? 'เช็คสุขภาพ · ข้าวเช้า & รถตู้'
                      : 'Health check · Breakfast & van'
                    : kid.group === 2
                    ? lang === 'th'
                      ? 'เช็คสุขภาพ · มือถือ & ออกเดินทาง'
                      : 'Health check · Phone & depart'
                    : lang === 'th'
                    ? 'เช็คสุขภาพ · ไปเรียน / ฝึกงาน'
                    : 'Health check · School / intern'}
                </p>
              </div>
            </div>
            {kid.daily.vanOrMorningChecked && (
              <span className="text-sm font-extrabold text-[#2F685E] shrink-0">✓</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubModal('shift_afternoon')}
            className="min-h-[66px] sm:min-h-[74px] rounded-2xl border-2 border-[#A5DFD4] bg-[#EFFAF7] hover:bg-[#E1F6F1] px-3.5 sm:px-4 py-2.5 sm:py-3 text-left flex items-center justify-between gap-3 transition-colors active:scale-[0.99] cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white border border-[#BCE8DF] flex items-center justify-center text-xl sm:text-2xl shrink-0">
                🏡
              </span>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-[#19534B] leading-tight truncate">
                  {now.getDay() === 5
                    ? lang === 'th'
                      ? 'กลับบ้านและเก็บโทรศัพท์มือถือ'
                      : 'Return Home & Store Phone'
                    : lang === 'th'
                    ? 'กลับบ้าน'
                    : 'Return Home'}
                </div>
                <p className="text-[11px] font-medium text-[#326E65] mt-0.5 truncate">
                  {now.getDay() === 5
                    ? lang === 'th'
                      ? '🎈 Free Day 15:00–18:00 น. · สั่งเซเว่นได้นะคะ!'
                      : '🎈 Free Day 15:00–18:00 · 7-Eleven orders open!'
                    : kid.group === 1
                    ? lang === 'th'
                      ? 'เช็คสุขภาพ · ถ่ายรูป & Speedy Ninja'
                      : 'Health check · Photo & Ninja'
                    : kid.group === 2
                    ? lang === 'th'
                      ? 'เช็คสุขภาพ · ถ่ายรูป & คิวซักผ้า'
                      : 'Health check · Photo & laundry'
                    : lang === 'th'
                    ? 'เช็คสุขภาพ · เก็บมือถือ & คิวซักผ้า'
                    : 'Health check · Store phone'}
                </p>
              </div>
            </div>
            {kid.daily.returnedHomeChecked && (
              <span className="text-sm font-extrabold text-[#2F685E] shrink-0">✓</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubModal('shift_night')}
            className="min-h-[66px] sm:min-h-[74px] rounded-2xl border-2 border-[#CFC2EB] bg-[#F5F1FC] hover:bg-[#ECE4FA] px-3.5 sm:px-4 py-2.5 sm:py-3 text-left flex items-center justify-between gap-3 transition-colors active:scale-[0.99] cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white border border-[#DDD3F2] flex items-center justify-center text-xl sm:text-2xl shrink-0">
                {now.getDay() === 5 ? '📱' : '✍️'}
              </span>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-[#3E2B63] leading-tight truncate">
                  {now.getDay() === 5
                    ? lang === 'th'
                      ? 'มารับโทรศัพท์มือถือ'
                      : 'Pick Up Mobile Phone'
                    : lang === 'th'
                    ? 'ทำการบ้าน'
                    : 'Homework'}
                </div>
                <p className="text-[11px] font-medium text-[#5B4782] mt-0.5 truncate">
                  {now.getDay() === 5
                    ? lang === 'th'
                      ? 'Free Day 18:15–22:45 น. · คืนศุกร์ไม่ต้องเก็บมือถือ'
                      : 'Free Day 18:15–22:45 · Keep phone tonight'
                    : kid.group === 1
                    ? lang === 'th'
                      ? 'เรียนเสริม ขออนุญาต & ด่านบอส'
                      : 'Study, homework & Boss Stage'
                    : kid.group === 2
                    ? lang === 'th'
                      ? `เช็คลิสต์ · ขออนุญาต (${hwPermWin.labelTh}) & คืน ${hwCurfewEn}`
                      : `Checklist · Homework (${hwPermWin.labelEn}) & ${hwCurfewEn}`
                    : lang === 'th'
                    ? 'ขออนุญาตทำการบ้าน & คืนมือถือ Curfew'
                    : 'Homework permission & phone curfew'}
                </p>
              </div>
            </div>
            {(now.getDay() === 5
              ? kid.daily.eveningPhoneUnlocked
              : kid.daily.bossStageUnlocked || kid.daily.phoneReturnedChecked) && (
              <span className="text-sm font-extrabold text-[#2F685E] shrink-0">✓</span>
            )}
          </button>

        {/* Single Combined Button Hiding All Other Buttons & Utilities */}
        {(() => {
          const allToolsAlertCount =
            incomingPendingVisits.length +
            unvotedOpenPolls.length +
            pendingDeedsCount +
            (stepReminder.nextStep?.urgent ? 1 : 0);
          return (
            <button
              type="button"
              onClick={() => setSubModal('all_tools_modal')}
              className="w-full min-h-[66px] sm:min-h-[74px] rounded-2xl border-2 border-[#E7DAD0] bg-white hover:bg-[#FAF5EF] px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 transition-colors active:scale-[0.995] cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-[#FFF6EA] border border-[#EED8BE] flex items-center justify-center text-xl sm:text-2xl shrink-0">
                  🧰
                </span>
                <div className="min-w-0 text-left">
                  <div className="text-sm sm:text-base font-extrabold text-[#3D322C] truncate">
                    {lang === 'th'
                      ? 'รวมปุ่มทั้งหมด & เมนูเพิ่มเติม'
                      : 'All Menus & Extra Tools'}
                  </div>
                  <div className="text-[11px] text-[#7B695F] truncate">
                    {lang === 'th'
                      ? 'ร้านมินิมาร์ท · สัตว์เลี้ยง 10 สายพันธุ์ · ตารางเวร · แจ้งเตือน · กติกา · แจ้งป่วย'
                      : 'Minimart · 10-Species Tamagotchi · Duties · Alerts · Rules · Illness'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {allToolsAlertCount > 0 && (
                  <span className="rounded-full bg-[#E86F87] text-white px-2 py-0.5 text-[11px] font-extrabold tabular-nums">
                    {allToolsAlertCount}
                  </span>
                )}
                <span className="rounded-xl bg-[#F6EFE8] border border-[#E7DAD0] px-2.5 sm:px-3 py-1 text-xs font-bold text-[#5E4E45] whitespace-nowrap">
                  {lang === 'th' ? 'เปิดดูทั้งหมด ▾' : 'Open All ▾'}
                </span>
              </div>
            </button>
          );
        })()}
      </div>
      </div>

      {/* Holiday Penalty Voting & New Self-Tap Morning Check-In Info for Kids */}
      <HolidayCheckInNoticeCard lang={lang} variant="kid_home" defaultExpanded />

      {/* ---------------- SUB-MODALS ---------------- */}
      {subModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#3D322C]/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full ${
              subModal === 'staff_roster' || subModal === 'kid_duties_modal' || subModal === 'all_tools_modal'
                ? 'max-w-4xl'
                : 'max-w-2xl'
            } max-h-[92dvh] overflow-y-auto rounded-[24px] sm:rounded-[32px] border-4 border-[#FADADD] bg-[#FFFDF9] p-4 sm:p-6 pastel-shadow`}
          >
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
              <h3 className="text-base sm:text-xl font-bold text-[#3D322C] leading-snug">
                {subModal === 'all_tools_modal' && (lang === 'th' ? `🧰 รวมปุ่มทั้งหมด · น้อง${kid.nickname}` : `🧰 All Menus · ${kid.nickname}`)}
                {subModal === 'shift_morning' && (lang === 'th' ? '🚌 1. ไปโรงเรียน (กะเช้า)' : '🚌 1. Morning Shift')}
                {subModal === 'shift_afternoon' && (lang === 'th' ? '🏡 2. กลับบ้าน (กะเย็น)' : '🏡 2. Return Home')}
                {subModal === 'shift_night' && (lang === 'th' ? '✍️ 3. ทำการบ้าน & เข้านอน (กะค่ำ)' : '✍️ 3. Night Shift')}
                {subModal === 'my_space' && (lang === 'th' ? '🩷 พื้นที่ของฉัน' : '🩷 My Personal Space')}
                {subModal === 'sick_report' && (lang === 'th' ? '🤒 เช็คสุขภาพ & แจ้งอาการเจ็บป่วย' : '🤒 Health Check & Report Illness')}
                {subModal === 'star_history' && (lang === 'th' ? '🧸 ประวัติสะสมดาว & แลกขนม' : '🧸 Star & Reward Log')}
                {subModal === 'drive_docs' && (lang === 'th' ? '☁️ ไดรฟ์ผลงานส่วนตัว (Drive)' : '☁️ My Personal Drive')}
                {subModal === 'penalty_status' && (lang === 'th' ? '⚖️ สถานะบทลงโทษ & สิทธิ์' : '⚖️ Penalty & Privilege Status')}
                {subModal === 'rules_schedule' && (lang === 'th' ? '📜 กฎและตารางเวลาประจำกลุ่ม' : '📜 Group Rules & Schedule')}
                {subModal === 'shop_modal' && (lang === 'th' ? '🏪 มินิมาร์ทมูลนิธิ & ร้านค้าดาว' : '🏪 Foundation Minimart & Star Shop')}
                {subModal === 'wardrobe_modal' && (lang === 'th' ? '🎨 ชุดเทศกาล & คลังไอเทม' : '🎨 Festival Outfits & Items')}
                {subModal === 'announcements_modal' && (lang === 'th' ? '📢 ประกาศอัปเดตบ้าน Barnhem' : '📢 House Announcements')}
                {subModal === 'vote_modal' && (lang === 'th' ? '🗳️ โหวตออกเสียง (ความลับไม่ระบุชื่อ)' : '🗳️ Secret-Ballot Voting')}
                {subModal === 'trips_modal' && (lang === 'th' ? '🗺️ กิจกรรมสถานที่เที่ยว & ข้อความหลังไมค์' : '🗺️ Outings & Private Backchannel')}
                {subModal === 'health_card' && (lang === 'th' ? '🩺 บัตรข้อมูลสุขภาพ & ประวัติแพ้อาหาร/ยา' : '🩺 Health & Allergy Card')}
                {subModal === 'supply_wishlist' && (lang === 'th' ? '📦 กล่องขอเบิกของใช้จำเป็น & อุปกรณ์เรียน' : '📦 Supplies & Study Wishlist')}
                {subModal === 'lost_found_modal' && (lang === 'th' ? '🔎 กระดานแจ้งของหาย / เก็บของได้' : '🔎 Lost & Found Board')}
                {subModal === 'kindness_deed_modal' && (lang === 'th' ? '💛 การ์ดขอบคุณเพื่อน & กิจกรรมไถ่ค่าปรับ' : '💛 Kindness Wall & Deed Redemption')}
                {subModal === 'friend_visit_modal' && (lang === 'th' ? '🏠 ไปบ้านเพื่อน & ฝากข้อความทักทาย' : '🏠 Visit a Friend & Hangout')}
                {subModal === 'staff_roster' && (lang === 'th' ? '👩‍🏫🚐 ตารางงานพี่เลี้ยง ไนท์วอช & ตารางขับรถ' : '👩‍🏫🚐 Staff Shift, Night Watch & Driving Roster')}
                {subModal === 'kid_duties_modal' && (lang === 'th' ? '📋 ช่องตารางเวรต่างๆ ของน้อง (เวรวันหยุด 14 โซน · ห้องครัว · ทิ้งขยะ)' : '📋 Kid Duty Schedules (Holiday Cleaning · Kitchen · Trash)')}
                {subModal === 'pet_modal' && (lang === 'th' ? '🐾 สัตว์เลี้ยงทามาก๊อตจิ (10 สายพันธุ์ · ให้อาหารรับดาว)' : '🐾 Tamagotchi Companion (10 Species)')}
                {subModal === 'profile_modal' && (lang === 'th' ? `🩷 พื้นที่ของฉัน · น้อง${kid.nickname}` : `🩷 My Space · ${kid.nickname}`)}
              </h3>
              {!(subModal === 'sick_report' && pendingSickLineText && !sickLineCopied) && (
                <button
                  type="button"
                  onClick={() => setSubModal(null)}
                  className="min-h-[38px] min-w-[38px] sm:min-h-[42px] sm:min-w-[42px] rounded-full bg-[#FADADD] hover:bg-[#F3B7C0] font-bold text-[#3D322C] cursor-pointer shrink-0"
                >
                  ✕
                </button>
              )}
            </div>

            {/* UNIFIED ALL TOOLS / HIDDEN BUTTONS HUB */}
            {subModal === 'all_tools_modal' && (() => {
              const todaySchedule = getStaffScheduleForDate(now);
              const morningCarer =
                todaySchedule.shiftATh !== '—'
                  ? lang === 'th'
                    ? todaySchedule.shiftATh
                    : todaySchedule.shiftAEn
                  : lang === 'th'
                  ? todaySchedule.shiftBTh
                  : todaySchedule.shiftBEn;
              return (
                <div className="space-y-4">
                  {/* Daily Alerts & Quick Chore Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSubModal(null);
                        setStepPopupOpen(true);
                      }}
                      className={`rounded-2xl border-2 px-4 py-3 text-left flex items-center justify-between gap-2 cursor-pointer ${
                        stepReminder.penaltyInstructions.length > 0 || stepReminder.nextStep?.urgent
                          ? 'bg-[#FFE8EC] hover:bg-[#FFD7DF] border-[#F0A4B4] text-[#7D2234]'
                          : stepReminder.allDoneClean
                          ? 'bg-[#E6FAF5] hover:bg-[#D5F5ED] border-[#8DD6C7] text-[#17554B]'
                          : 'bg-[#EEF6FF] hover:bg-[#DFEEFF] border-[#B6D5F2] text-[#1B4A73]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate">
                          🔔 {lang === 'th' ? 'แจ้งเตือนภารกิจวันนี้' : 'Daily Step Alerts'}
                        </div>
                        <div className="text-[11px] font-medium truncate">
                          {lang === 'th' ? stepReminder.badgeTextTh : stepReminder.badgeTextEn}
                        </div>
                      </div>
                      <span className="text-xs font-bold shrink-0">→</span>
                    </button>

                    <div className="rounded-2xl border border-[#BFE6E2] bg-[#EAF8F7] px-4 py-3 flex items-center justify-between gap-2 text-xs text-[#214F4B]">
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">
                          {dailyHouseChore.emoji} {lang === 'th' ? dailyHouseChore.titleTh : dailyHouseChore.titleEn}
                        </div>
                        <div className="text-[10px] text-[#356964] truncate">
                          🔥{' '}
                          {lang === 'th'
                            ? `เช้าติด ${streakCount % 5 === 0 && streakCount > 0 ? 5 : streakCount % 5}/5 (${streakCount})`
                            : `Streak ${streakCount}`}{' '}
                          · {laundry.emoji} {laundry.label}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(kid.daily.houseChoreDone)}
                        onClick={() => {
                          if (kid.daily.houseChoreDone) return;
                          const applied = addStars(
                            5,
                            `ทำเวรประจำบ้าน: ${dailyHouseChore.titleTh} (+5 ⭐)`,
                            (prev) => ({
                              daily: { ...prev.daily, houseChoreDone: true },
                            }),
                            (prev) => !prev.daily.houseChoreDone
                          );
                          if (!applied) return;
                          onShowAlert({
                            icon: '🧹✨',
                            title: lang === 'th' ? 'ทำเวรประจำบ้านเสร็จแล้ว! (+5 ⭐)' : 'House Chore Complete! (+5 ⭐)',
                            message:
                              lang === 'th'
                                ? `รับ +5 ดาวความดี จากภารกิจ "${dailyHouseChore.titleTh}" ขอบคุณที่ช่วยดูแลบ้านนะ!`
                                : `Earned +5 stars for "${dailyHouseChore.titleEn}"!`,
                            tone: 'mint',
                          });
                        }}
                        className={`min-h-[34px] rounded-xl px-3 py-1 text-[11px] font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                          kid.daily.houseChoreDone
                            ? 'bg-white border border-[#96D9CD] text-[#28645B]'
                            : 'bg-[#114A42] text-white'
                        }`}
                      >
                        {kid.daily.houseChoreDone ? '✅ +5⭐' : lang === 'th' ? 'ทำเวร (+5⭐)' : 'Chore (+5⭐)'}
                      </button>
                    </div>
                  </div>

                  {/* Status summary & badges */}
                  <div className="rounded-2xl border border-[#EAE1D8] bg-white px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-[#5E4E45]">
                    {kid.pet ? (() => {
                      const sp = getPetSpeciesInfo(kid.pet.species);
                      const lv = computeLivePetStats(kid.pet, now);
                      const fs = getPetFeedStarStatus(kid.pet, todayKey);
                      return (
                        <span>
                          {sp.emoji}{' '}
                          {lang === 'th'
                            ? `${kid.pet.name} (${sp.nameTh} Lv.${lv.level} · ⭐ อาหารวันนี้ ${fs.usedToday}/3)`
                            : `${kid.pet.name} (${sp.nameEn} Lv.${lv.level} · ⭐ Feed ${fs.usedToday}/3)`}
                        </span>
                      );
                    })() : (
                      <span>🐾 {lang === 'th' ? 'ยังไม่รับเลี้ยงทามาก๊อตจิ (ฟรี 10 สายพันธุ์)' : 'No Tamagotchi yet (10 free)'}</span>
                    )}
                    {speedyRemainingSec !== null && (
                      <span className="text-[#B84A39] tabular-nums">
                        · 🥷 Speedy Ninja {speedyMM}:{speedySS}
                      </span>
                    )}
                    {isSickToday && <span className="text-[#2F685E]">· 🤒 {lang === 'th' ? 'แจ้งป่วยวันนี้' : 'Sick Today'}</span>}
                    {isAwayToday && (
                      <span className="text-[#7C5214]">
                        · 🏡 {lang === 'th' ? `ลาพักถึง ${kid.allowance?.awayUntilDateKey ?? ''}` : 'Away'}
                      </span>
                    )}
                    {hasKitchenDuty && <span className="text-[#2F685E]">· 🍳 {lang === 'th' ? 'มีเวรครัว' : 'Kitchen Duty'}</span>}
                    {isMyTrashWeek && <span className="text-[#9A344B]">· 🗑️ {lang === 'th' ? 'เวรทิ้งขยะสัปดาห์นี้' : 'Trash Week'}</span>}
                  </div>

                  {incomingPendingVisits.length > 0 && (
                    <div className="rounded-2xl border-2 border-[#7CC6B8] bg-[#EFFAF7] px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#1D544C]">
                        💌{' '}
                        {lang === 'th'
                          ? `น้อง${incomingPendingVisits[0].fromKidNickname} ขอมาบ้านหนู! (รอตอบรับ ${incomingPendingVisits.length})`
                          : `${incomingPendingVisits[0].fromKidNickname} sent you a visit invite!`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSubModal('friend_visit_modal')}
                        className="rounded-xl bg-[#114A42] text-white px-3 py-1.5 text-xs font-bold cursor-pointer shrink-0"
                      >
                        🤝 {lang === 'th' ? 'ตอบรับ' : 'Respond'}
                      </button>
                    </div>
                  )}

                  {/* Section 1: Shop, Tamagotchi & Friends */}
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-[#6E5C52]">
                      ✨ {lang === 'th' ? 'ร้านค้า · สัตว์เลี้ยงทามาก๊อตจิ · เพื่อนบ้าน' : 'Shop, Tamagotchi & Friends'}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShopFilter('all');
                          setSubModal('shop_modal');
                        }}
                        className="min-h-[52px] rounded-xl border-2 border-[#F3D86B] bg-[#FFF5BA] hover:bg-[#FCEB8E] px-3 py-2 text-left flex items-center gap-2 text-xs font-extrabold text-[#3D322C] cursor-pointer"
                      >
                        <span className="text-lg">🏪</span>
                        <span className="truncate">{lang === 'th' ? 'มินิมาร์ท & ร้านค้าดาว' : 'Minimart & Shop'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('pet_modal')}
                        className="min-h-[52px] rounded-xl border-2 border-[#F3B7C0] bg-[#FFF0F4] hover:bg-[#FFE3EC] px-3 py-2 text-left flex items-center gap-2 text-xs font-extrabold text-[#7B2E3B] cursor-pointer"
                      >
                        <span className="text-lg">
                          {kid.pet ? getPetSpeciesInfo(kid.pet.species).emoji : '🐾'}
                        </span>
                        <span className="truncate">
                          {kid.pet
                            ? `${kid.pet.name} (10 สายพันธุ์)`
                            : lang === 'th'
                            ? 'ทามาก๊อตจิ (10 สายพันธุ์)'
                            : 'Tamagotchi (10 Breeds)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('friend_visit_modal')}
                        className="min-h-[52px] rounded-xl border border-[#B6E2DA] bg-[#F0FAF8] hover:bg-[#E0F5F1] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#1C554C] cursor-pointer"
                      >
                        <span className="text-lg">🏠</span>
                        <span className="truncate">
                          {lang === 'th' ? 'ไปบ้านเพื่อน' : 'Visit Friend'}
                          {incomingPendingVisits.length > 0 ? ` (${incomingPendingVisits.length})` : ''}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMySpaceForm(kid.mySpace);
                          setLinkedEmailForm(kid.linkedEmail ?? '');
                          setSubModal('profile_modal');
                        }}
                        className="min-h-[52px] rounded-xl border border-[#A7D3EC] bg-[#EEF6FF] hover:bg-[#DFEEFF] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#1E445C] cursor-pointer"
                      >
                        <span className="text-lg">{kid.linkedEmail ? '✅' : '📧'}</span>
                        <span className="truncate">
                          {kid.linkedEmail
                            ? lang === 'th'
                              ? 'พื้นที่ของฉัน / อีเมลซิงค์'
                              : 'My Space / Email'
                            : lang === 'th'
                            ? 'พื้นที่ของฉัน & ผูกอีเมล'
                            : 'My Space & Email'}
                        </span>
                      </button>

                      {activeFestival && (
                        <button
                          type="button"
                          onClick={() => {
                            if (kid.avatar.outfitMode === 'festival') {
                              handleToggleOutfitMode('uniform');
                            } else {
                              handleToggleOutfitMode('festival', activeFestival.defaultOutfitId);
                            }
                          }}
                          className="min-h-[52px] rounded-xl border border-[#F0D568] bg-[#FFF5BA] hover:bg-[#FCEB8E] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#5A4614] cursor-pointer"
                        >
                          <span className="text-lg">{activeFestival.emoji}</span>
                          <span className="truncate">
                            {kid.avatar.outfitMode === 'festival'
                              ? lang === 'th'
                                ? 'สลับเป็นชุดนักเรียน'
                                : 'Switch Uniform'
                              : lang === 'th'
                              ? `ใส่ชุด${activeFestival.nameTh}`
                              : activeFestival.nameEn}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Section 2: Duties, Rules & House Tools */}
                  <div className="space-y-2">
                    <div className="text-xs font-extrabold text-[#6E5C52]">
                      📋 {lang === 'th' ? 'ตารางเวร · กติกา · เมนูบ้านทั้งหมด' : 'Duties, Rules & House Utilities'}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSubModal('kid_duties_modal')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#F2FBF9] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span>🧹</span>
                        <span className="truncate">{lang === 'th' ? 'ตารางเวรต่างๆ' : 'Duty Schedules'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('staff_roster')}
                        className="min-h-[48px] rounded-xl border border-[#BEDBF0] bg-[#F5FAFF] hover:bg-[#EAF4FF] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#1D4D73] cursor-pointer"
                      >
                        <span>📅</span>
                        <span className="truncate">
                          {lang === 'th' ? `ตารางพี่เลี้ยง (${morningCarer})` : `Roster (${morningCarer})`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('penalty_status')}
                        className={`min-h-[48px] rounded-xl border px-3 py-2 text-left flex items-center gap-2 text-xs font-bold cursor-pointer ${
                          isCleanPenalty
                            ? 'border-[#EDE3DA] bg-white hover:bg-[#F4FBF8] text-[#3D322C]'
                            : 'border-[#F2BFC9] bg-[#FFF5F7] text-[#9E3C54]'
                        }`}
                      >
                        <span>⚖️</span>
                        <span className="truncate">{lang === 'th' ? 'สถานะ & กฎวินัย' : 'Discipline Status'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('rules_schedule')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#F7F9FF] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span>📜</span>
                        <span className="truncate">{lang === 'th' ? 'กฎ & ตารางเวลา' : 'Rules & Schedule'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPendingSickLineText(null);
                          setSickLineCopied(false);
                          setSubModal('sick_report');
                        }}
                        className="min-h-[48px] rounded-xl border border-[#F2CFC9] bg-[#FFF9F7] hover:bg-[#FFEEEA] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#703021] cursor-pointer"
                      >
                        <span>🤒</span>
                        <span className="truncate">{lang === 'th' ? 'แจ้งเจ็บป่วย' : 'Report Illness'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setHealthForm(kidHealth);
                          setSubModal('health_card');
                        }}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#FAF5EF] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span>🩺</span>
                        <span className="truncate">{lang === 'th' ? 'บัตรสุขภาพ' : 'Health Card'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('announcements_modal')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#FAF5EF] px-3 py-2 text-left flex items-center justify-between gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>📢</span>
                          <span className="truncate">{lang === 'th' ? 'ประกาศบ้าน' : 'Notices'}</span>
                        </span>
                        <span className="text-[10px] text-[#7B695F] shrink-0">
                          {activeScheduledAnnouncements.length + 1}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('drive_docs')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#F5FAFF] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span>☁️</span>
                        <span className="truncate">{lang === 'th' ? 'ไดรฟ์ผลงาน' : 'My Drive'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('vote_modal')}
                        className={`min-h-[48px] rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 text-xs font-bold text-[#3D322C] cursor-pointer ${
                          unvotedOpenPolls.length > 0
                            ? 'border-[#C9BCE3] bg-[#F8F5FC]'
                            : 'border-[#EDE3DA] bg-white hover:bg-[#FAF5EF]'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>🗳️</span>
                          <span className="truncate">{lang === 'th' ? 'โหวต (ลับ)' : 'Secret Vote'}</span>
                        </span>
                        {unvotedOpenPolls.length > 0 && (
                          <span className="text-[10px] font-extrabold text-[#5B3E8C]">{unvotedOpenPolls.length}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('trips_modal')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#FAF5EF] px-3 py-2 text-left flex items-center justify-between gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>🗺️</span>
                          <span className="truncate">{lang === 'th' ? 'ทริป & หลังไมค์' : 'Outings & DM'}</span>
                        </span>
                        {repliedCount > 0 && (
                          <span className="text-[10px] font-bold text-[#2F685E]">{repliedCount}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('supply_wishlist')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#FAF5EF] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span>📦</span>
                        <span className="truncate">{lang === 'th' ? 'ขอเบิกของใช้' : 'Supplies'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('lost_found_modal')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#FAF5EF] px-3 py-2 text-left flex items-center justify-between gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>🔎</span>
                          <span className="truncate">{lang === 'th' ? 'ของหาย / ได้' : 'Lost & Found'}</span>
                        </span>
                        {openLostCount > 0 && (
                          <span className="text-[10px] font-bold text-[#7B695F]">{openLostCount}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('kindness_deed_modal')}
                        className={`min-h-[48px] rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 text-xs font-bold text-[#3D322C] cursor-pointer ${
                          pendingDeedsCount > 0
                            ? 'border-[#E66C85] bg-[#FFF5F7]'
                            : 'border-[#EDE3DA] bg-white hover:bg-[#FAF5EF]'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>💛</span>
                          <span className="truncate">{lang === 'th' ? 'ขอบคุณ & ความดี' : 'Kindness'}</span>
                        </span>
                        {pendingDeedsCount > 0 && (
                          <span className="text-[10px] font-extrabold text-[#9A344B]">{pendingDeedsCount}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubModal('star_history')}
                        className="min-h-[48px] rounded-xl border border-[#EDE3DA] bg-white hover:bg-[#FAF5EF] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        <span>🧸</span>
                        <span className="truncate">{lang === 'th' ? 'ประวัติดาว & ขนม' : 'Star Log'}</span>
                      </button>

                      {linkedKidSession && onSignOutLinkedKid && (
                        <button
                          type="button"
                          onClick={onSignOutLinkedKid}
                          className="min-h-[48px] rounded-xl border border-[#F3B7C0] bg-[#FFF0F3] hover:bg-[#FFE0E7] px-3 py-2 text-left flex items-center gap-2 text-xs font-bold text-[#8B1D36] cursor-pointer"
                        >
                          <span>🚪</span>
                          <span className="truncate">{lang === 'th' ? 'ออกจากระบบบัญชี Google' : 'Sign Out'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 1. MORNING SHIFT */}
            {subModal === 'shift_morning' && (
              <div className="space-y-4">
                {/* First Heading: Morning Caring Health Check & Sick Report */}
                <button
                  type="button"
                  onClick={() => {
                    setPendingSickLineText(null);
                    setSickLineCopied(false);
                    setSubModal('sick_report');
                  }}
                  className={`w-full min-h-[58px] rounded-2xl border px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSickToday
                      ? 'border-[#A5DFD4] bg-[#EFFAF7] hover:bg-[#E2F6F1]'
                      : 'border-[#F2C9C2] bg-[#FFF8F6] hover:bg-[#FFEEEA]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-10 w-10 rounded-xl border flex items-center justify-center text-xl shrink-0 ${
                        isSickToday
                          ? 'bg-white border-[#BCE8DF]'
                          : 'bg-white border-[#F3D5CF]'
                      }`}
                    >
                      🤒
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold leading-tight truncate ${
                          isSickToday ? 'text-[#19534B]' : 'text-[#702D22]'
                        }`}
                      >
                        {isSickToday
                          ? lang === 'th'
                            ? 'วันนี้แจ้งเจ็บป่วยแล้ว — พี่เลี้ยงกำลังดูแลอยู่นะ'
                            : 'Illness Reported Today — Caregivers Are Caring for You'
                          : lang === 'th'
                          ? '1. เช็คสุขภาพตอนเช้า: วันนี้หนูไม่สบายไหม? / แจ้งเจ็บป่วย'
                          : '1. Morning Check-In: Feeling Unwell? / Report Illness'}
                      </div>
                      <div
                        className={`text-xs mt-0.5 truncate ${
                          isSickToday ? 'text-[#326E65]' : 'text-[#8F5044]'
                        }`}
                      >
                        {isSickToday
                          ? lang === 'th'
                            ? 'พักผ่อนให้สบาย ยกเว้นค่าปรับสายวันนี้แล้ว · แตะแจ้งเพิ่มเติม'
                            : 'Late fines waived today · Tap to update symptoms'
                          : lang === 'th'
                          ? 'มีไข้ ปวดหัว หรือไม่สบาย แตะแจ้งพี่เลี้ยงแต่เช้าได้เลยนะ'
                          : 'Tap to let caregivers know right away this morning'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-extrabold whitespace-nowrap shrink-0 ${
                      isSickToday ? 'text-[#1D544C]' : 'text-[#9E3427]'
                    }`}
                  >
                    {isSickToday
                      ? lang === 'th'
                        ? 'แจ้งเพิ่ม →'
                        : 'Update →'
                      : lang === 'th'
                      ? 'แจ้งป่วย →'
                      : 'Report →'}
                  </span>
                </button>

                {allowMorningPhonePickup && (
                  <button
                    type="button"
                    disabled={Boolean(kid.daily.morningPhonePickupChecked)}
                    onClick={() => {
                      if (kid.daily.morningPhonePickupChecked) return;
                      if (!isMorningPhoneOpen) {
                        onShowAlert({
                          icon: '🔒',
                          title:
                            lang === 'th'
                              ? 'ปุ่ม "มาขอรับมือถือ" ล็อกอยู่นอกเวลา'
                              : '"Morning Phone Pickup" is Locked',
                          message:
                            lang === 'th'
                              ? `ระบบเปิดให้กดรับมือถือเฉพาะช่วงเวลา ${morningPhoneWin.labelTh} เท่านั้นค่ะ (ขณะนี้เวลา ${formatDigitalClock(now)} น.)`
                              : `Only open during ${morningPhoneWin.labelEn} (currently ${formatDigitalClock(now)}).`,
                          tone: 'pink',
                        });
                        return;
                      }
                      if (!kid.penalty.phonePrivilegeActive) {
                        onShowAlert({
                          icon: '📵',
                          title:
                            lang === 'th'
                              ? 'ถูกระงับสิทธิ์ใช้มือถือชั่วคราว'
                              : 'Phone Privilege Suspended',
                          message:
                            lang === 'th'
                              ? 'หากต้องการเปิดสิทธิ์คืน ให้พี่เลี้ยงกด "เคลียร์โทษ" ในหน้าพี่เลี้ยงก่อนนะคะ'
                              : 'Ask staff to clear penalties in Staff View first.',
                          tone: 'pink',
                        });
                        return;
                      }
                      if (kid.penalty.noEveningPhoneTomorrowDate === todayKey) {
                        onShowAlert({
                          icon: '📵',
                          title:
                            lang === 'th'
                              ? 'ติดโทษงดใช้มือถือวันนี้'
                              : 'Phone Suspended Today',
                          message:
                            lang === 'th'
                              ? 'ติดโทษคืนมือถือเกินเวลาเมื่อคืน วันนี้จึงงดรับมือถือ 1 วันค่ะ'
                              : 'Phone use is suspended today due to late return.',
                          tone: 'pink',
                        });
                        return;
                      }
                      if (
                        kid.penalty.phoneConfiscatedUntil1830Date === todayKey &&
                        getMinutesOfDay(now) < 18 * 60 + 30
                      ) {
                        onShowAlert({
                          icon: '⏳📵',
                          title:
                            lang === 'th'
                              ? 'ติดโทษยึดมือถือถึง 18:30 น.'
                              : 'Phone Held Until 18:30',
                          message:
                            lang === 'th'
                              ? 'ไม่สามารถรับมือถือรอบเช้าได้ รอรับหลัง 18:30 น. นะคะ'
                              : 'Phone is held until 18:30 today.',
                          tone: 'pink',
                        });
                        return;
                      }
                      onUpdateKid(
                        kid.id,
                        (prev) => ({
                          ...prev,
                          daily: { ...prev.daily, morningPhonePickupChecked: true },
                          starHistory: [
                            {
                              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                              timestamp: now.toISOString(),
                              reason: `📱 กะเช้า "มาขอรับมือถือ" (${morningPhoneWin.labelTh})`,
                              amount: 0,
                            },
                            ...prev.starHistory,
                          ].slice(0, 60),
                        }),
                        `Morning Phone Pickup (${morningPhoneWin.labelEn})`
                      );
                      onShowAlert({
                        icon: '📱✨',
                        title:
                          lang === 'th'
                            ? 'มาขอรับมือถือเรียบร้อยแล้ว!'
                            : 'Morning Phone Pickup Confirmed!',
                        message:
                          lang === 'th'
                            ? `บันทึกการขอรับมือถือรอบเช้า (${morningPhoneWin.labelTh}) เรียบร้อยแล้วค่ะ`
                            : `Morning phone pickup (${morningPhoneWin.labelEn}) recorded.`,
                        tone: 'mint',
                      });
                    }}
                    className={`w-full min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                      kid.daily.morningPhonePickupChecked
                        ? 'border-[#8FD4C6] bg-[#E8FAF6] text-[#114A42] cursor-default'
                        : isMorningPhoneOpen
                        ? 'border-[#7CC6B8] bg-[#E3F5F3] hover:bg-[#D0EFEA] text-[#114A42] cursor-pointer'
                        : 'border-[#E6DCD2] bg-[#F7F3EE] hover:bg-[#EFE9E1] text-[#7B695F] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 rounded-xl border border-white/80 bg-white flex items-center justify-center text-xl shrink-0">
                        {kid.daily.morningPhonePickupChecked ? '✅' : isMorningPhoneOpen ? '📱' : '🔒'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-extrabold leading-tight truncate">
                          {lang === 'th' ? 'มาขอรับมือถือ' : 'Morning Phone Pickup'}
                        </div>
                        <div className="text-xs opacity-85 mt-0.5 tabular-nums truncate">
                          ⏰{' '}
                          {lang === 'th'
                            ? `เปิดระบบ ${morningPhoneWin.labelTh}`
                            : `Open ${morningPhoneWin.labelEn}`}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-xl px-2.5 py-1 text-xs font-extrabold shrink-0 whitespace-nowrap ${
                        kid.daily.morningPhonePickupChecked
                          ? 'bg-[#114A42] text-white'
                          : isMorningPhoneOpen
                          ? 'bg-[#114A42] text-white'
                          : 'bg-white text-[#7B695F] border border-[#DFD4C8]'
                      }`}
                    >
                      {kid.daily.morningPhonePickupChecked
                        ? lang === 'th'
                          ? 'รับมือถือแล้ว'
                          : 'Collected'
                        : isMorningPhoneOpen
                        ? lang === 'th'
                          ? 'กดรับมือถือ'
                          : 'Pick Up'
                        : lang === 'th'
                        ? 'ล็อกนอกเวลา'
                        : 'Locked'}
                    </span>
                  </button>
                )}

                {kid.group === 1 && (() => {
                  const isHolOrWknd =
                    now.getDay() === 0 ||
                    now.getDay() === 6 ||
                    isPublicHoliday(now, isPublicHolidayToday);
                  return (
                    <>
                      <div className="rounded-2xl bg-[#FFF5BA]/70 p-4 text-sm text-[#53433A] space-y-1">
                        <div>
                          {lang === 'th'
                            ? '• วันไปโรงเรียน (จ–ศ): กินข้าวเช้าก่อน 06:40 น. (+5 ⭐) และขึ้นรถตู้ไม่เกิน 07:01 น. (+10 ⭐) · เพดานสายถึง 08:00 น.'
                            : '• School Days (Mon-Fri): Breakfast before 06:40 (+5 ⭐), School van by 07:01 (+10 ⭐).'}
                        </div>
                        <div className="font-bold text-[#9F1239]">
                          {lang === 'th'
                            ? '• วันเสาร์: เปิด 08:15–08:35 น. (อนุโลมไม่เกิน 1 นาที / ถึง 08:36 น.) · อาทิตย์ & วันนักขัตฤกษ์: ≤ 08:15 น. (อนุโลมถึง 08:25 น.) · กดชื่อตัวเองได้เลย ห้ามกดแทนเพื่อน'
                            : '• Saturday: Opens 08:15–08:35 (grace to 08:36) · Sun & Public Holidays: ≤ 08:15 (grace to 08:25) · Direct self-tap without PIN.'}
                        </div>
                      </div>
                      {!isHolOrWknd && (
                        <button
                          type="button"
                          onClick={handleGroup1Breakfast}
                          className="w-full min-h-[54px] rounded-2xl bg-[#D4F0F0] hover:bg-[#BCE7E7] font-bold text-[#3D322C] px-5 py-3 text-left flex items-center justify-between cursor-pointer"
                        >
                          <span>🍚 {lang === 'th' ? 'กินข้าวเช้าเรียบร้อยแล้ว (เปลี่ยนชุดนักเรียน)' : 'Finished Breakfast (Put on Uniform)'}</span>
                          <span>{kid.daily.breakfastChecked ? '✅' : '+5 ⭐'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleGroup1Van}
                        className="w-full min-h-[54px] rounded-2xl bg-[#DCEEF8] hover:bg-[#C6E2F3] font-bold text-[#3D322C] px-5 py-3 text-left flex items-center justify-between cursor-pointer"
                      >
                        <span>
                          {isHolOrWknd ? '☀️' : '🚐'}{' '}
                          {isHolOrWknd
                            ? lang === 'th'
                              ? 'เช็คอินกะเช้าวันหยุด (เสาร์/อาทิตย์/วันหยุด)'
                              : 'Weekend / Holiday Morning Check-In'
                            : lang === 'th'
                            ? 'ขึ้นรถตู้ไปโรงเรียน'
                            : 'Boarded School Van'}
                        </span>
                        <span>{kid.daily.vanOrMorningChecked ? '✅' : '+10 ⭐'}</span>
                      </button>
                    </>
                  );
                })()}

                {kid.group === 2 && (() => {
                  const isHolNow = isPublicHoliday(now, isPublicHolidayToday);
                  const isWkndOrHol = now.getDay() === 0 || now.getDay() === 6 || isHolNow;
                  const wkndPreset = getEffectiveWeekendLatePenaltyPreset(settings);
                  const wkndPenaltyDescTh =
                    wkndPreset === 'weekend_late_no_freeday_no_711'
                      ? 'งดฟรีเดย์ 1 วัน (เด็กเล็กงดสั่งเซเว่น)'
                      : 'งดใช้โทรศัพท์ 18:30–22:45 น. (เด็กเล็กงดสั่งเซเว่น)';
                  const wkndPenaltyDescEn =
                    wkndPreset === 'weekend_late_no_freeday_no_711'
                      ? 'no Free Day 1 day (younger kids no 7-Eleven)'
                      : 'no phone 18:30–22:45 (younger kids no 7-Eleven)';
                  return (
                  <>
                    <div className="rounded-2xl bg-[#FFF5BA]/70 p-4 text-sm text-[#53433A] space-y-1">
                      <div>
                        {lang === 'th'
                          ? '• วันไปโรงเรียน (จ-ศ ไม่ใช่วันหยุด): ไม่เกิน 07:21 น. (+10 ⭐) | 07:22–08:00 น. ปรับนาทีละ 5 บ. (สูงสุด 50 บ. · เพดานสายถึง 08:00 น.)'
                          : '• School Days (Mon-Fri): By 07:21 (+10 ⭐). 07:22–08:00: 5 THB/min fine (max 50 THB, late ceiling 08:00).'}
                      </div>
                      <div>
                        {lang === 'th'
                          ? `• วันเสาร์: เปิด 08:15–08:35 น. (อนุโลมไม่เกิน 1 นาที / ถึง 08:36 น.) (+10 ⭐ · กดชื่อตัวเองได้เลย) | เกิน 08:36 น. ลงโทษตามที่ตัวเองโหวต`
                          : `• Saturday: Opens 08:15–08:35 (1-min grace to 08:36, +10 ⭐ · direct tap) | Past 08:36: per your vote`}
                      </div>
                      <div>
                        {lang === 'th'
                          ? `• วันอาทิตย์ & วันนักขัตฤกษ์: ไม่เกิน 08:15 น. (อนุโลมได้ไม่เกิน 10 นาที / ถึง 08:25 น. พี่เกดเดินปลุกและไขกุญแจ) · กดชื่อตัวเองได้เลย ห้ามกดแทนเพื่อน | เกิน 08:25 น.: ${wkndPenaltyDescTh}`
                          : `• Sunday & Public Holidays: By 08:15 (10-min grace to 08:25 as P'Ked wakes & unlocks) · Direct tap | Past 08:25: ${wkndPenaltyDescEn}.`}
                      </div>
                    </div>

                    {!isWkndOrHol && (
                      <button
                        type="button"
                        disabled={Boolean(kid.daily.morningDressedConfirmed)}
                        onClick={() => {
                          if (kid.daily.morningDressedConfirmed) return;
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              avatar: {
                                ...prev.avatar,
                                outfitMode: 'uniform',
                              },
                              daily: { ...prev.daily, morningDressedConfirmed: true },
                            }),
                            'Group 2 Ready & Phone Pickup Confirmed'
                          );
                          onShowAlert({
                            icon: '📱✨',
                            title:
                              lang === 'th'
                                ? 'อาบน้ำแต่งตัว & ขอรับมือถือเรียบร้อย!'
                                : 'Ready & Phone Pickup Confirmed!',
                            message:
                              lang === 'th'
                                ? 'เปลี่ยนตัวละครเป็นชุดนักเรียนแล้ว (ระบบความเชื่อใจ) เมื่อพร้อมออกเดินทางให้กดปุ่ม "เช็คชื่อไปโรงเรียน" ด้านล่างได้เลยค่ะ'
                                : 'Uniform equipped (Trust system). Tap "School Check-In" below when leaving for school.',
                            tone: 'mint',
                          });
                        }}
                        className={`w-full min-h-[56px] rounded-2xl font-bold px-5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                          kid.daily.morningDressedConfirmed
                            ? 'bg-[#E3F5F3] text-[#28645B] border border-[#96D9CD] cursor-default'
                            : 'bg-[#D4F0F0] hover:bg-[#BCE7E7] text-[#3D322C] cursor-pointer'
                        }`}
                      >
                        <div>
                          <div>
                            📱{' '}
                            {lang === 'th'
                              ? 'อาบน้ำ แต่งตัวชุดนักเรียน & ขอรับมือถือ'
                              : 'Showered, Dressed in Uniform & Phone Pickup'}
                          </div>
                          <div className="text-xs font-medium text-[#2E524E] mt-0.5">
                            {lang === 'th'
                              ? 'ระบบความเชื่อใจ · ทานข้าวเช้าเรียบร้อยแล้ว (กดได้ครั้งเดียว)'
                              : 'Trust system · Breakfast done (One-time tap)'}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs sm:text-sm font-extrabold">
                          {kid.daily.morningDressedConfirmed
                            ? lang === 'th'
                              ? 'บันทึกแล้ว'
                              : 'Confirmed'
                            : lang === 'th'
                            ? 'ขอรับมือถือ'
                            : 'Pick Up'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={Boolean(kid.daily.vanOrMorningChecked)}
                      onClick={handleGroup2Morning}
                      className={`w-full min-h-[56px] rounded-2xl font-bold px-5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                        kid.daily.vanOrMorningChecked
                          ? 'bg-[#E9F3FA] text-[#214B6E] border border-[#B5D6EC] cursor-default'
                          : 'bg-[#DCEEF8] hover:bg-[#C6E2F3] text-[#3D322C] cursor-pointer'
                      }`}
                    >
                      <div>
                        <div className="text-sm sm:text-base font-bold">
                          {isWkndOrHol ? '☀️' : '🚌'}{' '}
                          {isWkndOrHol
                            ? lang === 'th'
                              ? 'เช็คชื่อกะเช้าวันหยุด (เสาร์/อาทิตย์/วันหยุด)'
                              : 'Weekend / Holiday Morning Check-In'
                            : lang === 'th'
                            ? 'เช็คชื่อไปโรงเรียน'
                            : 'School Check-In'}
                        </div>
                        {!isWkndOrHol && (
                          <div className="text-xs font-medium text-[#2B5478] mt-0.5">
                            {lang === 'th'
                              ? 'ไม่เกิน 07:21 น. (กดได้ครั้งเดียว)'
                              : 'By 07:21 AM (One-time tap)'}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs sm:text-sm font-extrabold">
                        {kid.daily.vanOrMorningChecked
                          ? lang === 'th'
                            ? 'เช็คชื่อแล้ว'
                            : 'Checked In'
                          : now.getDay() === 0 && !isHolNow
                          ? '+15 ⭐'
                          : '+10 ⭐'}
                      </span>
                    </button>
                  </>
                  );
                })()}

                {kid.group === 3 && (
                  <>
                    <div className="rounded-2xl bg-[#FFF5BA]/70 p-4 text-sm text-[#53433A] space-y-1">
                      <div>
                        {lang === 'th'
                          ? '• วันไปเรียน/ฝึกงาน: เช็คอินตามเวลาจริง รับ +10 ⭐ (ไม่มีหักสายตอนเช้า)'
                          : '• Study/Internship day: real-time check-in +10 ⭐ (no morning deduction).'}
                      </div>
                      <div className="font-bold text-[#881337]">
                        {lang === 'th'
                          ? '• วันเสาร์: เปิด 08:15–08:35 น. (อนุโลมไม่เกิน 1 นาที / ถึง 08:36 น.) · อาทิตย์ & วันนักขัตฤกษ์: ≤ 08:15 น. (อนุโลมถึง 08:25 น.) · กดชื่อตัวเองได้เลย ห้ามกดแทนเพื่อน'
                          : '• Saturday: Opens 08:15–08:35 (grace to 08:36) · Sun & Public Holidays: ≤ 08:15 (grace to 08:25) · Direct self-tap without PIN.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGroup3Morning}
                      className="w-full min-h-[56px] rounded-2xl bg-[#DCEEF8] hover:bg-[#C6E2F3] font-bold text-[#3D322C] px-5 py-3 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="text-sm sm:text-base font-bold">
                          🎓 {lang === 'th' ? 'ไปโรงเรียน / ไปฝึกงาน (กะเช้า)' : 'Go to School / Internship (Morning)'}
                        </div>
                        <div className="text-xs font-semibold text-[#2B5478] mt-0.5">
                          🚌{' '}
                          {lang === 'th'
                            ? 'เช็คอินตามเวลาจริง · เปลี่ยนเป็นชุดเรียบร้อยพร้อมเดินทาง'
                            : 'Real-time check-in · Switch to school/internship outfit'}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold">
                        {kid.daily.vanOrMorningChecked ? '✅' : '+10 ⭐'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* 2. AFTERNOON SHIFT */}
            {subModal === 'shift_afternoon' && (
              <div className="space-y-4">
                {now.getDay() === 5 && <FridayBalloonBanner lang={lang} variant="return_home" />}
                {/* First Heading: Return-Home Caring Health Check & Sick Report */}
                <button
                  type="button"
                  onClick={() => {
                    setPendingSickLineText(null);
                    setSickLineCopied(false);
                    setSubModal('sick_report');
                  }}
                  className={`w-full min-h-[58px] rounded-2xl border px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSickToday
                      ? 'border-[#A5DFD4] bg-[#EFFAF7] hover:bg-[#E2F6F1]'
                      : 'border-[#F2C9C2] bg-[#FFF8F6] hover:bg-[#FFEEEA]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-10 w-10 rounded-xl border flex items-center justify-center text-xl shrink-0 ${
                        isSickToday
                          ? 'bg-white border-[#BCE8DF]'
                          : 'bg-white border-[#F3D5CF]'
                      }`}
                    >
                      🤒
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold leading-tight truncate ${
                          isSickToday ? 'text-[#19534B]' : 'text-[#702D22]'
                        }`}
                      >
                        {isSickToday
                          ? lang === 'th'
                            ? 'วันนี้แจ้งเจ็บป่วยไว้แล้ว — พักผ่อนให้หายไวๆ นะ'
                            : 'Illness Reported Today — Rest Well!'
                          : lang === 'th'
                          ? '1. เช็คสุขภาพหลังกลับบ้าน: รู้สึกไม่สบายหรือเจ็บป่วยไหม?'
                          : '1. After-School Check-In: Feeling Sick or Hurt?'}
                      </div>
                      <div
                        className={`text-xs mt-0.5 truncate ${
                          isSickToday ? 'text-[#326E65]' : 'text-[#8F5044]'
                        }`}
                      >
                        {isSickToday
                          ? lang === 'th'
                            ? 'พี่เลี้ยงรับทราบแล้ว · แตะหากมีอาการเพิ่มเติมหลังกลับบ้าน'
                            : 'Caregivers notified · Tap to add after-school details'
                          : lang === 'th'
                          ? 'กลับมาจากโรงเรียนแล้ว หากมีอาการป่วยหรือขอยา แตะแจ้งได้เลยนะ'
                          : 'Back from school — tap here if you feel sick or need medicine'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-extrabold whitespace-nowrap shrink-0 ${
                      isSickToday ? 'text-[#1D544C]' : 'text-[#9E3427]'
                    }`}
                  >
                    {isSickToday
                      ? lang === 'th'
                        ? 'แจ้งเพิ่ม →'
                        : 'Update →'
                      : lang === 'th'
                      ? 'แจ้งป่วย →'
                      : 'Report →'}
                  </span>
                </button>
                <div className="rounded-2xl bg-[#D4F0F0]/70 p-4 text-sm text-[#3D322C] space-y-1">
                  <div className="font-bold">
                    {laundry.emoji} {laundry.label}
                  </div>
                  <p>
                    {kid.group === 2
                      ? lang === 'th'
                        ? 'กด "ถ่ายรูปเช็คอินกลับบ้าน" ปุ่มเดียวเพื่อบันทึกรูป เปลี่ยนเป็นชุดอยู่บ้าน และรับ +5 ⭐ (วันเสาร์-อาทิตย์เก็บมือถือไม่เกิน 14:00 น. ห้ามนอนกลางวัน)'
                        : 'Use the single Return-Home Photo Check-In below to switch to lounge wear and earn +5 ⭐.'
                      : lang === 'th'
                      ? 'เมื่อกดเช็คอินกลับบ้าน ตัวละครจะถอดชุดนักเรียนเหลือเสื้อซับกับกางเกงขาสั้นทันที'
                      : 'Checking in home automatically changes your character back into home shorts & undershirt.'}
                  </p>
                </div>

                {speedyRemainingSec !== null && (
                  <div className="rounded-2xl bg-[#FFF5BA] p-4 text-center">
                    <div className="text-xs font-semibold text-[#6E5C52]">Speedy Ninja Timer</div>
                    <div className="text-4xl font-bold text-[#B84A39] tabular-nums">
                      {speedyMM}:{speedySS}
                    </div>
                  </div>
                )}

                {/* Group 1 & 3 Keep Explicit Check-In Button; Group 2 Uses Single Photo Check-In Flow */}
                {kid.group !== 2 && (
                  <button
                    type="button"
                    onClick={handleReturnHome}
                    className="w-full min-h-[56px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white font-bold px-5 py-3 cursor-pointer"
                  >
                    🏡{' '}
                    {kid.group === 1
                      ? lang === 'th'
                        ? 'กลับบ้านแล้ว! เริ่มจับเวลา Speedy Ninja 20 นาที'
                        : 'Home! Start 20-Min Speedy Ninja'
                      : lang === 'th'
                      ? 'กลับจากฝึกงาน & เก็บมือถือเข้าตู้ (+20 ⭐)'
                      : 'Returned & Stored Phone (+20 ⭐)'}
                  </button>
                )}

                {/* Return Home Camera Capture & Upload (Folder hidden from kids) */}
                <div className="rounded-[24px] border-2 border-[#DCEEF8] bg-[#F5FAFE] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-sm text-[#3D322C]">
                      📸 {lang === 'th' ? 'ถ่ายรูปเช็คอินกลับบ้าน' : 'Return Home Photo Check-in'}
                    </div>
                    {kid.group === 2 && kid.daily.returnedHomeChecked && (
                      <span className="rounded-xl bg-[#E3F5F3] border border-[#96D9CD] px-2.5 py-1 text-[11px] font-bold text-[#28645B]">
                        {lang === 'th' ? 'เช็คอินวันนี้แล้ว (+5 ⭐)' : 'Checked In Today (+5 ⭐)'}
                      </span>
                    )}
                  </div>

                  {returnCamError && (
                    <div className="rounded-xl bg-[#FFF5BA] border border-[#F4DB73] p-2.5 text-xs text-[#53433A]">
                      {returnCamError}
                    </div>
                  )}

                  {returnCamActive && (
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-2xl border-2 border-[#B5D6EC] bg-black/10 aspect-video">
                        <video ref={returnCamVideoRef} playsInline muted className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={captureReturnPhoto}
                          className="flex-1 min-h-[44px] rounded-xl bg-[#3D322C] text-white text-sm font-bold cursor-pointer"
                        >
                          📸 {lang === 'th' ? 'แชะ! ถ่ายรูปเลย' : 'Capture Photo'}
                        </button>
                        <button
                          type="button"
                          onClick={stopReturnCamera}
                          className="rounded-xl bg-[#FADADD] text-[#3D322C] px-4 text-xs font-bold cursor-pointer"
                        >
                          {lang === 'th' ? 'ปิดกล้อง' : 'Stop'}
                        </button>
                      </div>
                    </div>
                  )}

                  {capturedPhotoDataUrl && (
                    <div className="space-y-2 rounded-2xl bg-white border border-[#D4F0F0] p-3">
                      <img
                        src={capturedPhotoDataUrl}
                        alt="Return Home Capture"
                        className="w-full max-h-60 object-contain rounded-xl bg-[#FFFDF9]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleSubmitReturnPhotoToDrive}
                          className="flex-1 min-h-[44px] rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white text-xs sm:text-sm font-bold px-4 cursor-pointer"
                        >
                          📸{' '}
                          {kid.group === 2 && !kid.daily.returnedHomeChecked
                            ? lang === 'th'
                              ? 'ยืนยันถ่ายรูปเช็คอินกลับบ้าน (+5 ⭐)'
                              : 'Confirm Return Photo Check-In (+5 ⭐)'
                            : lang === 'th'
                            ? 'บันทึกรูปเช็คอินกลับบ้าน'
                            : 'Save Return Check-In Photo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCapturedPhotoDataUrl(null)}
                          className="min-h-[44px] rounded-xl bg-[#FADADD] text-[#3D322C] text-xs font-bold px-3 cursor-pointer"
                        >
                          {lang === 'th' ? 'ถ่ายใหม่' : 'Retake'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!returnCamActive && !capturedPhotoDataUrl && (
                    kid.group === 2 ? (
                      <div className="space-y-2">
                        <label className="w-full min-h-[54px] flex items-center justify-center gap-2 rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white text-sm font-bold px-5 py-3 cursor-pointer text-center transition-colors">
                          <span>📸</span>
                          <span>
                            {kid.daily.returnedHomeChecked
                              ? lang === 'th'
                                ? 'ถ่ายรูปเช็คอินกลับบ้านเพิ่มเติม'
                                : 'Take Another Return-Home Photo'
                              : lang === 'th'
                              ? 'ถ่ายรูปเช็คอินกลับบ้าน (+5 ⭐)'
                              : 'Take Return-Home Check-In Photo (+5 ⭐)'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleReturnPhotoFileUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={startReturnCamera}
                          className="w-full text-center text-[11px] font-semibold text-[#2D4F6E] hover:underline cursor-pointer py-1"
                        >
                          📷 {lang === 'th' ? 'หรือเปิดกล้องสดผ่านเว็บเบราว์เซอร์' : 'Or open live browser webcam'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={startReturnCamera}
                          className="flex-1 min-h-[44px] rounded-xl bg-[#DCEEF8] hover:bg-[#C6E2F3] text-[#3D322C] text-xs sm:text-sm font-bold px-4 cursor-pointer"
                        >
                          📷 {lang === 'th' ? 'เปิดกล้องถ่ายรูปเช็คอิน' : 'Open Camera'}
                        </button>
                        <label className="flex-1 min-h-[44px] flex items-center justify-center rounded-xl bg-white border-2 border-[#EBD8C3] hover:bg-[#FFF5BA]/40 text-[#3D322C] text-xs sm:text-sm font-bold px-4 cursor-pointer text-center">
                          🖼️ {lang === 'th' ? 'ถ่าย / เลือกรูปจากเครื่อง' : 'Upload / Device Camera'}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleReturnPhotoFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )
                  )}

                  {todayReturnPhotos.length > 0 && (
                    <div className="pt-2 border-t border-[#DCEEF8] space-y-2">
                      <div className="text-xs font-bold text-[#2F685E]">
                        ✅ {lang === 'th' ? `รูปที่บันทึกแล้ววันนี้ (${todayReturnPhotos.length} รูป)` : `Saved Today (${todayReturnPhotos.length})`}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {todayReturnPhotos.map((photo) => (
                          <div key={photo.id} className="rounded-xl border border-[#C8E4E0] bg-white p-1.5 flex flex-col items-center gap-1">
                            <img
                              src={photo.imageBase64}
                              alt={photo.kidNickname}
                              className="h-20 w-28 object-cover rounded-lg"
                            />
                            <div className="flex items-center gap-2 text-[10px] text-[#6E5C52]">
                              <span>{new Date(photo.capturedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                              <a
                                href={photo.imageBase64}
                                download={`barnhem_${photo.kidId}_${photo.dateKey}.jpg`}
                                className="font-bold text-[#2D4F6E] underline"
                              >
                                {lang === 'th' ? 'โหลด' : 'Save'}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. NIGHT SHIFT */}
            {subModal === 'shift_night' && (() => {
              const minsNowNight = getMinutesOfDay(now);
              const isHwPermWindowOpen =
                hwPermWin.startMins <= hwPermWin.endMins
                  ? minsNowNight >= hwPermWin.startMins && minsNowNight <= hwPermWin.endMins
                  : minsNowNight >= hwPermWin.startMins || minsNowNight <= hwPermWin.endMins;
              const isPastCurfew = minsNowNight > hwCurfewMins;

              const homeworkPermissionSection = (
                <div className="rounded-2xl border border-[#BFE6DE] bg-[#F2FCF9] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-[#114A42]">
                      📝 {lang === 'th' ? `ขออนุญาตทำการบ้าน (${hwPermWin.labelTh})` : `Homework Permission (${hwPermWin.labelEn})`}
                    </div>
                    <span className="text-[11px] font-bold text-[#2D6A60] tabular-nums">
                      {lang === 'th' ? `เวลาตอนนี้ ${formatDigitalClock(now)} น.` : `Now ${formatDigitalClock(now)}`}
                    </span>
                  </div>
                  <p className="text-xs text-[#2E5D55] leading-relaxed">
                    {lang === 'th'
                      ? `ปุ่มนี้แสดงเฉพาะเวลา ${hwPermWin.labelTh} หากขออนุญาตแล้วใช้เพิ่มได้ถึงเวลา ${hwCurfewTh} · ถ้าเกิน ${hwCurfewTh} ยังไม่นำมือถือมาเก็บ ถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วัน`
                      : `Visible ${hwPermWin.labelEn} only. Extends until ${hwCurfewEn}. Keeping phone past ${hwCurfewEn} counts as consenting to forfeit 1 Free Day phone privilege.`}
                  </p>

                  {isHwPermWindowOpen ? (
                    <button
                      type="button"
                      onClick={() => setHwPermPopupOpen(true)}
                      className="w-full min-h-[52px] rounded-2xl border-2 border-[#6BC2B2] bg-[#DCF7F2] hover:bg-[#C6EFE8] px-4 py-3 font-extrabold text-[#114A42] flex items-center justify-between gap-3 shadow-sm cursor-pointer active:scale-[0.99] transition-all"
                    >
                      <span className="flex items-center gap-2 text-sm sm:text-base">
                        <span>📝</span>
                        <span>{lang === 'th' ? 'ขออนุญาตทำการบ้าน' : 'Request Homework Permission'}</span>
                      </span>
                      <span className="rounded-xl bg-white border border-[#9CD9CD] px-2.5 py-1 text-xs font-bold text-[#114A42]">
                        {kid.daily.homeworkRegisteredSubject
                          ? lang === 'th'
                            ? 'เลือกใหม่ได้'
                            : 'Change'
                          : lang === 'th'
                          ? 'กดเลือก 3 ปุ่ม'
                          : 'Choose'}
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#A7D9CF] bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-[#4B7069]">
                      ⏰{' '}
                      {lang === 'th'
                        ? `ขณะนี้อยู่นอกเวลา ${hwPermWin.labelTh} ปุ่ม "ขออนุญาตทำการบ้าน" จะแสดงอัตโนมัติในช่วง ${hwPermWin.labelTh}`
                        : `Outside ${hwPermWin.labelEn} window. The button appears automatically during ${hwPermWin.labelEn}.`}
                    </div>
                  )}

                  {kid.daily.homeworkRegisteredSubject && (
                    <div className="rounded-xl border border-[#8FD4C6] bg-white px-3.5 py-2.5 text-xs font-bold text-[#145349] space-y-0.5">
                      <div>
                        ✅{' '}
                        {lang === 'th'
                          ? `ขออนุญาตวันนี้แล้ว: ${kid.daily.homeworkRegisteredSubject} (ใช้เพิ่มถึง ${hwCurfewTh})`
                          : `Approved today: ${kid.daily.homeworkRegisteredSubject} (Until ${hwCurfewEn})`}
                      </div>
                      <div className="text-[11px] font-medium text-[#3D6A62]">
                        {lang === 'th'
                          ? `กรุณานำมือถือมาเก็บไม่เกิน ${hwCurfewTh} (หากเกินเวลานี้ ถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วัน)`
                          : `Return phone by ${hwCurfewEn} (keeping past ${hwCurfewEn} forfeits 1 Free Day phone privilege).`}
                      </div>
                    </div>
                  )}

                  {returnScheduleEval.isPastDeadline && !kid.daily.phoneReturnedChecked && allowReturnPhone && (
                    <div className="rounded-2xl border-2 border-[#E11D48] bg-[#FFE4EA] px-4 py-3 text-xs sm:text-sm font-extrabold text-[#881337] space-y-1">
                      <div className="text-sm sm:text-base">
                        🚨{' '}
                        {lang === 'th'
                          ? `เลยกำหนดคืนมือถือ (${returnScheduleEval.deadlineTh}) แล้ว!`
                          : `Past Phone Return Deadline (${returnScheduleEval.deadlineEn})!`}
                      </div>
                      <div>
                        ⚖️{' '}
                        {lang === 'th'
                          ? `หากกดคืนตอนนี้จะถูกลงโทษทันที: ${getPenaltySummaryText(
                              returnScheduleEval.penaltyPreset,
                              returnScheduleEval.penaltyNote,
                              lang
                            )}`
                          : `Returning now applies penalty: ${getPenaltySummaryText(
                              returnScheduleEval.penaltyPreset,
                              returnScheduleEval.penaltyNote,
                              lang
                            )}`}
                      </div>
                    </div>
                  )}
                </div>
              );

              return (
                <div className="space-y-4">
                  {now.getDay() === 5 ? (
                    <div className="space-y-3">
                      <FridayBalloonBanner lang={lang} variant="menu" />

                      <div className="rounded-2xl border-2 border-[#BFE6DE] bg-[#F2FCF9] p-4 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-extrabold text-[#114A42]">
                            📱{' '}
                            {lang === 'th'
                              ? 'มารับโทรศัพท์มือถือ (วันศุกร์ Free Day · 18:15–22:45 น.)'
                              : 'Pick Up Mobile Phone (Friday Free Day · 18:15–22:45)'}
                          </div>
                          <span className="text-xs font-bold text-[#2D6A60] tabular-nums">
                            {formatDigitalClock(now)} น.
                          </span>
                        </div>
                        <p className="text-xs text-[#2E5D55] leading-relaxed">
                          {lang === 'th'
                            ? 'คืนวันศุกร์เป็นวันฟรีเดย์ น้องไม่ต้องเก็บมือถือคืนเข้าตู้ค่ะ! เช้าวันเสาร์ระบบเปิด 08:15–08:35 น. (อนุโลมได้ไม่เกิน 1 นาที / ถึง 08:36 น. · กดชื่อตัวเองได้เลย ห้ามกดแทนเพื่อน · เกิน 08:36 น. ลงโทษตามที่ตัวเองโหวต)'
                            : 'Friday night is Free Day — you keep your phone overnight! Saturday wake-up check-in opens 08:15–08:35 (grace to 08:36, direct self-tap; past 08:36 per your vote).'}
                        </p>
                        <p className="text-xs font-extrabold text-[#8A3B12] leading-snug">
                          {lang === 'th'
                            ? '⏰ ทุกคนที่มีโทรศัพท์จะต้องตั้งปลุกก่อนเวลาเผื่อเดินมาเช็คอินด้วยนะเด็กๆ'
                            : '⏰ Everyone with a phone must set an alarm early enough to walk over and check in, kids!'}
                        </p>

                        {!kidHasPhone ? (
                          <div className="rounded-xl border border-[#DCE5EA] bg-white/80 px-3 py-2 text-xs font-semibold text-[#5A6C7A]">
                            📵{' '}
                            {lang === 'th'
                              ? `น้อง${kid.nickname} ถูกตั้งค่าว่า "ไม่มีมือถือ"`
                              : `${kid.nickname} is marked as having no mobile phone`}
                          </div>
                        ) : kid.daily.eveningPhoneUnlocked ? (
                          <div className="rounded-xl border border-[#8FD4C6] bg-white px-3.5 py-2.5 text-xs font-extrabold text-[#114A42]">
                            ✅{' '}
                            {lang === 'th'
                              ? 'มารับโทรศัพท์มือถือวันศุกร์ Free Day เรียบร้อยแล้ว! คืนนี้ไม่ต้องเก็บมือถือค่ะ'
                              : 'Picked up phone for Friday Free Day! Keep your phone tonight.'}
                          </div>
                        ) : isHomeActionOpenAt('evening_uniform_phone', now, settings) ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = evaluateOneTapHomeAction(
                                'evening_uniform_phone',
                                kid,
                                now,
                                lang,
                                settings,
                                isSickToday
                              );
                              if (res.updatedKid) {
                                onUpdateKid(kid.id, () => res.updatedKid!, 'Friday Free Day Phone Pickup');
                              }
                              onShowAlert({
                                icon: res.emoji,
                                title: res.bannerTitle,
                                message: res.bannerSubtitle,
                                tone: res.success ? 'mint' : 'pink',
                              });
                            }}
                            className="w-full min-h-[54px] rounded-2xl bg-[#114A42] hover:bg-[#0B3A32] text-white font-extrabold px-4 py-3 cursor-pointer flex items-center justify-between gap-2 shadow-sm"
                          >
                            <span>
                              📱{' '}
                              {lang === 'th'
                                ? 'มารับโทรศัพท์มือถือ (18:15–22:45 น.)'
                                : 'Pick Up Mobile Phone (18:15–22:45)'}
                            </span>
                            <span className="text-xs font-bold opacity-90">+10 ⭐</span>
                          </button>
                        ) : (
                          <div className="rounded-xl border border-dashed border-[#A7D9CF] bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-[#4B7069]">
                            ⏰{' '}
                            {lang === 'th'
                              ? 'ปุ่มมารับโทรศัพท์มือถือวันศุกร์ Free Day เปิดให้กดเฉพาะเวลา 18:15–22:45 น. ค่ะ'
                              : 'Friday Free Day phone pickup opens during 18:15–22:45.'}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                  {!kidHasPhone && (
                    <div className="rounded-2xl border-2 border-[#D4E3EE] bg-[#F1F7FB] p-3.5 text-xs font-bold text-[#254B6E]">
                      📵{' '}
                      {lang === 'th'
                        ? `น้อง${kid.nickname} ถูกตั้งค่าว่า "ไม่มีมือถือ" (ระบบซ่อนปุ่มรับมือถือ / ขออนุญาตทำการบ้าน / คืนมือถือให้อัตโนมัติ)`
                        : `${kid.nickname} is marked as having no mobile phone (phone-related buttons are hidden automatically).`}
                    </div>
                  )}

                  {kid.group === 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handleGroup1ExtraStudy}
                        className="w-full min-h-[50px] rounded-2xl bg-[#DCEEF8] hover:bg-[#C6E2F3] px-4 py-3 font-bold text-[#3D322C] flex justify-between items-center cursor-pointer"
                      >
                        <span>📖 {lang === 'th' ? 'เข้าเรียนเสริม (ไม่เกิน 16:50 น.)' : 'Extra Study (by 16:50)'}</span>
                        <span>{kid.daily.extraStudyChecked ? '✅' : '+10 ⭐'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGroup1Chores}
                        className="w-full min-h-[50px] rounded-2xl bg-[#FFF5BA] hover:bg-[#FCEB8E] px-4 py-3 font-bold text-[#3D322C] flex justify-between items-center cursor-pointer"
                      >
                        <span>🧺 {lang === 'th' ? 'งานบ้าน & ตากชุดนักเรียน (ก่อน 18:15 น.)' : 'Chores & Hang Uniform (< 18:15)'}</span>
                        <span>{kid.daily.choresChecked ? '✅' : '+10 / +3 ⭐'}</span>
                      </button>

                      <div className="rounded-2xl bg-[#EAE4F2] p-4 space-y-3">
                        <div className="font-bold text-[#3D322C]">
                          📺 {lang === 'th' ? 'ด่านบอส 20:00 น. (ปลดล็อกสิทธิ์ดูการ์ตูน)' : '20:00 Boss Stage (Cartoon Unlock)'}
                        </div>
                        <div className="text-sm text-[#5E546E] font-semibold">
                          {getBossStageLanguageLesson(now, lang)}
                        </div>
                        <div className="text-xs text-[#6E5C52]">
                          {lang === 'th'
                            ? '⏰ แจ้งเตือน: หยุดดูการ์ตูนและดื่มน้ำ 20:40 น. | เข้านอน 21:00 น.'
                            : '⏰ Reminder: Stop cartoons & drink water at 20:40 | Bedtime 21:00'}
                        </div>
                        <button
                          type="button"
                          disabled={kid.daily.bossStageUnlocked}
                          onClick={() => setPinRequestAction({ type: 'boss_stage' })}
                          className="w-full min-h-[48px] rounded-2xl bg-[#3D322C] disabled:bg-[#9A8B82] text-white font-bold cursor-pointer"
                        >
                          {kid.daily.bossStageUnlocked
                            ? lang === 'th'
                              ? '✅ ปลดล็อกสิทธิ์ดูการ์ตูนแล้ววันนี้ (+10 ⭐)'
                              : '✅ Cartoon Unlocked Today (+10 ⭐)'
                            : lang === 'th'
                            ? '🔐 ให้พี่เลี้ยงใส่ PIN เพื่อปลดล็อกการ์ตูน (+10 ⭐)'
                            : '🔐 Staff PIN to Unlock Cartoons (+10 ⭐)'}
                        </button>
                      </div>

                      {allowHwPerm && homeworkPermissionSection}

                      {allowReturnPhone && kid.daily.homeworkRegisteredSubject && (
                        <button
                          type="button"
                          onClick={handleReturnPhoneCurfew}
                          className="w-full min-h-[52px] rounded-2xl bg-[#FADADD] hover:bg-[#F5C5CF] font-bold text-[#3D322C] cursor-pointer"
                        >
                          📱{' '}
                          {lang === 'th'
                            ? `นำมือถือมาเก็บเข้าตู้ (ภายใน ${hwCurfewTh})`
                            : `Store Phone (By ${hwCurfewEn})`}
                        </button>
                      )}
                    </>
                  )}

                  {kid.group === 2 && (
                    <>
                      <div className="rounded-2xl bg-[#D4F0F0]/60 p-4 space-y-2.5">
                        <div className="font-bold text-[#3D322C]">
                          ✅ {lang === 'th' ? 'เช็คลิสต์รอบเย็น 18:30 น. (ครบ 4 ข้อเพื่อรับมือถือ)' : '18:30 Evening 4-Item Checklist'}
                        </div>
                        {[
                          lang === 'th' ? '1. ซักชุดนักเรียน' : '1. Wash school uniform',
                          lang === 'th' ? '2. รีดชุดนักเรียน' : '2. Iron school uniform',
                          lang === 'th' ? '3. ตรวจความเรียบร้อยของชุด' : '3. Inspect uniform',
                          lang === 'th' ? '4. อาบน้ำเรียบร้อย' : '4. Take a shower',
                        ].map((label, idx) => (
                          <label key={idx} className="flex items-center gap-2.5 text-sm font-medium text-[#3D322C] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={kid.daily.eveningChecklist[idx]}
                              onChange={(e) => {
                                const next = [...kid.daily.eveningChecklist] as [boolean, boolean, boolean, boolean];
                                next[idx] = e.target.checked;
                                onUpdateKid(
                                  kid.id,
                                  (prev) => ({
                                    ...prev,
                                    daily: { ...prev.daily, eveningChecklist: next },
                                  }),
                                  'Toggle Evening Checklist'
                                );
                              }}
                              className="h-4 w-4 accent-[#3D322C]"
                            />
                            <span>{label}</span>
                          </label>
                        ))}

                        {allowEveningPhone ? (
                          <button
                            type="button"
                            disabled={kid.daily.eveningPhoneUnlocked}
                            onClick={() => {
                              if (!kid.daily.eveningChecklist.every(Boolean)) {
                                onShowAlert({
                                  icon: '📋',
                                  title: lang === 'th' ? 'เช็คลิสต์ยังไม่ครบ 4 ข้อ' : 'Checklist Incomplete',
                                  message: lang === 'th' ? 'กรุณาซักชุด รีดชุด ตรวจชุด และอาบน้ำให้ครบทั้ง 4 ข้อก่อนนะ' : 'Please check all 4 items first.',
                                  tone: 'yellow',
                                });
                                return;
                              }
                              if (
                                kid.penalty.phoneConfiscatedUntil1830Date === todayKey &&
                                getMinutesOfDay(now) < 18 * 60 + 30
                              ) {
                                onShowAlert({
                                  icon: '📵',
                                  title: lang === 'th' ? 'ยังไม่ถึง 18:30 น.' : 'Not 18:30 Yet',
                                  message: lang === 'th' ? 'ติดโทษงดใช้มือถือจนถึง 18:30 น. วันนี้' : 'Phone held until 18:30 today.',
                                  tone: 'pink',
                                });
                                return;
                              }
                              if (kid.penalty.noEveningPhone1830To2245Date === todayKey) {
                                onShowAlert({
                                  icon: '📵',
                                  title: lang === 'th' ? 'งดใช้โทรศัพท์ 18:30–22:45 น.' : 'No Phone 18:30–22:45 Today',
                                  message:
                                    lang === 'th'
                                      ? 'ติดโทษตื่นสายวันหยุด วันนี้งดใช้โทรศัพท์ตั้งแต่เวลา 18:30–22:45 น. ค่ะ'
                                      : 'Holiday late wake-up penalty: no phone use from 18:30–22:45 today.',
                                  tone: 'pink',
                                });
                                return;
                              }
                              if (kid.penalty.noEveningPhoneTomorrowDate === todayKey) {
                                onShowAlert({
                                  icon: '📵',
                                  title: lang === 'th' ? 'ติดโทษงดใช้มือถือรอบเย็นวันนี้' : 'No Evening Phone Today',
                                  message: lang === 'th' ? 'เนื่องจากคืนเครื่องเกินเวลาเมื่อคืน วันนี้งดรับมือถือรอบ 18:30 น. 1 วันนะ' : 'Restricted from 18:30 phone today due to late return yesterday.',
                                  tone: 'pink',
                                });
                                return;
                              }
                              setPinRequestAction({ type: 'g2_evening_phone' });
                            }}
                            className="w-full min-h-[48px] rounded-2xl bg-[#3D322C] disabled:bg-[#9A8B82] text-white font-bold cursor-pointer mt-2"
                          >
                            {kid.daily.eveningPhoneUnlocked
                              ? lang === 'th'
                                ? '✅ รับมือถือรอบเย็นแล้ว (+10 ⭐)'
                                : '✅ Evening Phone Unlocked (+10 ⭐)'
                              : lang === 'th'
                              ? '🔐 พี่เลี้ยงใส่ PIN เพื่อรับมือถือรอบเย็น (+10 ⭐)'
                              : '🔐 Staff PIN for Evening Phone (+10 ⭐)'}
                          </button>
                        ) : (
                          <div className="rounded-xl border border-[#DCE5EA] bg-white/80 px-3 py-2 text-xs font-semibold text-[#5A6C7A]">
                            📵{' '}
                            {lang === 'th'
                              ? 'ปุ่มรับมือถือรอบเย็นปิดใช้งานสำหรับโปรไฟล์นี้'
                              : 'Evening phone pickup disabled for this profile'}
                          </div>
                        )}
                      </div>

                      {allowHwPerm && homeworkPermissionSection}

                      {allowReturnPhone && (
                        <button
                          type="button"
                          onClick={handleReturnPhoneCurfew}
                          className="w-full min-h-[52px] rounded-2xl bg-[#FADADD] hover:bg-[#F5C5CF] font-bold text-[#3D322C] cursor-pointer"
                        >
                          📱{' '}
                          {kid.daily.homeworkRegisteredSubject
                            ? lang === 'th'
                              ? `ส่งคืนมือถือ (ขออนุญาตใช้เพิ่ม — ไม่เกิน ${returnScheduleEval.deadlineTh})`
                              : `Return Phone (Extension — By ${returnScheduleEval.deadlineEn})`
                            : lang === 'th'
                            ? `ส่งคืนมือถือเข้าตู้พี่เลี้ยง (ไม่เกิน ${returnScheduleEval.deadlineTh})`
                            : `Return Phone to Locker (By ${returnScheduleEval.deadlineEn})`}
                        </button>
                      )}
                    </>
                  )}

                  {kid.group === 3 && (
                    <>
                      {allowReturnPhone && (
                        <div className="rounded-2xl bg-[#EAE4F2]/70 p-4 text-sm text-[#3D322C]">
                          {lang === 'th'
                            ? `พี่ใหญ่ใช้งานมือถือได้อย่างอิสระ แต่ต้องส่งคืนเข้าตู้พี่เลี้ยงไม่เกินเวลา Curfew 22:45 น. (หรือภายใน ${hwCurfewTh} หากขออนุญาตทำการบ้านช่วง ${hwPermWin.labelTh})`
                            : `Free usage until 22:45 Curfew (or ${hwCurfewEn} if using the ${hwPermWin.labelEn} homework extension).`}
                        </div>
                      )}

                      {allowHwPerm && homeworkPermissionSection}

                      {allowReturnPhone && (
                        <button
                          type="button"
                          onClick={handleReturnPhoneCurfew}
                          className="w-full min-h-[54px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer"
                        >
                          📱{' '}
                          {kid.daily.homeworkRegisteredSubject
                            ? lang === 'th'
                              ? `ส่งคืนมือถือเข้าตู้พี่เลี้ยง (ภายใน ${hwCurfewTh})`
                              : `Return Phone to Locker (By ${hwCurfewEn})`
                            : lang === 'th'
                            ? 'ส่งคืนมือถือเข้าตู้พี่เลี้ยง (Curfew 22:45 · เพดาน 23:00 น.)'
                            : 'Return Phone to Locker (Curfew 22:45 · Ceiling 23:00)'}
                        </button>
                      )}
                    </>
                  )}

                  {allowComputerHomework && (
                    <div className="rounded-2xl border-2 border-[#9FE2D6] bg-[#EEFBF8] p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-extrabold text-sm text-[#0F4C42]">
                          💻{' '}
                          {lang === 'th'
                            ? `${computerHwConfig.titleTh} (+${computerHwConfig.rewardStars} ⭐)`
                            : `${computerHwConfig.titleEn} (+${computerHwConfig.rewardStars} ⭐)`}
                        </div>
                        <span className="rounded-lg bg-white border border-[#9CD9CD] px-2 py-0.5 text-[11px] font-bold text-[#114A42] tabular-nums">
                          {lang === 'th'
                            ? computerHwConfig.windowLabelTh
                            : computerHwConfig.windowLabelEn}
                        </span>
                      </div>
                      <p className="text-xs text-[#2B5951]">
                        {lang === 'th'
                          ? `เงื่อนไข: ซักผ้า / ตากผ้า / รีดผ้า / อาบน้ำ / ตรวจชุด เรียบร้อยครบทั้ง 5 ข้อ · น้องใส่รหัส PIN ด้วยตนเองในช่วง ${computerHwConfig.windowLabelTh}`
                          : `Requires all 5 chores (Wash, Hang dry, Iron, Shower & Inspect uniform) + your own 4-digit PIN during ${computerHwConfig.windowLabelEn}.`}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {computerHwPrereq.items.map((item) => (
                          <label
                            key={item.key}
                            className={`rounded-xl border px-2.5 py-2 flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors ${
                              item.done
                                ? 'border-[#8AD9CA] bg-white text-[#114A42]'
                                : 'border-[#E6DED5] bg-white/75 text-[#6E5C52]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                onUpdateKid(
                                  kid.id,
                                  (prev) => {
                                    const nextChecklist = [...prev.daily.eveningChecklist] as [
                                      boolean,
                                      boolean,
                                      boolean,
                                      boolean
                                    ];
                                    let nextChores = prev.daily.choresChecked;
                                    if (item.key === 'wash') nextChecklist[0] = checked;
                                    if (item.key === 'iron') nextChecklist[1] = checked;
                                    if (item.key === 'uniform') nextChecklist[2] = checked;
                                    if (item.key === 'shower') nextChecklist[3] = checked;
                                    if (item.key === 'dry') nextChores = checked;
                                    return {
                                      ...prev,
                                      daily: {
                                        ...prev.daily,
                                        eveningChecklist: nextChecklist,
                                        choresChecked: nextChores,
                                      },
                                    };
                                  },
                                  `Computer Homework Prereq (${item.labelTh}: ${checked ? 'Done' : 'Unchecked'})`
                                );
                              }}
                              className="h-4 w-4 accent-[#0F4C42]"
                            />
                            <span className="truncate">
                              {lang === 'th' ? item.labelTh : item.labelEn}
                            </span>
                          </label>
                        ))}
                      </div>

                      {kid.daily.computerHomeworkChecked ? (
                        <div className="rounded-xl border border-[#8AD9CA] bg-white px-3.5 py-2.5 text-xs font-extrabold text-[#114A42]">
                          ✅{' '}
                          {lang === 'th'
                            ? `ขออนุญาตใช้คอมทำการบ้านแล้ววันนี้ (+${computerHwConfig.rewardStars} ⭐)`
                            : `Computer for homework approved today (+${computerHwConfig.rewardStars} ⭐)`}
                        </div>
                      ) : !isComputerHwOpen ? (
                        <div className="rounded-xl border border-dashed border-[#A7D9CF] bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-[#4B7069]">
                          ⏰{' '}
                          {lang === 'th'
                            ? `ขณะนี้อยู่นอกเวลา ${computerHwConfig.windowLabelTh} ปุ่มยืนยันจะเปิดอัตโนมัติในช่วง ${computerHwConfig.windowLabelTh}`
                            : `Outside ${computerHwConfig.windowLabelEn} window. Opens automatically during ${computerHwConfig.windowLabelEn}.`}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!computerHwPrereq.ready) {
                              onShowAlert({
                                icon: '🧺⏳',
                                title:
                                  lang === 'th'
                                    ? 'ยังทำเงื่อนไขก่อนใช้คอมไม่ครบ 5 ข้อค่ะ'
                                    : 'Please Complete All 5 Requirements First',
                                message:
                                  lang === 'th'
                                    ? `ยังขาด: ${computerHwPrereq.missingLabelsTh.join(' · ')}\nกรุณาซักผ้า ตากผ้า รีดผ้า อาบน้ำ และตรวจชุดให้เรียบร้อยครบก่อนนะคะ`
                                    : `Missing: ${computerHwPrereq.missingLabelsEn.join(', ')}`,
                                tone: 'yellow',
                              });
                              return;
                            }
                            setPinRequestAction({ type: 'computer_homework' });
                          }}
                          className={`w-full min-h-[50px] rounded-2xl px-4 py-3 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                            computerHwPrereq.ready
                              ? 'bg-[#0F4C42] hover:bg-[#0B3A32] text-white shadow-sm'
                              : 'bg-[#FFF5CC] hover:bg-[#FCEBA6] border border-[#E6C87A] text-[#6E5311]'
                          }`}
                        >
                          <span>🔑</span>
                          <span>
                            {computerHwPrereq.ready
                              ? lang === 'th'
                                ? `ใส่รหัส PIN ของฉันเพื่อใช้คอมทำการบ้าน (+${computerHwConfig.rewardStars} ⭐)`
                                : `Enter My PIN for Computer Homework (+${computerHwConfig.rewardStars} ⭐)`
                              : lang === 'th'
                              ? `ยังขาด ${computerHwPrereq.missingLabelsTh.join(', ')} (ต้องครบก่อน)`
                              : `Need ${computerHwPrereq.missingLabelsEn.join(', ')} first`}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* MY SPACE FORM MERGED INTO PROFILE MODAL BELOW */}

            {/* 7. SICK REPORT (MANDATORY COPY TO LINE STEP) */}
            {subModal === 'sick_report' && (
              <div className="space-y-4">
                {!pendingSickLineText ? (
                  <>
                    <div className="rounded-2xl border-2 border-[#F5C5CF] bg-[#FADADD]/45 p-3.5 text-xs text-[#5E2832] space-y-1">
                      <div className="font-bold">🩺 ข้อมูลสุขภาพ & การแพ้ยาของน้อง{kid.nickname}</div>
                      <div>
                        🩸 กรุ๊ปเลือด: <strong>{kidHealth.bloodType}</strong> · 💊 แพ้ยา: <strong>{kidHealth.drugAllergies}</strong> · 🍽️ แพ้อาหาร: <strong>{kidHealth.foodAllergies}</strong>
                      </div>
                      {kidHealth.regularMeds !== 'ไม่มี' && (
                        <div>💉 ยาประจำตัว: <strong>{kidHealth.regularMeds}</strong></div>
                      )}
                    </div>

                    <div className="rounded-2xl bg-[#D4F0F0]/70 p-4 text-sm text-[#2E524E]">
                      {lang === 'th'
                        ? 'เมื่อแจ้งอาการเจ็บป่วย ระบบจะส่งแจ้งเตือนพี่เลี้ยง พร้อมข้อความให้กดคัดลอกส่งเข้ากลุ่ม LINE ทันที และยกเว้นค่าปรับสายวันนี้ให้อัตโนมัติ'
                        : 'Alerts caretakers, prepares an urgent LINE message to copy, and waives today late fines.'}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {['มีไข้ / ตัวร้อน', 'ปวดหัว / เวียนหัว', 'ปวดท้อง', 'เจ็บคอ / ไอ', 'ปวดเมื่อย / บาดเจ็บ'].map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => setSickSymptoms(sym)}
                          className={`rounded-2xl px-4 py-2 text-sm font-semibold border-2 cursor-pointer ${
                            sickSymptoms === sym
                              ? 'bg-[#FADADD] border-[#E66C84] text-[#3D322C]'
                              : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                          }`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={3}
                      value={sickDetails}
                      onChange={(e) => setSickDetails(e.target.value)}
                      placeholder={lang === 'th' ? 'ระบุอาการเพิ่มเติม เช่น ปวดตั้งแต่เมื่อคืน ต้องการยา...' : 'Additional symptom details...'}
                      className="w-full rounded-2xl border-2 border-[#F3C5AE] bg-white p-3.5 text-sm"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const cleanDetails = sickDetails.trim() || '-';
                        onAddSickReport({
                          id: `sick_${Date.now()}`,
                          kidId: kid.id,
                          kidNickname: kid.nickname,
                          dateKey: todayKey,
                          reportedAt: now.toISOString(),
                          symptoms: sickSymptoms,
                          details: cleanDetails,
                          resolved: false,
                        });
                        const lineMsg = [
                          '🚨 [แจ้งอาการเจ็บป่วยด่วน - Barnhem]',
                          `👤 ชื่อเล่น: น้อง${kid.nickname} (${kid.id.toUpperCase()} | กลุ่ม ${kid.group})`,
                          `🤒 อาการ: ${sickSymptoms}`,
                          `📝 รายละเอียด: ${cleanDetails}`,
                          `⏰ เวลาที่แจ้ง: ${formatDigitalClock(now)} น. (${todayKey})`,
                          '💚 ระบบยกเว้นค่าปรับสายวันนี้ให้อัตโนมัติแล้วค่ะ',
                        ].join('\n');
                        setSickDetails('');
                        setSickLineCopied(false);
                        setPendingSickLineText(lineMsg);
                      }}
                      className="w-full min-h-[50px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer"
                    >
                      🚑 {lang === 'th' ? 'ส่งแจ้งอาการเจ็บป่วย & สร้างข้อความส่ง LINE' : 'Submit Sick Report & Prepare LINE Alert'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border-2 border-[#E66C84] bg-[#FADADD]/60 p-4 text-sm text-[#6B2D39] space-y-1">
                      <div className="font-bold text-base">
                        🚨 {lang === 'th' ? 'ขั้นตอนสำคัญ (บังคับ): คัดลอกส่งเข้ากลุ่ม LINE ทันที!' : 'Urgent Mandatory Step: Copy for LINE Group!'}
                      </div>
                      <p className="text-xs">
                        {lang === 'th'
                          ? 'อาการเจ็บป่วยเป็นเรื่องฉุกเฉิน กรุณากดปุ่ม "คัดลอกข้อความส่ง LINE" ด้านล่าง แล้วนำไปวาง (Paste) ในกลุ่ม LINE บ้าน Barnhem ก่อนปิดหน้าต่างนี้'
                          : 'Please tap Copy for LINE below and paste into the Barnhem LINE group before closing.'}
                      </p>
                    </div>

                    <textarea
                      readOnly
                      rows={6}
                      value={pendingSickLineText}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full rounded-2xl border-2 border-[#EBD8C3] bg-white p-3.5 text-xs sm:text-sm font-medium text-[#3D322C]"
                    />

                    <button
                      type="button"
                      onClick={async () => {
                        await handleCopyText(pendingSickLineText);
                        setSickLineCopied(true);
                      }}
                      className={`w-full min-h-[54px] rounded-2xl font-bold text-base cursor-pointer transition-colors ${
                        sickLineCopied
                          ? 'bg-[#2F685E] text-white'
                          : 'bg-[#C93B4E] hover:bg-[#AE2F40] text-white shadow-md'
                      }`}
                    >
                      {sickLineCopied
                        ? lang === 'th'
                          ? '✅ คัดลอกข้อความส่ง LINE สำเร็จแล้ว! กดวางในแชท LINE ได้เลย'
                          : '✅ Copied for LINE! Ready to Paste'
                        : lang === 'th'
                        ? '📋 คัดลอกข้อความแจ้งป่วยส่ง LINE กลุ่มทันที (บังคับกด)'
                        : '📋 Copy Urgent Sick Alert for LINE Now (Required)'}
                    </button>

                    <button
                      type="button"
                      disabled={!sickLineCopied}
                      onClick={() => {
                        setPendingSickLineText(null);
                        setSickLineCopied(false);
                        setSubModal(null);
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
                      {sickLineCopied
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
            )}

            {/* 5. STAR HISTORY & BILLS */}
            {subModal === 'star_history' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#FFF5BA] p-4 flex items-center justify-between">
                  <span className="font-bold text-[#3D322C]">
                    {lang === 'th'
                      ? isKidSignedInWithEmail
                        ? 'ยอดดาวคงเหลือ'
                        : 'ยอดดาวคงเหลือ (ยังไม่ล็อกอินอีเมล)'
                      : 'Current Balance'}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">⭐ {displayStars.toLocaleString()}</span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[#3D322C] mb-2">
                    {lang === 'th' ? 'ประวัติการรับ/ใช้ดาวล่าสุด' : 'Recent Star Activity'}
                  </h4>
                  {kid.starHistory.length === 0 ? (
                    <p className="text-sm text-[#7B695F]">{lang === 'th' ? 'ยังไม่มีรายการวันนี้' : 'No star transactions yet.'}</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {kid.starHistory.slice(0, 20).map((tx) => (
                        <div key={tx.id} className="flex justify-between items-center rounded-xl bg-white border border-[#EBD8C3] px-3.5 py-2 text-sm">
                          <div>
                            <div className="font-medium text-[#3D322C]">{tx.reason}</div>
                            <div className="text-xs text-[#8D7B70] tabular-nums">
                              {new Date(tx.timestamp).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                            </div>
                          </div>
                          <span className={`font-bold tabular-nums ${tx.amount >= 0 ? 'text-[#2F685E]' : 'text-[#B84A39]'}`}>
                            {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} ⭐
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[#3D322C] mb-2">
                    {lang === 'th' ? 'บิลแลกขนมของฉัน' : 'My Snack Redemption Bills'}
                  </h4>
                  {kidBills.length === 0 ? (
                    <p className="text-sm text-[#7B695F]">{lang === 'th' ? 'ยังไม่มีประวัติการแลกของรางวัล' : 'No redemptions yet.'}</p>
                  ) : (
                    <div className="space-y-2">
                      {kidBills.slice(0, 10).map((b) => (
                        <div key={b.id} className="flex justify-between rounded-xl bg-[#FADADD]/30 px-3.5 py-2 text-sm">
                          <span>{b.itemName}</span>
                          <span className="font-bold tabular-nums">-{b.starsSpent} ⭐</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. MY DRIVE */}
            {subModal === 'drive_docs' && (
              <div className="space-y-4 text-center">
                <div className="text-5xl">☁️📄</div>
                <p className="text-sm text-[#5E4E45]">
                  {lang === 'th'
                    ? 'เปิดโฟลเดอร์ Google Drive ผลงานส่วนตัวและไฟล์เอกสาร PDF ของน้องในแท็บใหม่'
                    : 'Open your personal Google Drive works & PDF documents folder in a new tab.'}
                </p>
                <a
                  href={kid.personalDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full min-h-[52px] items-center justify-center rounded-2xl bg-[#3D322C] text-white font-bold px-6 py-3"
                >
                  🔗 {lang === 'th' ? 'เปิด Google Drive ของฉัน (แท็บใหม่)' : 'Open My Google Drive (New Tab)'}
                </a>
              </div>
            )}

            {/* 8. PENALTY STATUS */}
            {subModal === 'penalty_status' && (
              <div className="space-y-4">
                {isCleanPenalty ? (
                  <div className="rounded-[24px] bg-[#D4F0F0] border-2 border-[#9CD8D2] p-6 text-center">
                    <div className="text-5xl mb-2">🌟</div>
                    <div className="text-xl font-bold text-[#214F4B]">
                      {lang === 'th' ? 'สถานะปกติ ยอดเยี่ยมมาก!' : 'Clean Record — Excellent!'}
                    </div>
                    <p className="text-sm text-[#356964] mt-1">
                      {lang === 'th'
                        ? 'ไม่มีค่าปรับสายและไม่มีประวัติถูกตัดสิทธิ์มือถือ รักษาความดีแบบนี้ต่อไปนะ!'
                        : 'Zero late fines and zero phone restrictions. Keep up the great discipline!'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[24px] bg-[#FADADD]/60 border-2 border-[#F0A8B4] p-5 space-y-2 text-sm text-[#3D322C]">
                    <div className="font-bold text-base">
                      {lang === 'th' ? 'รายการบทลงโทษ / ค่าปรับปัจจุบัน' : 'Current Fines & Restrictions'}
                    </div>
                    {coinsEnabled && kid.penalty.lateFineThb > 0 && (
                      <div>
                        💸 {lang === 'th' ? 'ค่าปรับสายสะสม:' : 'Accumulated Late Fines:'}{' '}
                        <strong className="tabular-nums">{kid.penalty.lateFineThb} THB</strong>
                      </div>
                    )}
                    {kid.penalty.noEveningPhone1830To2245Date === todayKey && (
                      <div>
                        📵{' '}
                        {lang === 'th'
                          ? 'ตื่นสายวันหยุด: งดใช้โทรศัพท์ตั้งแต่เวลา 18:30–22:45 น. วันนี้'
                          : 'Holiday Late: No phone 18:30–22:45 today'}
                      </div>
                    )}
                    {kid.penalty.noSevenElevenDate === todayKey && (
                      <div>
                        🚫🏪{' '}
                        {lang === 'th'
                          ? 'ตื่นสายวันหยุด: เด็กเล็กงดสั่งเซเว่นวันนี้'
                          : 'Holiday Late: No 7-Eleven orders today'}
                      </div>
                    )}
                    {kid.penalty.phoneConfiscatedUntil1830Date === todayKey && (
                      <div>📵 {lang === 'th' ? 'ยึดมือถือถึง 18:30 น. วันนี้' : 'Phone held until 18:30 today'}</div>
                    )}
                    {kid.penalty.noEveningPhoneTomorrowDate && (
                      <div>
                        📵 {lang === 'th' ? `งดใช้มือถือรอบเย็นวันที่ ${kid.penalty.noEveningPhoneTomorrowDate}` : `No evening phone on ${kid.penalty.noEveningPhoneTomorrowDate}`}
                      </div>
                    )}
                    {kid.penalty.fridayFreeDayDeductedCount > 0 && (
                      <div>
                        🗓️ {lang === 'th' ? `หักสิทธิ์ Free Day วันศุกร์สะสม ${kid.penalty.fridayFreeDayDeductedCount} วัน` : `Friday Free Day deducted: ${kid.penalty.fridayFreeDayDeductedCount}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 9. RULES & SCHEDULE */}
            {subModal === 'rules_schedule' && (
              <div className="space-y-4 text-sm text-[#3D322C] leading-relaxed">
                <HouseRulesGuideView
                  now={now}
                  lang={lang}
                  settings={settings}
                  defaultGroupFilter={
                    kid.group === 1 ? 'younger' : kid.group === 2 ? 'older' : 'senior'
                  }
                  compactEmbedded
                />

                <div className="rounded-2xl border border-[#C4DCF0] bg-[#F5FAFF] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[#1D4D73]">
                      👩‍🏫🚐 {lang === 'th' ? 'อยากรู้ว่าวันนี้พี่เลี้ยงคนไหนเข้าเวร หรือใครขับรถรับ-ส่ง?' : 'Want to see Staff Shifts & Drivers?'}
                    </div>
                    <p className="text-xs text-[#456D8F]">
                      {lang === 'th'
                        ? 'ดูตารางพี่เลี้ยงทั้ง 7 วัน ไนท์วอช ตารางขับรถ และกฎพี่กิ๊ก/พี่กุ๊กเข้าแทนกะเช้าได้ที่นี่'
                        : 'Check weekly staff shifts, Night Watch, driving roster, and morning substitute rules.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSubModal('kid_duties_modal')}
                      className="min-h-[40px] rounded-xl bg-[#DDF5EE] hover:bg-[#C6ECE0] border border-[#8AD2BE] px-4 py-2 text-xs font-extrabold text-[#164A3E] cursor-pointer"
                    >
                      🧹 {lang === 'th' ? 'เปิดตารางเวรต่างๆ ของน้อง' : 'Open Kid Duty Schedules'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubModal('staff_roster')}
                      className="min-h-[40px] rounded-xl bg-[#D6ECFC] hover:bg-[#C2E1FA] border border-[#96C7EE] px-4 py-2 text-xs font-extrabold text-[#163E5E] cursor-pointer"
                    >
                      📅 {lang === 'th' ? 'เปิดตารางพี่เลี้ยง & ขับรถ' : 'Open Staff & Driving Roster'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* KID DUTY SCHEDULES MODAL (MORNING ZONE, HOLIDAY CLEANING, KITCHEN & WEEKLY TRASH) */}
            {subModal === 'kid_duties_modal' && (
              <KidDutySchedulesPanel
                kids={kidsList}
                now={now}
                lang={lang}
                currentKid={kid}
                isPublicHolidayToday={isPublicHolidayToday}
                compactHeader
              />
            )}

            {/* STAFF SHIFT & DRIVING ROSTER MODAL */}
            {subModal === 'staff_roster' && (
              <StaffRosterPanel
                now={now}
                lang={lang}
                isPublicHolidayToday={isPublicHolidayToday}
                staffLeaves={staffLeaves}
                compactHeader
              />
            )}

            {/* TAMAGOTCHI PET COMPANION MODAL */}
            {subModal === 'pet_modal' && (
              <PetTamagotchiModal
                pet={kid.pet}
                now={now}
                lang={lang}
                latestAnnouncement={
                  topAnnouncement ?? {
                    id: dynamicEventAnnouncement.id,
                    title: lang === 'th' ? dynamicEventAnnouncement.titleTh : dynamicEventAnnouncement.titleEn,
                    body: lang === 'th' ? dynamicEventAnnouncement.bodyTh : dynamicEventAnnouncement.bodyEn,
                    priority: 'normal',
                    pinned: true,
                    authorName: 'ระบบเวลาบ้าน Barnhem',
                    authorRole: 'Schedule',
                    createdAt: now.toISOString(),
                  }
                }
                announcementCount={activeScheduledAnnouncements.length + 1}
                onSavePet={(nextPet, label, bonusStars, starReason) =>
                  handleSavePetWithStars(nextPet, label, bonusStars, starReason)
                }
                onOpenAnnouncementsWithTreat={() => setSubModal('announcements_modal')}
              />
            )}

            {/* MY SPACE + PROFILE MODAL (Combined Personal Profile & Notebook) */}
            {(subModal === 'profile_modal' || subModal === 'my_space') && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-[#F3D7DE] bg-gradient-to-br from-[#FFFDF9] to-[#FFF4F6] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#7B695F]">
                      ID: {kid.id} ·{' '}
                      {kid.gender === 'M' ? (lang === 'th' ? 'ชาย' : 'Boy') : lang === 'th' ? 'หญิง' : 'Girl'} ·{' '}
                      {groupLabel}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{kid.emoji}</span>
                      <div>
                        <div className="text-2xl font-extrabold text-[#3D322C] leading-tight">
                          {kid.nickname}
                        </div>
                        <div className="text-xs text-[#6E5C52]">{kid.fullName}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-[#FFF5BA] border border-[#F0D568] px-4 py-2 text-base font-extrabold text-[#4A380D] tabular-nums">
                      ⭐ {displayStars.toLocaleString()} {lang === 'th' ? 'ดาวสะสม' : 'Stars'}
                    </span>
                    <span className="text-xs font-bold text-[#9E4F16]">
                      🔥 {lang === 'th' ? `มาเช้าต่อเนื่อง ${streakCount} วันติด` : `Streak: ${streakCount} day(s)`}
                    </span>
                  </div>
                </div>

                {/* Linked Google Email for Real-Time Personal Device Sync (Top of Profile Modal) */}
                <div className="rounded-2xl border-2 border-[#8FD4C6] bg-[#F2FCF9] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-[#114A42]">
                      📧{' '}
                      {lang === 'th'
                        ? 'อีเมล Google ของฉัน (ซิงค์ตัวการ์ตูน Real-time)'
                        : 'My Google Email (Real-Time Avatar Sync)'}
                    </div>
                    {kid.linkedEmail && (
                      <span className="rounded-xl bg-[#D5F5ED] border border-[#8FD4C6] px-2.5 py-0.5 text-[11px] font-bold text-[#114A42]">
                        ✅ {lang === 'th' ? `ผูกแล้ว: ${kid.linkedEmail}` : `Linked: ${kid.linkedEmail}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#2E5E56] leading-relaxed">
                    {lang === 'th'
                      ? 'ใส่อีเมล Google (Gmail) ของหนูไว้ที่นี่ เมื่อหนูล็อกอินด้วยอีเมลนี้บนมือถือหรือแท็บเล็ตส่วนตัว ภาพตัวการ์ตูนจะปลดล็อกเป็นสีสดใสซิงค์แบบเรียลไทม์'
                      : 'Save your Google email here. Sign in with this email on your phone to unlock full-color live avatar sync.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      maxLength={200}
                      value={linkedEmailForm}
                      onChange={(e) => setLinkedEmailForm(e.target.value)}
                      placeholder="example@gmail.com"
                      className="flex-1 min-w-[200px] rounded-xl border border-[#B5E5DC] bg-white px-3 py-2 text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#8FD4C6]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = linkedEmailForm.trim().toLowerCase();
                        if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
                          onShowAlert({
                            icon: '⚠️',
                            title: lang === 'th' ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'Invalid Email Format',
                            message:
                              lang === 'th'
                                ? 'กรุณากรอกอีเมลให้ถูกต้อง เช่น nong@gmail.com'
                                : 'Please enter a valid email address.',
                            tone: 'pink',
                          });
                          return;
                        }
                        onUpdateKid(
                          kid.id,
                          (prev) => ({
                            ...prev,
                            linkedEmail: clean || undefined,
                          }),
                          clean ? `Link Kid Email (${kid.nickname})` : `Unlink Kid Email (${kid.nickname})`
                        );
                        onShowAlert({
                          icon: clean ? '📧✅' : '🔓',
                          title: clean
                            ? lang === 'th'
                              ? 'บันทึกอีเมลซิงค์ตัวการ์ตูนแล้ว!'
                              : 'Google Email Linked!'
                            : lang === 'th'
                            ? 'ยกเลิกการผูกอีเมลแล้ว'
                            : 'Email Unlinked',
                          message: clean
                            ? lang === 'th'
                              ? `ผูกอีเมล ${clean} ให้น้อง${kid.nickname} แล้ว! เมื่อล็อกอินด้วยอีเมลนี้บนมือถือส่วนตัวจะเห็นตัวการ์ตูนทันทีค่ะ`
                              : `Linked ${clean}. Sign in with this Google account on your own device to view your live cartoon character.`
                            : lang === 'th'
                            ? 'นำอีเมลออกจากโปรไฟล์แล้วค่ะ'
                            : 'Removed linked email from profile.',
                          tone: 'mint',
                        });
                      }}
                      className="min-h-[40px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      💾 {lang === 'th' ? 'บันทึกอีเมลนี้' : 'Save Email'}
                    </button>
                  </div>
                </div>

                {visitingBuddy && (
                  <div className="rounded-2xl border border-[#9CD6CE] bg-[#EFFAF8] px-4 py-3 flex items-center justify-between gap-3 text-xs text-[#214F4B]">
                    <span className="font-bold">
                      🤝{' '}
                      {visitingBuddy.isHost
                        ? lang === 'th'
                          ? `${visitingBuddy.member.emoji} ${visitingBuddy.member.nickname} กำลังมาเยี่ยมบ้านหนู`
                          : `Hosting ${visitingBuddy.member.nickname}`
                        : lang === 'th'
                        ? `กำลังไปบ้าน ${visitingBuddy.member.emoji} ${visitingBuddy.member.nickname}`
                        : `Visiting ${visitingBuddy.member.nickname}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSubModal('friend_visit_modal')}
                      className="rounded-xl bg-white border border-[#9CD6CE] px-3 py-1.5 font-bold cursor-pointer"
                    >
                      {lang === 'th' ? 'จัดการกิจกรรม' : 'Manage'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSubModal('friend_visit_modal')}
                    className="min-h-[48px] rounded-2xl bg-[#D4F0F0] hover:bg-[#BCE7E7] border border-[#9CD6CE] px-4 py-2.5 text-left flex items-center justify-between gap-2 text-sm font-bold text-[#214F4B] cursor-pointer"
                  >
                    <span>
                      🏠 {lang === 'th' ? 'ไปบ้านเพื่อน / ชวนเพื่อนมาบ้าน' : 'Visit a Friend'}
                    </span>
                    {incomingPendingVisits.length > 0 && (
                      <span className="rounded-full bg-[#E66C85] text-white px-2 py-0.5 text-xs">
                        {incomingPendingVisits.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubModal('pet_modal')}
                    className="min-h-[48px] rounded-2xl bg-[#FFE8EF] hover:bg-[#FFD7E4] border border-[#F3B7C0] px-4 py-2.5 text-left flex items-center justify-between gap-2 text-sm font-bold text-[#7B2E3B] cursor-pointer"
                  >
                    <span>
                      {kid.pet ? getPetSpeciesInfo(kid.pet.species).emoji : '🐾'}{' '}
                      {kid.pet
                        ? lang === 'th'
                          ? `สัตว์เลี้ยงทามาก๊อตจิ (${kid.pet.name})`
                          : `Tamagotchi (${kid.pet.name})`
                        : lang === 'th'
                        ? 'เลือกสัตว์เลี้ยง 10 สายพันธุ์'
                        : 'Adopt Tamagotchi (10 Breeds)'}
                    </span>
                    <span className="text-xs opacity-80">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShopFilter('history');
                      setSubModal('shop_modal');
                    }}
                    className="min-h-[48px] rounded-2xl bg-[#FFFBF4] hover:bg-[#FFF2E2] border border-[#F2D9BD] px-4 py-2.5 text-left flex items-center justify-between gap-2 text-sm font-bold text-[#69401B] cursor-pointer"
                  >
                    <span>🧸 {lang === 'th' ? 'ดูประวัติดาว & บิลมินิมาร์ท' : 'Star History & Minimart'}</span>
                    <span className="text-xs opacity-80">→</span>
                  </button>
                </div>

                {/* Personal My Space Diary Inside Profile */}
                <div className="pt-2 border-t border-[#F1E5DF] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-extrabold text-[#6B3242]">
                      🩷 {lang === 'th' ? 'สมุดบันทึกพื้นที่ของฉัน' : 'My Space Notebook'}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[#F5D2DC] bg-[#FFF7F9]">
                    <img
                      src="/src/assets/images/myspace_cartoon_banner_1795016967962.jpg"
                      alt={lang === 'th' ? 'สมุดพื้นที่ของฉัน' : 'My Space Diary'}
                      referrerPolicy="no-referrer"
                      className="w-full h-32 sm:h-40 object-cover"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        key: 'favoriteColor',
                        labelTh: 'สีที่ชอบ',
                        labelEn: 'Favorite Color',
                        imgSrc: '/src/assets/images/myspace_cartoon_color_1795016969740.jpg',
                        cardClass: 'border-[#F5D2DC] bg-[#FFF7F9]',
                        labelClass: 'text-[#6B3242]',
                      },
                      {
                        key: 'favoriteFood',
                        labelTh: 'อาหารจานโปรด',
                        labelEn: 'Favorite Food',
                        imgSrc: '/src/assets/images/myspace_cartoon_food_1795016971033.jpg',
                        cardClass: 'border-[#F2D9BD] bg-[#FFFBF4]',
                        labelClass: 'text-[#69401B]',
                      },
                      {
                        key: 'favoritePet',
                        labelTh: 'สัตว์เลี้ยงที่ชอบ',
                        labelEn: 'Favorite Pet',
                        imgSrc: '/src/assets/images/myspace_cartoon_pet_1795016969867.jpg',
                        cardClass: 'border-[#F5C5D2] bg-[#FFF5F8]',
                        labelClass: 'text-[#6B2D41]',
                      },
                      {
                        key: 'futureDream',
                        labelTh: 'ความฝันในอนาคต',
                        labelEn: 'Future Dream',
                        imgSrc: '/src/assets/images/myspace_cartoon_dream_1795016969415.jpg',
                        cardClass: 'border-[#D5C8F2] bg-[#F8F5FF]',
                        labelClass: 'text-[#3E2B63]',
                      },
                    ].map((f) => (
                      <div
                        key={f.key}
                        className={`rounded-2xl border ${f.cardClass} p-3 flex items-center gap-3`}
                      >
                        <img
                          src={f.imgSrc}
                          alt={lang === 'th' ? f.labelTh : f.labelEn}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-white shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <label className={`block text-xs font-bold mb-1 ${f.labelClass}`}>
                            {lang === 'th' ? f.labelTh : f.labelEn}
                          </label>
                          <input
                            type="text"
                            value={
                              String(
                                mySpaceForm[
                                  f.key as 'favoriteColor' | 'favoriteFood' | 'favoritePet' | 'futureDream'
                                ] ?? ''
                              )
                            }
                            onChange={(e) =>
                              setMySpaceForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                            }
                            className="w-full rounded-xl border border-[#F0D9DF] bg-white px-3 py-1.5 text-sm text-[#3D322C]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const cleanEmail = linkedEmailForm.trim().toLowerCase();
                      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                        onShowAlert({
                          icon: '⚠️',
                          title: lang === 'th' ? 'รูปแบบอีเมลไม่ถูกต้อง' : 'Invalid Email Format',
                          message:
                            lang === 'th'
                              ? 'กรุณากรอกอีเมลให้ถูกต้อง เช่น nong@gmail.com (หรือเว้นว่างไว้)'
                              : 'Please enter a valid email or leave blank.',
                          tone: 'pink',
                        });
                        return;
                      }
                      onUpdateKid(
                        kid.id,
                        (prev) => ({
                          ...prev,
                          linkedEmail: cleanEmail || undefined,
                          mySpace: {
                            ...mySpaceForm,
                            ...(prev.mySpace?.activeGift ? { activeGift: prev.mySpace.activeGift } : {}),
                          },
                        }),
                        'Save My Space & Profile Email'
                      );
                      setSubModal(null);
                      onShowAlert({
                        icon: '🩷',
                        title: lang === 'th' ? 'บันทึกโปรไฟล์ & พื้นที่ของฉันแล้ว!' : 'Profile & My Space Saved!',
                        message: cleanEmail
                          ? lang === 'th'
                            ? `บันทึกข้อมูลส่วนตัวและผูกอีเมล ${cleanEmail} เรียบร้อยจ้า`
                            : `Profile and linked email ${cleanEmail} saved!`
                          : lang === 'th'
                          ? 'บันทึกข้อมูลส่วนตัวในพื้นที่ของฉันเรียบร้อยจ้า'
                          : 'Your personal notebook has been updated!',
                        tone: 'pink',
                      });
                    }}
                    className="w-full min-h-[48px] rounded-2xl bg-[#FADADD] hover:bg-[#F5C7CE] border border-[#EC9BAE] text-[#5B1D2C] font-bold cursor-pointer transition-colors"
                  >
                    💾 {lang === 'th' ? 'บันทึกข้อมูลพื้นที่ของฉัน & อีเมล' : 'Save My Space & Email'}
                  </button>
                </div>
              </div>
            )}

            {/* SHOP MODAL */}
            {subModal === 'shop_modal' && (
              <div className="space-y-4">
                {!isKidSignedInWithEmail && (
                  <div className="rounded-2xl border-2 border-[#F2C36B] bg-gradient-to-r from-[#FFF6D6] via-[#FFF9E6] to-[#FFF2C2] p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 text-xs text-[#6E4500] min-w-0 flex-1">
                      <div className="font-extrabold text-sm">
                        🔒{' '}
                        {lang === 'th'
                          ? 'ดาวอยู่ที่ 0 ⭐ จนกว่าจะล็อกอินอีเมล'
                          : 'Stars stay at 0 ⭐ until Email Sign-In'}
                      </div>
                      <div>
                        {lang === 'th'
                          ? 'เมื่อล็อกอินแล้ว ดาวที่สะสมไว้จะขึ้นอัตโนมัติ สามารถนำดาวมาช็อปปิ้งที่ร้านมินิมาร์ทและแลกของรางวัลได้ค่ะ'
                          : 'Sign in with your email to unlock your stars automatically and shop at the foundation minimart!'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={emailLoginBusy}
                      onClick={async () => {
                        if (!kid.linkedEmail) {
                          setMySpaceForm(kid.mySpace);
                          setLinkedEmailForm('');
                          setSubModal('profile_modal');
                          return;
                        }
                        setEmailLoginBusy(true);
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
                          setEmailLoginBusy(false);
                        }
                      }}
                      className="min-h-[38px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3.5 py-1.5 text-xs font-extrabold cursor-pointer whitespace-nowrap disabled:opacity-60"
                    >
                      {!kid.linkedEmail
                        ? lang === 'th'
                          ? '📧 เพิ่มอีเมลของหนู'
                          : '📧 Add My Email'
                        : emailLoginBusy
                        ? lang === 'th'
                          ? 'กำลังเปิด Google...'
                          : 'Signing in...'
                        : lang === 'th'
                        ? '🔑 ล็อกอินอีเมลปลดล็อกดาว'
                        : '🔑 Sign In with Email'}
                    </button>
                  </div>
                )}

                <div className="rounded-2xl border border-[#D4F0F0] bg-[#D4F0F0]/55 px-4 py-2.5 text-xs font-semibold text-[#214F4B] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    🌟 {lang === 'th' ? 'มินิมาร์ทมูลนิธิ — น้องๆ นำดาวมาแลกของใช้และขนมได้ฟรี ไม่ใช้เงินค่ะ' : 'Foundation Minimart — Exchange earned stars for essentials & snacks (No money needed)'}
                  </span>
                </div>

                {/* Star-to-Coin Piggy Bank Exchange inside Star Shop (shown only when Creator enables Coins) */}
                {coinsEnabled && (
                  <div className="rounded-2xl border-2 border-[#F3B7C0] bg-[#FFF4F7] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-[#5E3A44]">
                      <div className="font-extrabold text-[#3D322C]">
                        🐷 {lang === 'th' ? 'แลกดาวความดีเป็นเหรียญเข้ากระปุกหมูสีชมพู' : 'Exchange Stars to Pink Piggy Coins'}
                      </div>
                      <div>
                        {lang === 'th'
                          ? `อัตราปัจจุบัน: ${eco.starToCoinStars} ⭐ = +${eco.starToCoinThb} ฿ (ในกระปุกมี ${liveAllowance.coins} ฿)`
                          : `Rate: ${eco.starToCoinStars} ⭐ = +${eco.starToCoinThb} THB (Piggy: ${liveAllowance.coins} THB)`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExchangeStarsToCoins}
                      disabled={!isKidSignedInWithEmail || displayStars < eco.starToCoinStars}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                        isKidSignedInWithEmail && displayStars >= eco.starToCoinStars
                          ? 'bg-[#3D322C] hover:bg-[#2B221D] text-white cursor-pointer'
                          : 'bg-[#EADBC8] text-[#8C7A6B] cursor-not-allowed'
                      }`}
                    >
                      {lang === 'th'
                        ? `แลก ${eco.starToCoinStars} ⭐ → +${eco.starToCoinThb} ฿`
                        : `Trade ${eco.starToCoinStars} ⭐ → +${eco.starToCoinThb} THB`}
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FFF5BA]/70 rounded-2xl p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'all', label: lang === 'th' ? 'ทั้งหมด' : 'All' },
                      { id: 'festival', label: lang === 'th' ? '🎊 ไอเทมเทศกาล' : '🎊 Festival Items' },
                      { id: 'snack', label: lang === 'th' ? '🏪 มินิมาร์ท (ของใช้ & ขนม)' : '🏪 Minimart & Snacks' },
                      { id: 'wardrobe', label: lang === 'th' ? '🎒 ชุด & อุปกรณ์' : '🎒 Wardrobe' },
                      { id: 'scene', label: lang === 'th' ? '🏰 ไอเทม 7 สถานที่' : '🏰 7 Scenes Items' },
                      { id: 'history', label: lang === 'th' ? '⭐ ประวัติดาวของฉัน & บิล' : '⭐ My Star History & Bills' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setShopFilter(t.id as typeof shopFilter)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          shopFilter === t.id ? 'bg-[#3D322C] text-white' : 'bg-white text-[#3D322C]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-sm font-bold text-[#3D322C] tabular-nums">
                    ⭐ {displayStars.toLocaleString()}
                  </div>
                </div>

                {shopFilter === 'history' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-[#FFF5BA] p-4 flex items-center justify-between">
                      <span className="font-bold text-[#3D322C]">
                        {lang === 'th'
                          ? isKidSignedInWithEmail
                            ? 'ยอดดาวคงเหลือของฉัน'
                            : 'ยอดดาวคงเหลือ (ล็อกอินเพื่อปลดล็อก)'
                          : 'My Current Star Balance'}
                      </span>
                      <span className="text-2xl font-bold tabular-nums">⭐ {displayStars.toLocaleString()}</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-[#3D322C] mb-2">
                        {lang === 'th' ? 'ประวัติการรับ/ใช้ดาวล่าสุด' : 'Recent Star Activity'}
                      </h4>
                      {kid.starHistory.length === 0 ? (
                        <p className="text-sm text-[#7B695F]">{lang === 'th' ? 'ยังไม่มีรายการวันนี้' : 'No star transactions yet.'}</p>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {kid.starHistory.slice(0, 20).map((tx) => (
                            <div
                              key={tx.id}
                              className="flex justify-between items-center rounded-xl bg-white border border-[#EBD8C3] px-3.5 py-2 text-sm"
                            >
                              <div>
                                <div className="font-medium text-[#3D322C]">{tx.reason}</div>
                                <div className="text-xs text-[#8D7B70] tabular-nums">
                                  {new Date(tx.timestamp).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                                </div>
                              </div>
                              <span
                                className={`font-bold tabular-nums shrink-0 ${
                                  tx.amount >= 0 ? 'text-[#2F685E]' : 'text-[#B84A39]'
                                }`}
                              >
                                {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} ⭐
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-[#3D322C] mb-2">
                        {lang === 'th' ? 'บิลแลกของใช้ & ขนมของฉัน' : 'My Minimart & Snack Bills'}
                      </h4>
                      {kidBills.length === 0 ? (
                        <p className="text-sm text-[#7B695F]">{lang === 'th' ? 'ยังไม่มีประวัติการแลกของรางวัล' : 'No redemptions yet.'}</p>
                      ) : (
                        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                          {kidBills.slice(0, 12).map((b) => (
                            <div
                              key={b.id}
                              className="flex justify-between rounded-xl bg-[#FADADD]/30 px-3.5 py-2 text-sm"
                            >
                              <span>{b.itemName}</span>
                              <span className="font-bold tabular-nums">-{b.starsSpent} ⭐</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-3xl overflow-hidden">
                    <div
                      className={`space-y-4 transition-all duration-300 ${
                        !isKidSignedInWithEmail
                          ? 'filter grayscale-[85%] blur-[7px] opacity-70 pointer-events-none select-none min-h-[280px]'
                          : ''
                      }`}
                    >
                {activeFestival && (shopFilter === 'all' || shopFilter === 'festival') && (
                  <div
                    className="rounded-2xl border-2 border-[#E6B8D0] px-4 py-2.5 text-xs text-[#3D322C] flex flex-wrap items-center justify-between gap-2"
                    style={{ background: activeFestival.bannerGradient }}
                  >
                    <div>
                      <span className="font-extrabold">
                        {activeFestival.emoji}{' '}
                        {lang === 'th'
                          ? `ช่วง${activeFestival.nameTh} (${activeFestival.dateWindowTh})`
                          : `${activeFestival.nameEn} (${activeFestival.dateWindowEn})`}
                      </span>
                      <span className="ml-1.5 text-[#5E4E45]">
                        {lang === 'th'
                          ? '— ชุดเทศกาลนี้ใส่ฟรีในตู้แต่งตัว และซื้อเก็บถาวรไว้ใส่ได้ตลอดปี!'
                          : '— Current festival outfit is free in Wardrobe, or buy to keep year-round!'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[55vh] overflow-y-auto pr-1">
                  {shopItems
                    .filter((item) => {
                      if (shopFilter === 'snack') return item.category === 'snack';
                      if (shopFilter === 'festival') return Boolean(item.festivalId) || item.subType === 'festival_outfit' || item.subType === 'festival_prop';
                      if (shopFilter === 'wardrobe') return item.category === 'cover_item' && item.subType !== 'scene_item';
                      if (shopFilter === 'scene') return item.subType === 'scene_item';
                      return true;
                    })
                    .sort((a, b) => {
                      const aMatch = activeFestival && a.festivalId === activeFestival.id ? 0 : 1;
                      const bMatch = activeFestival && b.festivalId === activeFestival.id ? 0 : 1;
                      return aMatch - bMatch;
                    })
                    .map((item) => {
                      const owned =
                        item.subType === 'scene_item'
                          ? kid.collectedSceneItems.includes(item.id)
                          : kid.ownedShopItemIds.includes(item.id);
                      const hasPhoto = Boolean(item.imageBase64);

                      if (hasPhoto) {
                        return (
                          <div
                            key={item.id}
                            className="rounded-3xl border border-[#EBD8C3] bg-white overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow"
                          >
                            <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-[#FFFDF9] via-[#FAF3EA] to-[#F5EADF] flex items-center justify-center overflow-hidden">
                              <img
                                src={item.imageBase64}
                                alt={lang === 'th' ? item.nameTh : item.nameEn}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  const imgEl = e.currentTarget;
                                  imgEl.style.display = 'none';
                                  const fallback = imgEl.nextElementSibling as HTMLElement | null;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div
                                style={{ display: 'none' }}
                                className="absolute inset-0 items-center justify-center text-5xl bg-gradient-to-br from-[#FFF5BA]/60 to-[#FADADD]/60"
                              >
                                {item.emoji}
                              </div>
                            </div>

                            <div className="p-3.5 flex flex-col gap-2.5 flex-1 justify-between">
                              <div>
                                <div className="font-bold text-base text-[#3D322C] leading-snug">
                                  {item.emoji} {lang === 'th' ? item.nameTh : item.nameEn}
                                </div>
                                <div className="text-[11px] text-[#7B695F] mt-0.5">
                                  {lang === 'th' ? 'แลกด้วยดาวเท่านั้น · ไม่ใช้เงิน' : 'Star exchange only · No cash'}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F4ECE4]">
                                <span className="inline-flex items-center gap-1 rounded-xl bg-[#FFF5BA] px-2.5 py-1 text-sm font-extrabold text-[#8A5A00] tabular-nums">
                                  ⭐ {item.priceStars}
                                </span>
                                <button
                                  type="button"
                                  disabled={owned}
                                  onClick={() => handleBuyShopItem(item)}
                                  className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-colors ${
                                    owned
                                      ? 'bg-[#D4F0F0] text-[#2F685E]'
                                      : 'bg-[#3D322C] hover:bg-[#2B221D] text-white'
                                  }`}
                                >
                                  {owned ? (lang === 'th' ? 'มีแล้ว ✓' : 'Owned ✓') : lang === 'th' ? 'แลกด้วยดาว' : 'Redeem'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border-2 border-[#EBD8C3] bg-white p-3.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#FFF5BA]/70 flex items-center justify-center text-2xl overflow-hidden">
                              {item.emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-[#3D322C] truncate">
                                {lang === 'th' ? item.nameTh : item.nameEn}
                              </div>
                              <div className="text-xs text-[#7B695F] line-clamp-1">
                                {lang === 'th' ? item.descriptionTh : item.descriptionEn}
                              </div>
                              <div className="text-xs font-bold text-[#B37817] mt-0.5 tabular-nums">
                                ⭐ {item.priceStars}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={owned}
                            onClick={() => handleBuyShopItem(item)}
                            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer ${
                              owned
                                ? 'bg-[#D4F0F0] text-[#2F685E]'
                                : 'bg-[#3D322C] hover:bg-[#2B221D] text-white'
                            }`}
                          >
                            {owned ? (lang === 'th' ? 'มีแล้ว ✓' : 'Owned ✓') : lang === 'th' ? 'แลก' : 'Redeem'}
                          </button>
                        </div>
                      );
                    })}
                </div>
                    </div>
                    {!isKidSignedInWithEmail && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#2D2522]/15">
                        <div className="max-w-md w-full rounded-[26px] border-2 border-white/95 bg-[#FFFDF9]/94 backdrop-blur-md p-5 text-center shadow-lg space-y-2.5">
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F2EDE9] border border-[#DFD3C8] px-3 py-1 text-[11px] font-extrabold text-[#4D3E36]">
                            <span>🔒</span>
                            <span>
                              {lang === 'th'
                                ? 'ปิดภาพสินค้าร้านมินิมาร์ท & ไอเทมต่างๆ ชั่วคราว'
                                : 'Minimart Items & Photos Locked'}
                            </span>
                          </div>
                          <p className="text-xs text-[#5E4E45] leading-relaxed">
                            {lang === 'th'
                              ? 'ล็อกอินด้วยอีเมลของหนูเพื่อเปิดดูภาพขนม ของรางวัล และไอเทมแต่งตัวแบบเต็มรูปแบบค่ะ'
                              : 'Sign in with your Google email to unlock minimart product photos, items, and rewards.'}
                          </p>
                          <button
                            type="button"
                            disabled={emailLoginBusy}
                            onClick={async () => {
                              if (!kid.linkedEmail) {
                                setMySpaceForm(kid.mySpace);
                                setLinkedEmailForm('');
                                setSubModal('profile_modal');
                                return;
                              }
                              setEmailLoginBusy(true);
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
                                setEmailLoginBusy(false);
                              }
                            }}
                            className="min-h-[40px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-4 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-60"
                          >
                            {!kid.linkedEmail
                              ? lang === 'th'
                                ? '📧 เพิ่มอีเมลของหนู'
                                : '📧 Add My Email'
                              : emailLoginBusy
                              ? lang === 'th'
                                ? 'กำลังเปิด Google...'
                                : 'Signing in...'
                              : lang === 'th'
                              ? '🔑 ล็อกอินอีเมลเปิดร้านค้า'
                              : '🔑 Sign In to Unlock Shop'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* WARDROBE & 7 SCENES MODAL */}
            {subModal === 'wardrobe_modal' && (
              <div className="relative rounded-3xl overflow-hidden">
                <div
                  className={`space-y-5 transition-all duration-300 ${
                    !isKidSignedInWithEmail
                      ? 'filter grayscale-[85%] blur-[7px] opacity-70 pointer-events-none select-none min-h-[300px]'
                      : ''
                  }`}
                >
                {/* 7 Cover Locations Switcher */}
                <div>
                  <h4 className="font-bold text-sm text-[#3D322C] mb-2">
                    🏰 {lang === 'th' ? 'เลือกฉากหลังหน้าปก (7 สถานที่ — เก็บครบ 7 ไอเทมเพื่อปลดล็อกด่านต่อไป)' : 'Select Cover Scene (7 Stages)'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {COVER_SCENES.map((scene) => {
                      const unlocked = kid.unlockedCoverStages.includes(scene.stage);
                      const isActive = kid.activeCoverStage === scene.stage;
                      return (
                        <button
                          key={scene.stage}
                          type="button"
                          onClick={() => {
                            if (!unlocked) {
                              onShowAlert({
                                icon: '🔒',
                                title: lang === 'th' ? 'ยังไม่ปลดล็อกฉากนี้' : 'Scene Locked',
                                message:
                                  lang === 'th'
                                    ? `สะสมไอเทมประจำฉากที่ ${scene.stage - 1} ให้ครบ 7 ชิ้นในร้านค้า เพื่อเปิดใช้งาน "${scene.titleTh}"`
                                    : `Collect all 7 items in Stage ${scene.stage - 1} to unlock "${scene.titleEn}".`,
                                tone: 'lavender',
                              });
                              return;
                            }
                            onUpdateKid(
                              kid.id,
                              (prev) => ({ ...prev, activeCoverStage: scene.stage }),
                              `Switch Cover Stage ${scene.stage}`
                            );
                          }}
                          className={`rounded-2xl p-3 text-left border-2 cursor-pointer transition-all ${
                            isActive
                              ? 'border-[#3D322C] bg-[#FFF5BA]'
                              : unlocked
                              ? 'border-[#EBD8C3] bg-white hover:bg-[#FFFDF9]'
                              : 'border-[#EBD8C3] bg-[#F4EFEA] opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-[#3D322C]">
                            <span>
                              {scene.badgeEmoji} {lang === 'th' ? scene.titleTh : scene.titleEn}
                            </span>
                            <span>{isActive ? '✅' : unlocked ? '🔓' : '🔒'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Free Body / Face / Tied Hair Customization */}
                <div className="rounded-2xl bg-[#FDE2D2]/40 p-4 space-y-3">
                  <div className="font-bold text-sm text-[#3D322C]">
                    ✨ {lang === 'th' ? 'ปรับแต่งหน้าตา & รูปร่างฟรี (ทรงผมมัดเรียบร้อยตามกติกาโรงเรียน)' : 'Free Look Customization (Neat Tied Hair Only)'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="font-semibold block mb-1">{lang === 'th' ? 'สีผิว' : 'Skin Tone'}</span>
                      <select
                        value={kid.avatar.skinTone}
                        onChange={(e) =>
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              avatar: { ...prev.avatar, skinTone: e.target.value as AvatarSkinTone },
                            }),
                            'Update Skin Tone'
                          )
                        }
                        className="w-full rounded-xl border border-[#EBD8C3] bg-white p-2"
                      >
                        <option value="fair">ขาวใส</option>
                        <option value="warm">น้ำผึ้งอ่อน</option>
                        <option value="tan">สีแทน</option>
                        <option value="deep">ผิวเข้ม</option>
                      </select>
                    </div>
                    <div>
                      <span className="font-semibold block mb-1">{lang === 'th' ? 'รูปร่าง' : 'Body'}</span>
                      <select
                        value={kid.avatar.bodyType}
                        onChange={(e) =>
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              avatar: { ...prev.avatar, bodyType: e.target.value as AvatarBodyType },
                            }),
                            'Update Body'
                          )
                        }
                        className="w-full rounded-xl border border-[#EBD8C3] bg-white p-2"
                      >
                        <option value="slim">เพรียว</option>
                        <option value="regular">สมส่วน</option>
                        <option value="sturdy">แข็งแรง</option>
                      </select>
                    </div>
                    <div>
                      <span className="font-semibold block mb-1">{lang === 'th' ? 'หน้าตา' : 'Face'}</span>
                      <select
                        value={kid.avatar.faceMood}
                        onChange={(e) =>
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              avatar: { ...prev.avatar, faceMood: e.target.value as AvatarFaceMood },
                            }),
                            'Update Face'
                          )
                        }
                        className="w-full rounded-xl border border-[#EBD8C3] bg-white p-2"
                      >
                        <option value="happy">ยิ้มสดใส</option>
                        <option value="cheerful">ร่าเริง</option>
                        <option value="cool">เท่ๆ</option>
                        <option value="shy">ขี้อาย</option>
                      </select>
                    </div>
                    <div>
                      <span className="font-semibold block mb-1">{lang === 'th' ? 'ทรงผมนักเรียน' : 'Hair'}</span>
                      <select
                        value={kid.avatar.hairStyle}
                        onChange={(e) =>
                          onUpdateKid(
                            kid.id,
                            (prev) => ({
                              ...prev,
                              avatar: {
                                ...prev.avatar,
                                hairStyle: e.target.value as 'tied_bun' | 'tied_ponytail' | 'neat_short',
                              },
                            }),
                            'Update Hair'
                          )
                        }
                        className="w-full rounded-xl border border-[#EBD8C3] bg-white p-2"
                      >
                        <option value="tied_ponytail">มัดหางม้า</option>
                        <option value="tied_bun">มัดแกละคู่</option>
                        <option value="neat_short">ผมสั้นเรียบร้อย</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Outfit Switching Rules */}
                <div className="space-y-2">
                  <div className="font-bold text-sm text-[#3D322C]">
                    👕 {lang === 'th' ? 'โหมดชุดแต่งกาย (ชุดเที่ยวใส่ได้หลัง 18:30 น. / เสาร์-อาทิตย์ / วันหยุด)' : 'Outfits (Casual unlocked after 18:30 / Weekends / Holidays)'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleOutfitMode('lounge')}
                      className={`rounded-xl px-4 py-2 text-xs font-bold border-2 cursor-pointer ${
                        kid.avatar.outfitMode === 'lounge'
                          ? 'bg-[#DCEEF8] border-[#3D322C]'
                          : 'bg-white border-[#EBD8C3]'
                      }`}
                    >
                      🩳 {lang === 'th' ? 'เสื้อซับ & กางเกงขาสั้น (ฟรี)' : 'Home Shorts (Free)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleOutfitMode('uniform')}
                      className={`rounded-xl px-4 py-2 text-xs font-bold border-2 cursor-pointer ${
                        kid.avatar.outfitMode === 'uniform'
                          ? 'bg-[#DCEEF8] border-[#3D322C]'
                          : 'bg-white border-[#EBD8C3]'
                      }`}
                    >
                      👔 {lang === 'th' ? 'ชุดนักเรียน (ฟรี)' : 'School Uniform (Free)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleOutfitMode('custom_design')}
                      className={`rounded-xl px-4 py-2 text-xs font-bold border-2 cursor-pointer ${
                        kid.avatar.outfitMode === 'custom_design'
                          ? 'bg-[#EAE4F2] border-[#3D322C]'
                          : 'bg-white border-[#EBD8C3]'
                      }`}
                    >
                      🎨 {lang === 'th' ? 'ชุดออกแบบเองของฉัน' : 'My Custom Outfit'}
                    </button>
                    {shopItems
                      .filter((s) => s.subType === 'casual_outfit' && kid.ownedShopItemIds.includes(s.id))
                      .map((outfit) => (
                        <button
                          key={outfit.id}
                          type="button"
                          onClick={() => handleToggleOutfitMode('casual', outfit.id)}
                          className={`rounded-xl px-4 py-2 text-xs font-bold border-2 cursor-pointer ${
                            kid.avatar.outfitMode === 'casual' && kid.avatar.equippedCasualId === outfit.id
                              ? 'bg-[#FADADD] border-[#3D322C]'
                              : 'bg-white border-[#EBD8C3]'
                          }`}
                        >
                          {outfit.emoji} {lang === 'th' ? outfit.nameTh : outfit.nameEn}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Custom Anime Outfit Designer Studio */}
                <CustomOutfitStudio
                  initialDesign={kid.avatar.customOutfit}
                  lang={lang}
                  canWearNow={canWearCasualOutfitNow(now, isPublicHolidayToday).allowed}
                  onSaveDesign={handleSaveCustomOutfit}
                />

                {/* Festival Outfits & Props Section (Free for Current Festival + Owned Year-Round; Freely switchable with Uniform) */}
                <div className="rounded-2xl border-2 border-[#E6B8D0] bg-gradient-to-r from-[#FFF5F9] via-[#FFFDF9] to-[#FFF9E6] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-sm text-[#3D322C]">
                      🎊{' '}
                      {activeFestival
                        ? lang === 'th'
                          ? `ชุด & ไอเทมเทศกาลตอนนี้: ${activeFestival.emoji} ${activeFestival.nameTh}`
                          : `Active Festival: ${activeFestival.emoji} ${activeFestival.nameEn}`
                        : lang === 'th'
                        ? 'ชุด & ไอเทมช่วงเทศกาลที่สะสมไว้'
                        : 'Festival Outfits & Items'}
                    </div>
                    <span className="text-[11px] font-bold text-[#7A3B5E]">
                      {lang === 'th' ? 'สลับกับชุดนักเรียนได้ตลอดเวลา' : 'Switch with School Uniform anytime'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {shopItems
                      .filter(
                        (s) =>
                          s.subType === 'festival_outfit' &&
                          ((activeFestival && s.festivalId === activeFestival.id) || kid.ownedShopItemIds.includes(s.id))
                      )
                      .map((festOutfit) => {
                        const isFreeThisFestival = Boolean(activeFestival && festOutfit.festivalId === activeFestival.id);
                        const isEquipped =
                          kid.avatar.outfitMode === 'festival' &&
                          (kid.avatar.equippedFestivalId === festOutfit.id ||
                            (!kid.avatar.equippedFestivalId && festOutfit.id === activeFestival?.defaultOutfitId));
                        return (
                          <button
                            key={festOutfit.id}
                            type="button"
                            onClick={() => handleToggleOutfitMode('festival', festOutfit.id)}
                            className={`rounded-xl px-3.5 py-2 text-xs font-bold border-2 cursor-pointer ${
                              isEquipped ? 'bg-[#FADADD] border-[#3D322C]' : 'bg-white border-[#E6B8D0]'
                            }`}
                          >
                            {festOutfit.emoji} {lang === 'th' ? festOutfit.nameTh : festOutfit.nameEn}
                            {isFreeThisFestival ? (lang === 'th' ? ' (ฟรีเทศกาลนี้)' : ' (Free)') : ''}
                          </button>
                        );
                      })}

                    {shopItems
                      .filter(
                        (s) =>
                          (s.subType === 'festival_prop' || (s.festivalId && s.subType !== 'festival_outfit')) &&
                          ((activeFestival && s.festivalId === activeFestival.id) || kid.ownedShopItemIds.includes(s.id))
                      )
                      .map((prop) => {
                        const isEquipped =
                          kid.avatar.equippedFestivalPropId === prop.id ||
                          kid.avatar.equippedHatId === prop.id ||
                          kid.avatar.equippedGlassesId === prop.id;
                        return (
                          <button
                            key={prop.id}
                            type="button"
                            onClick={() =>
                              onUpdateKid(
                                kid.id,
                                (prev) => {
                                  const nextAvatar = { ...prev.avatar };
                                  if (prop.subType === 'festival_prop') {
                                    nextAvatar.equippedFestivalPropId = isEquipped ? undefined : prop.id;
                                  } else if (prop.subType === 'hat') {
                                    nextAvatar.equippedHatId = isEquipped ? undefined : prop.id;
                                  } else if (prop.subType === 'glasses') {
                                    nextAvatar.equippedGlassesId = isEquipped ? undefined : prop.id;
                                  }
                                  return { ...prev, avatar: nextAvatar };
                                },
                                `Toggle Festival Item ${prop.nameTh}`
                              )
                            }
                            className={`rounded-xl px-3.5 py-2 text-xs font-bold border-2 cursor-pointer ${
                              isEquipped ? 'bg-[#FFF5BA] border-[#3D322C]' : 'bg-white border-[#F0D568]'
                            }`}
                          >
                            {prop.emoji} {lang === 'th' ? prop.nameTh : prop.nameEn}{' '}
                            {isEquipped ? '✓' : activeFestival && prop.festivalId === activeFestival.id ? (lang === 'th' ? '(ฟรี)' : '(Free)') : ''}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Accessories Equip (Bags, Hats, Glasses, Cosmetics) */}
                <div className="space-y-2">
                  <div className="font-bold text-sm text-[#3D322C]">
                    🎒 {lang === 'th' ? 'กระเป๋านักเรียน หมวก แว่นตา & เครื่องสำอางที่ซื้อแล้ว' : 'Owned Bags, Hats, Glasses & Cosmetics'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {shopItems
                      .filter(
                        (s) =>
                          s.subType &&
                          ['school_bag', 'hat', 'glasses', 'cosmetic'].includes(s.subType) &&
                          !s.festivalId &&
                          kid.ownedShopItemIds.includes(s.id)
                      )
                      .map((acc) => {
                        const isEquipped =
                          kid.avatar.equippedBagId === acc.id ||
                          kid.avatar.equippedHatId === acc.id ||
                          kid.avatar.equippedGlassesId === acc.id ||
                          kid.avatar.equippedCosmeticId === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() =>
                              onUpdateKid(
                                kid.id,
                                (prev) => {
                                  const nextAvatar = { ...prev.avatar };
                                  if (acc.subType === 'school_bag') {
                                    nextAvatar.equippedBagId = isEquipped ? undefined : acc.id;
                                  } else if (acc.subType === 'hat') {
                                    nextAvatar.equippedHatId = isEquipped ? undefined : acc.id;
                                  } else if (acc.subType === 'glasses') {
                                    nextAvatar.equippedGlassesId = isEquipped ? undefined : acc.id;
                                  } else if (acc.subType === 'cosmetic') {
                                    nextAvatar.equippedCosmeticId = isEquipped ? undefined : acc.id;
                                  }
                                  return { ...prev, avatar: nextAvatar };
                                },
                                `Toggle Accessory ${acc.nameTh}`
                              )
                            }
                            className={`rounded-xl px-3.5 py-2 text-xs font-bold border-2 cursor-pointer ${
                              isEquipped ? 'bg-[#D4F0F0] border-[#3D322C]' : 'bg-white border-[#EBD8C3]'
                            }`}
                          >
                            {acc.emoji} {lang === 'th' ? acc.nameTh : acc.nameEn} {isEquipped ? '✓' : ''}
                          </button>
                        );
                      })}
                    {kid.ownedShopItemIds.length === 0 && (
                      <span className="text-xs text-[#7B695F]">
                        {lang === 'th'
                          ? 'ยังไม่มีกระเป๋านักเรียน หมวก แว่นตา หรือเครื่องสำอาง — ซื้อได้ที่ร้านค้า Barnhem Star Shop!'
                          : 'No accessories owned yet — visit Barnhem Star Shop!'}
                      </span>
                    )}
                  </div>
                </div>
                </div>
                {!isKidSignedInWithEmail && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#2D2522]/15">
                    <div className="max-w-md w-full rounded-[26px] border-2 border-white/95 bg-[#FFFDF9]/94 backdrop-blur-md p-5 text-center shadow-lg space-y-2.5">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F2EDE9] border border-[#DFD3C8] px-3 py-1 text-[11px] font-extrabold text-[#4D3E36]">
                        <span>🔒</span>
                        <span>
                          {lang === 'th'
                            ? 'ปิดภาพชุดแต่งตัวและไอเทมต่างๆ ชั่วคราว'
                            : 'Wardrobe & Items Locked'}
                        </span>
                      </div>
                      <p className="text-xs text-[#5E4E45] leading-relaxed">
                        {lang === 'th'
                          ? 'ล็อกอินด้วยอีเมลของหนูเพื่อเปิดดูภาพชุดแต่งตัว ไอเทมสะสม และฉากหลังทั้งหมดแบบสีสดใสค่ะ'
                          : 'Sign in with your Google email to view outfits, collectible items, and scenes.'}
                      </p>
                      <button
                        type="button"
                        disabled={emailLoginBusy}
                        onClick={async () => {
                          if (!kid.linkedEmail) {
                            setMySpaceForm(kid.mySpace);
                            setLinkedEmailForm('');
                            setSubModal('profile_modal');
                            return;
                          }
                          setEmailLoginBusy(true);
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
                            setEmailLoginBusy(false);
                          }
                        }}
                        className="min-h-[40px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-4 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-60"
                      >
                        {!kid.linkedEmail
                          ? lang === 'th'
                            ? '📧 เพิ่มอีเมลของหนู'
                            : '📧 Add My Email'
                          : emailLoginBusy
                          ? lang === 'th'
                            ? 'กำลังเปิด Google...'
                            : 'Signing in...'
                          : lang === 'th'
                          ? '🔑 ล็อกอินอีเมลเปิดตู้แต่งตัว'
                          : '🔑 Sign In to Unlock Wardrobe'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 10. SECRET BALLOT VOTING MODAL */}
            {subModal === 'vote_modal' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#EAE4F2]/80 border border-[#D4C7EA] p-4 text-xs sm:text-sm text-[#4A3E63]">
                  🔒{' '}
                  {lang === 'th'
                    ? 'การโหวตนี้เป็นความลับ 100% — ไม่มีการบันทึกชื่อว่าใครโหวตข้อไหน พี่เลี้ยงและเพื่อนๆ จะเห็นเฉพาะผลคะแนนรวมเท่านั้น น้องสามารถใช้เสียงของตัวเองได้อย่างสบายใจเลยค่ะ!'
                    : '100% Secret Ballot: Only aggregate vote counts are saved. Nobody can see who voted for what.'}
                </div>

                {polls.length === 0 ? (
                  <p className="text-sm text-[#7B695F] text-center py-6">
                    {lang === 'th' ? 'ยังไม่มีหัวข้อโหวตในขณะนี้' : 'No active polls right now.'}
                  </p>
                ) : (
                  polls.map((poll) => {
                    const hasVoted = poll.votedKidIds.includes(kid.id);
                    const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
                    const chosenOpt = selectedVoteOptions[poll.id];

                    return (
                      <div
                        key={poll.id}
                        className="rounded-2xl border-2 border-[#DCEEF8] bg-white p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="font-bold text-base text-[#3D322C]">{poll.question}</div>
                          <span className="text-xs font-semibold text-[#6E5C52] tabular-nums">
                            {hasVoted
                              ? lang === 'th'
                                ? '✅ โหวตแล้ว'
                                : '✅ Voted'
                              : poll.closed
                              ? lang === 'th'
                                ? 'ปิดโหวตแล้ว'
                                : 'Closed'
                              : lang === 'th'
                              ? 'เปิดโหวต'
                              : 'Open'}
                          </span>
                        </div>

                        {hasVoted || poll.closed ? (
                          <div className="space-y-2">
                            {poll.options.map((opt) => {
                              const pct =
                                totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                              return (
                                <div key={opt.id} className="space-y-1 text-xs">
                                  <div className="flex justify-between font-bold text-[#3D322C]">
                                    <span>{opt.label}</span>
                                    <span className="tabular-nums">
                                      {opt.votes} ({pct}%)
                                    </span>
                                  </div>
                                  <div className="h-2.5 rounded-full bg-[#F4ECE4] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[#7CC6B8]"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            <div className="text-[11px] text-[#7B695F] tabular-nums pt-1">
                              {lang === 'th'
                                ? `จำนวนผู้ใช้สิทธิ์ทั้งหมด ${totalVotes} เสียง (ไม่แสดงรายชื่อ)`
                                : `Total votes cast: ${totalVotes} (anonymous)`}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {poll.options.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setSelectedVoteOptions((prev) => ({
                                    ...prev,
                                    [poll.id]: opt.id,
                                  }))
                                }
                                className={`w-full min-h-[44px] rounded-xl border-2 px-4 py-2 text-left text-sm font-semibold cursor-pointer transition-all ${
                                  chosenOpt === opt.id
                                    ? 'border-[#3D322C] bg-[#FFF5BA] text-[#3D322C]'
                                    : 'border-[#EBD8C3] bg-[#FFFDF9] hover:bg-[#FAF5EE] text-[#3D322C]'
                                }`}
                              >
                                {chosenOpt === opt.id ? '🔘 ' : '⚪ '}
                                {opt.label}
                              </button>
                            ))}

                            <button
                              type="button"
                              disabled={!chosenOpt}
                              onClick={() => {
                                if (!chosenOpt) return;
                                onCastSecretVote(poll.id, chosenOpt, kid.id);
                                onShowAlert({
                                  icon: '🗳️🔒',
                                  title:
                                    lang === 'th'
                                      ? 'ส่งเสียงโหวตลับเรียบร้อย!'
                                      : 'Secret Vote Recorded!',
                                  message:
                                    lang === 'th'
                                      ? 'ขอบคุณที่ใช้สิทธิ์นะ คะแนนถูกนับรวมแบบไม่ระบุตัวตนเรียบร้อยแล้ว'
                                      : 'Your vote was counted anonymously!',
                                  tone: 'mint',
                                });
                              }}
                              className="w-full min-h-[46px] rounded-2xl bg-[#3D322C] disabled:bg-[#C9BEB5] text-white font-bold text-sm cursor-pointer mt-1"
                            >
                              🗳️ {lang === 'th' ? 'ยืนยันโหวต (ความลับ)' : 'Submit Secret Vote'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 11. OUTINGS ROSTER & PRIVATE BACKCHANNEL MESSAGE MODAL */}
            {subModal === 'trips_modal' && (
              <div className="space-y-5">
                {/* Outings List & Who is Going */}
                <div className="space-y-3">
                  <div className="font-bold text-sm text-[#3D322C]">
                    🚌 {lang === 'th' ? 'ตารางสถานที่เที่ยว & รายชื่อผู้ร่วมเดินทาง' : 'Outings & Who Is Going'}
                  </div>

                  {trips.length === 0 ? (
                    <p className="text-sm text-[#7B695F]">
                      {lang === 'th' ? 'ยังไม่มีทริปสถานที่เที่ยวในตอนนี้' : 'No trips posted yet.'}
                    </p>
                  ) : (
                    trips.map((trip) => {
                      const isGoing = trip.attendeeIds.includes(kid.id);
                      const goingKids = kidsList.filter((k) => trip.attendeeIds.includes(k.id));
                      return (
                        <div
                          key={trip.id}
                          className="rounded-2xl border-2 border-[#B3E0DC] bg-white p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-base text-[#3D322C]">
                                🗺️ {trip.title}
                              </div>
                              <div className="text-xs text-[#6E5C52]">
                                📍 {trip.location} · 🗓️ {trip.dateText}
                              </div>
                              <div className="text-xs text-[#6E5C52]">
                                👩‍🏫 {lang === 'th' ? 'พี่เลี้ยงดูแล:' : 'Chaperones:'} {trip.chaperone}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onToggleTripRsvp(trip.id, kid.id)}
                              className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs font-bold cursor-pointer ${
                                isGoing
                                  ? 'bg-[#D4F0F0] border-2 border-[#2F685E] text-[#214F4B]'
                                  : 'bg-[#3D322C] text-white'
                              }`}
                            >
                              {isGoing
                                ? lang === 'th'
                                  ? '✅ ลงชื่อไปแล้ว (กดเพื่อยกเลิก)'
                                  : '✅ Going (Tap to cancel)'
                                : lang === 'th'
                                ? '🙋‍♀️ กดลงชื่อไปด้วย'
                                : '🙋‍♀️ Count Me In'}
                            </button>
                          </div>

                          <p className="text-xs text-[#5E4E45]">{trip.details}</p>

                          <div className="rounded-xl bg-[#D4F0F0]/55 p-2.5 text-xs text-[#214F4B]">
                            <span className="font-bold">
                              👥 {lang === 'th' ? `เพื่อนที่ลงชื่อไป (${goingKids.length} คน): ` : `Attending (${goingKids.length}): `}
                            </span>
                            {goingKids.length === 0
                              ? lang === 'th'
                                ? 'ยังไม่มีใครลงชื่อ'
                                : 'No attendees yet'
                              : goingKids.map((k) => `${k.emoji} ${k.nickname}`).join(', ')}
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setDmTripId(trip.id)}
                              className="rounded-xl bg-[#EAE4F2] hover:bg-[#DDD2EE] px-3 py-1.5 text-xs font-bold text-[#3D322C] cursor-pointer"
                            >
                              💌 {lang === 'th' ? 'ทักข้อความหลังไมค์เกี่ยวกับทริปนี้' : 'Private DM about this trip'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Confidential Private Backchannel Composer */}
                <div className="rounded-[24px] border-2 border-[#D4C7EA] bg-[#FAF7FD] p-4 space-y-3">
                  <div>
                    <div className="font-bold text-sm text-[#3D322C]">
                      💌 {lang === 'th' ? 'ส่งข้อความหลังไมค์ถึงพี่เลี้ยง (เป็นความลับเฉพาะพี่เลี้ยง)' : 'Send Private Message to Staff (Confidential)'}
                    </div>
                    <p className="text-xs text-[#6E5C52] mt-0.5">
                      {lang === 'th'
                        ? 'ไม่กล้าพิมพ์ถามในกลุ่ม LINE ใช่ไหม? ส่งข้อความตรงถึงพี่เลี้ยงได้ที่นี่ เพื่อนคนอื่นจะไม่เห็นข้อความของหนูค่ะ'
                        : 'Shy to ask in the LINE group? Message caretakers privately here. Other kids cannot see this.'}
                    </p>
                  </div>

                  {trips.length > 0 && (
                    <select
                      value={dmTripId}
                      onChange={(e) => setDmTripId(e.target.value)}
                      className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
                    >
                      <option value="">
                        {lang === 'th' ? '💬 หัวข้อทั่วไป / ปรึกษาส่วนตัว' : '💬 General Private Question'}
                      </option>
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                          🗺️ {t.title}
                        </option>
                      ))}
                    </select>
                  )}

                  <textarea
                    rows={3}
                    value={dmText}
                    onChange={(e) => setDmText(e.target.value)}
                    placeholder={
                      lang === 'th'
                        ? 'พิมพ์ความในใจ คำถาม หรือสิ่งที่อยากบอกพี่เลี้ยงหลังไมค์...'
                        : 'Write your confidential message to caretakers...'
                    }
                    className="w-full rounded-xl border border-[#D4C7EA] bg-white p-3 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (!dmText.trim()) return;
                      const linkedTrip = trips.find((t) => t.id === dmTripId);
                      onSendPrivateMessage({
                        id: `dm_${Date.now()}`,
                        kidId: kid.id,
                        kidNickname: kid.nickname,
                        tripId: linkedTrip?.id,
                        tripTitle: linkedTrip?.title,
                        message: dmText.trim(),
                        createdAt: now.toISOString(),
                        readByStaff: false,
                      });
                      setDmText('');
                      onShowAlert({
                        icon: '💌✨',
                        title:
                          lang === 'th'
                            ? 'ส่งข้อความหลังไมค์ถึงพี่เลี้ยงแล้ว!'
                            : 'Private Message Sent!',
                        message:
                          lang === 'th'
                            ? 'ข้อความถูกส่งแบบส่วนตัวถึงพี่เลี้ยงและผู้จัดการเรียบร้อย รอพี่เลี้ยงตอบกลับตรงนี้ได้เลยนะ'
                            : 'Sent discreetly to Staff & Manager inbox. Check back here for their reply!',
                        tone: 'lavender',
                      });
                    }}
                    className="w-full min-h-[46px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white font-bold text-sm cursor-pointer"
                  >
                    💌 {lang === 'th' ? 'ส่งข้อความหลังไมค์ (เป็นความลับ)' : 'Send Confidential Message'}
                  </button>

                  {myPrivateMessages.length > 0 && (
                    <div className="pt-2 border-t border-[#E6DCF2] space-y-2">
                      <div className="text-xs font-bold text-[#3D322C]">
                        📬 {lang === 'th' ? 'ข้อความหลังไมค์ของฉัน & คำตอบจากพี่เลี้ยง' : 'My Sent Messages & Staff Replies'}
                      </div>
                      <div className="space-y-2 max-h-52 overflow-y-auto">
                        {myPrivateMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className="rounded-xl border border-[#EBD8C3] bg-white p-3 text-xs space-y-1.5"
                          >
                            <div className="flex justify-between text-[#7B695F]">
                              <span>{msg.tripTitle ? `🗺️ ${msg.tripTitle}` : '💬 หลังไมค์'}</span>
                              <span>
                                {new Date(msg.createdAt).toLocaleString(
                                  lang === 'th' ? 'th-TH' : 'en-US'
                                )}
                              </span>
                            </div>
                            <div className="text-[#3D322C] font-medium whitespace-pre-line">
                              {msg.message}
                            </div>
                            {msg.staffReply ? (
                              <div className="rounded-lg bg-[#D4F0F0]/65 p-2 text-[#214F4B]">
                                <span className="font-bold">↩️ {msg.staffReplyBy}: </span>
                                {msg.staffReply}
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#9B897E]">
                                {msg.readByStaff
                                  ? lang === 'th'
                                    ? '✓ พี่เลี้ยงอ่านแล้ว'
                                    : '✓ Seen by Staff'
                                  : lang === 'th'
                                  ? '⏳ รอพี่เลี้ยงเปิดอ่าน'
                                  : '⏳ Waiting for Staff'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 12. HOUSE ANNOUNCEMENTS MODAL */}
            {subModal === 'announcements_modal' && (
              <div className="space-y-3">
                <HolidayCheckInNoticeCard lang={lang} variant="announcement" defaultExpanded />

                {/* Live Time, Event & Festival Announcement Card */}
                <div
                  className={`rounded-2xl border-2 p-4 space-y-2 ${
                    dynamicEventAnnouncement.isFestival
                      ? 'border-[#E6B8D0]'
                      : 'border-[#96C3E6] bg-[#EFF7FF]'
                  }`}
                  style={
                    dynamicEventAnnouncement.isFestival && activeFestival
                      ? { background: activeFestival.bannerGradient }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-lg bg-white/85 border border-[#E5DAD0] px-2.5 py-0.5 text-[11px] font-extrabold text-[#3D322C]">
                      {lang === 'th' ? dynamicEventAnnouncement.badgeTh : dynamicEventAnnouncement.badgeEn}
                    </span>
                    <span className="text-[11px] font-bold text-[#5E4E45]">
                      ⏰ {lang === 'th' ? dynamicEventAnnouncement.windowLabelTh : dynamicEventAnnouncement.windowLabelEn}
                    </span>
                  </div>
                  <div className="font-extrabold text-base text-[#3D322C]">
                    {lang === 'th' ? dynamicEventAnnouncement.titleTh : dynamicEventAnnouncement.titleEn}
                  </div>
                  <p className="text-sm text-[#4E3F38] whitespace-pre-line leading-relaxed">
                    {lang === 'th' ? dynamicEventAnnouncement.bodyTh : dynamicEventAnnouncement.bodyEn}
                  </p>
                  {activeFestival && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleOutfitMode('festival', activeFestival.defaultOutfitId);
                          setSubModal(null);
                        }}
                        className="min-h-[36px] rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        {activeFestival.emoji} {lang === 'th' ? `ใส่ชุด${activeFestival.nameTh}ทันที` : `Wear ${activeFestival.nameEn}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShopFilter('festival');
                          setSubModal('shop_modal');
                        }}
                        className="min-h-[36px] rounded-xl bg-white hover:bg-[#FAF5EF] border border-[#E5DAD0] text-[#3D322C] px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                      >
                        🎁 {lang === 'th' ? 'ดูไอเทมเทศกาล' : 'View Festival Items'}
                      </button>
                    </div>
                  )}
                </div>

                {sortedAnnouncements.length === 0 ? (
                  <p className="text-sm text-[#7B695F] text-center py-4">
                    {lang === 'th' ? 'ยังไม่มีประกาศเพิ่มเติมจากพี่เลี้ยงในเวลานี้' : 'No additional staff announcements right now.'}
                  </p>
                ) : (
                  sortedAnnouncements.map((ann) => (
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
                      {ann.imageBase64 && (
                        <img
                          src={ann.imageBase64}
                          alt={ann.title}
                          referrerPolicy="no-referrer"
                          className="max-h-72 w-auto rounded-2xl border border-[#EBD8C3] object-contain bg-white"
                        />
                      )}
                      {(ann.startAt || ann.endAt) && (
                        <div className="text-[11px] font-semibold text-[#456D8F]">
                          🗓️ {ann.startAt ? new Date(ann.startAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US') : '—'} →{' '}
                          {ann.endAt ? new Date(ann.endAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US') : '—'}
                        </div>
                      )}
                      <div className="text-xs text-[#7B695F] pt-1">
                        {ann.authorName} ·{' '}
                        {new Date(ann.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                        {ann.updatedAt
                          ? ` · (${lang === 'th' ? 'แก้ไขแล้ว' : 'Edited'})`
                          : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 13. HEALTH & ALLERGY CARD MODAL */}
            {subModal === 'health_card' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#FADADD]/45 border border-[#F5C5CF] p-3.5 text-xs text-[#5E2832]">
                  🩺{' '}
                  {lang === 'th'
                    ? 'ข้อมูลสุขภาพและประวัติการแพ้อาหาร/แพ้ยา จะถูกแจ้งเตือนให้แม่ครัวและพี่เลี้ยงเห็นเพื่อความปลอดภัยของหนูค่ะ'
                    : 'Allergy info is shared with Kitchen Chefs and Caretakers for your safety.'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-bold text-[#3D322C] mb-1">
                      🩸 {lang === 'th' ? 'กรุ๊ปเลือด' : 'Blood Type'}
                    </label>
                    <select
                      value={healthForm.bloodType}
                      onChange={(e) => setHealthForm((p) => ({ ...p, bloodType: e.target.value }))}
                      className="w-full rounded-xl border-2 border-[#EBD8C3] bg-white px-3 py-2 text-sm"
                    >
                      {['ไม่ระบุ', 'A', 'B', 'AB', 'O'].map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3D322C] mb-1">
                      🍽️ {lang === 'th' ? 'อาหารที่แพ้ (แม่ครัวจะเห็นคำเตือน)' : 'Food Allergies'}
                    </label>
                    <input
                      type="text"
                      value={healthForm.foodAllergies}
                      onChange={(e) => setHealthForm((p) => ({ ...p, foodAllergies: e.target.value }))}
                      placeholder="เช่น กุ้ง ถั่วลิสง นมวัว หรือ ไม่มี"
                      className="w-full rounded-xl border-2 border-[#EBD8C3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3D322C] mb-1">
                      💊 {lang === 'th' ? 'ยาที่แพ้' : 'Drug Allergies'}
                    </label>
                    <input
                      type="text"
                      value={healthForm.drugAllergies}
                      onChange={(e) => setHealthForm((p) => ({ ...p, drugAllergies: e.target.value }))}
                      placeholder="เช่น ยาเพนิซิลลิน หรือ ไม่มี"
                      className="w-full rounded-xl border-2 border-[#EBD8C3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#3D322C] mb-1">
                      🏥 {lang === 'th' ? 'โรคประจำตัว' : 'Chronic Conditions'}
                    </label>
                    <input
                      type="text"
                      value={healthForm.chronicConditions}
                      onChange={(e) => setHealthForm((p) => ({ ...p, chronicConditions: e.target.value }))}
                      placeholder="เช่น หอบหืด หรือ ไม่มี"
                      className="w-full rounded-xl border-2 border-[#EBD8C3] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#3D322C] mb-1">
                    💉 {lang === 'th' ? 'ยาประจำตัว / หมายเหตุฉุกเฉิน' : 'Regular Meds & Emergency Note'}
                  </label>
                  <input
                    type="text"
                    value={healthForm.regularMeds}
                    onChange={(e) => setHealthForm((p) => ({ ...p, regularMeds: e.target.value }))}
                    placeholder="เช่น ยาพ่นจมูก หรือ ไม่มี"
                    className="w-full rounded-xl border-2 border-[#EBD8C3] bg-white px-3 py-2 text-sm mb-2"
                  />
                  <input
                    type="text"
                    value={healthForm.emergencyNote}
                    onChange={(e) => setHealthForm((p) => ({ ...p, emergencyNote: e.target.value }))}
                    placeholder={lang === 'th' ? 'เบอร์ผู้ปกครอง / โรงพยาบาลประจำตัว...' : 'Emergency notes...'}
                    className="w-full rounded-xl border-2 border-[#EBD8C3] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateKid(kid.id, (prev) => ({ ...prev, healthProfile: healthForm }), 'Update Kid Health Card');
                    setSubModal(null);
                    onShowAlert({
                      icon: '🩺💖',
                      title: lang === 'th' ? 'บันทึกบัตรข้อมูลสุขภาพแล้ว!' : 'Health Card Saved!',
                      message: lang === 'th' ? 'อัปเดตประวัติการแพ้และข้อมูลสุขภาพให้พี่เลี้ยงและแม่ครัวทราบแล้วค่ะ' : 'Updated for Staff & Chefs!',
                      tone: 'mint',
                    });
                  }}
                  className="w-full min-h-[48px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white font-bold cursor-pointer"
                >
                  💾 {lang === 'th' ? 'บันทึกบัตรข้อมูลสุขภาพ' : 'Save Health Card'}
                </button>
              </div>
            )}

            {/* 14. SUPPLIES & STUDY WISHLIST MODAL */}
            {subModal === 'supply_wishlist' && (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-[#BEDBF0] bg-[#F5FAFE] p-4 space-y-3">
                  <div className="font-bold text-sm text-[#3D322C]">
                    📦 {lang === 'th' ? 'เขียนคำขอเบิกของใช้จำเป็น / อุปกรณ์การเรียน' : 'Submit Essential Supply Request'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={supplyName}
                      onChange={(e) => setSupplyName(e.target.value)}
                      placeholder={lang === 'th' ? 'สิ่งของที่ขอ เช่น แปรงสีฟัน สมุด ปากกา...' : 'Item name...'}
                      className="rounded-xl border border-[#BEDBF0] bg-white px-3 py-2 text-sm"
                    />
                    <select
                      value={supplyCat}
                      onChange={(e) => setSupplyCat(e.target.value as SupplyRequest['category'])}
                      className="rounded-xl border border-[#BEDBF0] bg-white px-3 py-2 text-sm"
                    >
                      <option value="hygiene">🪥 ของใช้ส่วนตัว (สบู่/ยาสีฟัน/แชมพู)</option>
                      <option value="study">✏️ อุปกรณ์การเรียน (สมุด/ปากกา/สี)</option>
                      <option value="uniform">👔 ชุดนักเรียน / ถุงเท้า / รองเท้า</option>
                      <option value="other">📦 อื่นๆ</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setSupplyUrgency((u) => (u === 'normal' ? 'urgent' : 'normal'))}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold border cursor-pointer ${
                        supplyUrgency === 'urgent'
                          ? 'bg-[#FADADD] border-[#E66C84] text-[#6B2D39]'
                          : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                      }`}
                    >
                      {supplyUrgency === 'urgent' ? '🚨 ด่วนมาก (หมดแล้ว)' : '⏳ ปกติ'}
                    </button>
                    <input
                      type="text"
                      value={supplyNote}
                      onChange={(e) => setSupplyNote(e.target.value)}
                      placeholder={lang === 'th' ? 'หมายเหตุเพิ่มเติม (ถ้ามี)...' : 'Note (optional)...'}
                      className="flex-1 min-w-[180px] rounded-xl border border-[#BEDBF0] bg-white px-3 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!supplyName.trim()) return;
                      onSubmitSupplyRequest({
                        id: `sup_${Date.now()}`,
                        kidId: kid.id,
                        kidNickname: kid.nickname,
                        itemName: supplyName.trim(),
                        category: supplyCat,
                        urgency: supplyUrgency,
                        note: supplyNote.trim() || '-',
                        status: 'pending',
                        createdAt: now.toISOString(),
                      });
                      setSupplyName('');
                      setSupplyNote('');
                      onShowAlert({
                        icon: '📦✨',
                        title: lang === 'th' ? 'ส่งคำขอเบิกของใช้แล้ว!' : 'Supply Request Sent!',
                        message: lang === 'th' ? 'ส่งเรื่องถึงพี่เลี้ยงและผู้จัดการเรียบร้อย รอติดตามสถานะด้านล่างได้เลย' : 'Sent to Caretakers for review.',
                        tone: 'blue',
                      });
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-[#3D322C] text-white text-sm font-bold cursor-pointer"
                  >
                    📤 {lang === 'th' ? 'ส่งคำขอเบิกถึงพี่เลี้ยง' : 'Submit Request'}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#3D322C]">
                    📋 {lang === 'th' ? `ประวัติคำขอเบิกของฉัน (${mySupplyRequests.length})` : `My Requests (${mySupplyRequests.length})`}
                  </div>
                  {mySupplyRequests.length === 0 ? (
                    <p className="text-xs text-[#7B695F]">{lang === 'th' ? 'ยังไม่มีรายการขอเบิก' : 'No requests yet.'}</p>
                  ) : (
                    mySupplyRequests.map((r) => (
                      <div key={r.id} className="rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="font-bold text-[#3D322C]">
                            {r.urgency === 'urgent' ? '🚨 ' : ''}{r.itemName}
                          </div>
                          <div className="text-[#7B695F]">{r.note}</div>
                        </div>
                        <span className={`rounded-lg px-2.5 py-1 font-bold ${
                          r.status === 'delivered'
                            ? 'bg-[#D4F0F0] text-[#214F4B]'
                            : r.status === 'approved'
                            ? 'bg-[#FFF5BA] text-[#6B5412]'
                            : 'bg-[#FAF2E8] text-[#6E5C52]'
                        }`}>
                          {r.status === 'delivered' ? '🎉 ได้รับของแล้ว' : r.status === 'approved' ? '✅ พี่เลี้ยงอนุมัติแล้ว' : '⏳ รอตรวจ'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 15. LOST & FOUND MODAL */}
            {subModal === 'lost_found_modal' && (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-[#F4DB73] bg-[#FFFDF0] p-4 space-y-2.5">
                  <div className="font-bold text-sm text-[#3D322C]">
                    🔎 {lang === 'th' ? 'ประกาศของหาย หรือ เก็บของได้ในบ้าน Barnhem' : 'Post Lost or Found Item'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLfStatus('lost')}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold border-2 cursor-pointer ${
                        lfStatus === 'lost' ? 'bg-[#FADADD] border-[#E66C84] text-[#6B2D39]' : 'bg-white border-[#EBD8C3]'
                      }`}
                    >
                      ❓ {lang === 'th' ? 'ของหนูหาย' : 'I Lost Something'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLfStatus('found')}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold border-2 cursor-pointer ${
                        lfStatus === 'found' ? 'bg-[#D4F0F0] border-[#7CC6B8] text-[#214F4B]' : 'bg-white border-[#EBD8C3]'
                      }`}
                    >
                      ✨ {lang === 'th' ? 'เก็บของเพื่อนได้' : 'I Found Something'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={lfTitle}
                      onChange={(e) => setLfTitle(e.target.value)}
                      placeholder={lang === 'th' ? 'ชื่อสิ่งของ เช่น ขวดน้ำสีฟ้า เสื้อพละ...' : 'Item name...'}
                      className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={lfLocation}
                      onChange={(e) => setLfLocation(e.target.value)}
                      placeholder={lang === 'th' ? 'บริเวณที่พบ/หาย เช่น โต๊ะทำการบ้าน...' : 'Location...'}
                      className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={lfDesc}
                    onChange={(e) => setLfDesc(e.target.value)}
                    placeholder={lang === 'th' ? 'จุดสังเกตเพิ่มเติม...' : 'Details...'}
                    className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="rounded-xl border border-[#EBD8C3] bg-white hover:bg-[#FFF5BA]/50 px-3 py-2 text-xs font-bold cursor-pointer">
                      📷 {lang === 'th' ? 'แนบรูปภาพ (ถ้ามี)' : 'Attach Photo'}
                      <input type="file" accept="image/*" onChange={handleLfPhotoUpload} className="hidden" />
                    </label>
                    {lfPhotoBase64 && (
                      <img src={lfPhotoBase64} alt="Preview" className="h-10 w-10 rounded-lg object-cover border" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!lfTitle.trim()) return;
                        onAddLostFound({
                          id: `lf_${Date.now()}`,
                          title: lfTitle.trim(),
                          description: lfDesc.trim() || '-',
                          locationFound: lfLocation.trim() || 'บ้าน Barnhem',
                          status: lfStatus,
                          photoBase64: lfPhotoBase64,
                          postedByName: `น้อง${kid.nickname}`,
                          postedByRole: 'kid',
                          createdAt: now.toISOString(),
                        });
                        setLfTitle('');
                        setLfDesc('');
                        setLfLocation('');
                        setLfPhotoBase64(undefined);
                      }}
                      className="ml-auto rounded-xl bg-[#3D322C] text-white px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                      📢 {lang === 'th' ? 'โพสต์แจ้งทันที' : 'Post Now'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lostFoundItems.length === 0 ? (
                    <p className="text-xs text-[#7B695F] text-center py-4">{lang === 'th' ? 'ยังไม่มีรายการของหายในตอนนี้' : 'No lost & found items.'}</p>
                  ) : (
                    lostFoundItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#EBD8C3] bg-white p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.photoBase64 && (
                            <img src={item.photoBase64} alt={item.title} className="h-12 w-12 rounded-lg object-cover border shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-[#3D322C]">
                              {item.status === 'claimed' ? '✅ ' : item.status === 'found' ? '✨ [เจอของ] ' : '❓ [ตามหา] '}
                              {item.title}
                            </div>
                            <div className="text-[#6E5C52]">
                              📍 {item.locationFound} · โพสต์โดย {item.postedByName}
                            </div>
                            {item.claimedByNickname && (
                              <div className="text-[#2F685E] font-bold">
                                🙋‍♀️ {item.claimedByNickname} กดแสดงตัวว่าเป็นเจ้าของแล้ว
                              </div>
                            )}
                          </div>
                        </div>
                        {item.status !== 'claimed' && (
                          <button
                            type="button"
                            onClick={() => {
                              onClaimLostFound(item.id, kid);
                              onShowAlert({
                                icon: '🙋',
                                title: lang === 'th' ? 'แจ้งรับของคืนแล้ว!' : 'Claim Submitted!',
                                message: lang === 'th' ? `บันทึกชื่อน้อง${kid.nickname} ว่าเป็นเจ้าของ "${item.title}" แล้ว ติดต่อรับที่พี่เลี้ยงได้เลย` : 'Claim recorded! Please pick up from Staff.',
                                tone: 'mint',
                              });
                            }}
                            className="rounded-xl bg-[#D4F0F0] hover:bg-[#BDE6E6] text-[#214F4B] px-3 py-1.5 font-bold cursor-pointer"
                          >
                            🙋 {lang === 'th' ? 'ของหนูเอง!' : 'Mine!'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 16. KINDNESS CARDS & GOOD-DEED FINE REDEMPTION MODAL */}
            {subModal === 'kindness_deed_modal' && (
              <div className="space-y-5">
                {/* Good-Deed Fine Redemption Section */}
                <div className="rounded-2xl border-2 border-[#F5C5CF] bg-[#FFF8FA] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-sm text-[#3D322C]">
                      ⚖️ {lang === 'th' ? 'กิจกรรมไถ่ค่าปรับด้วยความดี' : 'Good-Deed Fine Redemption'}
                    </div>
                    {coinsEnabled && (
                      <span className="text-xs font-bold text-[#B84A39] tabular-nums">
                        💸 {lang === 'th' ? `ค่าปรับค้าง: ฿${kid.penalty.lateFineThb}` : `Fine: ฿${kid.penalty.lateFineThb}`}
                      </span>
                    )}
                  </div>
                  {myDeedRedemptions.length === 0 ? (
                    <p className="text-xs text-[#7B695F]">
                      {lang === 'th'
                        ? 'ยังไม่มีภารกิจไถ่ค่าปรับที่พี่เลี้ยงมอบหมายในตอนนี้ (ถ้ามีค่าปรับ สามารถขอให้พี่เลี้ยงช่วยมอบหมายงานความดีเพื่อหักค่าปรับได้ค่ะ)'
                        : 'No good-deed tasks assigned yet.'}
                    </p>
                  ) : (
                    myDeedRedemptions.map((deed) => (
                      <div key={deed.id} className="rounded-xl border border-[#F5C5CF] bg-white p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="font-bold text-[#3D322C]">🌱 {deed.deedTitle}</div>
                          <div className="text-[#2F685E] font-semibold">
                            ลดค่าปรับ ฿{deed.fineReductionThb} {deed.starsBonus > 0 ? `· +${deed.starsBonus} ⭐` : ''} (โดย {deed.assignedBy})
                          </div>
                        </div>
                        {deed.status === 'assigned' ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSubmitDeedRedemption(deed.id);
                              onShowAlert({
                                icon: '🌱✅',
                                title: lang === 'th' ? 'ส่งตรวจความดีแล้ว!' : 'Submitted for Review!',
                                message: lang === 'th' ? 'พี่เลี้ยงได้รับแจ้งแล้ว เมื่อพี่เลี้ยงกดยืนยัน ค่าปรับจะลดลงอัตโนมัติค่ะ' : 'Staff will verify and reduce your fine!',
                                tone: 'mint',
                              });
                            }}
                            className="rounded-xl bg-[#3D322C] text-white px-3 py-1.5 font-bold cursor-pointer"
                          >
                            ✅ {lang === 'th' ? 'ทำความดีเสร็จแล้ว (ส่งตรวจ)' : 'Mark Done'}
                          </button>
                        ) : (
                          <span className={`rounded-lg px-2.5 py-1 font-bold ${
                            deed.status === 'approved' ? 'bg-[#D4F0F0] text-[#214F4B]' : 'bg-[#FFF5BA] text-[#6B5412]'
                          }`}>
                            {deed.status === 'approved' ? '🎉 อนุมัติลดค่าปรับแล้ว' : '⏳ รอพี่เลี้ยงตรวจ'}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Kindness Shout-Out Section */}
                <div className="rounded-2xl border-2 border-[#D4C7EA] bg-[#FAF7FD] p-4 space-y-3">
                  <div className="font-bold text-sm text-[#3D322C]">
                    💛 {lang === 'th' ? 'ส่งการ์ดขอบคุณ / ชมเพื่อนหรือพี่เลี้ยง (วันละ 1 ใบ · รับ +2 ⭐ ทั้งคู่)' : 'Kindness Card (1/day · +2 ⭐ each)'}
                  </div>
                  {hasSentKindnessToday ? (
                    <div className="rounded-xl bg-[#D4F0F0] p-3 text-xs font-bold text-[#214F4B]">
                      ✅ {lang === 'th' ? 'วันนี้ส่งการ์ดขอบคุณเรียบร้อยแล้ว! พรุ่งนี้มาส่งความสุขต่อได้อีกนะ' : 'Already sent your kindness card today! Come back tomorrow.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={kindTargetId}
                        onChange={(e) => setKindTargetId(e.target.value)}
                        className="w-full rounded-xl border border-[#D4C7EA] bg-white px-3 py-2 text-xs"
                      >
                        <option value="">{lang === 'th' ? '-- เลือกเพื่อน หรือ พี่เลี้ยงที่อยากขอบคุณ --' : '-- Choose Recipient --'}</option>
                        {allMembers
                          .filter((m) => m.id !== kid.id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.emoji} {m.nickname} ({m.role === 'kid' ? 'เพื่อน' : m.role === 'chef' ? 'แม่ครัว' : 'พี่เลี้ยง'})
                            </option>
                          ))}
                      </select>
                      <input
                        type="text"
                        value={kindMessage}
                        onChange={(e) => setKindMessage(e.target.value)}
                        placeholder={lang === 'th' ? 'พิมพ์คำขอบคุณ เช่น ขอบคุณที่ช่วยสอนการบ้านวันนี้จ้า...' : 'Write a kind note...'}
                        className="w-full rounded-xl border border-[#D4C7EA] bg-white px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!kindTargetId || !kindMessage.trim()) return;
                          const target = allMembers.find((m) => m.id === kindTargetId);
                          if (!target) return;
                          onSendKindnessCard({
                            id: `kind_${Date.now()}`,
                            fromKidId: kid.id,
                            fromNickname: kid.nickname,
                            toMemberId: target.id,
                            toNickname: target.nickname,
                            message: kindMessage.trim(),
                            dateKey: todayKey,
                            createdAt: now.toISOString(),
                          });
                          setKindTargetId('');
                          setKindMessage('');
                          onShowAlert({
                            icon: '💛✨',
                            title: lang === 'th' ? `ส่งการ์ดขอบคุณให้ ${target.nickname} แล้ว! (+2 ⭐)` : 'Kindness Card Sent! (+2 ⭐)',
                            message: lang === 'th' ? 'ความมีน้ำใจทำให้บ้าน Barnhem อบอุ่นขึ้นมากๆ รับไปเลย +2 ⭐' : 'Kindness makes Barnhem brighter! +2 ⭐ earned.',
                            tone: 'lavender',
                          });
                        }}
                        className="w-full min-h-[42px] rounded-xl bg-[#3D322C] text-white text-xs font-bold cursor-pointer"
                      >
                        💌 {lang === 'th' ? 'ส่งการ์ดความดี & รับ +2 ⭐' : 'Send Kindness Card (+2 ⭐)'}
                      </button>
                    </div>
                  )}

                  {kindnessCards.length > 0 && (
                    <div className="pt-2 border-t border-[#E6DCF2] space-y-2 max-h-48 overflow-y-auto">
                      <div className="text-xs font-bold text-[#4A3E63]">
                        🌸 {lang === 'th' ? 'กำแพงคำขอบคุณบ้าน Barnhem ล่าสุด' : 'Barnhem Kindness Wall'}
                      </div>
                      {kindnessCards.slice(0, 12).map((c) => (
                        <div key={c.id} className="rounded-xl border border-[#E6DCF2] bg-white p-2.5 text-xs">
                          <div className="font-bold text-[#4A3E63]">
                            💛 {c.fromNickname} ➔ {c.toNickname}
                          </div>
                          <div className="text-[#3D322C] mt-0.5">{c.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 17. FRIEND HOME VISIT & SIDE-BY-SIDE PROFILE HANGOUT */}
            {subModal === 'friend_visit_modal' && (() => {
              const visitActivityOptions = [
                { id: 'study', emoji: '📚', th: 'ติวหนังสือ', withTh: 'ติวหนังสือด้วยกัน', en: 'Study', withEn: 'Studying' },
                { id: 'travel', emoji: '🎒', th: 'ไปเที่ยวเล่น', withTh: 'ไปเที่ยวเล่นด้วยกัน', en: 'Play & Outing', withEn: 'Hanging Out' },
                { id: 'eat', emoji: '🍚', th: 'กินข้าว', withTh: 'กินข้าวด้วยกัน', en: 'Eat', withEn: 'Eating' },
                { id: 'cycling', emoji: '🚲', th: 'ปั่นจักรยาน', withTh: 'ปั่นจักรยานด้วยกัน', en: 'Cycling', withEn: 'Cycling' },
                { id: 'football', emoji: '⚽', th: 'ไปเตะฟุตบอล', withTh: 'ไปเตะฟุตบอลด้วยกัน', en: 'Football', withEn: 'Playing Football' },
                { id: 'volleyball', emoji: '🏐', th: 'ไปเล่นวอลเลย์บอล', withTh: 'ไปเล่นวอลเลย์บอลด้วยกัน', en: 'Volleyball', withEn: 'Playing Volleyball' },
              ] as const;
              const getActInfo = (id: string) =>
                visitActivityOptions.find((a) => a.id === id) ?? visitActivityOptions[0];

              return (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#D4F0F0] bg-[#D4F0F0]/60 p-3.5 text-xs text-[#214F4B] leading-relaxed">
                  {lang === 'th'
                    ? '🤝 ส่งคำขอไปบ้านเพื่อนเพื่อยืนข้างกันในหน้าปกได้เลย! เลือกชวนทำกิจกรรมสนุกๆ ได้ 6 แบบ (ติวหนังสือ / ไปเที่ยวเล่น / กินข้าว / ปั่นจักรยาน / เตะฟุตบอล / เล่นวอลเลย์บอล) หากเพื่อนยังไม่สะดวกก็กดผ่านได้ ไม่เป็นไรเลยค่ะ'
                    : '🤝 Invite a friend to hang out side-by-side! Choose Study, Play & Outing, Eat, Cycling, Football, or Volleyball.'}
                </div>

                {/* Active Side-by-Side Hangout Banner */}
                {activeAcceptedVisit && visitingBuddy && (() => {
                  const activeAct = getActInfo(visitingBuddy.activity);
                  return (
                  <div className="rounded-2xl border-2 border-[#7CC6B8] bg-[#EFFAF8] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-sm text-[#214F4B]">
                        ✨ {lang === 'th' ? 'กำลังยืนคู่กันบนหน้าปกโปรไฟล์!' : 'Currently Hanging Out Together!'}
                      </div>
                      <span className="rounded-full bg-white border border-[#9CD6CE] px-3 py-0.5 text-xs font-bold text-[#214F4B]">
                        {activeAct.emoji} {lang === 'th' ? activeAct.withTh : activeAct.withEn}
                      </span>
                    </div>
                    <div className="text-xs text-[#2E524E]">
                      {visitingBuddy.isHost
                        ? lang === 'th'
                          ? `🏠 ${visitingBuddy.member.emoji} น้อง${visitingBuddy.member.nickname} มาเยี่ยมบ้านหนูอยู่ตอนนี้`
                          : `🏠 Hosting ${visitingBuddy.member.nickname}`
                        : lang === 'th'
                        ? `🏠 หนูกำลังไปบ้าน ${visitingBuddy.member.emoji} น้อง${visitingBuddy.member.nickname}`
                        : `🏠 Visiting ${visitingBuddy.member.nickname}`}
                    </div>
                    {activeAcceptedVisit.note && (
                      <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-[#5E4E45]">
                        💬 “{activeAcceptedVisit.note}”
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onRespondFriendVisit(activeAcceptedVisit.id, 'ended');
                        onShowAlert({
                          icon: '👋💛',
                          title: lang === 'th' ? 'แยกย้ายกลับบ้านเรียบร้อย' : 'Hangout Ended',
                          message: lang === 'th' ? 'ไว้ชวนเพื่อนมาเจอกันใหม่นะ!' : 'Invite friends again anytime!',
                          tone: 'mint',
                        });
                      }}
                      className="w-full min-h-[40px] rounded-xl bg-white border border-[#9CD6CE] hover:bg-[#D4F0F0] text-xs font-bold text-[#214F4B] cursor-pointer"
                    >
                      👋 {lang === 'th' ? 'จบกิจกรรม / แยกย้ายกลับบ้าน' : 'Finish Hangout / Leave'}
                    </button>
                  </div>
                  );
                })()}

                {/* Incoming Invitations for Me */}
                <div className="space-y-2.5">
                  <div className="font-bold text-sm text-[#3D322C]">
                    💌 {lang === 'th' ? `คำขอมาบ้านหนู (${incomingPendingVisits.length})` : `Incoming Visit Invites (${incomingPendingVisits.length})`}
                  </div>
                  {incomingPendingVisits.length === 0 ? (
                    <p className="text-xs text-[#7B695F]">
                      {lang === 'th' ? 'ยังไม่มีคำขอมาบ้านที่รอตอบรับในตอนนี้' : 'No pending invites right now.'}
                    </p>
                  ) : (
                    incomingPendingVisits.map((v) => {
                      const actInfo = getActInfo(v.activity);
                      const actLabel = `${actInfo.emoji} ${lang === 'th' ? actInfo.th : actInfo.en}`;
                      return (
                        <div
                          key={v.id}
                          className="rounded-2xl border-2 border-[#F4B6C2] bg-gradient-to-br from-[#FFFDF9] to-[#FFF2F5] p-4 space-y-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-[#3D322C]">
                              {v.fromKidEmoji} น้อง{v.fromKidNickname} ขอมาบ้าน!
                            </span>
                            <span className="rounded-full bg-[#FFE9A6] border border-[#F0D175] px-3 py-0.5 text-xs font-bold text-[#6B4800]">
                              {actLabel}
                            </span>
                          </div>
                          {v.note && (
                            <p className="text-xs text-[#5E4E45] bg-white/90 border border-[#F5DCE1] rounded-xl px-3 py-1.5">
                              💬 “{v.note}”
                            </p>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                onRespondFriendVisit(v.id, 'accepted');
                                onShowAlert({
                                  icon: '🏠🎉',
                                  title: lang === 'th' ? 'ต้อนรับเพื่อนเข้าบ้านแล้ว!' : 'Visit Accepted!',
                                  message:
                                    lang === 'th'
                                      ? `ตอนนี้น้อง${v.fromKidNickname} มายืนข้างหนูบนหน้าปกแล้ว (${actLabel})`
                                      : `${v.fromKidNickname} is now standing beside you on your profile!`,
                                  tone: 'mint',
                                });
                              }}
                              className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#28A890] to-[#3CC2A6] hover:brightness-105 text-white text-xs font-bold px-4 py-2 shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                            >
                              🤝 {lang === 'th' ? 'ต้อนรับเพื่อน (ยืนข้างกัน)' : 'Welcome Friend'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onRespondFriendVisit(v.id, 'declined');
                                onShowAlert({
                                  icon: '🤍',
                                  title: lang === 'th' ? 'ตอบกลับอย่างสุภาพแล้ว' : 'Declined Politely',
                                  message:
                                    lang === 'th'
                                      ? 'ไม่เป็นไรเลย ไว้ชวนกันวันอื่นที่สะดวกนะ'
                                      : 'No worries at all — maybe next time!',
                                  tone: 'lavender',
                                });
                              }}
                              className="min-h-[42px] rounded-xl bg-white hover:bg-[#FAF5EF] border border-[#E5DAD0] text-[#7A6A60] text-xs font-bold px-3 py-2 cursor-pointer"
                            >
                              🤍 {lang === 'th' ? 'ยังไม่สะดวก (ไม่เป็นไร)' : 'Not Today (No Worries)'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Send a Visit Request to a Friend */}
                <div className="rounded-2xl border border-[#DCEEF8] bg-[#F8FBFE] p-4 space-y-3">
                  <div className="font-bold text-sm text-[#28445A]">
                    🏠 {lang === 'th' ? 'ส่งคำขอไปบ้านเพื่อน' : 'Send a Visit Request'}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4D3E36] mb-1.5">
                      {lang === 'th' ? '1. เลือกบ้านเพื่อนที่อยากไป:' : '1. Choose a friend to visit:'}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                      {kidsList
                        .filter((m) => m.id !== kid.id)
                        .map((friend) => {
                          const selected = visitTargetKidId === friend.id;
                          return (
                            <button
                              key={friend.id}
                              type="button"
                              onClick={() => setVisitTargetKidId(friend.id)}
                              className={`rounded-xl border px-3 py-2 text-left text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                                selected
                                  ? 'border-[#28A890] bg-[#E8FAF5] text-[#1A574D]'
                                  : 'border-[#DCEEF8] bg-white hover:bg-[#F3F8FC] text-[#3D322C]'
                              }`}
                            >
                              <span className="text-base">{friend.emoji}</span>
                              <span className="truncate">{friend.nickname}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4D3E36] mb-1.5">
                      {lang === 'th' ? '2. เลือกกิจกรรมที่อยากชวนทำ:' : '2. Choose activity:'}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {visitActivityOptions.map((act) => {
                        const active = visitActivity === act.id;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => setVisitActivity(act.id)}
                            className={`min-h-[56px] rounded-xl border-2 px-2.5 py-2 text-center text-xs font-bold cursor-pointer transition-colors ${
                              active
                                ? 'border-[#E66C85] bg-[#FFF0F3] text-[#942C44]'
                                : 'border-[#E8DDD3] bg-white hover:bg-[#FAF6F1] text-[#5E4E45]'
                            }`}
                          >
                            <div className="text-lg mb-0.5">{act.emoji}</div>
                            <div className="truncate">{lang === 'th' ? act.th : act.en}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <input
                    type="text"
                    maxLength={80}
                    value={visitNote}
                    onChange={(e) => setVisitNote(e.target.value)}
                    placeholder={
                      lang === 'th'
                        ? 'ข้อความทักทายสั้นๆ (ไม่ใส่ก็ได้ เช่น ไปปั่นจักรยานหรือเตะบอลกันนะ)'
                        : 'Optional friendly note (e.g. Let’s go cycling!)'
                    }
                    className="w-full rounded-xl border border-[#BEDBF0] bg-white px-3 py-2 text-xs"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const target = kidsList.find((m) => m.id === visitTargetKidId);
                      if (!target) {
                        onShowAlert({
                          icon: '🏠',
                          title: lang === 'th' ? 'กรุณาเลือกเพื่อนก่อนส่งคำขอ' : 'Select a Friend',
                          message: lang === 'th' ? 'แตะเลือกชื่อเพื่อนที่อยากขอไปบ้านด้านบนนะ' : 'Please tap a friend above first.',
                          tone: 'yellow',
                        });
                        return;
                      }
                      onSendFriendVisitRequest({
                        id: `visit_${Date.now()}`,
                        fromKidId: kid.id,
                        fromKidNickname: kid.nickname,
                        fromKidEmoji: kid.emoji,
                        toKidId: target.id,
                        toKidNickname: target.nickname,
                        toKidEmoji: target.emoji,
                        activity: visitActivity,
                        note: visitNote.trim() || undefined,
                        status: 'pending',
                        dateKey: todayKey,
                        createdAt: now.toISOString(),
                      });
                      setVisitNote('');
                      setVisitTargetKidId('');
                      onShowAlert({
                        icon: '💌✨',
                        title: lang === 'th' ? `ส่งคำขอไปบ้าน ${target.nickname} แล้ว!` : `Invite Sent to ${target.nickname}!`,
                        message:
                          lang === 'th'
                            ? `รอให้น้อง${target.nickname} กดตอบรับก่อนนะ (ถ้าเพื่อนยังไม่สะดวกก็ไม่เป็นไรเลยค่ะ)`
                            : `Waiting for ${target.nickname} to reply — no worries if busy!`,
                        tone: 'mint',
                      });
                    }}
                    className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#E66C85] to-[#F38C9F] hover:brightness-105 text-white text-xs font-bold shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                  >
                    💌 {lang === 'th' ? 'ส่งคำขอไปบ้านเพื่อน' : 'Send Home Visit Request'}
                  </button>
                </div>

                {/* Sent Requests History */}
                {mySentVisits.length > 0 && (
                  <div className="space-y-2 border-t border-[#EBD8C3] pt-3">
                    <div className="text-xs font-bold text-[#6E5C52]">
                      📤 {lang === 'th' ? 'คำขอที่หนูเคยส่งไป' : 'Sent Visit Requests'}
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {mySentVisits.slice(0, 8).map((v) => {
                        const actInfo = getActInfo(v.activity);
                        return (
                          <div
                            key={v.id}
                            className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                          >
                            <span className="font-semibold text-[#3D322C]">
                              {actInfo.emoji} {lang === 'th' ? actInfo.th : actInfo.en} · บ้าน {v.toKidEmoji} {v.toKidNickname}
                            </span>
                            <span
                              className={`rounded-lg px-2 py-0.5 font-bold text-[11px] ${
                                v.status === 'accepted'
                                  ? 'bg-[#D4F0F0] text-[#214F4B]'
                                  : v.status === 'pending'
                                  ? 'bg-[#FFF5BA] text-[#6B4800]'
                                  : 'bg-[#F4ECE4] text-[#6E5C52]'
                              }`}
                            >
                              {v.status === 'accepted'
                                ? lang === 'th'
                                  ? '✅ ตอบรับแล้ว (ยืนข้างกัน)'
                                  : '✅ Accepted'
                                : v.status === 'pending'
                                ? lang === 'th'
                                  ? '⏳ รอเพื่อนตอบรับ'
                                  : '⏳ Pending'
                                : v.status === 'declined'
                                ? lang === 'th'
                                  ? '🤍 เพื่อนยังไม่สะดวก (ไม่เป็นไรนะ)'
                                  : '🤍 Not today (No worries)'
                                : lang === 'th'
                                ? '👋 จบกิจกรรมแล้ว'
                                : '👋 Ended'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      )}
      </div>

      {/* Staff / Self-Kid PIN Unlock Modal (Boss Stage, Evening Phone & Computer Homework) */}
      <PinPadModal
        open={Boolean(pinRequestAction)}
        heavyPrivacyBlur={true}
        lockedRemainingSec={staffPinGuard.remainingSec}
        lang={lang}
        title={
          pinRequestAction?.type === 'computer_homework'
            ? lang === 'th'
              ? `🔑 น้อง${kid.nickname} · ใส่รหัส PIN 4 หลักด้วยตนเอง`
              : `🔑 ${kid.nickname} · Enter Your Own 4-Digit PIN`
            : lang === 'th'
            ? 'ให้พี่เลี้ยงใส่รหัส PIN 4 หลัก'
            : 'Staff 4-Digit PIN Verification'
        }
        subtitle={
          pinRequestAction?.type === 'computer_homework'
            ? lang === 'th'
              ? `ยืนยันขออนุญาตใช้คอมทำการบ้าน (ซัก/ตาก/รีด/อาบน้ำ/ตรวจชุดครบ · +${computerHwConfig.rewardStars} ⭐)`
              : `Confirm Computer for Homework (+${computerHwConfig.rewardStars} ⭐)`
            : (pinRequestAction?.type === 'boss_stage'
                ? lang === 'th'
                  ? 'ปลดล็อกสิทธิ์ดูการ์ตูนด่านบอส 20:00 น. (+10 ⭐)'
                  : 'Unlock 20:00 Boss Stage cartoon privilege (+10 ⭐)'
                : lang === 'th'
                ? 'ตรวจมือถือและเช็คลิสต์ครบ 4 ข้อ เพื่อรับมือถือรอบ 18:30 น. (+10 ⭐)'
                : 'Confirm 4-item checklist & phone check to release 18:30 phone (+10 ⭐)') +
              (activeAwaySecretCode
                ? lang === 'th'
                  ? ' · (วันที่พี่เลี้ยงไม่อยู่: ใส่รหัสลับจากผู้สร้างได้)'
                  : ' · (Staff away today: Creator daily code accepted)'
                : '')
        }
        onCancel={() => setPinRequestAction(null)}
        onSubmitPin={(pin) => {
          if (staffPinGuard.isLocked) {
            onShowAlert({
              icon: '🔒',
              title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
              message: formatPinLockoutMessage(staffPinGuard.remainingSec, lang),
              tone: 'pink',
            });
            return;
          }
          if (pinRequestAction?.type === 'computer_homework') {
            if (pin !== kid.pin) {
              const res = staffPinGuard.recordFailure();
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
                        ? `กรุณาใส่รหัส PIN 4 หลักของน้อง${kid.nickname} ด้วยตนเองค่ะ`
                        : `Please enter ${kid.nickname}'s own 4-digit PIN.`
                    }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
                tone: 'pink',
              });
              return;
            }
            staffPinGuard.recordSuccess();
            setPinRequestAction(null);
            const reward = Math.max(0, Math.round(computerHwConfig.rewardStars ?? 10));
            const applied = addStars(
              reward,
              `💻 ขออนุญาตใช้คอมทำการบ้าน (ซัก/ตาก/รีด/อาบน้ำ/ตรวจชุดครบ +${reward} ⭐)`,
              (prev) => ({
                daily: {
                  ...prev.daily,
                  computerHomeworkChecked: true,
                  computerHomeworkAt: now.toISOString(),
                },
              }),
              (prev) =>
                !prev.daily.computerHomeworkChecked &&
                getComputerHomeworkPrereqStatus(prev).ready
            );
            if (!applied) return;
            onShowAlert({
              icon: '💻✨',
              title:
                lang === 'th'
                  ? `ขออนุญาตใช้คอมทำการบ้านสำเร็จ! (+${reward} ⭐)`
                  : `Computer Homework Approved! (+${reward} ⭐)`,
              message:
                lang === 'th'
                  ? 'ซักผ้า ตากผ้า รีดผ้า อาบน้ำ และตรวจชุดเรียบร้อย รับ +10 ดาว ใช้คอมทำการบ้านได้ค่ะ'
                  : 'All 5 requirements completed! You are approved to use the computer for homework.',
              tone: 'mint',
            });
            return;
          }

          const isValidAwayCode = activeAwaySecretCode !== null && pin === activeAwaySecretCode;
          if (!staffPins.includes(pin) && !isValidAwayCode) {
            const res = staffPinGuard.recordFailure();
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
                : `${lang === 'th' ? 'กรุณาให้พี่เลี้ยงหรือผู้สร้างใส่รหัส PIN 4 หลักให้ถูกต้อง' : 'Please ask a staff member to enter their 4-digit PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
              tone: 'pink',
            });
            return;
          }
          staffPinGuard.recordSuccess();
          const action = pinRequestAction;
          setPinRequestAction(null);
          if (action?.type === 'boss_stage') {
            const applied = addStars(
              10,
              'ผ่านด่านบอส 20:00 น. ปลดล็อกการ์ตูน (+10 ⭐)',
              (prev) => ({
                daily: { ...prev.daily, bossStageUnlocked: true },
              }),
              (prev) => !prev.daily.bossStageUnlocked
            );
            if (!applied) return;
            onShowAlert({
              icon: '📺🎉',
              title: lang === 'th' ? 'ปลดล็อกการ์ตูนสำเร็จ! (+10 ⭐)' : 'Cartoon Privilege Unlocked! (+10 ⭐)',
              message: lang === 'th' ? 'เก่งมากเลย! รับ +10 ดาว ดูการ์ตูนได้ถึง 20:40 น. แล้วอย่าลืมดื่มน้ำและเข้านอน 21:00 น. นะ' : 'Great job! +10 stars. Watch until 20:40, drink water, and bedtime at 21:00!',
              tone: 'mint',
            });
          } else if (action?.type === 'g2_evening_phone') {
            const applied = addStars(
              10,
              'เช็คลิสต์ครบ 4 ข้อ รับมือถือรอบเย็น 18:30 น. (+10 ⭐)',
              (prev) => ({
                daily: { ...prev.daily, eveningPhoneUnlocked: true },
              }),
              (prev) => !prev.daily.eveningPhoneUnlocked
            );
            if (!applied) return;
            onShowAlert({
              icon: '📱✨',
              title: lang === 'th' ? 'รับมือถือรอบเย็นสำเร็จ! (+10 ⭐)' : 'Evening Phone Released! (+10 ⭐)',
              message: lang === 'th' ? 'ซักชุด รีดชุด ตรวจชุด และอาบน้ำเรียบร้อย! รับ +10 ดาว' : 'All 4 chores complete! +10 stars awarded.',
              tone: 'mint',
            });
          }
        }}
      />

      {/* 3-Minute Recurring Step-by-Step + Late/Rule Violation Reminder Modal */}
      {stepPopupOpen && !pinRequestAction && !subModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3D322C]/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[32px] border-4 border-[#F5DE93] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#9E4F16]">
                  🔔 {lang === 'th' ? 'สรุปสเตปประจำวันของหนู' : 'Daily Step Summary'}
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#3D322C] mt-0.5">
                  {kid.emoji} {lang === 'th' ? `สเตปต่อไปของน้อง${kid.nickname}` : `${kid.nickname}'s Next Steps`}
                </h3>
              </div>
              <button
                type="button"
                onClick={dismissStepPopup}
                aria-label={lang === 'th' ? 'ปิดแจ้งเตือน' : 'Close'}
                className="min-h-[40px] min-w-[40px] rounded-full bg-[#FADADD] hover:bg-[#F3B7C0] font-bold text-[#3D322C] cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* 3 Core Shift Progress Pills — match outer button colors; fade shifts outside current time window */}
            <div className="grid grid-cols-3 gap-2">
              {(() => {
                const minsNow = getMinutesOfDay(now);
                return stepReminder.shifts.map((s) => {
                  const isInWindow =
                    s.key === 'shift_morning'
                      ? minsNow < 12 * 60
                      : s.key === 'shift_afternoon'
                      ? minsNow >= 12 * 60 && minsNow < 18 * 60 + 30
                      : minsNow >= 18 * 60 + 30;

                  const toneClasses =
                    s.key === 'shift_morning'
                      ? isInWindow
                        ? 'border-[#E6C255] bg-[#FFF8D6] hover:bg-[#FFF2B8] text-[#4D3B10] shadow-xs'
                        : 'border-[#F3E6BC] bg-[#FFFDF2] hover:bg-[#FFF9E3] text-[#7D6C3E] opacity-65 hover:opacity-95'
                      : s.key === 'shift_afternoon'
                      ? isInWindow
                        ? 'border-[#7CC6B8] bg-[#E3F7F3] hover:bg-[#D3F2EB] text-[#144B43] shadow-xs'
                        : 'border-[#C9EAE4] bg-[#F6FCFB] hover:bg-[#EAF8F5] text-[#558079] opacity-65 hover:opacity-95'
                      : isInWindow
                      ? 'border-[#B8A3E3] bg-[#EFE9FB] hover:bg-[#E5DCF8] text-[#352259] shadow-xs'
                      : 'border-[#DFD6F0] bg-[#FAF8FE] hover:bg-[#F3EEFC] text-[#756691] opacity-65 hover:opacity-95';

                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        dismissStepPopup();
                        setSubModal(s.key);
                      }}
                      className={`rounded-2xl border p-2.5 text-left cursor-pointer transition-all ${toneClasses}`}
                    >
                      <div className="flex items-center justify-between gap-1 text-xs font-extrabold">
                        <span>{s.emoji}</span>
                        <span>{s.done ? '✅' : s.isOverdue ? '🚨' : isInWindow ? '⏳' : '•'}</span>
                      </div>
                      <div className="text-[11px] font-bold mt-1 leading-tight">
                        {lang === 'th' ? s.labelTh : s.labelEn}
                      </div>
                      <div className="text-[10px] opacity-85 mt-0.5 truncate">
                        {lang === 'th' ? s.summaryTh : s.summaryEn}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Next Step Action Card — Distinct Rosy Pink Highlight */}
            {stepReminder.nextStep ? (
              <div
                className={`rounded-2xl border-2 p-4 space-y-2.5 ${
                  stepReminder.nextStep.urgent && !isSickToday
                    ? 'border-[#E66C85] bg-gradient-to-br from-[#FFE4EC] via-[#FFF0F5] to-[#FFE8EF]'
                    : 'border-[#F09BB0] bg-gradient-to-br from-[#FFEBF1] via-[#FFF5F8] to-[#FFEFF4]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-[#9A2343]">
                    {stepReminder.nextStep.urgent && !isSickToday
                      ? lang === 'th'
                        ? '🚨 เลยเวลากำหนด / รีบทำด่วน'
                        : '🚨 Overdue Step'
                      : stepReminder.nextStep.approachingDeadline
                      ? lang === 'th'
                        ? '⏰ ใกล้ถึงเวลากำหนดแล้ว'
                        : '⏰ Approaching Deadline'
                      : lang === 'th'
                      ? '👉 สเตปถัดไปที่ต้องทำ'
                      : '👉 Next Required Step'}
                  </span>
                  <span className="tabular-nums text-xs font-bold text-[#8E4458]">
                    {formatDigitalClock(now)}
                  </span>
                </div>
                <div className="text-base font-extrabold text-[#3D322C]">
                  {lang === 'th' ? stepReminder.nextStep.titleTh : stepReminder.nextStep.titleEn}
                </div>
                <p className="text-xs sm:text-sm text-[#4D3E36] leading-relaxed">
                  {lang === 'th' ? stepReminder.nextStep.instructionTh : stepReminder.nextStep.instructionEn}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const target = stepReminder.nextStep?.targetModal;
                    dismissStepPopup();
                    if (target) setSubModal(target);
                  }}
                  className="w-full min-h-[46px] rounded-2xl bg-[#3D322C] hover:bg-[#2A221E] text-white text-sm font-bold px-4 py-2.5 cursor-pointer"
                >
                  {lang === 'th' ? stepReminder.nextStep.ctaTh : stepReminder.nextStep.ctaEn} →
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-[#9FE2D6] bg-[#EAFAF7] p-4 text-center space-y-1">
                <div className="text-2xl">🎉🌟</div>
                <div className="text-sm font-extrabold text-[#17554B]">
                  {lang === 'th' ? 'เยี่ยมมาก! ทำครบทั้ง 3 กะหลักของวันนี้แล้ว' : 'Awesome! All 3 main shifts completed today!'}
                </div>
              </div>
            )}

            {/* Late / Rule Violation Instructions (if any active) */}
            {stepReminder.penaltyInstructions.length > 0 && (
              <div className="rounded-2xl border-2 border-[#F3B7C0] bg-[#FFF5F7] p-4 space-y-2.5">
                <div className="text-xs sm:text-sm font-extrabold text-[#852139]">
                  ⚖️ {lang === 'th' ? 'คำสั่งสำหรับคนมาสาย / ผิดกฎที่ต้องปฏิบัติ:' : 'Late & Rule Violation Instructions:'}
                </div>
                <div className="space-y-2">
                  {stepReminder.penaltyInstructions.map((pen) => (
                    <div key={pen.id} className="rounded-xl border border-[#F5D2DC] bg-white p-3 space-y-1">
                      <div className="text-xs font-extrabold text-[#852139]">
                        {lang === 'th' ? pen.titleTh : pen.titleEn}
                      </div>
                      <p className="text-xs text-[#5E4E45] leading-relaxed">
                        {lang === 'th' ? pen.ruleInstructionTh : pen.ruleInstructionEn}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          dismissStepPopup();
                          setSubModal(pen.targetModal);
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#9E2A45] underline cursor-pointer"
                      >
                        {lang === 'th' ? 'เปิดดูรายละเอียด / แก้ไข' : 'View Details'} →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explicit Dismiss Button — matches active time window color */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-[#7B695F]">
                {stepReminder.shouldAutoPop
                  ? lang === 'th'
                    ? 'หากยังไม่ทำสเตปข้างต้น ระบบจะเด้งเตือนซ้ำทุก 3 นาทีจนกว่าจะเสร็จค่ะ'
                    : 'Re-reminds every 3 minutes until completed.'
                  : ''}
              </span>
              {(() => {
                const minsNow = getMinutesOfDay(now);
                const dismissColorClasses =
                  minsNow < 12 * 60
                    ? 'bg-[#FFF8D6] hover:bg-[#FFF2B8] border border-[#E6C255] text-[#4D3B10]'
                    : minsNow < 18 * 60 + 30
                    ? 'bg-[#E3F7F3] hover:bg-[#D3F2EB] border border-[#7CC6B8] text-[#144B43]'
                    : 'bg-[#EFE9FB] hover:bg-[#E5DCF8] border border-[#B8A3E3] text-[#352259]';
                return (
                  <button
                    type="button"
                    onClick={dismissStepPopup}
                    className={`w-full sm:w-auto min-h-[44px] rounded-2xl font-bold text-sm px-5 py-2 cursor-pointer transition-colors ${dismissColorClasses}`}
                  >
                    ✖️ {lang === 'th' ? 'รับทราบ / กดปิดแจ้งเตือนนี้' : 'Close Reminder'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Pop-up 3 Choices for "ขออนุญาตทำการบ้าน" (20:30-20:45 น.) */}
      {hwPermPopupOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#3D322C]/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-[28px] border-4 border-[#8FD4C6] bg-[#FFFDF9] p-6 pastel-shadow space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-[#114A42]">
                  📝 {lang === 'th' ? 'ขออนุญาตทำการบ้าน' : 'Homework Permission'}
                </h3>
                <p className="text-xs text-[#4B7069] mt-0.5">
                  {lang === 'th'
                    ? `เลือกเหตุผลที่ต้องการใช้มือถือเพิ่ม (แสดงช่วง ${hwPermWin.labelTh})`
                    : `Choose one reason below (${hwPermWin.labelEn} window)`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHwPermPopupOpen(false)}
                className="min-h-[38px] min-w-[38px] rounded-full bg-[#FADADD] hover:bg-[#F5C5CF] font-bold text-[#3D322C] cursor-pointer shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFF0F3] px-3.5 py-2.5 text-xs text-[#8B1D36] space-y-1 leading-relaxed">
              <div className="font-extrabold">
                ⏰ {lang === 'th' ? `ใช้เพิ่มได้จนถึงเวลา ${hwCurfewTh}` : `Extension until ${hwCurfewEn}`}
              </div>
              <div>
                ⚖️{' '}
                {lang === 'th'
                  ? `หากเกิน ${hwCurfewTh} ยังไม่นำมือถือมาเก็บ จะถือว่ายินยอมงดใช้โทรศัพท์วัน Free Day 1 วัน`
                  : `Keeping phone past ${hwCurfewEn} counts as consenting to forfeit 1 Free Day phone privilege.`}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {lang === 'th' ? 'รายละเอียด / วิชา (ไม่บังคับ)' : 'Subject / Note (Optional)'}
              </label>
              <input
                type="text"
                maxLength={80}
                value={hwSubject}
                onChange={(e) => setHwSubject(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น คณิตศาสตร์ / ค้นคว้าโครงงาน...' : 'e.g. Math / Research...'}
                className="w-full rounded-xl border border-[#BFE6DE] bg-white px-3 py-2 text-sm text-[#3D322C]"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectHomeworkPermission('ทำการบ้าน')}
                className="w-full min-h-[54px] rounded-2xl border-2 border-[#7EBCE6] bg-[#E8F5FD] hover:bg-[#D5ECFA] px-4 py-3 font-extrabold text-[#1D4D73] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all"
              >
                <span className="flex items-center gap-2.5 text-base">
                  <span className="text-xl">✍️</span>
                  <span>{lang === 'th' ? 'ปุ่มทำการบ้าน' : 'Do Homework'}</span>
                </span>
                <span className="text-xs font-bold bg-white/90 px-2.5 py-1 rounded-xl border border-[#B6DBF2]">
                  {lang === 'th' ? 'เลือก' : 'Select'} →
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectHomeworkPermission('หาข้อมูล')}
                className="w-full min-h-[54px] rounded-2xl border-2 border-[#7CC6B8] bg-[#E8FAF6] hover:bg-[#D5F4EE] px-4 py-3 font-extrabold text-[#114A42] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all"
              >
                <span className="flex items-center gap-2.5 text-base">
                  <span className="text-xl">🔍</span>
                  <span>{lang === 'th' ? 'ปุ่มหาข้อมูล' : 'Research Information'}</span>
                </span>
                <span className="text-xs font-bold bg-white/90 px-2.5 py-1 rounded-xl border border-[#A5DFD3]">
                  {lang === 'th' ? 'เลือก' : 'Select'} →
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectHomeworkPermission('เรียนพิเศษ')}
                className="w-full min-h-[54px] rounded-2xl border-2 border-[#C5B2E8] bg-[#F5F1FC] hover:bg-[#EAE1FA] px-4 py-3 font-extrabold text-[#3E2B63] flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all"
              >
                <span className="flex items-center gap-2.5 text-base">
                  <span className="text-xl">📚</span>
                  <span>{lang === 'th' ? 'ปุ่มเรียนพิเศษ' : 'Extra Tutoring'}</span>
                </span>
                <span className="text-xs font-bold bg-white/90 px-2.5 py-1 rounded-xl border border-[#D4C5F2]">
                  {lang === 'th' ? 'เลือก' : 'Select'} →
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <PiggyBankModals
        activeModal={coinsEnabled ? piggyModal : null}
        kid={kid}
        allowance={liveAllowance}
        goldenPoolLogs={goldenPoolLogs}
        settings={settings}
        lang={lang}
        onClose={() => setPiggyModal(null)}
        onExchangeStarsToCoins={handleExchangeStarsToCoins}
      />

      <PenaltyNoticeModal
        notice={penaltyNoticePopup}
        lang={lang}
        onClose={() => setPenaltyNoticePopup(null)}
      />
    </div>
  );
};
