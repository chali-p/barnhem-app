import {
  createEmptyDaily,
  INITIAL_APP_STATE,
  LEGACY_KID_PIN_MIGRATIONS,
  TARGET_NOV25_KID_PINS,
} from '../data/initialData';
import { AppState, ReturnHomePhoto } from '../types/barnhem';
import { pruneWeeklyActivityLogs } from './activityLogRetention';
import { ensureCurrentWeekAllowance } from './piggyBank';
import { getDateKey } from './timeRules';

const STORAGE_KEY = 'barnhem_super_app_v1';
const PIN_BATCH_NOV25_KEY = 'barnhem_pin_batch_nov25_v1';

export function loadAppState(): AppState {
  const todayKey = getDateKey(new Date());
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return INITIAL_APP_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const existingMembers = Array.isArray(parsed.members) ? parsed.members : INITIAL_APP_STATE.members;

    const applyBatchNov25 = localStorage.getItem(PIN_BATCH_NOV25_KEY) !== 'done';

    // Ensure all initial members exist (e.g. if chefs or new members were added)
    const existingIds = new Set(existingMembers.map((m) => m.id));
    const mergedMembers = [
      ...existingMembers.map((m) => {
        const baseDaily = createEmptyDaily(todayKey, m.daily);
        const daily =
          m.daily && m.daily.dateKey === todayKey
            ? {
                ...baseDaily,
                ...m.daily,
                trashDutyByDate: m.daily.trashDutyByDate ?? baseDaily.trashDutyByDate,
              }
            : baseDaily;
        const migratedNickname =
          m.id === 's7' && (m.pin === '2965' || m.pin === '2279') && m.nickname === 'ฟา'
            ? 'ฟ้า'
            : m.nickname;
        const legacyPinMig = LEGACY_KID_PIN_MIGRATIONS[m.id];
        const migratedPin =
          applyBatchNov25 && TARGET_NOV25_KID_PINS[m.id]
            ? TARGET_NOV25_KID_PINS[m.id]
            : legacyPinMig && m.pin === legacyPinMig.oldPin
            ? legacyPinMig.newPin
            : m.pin;
        const mergedMember = {
          ...m,
          nickname: migratedNickname,
          pin: migratedPin,
          healthProfile: m.healthProfile ?? {
            bloodType: 'ไม่ระบุ',
            foodAllergies: 'ไม่มี',
            drugAllergies: 'ไม่มี',
            chronicConditions: 'ไม่มี',
            regularMeds: 'ไม่มี',
            emergencyNote: 'สุขภาพแข็งแรงปกติ',
          },
          streak: m.streak ?? {
            currentMorningStreak: 0,
            bestMorningStreak: 0,
            lastOnTimeDateKey: null,
            streakMilestonesClaimed: 0,
          },
          kitchenDuty: m.kitchenDuty ?? { evening1530: false, sat0930: false, sun0915: false },
          daily,
          starHistory: Array.isArray(m.starHistory) ? m.starHistory : [],
          collectedSceneItems: Array.isArray(m.collectedSceneItems) ? m.collectedSceneItems : [],
          ownedShopItemIds: Array.isArray(m.ownedShopItemIds) ? m.ownedShopItemIds : [],
          unlockedCoverStages: Array.isArray(m.unlockedCoverStages) ? m.unlockedCoverStages : [1],
          pet: m.pet ?? undefined,
        };
        if (mergedMember.role === 'kid') {
          const { allowance } = ensureCurrentWeekAllowance(
            mergedMember,
            new Date(),
            parsed.settings
          );
          mergedMember.allowance = allowance;
        }
        return mergedMember;
      }),
      ...INITIAL_APP_STATE.members.filter((m) => !existingIds.has(m.id)),
    ];

    const existingShopIds = new Set((parsed.shopItems ?? []).map((s) => s.id));
    const missingMinimartItems = INITIAL_APP_STATE.shopItems.filter(
      (s) => !existingShopIds.has(s.id) && s.id.startsWith('minimart_')
    );
    const missingOtherItems = INITIAL_APP_STATE.shopItems.filter(
      (s) => !existingShopIds.has(s.id) && !s.id.startsWith('minimart_')
    );
    const mergedShop = [
      ...missingMinimartItems,
      ...(parsed.shopItems ?? INITIAL_APP_STATE.shopItems),
      ...missingOtherItems,
    ];

    const loadedCreatorPins = parsed.settings?.creatorPins ?? INITIAL_APP_STATE.settings.creatorPins;
    const migratedCreatorPins = loadedCreatorPins.map((p) => (p === '6417' ? '1629' : p));

    const nextState: AppState = {
      members: mergedMembers,
      shopItems: mergedShop,
      sickReports: Array.isArray(parsed.sickReports) ? parsed.sickReports : [],
      snackBills: Array.isArray(parsed.snackBills) ? parsed.snackBills : [],
      kitchenLogs: Array.isArray(parsed.kitchenLogs) ? parsed.kitchenLogs : [],
      returnHomePhotos: Array.isArray(parsed.returnHomePhotos) ? parsed.returnHomePhotos : [],
      announcements: Array.isArray(parsed.announcements)
        ? parsed.announcements.filter(
            (a) => a.id !== 'ann_welcome' && !a.id.startsWith('ann_welcome_')
          )
        : [],
      polls: Array.isArray(parsed.polls)
        ? parsed.polls.filter((p) => p.id !== 'poll_weekend_activity')
        : [],
      trips: Array.isArray(parsed.trips)
        ? parsed.trips.filter((t) => t.id !== 'trip_weekend_park')
        : [],
      privateMessages: Array.isArray(parsed.privateMessages) ? parsed.privateMessages : [],
      lostFoundItems: Array.isArray(parsed.lostFoundItems)
        ? parsed.lostFoundItems.filter((i) => i.id !== 'lf_bottle_demo')
        : [],
      supplyRequests: Array.isArray(parsed.supplyRequests) ? parsed.supplyRequests : [],
      kindnessCards: Array.isArray(parsed.kindnessCards)
        ? parsed.kindnessCards.filter((c) => c.id !== 'kind_welcome_1')
        : [],
      deedRedemptions: Array.isArray(parsed.deedRedemptions) ? parsed.deedRedemptions : [],
      friendVisits: Array.isArray(parsed.friendVisits) ? parsed.friendVisits : [],
      goldenPoolLogs: Array.isArray(parsed.goldenPoolLogs) ? parsed.goldenPoolLogs : [],
      staffLeaves: Array.isArray(parsed.staffLeaves) ? parsed.staffLeaves : [],
      weeklyActivityLogs: pruneWeeklyActivityLogs(
        Array.isArray(parsed.weeklyActivityLogs) ? parsed.weeklyActivityLogs : [],
        new Date()
      ),
      settings: {
        ...INITIAL_APP_STATE.settings,
        ...(parsed.settings ?? {}),
        creatorPins: migratedCreatorPins,
      },
      lastSyncedAt: parsed.lastSyncedAt ?? null,
    };
    if (applyBatchNov25) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        localStorage.setItem(PIN_BATCH_NOV25_KEY, 'done');
      } catch {
        // Ignore storage write errors
      }
    }
    return nextState;
  } catch {
    return INITIAL_APP_STATE;
  }
}

export function saveAppStateLocal(state: AppState): void {
  try {
    const pruned: AppState = {
      ...state,
      weeklyActivityLogs: pruneWeeklyActivityLogs(state.weeklyActivityLogs, new Date()),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // Handle storage quota gracefully
  }
}

export async function postSyncToDriveOrSheet(state: AppState, eventLabel: string): Promise<boolean> {
  const url = state.settings.syncWebhookUrl?.trim();
  if (!url) return false;
  try {
    const payload = {
      app: 'Barnhem Super App (All-in-One)',
      event: eventLabel,
      syncedAt: new Date().toISOString(),
      summary: {
        totalMembers: state.members.length,
        totalKids: state.members.filter((m) => m.role === 'kid').length,
        activeSickCases: state.sickReports.filter((r) => !r.resolved).length,
      },
      data: state,
    };
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}

export async function postTimestampPhotoToGoogleSheet(
  webhookUrl: string | undefined | null,
  photo: ReturnHomePhoto,
  orgName: string
): Promise<boolean> {
  const url = webhookUrl?.trim();
  if (!url) return false;
  try {
    const payload = {
      app: 'Barnhem Timestamp Check-In',
      event: 'timestamp_checkin_photo',
      syncedAt: photo.capturedAt,
      orgName,
      timestampCheckIn: {
        id: photo.id,
        dateKey: photo.dateKey,
        capturedAt: photo.capturedAt,
        capturedAtThai: new Date(photo.capturedAt).toLocaleString('th-TH'),
        personName: photo.kidNickname,
        personId: photo.kidId,
        activityTag: photo.activityTag ?? 'general_checkin',
        activityLabel: photo.activityLabel ?? 'เช็คอินไทม์แสตมป์',
        note: photo.note ?? '',
        driveFolderUrl: photo.driveFolderUrl ?? '',
        imageBase64: photo.imageBase64,
      },
    };
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}

export function downloadJsonBackup(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `barnhem-backup-${getDateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.event === 'timestamp_checkin_photo' && body.timestampCheckIn) {
      var tsSheet = ss.getSheetByName('TimestampCheckIns') || ss.insertSheet('TimestampCheckIns');
      if (tsSheet.getLastRow() === 0) {
        tsSheet.appendRow(['เวลาบันทึก (ไทย)', 'วันที่', 'ชื่อผู้เช็คอิน', 'รหัส', 'กิจกรรม', 'หมายเหตุ', 'องค์กร', 'รูปภาพ Base64']);
      }
      var c = body.timestampCheckIn;
      tsSheet.appendRow([
        c.capturedAtThai || c.capturedAt || new Date().toISOString(),
        c.dateKey || '',
        c.personName || '',
        c.personId || '',
        c.activityLabel || '',
        c.note || '',
        body.orgName || '',
        c.imageBase64 || ''
      ]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, sheet: 'TimestampCheckIns' })).setMimeType(ContentService.MimeType.JSON);
    }
    var sheet = ss.getSheetByName('Logs') || ss.insertSheet('Logs');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['เวลาซิงค์', 'เหตุการณ์', 'สมาชิกทั้งหมด', 'จำนวนเด็ก', 'รายงานป่วย', 'ข้อมูลเต็ม (JSON)']);
    }
    var sum = body.summary || {};
    sheet.appendRow([
      body.syncedAt || new Date().toISOString(),
      body.event || 'Sync',
      sum.totalMembers || 0,
      sum.totalKids || 0,
      sum.activeSickCases || 0,
      JSON.stringify(body.data || {})
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export async function copyTextToClipboard(text: string): Promise<boolean> {
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    document.body.removeChild(textarea);
  }
  return copied;
}

