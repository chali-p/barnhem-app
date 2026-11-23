import { createEmptyDaily, INITIAL_APP_STATE } from '../data/initialData';
import { getOrganizationPreset } from '../data/organizationPresets';
import {
  AppState,
  AutomationAddonId,
  Member,
  OrganizationPresetId,
} from '../types/barnhem';
import { getDateKey } from './timeRules';

const TENANT_STORAGE_PREFIX = 'barnhem_tenant_workspace_v1_';

function makeStarterMember(params: {
  id: string;
  role: Member['role'];
  group?: Member['group'];
  nickname: string;
  fullName: string;
  gender: 'M' | 'F';
  pin: string;
  emoji: string;
  todayKey: string;
}): Member {
  return {
    id: params.id,
    role: params.role,
    ...(params.group ? { group: params.group } : {}),
    nickname: params.nickname,
    fullName: params.fullName,
    gender: params.gender,
    pin: params.pin,
    emoji: params.emoji,
    stars: params.role === 'kid' ? 20 : 0,
    personalDriveUrl: '',
    restrictedDocsUrl: '',
    activeCoverStage: 1,
    unlockedCoverStages: [1],
    collectedSceneItems: [],
    ownedShopItemIds: [],
    avatar: {
      skinTone: 'warm',
      bodyType: 'regular',
      faceMood: 'happy',
      hairStyle: params.gender === 'F' ? 'tied_ponytail' : 'neat_short',
      hairColor: '#3B2F2F',
      outfitMode: 'lounge',
    },
    mySpace: {
      favoriteColor: 'พาสเทล',
      favoriteFood: 'ข้าวผัดไข่',
      favoritePet: 'น้องแมว',
      futureDream: 'เติบโตอย่างมีความสุข',
    },
    healthProfile: {
      bloodType: 'ไม่ระบุ',
      foodAllergies: 'ไม่มี',
      drugAllergies: 'ไม่มี',
      chronicConditions: 'ไม่มี',
      regularMeds: 'ไม่มี',
      emergencyNote: 'สุขภาพแข็งแรงปกติ',
    },
    streak: {
      currentMorningStreak: 0,
      bestMorningStreak: 0,
      lastOnTimeDateKey: null,
      streakMilestonesClaimed: 0,
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
    daily: createEmptyDaily(params.todayKey),
    starHistory: [],
  };
}

export function createStarterTenantState(
  orgId: string,
  orgName: string,
  ownerName: string,
  organizationPreset?: OrganizationPresetId,
  automationAddons?: AutomationAddonId[]
): AppState {
  const todayKey = getDateKey(new Date());
  const preset = getOrganizationPreset(organizationPreset);
  const cleanOwner = ownerName.trim() || preset.ownerRoleLabelTh;
  const cleanOrg = orgName.trim() || preset.titleTh;
  const effectiveAddons =
    Array.isArray(automationAddons) && automationAddons.length > 0
      ? automationAddons
      : preset.defaultAddons;

  return {
    members: [
      makeStarterMember({
        id: 'mgr_owner',
        role: 'manager',
        nickname: cleanOwner,
        fullName: `${cleanOwner} (${preset.ownerRoleLabelTh} · ${cleanOrg})`,
        gender: 'F',
        pin: '1234',
        emoji: '👩‍💼',
        todayKey,
      }),
      makeStarterMember({
        id: 'staff_main',
        role: 'staff',
        nickname: `${preset.staffRoleLabelTh} 1`,
        fullName: `${preset.staffRoleLabelTh} (${cleanOrg})`,
        gender: 'F',
        pin: '2345',
        emoji: '👩‍🏫',
        todayKey,
      }),
      makeStarterMember({
        id: 'kid_demo_1',
        role: 'kid',
        group: 1,
        nickname: preset.sampleMemberNickname,
        fullName: `${preset.memberRoleLabelTh} (แก้ชื่อ/เพิ่มสมาชิกได้ในโหมดผู้ดูแล)`,
        gender: 'F',
        pin: '1111',
        emoji: preset.sampleMemberEmoji,
        todayKey,
      }),
    ],
    shopItems: INITIAL_APP_STATE.shopItems,
    sickReports: [],
    snackBills: [],
    kitchenLogs: [],
    returnHomePhotos: [],
    announcements: [
      {
        id: `ann_welcome_${orgId}`,
        title: `ยินดีต้อนรับสู่พื้นที่ "${cleanOrg}" (${preset.emoji} ${preset.titleTh})`,
        body: `${preset.sampleGreetingTh} รหัส PIN เริ่มต้นสำหรับคุณ ${cleanOwner} คือ 1234 (ข้อมูลแยกเป็นส่วนตัว 100% ค่ะ)`,
        priority: 'normal',
        pinned: true,
        authorName: cleanOwner,
        authorRole: preset.ownerRoleLabelTh,
        createdAt: new Date().toISOString(),
      },
    ],
    polls: [],
    trips: [],
    privateMessages: [],
    lostFoundItems: [],
    supplyRequests: [],
    kindnessCards: [],
    deedRedemptions: [],
    friendVisits: [],
    goldenPoolLogs: [],
    staffLeaves: [],
    weeklyActivityLogs: [],
    settings: {
      ...INITIAL_APP_STATE.settings,
      syncWebhookUrl: '',
      returnHomeDriveUrl: '',
      creatorPins: ['1234'],
      isPublicHolidayToday: false,
      simulatedTimeIso: null,
      lastWeeklyClearedAt: null,
      useOwnStorageOnly: false,
      organizationPreset: preset.id,
      automationAddons: effectiveAddons,
    },
    lastSyncedAt: null,
  };
}

export interface OrgStorageOnboardingPref {
  useOwnStorageOnly: boolean;
  syncWebhookUrl: string;
  returnHomeDriveUrl: string;
  organizationPreset?: OrganizationPresetId;
  automationAddons?: AutomationAddonId[];
}

const ORG_ONBOARDING_PREF_PREFIX = 'barnhem_org_onboarding_pref_v1_';

export function saveOrgStorageOnboardingPref(
  uid: string,
  pref: OrgStorageOnboardingPref
): void {
  if (!uid) return;
  try {
    localStorage.setItem(`${ORG_ONBOARDING_PREF_PREFIX}${uid}`, JSON.stringify(pref));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadOrgStorageOnboardingPref(uid: string): OrgStorageOnboardingPref | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`${ORG_ONBOARDING_PREF_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrgStorageOnboardingPref>;
    return {
      useOwnStorageOnly: Boolean(parsed.useOwnStorageOnly),
      syncWebhookUrl: typeof parsed.syncWebhookUrl === 'string' ? parsed.syncWebhookUrl : '',
      returnHomeDriveUrl:
        typeof parsed.returnHomeDriveUrl === 'string' ? parsed.returnHomeDriveUrl : '',
      organizationPreset: parsed.organizationPreset,
      automationAddons: Array.isArray(parsed.automationAddons)
        ? parsed.automationAddons
        : undefined,
    };
  } catch {
    return null;
  }
}

export function loadTenantAppState(
  orgId: string,
  orgName: string,
  ownerName: string,
  organizationPreset?: OrganizationPresetId,
  automationAddons?: AutomationAddonId[]
): AppState {
  const inferredUid = orgId.startsWith('org_') ? orgId.slice(4) : '';
  const onboardingPref = inferredUid ? loadOrgStorageOnboardingPref(inferredUid) : null;
  const resolvedPreset = organizationPreset ?? onboardingPref?.organizationPreset;
  const resolvedAddons = automationAddons ?? onboardingPref?.automationAddons;

  try {
    const raw = localStorage.getItem(`${TENANT_STORAGE_PREFIX}${orgId}`);
    if (!raw) {
      const starter = createStarterTenantState(
        orgId,
        orgName,
        ownerName,
        resolvedPreset,
        resolvedAddons
      );
      if (onboardingPref) {
        const hasSheetUrl = Boolean(onboardingPref.syncWebhookUrl.trim());
        starter.settings = {
          ...starter.settings,
          useOwnStorageOnly: Boolean(onboardingPref.useOwnStorageOnly && hasSheetUrl),
          syncWebhookUrl: onboardingPref.syncWebhookUrl,
          returnHomeDriveUrl: onboardingPref.returnHomeDriveUrl,
        };
      }
      return starter;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const starter = createStarterTenantState(
      orgId,
      orgName,
      ownerName,
      resolvedPreset,
      resolvedAddons
    );
    const todayKey = getDateKey(new Date());
    const members = Array.isArray(parsed.members) && parsed.members.length > 0
      ? parsed.members.map((m) => ({
          ...m,
          daily: m.daily && m.daily.dateKey === todayKey ? m.daily : createEmptyDaily(todayKey),
        }))
      : starter.members;

    return {
      ...starter,
      ...parsed,
      members,
      settings: {
        ...starter.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return createStarterTenantState(
      orgId,
      orgName,
      ownerName,
      resolvedPreset,
      resolvedAddons
    );
  }
}

export function saveTenantAppStateLocal(orgId: string, state: AppState): void {
  try {
    localStorage.setItem(`${TENANT_STORAGE_PREFIX}${orgId}`, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

