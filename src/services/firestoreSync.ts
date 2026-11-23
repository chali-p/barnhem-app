import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
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
  LinkedKidSession,
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
  WeeklyActivityLog,
} from '../types/barnhem';

export const MASTER_ADMIN_EMAIL = 'chali6939p@gmail.com';
export const DEFAULT_ORG_ID = 'barnhem_main';

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
  | 'staff_leave'
  | 'weekly_activity_log';

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

const KID_SAFE_RECORD_TYPES = new Set<RecordType>([
  'shop_item',
  'announcement',
  'poll',
  'trip',
]);

function normalizeEmail(email: string | undefined | null): string {
  return (email ?? '').trim().toLowerCase();
}

function collectMemberLinkedEmails(members: Member[]): string[] {
  const set = new Set<string>();
  for (const m of members) {
    const clean = normalizeEmail(m.linkedEmail);
    if (clean && clean.includes('@')) {
      set.add(clean);
    }
  }
  return Array.from(set).sort();
}

function makeSharedMeta(
  user: User,
  orgId: string = DEFAULT_ORG_ID,
  extraEmails: string[] = []
) {
  const emails = new Set<string>();
  if (orgId === DEFAULT_ORG_ID) {
    emails.add(MASTER_ADMIN_EMAIL.toLowerCase());
  }
  const userEmail = normalizeEmail(user.email);
  if (userEmail) emails.add(userEmail);
  for (const raw of extraEmails) {
    const clean = normalizeEmail(raw);
    if (clean && clean.includes('@')) emails.add(clean);
  }
  return {
    ownerUid: user.uid,
    sharedEmails: Array.from(emails).slice(0, 80),
    updatedAt: serverTimestamp(),
  };
}

function toScopedId(orgId: string, rawId: string): string {
  const cleanRaw = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (orgId === DEFAULT_ORG_ID) return cleanRaw.slice(0, 128);
  return `${orgId}__${cleanRaw}`.slice(0, 128);
}

function fromScopedId(orgId: string, scopedId: string): string {
  if (orgId === DEFAULT_ORG_ID) return scopedId;
  const prefix = `${orgId}__`;
  return scopedId.startsWith(prefix) ? scopedId.slice(prefix.length) : scopedId;
}

function extractOrgIdFromDocId(docId: string): string {
  if (docId.startsWith('org_')) {
    const sepIdx = docId.indexOf('__');
    if (sepIdx > 0) {
      return docId.slice(0, sepIdx);
    }
  }
  return DEFAULT_ORG_ID;
}

function belongsToOrg(orgId: string, docId: string): boolean {
  if (orgId === DEFAULT_ORG_ID) {
    return !docId.startsWith('org_');
  }
  return docId.startsWith(`${orgId}__`);
}

function buildRecordId(type: RecordType, rawId: string, orgId: string = DEFAULT_ORG_ID): string {
  const safe = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  if (orgId === DEFAULT_ORG_ID) {
    return `${type}__${safe}`.slice(0, 128);
  }
  return `${orgId}__${type}__${safe}`.slice(0, 128);
}

function serializeMemberDoc(
  member: Member,
  user: User,
  orgId: string = DEFAULT_ORG_ID,
  preserveMeta?: { ownerUid: string; sharedEmails: string[] }
) {
  const scopedId = toScopedId(orgId, member.id);
  const cleanEmail = normalizeEmail(member.linkedEmail).slice(0, 200);
  const clean = stripUndefined({
    id: scopedId,
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
    starHistory: (member.starHistory ?? []).slice(0, 25),
    linkedEmail: cleanEmail,
    emailLoginBonusClaimed: Boolean(member.emailLoginBonusClaimed),
  });
  if (preserveMeta) {
    return {
      ...clean,
      ownerUid: preserveMeta.ownerUid,
      sharedEmails: preserveMeta.sharedEmails,
      updatedAt: serverTimestamp(),
    };
  }
  return {
    ...clean,
    ...makeSharedMeta(user, orgId, cleanEmail ? [cleanEmail] : []),
  };
}

function serializeConfigDoc(
  settings: AppSettings,
  user: User,
  orgId: string = DEFAULT_ORG_ID,
  extraEmails: string[] = []
) {
  const configDocId = toScopedId(orgId, 'settings');
  return {
    id: configDocId,
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
    lastWeeklyClearedAt: settings.lastWeeklyClearedAt ?? null,
    useOwnStorageOnly: Boolean(settings.useOwnStorageOnly),
    enableCoinsAndPiggyBank: Boolean(settings.enableCoinsAndPiggyBank),
    ...(settings.organizationPreset ? { organizationPreset: settings.organizationPreset } : {}),
    ...(Array.isArray(settings.automationAddons)
      ? { automationAddons: settings.automationAddons.slice(0, 10) }
      : {}),
    ...makeSharedMeta(user, orgId, extraEmails),
  };
}

function isWithinRecentDays(isoOrDateKey: string | undefined, maxDays = 8): boolean {
  if (!isoOrDateKey) return true;
  const parsed = Date.parse(isoOrDateKey.length === 10 ? `${isoOrDateKey}T00:00:00Z` : isoOrDateKey);
  if (Number.isNaN(parsed)) return true;
  const cutoffMs = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  return parsed >= cutoffMs;
}

function extractRecordsMap(
  state: AppState,
  orgId: string = DEFAULT_ORG_ID
): Map<string, { recordType: RecordType; payload: Record<string, unknown> }> {
  const map = new Map<string, { recordType: RecordType; payload: Record<string, unknown> }>();
  const addList = <T extends { id: string }>(type: RecordType, list: T[]) => {
    for (const item of list) {
      const docId = buildRecordId(type, item.id, orgId);
      map.set(docId, {
        recordType: type,
        payload: stripUndefined(item as unknown as Record<string, unknown>),
      });
    }
  };

  addList('announcement', state.announcements);
  addList('poll', state.polls);
  addList('trip', state.trips);
  addList('private_message', state.privateMessages.filter((m) => isWithinRecentDays(m.createdAt, 14)));
  addList('sick_report', state.sickReports.filter((r) => !r.resolved || isWithinRecentDays(r.reportedAt, 8)));
  addList('snack_bill', state.snackBills.filter((b) => isWithinRecentDays(b.createdAt, 8)));
  addList('kitchen_log', state.kitchenLogs.filter((k) => isWithinRecentDays(k.verifiedAt, 8)));
  addList('lost_found', state.lostFoundItems.filter((i) => i.status !== 'claimed' || isWithinRecentDays(i.createdAt, 14)));
  addList('supply_request', state.supplyRequests.filter((s) => s.status !== 'delivered' || isWithinRecentDays(s.createdAt, 14)));
  addList('kindness_card', state.kindnessCards.filter((c) => isWithinRecentDays(c.createdAt, 14)));
  addList('deed_redemption', state.deedRedemptions.filter((d) => d.status !== 'approved' || isWithinRecentDays(d.createdAt, 14)));
  addList('shop_item', state.shopItems);
  addList('friend_visit', (state.friendVisits ?? []).filter((f) => isWithinRecentDays(f.createdAt, 8)));
  addList('golden_pool_log', (state.goldenPoolLogs ?? []).filter((g) => isWithinRecentDays(g.createdAt, 14)));
  addList('staff_leave', (state.staffLeaves ?? []).filter((l) => isWithinRecentDays(l.dateKey, 14)));
  addList('weekly_activity_log', (state.weeklyActivityLogs ?? []).filter((w) => isWithinRecentDays(w.createdAt, 8)));

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

export async function seedCloudIfEmpty(
  localState: AppState,
  user: User,
  orgId: string = DEFAULT_ORG_ID
): Promise<boolean> {
  const membersRef = collection(db, 'members');
  const membersQuery =
    orgId === DEFAULT_ORG_ID
      ? query(membersRef, where('sharedEmails', 'array-contains', user.email || ''))
      : query(membersRef, where('ownerUid', '==', user.uid));

  let snap;
  try {
    snap = await getDocs(membersQuery);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'members');
  }

  const hasExistingForOrg = snap.docs.some((d) => belongsToOrg(orgId, d.id));
  if (hasExistingForOrg) {
    return false;
  }

  const linkedEmails = collectMemberLinkedEmails(localState.members);
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  for (const m of localState.members) {
    const docId = toScopedId(orgId, m.id);
    ops.push((b) => b.set(doc(db, 'members', docId), serializeMemberDoc(m, user, orgId)));
  }
  const recordsMap = extractRecordsMap(localState, orgId);
  for (const [docId, entry] of recordsMap.entries()) {
    const extraEmails = KID_SAFE_RECORD_TYPES.has(entry.recordType) ? linkedEmails : [];
    ops.push((b) =>
      b.set(doc(db, 'records', docId), {
        id: docId,
        recordType: entry.recordType,
        payload: entry.payload,
        ...makeSharedMeta(user, orgId, extraEmails),
      })
    );
  }
  const configDocId = toScopedId(orgId, 'settings');
  ops.push((b) =>
    b.set(
      doc(db, 'config', configDocId),
      serializeConfigDoc(localState.settings, user, orgId, linkedEmails)
    )
  );

  await commitOperationsBatch(ops, 'members/records/config');
  return true;
}

function extractAllRecordDocIds(
  state: AppState,
  orgId: string = DEFAULT_ORG_ID
): Set<string> {
  const ids = new Set<string>();
  const addIds = <T extends { id: string }>(type: RecordType, list: T[] | undefined) => {
    for (const item of list ?? []) {
      ids.add(buildRecordId(type, item.id, orgId));
    }
  };
  addIds('announcement', state.announcements);
  addIds('poll', state.polls);
  addIds('trip', state.trips);
  addIds('private_message', state.privateMessages);
  addIds('sick_report', state.sickReports);
  addIds('snack_bill', state.snackBills);
  addIds('kitchen_log', state.kitchenLogs);
  addIds('lost_found', state.lostFoundItems);
  addIds('supply_request', state.supplyRequests);
  addIds('kindness_card', state.kindnessCards);
  addIds('deed_redemption', state.deedRedemptions);
  addIds('shop_item', state.shopItems);
  addIds('friend_visit', state.friendVisits);
  addIds('golden_pool_log', state.goldenPoolLogs);
  addIds('staff_leave', state.staffLeaves);
  addIds('weekly_activity_log', state.weeklyActivityLogs);
  return ids;
}

export async function syncStateDiffToCloud(
  prevState: AppState,
  nextState: AppState,
  user: User,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  // 1. Diff members
  const prevMembersMap = new Map(prevState.members.map((m) => [m.id, m]));
  const nextMembersMap = new Map(nextState.members.map((m) => [m.id, m]));

  for (const nextMember of nextState.members) {
    const prevMember = prevMembersMap.get(nextMember.id);
    if (!prevMember || JSON.stringify(prevMember) !== JSON.stringify(nextMember)) {
      const docId = toScopedId(orgId, nextMember.id);
      ops.push((b) =>
        b.set(doc(db, 'members', docId), serializeMemberDoc(nextMember, user, orgId))
      );
    }
  }
  for (const prevMember of prevState.members) {
    if (!nextMembersMap.has(prevMember.id)) {
      const docId = toScopedId(orgId, prevMember.id);
      ops.push((b) => b.delete(doc(db, 'members', docId)));
    }
  }

  const prevLinkedEmails = collectMemberLinkedEmails(prevState.members);
  const nextLinkedEmails = collectMemberLinkedEmails(nextState.members);
  const linkedEmailsChanged =
    JSON.stringify(prevLinkedEmails) !== JSON.stringify(nextLinkedEmails);

  // 2. Diff records (including deleting records aged beyond 8/14-day retention)
  const prevRecords = extractRecordsMap(prevState, orgId);
  const nextRecords = extractRecordsMap(nextState, orgId);
  const allPrevRecordIds = extractAllRecordDocIds(prevState, orgId);

  for (const [docId, entry] of nextRecords.entries()) {
    const prevEntry = prevRecords.get(docId);
    const isKidSafe = KID_SAFE_RECORD_TYPES.has(entry.recordType);
    if (
      !prevEntry ||
      JSON.stringify(prevEntry) !== JSON.stringify(entry) ||
      (linkedEmailsChanged && isKidSafe)
    ) {
      const extraEmails = isKidSafe ? nextLinkedEmails : [];
      ops.push((b) =>
        b.set(doc(db, 'records', docId), {
          id: docId,
          recordType: entry.recordType,
          payload: entry.payload,
          ...makeSharedMeta(user, orgId, extraEmails),
        })
      );
    }
  }
  for (const docId of allPrevRecordIds) {
    if (!nextRecords.has(docId)) {
      ops.push((b) => b.delete(doc(db, 'records', docId)));
    }
  }

  // 3. Diff settings (also refresh sharedEmails when linked kid emails change)
  if (
    JSON.stringify(prevState.settings) !== JSON.stringify(nextState.settings) ||
    linkedEmailsChanged
  ) {
    const configDocId = toScopedId(orgId, 'settings');
    ops.push((b) =>
      b.set(
        doc(db, 'config', configDocId),
        serializeConfigDoc(nextState.settings, user, orgId, nextLinkedEmails)
      )
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
  onSettingsUpdate: (settings: AppSettings) => void,
  orgId: string = DEFAULT_ORG_ID
): () => void {
  const email = user.email || '';

  const membersQ =
    orgId === DEFAULT_ORG_ID
      ? query(collection(db, 'members'), where('sharedEmails', 'array-contains', email))
      : query(collection(db, 'members'), where('ownerUid', '==', user.uid));
  const recordsQ =
    orgId === DEFAULT_ORG_ID
      ? query(collection(db, 'records'), where('sharedEmails', 'array-contains', email))
      : query(collection(db, 'records'), where('ownerUid', '==', user.uid));
  const configQ =
    orgId === DEFAULT_ORG_ID
      ? query(collection(db, 'config'), where('sharedEmails', 'array-contains', email))
      : query(collection(db, 'config'), where('ownerUid', '==', user.uid));

  const unsubMembers = onSnapshot(
    membersQ,
    (snapshot) => {
      if (snapshot.empty) return;
      const list: Member[] = [];
      snapshot.forEach((docSnap) => {
        if (!belongsToOrg(orgId, docSnap.id)) return;
        const d = docSnap.data() as Record<string, unknown>;
        const localId = fromScopedId(
          orgId,
          typeof d.id === 'string' ? d.id : docSnap.id
        );
        const rawNickname = typeof d.nickname === 'string' ? d.nickname : '';
        const migratedNickname =
          localId === 's7' && d.pin === '2965' && rawNickname === 'ฟา' ? 'ฟ้า' : rawNickname;
        list.push({
          ...(d as unknown as Member),
          id: localId,
          nickname: migratedNickname,
          group: d.group === null ? undefined : (d.group as Member['group']),
          pet: d.pet === null ? undefined : (d.pet as Member['pet']),
          allowance: d.allowance === null ? undefined : (d.allowance as Member['allowance']),
          customHouseChore:
            typeof d.customHouseChore === 'string' ? d.customHouseChore : undefined,
          linkedEmail:
            typeof d.linkedEmail === 'string' && d.linkedEmail.trim()
              ? d.linkedEmail.trim().toLowerCase()
              : undefined,
          emailLoginBonusClaimed: Boolean(d.emailLoginBonusClaimed),
        });
      });
      if (list.length === 0) return;
      if (orgId === DEFAULT_ORG_ID) {
        const initialOrder = new Map(
          INITIAL_APP_STATE.members.map((m, idx) => [m.id, idx])
        );
        list.sort(
          (a, b) =>
            (initialOrder.get(a.id) ?? 999) - (initialOrder.get(b.id) ?? 999)
        );
      }
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
      const weeklyActivityLogs: WeeklyActivityLog[] = [];

      let matchedAny = false;
      snapshot.forEach((docSnap) => {
        if (!belongsToOrg(orgId, docSnap.id)) return;
        matchedAny = true;
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
          case 'weekly_activity_log':
            weeklyActivityLogs.push(d.payload as unknown as WeeklyActivityLog);
            break;
        }
      });

      if (!matchedAny) return;
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
      weeklyActivityLogs.sort(byNewest);
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
        weeklyActivityLogs,
        ...(effectiveShopItems.length > 0 ? { shopItems: effectiveShopItems } : {}),
      });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'records')
  );

  const expectedConfigDocId = toScopedId(orgId, 'settings');
  const unsubConfig = onSnapshot(
    configQ,
    (snapshot) => {
      snapshot.forEach((docSnap) => {
        if (docSnap.id === expectedConfigDocId) {
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
            lastWeeklyClearedAt:
              typeof d.lastWeeklyClearedAt === 'string' ? d.lastWeeklyClearedAt : null,
            useOwnStorageOnly: Boolean(d.useOwnStorageOnly),
            enableCoinsAndPiggyBank: Boolean(d.enableCoinsAndPiggyBank),
            organizationPreset:
              typeof d.organizationPreset === 'string'
                ? (d.organizationPreset as AppSettings['organizationPreset'])
                : undefined,
            automationAddons: Array.isArray(d.automationAddons)
              ? (d.automationAddons.filter(
                  (x): x is NonNullable<AppSettings['automationAddons']>[number] =>
                    typeof x === 'string'
                ) as AppSettings['automationAddons'])
              : undefined,
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

export interface LinkedKidCloudUpdate {
  member: Member;
  session: LinkedKidSession;
}

function deserializeMemberFromDoc(d: Record<string, unknown>, docId: string, orgId: string): Member {
  const localId = fromScopedId(orgId, typeof d.id === 'string' ? d.id : docId);
  const rawNickname = typeof d.nickname === 'string' ? d.nickname : '';
  const migratedNickname =
    localId === 's7' && d.pin === '2965' && rawNickname === 'ฟา' ? 'ฟ้า' : rawNickname;
  return {
    ...(d as unknown as Member),
    id: localId,
    nickname: migratedNickname,
    group: d.group === null ? undefined : (d.group as Member['group']),
    pet: d.pet === null ? undefined : (d.pet as Member['pet']),
    allowance: d.allowance === null ? undefined : (d.allowance as Member['allowance']),
    customHouseChore:
      typeof d.customHouseChore === 'string' ? d.customHouseChore : undefined,
    linkedEmail:
      typeof d.linkedEmail === 'string' && d.linkedEmail.trim()
        ? d.linkedEmail.trim().toLowerCase()
        : undefined,
    emailLoginBonusClaimed: Boolean(d.emailLoginBonusClaimed),
  };
}

export function subscribeLinkedKidCloud(
  user: User,
  onKidUpdate: (update: LinkedKidCloudUpdate) => void,
  onNotFound: () => void,
  onSafeRecordsUpdate?: (patch: Partial<AppState>) => void,
  onSettingsUpdate?: (settings: AppSettings) => void
): () => void {
  const email = normalizeEmail(user.email);
  if (!email) {
    onNotFound();
    return () => {};
  }

  let subscribedOrgId: string | null = null;
  let unsubRecords: (() => void) | null = null;
  let unsubConfig: (() => void) | null = null;

  const cleanupSecondary = () => {
    if (unsubRecords) {
      unsubRecords();
      unsubRecords = null;
    }
    if (unsubConfig) {
      unsubConfig();
      unsubConfig = null;
    }
    subscribedOrgId = null;
  };

  const membersQ = query(
    collection(db, 'members'),
    where('sharedEmails', 'array-contains', email)
  );

  const unsubMembers = onSnapshot(
    membersQ,
    (snapshot) => {
      let matchedDoc: { id: string; data: Record<string, unknown> } | null = null;
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const docLinked = normalizeEmail(typeof d.linkedEmail === 'string' ? d.linkedEmail : '');
        if (docLinked === email) {
          if (!matchedDoc || d.role === 'kid') {
            matchedDoc = { id: docSnap.id, data: d };
          }
        }
      });

      if (!matchedDoc) {
        cleanupSecondary();
        onNotFound();
        return;
      }

      const foundDoc = matchedDoc as { id: string; data: Record<string, unknown> };
      const orgId = extractOrgIdFromDocId(foundDoc.id);
      const member = deserializeMemberFromDoc(foundDoc.data, foundDoc.id, orgId);
      const session: LinkedKidSession = {
        orgId,
        memberDocId: foundDoc.id,
        memberId: member.id,
        email,
        ownerUid: typeof foundDoc.data.ownerUid === 'string' ? foundDoc.data.ownerUid : '',
        sharedEmails: Array.isArray(foundDoc.data.sharedEmails)
          ? (foundDoc.data.sharedEmails as string[])
          : [email],
      };

      onKidUpdate({ member, session });

      if (subscribedOrgId !== orgId) {
        cleanupSecondary();
        subscribedOrgId = orgId;

        if (onSafeRecordsUpdate) {
          const recQ = query(
            collection(db, 'records'),
            where('sharedEmails', 'array-contains', email)
          );
          unsubRecords = onSnapshot(
            recQ,
            (recSnap) => {
              const announcements: Announcement[] = [];
              const polls: SecretPoll[] = [];
              const trips: OutingTrip[] = [];
              const shopItems: ShopItem[] = [];
              let matchedAny = false;
              recSnap.forEach((docSnap) => {
                if (!belongsToOrg(orgId, docSnap.id)) return;
                matchedAny = true;
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
                  case 'shop_item':
                    shopItems.push(d.payload as unknown as ShopItem);
                    break;
                }
              });
              if (!matchedAny) return;
              const byNewest = (a: { createdAt?: string }, b: { createdAt?: string }) =>
                (b.createdAt || '').localeCompare(a.createdAt || '');
              announcements.sort(byNewest);
              polls.sort(byNewest);
              trips.sort(byNewest);

              const shopOrder = new Map(
                INITIAL_APP_STATE.shopItems.map((item, idx) => [item.id, idx])
              );
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

              onSafeRecordsUpdate({
                announcements,
                polls,
                trips,
                ...(effectiveShopItems.length > 0 ? { shopItems: effectiveShopItems } : {}),
              });
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'records')
          );
        }

        if (onSettingsUpdate) {
          const expectedConfigDocId = toScopedId(orgId, 'settings');
          const cfgQ = query(
            collection(db, 'config'),
            where('sharedEmails', 'array-contains', email)
          );
          unsubConfig = onSnapshot(
            cfgQ,
            (cfgSnap) => {
              cfgSnap.forEach((docSnap) => {
                if (docSnap.id !== expectedConfigDocId) return;
                const d = docSnap.data() as Record<string, unknown>;
                onSettingsUpdate({
                  syncWebhookUrl: '',
                  returnHomeDriveUrl:
                    typeof d.returnHomeDriveUrl === 'string' ? d.returnHomeDriveUrl : '',
                  creatorPins: [],
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
                  lastWeeklyClearedAt:
                    typeof d.lastWeeklyClearedAt === 'string' ? d.lastWeeklyClearedAt : null,
                  useOwnStorageOnly: Boolean(d.useOwnStorageOnly),
                  enableCoinsAndPiggyBank: Boolean(d.enableCoinsAndPiggyBank),
                  organizationPreset:
                    typeof d.organizationPreset === 'string'
                      ? (d.organizationPreset as AppSettings['organizationPreset'])
                      : undefined,
                  automationAddons: Array.isArray(d.automationAddons)
                    ? (d.automationAddons.filter(
                        (x): x is NonNullable<AppSettings['automationAddons']>[number] =>
                          typeof x === 'string'
                      ) as AppSettings['automationAddons'])
                    : undefined,
                });
              });
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'config')
          );
        }
      }
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'members')
  );

  return () => {
    unsubMembers();
    cleanupSecondary();
  };
}

export async function syncLinkedKidSelfToCloud(
  prevMember: Member,
  nextMember: Member,
  session: LinkedKidSession,
  user: User
): Promise<void> {
  if (JSON.stringify(prevMember) === JSON.stringify(nextMember)) return;
  const path = `members/${session.memberDocId}`;
  const docPayload = serializeMemberDoc(nextMember, user, session.orgId, {
    ownerUid: session.ownerUid,
    sharedEmails: session.sharedEmails,
  });
  try {
    await setDoc(doc(db, 'members', session.memberDocId), docPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
