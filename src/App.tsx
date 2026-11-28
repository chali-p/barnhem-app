import { onAuthStateChanged, User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CenteredAlertModal, QrScannerModal } from './components/CenteredAlertModal';
import { ChefView } from './components/ChefView';
import { CreatorView } from './components/CreatorView';
import { HouseRulesGuideView } from './components/HouseRulesGuideView';
import { KidActivityHistoryView } from './components/KidActivityHistoryView';
import { KidDutyRosterView } from './components/KidDutyRosterView';
import { KidHubView } from './components/KidHubView';
import { KidLostFoundView } from './components/KidLostFoundView';
import { KidSecretVoteView } from './components/KidSecretVoteView';
import { KidStarSummaryView } from './components/KidStarSummaryView';
import { KidSupplyRequestView } from './components/KidSupplyRequestView';
import { MagicDoorView } from './components/MagicDoorView';
import { ManagerView } from './components/ManagerView';
import { PlatformPortalView } from './components/PlatformPortalView';
import { ShortcutManualView } from './components/ShortcutManualView';
import { StaffSystemGuideView } from './components/StaffSystemGuideView';
import { StaffView } from './components/StaffView';
import { TimestampCameraModal } from './components/TimestampCameraModal';
import { TutorView } from './components/TutorView';
import { createEmptyDaily } from './data/initialData';
import { auth, signInWithGoogleCloud, signOutCloud } from './firebase';
import {
  DEFAULT_ORG_ID,
  isMasterAdminEmail,
  MASTER_ADMIN_EMAIL,
  pullFoundationCloudOnce,
  pullPublicKioskBoardOnce,
  seedCloudIfEmpty,
  subscribeFoundationCloud,
  subscribeLinkedKidCloud,
  subscribePublicKioskBoard,
  syncLinkedKidPollVoteToCloud,
  syncLinkedKidSelfToCloud,
  syncPublicKioskBoardNow,
  syncStateDiffToCloud,
} from './services/firestoreSync';
import { subscribeMyRegistration } from './services/platformRegistrations';
import {
  ActiveTenantContext,
  Announcement,
  AppMode,
  AppState,
  CommandAccessRule,
  CustomQuickCommand,
  DeedRedemption,
  FriendVisitRequest,
  GoldenPoolLog,
  KindnessCard,
  Language,
  LinkedKidSession,
  LostFoundItem,
  Member,
  ModalAlertPayload,
  OutingTrip,
  PastelTheme,
  PrivateCareMessage,
  ReturnHomePhoto,
  SecretPoll,
  ShopItem,
  SickReport,
  SnackBill,
  StaffLeaveRecord,
  SupplyRequest,
  TimedScheduleSlot,
  WeeklyActivityLog,
  WeeklyActivityStatus,
} from './types/barnhem';
import {
  evaluateExpressKioskScan,
  evaluateOneTapCustomCommand,
  evaluateOneTapGoToSchool,
  evaluateOneTapHomeAction,
  HOME_QUICK_ACTIONS,
  HomeQuickActionId,
  isCustomCommandDoneForKid,
  isHomeActionDoneForKid,
  playKioskChime,
  sanitizeSaturdayLatePenaltyPoll,
} from './utils/expressKiosk';
import {
  applyDailySchoolDeduction,
  applyRulePenaltyToKidAndPool,
  ensureCurrentWeekAllowance,
  getMondayWeekKey,
  triggerManualMondayReset,
} from './utils/piggyBank';
import {
  loadAppState,
  postSyncToDriveOrSheet,
  saveAppStateLocal,
} from './utils/syncStorage';
import {
  loadTenantAppState,
  saveTenantAppStateLocal,
} from './utils/tenantTemplate';
import {
  hasExpiredWeeklyActivityLogs,
  pruneWeeklyActivityLogs,
} from './utils/activityLogRetention';
import { getDateKey, getEffectiveNow } from './utils/timeRules';

const THEME_OPTIONS: { id: PastelTheme; swatch: string; labelTh: string; labelEn: string }[] = [
  { id: 'rose', swatch: '#F5B0C0', labelTh: 'ชมพูครีม', labelEn: 'Cream Rose' },
  { id: 'mint', swatch: '#9DE2D6', labelTh: 'เขียวมิ้นท์', labelEn: 'Soft Mint' },
  { id: 'sky', swatch: '#9ED2F2', labelTh: 'ฟ้าอ่อน', labelEn: 'Sky Blue' },
  { id: 'yellow', swatch: '#FBE07E', labelTh: 'เหลืองละมุน', labelEn: 'Butter Yellow' },
  { id: 'lavender', swatch: '#CEBBE8', labelTh: 'ม่วงลาเวนเดอร์', labelEn: 'Lavender' },
  { id: 'peach', swatch: '#F5C4A8', labelTh: 'ส้มพีช', labelEn: 'Soft Peach' },
];

const ACTIVE_TENANT_STORAGE_KEY = 'barnhem_active_tenant_v1';

function mergePollsFromKioskBoard(
  localPolls: SecretPoll[],
  cloudPolls: SecretPoll[]
): SecretPoll[] {
  const localById = new Map(localPolls.map((p) => [p.id, p]));
  return cloudPolls.map((cp) => {
    const lp = localById.get(cp.id);
    if (!lp) return cp;
    const localOnlyVoters = lp.votedKidIds.filter(
      (kidId) => !cp.votedKidIds.includes(kidId)
    );
    if (localOnlyVoters.length === 0) {
      return lp.kidChoices ? { ...cp, kidChoices: lp.kidChoices } : cp;
    }
    const optionExtraVotes = new Map<string, number>();
    for (const kidId of localOnlyVoters) {
      const chosenOptId = lp.kidChoices?.[kidId];
      if (chosenOptId) {
        optionExtraVotes.set(chosenOptId, (optionExtraVotes.get(chosenOptId) ?? 0) + 1);
      }
    }
    return {
      ...cp,
      options: cp.options.map((opt) => ({
        ...opt,
        votes: opt.votes + (optionExtraVotes.get(opt.id) ?? 0),
      })),
      votedKidIds: [...cp.votedKidIds, ...localOnlyVoters],
      ...(lp.kidChoices ? { kidChoices: lp.kidChoices } : {}),
    };
  });
}

export default function App() {
  const [activeTenant, setActiveTenant] = useState<ActiveTenantContext | null>(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ActiveTenantContext;
      if (!parsed?.orgId || parsed.orgId === 'org_minimart_studio') {
        sessionStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveTenantContext;
        if (parsed?.orgId && parsed.orgId !== 'org_minimart_studio') {
          return loadTenantAppState(
            parsed.orgId,
            parsed.orgName,
            parsed.ownerName,
            parsed.organizationPreset
          );
        }
      }
    } catch {
      // fallback to default home state
    }
    return loadAppState();
  });
  const [lang, setLang] = useState<Language>('th');
  const [pastelTheme, setPastelTheme] = useState<PastelTheme>(() => {
    const saved = localStorage.getItem('barnhem_pastel_theme');
    return saved === 'mint' ||
      saved === 'sky' ||
      saved === 'yellow' ||
      saved === 'lavender' ||
      saved === 'peach'
      ? saved
      : 'rose';
  });
  const [mode, setMode] = useState<AppMode>('magic_door');
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [returnToManagerAfterKid, setReturnToManagerAfterKid] = useState(false);

  const [loggedInStaff, setLoggedInStaff] = useState<Member | null>(null);
  const [loggedInChef, setLoggedInChef] = useState<Member | null>(null);
  const [loggedInTutor, setLoggedInTutor] = useState<Member | null>(null);
  const [loggedInManager, setLoggedInManager] = useState<Member | null>(null);
  const [creatorUnlocked, setCreatorUnlocked] = useState(false);
  const [creatorKioskOpen, setCreatorKioskOpen] = useState(false);
  const [manualTimestampCamOpen, setManualTimestampCamOpen] = useState(false);

  const [now, setNow] = useState<Date>(() =>
    getEffectiveNow(state.settings.simulatedTimeIso)
  );
  const [alertPayload, setAlertPayload] = useState<ModalAlertPayload | null>(null);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [linkedKidSession, setLinkedKidSession] = useState<LinkedKidSession | null>(null);

  const stateRef = useRef<AppState>(state);
  stateRef.current = state;
  const cloudUserRef = useRef<User | null>(cloudUser);
  cloudUserRef.current = cloudUser;
  const activeTenantRef = useRef<ActiveTenantContext | null>(activeTenant);
  activeTenantRef.current = activeTenant;
  const linkedKidSessionRef = useRef<LinkedKidSession | null>(linkedKidSession);
  linkedKidSessionRef.current = linkedKidSession;
  const manualLeftTenantRef = useRef(false);
  const langRef = useRef<Language>(lang);
  langRef.current = lang;
  const pendingRetryBaseStateRef = useRef<AppState | null>(null);
  const hasMergedInitialCloudMembersRef = useRef(false);
  const hasMergedInitialCloudRecordsRef = useRef(false);
  const hasSyncedKioskBoardRef = useRef(false);
  const lastCloudPullAtRef = useRef(0);

  const persistActiveStateLocal = useCallback((nextState: AppState, tenant: ActiveTenantContext | null) => {
    if (linkedKidSessionRef.current) {
      return;
    }
    if (tenant) {
      saveTenantAppStateLocal(tenant.orgId, nextState);
    } else {
      saveAppStateLocal(nextState);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-pastel-theme', pastelTheme);
    localStorage.setItem('barnhem_pastel_theme', pastelTheme);
  }, [pastelTheme]);

  // Auto-activate approved external foundation workspace when signed in
  useEffect(() => {
    if (!cloudUser || isMasterAdminEmail(cloudUser.email)) return;
    if (activeTenant || manualLeftTenantRef.current) return;

    const unsub = subscribeMyRegistration(cloudUser.uid, (reg) => {
      if (
        reg &&
        reg.status === 'approved' &&
        reg.applicationType === 'open_organization' &&
        !manualLeftTenantRef.current &&
        !activeTenantRef.current
      ) {
        const ctx: ActiveTenantContext = {
          orgId: reg.assignedOrgId,
          orgName: reg.organizationName,
          ownerName: reg.nickname || reg.applicantName,
          ownerUid: reg.uid,
          ownerEmail: reg.email,
        };
        sessionStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, JSON.stringify(ctx));
        activeTenantRef.current = ctx;
        setActiveTenant(ctx);
        const tenantState = loadTenantAppState(
          ctx.orgId,
          ctx.orgName,
          ctx.ownerName,
          reg.organizationPreset,
          reg.automationAddons
        );
        stateRef.current = tenantState;
        setState(tenantState);
        setSelectedKidId(null);
        setLoggedInStaff(null);
        setLoggedInChef(null);
        setLoggedInTutor(null);
        setLoggedInManager(null);
        setCreatorUnlocked(false);
      }
    });
    return () => unsub();
  }, [cloudUser, activeTenant]);

  // Firebase Auth & Tenant-Scoped Real-Time Firestore Sync
  useEffect(() => {
    let cancelled = false;
    let unsubCloud: (() => void) | null = null;
    let unsubKioskBoard: (() => void) | null = null;

    const attachPublicKioskBoard = (orgId: string) => {
      if (unsubKioskBoard) {
        unsubKioskBoard();
        unsubKioskBoard = null;
      }
      unsubKioskBoard = subscribePublicKioskBoard(orgId, ({ polls, announcements }) => {
        if (cancelled) return;
        setState((prev) => {
          const mergedPolls = mergePollsFromKioskBoard(prev.polls, polls);
          const next: AppState = {
            ...prev,
            polls: mergedPolls,
            announcements,
            lastSyncedAt: new Date().toISOString(),
          };
          stateRef.current = next;
          if (!linkedKidSessionRef.current) {
            persistActiveStateLocal(next, activeTenantRef.current);
          }
          return next;
        });
      });
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      setCloudUser(user);
      cloudUserRef.current = user;
      setCloudSyncError(null);
      hasMergedInitialCloudMembersRef.current = false;
      hasMergedInitialCloudRecordsRef.current = false;
      hasSyncedKioskBoardRef.current = false;
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }
      if (unsubKioskBoard) {
        unsubKioskBoard();
        unsubKioskBoard = null;
      }
      if (!user) {
        manualLeftTenantRef.current = false;
        pendingRetryBaseStateRef.current = null;
        if (linkedKidSessionRef.current) {
          linkedKidSessionRef.current = null;
          setLinkedKidSession(null);
          setSelectedKidId(null);
          const restored = loadAppState();
          stateRef.current = restored;
          setState(restored);
        }
        if (activeTenantRef.current) {
          sessionStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
          activeTenantRef.current = null;
          setActiveTenant(null);
          const mainState = loadAppState();
          stateRef.current = mainState;
          setState(mainState);
        }
        setCloudSyncing(false);
        attachPublicKioskBoard(DEFAULT_ORG_ID);
        return;
      }

      const tenant = activeTenantRef.current;
      const isMaster = isMasterAdminEmail(user.email);
      const canSyncTenant = Boolean(tenant && tenant.ownerUid === user.uid);
      const canSyncMain = !tenant && isMaster;

      // If user is neither org owner nor master admin, check if they are a linked kid logging in on their own device
      if (!canSyncTenant && !canSyncMain) {
        setCloudSyncing(true);
        attachPublicKioskBoard(tenant?.orgId ?? DEFAULT_ORG_ID);
        unsubCloud = subscribeLinkedKidCloud(
          user,
          ({ member, session }) => {
            if (activeTenantRef.current) return;
            const isInitialKidActivation =
              !linkedKidSessionRef.current ||
              linkedKidSessionRef.current.memberDocId !== session.memberDocId;
            linkedKidSessionRef.current = session;
            setLinkedKidSession(session);
            setState((prev) => {
              const next: AppState = {
                ...prev,
                members: [member],
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              return next;
            });
            if (isInitialKidActivation) {
              setMode('magic_door');
              setSelectedKidId(member.id);
            }
            setCloudSyncing(false);
          },
          () => {
            if (linkedKidSessionRef.current) {
              linkedKidSessionRef.current = null;
              setLinkedKidSession(null);
              setSelectedKidId(null);
              const restored = loadAppState();
              stateRef.current = restored;
              setState(restored);
            }
            setCloudSyncing(false);
          },
          (patch) => {
            if (!linkedKidSessionRef.current) return;
            setState((prev) => {
              const next: AppState = {
                ...prev,
                ...patch,
                ...(patch.polls
                  ? { polls: mergePollsFromKioskBoard(prev.polls, patch.polls) }
                  : {}),
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              return next;
            });
          },
          (settings) => {
            if (!linkedKidSessionRef.current) return;
            setState((prev) => {
              const next: AppState = {
                ...prev,
                settings,
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              return next;
            });
          }
        );
        return;
      }

      if (linkedKidSessionRef.current) {
        linkedKidSessionRef.current = null;
        setLinkedKidSession(null);
      }

      // Skip central Firestore writes/subscriptions when external org uses its own local + Sheet/Drive storage
      if (canSyncTenant && stateRef.current.settings.useOwnStorageOnly) {
        setCloudSyncing(false);
        return;
      }

      const orgId = canSyncTenant && tenant ? tenant.orgId : DEFAULT_ORG_ID;
      setCloudSyncing(true);
      try {
        await seedCloudIfEmpty(stateRef.current, user, orgId);
        if (cancelled) return;
        unsubCloud = subscribeFoundationCloud(
          user,
          (cloudMembers) => {
            const isFirstMerge = !hasMergedInitialCloudMembersRef.current;
            hasMergedInitialCloudMembersRef.current = true;
            let resolvedMembers = cloudMembers;
            let shouldPushMergedTrash = false;

            if (isFirstMerge) {
              const prevLocal = stateRef.current;
              const localTodayKey = getDateKey(
                getEffectiveNow(prevLocal.settings.simulatedTimeIso)
              );
              const localById = new Map(prevLocal.members.map((m) => [m.id, m]));
              resolvedMembers = cloudMembers.map((cm) => {
                const lm = localById.get(cm.id);
                if (!lm) return cm;
                const mergedByDate = {
                  ...(lm.daily?.trashDutyByDate ?? {}),
                  ...(cm.daily?.trashDutyByDate ?? {}),
                };
                if (
                  lm.daily?.dateKey &&
                  lm.daily.trashDutyDone &&
                  !mergedByDate[lm.daily.dateKey]?.done
                ) {
                  mergedByDate[lm.daily.dateKey] = {
                    done: true,
                    doneAt: lm.daily.trashDutyDoneAt ?? null,
                    confirmedBy: lm.daily.trashDutyConfirmedBy ?? cm.nickname,
                  };
                }
                const hasNewLocalDateEntries =
                  Object.keys(mergedByDate).length >
                  Object.keys(cm.daily?.trashDutyByDate ?? {}).length;
                const needsSameDayTrashMerge =
                  lm.daily?.dateKey === localTodayKey &&
                  cm.daily?.dateKey === localTodayKey &&
                  lm.daily.trashDutyDone &&
                  !cm.daily.trashDutyDone &&
                  lm.daily.trashDutyDoneAt;
                if (needsSameDayTrashMerge || hasNewLocalDateEntries) {
                  shouldPushMergedTrash = true;
                  return {
                    ...cm,
                    daily: {
                      ...cm.daily,
                      ...(needsSameDayTrashMerge
                        ? {
                            trashDutyDone: true,
                            trashDutyDoneAt: lm.daily.trashDutyDoneAt,
                            trashDutyConfirmedBy: lm.daily.trashDutyConfirmedBy ?? cm.nickname,
                          }
                        : {}),
                      trashDutyByDate: mergedByDate,
                    },
                  };
                }
                return cm;
              });
            }

            setCloudSyncError(null);
            const baseForPush = stateRef.current;
            setState((prev) => {
              const next: AppState = {
                ...prev,
                members: resolvedMembers,
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              persistActiveStateLocal(next, activeTenantRef.current);
              return next;
            });

            if (shouldPushMergedTrash) {
              const cloudOnlyPrev: AppState = { ...baseForPush, members: cloudMembers };
              void syncStateDiffToCloud(cloudOnlyPrev, stateRef.current, user, orgId).catch((err) => {
                console.error('Auto-merge local trash duty sync error:', err);
                pendingRetryBaseStateRef.current = pendingRetryBaseStateRef.current ?? cloudOnlyPrev;
                setCloudSyncError(err instanceof Error ? err.message : String(err));
              });
            }
          },
          (patch) => {
            const isFirstRecordsMerge = !hasMergedInitialCloudRecordsRef.current;
            hasMergedInitialCloudRecordsRef.current = true;
            setCloudSyncError(null);
            const baseLocal = stateRef.current;
            let resolvedPatch = patch;
            let shouldPushLocalPolls = false;

            if (
              isFirstRecordsMerge &&
              (patch.polls?.length ?? 0) === 0 &&
              baseLocal.polls.length > 0
            ) {
              const sanitizedLocalPolls = baseLocal.polls
                .filter((p) => p && p.id !== 'poll_weekend_activity')
                .map((p) => sanitizeSaturdayLatePenaltyPoll(p).poll);
              if (sanitizedLocalPolls.length > 0) {
                resolvedPatch = { ...patch, polls: sanitizedLocalPolls };
                shouldPushLocalPolls = true;
              }
            }

            setState((prev) => {
              const next: AppState = {
                ...prev,
                ...resolvedPatch,
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              persistActiveStateLocal(next, activeTenantRef.current);
              return next;
            });

            if (shouldPushLocalPolls) {
              hasSyncedKioskBoardRef.current = true;
              const cloudOnlyPrev: AppState = { ...baseLocal, polls: [] };
              const nextStateForPush: AppState = { ...baseLocal, ...resolvedPatch };
              void syncStateDiffToCloud(cloudOnlyPrev, nextStateForPush, user, orgId).catch((err) => {
                console.error('Auto-merge local polls sync error:', err);
                pendingRetryBaseStateRef.current = pendingRetryBaseStateRef.current ?? cloudOnlyPrev;
                setCloudSyncError(err instanceof Error ? err.message : String(err));
              });
            } else if (!hasSyncedKioskBoardRef.current) {
              hasSyncedKioskBoardRef.current = true;
              const nextStateForKiosk: AppState = { ...baseLocal, ...resolvedPatch };
              void syncPublicKioskBoardNow(nextStateForKiosk, user, orgId).catch((err) => {
                console.error('Initial kiosk_board publish error:', err);
              });
            }
          },
          (settings) => {
            setCloudSyncError(null);
            setState((prev) => {
              const next: AppState = {
                ...prev,
                settings,
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              persistActiveStateLocal(next, activeTenantRef.current);
              return next;
            });
          },
          orgId,
          (err) => {
            setCloudSyncError(err instanceof Error ? err.message : String(err));
          }
        );
      } catch (err) {
        console.error('Cloud sync initialization error:', err);
        setCloudSyncError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setCloudSyncing(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubCloud) unsubCloud();
      if (unsubKioskBoard) unsubKioskBoard();
    };
  }, [activeTenant?.orgId, state.settings.useOwnStorageOnly, persistActiveStateLocal]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = getEffectiveNow(state.settings.simulatedTimeIso);
      setNow(current);
      const todayKey = getDateKey(current);
      const currentWeekKey = getMondayWeekKey(current);
      setState((prev) => {
        const needsDailyReset = prev.members.some(
          (m) => m.daily && m.daily.dateKey !== todayKey
        );
        const needsWeekRollover = prev.members.some(
          (m) => m.role === 'kid' && m.allowance?.weekKey !== currentWeekKey
        );
        const needsLogRetentionPrune = hasExpiredWeeklyActivityLogs(prev.weeklyActivityLogs, current);
        if (!needsDailyReset && !needsWeekRollover && !needsLogRetentionPrune) return prev;
        const next: AppState = {
          ...prev,
          members: prev.members.map((m) => {
            let nextMember =
              m.daily.dateKey === todayKey ? m : { ...m, daily: createEmptyDaily(todayKey, m.daily) };
            if (nextMember.role === 'kid' && nextMember.allowance?.weekKey !== currentWeekKey) {
              const { allowance } = ensureCurrentWeekAllowance(nextMember, current, prev.settings);
              nextMember = { ...nextMember, allowance };
            }
            return nextMember;
          }),
          weeklyActivityLogs: needsLogRetentionPrune
            ? pruneWeeklyActivityLogs(prev.weeklyActivityLogs, current)
            : prev.weeklyActivityLogs,
        };
        stateRef.current = next;
        persistActiveStateLocal(next, activeTenantRef.current);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.settings.simulatedTimeIso, persistActiveStateLocal]);

  const showAlert = useCallback((payload: ModalAlertPayload) => {
    setAlertPayload(payload);
  }, []);

  const pushStateDiffSafely = useCallback(
    async (prev: AppState, next: AppState, user: User, orgId: string) => {
      const effectivePrev = pendingRetryBaseStateRef.current ?? prev;
      try {
        await syncStateDiffToCloud(effectivePrev, next, user, orgId);
        pendingRetryBaseStateRef.current = null;
        setCloudSyncError(null);
      } catch (err) {
        console.error('Cloud sync write error:', err);
        pendingRetryBaseStateRef.current = pendingRetryBaseStateRef.current ?? prev;
        setCloudSyncError(err instanceof Error ? err.message : String(err));
      }
    },
    []
  );

  const commitStateChange = useCallback(
    (updater: (prev: AppState) => AppState, eventLabel: string) => {
      const prev = stateRef.current;
      const next = updater(prev);
      const effectiveNow = getEffectiveNow(next.settings.simulatedTimeIso);
      const withSyncMeta: AppState = {
        ...next,
        weeklyActivityLogs: pruneWeeklyActivityLogs(next.weeklyActivityLogs, effectiveNow),
        lastSyncedAt: new Date().toISOString(),
      };
      const tenant = activeTenantRef.current;
      const kidSession = linkedKidSessionRef.current;
      stateRef.current = withSyncMeta;
      setState(withSyncMeta);
      persistActiveStateLocal(withSyncMeta, tenant);
      const user = cloudUserRef.current;
      if (kidSession && user) {
        const prevKid = prev.members.find((m) => m.id === kidSession.memberId);
        const nextKid = withSyncMeta.members.find((m) => m.id === kidSession.memberId);
        if (prevKid && nextKid) {
          void syncLinkedKidSelfToCloud(prevKid, nextKid, kidSession, user).catch((err) => {
            console.error('Linked kid sync error:', err);
            setCloudSyncError(err instanceof Error ? err.message : String(err));
          });
        }
        if (withSyncMeta.polls !== prev.polls) {
          const changedPolls = withSyncMeta.polls.filter((nextPoll) => {
            const prevPoll = prev.polls.find((p) => p.id === nextPoll.id);
            return !prevPoll || JSON.stringify(prevPoll) !== JSON.stringify(nextPoll);
          });
          for (const poll of changedPolls) {
            void syncLinkedKidPollVoteToCloud(poll, kidSession, user).catch((err) => {
              console.error('Linked kid poll vote sync error:', err);
              setCloudSyncError(err instanceof Error ? err.message : String(err));
            });
          }
        }
        return;
      }
      void postSyncToDriveOrSheet(withSyncMeta, eventLabel);
      if (user) {
        const canSyncTenant = Boolean(tenant && tenant.ownerUid === user.uid);
        const canSyncMain = !tenant && isMasterAdminEmail(user.email);
        if (canSyncTenant && tenant && !withSyncMeta.settings.useOwnStorageOnly) {
          void pushStateDiffSafely(prev, withSyncMeta, user, tenant.orgId);
        } else if (canSyncMain) {
          void pushStateDiffSafely(prev, withSyncMeta, user, DEFAULT_ORG_ID);
        }
      }
    },
    [persistActiveStateLocal, pushStateDiffSafely]
  );

  const handlePullFromCloud = useCallback(
    async (options?: { silent?: boolean }) => {
      const user = cloudUserRef.current;
      if (!user) return;
      const tenant = activeTenantRef.current;
      const canSyncTenant = Boolean(tenant && tenant.ownerUid === user.uid);
      const canSyncMain = !tenant && isMasterAdminEmail(user.email);
      if (!canSyncTenant && !canSyncMain) return;
      if (canSyncTenant && stateRef.current.settings.useOwnStorageOnly) return;
      const orgId = canSyncTenant && tenant ? tenant.orgId : DEFAULT_ORG_ID;

      lastCloudPullAtRef.current = Date.now();
      if (!options?.silent) setCloudSyncing(true);
      try {
        if (pendingRetryBaseStateRef.current) {
          await pushStateDiffSafely(
            pendingRetryBaseStateRef.current,
            stateRef.current,
            user,
            orgId
          );
        }
        const pulled = await pullFoundationCloudOnce(user, orgId);
        setCloudSyncError(null);
        setState((prev) => {
          const next: AppState = {
            ...prev,
            ...(pulled.members ? { members: pulled.members } : {}),
            ...(pulled.recordsPatch ?? {}),
            ...(pulled.settings ? { settings: pulled.settings } : {}),
            lastSyncedAt: new Date().toISOString(),
          };
          stateRef.current = next;
          persistActiveStateLocal(next, activeTenantRef.current);
          return next;
        });
        if (!options?.silent) {
          showAlert({
            icon: '☁️✅',
            title:
              langRef.current === 'th'
                ? 'ดึงข้อมูลล่าสุดจากคลาวด์แล้ว!'
                : 'Synced Latest Cloud Data!',
            message:
              langRef.current === 'th'
                ? 'อัปเดตสถานะเวรทิ้งขยะ รายชื่อ และข้อมูลทั้งหมดให้ตรงกับคลาวด์ล่าสุดเรียบร้อยค่ะ'
                : 'Trash duty, members, and records are now refreshed from the cloud.',
            tone: 'mint',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setCloudSyncError(msg);
        if (!options?.silent) {
          showAlert({
            icon: '⚠️',
            title:
              langRef.current === 'th'
                ? 'ดึงข้อมูลจากคลาวด์ไม่สำเร็จ'
                : 'Cloud Refresh Failed',
            message: msg,
            tone: 'pink',
          });
        }
      } finally {
        if (!options?.silent) setCloudSyncing(false);
      }
    },
    [persistActiveStateLocal, pushStateDiffSafely, showAlert]
  );

  const handleRefreshSecretPolls = useCallback(async () => {
    const user = cloudUserRef.current;
    const tenant = activeTenantRef.current;
    const canSyncTenant = Boolean(user && tenant && tenant.ownerUid === user.uid);
    const canSyncMain = Boolean(user && !tenant && isMasterAdminEmail(user.email));
    const orgId = tenant ? tenant.orgId : DEFAULT_ORG_ID;

    if (user && (canSyncMain || canSyncTenant) && !(canSyncTenant && stateRef.current.settings.useOwnStorageOnly)) {
      await handlePullFromCloud({ silent: true });
      try {
        await syncPublicKioskBoardNow(stateRef.current, user, orgId);
      } catch (err) {
        console.error('Public kiosk_board manual sync failed:', err);
      }
      const openCount = stateRef.current.polls.filter((p) => !p.closed).length;
      showAlert({
        icon: '☁️✅',
        title: langRef.current === 'th' ? 'อัปเดตหัวข้อโหวตล่าสุดแล้ว!' : 'Polls Refreshed!',
        message:
          langRef.current === 'th'
            ? `ซิงค์ข้อมูลจากคลาวด์และเผยแพร่ขึ้นกระดานแท็บเล็ตเรียบร้อย (${openCount} หัวข้อเปิดรับอยู่)`
            : `Synced from cloud and published to tablet board (${openCount} open).`,
        tone: 'mint',
      });
      return;
    }

    setCloudSyncing(true);
    try {
      const board = await pullPublicKioskBoardOnce(orgId);
      if (!board) {
        showAlert({
          icon: '📲',
          title:
            langRef.current === 'th'
              ? 'ยังไม่มีหัวข้อโหวตบนคลาวด์'
              : 'No Cloud Polls Found Yet',
          message:
            langRef.current === 'th'
              ? 'กรุณาเปิดหน้าเว็บที่เครื่องหลัก (ที่สร้างหัวข้อโหวตไว้) แล้วรีเฟรชหน้า 1 ครั้ง เพื่อให้หัวข้อถูกส่งขึ้นคลาวด์อัตโนมัติค่ะ'
              : 'Please open and refresh the app once on the main Creator device so polls publish to the cloud.',
          tone: 'peach',
        });
        return;
      }
      setCloudSyncError(null);
      setState((prev) => {
        const mergedPolls = mergePollsFromKioskBoard(prev.polls, board.polls);
        const next: AppState = {
          ...prev,
          polls: mergedPolls,
          announcements: board.announcements,
          lastSyncedAt: new Date().toISOString(),
        };
        stateRef.current = next;
        if (!linkedKidSessionRef.current) {
          persistActiveStateLocal(next, activeTenantRef.current);
        }
        return next;
      });
      const openCount = board.polls.filter((p) => !p.closed).length;
      showAlert({
        icon: '☁️✅',
        title: langRef.current === 'th' ? 'ดึงหัวข้อโหวตล่าสุดแล้ว!' : 'Polls Updated!',
        message:
          board.polls.length > 0
            ? langRef.current === 'th'
              ? `พบหัวข้อโหวตทั้งหมด ${board.polls.length} หัวข้อ (เปิดรับอยู่ ${openCount} หัวข้อ)`
              : `Loaded ${board.polls.length} poll(s) (${openCount} open).`
            : langRef.current === 'th'
            ? 'เชื่อมต่อคลาวด์สำเร็จ แต่ยังไม่มีหัวข้อโหวตในขณะนี้ค่ะ (รบกวนรีเฟรชหน้าเครื่องหลัก 1 ครั้งหากเพิ่งสร้างหัวข้อไว้)'
            : 'Connected to cloud, but no polls are posted right now.',
        tone: 'mint',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCloudSyncError(msg);
      showAlert({
        icon: '⚠️',
        title: langRef.current === 'th' ? 'ดึงหัวข้อโหวตไม่สำเร็จ' : 'Refresh Failed',
        message: msg,
        tone: 'pink',
      });
    } finally {
      setCloudSyncing(false);
    }
  }, [handlePullFromCloud, persistActiveStateLocal, showAlert]);

  // Auto-refresh from Firestore when browser wakes/focuses tab or regains internet
  useEffect(() => {
    const triggerRefreshIfDue = () => {
      if (Date.now() - lastCloudPullAtRef.current < 8000) return;
      void handlePullFromCloud({ silent: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerRefreshIfDue();
      }
    };
    const handleOnline = () => {
      lastCloudPullAtRef.current = 0;
      triggerRefreshIfDue();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [handlePullFromCloud]);

  const handleForceSeedCloud = useCallback(async () => {
    const user = cloudUserRef.current;
    if (!user) return;
    const tenant = activeTenantRef.current;
    const canSyncTenant = Boolean(tenant && tenant.ownerUid === user.uid);
    const canSyncMain = !tenant && isMasterAdminEmail(user.email);
    if (!canSyncTenant && !canSyncMain) return;
    if (canSyncTenant && stateRef.current.settings.useOwnStorageOnly) return;
    const orgId = canSyncTenant && tenant ? tenant.orgId : DEFAULT_ORG_ID;

    setCloudSyncing(true);
    try {
      const emptyPrev: AppState = {
        ...stateRef.current,
        members: [],
        shopItems: [],
        sickReports: [],
        snackBills: [],
        kitchenLogs: [],
        announcements: [],
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
      };
      await syncStateDiffToCloud(emptyPrev, stateRef.current, user, orgId);
      pendingRetryBaseStateRef.current = null;
      setCloudSyncError(null);
      showAlert({
        icon: '☁️⬆️',
        title:
          langRef.current === 'th'
            ? 'อัปโหลดข้อมูลจากเครื่องนี้ขึ้นคลาวด์แล้ว!'
            : 'Uploaded Local Data to Cloud!',
        message:
          langRef.current === 'th'
            ? 'ข้อมูลทั้งหมดของเครื่องนี้ถูกบันทึกขึ้นคลาวด์แล้ว เครื่องอื่นสามารถกดรีเฟรชหรือรอรับข้อมูลอัตโนมัติได้เลยค่ะ'
            : 'All data from this device has been pushed to the cloud.',
        tone: 'mint',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCloudSyncError(msg);
      showAlert({
        icon: '⚠️',
        title:
          langRef.current === 'th'
            ? 'อัปโหลดขึ้นคลาวด์ไม่สำเร็จ'
            : 'Upload to Cloud Failed',
        message: msg,
        tone: 'pink',
      });
    } finally {
      setCloudSyncing(false);
    }
  }, [showAlert]);

  const makeWeeklyLog = useCallback(
    (
      kid: Member,
      actionLabel: string,
      status: WeeklyActivityStatus,
      recordedBy: string,
      note?: string
    ): WeeklyActivityLog => {
      const timeText = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return {
        id: `wal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kidId: kid.id,
        kidNickname: kid.nickname,
        kidEmoji: kid.emoji,
        kidGroup: kid.group,
        dateKey: getDateKey(now),
        timeText: `${timeText} น.`,
        actionLabel,
        status,
        ...(note ? { note } : {}),
        recordedBy,
        createdAt: now.toISOString(),
      };
    },
    [now]
  );

  const handleUpdateKid = useCallback(
    (kidId: string, updater: (prev: Member) => Member, eventLabel: string) => {
      commitStateChange((prev) => {
        const prevKid = prev.members.find((m) => m.id === kidId);
        if (!prevKid) return prev;
        const nextKid = updater(prevKid);
        let extraLogs: WeeklyActivityLog[] = [];

        if (prevKid.role === 'kid') {
          const prevFine = prevKid.penalty?.lateFineThb ?? 0;
          const nextFine = nextKid.penalty?.lateFineThb ?? 0;
          const prevAway = prevKid.allowance?.awayUntilDateKey ?? '';
          const nextAway = nextKid.allowance?.awayUntilDateKey ?? '';
          const dailyChanged = JSON.stringify(prevKid.daily) !== JSON.stringify(nextKid.daily);
          const starHistoryChanged =
            (nextKid.starHistory?.length ?? 0) !== (prevKid.starHistory?.length ?? 0) ||
            nextKid.stars !== prevKid.stars;
          const shopChanged =
            (nextKid.ownedShopItemIds?.length ?? 0) !== (prevKid.ownedShopItemIds?.length ?? 0);
          const coinChanged =
            (nextKid.allowance?.coinHistory?.length ?? 0) !==
            (prevKid.allowance?.coinHistory?.length ?? 0);
          const isLateLabel =
            eventLabel.toLowerCase().includes('late') || eventLabel.includes('สาย');

          if (nextAway && nextAway !== prevAway) {
            extraLogs = [
              makeWeeklyLog(
                nextKid,
                'ลา / กลับบ้าน / ไม่อยู่',
                'sick_leave',
                'ระบบเช็คชื่อ',
                nextKid.allowance?.awayReason
              ),
            ];
          } else if (nextFine > prevFine || isLateLabel) {
            extraLogs = [
              makeWeeklyLog(nextKid, eventLabel || 'ทำรายการสาย', 'late', 'ระบบเช็คชื่อ'),
            ];
          } else if (dailyChanged) {
            extraLogs = [
              makeWeeklyLog(nextKid, eventLabel || 'ใช้งาน / เช็คอินประจำวัน', 'on_time', 'น้องกดเช็คอิน'),
            ];
          } else if (starHistoryChanged || shopChanged || coinChanged) {
            const latestReason = nextKid.starHistory?.[0]?.reason;
            extraLogs = [
              makeWeeklyLog(
                nextKid,
                eventLabel || latestReason || 'ทำรายการโปรไฟล์ / มินิมาร์ท',
                'on_time',
                'น้องทำรายการ',
                latestReason && latestReason !== eventLabel ? latestReason : undefined
              ),
            ];
          }
        }

        return {
          ...prev,
          members: prev.members.map((m) => (m.id === kidId ? nextKid : m)),
          ...(extraLogs.length > 0
            ? {
                weeklyActivityLogs: pruneWeeklyActivityLogs(
                  [...extraLogs, ...(prev.weeklyActivityLogs ?? [])],
                  now
                ),
              }
            : {}),
        };
      }, eventLabel);
    },
    [commitStateChange, makeWeeklyLog]
  );

  const handleAddSickReport = useCallback(
    (report: SickReport) => {
      commitStateChange(
        (prev) => {
          const targetKid = prev.members.find((m) => m.id === report.kidId);
          const logEntry = targetKid
            ? makeWeeklyLog(
                targetKid,
                'แจ้งป่วย / พักรักษาตัว',
                'sick_leave',
                report.kidNickname,
                report.symptoms
              )
            : null;
          return {
            ...prev,
            sickReports: [report, ...prev.sickReports],
            ...(logEntry
              ? {
                  weeklyActivityLogs: [logEntry, ...(prev.weeklyActivityLogs ?? [])].slice(
                    0,
                    300
                  ),
                }
              : {}),
          };
        },
        'Add Sick Report'
      );
    },
    [commitStateChange, makeWeeklyLog]
  );

  const handleAddSnackBill = useCallback(
    (bill: SnackBill) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          snackBills: [bill, ...prev.snackBills],
        }),
        'Add Snack/Shop Bill'
      );
    },
    [commitStateChange]
  );

  const handleSaveReturnHomePhoto = useCallback(
    (photo: ReturnHomePhoto) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          returnHomePhotos: [photo, ...prev.returnHomePhotos].slice(0, 60),
        }),
        `Return Home Photo (${photo.kidNickname})`
      );
    },
    [commitStateChange]
  );

  const handleDeleteReturnHomePhoto = useCallback(
    (photoId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          returnHomePhotos: prev.returnHomePhotos.filter((p) => p.id !== photoId),
        }),
        'Delete Timestamp Check-In Photo'
      );
    },
    [commitStateChange]
  );

  // --- Community Features: Announcements, Secret Polls, Outing Trips & Private Backchannel ---
  const handleCastSecretVote = useCallback(
    (pollId: string, optionId: string, kidId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          polls: prev.polls.map((poll) => {
            if (poll.id !== pollId || poll.closed || poll.votedKidIds.includes(kidId)) {
              return poll;
            }
            return {
              ...poll,
              options: poll.options.map((opt) =>
                opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
              ),
              votedKidIds: [...poll.votedKidIds, kidId],
              kidChoices: {
                ...(poll.kidChoices ?? {}),
                [kidId]: optionId,
              },
            };
          }),
        }),
        'Cast Anonymous Secret Vote'
      );
    },
    [commitStateChange]
  );

  const handleToggleTripRsvp = useCallback(
    (tripId: string, kidId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          trips: prev.trips.map((trip) => {
            if (trip.id !== tripId) return trip;
            const exists = trip.attendeeIds.includes(kidId);
            return {
              ...trip,
              attendeeIds: exists
                ? trip.attendeeIds.filter((id) => id !== kidId)
                : [...trip.attendeeIds, kidId],
            };
          }),
        }),
        'Toggle Outing Trip RSVP'
      );
    },
    [commitStateChange]
  );

  const handleSendPrivateMessage = useCallback(
    (msg: PrivateCareMessage) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          privateMessages: [msg, ...prev.privateMessages],
        }),
        `Private Care Message (${msg.kidNickname})`
      );
    },
    [commitStateChange]
  );

  const handleAddAnnouncement = useCallback(
    (ann: Announcement) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          announcements: [ann, ...prev.announcements],
        }),
        `Add Announcement (${ann.title})`
      );
    },
    [commitStateChange]
  );

  const handleUpdateAnnouncement = useCallback(
    (annId: string, updates: Partial<Announcement>) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          announcements: prev.announcements.map((a) =>
            a.id === annId
              ? { ...a, ...updates, updatedAt: new Date().toISOString() }
              : a
          ),
        }),
        'Update Announcement'
      );
    },
    [commitStateChange]
  );

  const handleTogglePinAnnouncement = useCallback(
    (annId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          announcements: prev.announcements.map((a) =>
            a.id === annId ? { ...a, pinned: !a.pinned } : a
          ),
        }),
        'Toggle Pin Announcement'
      );
    },
    [commitStateChange]
  );

  const handleDeleteAnnouncement = useCallback(
    (annId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          announcements: prev.announcements.filter((a) => a.id !== annId),
        }),
        'Delete Announcement'
      );
    },
    [commitStateChange]
  );

  const handleToggleStaffTaskDone = useCallback(
    (annId: string, actorName: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          announcements: prev.announcements.map((a) =>
            a.id === annId
              ? {
                  ...a,
                  taskCompleted: !a.taskCompleted,
                  taskCompletedBy: !a.taskCompleted ? actorName : undefined,
                  taskCompletedAt: !a.taskCompleted ? now.toISOString() : undefined,
                }
              : a
          ),
        }),
        'Toggle Staff Work Task Status'
      );
    },
    [commitStateChange, now]
  );

  const handleCreatePoll = useCallback(
    (poll: SecretPoll) => {
      const cleanPoll = sanitizeSaturdayLatePenaltyPoll(poll).poll;
      commitStateChange(
        (prev) => ({
          ...prev,
          polls: [cleanPoll, ...prev.polls],
        }),
        `Create Secret Poll (${cleanPoll.question})`
      );
    },
    [commitStateChange]
  );

  const handleToggleClosePoll = useCallback(
    (pollId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          polls: prev.polls.map((p) => {
            if (p.id !== pollId) return p;
            const nextClosed = !p.closed;
            return {
              ...p,
              closed: nextClosed,
              reopenedAfterAutoClose: !nextClosed ? true : p.reopenedAfterAutoClose,
            };
          }),
        }),
        'Toggle Poll Closed'
      );
    },
    [commitStateChange]
  );

  const handleDeletePoll = useCallback(
    (pollId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          polls: prev.polls.filter((p) => p.id !== pollId),
        }),
        'Delete Poll'
      );
    },
    [commitStateChange]
  );

  const handleCreateTrip = useCallback(
    (trip: OutingTrip) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          trips: [trip, ...prev.trips],
        }),
        `Create Outing Trip (${trip.title})`
      );
    },
    [commitStateChange]
  );

  const handleDeleteTrip = useCallback(
    (tripId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          trips: prev.trips.filter((t) => t.id !== tripId),
        }),
        'Delete Outing Trip'
      );
    },
    [commitStateChange]
  );

  const handleReplyPrivateMessage = useCallback(
    (msgId: string, replyText: string, staffName: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          privateMessages: prev.privateMessages.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  readByStaff: true,
                  staffReply: replyText,
                  staffReplyBy: staffName,
                  repliedAt: new Date().toISOString(),
                }
              : m
          ),
        }),
        'Reply Private Message'
      );
    },
    [commitStateChange]
  );

  const handleMarkMessageRead = useCallback(
    (msgId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          privateMessages: prev.privateMessages.map((m) =>
            m.id === msgId ? { ...m, readByStaff: true } : m
          ),
        }),
        'Mark Private Message Read'
      );
    },
    [commitStateChange]
  );

  // --- New Useful Care Features: Lost & Found, Supplies Wishlist, Kindness Cards, Deed Redemption ---
  const handleAddLostFound = useCallback(
    (item: LostFoundItem) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          lostFoundItems: [item, ...prev.lostFoundItems].slice(0, 60),
        }),
        `Post Lost/Found: ${item.title}`
      );
    },
    [commitStateChange]
  );

  const handleClaimLostFound = useCallback(
    (itemId: string, kid: Member) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          lostFoundItems: prev.lostFoundItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: 'claimed',
                  claimedByKidId: kid.id,
                  claimedByNickname: kid.nickname,
                }
              : item
          ),
        }),
        `Claim Lost/Found (${kid.nickname})`
      );
    },
    [commitStateChange]
  );

  const handleResolveLostFound = useCallback(
    (itemId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          lostFoundItems: prev.lostFoundItems.map((item) =>
            item.id === itemId ? { ...item, status: 'claimed' } : item
          ),
        }),
        'Resolve Lost/Found Item'
      );
    },
    [commitStateChange]
  );

  const handleDeleteLostFound = useCallback(
    (itemId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          lostFoundItems: prev.lostFoundItems.filter((item) => item.id !== itemId),
        }),
        'Delete Lost/Found Item'
      );
    },
    [commitStateChange]
  );

  const handleSubmitSupplyRequest = useCallback(
    (req: SupplyRequest) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          supplyRequests: [req, ...prev.supplyRequests].slice(0, 80),
        }),
        `Supply Request: ${req.itemName}`
      );
    },
    [commitStateChange]
  );

  const handleUpdateSupplyStatus = useCallback(
    (reqId: string, status: 'approved' | 'delivered', staffName: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          supplyRequests: prev.supplyRequests.map((r) =>
            r.id === reqId ? { ...r, status, approvedBy: staffName } : r
          ),
        }),
        `Update Supply Request (${status})`
      );
    },
    [commitStateChange]
  );

  const handleSendKindnessCard = useCallback(
    (card: KindnessCard) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          kindnessCards: [card, ...prev.kindnessCards].slice(0, 100),
          members: prev.members.map((m) => {
            if (m.id === card.fromKidId) {
              return {
                ...m,
                stars: m.stars + 2,
                starHistory: [
                  {
                    id: `tx_kind_from_${Date.now()}`,
                    timestamp: card.createdAt,
                    reason: `💛 ส่งการ์ดขอบคุณให้ ${card.toNickname} (+2 ⭐)`,
                    amount: 2,
                  },
                  ...m.starHistory,
                ].slice(0, 60),
              };
            }
            if (m.id === card.toMemberId && m.role === 'kid') {
              return {
                ...m,
                stars: m.stars + 2,
                starHistory: [
                  {
                    id: `tx_kind_to_${Date.now()}`,
                    timestamp: card.createdAt,
                    reason: `💛 ได้รับการ์ดขอบคุณจาก น้อง${card.fromNickname} (+2 ⭐)`,
                    amount: 2,
                  },
                  ...m.starHistory,
                ].slice(0, 60),
              };
            }
            return m;
          }),
        }),
        `Kindness Card: ${card.fromNickname} -> ${card.toNickname}`
      );
    },
    [commitStateChange]
  );

  const handleAssignDeedRedemption = useCallback(
    (deed: DeedRedemption) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          deedRedemptions: [deed, ...prev.deedRedemptions].slice(0, 80),
        }),
        `Assign Deed Redemption (${deed.kidNickname})`
      );
    },
    [commitStateChange]
  );

  const handleSubmitDeedRedemption = useCallback(
    (deedId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          deedRedemptions: prev.deedRedemptions.map((d) =>
            d.id === deedId && d.status === 'assigned'
              ? { ...d, status: 'kid_submitted' }
              : d
          ),
        }),
        'Submit Deed Redemption'
      );
    },
    [commitStateChange]
  );

  const handleApproveDeedRedemption = useCallback(
    (deedId: string) => {
      commitStateChange((prev) => {
        const targetDeed = prev.deedRedemptions.find((d) => d.id === deedId);
        if (!targetDeed || targetDeed.status === 'approved') return prev;
        const approvedAt = new Date().toISOString();
        return {
          ...prev,
          deedRedemptions: prev.deedRedemptions.map((d) =>
            d.id === deedId ? { ...d, status: 'approved', approvedAt } : d
          ),
          members: prev.members.map((m) => {
            if (m.id !== targetDeed.kidId) return m;
            const nextFine = Math.max(
              0,
              m.penalty.lateFineThb - targetDeed.fineReductionThb
            );
            return {
              ...m,
              stars: m.stars + targetDeed.starsBonus,
              penalty: {
                ...m.penalty,
                lateFineThb: nextFine,
              },
              starHistory: [
                {
                  id: `tx_deed_${Date.now()}`,
                  timestamp: approvedAt,
                  reason: `⚖️ ไถ่ค่าปรับด้วยความดี: ${targetDeed.deedTitle} (ลดค่าปรับ ฿${targetDeed.fineReductionThb}${
                    targetDeed.starsBonus > 0 ? ` · +${targetDeed.starsBonus} ⭐` : ''
                  })`,
                  amount: targetDeed.starsBonus,
                },
                ...m.starHistory,
              ].slice(0, 60),
            };
          }),
        };
      }, 'Approve Deed Redemption');
    },
    [commitStateChange]
  );

  const handleSendFriendVisitRequest = useCallback(
    (req: FriendVisitRequest) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          friendVisits: [req, ...(prev.friendVisits ?? [])].slice(0, 80),
        }),
        `Friend Visit Request: ${req.fromKidNickname} -> ${req.toKidNickname}`
      );
    },
    [commitStateChange]
  );

  const handleRespondFriendVisit = useCallback(
    (visitId: string, decision: 'accepted' | 'declined' | 'ended') => {
      commitStateChange((prev) => {
        const visits = prev.friendVisits ?? [];
        const target = visits.find((v) => v.id === visitId);
        if (!target) return prev;
        const nowIso = new Date().toISOString();
        return {
          ...prev,
          friendVisits: visits.map((v) => {
            if (v.id === visitId) {
              return { ...v, status: decision, respondedAt: nowIso };
            }
            // When accepting a new hangout, gracefully close older active hangouts for either kid
            if (
              decision === 'accepted' &&
              v.status === 'accepted' &&
              (v.fromKidId === target.fromKidId ||
                v.toKidId === target.fromKidId ||
                v.fromKidId === target.toKidId ||
                v.toKidId === target.toKidId)
            ) {
              return { ...v, status: 'ended', respondedAt: nowIso };
            }
            return v;
          }),
        };
      }, `Friend Visit Response (${decision})`);
    },
    [commitStateChange]
  );

  const handleRecordRulePenalty = useCallback(
    (
      kidId: string,
      amountThb: number,
      reason: string,
      recordedBy: string,
      extraMemberUpdater?: (prev: Member) => Member
    ) => {
      commitStateChange((prev) => {
        const target = prev.members.find((m) => m.id === kidId);
        if (!target) return prev;
        const baseMember = extraMemberUpdater ? extraMemberUpdater(target) : target;
        const { nextAllowance, poolLog } = applyRulePenaltyToKidAndPool(
          baseMember,
          amountThb,
          reason,
          recordedBy,
          now,
          prev.settings
        );
        const weeklyEntry = makeWeeklyLog(
          baseMember,
          reason || 'มาสาย / ผิดกฎ',
          'late',
          recordedBy,
          amountThb > 0 ? `หัก ${amountThb} ฿` : undefined
        );
        return {
          ...prev,
          goldenPoolLogs: [poolLog, ...(prev.goldenPoolLogs ?? [])].slice(0, 120),
          weeklyActivityLogs: [weeklyEntry, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
          members: prev.members.map((m) =>
            m.id === kidId
              ? {
                  ...baseMember,
                  allowance: nextAllowance,
                }
              : m
          ),
        };
      }, `Rule Penalty -> Golden Pool (${reason})`);
    },
    [commitStateChange, makeWeeklyLog, now]
  );

  const handleSimulateNextSchoolDay = useCallback(
    (kidId: string) => {
      commitStateChange((prev) => {
        const target = prev.members.find((m) => m.id === kidId);
        if (!target) return prev;
        const res = applyDailySchoolDeduction(target, now, prev.settings, true);
        if (!res.deducted) {
          showAlert({
            icon: '📅',
            title: lang === 'th' ? 'หักครบทุกวันเรียนของสัปดาห์นี้แล้ว' : 'All School Days Deducted This Week',
            message:
              lang === 'th'
                ? 'สัปดาห์นี้หักค่าไปโรงเรียนครบ 5 วันแล้ว กด "เริ่มสัปดาห์ใหม่วันจันทร์" เพื่อเติมรอบใหม่ได้เลย'
                : 'All weekdays this week are already deducted.',
            tone: 'yellow',
          });
          return prev;
        }
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.id === kidId ? { ...m, allowance: res.allowance } : m
          ),
        };
      }, 'Simulate Next School Day Deduction');
    },
    [commitStateChange, lang, now, showAlert]
  );

  const handleTriggerMondayReset = useCallback(
    (kidId?: string) => {
      commitStateChange((prev) => {
        return {
          ...prev,
          members: prev.members.map((m) => {
            if (m.role !== 'kid') return m;
            if (kidId && m.id !== kidId) return m;
            const res = triggerManualMondayReset(m, now, prev.settings);
            return {
              ...m,
              allowance: res.allowance,
            };
          }),
        };
      }, kidId ? `Monday Reset (${kidId})` : 'Monday Reset (All Kids)');
      showAlert({
        icon: '📅🐷',
        title:
          lang === 'th'
            ? kidId
              ? 'เริ่มสัปดาห์ใหม่วันจันทร์สำเร็จ!'
              : 'เริ่มสัปดาห์ใหม่วันจันทร์ให้น้องๆ ทุกคนแล้ว!'
            : 'Monday Rollover Applied!',
        message:
          lang === 'th'
            ? 'ระบบคำนวณยอดตั้งต้น (เช่น 350 - ยอดผิดกฎสัปดาห์ก่อน) และเติมเข้ากระปุกหมูสีชมพูเรียบร้อย'
            : 'Weekly school allowance (base minus previous penalties) loaded into Pink Piggy Banks.',
        tone: 'mint',
      });
    },
    [commitStateChange, lang, now, showAlert]
  );

  const handleAddGoldenPoolPayout = useCallback(
    (amountThb: number, reason: string, recordedBy: string) => {
      const cleanAmt = Math.max(1, Math.round(amountThb));
      const log: GoldenPoolLog = {
        id: `gp_out_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        kidId: 'house_all',
        kidNickname: 'ส่วนรวมทั้งบ้าน',
        amount: -cleanAmt,
        kind: 'group_payout',
        reason,
        recordedBy,
        createdAt: now.toISOString(),
      };
      commitStateChange(
        (prev) => ({
          ...prev,
          goldenPoolLogs: [log, ...(prev.goldenPoolLogs ?? [])].slice(0, 120),
        }),
        `Golden Pool Group Payout (-${cleanAmt} THB)`
      );
      showAlert({
        icon: '🎁🪙',
        title: lang === 'th' ? `บันทึกเบิกกองทุนกลาง -${cleanAmt} ฿ แล้ว!` : `Pool Payout -${cleanAmt} THB Saved!`,
        message: reason,
        tone: 'mint',
      });
    },
    [commitStateChange, lang, now, showAlert]
  );

  const handleSubmitStaffLeave = useCallback(
    (leave: StaffLeaveRecord) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          staffLeaves: [leave, ...(prev.staffLeaves ?? [])].slice(0, 120),
        }),
        `Staff Leave: ${leave.staffName} (${leave.dateKey})`
      );
    },
    [commitStateChange]
  );

  const handleUpdateStaffLeaveSubstitute = useCallback(
    (leaveId: string, substituteName: string) => {
      const cleanSub = substituteName.trim();
      commitStateChange(
        (prev) => ({
          ...prev,
          staffLeaves: (prev.staffLeaves ?? []).map((l) =>
            l.id === leaveId
              ? {
                  ...l,
                  substituteName: cleanSub || undefined,
                }
              : l
          ),
        }),
        `Update Staff Leave Substitute (${cleanSub || 'Cleared'})`
      );
    },
    [commitStateChange]
  );

  const handleAcknowledgeStaffLeave = useCallback(
    (leaveId: string, byName: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          staffLeaves: (prev.staffLeaves ?? []).map((l) =>
            l.id === leaveId
              ? {
                  ...l,
                  acknowledgedBy: byName,
                  acknowledgedAt: now.toISOString(),
                }
              : l
          ),
        }),
        `Acknowledge Staff Leave (${byName})`
      );
    },
    [commitStateChange, now]
  );

  const handleCancelStaffLeave = useCallback(
    (leaveId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          staffLeaves: (prev.staffLeaves ?? []).map((l) =>
            l.id === leaveId ? { ...l, status: 'cancelled' } : l
          ),
        }),
        'Cancel Staff Leave'
      );
    },
    [commitStateChange]
  );

  const handleExpressKioskScan = useCallback(
    (rawCode: string) => {
      const currentState = stateRef.current;
      const clean = rawCode.trim().toLowerCase();
      const kid = currentState.members.find(
        (m) =>
          m.role === 'kid' &&
          (m.id.toLowerCase() === clean || m.pin === rawCode.trim())
      );
      if (!kid) {
        playKioskChime(false);
        return null;
      }
      const todayKey = getDateKey(now);
      const isSickToday = currentState.sickReports.some(
        (r) => r.kidId === kid.id && r.dateKey === todayKey && !r.resolved
      );
      const result = evaluateExpressKioskScan(kid, now, lang, currentState.settings, isSickToday);
      playKioskChime(result.success);
      if (result.updatedKid) {
        const updated = result.updatedKid;
        const isLateScan = Boolean(result.fineThb && result.fineThb > 0) || result.bannerTitle.includes('สาย');
        const scanLog = makeWeeklyLog(
          updated,
          result.bannerTitle,
          isLateScan ? 'late' : 'on_time',
          'QR Kiosk',
          result.fineReason
        );
        commitStateChange(
          (prev) => ({
            ...prev,
            members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
            weeklyActivityLogs: [scanLog, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
          }),
          `Express Kiosk Scan: ${updated.nickname}`
        );
      }
      return result;
    },
    [commitStateChange, lang, makeWeeklyLog, now]
  );

  const handleOneTapGoToSchool = useCallback(
    (kidId: string) => {
      const currentState = stateRef.current;
      const kid = currentState.members.find((m) => m.role === 'kid' && m.id === kidId);
      if (!kid) {
        playKioskChime(false);
        return null;
      }
      const todayKey = getDateKey(now);
      const isSickToday = currentState.sickReports.some(
        (r) => r.kidId === kid.id && r.dateKey === todayKey && !r.resolved
      );
      const result = evaluateOneTapGoToSchool(
        kid,
        now,
        lang,
        currentState.settings,
        isSickToday,
        currentState.polls
      );
      playKioskChime(result.success);
      if (result.updatedKid) {
        commitStateChange((prev) => {
          const freshKid = prev.members.find((m) => m.id === kidId && m.role === 'kid');
          if (!freshKid || freshKid.daily.vanOrMorningChecked) return prev;
          const freshSick = prev.sickReports.some(
            (r) => r.kidId === freshKid.id && r.dateKey === todayKey && !r.resolved
          );
          const freshRes = evaluateOneTapGoToSchool(
            freshKid,
            now,
            lang,
            prev.settings,
            freshSick,
            prev.polls
          );
          const updated = freshRes.updatedKid;
          if (!updated) return prev;
          const isLate = Boolean(freshRes.fineThb && freshRes.fineThb > 0);
          const logEntry = makeWeeklyLog(
            updated,
            'ไปโรงเรียน (ปุ่มด่วน)',
            isLate ? 'late' : 'on_time',
            'ปุ่มด่วนหน้าแรก',
            freshRes.fineReason
          );
          if (freshRes.fineThb && freshRes.fineThb > 0) {
            const { nextAllowance, poolLog } = applyRulePenaltyToKidAndPool(
              updated,
              freshRes.fineThb,
              freshRes.fineReason ?? 'ไปโรงเรียนสาย',
              'ปุ่มด่วนไปโรงเรียน',
              now,
              prev.settings
            );
            return {
              ...prev,
              goldenPoolLogs: [poolLog, ...(prev.goldenPoolLogs ?? [])].slice(0, 120),
              weeklyActivityLogs: [logEntry, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
              members: prev.members.map((m) =>
                m.id === updated.id ? { ...updated, allowance: nextAllowance } : m
              ),
            };
          }
          return {
            ...prev,
            weeklyActivityLogs: [logEntry, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
            members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
          };
        }, `One-Tap Go To School: ${kid.nickname}`);
      }
      return result;
    },
    [commitStateChange, lang, makeWeeklyLog, now]
  );

  const handleOneTapHomeAction = useCallback(
    (actionId: HomeQuickActionId, kidId: string, detailOverride?: string) => {
      if (actionId === 'morning_school') {
        return handleOneTapGoToSchool(kidId);
      }
      const currentState = stateRef.current;
      const kid = currentState.members.find((m) => m.role === 'kid' && m.id === kidId);
      if (!kid) {
        playKioskChime(false);
        return null;
      }
      const todayKey = getDateKey(now);
      const isSickToday = currentState.sickReports.some(
        (r) => r.kidId === kid.id && r.dateKey === todayKey && !r.resolved
      );
      const result = evaluateOneTapHomeAction(
        actionId,
        kid,
        now,
        lang,
        currentState.settings,
        isSickToday,
        detailOverride
      );
      playKioskChime(result.success);
      if (result.updatedKid) {
        const actionMeta = HOME_QUICK_ACTIONS.find((a) => a.id === actionId);
        commitStateChange((prev) => {
          const freshKid = prev.members.find((m) => m.id === kidId && m.role === 'kid');
          if (!freshKid) return prev;
          const isPenaltyAction =
            actionId === 'daily_penalty' ||
            prev.settings.timedCommandSchedule?.[actionId]?.commandType === 'penalty';
          if (
            !isPenaltyAction &&
            actionId !== 'night_homework_permission' &&
            isHomeActionDoneForKid(actionId, freshKid)
          ) {
            return prev;
          }
          const freshSick = prev.sickReports.some(
            (r) => r.kidId === freshKid.id && r.dateKey === todayKey && !r.resolved
          );
          const freshRes = evaluateOneTapHomeAction(
            actionId,
            freshKid,
            now,
            lang,
            prev.settings,
            freshSick,
            detailOverride
          );
          const updated = freshRes.updatedKid;
          if (!updated) return prev;
          const customTitle = prev.settings.timedCommandSchedule?.[actionId]?.titleTh?.trim();
          const logEntry = makeWeeklyLog(
            updated,
            customTitle || actionMeta?.titleTh || actionId,
            isPenaltyAction || Boolean(freshRes.fineReason) ? 'late' : 'on_time',
            'ปุ่มด่วนหน้าแรก',
            detailOverride || freshRes.fineReason
          );
          return {
            ...prev,
            weeklyActivityLogs: [logEntry, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
            members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
          };
        }, `One-Tap Home Action (${actionId}): ${kid.nickname}`);
      }
      return result;
    },
    [commitStateChange, handleOneTapGoToSchool, lang, makeWeeklyLog, now]
  );

  const handleRunCustomQuickCommand = useCallback(
    (cmd: CustomQuickCommand, kidId: string, subjectOrNote?: string) => {
      const currentState = stateRef.current;
      const kid = currentState.members.find((m) => m.role === 'kid' && m.id === kidId);
      if (!kid) {
        playKioskChime(false);
        return null;
      }
      const result = evaluateOneTapCustomCommand(
        cmd,
        kid,
        now,
        lang,
        subjectOrNote,
        currentState.settings
      );
      playKioskChime(result.success);
      if (result.updatedKid) {
        commitStateChange((prev) => {
          const freshKid = prev.members.find((m) => m.id === kidId && m.role === 'kid');
          if (!freshKid) return prev;
          const allowRepeat =
            cmd.kind === 'penalty' ||
            (cmd.kind === 'homework_permission' && Boolean(subjectOrNote?.trim()));
          if (!allowRepeat && isCustomCommandDoneForKid(cmd, freshKid, now)) return prev;
          const freshRes = evaluateOneTapCustomCommand(
            cmd,
            freshKid,
            now,
            lang,
            subjectOrNote,
            prev.settings
          );
          const updated = freshRes.updatedKid;
          if (!updated) return prev;
          const logEntry = makeWeeklyLog(
            updated,
            `${cmd.emoji} ${cmd.titleTh}`,
            cmd.kind === 'penalty' ? 'late' : 'on_time',
            'คีย์ลัดหน้าแรก',
            subjectOrNote || freshRes.fineReason || cmd.defaultNote
          );
          return {
            ...prev,
            weeklyActivityLogs: [logEntry, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
            members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
          };
        }, `Custom Quick Command (${cmd.titleTh}): ${kid.nickname}`);
      }
      return result;
    },
    [commitStateChange, lang, makeWeeklyLog, now]
  );

  const handleSaveCustomQuickCommands = useCallback(
    (nextCommands: CustomQuickCommand[]) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            customQuickCommands: nextCommands.slice(0, 20),
          },
        }),
        'Update Custom Quick Commands'
      );
    },
    [commitStateChange]
  );

  const handleSaveTimedSchedule = useCallback(
    (nextSchedule: Record<string, TimedScheduleSlot>, nextCurfewMins: number) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            timedCommandSchedule: nextSchedule,
            homeworkCurfewMins: nextCurfewMins,
          },
        }),
        'Update Timed Command Schedule'
      );
    },
    [commitStateChange]
  );

  const handleSaveCommandPermissions = useCallback(
    (
      nextKidsWithoutPhoneIds: string[],
      nextCommandPermissions: Record<string, CommandAccessRule>
    ) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            kidsWithoutPhoneIds: nextKidsWithoutPhoneIds.slice(0, 100),
            commandPermissions: nextCommandPermissions,
          },
        }),
        'Update Kid Phone Status & Command Permissions'
      );
    },
    [commitStateChange]
  );

  const handleAddWeeklyActivityLog = useCallback(
    (entry: WeeklyActivityLog) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          weeklyActivityLogs: [entry, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
        }),
        `Weekly Log (${entry.status}): ${entry.kidNickname}`
      );
    },
    [commitStateChange]
  );

  const handleDeleteWeeklyActivityLog = useCallback(
    (logId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          weeklyActivityLogs: (prev.weeklyActivityLogs ?? []).filter((l) => l.id !== logId),
        }),
        'Delete Weekly Activity Log'
      );
    },
    [commitStateChange]
  );

  const handleClearWeeklyActivityLogs = useCallback(() => {
    const clearedAt = now.toISOString();
    commitStateChange(
      (prev) => ({
        ...prev,
        weeklyActivityLogs: [],
        settings: {
          ...prev.settings,
          lastWeeklyClearedAt: clearedAt,
        },
      }),
      'Clear Weekly Activity Logs (Sunday Reset)'
    );
    showAlert({
      icon: '🧹',
      title: lang === 'th' ? 'ล้างประวัติสัปดาห์นี้เรียบร้อยแล้ว!' : 'Weekly Logs Cleared!',
      message:
        lang === 'th'
          ? 'เริ่มต้นเก็บบันทึกสัปดาห์ใหม่เรียบร้อยค่ะ'
          : 'Ready to record logs for the new week.',
      tone: 'mint',
    });
  }, [commitStateChange, lang, now, showAlert]);

  const handleResetAllKidsPenalties = useCallback(() => {
    commitStateChange(
      (prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.role === 'kid'
            ? {
                ...m,
                penalty: {
                  lateFineThb: 0,
                  phoneConfiscatedUntil1830Date: null,
                  fridayFreeDayDeductedCount: 0,
                  noEveningPhoneTomorrowDate: null,
                  noEveningPhone1830To2245Date: null,
                  noSevenElevenDate: null,
                  cartoonPrivilegeActive: true,
                  phonePrivilegeActive: true,
                },
              }
            : m
        ),
      }),
      'Creator Reset All Kids Penalties'
    );
    showAlert({
      icon: '🧹',
      title: lang === 'th' ? 'ล้างความผิด & ค่าปรับทุกคนเรียบร้อย!' : 'All Kid Penalties Cleared!',
      message:
        lang === 'th'
          ? 'รีเซตค่าปรับเป็น 0 บาท และคืนสิทธิ์การ์ตูน/มือถือให้น้องทุกคนเป็นปกติแล้วค่ะ'
          : 'All kids fines and device restrictions have been reset to normal.',
      tone: 'mint',
    });
  }, [commitStateChange, lang, showAlert]);

  const handleSendManagerGift = useCallback(
    (params: {
      target: 'all' | 'group1' | 'group2' | 'group3' | string;
      mode: 'angpao' | 'gift';
      emoji: string;
      title: string;
      message: string;
      amountThb: number;
      bonusStars: number;
      senderName: string;
    }) => {
      const todayKey = getDateKey(now);
      const sentAt = now.toISOString();
      let recipientCount = 0;

      commitStateChange((prev) => {
        const matchesTarget = (m: Member): boolean => {
          if (m.role !== 'kid') return false;
          if (params.target === 'all') return true;
          if (params.target === 'group1') return m.group === 1;
          if (params.target === 'group2') return m.group === 2;
          if (params.target === 'group3') return m.group === 3;
          return m.id === params.target;
        };

        return {
          ...prev,
          members: prev.members.map((m) => {
            if (!matchesTarget(m)) return m;
            recipientCount += 1;
            const { allowance } = ensureCurrentWeekAllowance(m, now, prev.settings);
            const cleanAmt = params.mode === 'angpao' ? Math.max(0, Math.round(params.amountThb)) : 0;
            const cleanStars = Math.max(0, Math.round(params.bonusStars));
            const nextCoins = allowance.coins + cleanAmt;
            const giftRecord = {
              id: `gift_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
              emoji: params.emoji,
              title: params.title,
              message: params.message,
              ...(cleanAmt > 0 ? { amountThb: cleanAmt } : {}),
              senderName: params.senderName,
              sentDateKey: todayKey,
              sentAt,
            };

            return {
              ...m,
              stars: m.stars + cleanStars,
              mySpace: {
                ...m.mySpace,
                activeGift: giftRecord,
              },
              allowance: {
                ...allowance,
                coins: nextCoins,
                coinHistory:
                  cleanAmt > 0
                    ? [
                        {
                          id: `coin_angpao_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                          timestamp: sentAt,
                          reason: `${params.emoji} ${params.title} จากผู้จัดการ (${params.senderName}) (+${cleanAmt.toLocaleString()} ฿)`,
                          amount: cleanAmt,
                          kind: 'angpao' as const,
                        },
                        ...allowance.coinHistory,
                      ].slice(0, 40)
                    : allowance.coinHistory,
              },
              starHistory:
                cleanStars > 0 || params.mode === 'gift'
                  ? [
                      {
                        id: `tx_gift_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                        timestamp: sentAt,
                        reason: `${params.emoji} ได้รับ${params.title} จาก${params.senderName}${
                          cleanStars > 0 ? ` (+${cleanStars} ⭐)` : ''
                        }`,
                        amount: cleanStars,
                      },
                      ...m.starHistory,
                    ].slice(0, 60)
                  : m.starHistory,
            };
          }),
        };
      }, `Manager Gift (${params.mode}: ${params.title})`);

      showAlert({
        icon: params.emoji,
        title:
          lang === 'en'
            ? `Sent to ${recipientCount} kid(s)!`
            : `ส่ง${params.mode === 'angpao' ? 'อั่งเปา' : 'ของขวัญ'}ให้น้อง ${recipientCount} คนแล้ว!`,
        message:
          lang === 'en'
            ? `${params.title}${params.amountThb > 0 ? ` (+${params.amountThb} THB)` : ''} will show on their profile today.`
            : `${params.title}${
                params.amountThb > 0 ? ` (+${params.amountThb.toLocaleString()} ฿ เข้าออมสินแล้ว)` : ''
              } และแสดงรูป${params.emoji} บนโปรไฟล์น้องวันนี้เป็นเวลา 1 วันค่ะ`,
        tone: 'yellow',
      });
    },
    [commitStateChange, lang, now, showAlert]
  );

  const handleConfirmKitchenDuty = useCallback(
    (
      kidId: string,
      slot: 'evening1530' | 'sat0930' | 'sun0915',
      chef: Member,
      starsAwarded: number
    ) => {
      const todayKey = getDateKey(now);
      const slotLabel =
        slot === 'evening1530'
          ? 'เวรครัวเย็น 15:30 น. (เสาร์/อาทิตย์/นักขัตฯ)'
          : slot === 'sat0930'
          ? 'เวรครัวเช้า เสาร์–นักขัตฤกษ์ (09:30 น.)'
          : 'เวรครัวเช้า วันอาทิตย์ (09:15 น.)';

      commitStateChange(
        (prev) => {
          const targetKid = prev.members.find((m) => m.id === kidId);
          if (!targetKid) return prev;
          const logEntry = {
            id: `klog_${Date.now()}`,
            kidId,
            kidNickname: targetKid.nickname,
            slot,
            slotLabel,
            chefId: chef.id,
            chefName: chef.nickname,
            starsAwarded,
            dateKey: todayKey,
            verifiedAt: now.toISOString(),
          };

          const weeklyEntry = makeWeeklyLog(
            targetKid,
            slotLabel,
            'on_time',
            `แม่ครัว (${chef.nickname})`,
            `+${starsAwarded} ⭐`
          );

          return {
            ...prev,
            kitchenLogs: [logEntry, ...prev.kitchenLogs],
            weeklyActivityLogs: [weeklyEntry, ...(prev.weeklyActivityLogs ?? [])].slice(0, 300),
            members: prev.members.map((m) => {
              if (m.id !== kidId) return m;
              return {
                ...m,
                stars: m.stars + starsAwarded,
                daily: {
                  ...m.daily,
                  kitchenEveningDone:
                    slot === 'evening1530' ? true : m.daily.kitchenEveningDone,
                  kitchenSatDone: slot === 'sat0930' ? true : m.daily.kitchenSatDone,
                  kitchenSunDone: slot === 'sun0915' ? true : m.daily.kitchenSunDone,
                },
                starHistory: [
                  {
                    id: `tx_${Date.now()}`,
                    timestamp: now.toISOString(),
                    reason: `${chef.nickname} ยืนยัน${slotLabel} (+${starsAwarded} ⭐)`,
                    amount: starsAwarded,
                  },
                  ...m.starHistory,
                ],
              };
            }),
          };
        },
        `Chef Verify Kitchen ${slot}`
      );
    },
    [commitStateChange, makeWeeklyLog, now]
  );

  const handleAwardStudyStars = useCallback(
    (kidId: string, stars: number, reason: string, markExtraStudy?: boolean) => {
      const todayKey = getDateKey(now);
      commitStateChange(
        (prevState) => {
          const dailyCap = Math.min(
            10,
            Math.max(0, Math.floor(prevState.settings.tutorMaxStarsPerKidPerDay ?? 10))
          );
          return {
            ...prevState,
            members: prevState.members.map((m) => {
              if (m.id !== kidId) return m;
              const usedToday = (m.starHistory ?? [])
                .filter(
                  (tx) =>
                    tx.timestamp.slice(0, 10) === todayKey &&
                    (tx.reason.includes('คุณครู') || tx.reason.includes('Tutor'))
                )
                .reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);
              const remaining = Math.max(0, dailyCap - usedToday);
              const requested = Math.max(0, Math.floor(stars));
              const awarded = Math.min(requested, remaining);
              if (awarded === 0 && !markExtraStudy) return m;
              return {
                ...m,
                stars: Math.max(0, m.stars + awarded),
                daily: markExtraStudy ? { ...m.daily, extraStudyChecked: true } : m.daily,
                starHistory: [
                  {
                    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                    timestamp: now.toISOString(),
                    reason,
                    amount: awarded,
                  },
                  ...(m.starHistory ?? []),
                ].slice(0, 60),
              };
            }),
          };
        },
        'Tutor Study Stars'
      );
    },
    [commitStateChange, now]
  );

  const handleAutoLoginRole = (
    target:
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
  ) => {
    setSelectedKidId(null);
    setReturnToManagerAfterKid(false);
    if (target === 'shortcut_manual') {
      setMode('shortcut_manual');
      return;
    }
    if (target === 'activity_log') {
      setMode('activity_log');
      return;
    }
    if (target === 'star_summary') {
      setMode('star_summary');
      return;
    }
    if (target === 'duty_roster') {
      setMode('duty_roster');
      return;
    }
    if (target === 'secret_vote') {
      setMode('secret_vote');
      return;
    }
    if (target === 'supply_request') {
      setMode('supply_request');
      return;
    }
    if (target === 'lost_found') {
      setMode('lost_found');
      return;
    }
    if (target === 'house_rules_guide') {
      setMode('house_rules_guide');
      return;
    }
    if (target === 'staff_system_guide') {
      setMode('staff_system_guide');
      return;
    }
    if (target === 'creator') {
      setCreatorUnlocked(true);
      setMode('creator');
      return;
    }
    if (target.role === 'staff') {
      setLoggedInStaff(target);
      setMode('staff');
    } else if (target.role === 'chef') {
      setLoggedInChef(target);
      setMode('chef');
    } else if (target.role === 'tutor') {
      setLoggedInTutor(target);
      setMode('tutor');
    } else if (target.role === 'manager') {
      if (target.pin === '9015' || target.id === 'mgr_susan') {
        setLang('en');
      } else if (target.pin === '4382' || target.id === 'mgr_wao') {
        setLang('th');
      }
      setLoggedInManager(target);
      setMode('manager');
    }
  };

  const selectedKid = selectedKidId
    ? state.members.find((m) => m.id === selectedKidId && m.role === 'kid') ?? null
    : null;

  const isCleanHomeScreen = mode === 'magic_door' && !selectedKid;

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Clean minimal brand bar on Home screen matching screenshot */}
      {isCleanHomeScreen && (
        <header
          className="no-print sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md"
          style={{ borderColor: 'var(--theme-border-alt)' }}
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-extrabold text-[#3D322C] truncate min-w-0">
              <span className="shrink-0">🏡</span>
              <span className="truncate">
                {activeTenant ? activeTenant.orgName : 'Barnhem Care & Kids'}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {linkedKidSession ? (
                <button
                  type="button"
                  onClick={() => void signOutCloud()}
                  className="min-h-[36px] rounded-xl border border-[#F3B7C0] bg-[#FFF0F3] hover:bg-[#FFE0E7] px-2.5 sm:px-3 py-1.5 text-xs font-extrabold text-[#8B1D36] whitespace-nowrap cursor-pointer transition-colors"
                >
                  🚪 {lang === 'th' ? 'ออกจากระบบน้อง' : 'Sign Out Kid'}
                </button>
              ) : activeTenant ? (
                <button
                  type="button"
                  onClick={() => setMode('portal')}
                  className="min-h-[36px] rounded-xl border border-[#8FD4C6] bg-[#E8FAF6] hover:bg-[#D5F4EE] px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-extrabold text-[#114A42] whitespace-nowrap cursor-pointer transition-colors"
                >
                  {lang === 'th' ? '🏛️ พื้นที่มูลนิธิของฉัน' : '🏛️ My Foundation Portal'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setLang((prev) => (prev === 'th' ? 'en' : 'th'))}
                className="text-xs font-semibold text-[#7B695F] hover:text-[#3D322C] cursor-pointer whitespace-nowrap"
              >
                {lang === 'th' ? '🇬🇧 EN' : '🇹🇭 ไทย'}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Compact top bar inside Staff/Chef/Manager/Creator/Portal modes */}
      {!isCleanHomeScreen && mode !== 'magic_door' && (
        <header className="no-print sticky top-0 z-30 border-b border-[#EBD8C3] bg-[#FFFDF9]/90 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setMode('magic_door');
                setSelectedKidId(null);
                setReturnToManagerAfterKid(false);
              }}
              className="min-h-[40px] rounded-2xl bg-white border border-[#EBD8C3] hover:bg-[#FADADD]/40 px-4 py-1.5 text-sm font-bold text-[#3D322C] whitespace-nowrap shrink-0 cursor-pointer"
            >
              ← {lang === 'th' ? 'กลับหน้าแรก' : 'Back to Home'}
            </button>

            <span className="text-sm sm:text-base font-bold text-[#3D322C] truncate">
              {mode === 'staff' && (lang === 'th' ? '👩‍🏫 โหมดพี่เลี้ยง' : '👩‍🏫 Staff Mode')}
              {mode === 'chef' && (lang === 'th' ? '👩‍🍳 โหมดแม่ครัว' : '👩‍🍳 Kitchen Chef Mode')}
              {mode === 'tutor' && (lang === 'th' ? '📚 โหมดคุณครูสอนพิเศษ' : '📚 Tutor Study Mode')}
              {mode === 'manager' && (lang === 'th' ? '📊 โหมดผู้จัดการ' : '📊 Manager Dashboard')}
              {mode === 'creator' && (lang === 'th' ? '👑 โหมดผู้สร้างสูงสุด' : '👑 Creator Admin')}
              {mode === 'portal' && (lang === 'th' ? '🌐 พอร์ทัลสมัครใช้งานระบบ' : '🌐 Platform Portal')}
              {mode === 'activity_log' &&
                (lang === 'th'
                  ? '📋 ประวัติทำรายการเด็ก (PIN 0001)'
                  : '📋 Kid Activity History (PIN 0001)')}
              {mode === 'star_summary' &&
                (lang === 'th'
                  ? '⭐ ยอดดาวของเด็กๆ ทั้งหมด (PIN 0002)'
                  : '⭐ All Kids Star Balances (PIN 0002)')}
              {mode === 'duty_roster' &&
                (lang === 'th'
                  ? '📅 ตารางเวรเด็กทั้งหมด (PIN 0003)'
                  : '📅 All Kids Duty Roster (PIN 0003)')}
              {mode === 'secret_vote' &&
                (lang === 'th'
                  ? '🗳️ โหวตลับ (PIN 0004)'
                  : '🗳️ Secret Polls (PIN 0004)')}
              {mode === 'supply_request' &&
                (lang === 'th'
                  ? '📦 ขอเบิกของใช้ (PIN 0005)'
                  : '📦 Supply Requests (PIN 0005)')}
              {mode === 'lost_found' &&
                (lang === 'th'
                  ? '🔎 แจ้งของหาย / เก็บของได้ (PIN 0006)'
                  : '🔎 Lost & Found (PIN 0006)')}
              {mode === 'house_rules_guide' &&
                (lang === 'th'
                  ? '📜 ข้อตกลงและขั้นตอนการกดระบบ (PIN 0007)'
                  : '📜 House Rules & Check-In Guide (PIN 0007)')}
              {mode === 'staff_system_guide' &&
                (lang === 'th'
                  ? '📋 ตารางสรุปการทำงานของพี่เลี้ยงและระบบ (PIN 0009)'
                  : '📋 Staff & System Summary Table (PIN 0009)')}
              {mode === 'shortcut_manual' &&
                (lang === 'th'
                  ? '📖 คู่มือการใช้งาน & รวมรหัสลัด 0001–0009 (PIN 0000)'
                  : '📖 User Manual & Shortcut PINs 0001–0009 (PIN 0000)')}
            </span>

            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'th' ? 'en' : 'th'))}
              className="min-h-[40px] rounded-2xl border border-[#EBD8C3] bg-white hover:bg-[#FFF5BA] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#3D322C] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lang === 'th' ? '🇬🇧 EN' : '🇹🇭 ไทย'}
            </button>
          </div>
        </header>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {mode === 'magic_door' && !selectedKid && (
          <MagicDoorView
            members={state.members}
            creatorPins={state.settings.creatorPins}
            now={now}
            lang={lang}
            pastelTheme={pastelTheme}
            themeOptions={THEME_OPTIONS}
            onChangeTheme={setPastelTheme}
            appState={state}
            cloudUser={cloudUser}
            cloudSyncing={cloudSyncing}
            cloudSyncError={cloudSyncError}
            onForceSeedCloud={handleForceSeedCloud}
            onPullFromCloud={handlePullFromCloud}
            onSelectKid={(kidId) => {
              setReturnToManagerAfterKid(false);
              setSelectedKidId(kidId);
            }}
            onAutoLoginRole={handleAutoLoginRole}
            onExpressKioskScan={handleExpressKioskScan}
            onQuickGoToSchool={handleOneTapGoToSchool}
            onQuickHomeAction={handleOneTapHomeAction}
            onRunCustomQuickCommand={handleRunCustomQuickCommand}
            onSaveCustomQuickCommands={handleSaveCustomQuickCommands}
            onSaveTimedSchedule={handleSaveTimedSchedule}
            onSaveCommandPermissions={handleSaveCommandPermissions}
            onAddSickReport={handleAddSickReport}
            onUpdateKid={handleUpdateKid}
            onSubmitStaffLeave={handleSubmitStaffLeave}
            onUpdateLeaveSubstitute={handleUpdateStaffLeaveSubstitute}
            onAcknowledgeLeave={handleAcknowledgeStaffLeave}
            onCancelLeave={handleCancelStaffLeave}
            onAddAnnouncement={handleAddAnnouncement}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onTogglePinAnnouncement={handleTogglePinAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onToggleStaffTaskDone={handleToggleStaffTaskDone}
            onUpdateSettings={(partial) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  settings: { ...prev.settings, ...partial },
                }),
                'Home Update Settings'
              )
            }
            onShowAlert={showAlert}
            onSaveReturnHomePhoto={handleSaveReturnHomePhoto}
            onDeleteReturnHomePhoto={handleDeleteReturnHomePhoto}
            organizationName={activeTenant?.orgName}
            linkedKidSession={linkedKidSession}
            linkedKidMember={
              linkedKidSession
                ? state.members.find((m) => m.id === linkedKidSession.memberId) ?? null
                : null
            }
            onOpenLinkedKid={() => {
              if (linkedKidSession) {
                setSelectedKidId(linkedKidSession.memberId);
              }
            }}
            onSignOutLinkedKid={() => void signOutCloud()}
          />
        )}

        {mode === 'magic_door' && selectedKid && (
          <KidHubView
            kid={selectedKid}
            allMembers={state.members}
            creatorPins={state.settings.creatorPins}
            shopItems={state.shopItems}
            snackBills={state.snackBills}
            sickReports={state.sickReports}
            returnHomePhotos={state.returnHomePhotos}
            returnHomeDriveUrl={state.settings.returnHomeDriveUrl}
            announcements={state.announcements}
            polls={state.polls}
            trips={state.trips}
            privateMessages={state.privateMessages}
            lostFoundItems={state.lostFoundItems}
            supplyRequests={state.supplyRequests}
            kindnessCards={state.kindnessCards}
            deedRedemptions={state.deedRedemptions}
            friendVisits={state.friendVisits ?? []}
            goldenPoolLogs={state.goldenPoolLogs ?? []}
            staffLeaves={state.staffLeaves ?? []}
            settings={state.settings}
            now={now}
            isPublicHolidayToday={state.settings.isPublicHolidayToday}
            activeFestivalOverride={state.settings.activeFestivalOverride ?? 'auto'}
            lang={lang}
            openedFromManager={returnToManagerAfterKid}
            linkedKidSession={linkedKidSession}
            cloudUserEmail={cloudUser?.email ?? null}
            onSignOutLinkedKid={() => void signOutCloud()}
            onBack={() => {
              setSelectedKidId(null);
              if (returnToManagerAfterKid && loggedInManager) {
                setReturnToManagerAfterKid(false);
                setMode('manager');
              }
            }}
            onUpdateKid={handleUpdateKid}
            onRecordRulePenalty={handleRecordRulePenalty}
            onAddSickReport={handleAddSickReport}
            onAddSnackBill={handleAddSnackBill}
            onSaveReturnHomePhoto={handleSaveReturnHomePhoto}
            onCastSecretVote={handleCastSecretVote}
            onToggleTripRsvp={handleToggleTripRsvp}
            onSendPrivateMessage={handleSendPrivateMessage}
            onAddLostFound={handleAddLostFound}
            onClaimLostFound={handleClaimLostFound}
            onSubmitSupplyRequest={handleSubmitSupplyRequest}
            onSendKindnessCard={handleSendKindnessCard}
            onSubmitDeedRedemption={handleSubmitDeedRedemption}
            onSendFriendVisitRequest={handleSendFriendVisitRequest}
            onRespondFriendVisit={handleRespondFriendVisit}
            onShowAlert={showAlert}
          />
        )}

        {mode === 'staff' && (
          <StaffView
            state={state}
            cloudUser={cloudUser}
            cloudSyncing={cloudSyncing}
            onForceSeedCloud={handleForceSeedCloud}
            members={state.members}
            sickReports={state.sickReports}
            snackBills={state.snackBills}
            announcements={state.announcements}
            polls={state.polls}
            trips={state.trips}
            privateMessages={state.privateMessages}
            lostFoundItems={state.lostFoundItems}
            supplyRequests={state.supplyRequests}
            kindnessCards={state.kindnessCards}
            deedRedemptions={state.deedRedemptions}
            now={now}
            lang={lang}
            loggedInStaff={loggedInStaff}
            onLoginStaff={(staff) => setLoggedInStaff(staff)}
            onLogoutStaff={() => setLoggedInStaff(null)}
            onSwitchToCreatorMode={() => {
              setCreatorUnlocked(true);
              setMode('creator');
            }}
            onUpdateKid={handleUpdateKid}
            onAddKid={(newKid) =>
              commitStateChange(
                (prev) => ({ ...prev, members: [...prev.members, newKid] }),
                'Add Kid'
              )
            }
            onDeleteKid={(kidId) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  members: prev.members.filter((m) => m.id !== kidId),
                }),
                'Delete Kid'
              )
            }
            onAddSickReport={handleAddSickReport}
            onResolveSick={(reportId) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  sickReports: prev.sickReports.map((r) =>
                    r.id === reportId
                      ? { ...r, resolved: true, resolvedAt: now.toISOString() }
                      : r
                  ),
                }),
                'Resolve Sick Case'
              )
            }
            onFulfillBill={(billId) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  snackBills: prev.snackBills.map((b) =>
                    b.id === billId ? { ...b, fulfilled: true } : b
                  ),
                }),
                'Fulfill Snack Bill'
              )
            }
            onAddAnnouncement={handleAddAnnouncement}
            onTogglePinAnnouncement={handleTogglePinAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onCreatePoll={handleCreatePoll}
            onToggleClosePoll={handleToggleClosePoll}
            onDeletePoll={handleDeletePoll}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onReplyPrivateMessage={handleReplyPrivateMessage}
            onMarkMessageRead={handleMarkMessageRead}
            onAddLostFound={handleAddLostFound}
            onResolveLostFound={handleResolveLostFound}
            onDeleteLostFound={handleDeleteLostFound}
            onUpdateSupplyStatus={handleUpdateSupplyStatus}
            onAssignDeedRedemption={handleAssignDeedRedemption}
            onApproveDeedRedemption={handleApproveDeedRedemption}
            onExpressKioskScan={handleExpressKioskScan}
            onQuickGoToSchool={handleOneTapGoToSchool}
            onUpdateSettings={(partial) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  settings: { ...prev.settings, ...partial },
                }),
                'Staff Update Settings'
              )
            }
            onRecordRulePenalty={handleRecordRulePenalty}
            onSimulateNextSchoolDay={handleSimulateNextSchoolDay}
            onTriggerMondayReset={handleTriggerMondayReset}
            onAddGoldenPoolPayout={handleAddGoldenPoolPayout}
            onSubmitStaffLeave={handleSubmitStaffLeave}
            onUpdateLeaveSubstitute={handleUpdateStaffLeaveSubstitute}
            onAcknowledgeLeave={handleAcknowledgeStaffLeave}
            onCancelLeave={handleCancelStaffLeave}
            onShowAlert={showAlert}
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            onAddWeeklyActivityLog={handleAddWeeklyActivityLog}
            onDeleteWeeklyActivityLog={handleDeleteWeeklyActivityLog}
            onClearWeeklyActivityLogs={handleClearWeeklyActivityLogs}
            onSaveReturnHomePhoto={handleSaveReturnHomePhoto}
            onDeleteReturnHomePhoto={handleDeleteReturnHomePhoto}
          />
        )}

        {mode === 'chef' && (
          <ChefView
            members={state.members}
            kitchenLogs={state.kitchenLogs}
            now={now}
            lang={lang}
            loggedInChef={loggedInChef}
            onLoginChef={(chef) => setLoggedInChef(chef)}
            onLogoutChef={() => setLoggedInChef(null)}
            onConfirmKitchenDuty={handleConfirmKitchenDuty}
            onShowAlert={showAlert}
          />
        )}

        {mode === 'tutor' && (
          <TutorView
            members={state.members}
            now={now}
            lang={lang}
            maxStarsPerKidPerDay={Math.min(
              10,
              Math.max(0, Math.floor(Number(state.settings.tutorMaxStarsPerKidPerDay ?? 10)))
            )}
            loggedInTutor={loggedInTutor}
            onLoginTutor={(tutor) => setLoggedInTutor(tutor)}
            onLogoutTutor={() => setLoggedInTutor(null)}
            onAwardStudyStars={handleAwardStudyStars}
            onShowAlert={showAlert}
          />
        )}

        {mode === 'manager' && (
          <ManagerView
            state={state}
            cloudUser={cloudUser}
            cloudSyncing={cloudSyncing}
            onForceSeedCloud={handleForceSeedCloud}
            members={state.members}
            sickReports={state.sickReports}
            kitchenLogs={state.kitchenLogs}
            announcements={state.announcements}
            polls={state.polls}
            trips={state.trips}
            privateMessages={state.privateMessages}
            lostFoundItems={state.lostFoundItems}
            supplyRequests={state.supplyRequests}
            kindnessCards={state.kindnessCards}
            deedRedemptions={state.deedRedemptions}
            now={now}
            lang={lang}
            loggedInManager={loggedInManager}
            onLoginManager={(mgr) => setLoggedInManager(mgr)}
            onLogoutManager={() => setLoggedInManager(null)}
            onSetLanguage={(newLang) => setLang(newLang)}
            onAddAnnouncement={handleAddAnnouncement}
            onTogglePinAnnouncement={handleTogglePinAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onCreatePoll={handleCreatePoll}
            onToggleClosePoll={handleToggleClosePoll}
            onDeletePoll={handleDeletePoll}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onReplyPrivateMessage={handleReplyPrivateMessage}
            onMarkMessageRead={handleMarkMessageRead}
            onAddLostFound={handleAddLostFound}
            onResolveLostFound={handleResolveLostFound}
            onDeleteLostFound={handleDeleteLostFound}
            onUpdateSupplyStatus={handleUpdateSupplyStatus}
            onAssignDeedRedemption={handleAssignDeedRedemption}
            onApproveDeedRedemption={handleApproveDeedRedemption}
            onOpenKidProfile={(kidId) => {
              setReturnToManagerAfterKid(true);
              setSelectedKidId(kidId);
              setMode('magic_door');
            }}
            onSendManagerGift={handleSendManagerGift}
            onSubmitStaffLeave={handleSubmitStaffLeave}
            onUpdateLeaveSubstitute={handleUpdateStaffLeaveSubstitute}
            onAcknowledgeLeave={handleAcknowledgeStaffLeave}
            onCancelLeave={handleCancelStaffLeave}
            onAddSickReport={handleAddSickReport}
            onResolveSick={(reportId) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  sickReports: prev.sickReports.map((r) =>
                    r.id === reportId
                      ? { ...r, resolved: true, resolvedAt: now.toISOString() }
                      : r
                  ),
                }),
                'Resolve Sick Case'
              )
            }
            onShowAlert={showAlert}
          />
        )}

        {mode === 'creator' && (
          <CreatorView
            state={state}
            cloudUser={cloudUser}
            cloudSyncing={cloudSyncing}
            onForceSeedCloud={handleForceSeedCloud}
            now={now}
            lang={lang}
            unlocked={creatorUnlocked}
            onUnlock={() => setCreatorUnlocked(true)}
            onLock={() => setCreatorUnlocked(false)}
            onUpdateMemberPin={(memberId, newPin) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  members: prev.members.map((m) =>
                    m.id === memberId ? { ...m, pin: newPin } : m
                  ),
                }),
                'Update Member PIN'
              )
            }
            onUpdateKid={handleUpdateKid}
            onAddShopItem={(item: ShopItem) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  shopItems: [item, ...prev.shopItems],
                }),
                'Add Shop Item'
              )
            }
            onUpdateShopItemPrice={(itemId, priceStars) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  shopItems: prev.shopItems.map((i) =>
                    i.id === itemId ? { ...i, priceStars: Math.max(1, priceStars) } : i
                  ),
                }),
                'Update Shop Item Price'
              )
            }
            onDeleteShopItem={(itemId) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  shopItems: prev.shopItems.filter((i) => i.id !== itemId),
                }),
                'Delete Shop Item'
              )
            }
            onUpdateSettings={(partial) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  settings: { ...prev.settings, ...partial },
                }),
                'Update Settings'
              )
            }
            onManualSync={async () => {
              await postSyncToDriveOrSheet(state, 'Manual Sync');
            }}
            onOpenExpressKiosk={() => setCreatorKioskOpen(true)}
            onSwitchToStaffMode={() => {
              const staffKik =
                state.members.find((m) => m.id === 'staff_kik') ??
                state.members.find((m) => m.role === 'staff') ??
                null;
              if (staffKik) setLoggedInStaff(staffKik);
              setMode('staff');
            }}
            onAddAnnouncement={handleAddAnnouncement}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onTogglePinAnnouncement={handleTogglePinAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onCreatePoll={handleCreatePoll}
            onToggleClosePoll={handleToggleClosePoll}
            onDeletePoll={handleDeletePoll}
            onCreateTrip={handleCreateTrip}
            onDeleteTrip={handleDeleteTrip}
            onReplyPrivateMessage={handleReplyPrivateMessage}
            onMarkMessageRead={handleMarkMessageRead}
            onAddLostFound={handleAddLostFound}
            onResolveLostFound={handleResolveLostFound}
            onDeleteLostFound={handleDeleteLostFound}
            onUpdateSupplyStatus={handleUpdateSupplyStatus}
            onAssignDeedRedemption={handleAssignDeedRedemption}
            onApproveDeedRedemption={handleApproveDeedRedemption}
            onSubmitStaffLeave={handleSubmitStaffLeave}
            onUpdateLeaveSubstitute={handleUpdateStaffLeaveSubstitute}
            onAcknowledgeLeave={handleAcknowledgeStaffLeave}
            onCancelLeave={handleCancelStaffLeave}
            onShowAlert={showAlert}
            isExternalTenant={Boolean(activeTenant)}
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            onResetAllKidsPenalties={handleResetAllKidsPenalties}
            onAddWeeklyActivityLog={handleAddWeeklyActivityLog}
            onDeleteWeeklyActivityLog={handleDeleteWeeklyActivityLog}
            onClearWeeklyActivityLogs={handleClearWeeklyActivityLogs}
            onAddSickReport={handleAddSickReport}
            onResolveSick={(reportId) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  sickReports: prev.sickReports.map((r) =>
                    r.id === reportId
                      ? { ...r, resolved: true, resolvedAt: now.toISOString() }
                      : r
                  ),
                }),
                'Resolve Sick Case'
              )
            }
            onSaveReturnHomePhoto={handleSaveReturnHomePhoto}
            onDeleteReturnHomePhoto={handleDeleteReturnHomePhoto}
          />
        )}

        {mode === 'activity_log' && (
          <KidActivityHistoryView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            kids={state.members.filter((m) => m.role === 'kid')}
            logs={state.weeklyActivityLogs ?? []}
            now={now}
            lang={lang}
            onShowAlert={showAlert}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'star_summary' && (
          <KidStarSummaryView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            kids={state.members.filter((m) => m.role === 'kid')}
            lang={lang}
            onShowAlert={showAlert}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'duty_roster' && (
          <KidDutyRosterView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            kids={state.members.filter((m) => m.role === 'kid')}
            now={now}
            lang={lang}
            isPublicHolidayToday={state.settings.isPublicHolidayToday}
            onShowAlert={showAlert}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'secret_vote' && (
          <KidSecretVoteView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            kids={state.members.filter((m) => m.role === 'kid')}
            polls={state.polls}
            linkedKidMember={
              linkedKidSession
                ? state.members.find((m) => m.id === linkedKidSession.memberId) ?? null
                : null
            }
            lang={lang}
            cloudUserEmail={cloudUser?.email ?? null}
            cloudSyncing={cloudSyncing}
            isCloudAuthorizedForVotes={Boolean(
              cloudUser &&
                ((activeTenant && activeTenant.ownerUid === cloudUser.uid) ||
                  (!activeTenant && isMasterAdminEmail(cloudUser.email)) ||
                  linkedKidSession)
            )}
            onRefreshPolls={handleRefreshSecretPolls}
            onConnectCloud={signInWithGoogleCloud}
            onCastSecretVote={handleCastSecretVote}
            onShowAlert={showAlert}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'supply_request' && (
          <KidSupplyRequestView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            kids={state.members.filter((m) => m.role === 'kid')}
            supplyRequests={state.supplyRequests}
            linkedKidMember={
              linkedKidSession
                ? state.members.find((m) => m.id === linkedKidSession.memberId) ?? null
                : null
            }
            now={now}
            lang={lang}
            onSubmitSupplyRequest={handleSubmitSupplyRequest}
            onShowAlert={showAlert}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'lost_found' && (
          <KidLostFoundView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            members={state.members}
            lostFoundItems={state.lostFoundItems}
            linkedKidMember={
              linkedKidSession
                ? state.members.find((m) => m.id === linkedKidSession.memberId) ?? null
                : null
            }
            now={now}
            lang={lang}
            onAddLostFound={handleAddLostFound}
            onClaimLostFound={handleClaimLostFound}
            onResolveLostFound={handleResolveLostFound}
            onShowAlert={showAlert}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'house_rules_guide' && (
          <HouseRulesGuideView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            now={now}
            lang={lang}
            settings={state.settings}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'staff_system_guide' && (
          <StaffSystemGuideView
            orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
            now={now}
            lang={lang}
            staffLeaves={state.staffLeaves}
            isPublicHolidayToday={Boolean(state.settings.isPublicHolidayToday)}
            onBackHome={() => {
              setMode('magic_door');
              setSelectedKidId(null);
            }}
          />
        )}

        {mode === 'shortcut_manual' && (
          <>
            <ShortcutManualView
              orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
              now={now}
              lang={lang}
              onNavigateMode={(targetMode) => {
                setSelectedKidId(null);
                setManualTimestampCamOpen(false);
                setMode(targetMode);
              }}
              onOpenTimestampCamera={() => setManualTimestampCamOpen(true)}
              onBackHome={() => {
                setManualTimestampCamOpen(false);
                setMode('magic_door');
                setSelectedKidId(null);
              }}
            />
            <TimestampCameraModal
              open={manualTimestampCamOpen}
              kids={state.members.filter((m) => m.role === 'kid')}
              staffPins={Array.from(
                new Set([
                  ...state.members
                    .filter((m) => m.role === 'staff' || m.role === 'manager')
                    .map((m) => m.pin),
                  ...state.settings.creatorPins,
                ])
              )}
              now={now}
              lang={lang}
              orgName={activeTenant?.orgName ?? 'Barnhem Care & Kids'}
              todayPhotos={(state.returnHomePhotos ?? []).filter(
                (p) => p.dateKey === getDateKey(now)
              )}
              allPhotos={state.returnHomePhotos ?? []}
              returnHomeDriveUrl={state.settings.returnHomeDriveUrl}
              syncWebhookUrl={state.settings.syncWebhookUrl}
              onSavePhoto={handleSaveReturnHomePhoto}
              onDeletePhoto={handleDeleteReturnHomePhoto}
              onClose={() => setManualTimestampCamOpen(false)}
              onShowAlert={showAlert}
            />
          </>
        )}

        {mode === 'portal' && (
          <PlatformPortalView
            cloudUser={cloudUser}
            lang={lang}
            activeTenant={activeTenant}
            appState={state}
            onUpdateSettings={(partial) =>
              commitStateChange(
                (prev) => ({
                  ...prev,
                  settings: { ...prev.settings, ...partial },
                }),
                'Update Org Storage Settings'
              )
            }
            onEnterTenantWorkspace={(reg) => {
              manualLeftTenantRef.current = false;
              const ctx: ActiveTenantContext = {
                orgId: reg.assignedOrgId,
                orgName: reg.organizationName,
                ownerName: reg.nickname || reg.applicantName,
                ownerUid: reg.uid,
                ownerEmail: reg.email,
                organizationPreset: reg.organizationPreset,
              };
              sessionStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, JSON.stringify(ctx));
              activeTenantRef.current = ctx;
              setActiveTenant(ctx);
              const tenantState = loadTenantAppState(
                ctx.orgId,
                ctx.orgName,
                ctx.ownerName,
                reg.organizationPreset,
                reg.automationAddons
              );
              stateRef.current = tenantState;
              setState(tenantState);
              setSelectedKidId(null);
              setLoggedInStaff(null);
              setLoggedInChef(null);
              setLoggedInTutor(null);
              setLoggedInManager(null);
              setCreatorUnlocked(false);
              setMode('magic_door');
            }}
            onLeaveTenantWorkspace={() => {
              manualLeftTenantRef.current = true;
              sessionStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
              activeTenantRef.current = null;
              setActiveTenant(null);
              const mainState = loadAppState();
              stateRef.current = mainState;
              setState(mainState);
              setSelectedKidId(null);
              setLoggedInStaff(null);
              setLoggedInChef(null);
              setLoggedInTutor(null);
              setLoggedInManager(null);
              setCreatorUnlocked(false);
            }}
            onBackHome={() => setMode('magic_door')}
            onShowAlert={showAlert}
          />
        )}
      </main>

      {/* Quiet bottom theme swatches & language switch for inner screens */}
      {!isCleanHomeScreen && (
        <footer className="no-print py-5 px-4 flex flex-wrap items-center justify-center gap-4 text-xs text-[#9B897E]">
          <div className="flex items-center gap-2" role="group" aria-label="Pastel Theme">
            {THEME_OPTIONS.map((t) => {
              const active = pastelTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPastelTheme(t.id)}
                  title={lang === 'th' ? t.labelTh : t.labelEn}
                  aria-label={lang === 'th' ? t.labelTh : t.labelEn}
                  className={`h-6 w-6 rounded-full border-2 transition-transform cursor-pointer ${
                    active ? 'border-[#3D322C] scale-110 shadow-sm' : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: t.swatch }}
                />
              );
            })}
          </div>

          <span aria-hidden="true">·</span>

          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'th' ? 'en' : 'th'))}
            className="font-semibold hover:text-[#3D322C] cursor-pointer"
          >
            {lang === 'th' ? '🇬🇧 English' : '🇹🇭 ภาษาไทย'}
          </button>
        </footer>
      )}

      <QrScannerModal
        open={creatorKioskOpen}
        lang={lang}
        initialKioskMode={true}
        onClose={() => setCreatorKioskOpen(false)}
        onExpressKioskScan={handleExpressKioskScan}
        onDetectedCode={(code) => {
          const clean = code.trim().toLowerCase();
          const kid = state.members.find(
            (m) => m.role === 'kid' && (m.id.toLowerCase() === clean || m.pin === code.trim())
          );
          if (kid) {
            setCreatorKioskOpen(false);
            setMode('magic_door');
            setSelectedKidId(kid.id);
          } else {
            showAlert({
              icon: '🔍',
              title: lang === 'th' ? 'ไม่พบรหัสน้อง' : 'ID Not Found',
              message: lang === 'th' ? `ไม่พบรหัส "${code}" ในระบบ` : `ID "${code}" not found`,
              tone: 'pink',
            });
          }
        }}
      />

      <CenteredAlertModal
        alert={alertPayload}
        lang={lang}
        onClose={() => setAlertPayload(null)}
      />
    </div>
  );
}
