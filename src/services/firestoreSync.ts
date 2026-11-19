import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { INITIAL_APP_STATE } from '../data/initialData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Announcement,
  AppSettings,
  AppState,
  DeedRedemption,
  FriendVisitRequest,
  GoldenPoolLog,
  KindnessCard,
  KitchenVerificationLog,
  LostFoundItem,
  Member,
  OutingTrip,
  PrivateCareMessage,
  SecretPoll,
  ShopItem,
  SickReport,
  SnackBill,
  StaffLeaveRecord,
  SupplyRequest,
} from '../types/barnhem';

export const MASTER_ADMIN_EMAIL = 'chali6939p@gmail.com';

type RecordType =
  | 'announcement'
  | 'poll'
  | 'trip'
  | 'private_message'
  | 'sick_report'
  | 'snack_bill'
  | 'kitchen_log'
  | 'lost_found'
  | 'supply_request'
  | 'kindness_card'
  | 'deed_redemption'
  | 'shop_item'
  | 'friend_visit'
  | 'golden_pool_log'
  | 'staff_leave';

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function makeSharedMeta(user: User) {
  const emails = new Set<string>([MASTER_ADMIN_EMAIL]);
  if (user.email) emails.add(user.email);
  return {
    ownerUid: user.uid,
    sharedEmails: Array.from(emails),
    updatedAt: serverTimestamp(),
  };
}

function buildRecordId(type: RecordType, rawId: string): string {
  const safe = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${type}__${safe}`;
}

function serializeMemberDoc(member: Member, user: User) {
  const clean = stripUndefined({
    id: member.id,
    role: member.role,
    group: member.group ?? null,
    nickname: member.nickname,
    fullName: member.fullName,
    gender: member.gender,
    pin: member.pin,
    emoji: member.emoji,
    stars: member.stars,
    personalDriveUrl: member.personalDriveUrl,
    restrictedDocsUrl: member.restrictedDocsUrl,
    activeCoverStage: member.activeCoverStage,
    unlockedCoverStages: member.unlockedCoverStages,
    collectedSceneItems: member.collectedSceneItems,
    ownedShopItemIds: member.ownedShopItemIds,
    avatar: member.avatar,
    pet: member.pet,
    mySpace: member.mySpace,
    healthProfile: member.healthProfile,
    streak: member.streak,
    customHouseChore: member.customHouseChore ?? null,
    allowance: member.allowance ?? null,
    penalty: member.penalty,
    kitchenDuty: member.kitchenDuty,
    daily: member.daily,
    starHistory: (member.starHistory ?? []).slice(0, 60),
  });
  return {
    ...clean,
    ...makeSharedMeta(user),
  };
}

function serializeConfigDoc(settings: AppSettings, user: User) {
  return {
    id: 'settings',
    syncWebhookUrl: settings.syncWebhookUrl || '',
    returnHomeDriveUrl: settings.returnHomeDriveUrl || '',
    creatorPins: settings.creatorPins,
    isPublicHolidayToday: Boolean(settings.isPublicHolidayToday),
    simulatedTimeIso: settings.simulatedTimeIso ?? null,
    tutorMaxStarsPerKidPerDay: Math.min(10, Math.max(0, Number(settings.tutorMaxStarsPerKidPerDay ?? 10))),
    activeFestivalOverride: settings.activeFestivalOverride ?? 'auto',
    dailyAllowanceThb: Math.min(500, Math.max(10, Math.round(Number(settings.dailyAllowanceThb ?? 70)))),
    schoolDaysPerWeek: Math.min(7, Math.max(1, Math.round(Number(settings.schoolDaysPerWeek ?? 5)))),
    early15MinBonusStars: Math.min(20, Math.max(0, Math.round(Number(settings.early15MinBonusStars ?? 1)))),
    starToCoinStars: Math.min(500, Math.max(1, Math.round(Number(settings.starToCoinStars ?? 30)))),
    starToCoinThb: Math.min(200, Math.max(1, Math.round(Number(settings.starToCoinThb ?? 5)))),
    ...makeSharedMeta(user),
  };
}

function extractRecordsMap(state: AppState): Map<string, { recordType: RecordType; payload: Record<string, unknown> }> {
  const map = new Map<string, { recordType: RecordType; payload: Record<string, unknown> }>();
  const addList = <T extends { id: string }>(type: RecordType, list: T[]) => {
    for (const item of list) {
      const docId = buildRecordId(type, item.id);
      map.set(docId, {
        recordType: type,
        payload: stripUndefined(item as unknown as Record<string, unknown>),
      });
    }
  };

  addList('announcement', state.announcements);
  addList('poll', state.polls);
  addList('trip', state.trips);
  addList('private_message', state.privateMessages);
  addList('sick_report', state.sickReports);
  addList('snack_bill', state.snackBills);
  addList('kitchen_log', state.kitchenLogs);
  addList('lost_found', state.lostFoundItems);
  addList('supply_request', state.supplyRequests);
  addList('kindness_card', state.kindnessCards);
  addList('deed_redemption', state.deedRedemptions);
  addList('shop_item', state.shopItems);
  addList('friend_visit', state.friendVisits ?? []);
  addList('golden_pool_log', state.goldenPoolLogs ?? []);
  addList('staff_leave', state.staffLeaves ?? []);

  return map;
}

async function commitOperationsBatch(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
  path: string
) {
  const CHUNK_SIZE = 350;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      op(batch);
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
}

export async function seedCloudIfEmpty(localState: AppState, user: User): Promise<boolean> {
  const isMaster = user.email === MASTER_ADMIN_EMAIL;
  const membersRef = collection(db, 'members');
  const membersQuery = isMaster
    ? membersRef
    : query(membersRef, where('sharedEmails', 'array-contains', user.email || ''));

  let snap;
  try {
    snap = await getDocs(membersQuery);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'members');
  }

  if (!snap.empty) {
    return false;
  }

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  for (const m of localState.members) {
    ops.push((b) => b.set(doc(db, 'members', m.id), serializeMemberDoc(m, user)));
  }
  const recordsMap = extractRecordsMap(localState);
  for (const [docId, entry] of recordsMap.entries()) {
    ops.push((b) =>
      b.set(doc(db, 'records', docId), {
        id: docId,
        recordType: entry.recordType,
        payload: entry.payload,
        ...makeSharedMeta(user),
      })
    );
  }
  ops.push((b) => b.set(doc(db, 'config', 'settings'), serializeConfigDoc(localState.settings, user)));

  await commitOperationsBatch(ops, 'members/records/config');
  return true;
}

export async function syncStateDiffToCloud(
  prevState: AppState,
  nextState: AppState,
  user: User
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  // 1. Diff members
  const prevMembersMap = new Map(prevState.members.map((m) => [m.id, m]));
  const nextMembersMap = new Map(nextState.members.map((m) => [m.id, m]));

  for (const nextMember of nextState.members) {
    const prevMember = prevMembersMap.get(nextMember.id);
    if (!prevMember || JSON.stringify(prevMember) !== JSON.stringify(nextMember)) {
      ops.push((b) =>
        b.set(doc(db, 'members', nextMember.id), serializeMemberDoc(nextMember, user))
      );
    }
  }
  for (const prevMember of prevState.members) {
    if (!nextMembersMap.has(prevMember.id)) {
      ops.push((b) => b.delete(doc(db, 'members', prevMember.id)));
    }
  }

  // 2. Diff records
  const prevRecords = extractRecordsMap(prevState);
  const nextRecords = extractRecordsMap(nextState);

  for (const [docId, entry] of nextRecords.entries()) {
    const prevEntry = prevRecords.get(docId);
    if (!prevEntry || JSON.stringify(prevEntry) !== JSON.stringify(entry)) {
      ops.push((b) =>
        b.set(doc(db, 'records', docId), {
          id: docId,
          recordType: entry.recordType,
          payload: entry.payload,
          ...makeSharedMeta(user),
        })
      );
    }
  }
  for (const docId of prevRecords.keys()) {
    if (!nextRecords.has(docId)) {
      ops.push((b) => b.delete(doc(db, 'records', docId)));
    }
  }

  // 3. Diff settings
  if (JSON.stringify(prevState.settings) !== JSON.stringify(nextState.settings)) {
    ops.push((b) =>
      b.set(doc(db, 'config', 'settings'), serializeConfigDoc(nextState.settings, user))
    );
  }

  if (ops.length > 0) {
    await commitOperationsBatch(ops, 'syncStateDiff');
  }
}

export function subscribeFoundationCloud(
  user: User,
  onMembersUpdate: (members: Member[]) => void,
  onRecordsUpdate: (patch: Partial<AppState>) => void,
  onSettingsUpdate: (settings: AppSettings) => void
): () => void {
  const isMaster = user.email === MASTER_ADMIN_EMAIL;
  const email = user.email || '';

  const membersQ = isMaster
    ? collection(db, 'members')
    : query(collection(db, 'members'), where('sharedEmails', 'array-contains', email));
  const recordsQ = isMaster
    ? collection(db, 'records')
    : query(collection(db, 'records'), where('sharedEmails', 'array-contains', email));
  const configQ = isMaster
    ? collection(db, 'config')
    : query(collection(db, 'config'), where('sharedEmails', 'array-contains', email));

  const unsubMembers = onSnapshot(
    membersQ,
    (snapshot) => {
      if (snapshot.empty) return;
      const list: Member[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const rawNickname = typeof d.nickname === 'string' ? d.nickname : '';
        const migratedNickname =
          d.id === 's7' && d.pin === '2965' && rawNickname === 'ฟา' ? 'ฟ้า' : rawNickname;
        list.push({
          ...(d as unknown as Member),
          nickname: migratedNickname,
          group: d.group === null ? undefined : (d.group as Member['group']),
          pet: d.pet === null ? undefined : (d.pet as Member['pet']),
          allowance: d.allowance === null ? undefined : (d.allowance as Member['allowance']),
          customHouseChore:
            typeof d.customHouseChore === 'string' ? d.customHouseChore : undefined,
        });
      });
      // Keep original order where possible
      const initialOrder = new Map(
        INITIAL_APP_STATE.members.map((m, idx) => [m.id, idx])
      );
      list.sort(
        (a, b) =>
          (initialOrder.get(a.id) ?? 999) - (initialOrder.get(b.id) ?? 999)
      );
      onMembersUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'members')
  );

  const unsubRecords = onSnapshot(
    recordsQ,
    (snapshot) => {
      if (snapshot.empty) return;
      const announcements: Announcement[] = [];
      const polls: SecretPoll[] = [];
      const trips: OutingTrip[] = [];
      const privateMessages: PrivateCareMessage[] = [];
      const sickReports: SickReport[] = [];
      const snackBills: SnackBill[] = [];
      const kitchenLogs: KitchenVerificationLog[] = [];
      const lostFoundItems: LostFoundItem[] = [];
      const supplyRequests: SupplyRequest[] = [];
      const kindnessCards: KindnessCard[] = [];
      const deedRedemptions: DeedRedemption[] = [];
      const shopItems: ShopItem[] = [];
      const friendVisits: FriendVisitRequest[] = [];
      const goldenPoolLogs: GoldenPoolLog[] = [];
      const staffLeaves: StaffLeaveRecord[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as {
          recordType: RecordType;
          payload: Record<string, unknown>;
        };
        if (!d?.payload) return;
        switch (d.recordType) {
          case 'announcement':
            announcements.push(d.payload as unknown as Announcement);
            break;
          case 'poll':
            polls.push(d.payload as unknown as SecretPoll);
            break;
          case 'trip':
            trips.push(d.payload as unknown as OutingTrip);
            break;
          case 'private_message':
            privateMessages.push(d.payload as unknown as PrivateCareMessage);
            break;
          case 'sick_report':
            sickReports.push(d.payload as unknown as SickReport);
            break;
          case 'snack_bill':
            snackBills.push(d.payload as unknown as SnackBill);
            break;
          case 'kitchen_log':
            kitchenLogs.push(d.payload as unknown as KitchenVerificationLog);
            break;
          case 'lost_found':
            lostFoundItems.push(d.payload as unknown as LostFoundItem);
            break;
          case 'supply_request':
            supplyRequests.push(d.payload as unknown as SupplyRequest);
            break;
          case 'kindness_card': {
            const card = d.payload as unknown as KindnessCard;
            if (card?.id !== 'kind_welcome_1') {
              kindnessCards.push(card);
            }
            break;
          }
          case 'deed_redemption':
            deedRedemptions.push(d.payload as unknown as DeedRedemption);
            break;
          case 'shop_item':
            shopItems.push(d.payload as unknown as ShopItem);
            break;
          case 'friend_visit':
            friendVisits.push(d.payload as unknown as FriendVisitRequest);
            break;
          case 'golden_pool_log':
            goldenPoolLogs.push(d.payload as unknown as GoldenPoolLog);
            break;
          case 'staff_leave':
            staffLeaves.push(d.payload as unknown as StaffLeaveRecord);
            break;
        }
      });

      const byNewest = (a: { createdAt?: string }, b: { createdAt?: string }) =>
        (b.createdAt || '').localeCompare(a.createdAt || '');

      announcements.sort(byNewest);
      polls.sort(byNewest);
      trips.sort(byNewest);
      privateMessages.sort(byNewest);
      lostFoundItems.sort(byNewest);
      supplyRequests.sort(byNewest);
      kindnessCards.sort(byNewest);
      deedRedemptions.sort(byNewest);
      friendVisits.sort(byNewest);
      goldenPoolLogs.sort(byNewest);
      staffLeaves.sort(byNewest);
      snackBills.sort(byNewest);
      sickReports.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
      kitchenLogs.sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));

      const shopOrder = new Map(INITIAL_APP_STATE.shopItems.map((item, idx) => [item.id, idx]));
      const hasAnyMinimart = shopItems.some((item) => item.id.startsWith('minimart_'));
      const effectiveShopItems = hasAnyMinimart
        ? shopItems
        : [
            ...INITIAL_APP_STATE.shopItems.filter((item) => item.id.startsWith('minimart_')),
            ...shopItems,
          ];
      effectiveShopItems.sort(
        (a, b) => (shopOrder.get(a.id) ?? -1) - (shopOrder.get(b.id) ?? -1)
      );

      onRecordsUpdate({
        announcements,
        polls,
        trips,
        privateMessages,
        sickReports,
        snackBills,
        kitchenLogs,
        lostFoundItems,
        supplyRequests,
        kindnessCards,
        deedRedemptions,
        friendVisits,
        goldenPoolLogs,
        staffLeaves,
        ...(effectiveShopItems.length > 0 ? { shopItems: effectiveShopItems } : {}),
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'records')
  );

  const unsubConfig = onSnapshot(
    configQ,
    (snapshot) => {
      snapshot.forEach((docSnap) => {
        if (docSnap.id === 'settings') {
          const d = docSnap.data() as Record<string, unknown>;
          onSettingsUpdate({
            syncWebhookUrl:
              typeof d.syncWebhookUrl === 'string'
                ? d.syncWebhookUrl
                : INITIAL_APP_STATE.settings.syncWebhookUrl,
            returnHomeDriveUrl:
              typeof d.returnHomeDriveUrl === 'string'
                ? d.returnHomeDriveUrl
                : INITIAL_APP_STATE.settings.returnHomeDriveUrl,
            creatorPins: Array.isArray(d.creatorPins)
              ? (d.creatorPins as string[])
              : INITIAL_APP_STATE.settings.creatorPins,
            isPublicHolidayToday: Boolean(d.isPublicHolidayToday),
            simulatedTimeIso:
              typeof d.simulatedTimeIso === 'string' ? d.simulatedTimeIso : null,
            tutorMaxStarsPerKidPerDay:
              typeof d.tutorMaxStarsPerKidPerDay === 'number'
                ? Math.min(10, Math.max(0, d.tutorMaxStarsPerKidPerDay))
                : 10,
            activeFestivalOverride:
              typeof d.activeFestivalOverride === 'string'
                ? (d.activeFestivalOverride as AppSettings['activeFestivalOverride'])
                : 'auto',
            dailyAllowanceThb:
              typeof d.dailyAllowanceThb === 'number' ? d.dailyAllowanceThb : 70,
            schoolDaysPerWeek:
              typeof d.schoolDaysPerWeek === 'number' ? d.schoolDaysPerWeek : 5,
            early15MinBonusStars:
              typeof d.early15MinBonusStars === 'number' ? d.early15MinBonusStars : 1,
            starToCoinStars:
              typeof d.starToCoinStars === 'number' ? d.starToCoinStars : 30,
            starToCoinThb:
              typeof d.starToCoinThb === 'number' ? d.starToCoinThb : 5,
          });
        }
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'config')
  );

  return () => {
    unsubMembers();
    unsubRecords();
    unsubConfig();
  };
}
