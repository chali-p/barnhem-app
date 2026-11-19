import { onAuthStateChanged, User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CenteredAlertModal, QrScannerModal } from './components/CenteredAlertModal';
import { ChefView } from './components/ChefView';
import { CreatorView } from './components/CreatorView';
import { KidHubView } from './components/KidHubView';
import { MagicDoorView } from './components/MagicDoorView';
import { ManagerView } from './components/ManagerView';
import { StaffView } from './components/StaffView';
import { TutorView } from './components/TutorView';
import { createEmptyDaily } from './data/initialData';
import { auth } from './firebase';
import {
  seedCloudIfEmpty,
  subscribeFoundationCloud,
  syncStateDiffToCloud,
} from './services/firestoreSync';
import {
  Announcement,
  AppMode,
  AppState,
  DeedRedemption,
  FriendVisitRequest,
  GoldenPoolLog,
  KindnessCard,
  Language,
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
} from './types/barnhem';
import {
  evaluateExpressKioskScan,
  evaluateOneTapGoToSchool,
  playKioskChime,
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
import { getDateKey, getEffectiveNow } from './utils/timeRules';

const THEME_OPTIONS: { id: PastelTheme; swatch: string; labelTh: string; labelEn: string }[] = [
  { id: 'rose', swatch: '#F5B0C0', labelTh: 'ชมพูครีม', labelEn: 'Cream Rose' },
  { id: 'mint', swatch: '#9DE2D6', labelTh: 'เขียวมิ้นท์', labelEn: 'Soft Mint' },
  { id: 'sky', swatch: '#9ED2F2', labelTh: 'ฟ้าอ่อน', labelEn: 'Sky Blue' },
  { id: 'yellow', swatch: '#FBE07E', labelTh: 'เหลืองละมุน', labelEn: 'Butter Yellow' },
  { id: 'lavender', swatch: '#CEBBE8', labelTh: 'ม่วงลาเวนเดอร์', labelEn: 'Lavender' },
  { id: 'peach', swatch: '#F5C4A8', labelTh: 'ส้มพีช', labelEn: 'Soft Peach' },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
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

  const [now, setNow] = useState<Date>(() =>
    getEffectiveNow(state.settings.simulatedTimeIso)
  );
  const [alertPayload, setAlertPayload] = useState<ModalAlertPayload | null>(null);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);

  const stateRef = useRef<AppState>(state);
  stateRef.current = state;
  const cloudUserRef = useRef<User | null>(cloudUser);
  cloudUserRef.current = cloudUser;

  useEffect(() => {
    document.documentElement.setAttribute('data-pastel-theme', pastelTheme);
    localStorage.setItem('barnhem_pastel_theme', pastelTheme);
  }, [pastelTheme]);

  // Firebase Auth & Real-Time Firestore Multi-Device Sync
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCloudUser(user);
      cloudUserRef.current = user;
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }
      if (!user) {
        setCloudSyncing(false);
        return;
      }
      setCloudSyncing(true);
      try {
        await seedCloudIfEmpty(stateRef.current, user);
        unsubCloud = subscribeFoundationCloud(
          user,
          (members) => {
            setState((prev) => {
              const next: AppState = {
                ...prev,
                members,
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              saveAppStateLocal(next);
              return next;
            });
          },
          (patch) => {
            setState((prev) => {
              const next: AppState = {
                ...prev,
                ...patch,
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              saveAppStateLocal(next);
              return next;
            });
          },
          (settings) => {
            setState((prev) => {
              const next: AppState = {
                ...prev,
                settings,
                lastSyncedAt: new Date().toISOString(),
              };
              stateRef.current = next;
              saveAppStateLocal(next);
              return next;
            });
          }
        );
      } catch (err) {
        console.error('Cloud sync initialization error:', err);
      } finally {
        setCloudSyncing(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubCloud) unsubCloud();
    };
  }, []);

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
        if (!needsDailyReset && !needsWeekRollover) return prev;
        const next: AppState = {
          ...prev,
          members: prev.members.map((m) => {
            let nextMember =
              m.daily.dateKey === todayKey ? m : { ...m, daily: createEmptyDaily(todayKey) };
            if (nextMember.role === 'kid' && nextMember.allowance?.weekKey !== currentWeekKey) {
              const { allowance } = ensureCurrentWeekAllowance(nextMember, current, prev.settings);
              nextMember = { ...nextMember, allowance };
            }
            return nextMember;
          }),
        };
        stateRef.current = next;
        saveAppStateLocal(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.settings.simulatedTimeIso]);

  const commitStateChange = useCallback(
    (updater: (prev: AppState) => AppState, eventLabel: string) => {
      const prev = stateRef.current;
      const next = updater(prev);
      const withSyncMeta: AppState = {
        ...next,
        lastSyncedAt: new Date().toISOString(),
      };
      stateRef.current = withSyncMeta;
      setState(withSyncMeta);
      saveAppStateLocal(withSyncMeta);
      void postSyncToDriveOrSheet(withSyncMeta, eventLabel);
      if (cloudUserRef.current) {
        void syncStateDiffToCloud(prev, withSyncMeta, cloudUserRef.current);
      }
    },
    []
  );

  const handleForceSeedCloud = useCallback(async () => {
    const user = cloudUserRef.current;
    if (!user) return;
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
      };
      await syncStateDiffToCloud(emptyPrev, stateRef.current, user);
    } finally {
      setCloudSyncing(false);
    }
  }, []);

  const showAlert = useCallback((payload: ModalAlertPayload) => {
    setAlertPayload(payload);
  }, []);

  const handleUpdateKid = useCallback(
    (kidId: string, updater: (prev: Member) => Member, eventLabel: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          members: prev.members.map((m) => (m.id === kidId ? updater(m) : m)),
        }),
        eventLabel
      );
    },
    [commitStateChange]
  );

  const handleAddSickReport = useCallback(
    (report: SickReport) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          sickReports: [report, ...prev.sickReports],
        }),
        'Add Sick Report'
      );
    },
    [commitStateChange]
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

  const handleCreatePoll = useCallback(
    (poll: SecretPoll) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          polls: [poll, ...prev.polls],
        }),
        `Create Secret Poll (${poll.question})`
      );
    },
    [commitStateChange]
  );

  const handleToggleClosePoll = useCallback(
    (pollId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          polls: prev.polls.map((p) =>
            p.id === pollId ? { ...p, closed: !p.closed } : p
          ),
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
        return {
          ...prev,
          goldenPoolLogs: [poolLog, ...(prev.goldenPoolLogs ?? [])].slice(0, 120),
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
    [commitStateChange, now]
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
        commitStateChange(
          (prev) => ({
            ...prev,
            members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
          }),
          `Express Kiosk Scan: ${updated.nickname}`
        );
      }
      return result;
    },
    [commitStateChange, lang, now]
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
      const result = evaluateOneTapGoToSchool(kid, now, lang, currentState.settings, isSickToday);
      playKioskChime(result.success);
      if (result.updatedKid) {
        commitStateChange((prev) => {
          const freshKid = prev.members.find((m) => m.id === kidId && m.role === 'kid');
          if (!freshKid || freshKid.daily.vanOrMorningChecked) return prev;
          const freshSick = prev.sickReports.some(
            (r) => r.kidId === freshKid.id && r.dateKey === todayKey && !r.resolved
          );
          const freshRes = evaluateOneTapGoToSchool(freshKid, now, lang, prev.settings, freshSick);
          const updated = freshRes.updatedKid;
          if (!updated) return prev;
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
              members: prev.members.map((m) =>
                m.id === updated.id ? { ...updated, allowance: nextAllowance } : m
              ),
            };
          }
          return {
            ...prev,
            members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
          };
        }, `One-Tap Go To School: ${kid.nickname}`);
      }
      return result;
    },
    [commitStateChange, lang, now]
  );

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

          return {
            ...prev,
            kitchenLogs: [logEntry, ...prev.kitchenLogs],
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
    [commitStateChange, now]
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

  const handleAutoLoginRole = (target: Member | 'creator') => {
    setSelectedKidId(null);
    setReturnToManagerAfterKid(false);
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
    <div className="min-h-screen flex flex-col">
      {/* Clean minimal brand bar on Home screen matching screenshot */}
      {isCleanHomeScreen && (
        <header
          className="no-print sticky top-0 z-30 border-b bg-white/85 backdrop-blur-md"
          style={{ borderColor: 'var(--theme-border-alt)' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#3D322C]">
              <span>🏡</span>
              <span>Barnhem Care &amp; Kids</span>
            </div>
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'th' ? 'en' : 'th'))}
              className="text-xs font-semibold text-[#7B695F] hover:text-[#3D322C] cursor-pointer"
            >
              {lang === 'th' ? '🇬🇧 EN' : '🇹🇭 ไทย'}
            </button>
          </div>
        </header>
      )}

      {/* Compact top bar inside Staff/Chef/Manager/Creator modes */}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
            onForceSeedCloud={handleForceSeedCloud}
            onSelectKid={(kidId) => {
              setReturnToManagerAfterKid(false);
              setSelectedKidId(kidId);
            }}
            onAutoLoginRole={handleAutoLoginRole}
            onExpressKioskScan={handleExpressKioskScan}
            onQuickGoToSchool={handleOneTapGoToSchool}
            onShowAlert={showAlert}
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
