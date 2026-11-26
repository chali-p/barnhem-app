export type Language = 'th' | 'en';

export type AppMode =
  | 'magic_door'
  | 'staff'
  | 'chef'
  | 'tutor'
  | 'manager'
  | 'creator'
  | 'portal'
  | 'activity_log'
  | 'star_summary'
  | 'duty_roster'
  | 'secret_vote'
  | 'supply_request'
  | 'lost_found'
  | 'house_rules_guide'
  | 'staff_system_guide'
  | 'shortcut_manual';

export type MemberRole = 'manager' | 'staff' | 'chef' | 'tutor' | 'kid';

export type KidGroup = 1 | 2 | 3; // 1 = ประถม, 2 = มัธยม, 3 = วิทยาลัย/ฝึกงาน

export type Gender = 'M' | 'F';

export type OutfitMode =
  | 'lounge'
  | 'uniform'
  | 'casual'
  | 'custom_design'
  | 'festival';

export type FestivalId =
  | 'new_year'
  | 'childrens_day'
  | 'chinese_new_year'
  | 'valentine'
  | 'songkran'
  | 'mothers_day'
  | 'halloween'
  | 'loy_krathong'
  | 'fathers_day'
  | 'christmas';

export type AvatarBodyType = 'slim' | 'regular' | 'sturdy';
export type AvatarSkinTone = 'fair' | 'warm' | 'tan' | 'deep';
export type AvatarFaceMood = 'happy' | 'cheerful' | 'cool' | 'shy';

export interface CustomOutfitDesign {
  style: 'hoodie' | 'dress' | 'overalls' | 'preppy';
  primaryColor: string;
  secondaryColor: string;
  pattern: 'none' | 'dots' | 'stripes' | 'stars' | 'hearts';
  emblem: string;
  drawingDataUrl?: string;
}

export interface AvatarConfig {
  skinTone: AvatarSkinTone;
  bodyType: AvatarBodyType;
  faceMood: AvatarFaceMood;
  hairStyle: 'tied_bun' | 'tied_ponytail' | 'neat_short'; // มัดผม / นักเรียนเรียบร้อยเท่านั้น
  hairColor: string;
  outfitMode: OutfitMode;
  equippedCasualId?: string;
  equippedFestivalId?: string;
  equippedFestivalPropId?: string;
  equippedBagId?: string;
  equippedHatId?: string;
  equippedGlassesId?: string;
  equippedCosmeticId?: string;
  customOutfit?: CustomOutfitDesign;
}

export interface ProfileGift {
  id: string;
  emoji: string;
  title: string;
  message?: string;
  amountThb?: number;
  senderName: string;
  sentDateKey: string; // YYYY-MM-DD (shown on kid profile box on sent date = 1 day)
  sentAt: string;
}

export interface MySpaceProfile {
  favoriteColor: string;
  favoriteFood: string;
  favoritePet: string;
  futureDream: string;
  activeGift?: ProfileGift | null;
}

export interface TrashDutyDayEntry {
  done: boolean;
  doneAt?: string | null;
  confirmedBy?: string | null;
}

export interface DailyProgress {
  dateKey: string; // YYYY-MM-DD
  morningPhonePickupChecked?: boolean;
  breakfastChecked: boolean;
  vanOrMorningChecked: boolean;
  morningDressedConfirmed: boolean;
  returnedHomeChecked: boolean;
  speedyNinjaStartMs: number | null; // 20-min countdown start timestamp
  extraStudyChecked: boolean;
  choresChecked: boolean;
  bossStageUnlocked: boolean;
  eveningChecklist: [boolean, boolean, boolean, boolean]; // 1.ซักชุด 2.รีดชุด 3.ตรวจชุด 4.อาบน้ำ
  eveningPhoneUnlocked: boolean;
  homeworkRegisteredSubject: string | null;
  phoneReturnedChecked: boolean;
  kitchenEveningDone: boolean;
  kitchenSatDone: boolean;
  kitchenSunDone: boolean;
  houseChoreDone?: boolean;
  trashDutyDone?: boolean;
  trashDutyDoneAt?: string | null;
  trashDutyConfirmedBy?: string | null;
  trashDutyByDate?: Record<string, TrashDutyDayEntry>;
  computerHomeworkChecked?: boolean;
  computerHomeworkAt?: string | null;
}

export interface StarTransaction {
  id: string;
  timestamp: string;
  reason: string;
  amount: number; // positive = earned, negative = spent
}

export interface CoinTransaction {
  id: string;
  timestamp: string;
  reason: string;
  amount: number; // positive = top-up / star exchange, negative = school daily deduction / penalty
  kind: 'weekly_topup' | 'school_deduct' | 'penalty' | 'star_exchange' | 'angpao' | 'admin_adjust';
}

export interface KidAllowanceState {
  coins: number; // 1 Coin = 1 THB in personal Pink Piggy Bank (can be negative when penalized)
  weekKey: string; // Monday dateKey YYYY-MM-DD
  deductedWeekdays: number[]; // Weekday numbers deducted this week (1=Mon .. 5=Fri)
  weeklyPenaltyThb: number; // Accumulated penalty this week to deduct from next Monday's top-up
  coinHistory: CoinTransaction[];
  customDailyAllowanceThb?: number | null; // Optional per-kid daily school allowance override (10..500 THB)
  awayUntilDateKey?: string | null; // YYYY-MM-DD if kid is away (home leave / camp / break) -> skip school deduction & overdue alerts
  awayReason?: string;
}

export interface GoldenPoolLog {
  id: string;
  kidId: string;
  kidNickname: string;
  amount: number; // positive = penalty added to pool, negative = group payout from pool
  kind: 'penalty_in' | 'group_payout';
  reason: string;
  recordedBy: string;
  createdAt: string;
}

export type StaffLeaveKind = 'emergency' | 'sick' | 'personal' | 'swap';
export type StaffLeaveSpan = 'full_day' | 'morning' | 'afternoon_from_time';

export interface StaffLeaveRecord {
  id: string;
  staffId: string;
  staffName: string;
  dateKey: string; // YYYY-MM-DD (today or future date)
  kind: StaffLeaveKind;
  span: StaffLeaveSpan;
  leaveFromTime?: string; // HH:MM when span === 'afternoon_from_time' (e.g. '11:00')
  reason: string;
  substituteName?: string;
  status: 'active' | 'cancelled';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  recordedBy: string;
  createdAt: string;
}

export interface KidPenaltyState {
  lateFineThb: number;
  phoneConfiscatedUntil1830Date: string | null;
  fridayFreeDayDeductedCount: number;
  noEveningPhoneTomorrowDate: string | null;
  cartoonPrivilegeActive: boolean;
  phonePrivilegeActive: boolean;
}

export interface KitchenDutyAssignment {
  evening1530: boolean; // เย็น 15:30 น. เท่ากันทั้ง 3 วัน (เสาร์ · อาทิตย์ · นักขัตฤกษ์) และเย็นวันปกติ
  sat0930: boolean;     // เช้า วันเสาร์–วันหยุดนักขัตฤกษ์ 09:30 น. (แม่ครัวคอนเฟิร์ม 10:00-12:00)
  sun0915: boolean;     // เช้า วันอาทิตย์ 09:15 น. (แม่ครัวคอนเฟิร์ม 10:00-12:00)
}

export interface HealthProfile {
  bloodType: string;
  foodAllergies: string;
  drugAllergies: string;
  chronicConditions: string;
  regularMeds: string;
  emergencyNote: string;
}

export interface MorningStreakState {
  currentMorningStreak: number;
  bestMorningStreak: number;
  lastOnTimeDateKey: string | null;
  streakMilestonesClaimed: number;
}

export type PetSpecies =
  | 'dog'
  | 'shiba'
  | 'cat'
  | 'rabbit'
  | 'hamster'
  | 'panda'
  | 'fox'
  | 'penguin'
  | 'duck'
  | 'capybara';

export type PetCoatStyle =
  | 'cream'
  | 'brown'
  | 'spotted'
  | 'grey'
  | 'calico'
  | 'mint'
  | 'pink'
  | 'midnight';

export type PetOutfitId =
  | 'none'
  | 'collar_heart'
  | 'scarf_mint'
  | 'ribbon_pink'
  | 'hat_straw'
  | 'glasses_cool'
  | 'hoodie_star'
  | 'cape_hero';

export interface PetCompanionConfig {
  species: PetSpecies;
  name: string;
  coat: PetCoatStyle;
  outfit: PetOutfitId;
  hunger: number;
  happiness: number;
  affection: number;
  lastFedAt: string;
  lastPlayedAt: string;
  lastNoticeBonusDate?: string;
  lastFedRewardDate?: string;
  fedRewardCountToday?: number;
}

export interface Member {
  id: string;
  role: MemberRole;
  group?: KidGroup;
  nickname: string;
  fullName: string;
  gender: Gender;
  pin: string;
  emoji: string;
  // Kid specific fields
  stars: number;
  personalDriveUrl: string;
  restrictedDocsUrl: string;
  activeCoverStage: number; // 1..7
  unlockedCoverStages: number[]; // e.g., [1]
  collectedSceneItems: string[]; // IDs of scene items collected
  ownedShopItemIds: string[]; // IDs of shop cover/wardrobe items bought
  avatar: AvatarConfig;
  pet?: PetCompanionConfig;
  mySpace: MySpaceProfile;
  healthProfile?: HealthProfile;
  streak?: MorningStreakState;
  customHouseChore?: string;
  allowance?: KidAllowanceState;
  penalty: KidPenaltyState;
  kitchenDuty: KitchenDutyAssignment;
  daily: DailyProgress;
  starHistory: StarTransaction[];
  linkedEmail?: string;
  emailLoginBonusClaimed?: boolean;
}

export interface SickReport {
  id: string;
  kidId: string;
  kidNickname: string;
  dateKey: string;
  reportedAt: string;
  symptoms: string;
  details: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface SnackBill {
  id: string;
  kidId: string;
  kidNickname: string;
  itemId: string;
  itemName: string;
  starsSpent: number;
  category: 'snack' | 'cover_item';
  dateKey: string;
  createdAt: string;
  fulfilled: boolean;
}

export interface KitchenVerificationLog {
  id: string;
  kidId: string;
  kidNickname: string;
  slot: 'evening1530' | 'sat0930' | 'sun0915';
  slotLabel: string;
  chefId: string;
  chefName: string;
  starsAwarded: number;
  dateKey: string;
  verifiedAt: string;
}

export interface ReturnHomePhoto {
  id: string;
  kidId: string;
  kidNickname: string;
  dateKey: string;
  capturedAt: string;
  imageBase64: string;
  driveFolderUrl: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageBase64?: string;
  priority: 'normal' | 'urgent';
  pinned: boolean;
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt?: string;
  startAt?: string;
  endAt?: string;
  audience?: 'all' | 'staff_only';
  assignedTo?: string;
  taskCompleted?: boolean;
  taskCompletedBy?: string;
  taskCompletedAt?: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface SecretPoll {
  id: string;
  question: string;
  options: PollOption[];
  votedKidIds: string[];
  closed: boolean;
  authorName: string;
  createdAt: string;
}

export interface OutingTrip {
  id: string;
  title: string;
  location: string;
  dateText: string;
  chaperone: string;
  details: string;
  attendeeIds: string[];
  createdAt: string;
  authorName: string;
}

export interface PrivateCareMessage {
  id: string;
  kidId: string;
  kidNickname: string;
  tripId?: string;
  tripTitle?: string;
  message: string;
  createdAt: string;
  readByStaff: boolean;
  staffReply?: string;
  staffReplyBy?: string;
  repliedAt?: string;
}

export interface LostFoundItem {
  id: string;
  title: string;
  description: string;
  locationFound: string;
  status: 'lost' | 'found' | 'claimed';
  photoBase64?: string;
  postedByName: string;
  postedByRole: string;
  claimedByKidId?: string;
  claimedByNickname?: string;
  createdAt: string;
}

export interface SupplyRequest {
  id: string;
  kidId: string;
  kidNickname: string;
  itemName: string;
  category: 'hygiene' | 'study' | 'uniform' | 'other';
  urgency: 'normal' | 'urgent';
  note: string;
  status: 'pending' | 'approved' | 'delivered';
  approvedBy?: string;
  createdAt: string;
}

export interface KindnessCard {
  id: string;
  fromKidId: string;
  fromNickname: string;
  toMemberId: string;
  toNickname: string;
  message: string;
  dateKey: string;
  createdAt: string;
}

export interface DeedRedemption {
  id: string;
  kidId: string;
  kidNickname: string;
  deedTitle: string;
  fineReductionThb: number;
  starsBonus: number;
  status: 'assigned' | 'kid_submitted' | 'approved';
  assignedBy: string;
  createdAt: string;
  approvedAt?: string;
}

export interface FriendVisitRequest {
  id: string;
  fromKidId: string;
  fromKidNickname: string;
  fromKidEmoji: string;
  toKidId: string;
  toKidNickname: string;
  toKidEmoji: string;
  activity: FriendVisitActivity;
  note?: string;
  status: 'pending' | 'accepted' | 'declined' | 'ended';
  dateKey: string;
  createdAt: string;
  respondedAt?: string;
}

export type FriendVisitActivity =
  | 'study'
  | 'travel'
  | 'eat'
  | 'cycling'
  | 'football'
  | 'volleyball';

export type ShopCategory = 'snack' | 'cover_item';
export type CoverItemSubType =
  | 'scene_item'
  | 'casual_outfit'
  | 'festival_outfit'
  | 'festival_prop'
  | 'school_bag'
  | 'hat'
  | 'glasses'
  | 'cosmetic';

export interface ShopItem {
  id: string;
  nameTh: string;
  nameEn: string;
  priceStars: number;
  category: ShopCategory;
  subType?: CoverItemSubType;
  festivalId?: FestivalId;
  sceneStage?: number; // 1..7 if scene_item
  emoji: string;
  imageBase64?: string;
  colorHex?: string;
  secondaryColorHex?: string;
  outfitVariant?: string;
  descriptionTh: string;
  descriptionEn: string;
}

export interface CoverSceneInfo {
  stage: number; // 1..7
  titleTh: string;
  titleEn: string;
  minStarsHint: number;
  requiredPrevItems: number; // 7 items from previous stage
  bgGradient: string;
  accentHex: string;
  badgeEmoji: string;
  descriptionTh: string;
  descriptionEn: string;
}

export type LoginCommandType = 'routine' | 'penalty';

export type CommandPenaltyPresetId =
  | 'deduct_free_day'
  | 'deduct_stars'
  | 'fixed_fine_thb'
  | 'per_minute_fine_thb'
  | 'no_phone_today_1830'
  | 'no_phone_tomorrow'
  | 'special_duty'
  | 'lock_after_deadline'
  | 'no_fine_zero_stars';

export interface TimedScheduleSlot {
  startMins: number;
  endMins: number;
  earlyGraceMins?: number;
  deadlineMins?: number;
  emoji?: string;
  titleTh?: string;
  titleEn?: string;
  descriptionTh?: string;
  descriptionEn?: string;
  rewardStars?: number;
  penaltyPreset?: string;
  penaltyNote?: string;
  commandType?: LoginCommandType;
  enabled?: boolean;
  hidden?: boolean;
  // Auto phone-return rule settings (used on night_return_phone)
  autoNoHomeworkRuleEnabled?: boolean;
  noHomeworkTargetMode?: 'match_homework_permission' | 'all_eligible' | 'custom_kids';
  noHomeworkTargetKidIds?: string[];
  noHomeworkDeadlineMins?: number;
  noHomeworkPenaltyPreset?: string;
  noHomeworkPenaltyNote?: string;
  homeworkExtendedDeadlineMins?: number;
  homeworkExtendedPenaltyPreset?: string;
  homeworkExtendedPenaltyNote?: string;
}

export type CommandAuthMode = 'staff_pin' | 'kid_pin' | 'self_tap';

export interface CommandAccessRule {
  phoneFilter?: 'all' | 'has_phone' | 'no_phone';
  restrictToKidIds?: boolean;
  allowedKidIds?: string[];
  authMode?: CommandAuthMode;
}

export interface AppSettings {
  syncWebhookUrl: string;
  returnHomeDriveUrl: string;
  creatorPins: string[]; // ['9292', '1629']
  isPublicHolidayToday: boolean;
  simulatedTimeIso: string | null; // null = use real device clock
  tutorMaxStarsPerKidPerDay?: number; // 0..10 (default 10)
  activeFestivalOverride?: FestivalId | 'auto' | 'none';
  dailyAllowanceThb?: number; // Default 70
  schoolDaysPerWeek?: number; // Default 5 (70 x 5 = 350)
  early15MinBonusStars?: number; // Default 1
  starToCoinStars?: number; // Default 30 (editable by creator)
  starToCoinThb?: number; // Default 5 (editable by creator)
  lastWeeklyClearedAt?: string | null;
  useOwnStorageOnly?: boolean; // True = store only locally + org's own Google Sheet/Drive (0 bytes on central Firestore)
  enableCoinsAndPiggyBank?: boolean; // Default false: keep coins & piggy bank off on kid screens until Creator enables it
  showHomeAnnouncementBox?: boolean; // Default true: Creator controls whether the Home announcement box is shown or stopped
  organizationPreset?: OrganizationPresetId;
  automationAddons?: AutomationAddonId[];
  customQuickCommands?: CustomQuickCommand[];
  timedCommandSchedule?: Record<string, TimedScheduleSlot>;
  homeworkCurfewMins?: number;
  kidsWithoutPhoneIds?: string[];
  commandPermissions?: Record<string, CommandAccessRule>;
  customPenaltyPresets?: string[];
  kidAwaySecretCode?: string;
  kidAwaySecretDateKey?: string | null;
}

export interface CustomQuickCommand {
  id: string;
  emoji: string;
  titleTh: string;
  titleEn: string;
  descriptionTh?: string;
  descriptionEn?: string;
  kind: 'homework_permission' | 'custom_checkin' | 'penalty';
  alwaysOpen: boolean;
  startMins?: number;
  endMins?: number;
  earlyGraceMins?: number;
  deadlineMins?: number;
  starsDelta?: number;
  penaltyPreset?: string;
  penaltyNote?: string;
  enabled?: boolean;
  defaultNote?: string;
}

export type WeeklyActivityStatus = 'on_time' | 'late' | 'absent' | 'sick_leave' | 'other';

export interface WeeklyActivityLog {
  id: string;
  kidId: string;
  kidNickname: string;
  kidEmoji: string;
  kidGroup?: KidGroup;
  dateKey: string;
  timeText: string;
  actionLabel: string;
  status: WeeklyActivityStatus;
  note?: string;
  recordedBy: string;
  createdAt: string;
}

export interface AppState {
  members: Member[];
  shopItems: ShopItem[];
  sickReports: SickReport[];
  snackBills: SnackBill[];
  kitchenLogs: KitchenVerificationLog[];
  returnHomePhotos: ReturnHomePhoto[];
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
  weeklyActivityLogs?: WeeklyActivityLog[];
  settings: AppSettings;
  lastSyncedAt: string | null;
}

export type PastelTheme = 'rose' | 'mint' | 'sky' | 'yellow' | 'lavender' | 'peach';

export interface ModalAlertPayload {
  title: string;
  message: string;
  icon: string;
  tone?: 'pink' | 'mint' | 'blue' | 'yellow' | 'lavender' | 'peach';
  confirmLabel?: string;
  onConfirm?: () => void;
}

export type RegistrationApplicationType = 'open_organization' | 'apply_staff';
export type RegistrationStatus = 'pending' | 'interview' | 'approved' | 'rejected';

export type OrganizationPresetId = 'foundation_care';

export type AutomationAddonId =
  | 'auto_shift_attendance'
  | 'star_loyalty_minimart'
  | 'auto_sheet_line_report';

export interface PlatformRegistration {
  uid: string;
  email: string;
  applicantName: string;
  nickname: string;
  organizationName: string;
  applicationType: RegistrationApplicationType;
  organizationPreset?: OrganizationPresetId;
  automationAddons?: AutomationAddonId[];
  contactInfo: string;
  experienceOrSize: string;
  notes: string;
  status: RegistrationStatus;
  assignedOrgId: string;
  adminNote: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActiveTenantContext {
  orgId: string;
  orgName: string;
  ownerName: string;
  ownerUid: string;
  ownerEmail: string;
  organizationPreset?: OrganizationPresetId;
}

export interface LinkedKidSession {
  orgId: string;
  memberDocId: string;
  memberId: string;
  email: string;
  ownerUid: string;
  sharedEmails: string[];
}
