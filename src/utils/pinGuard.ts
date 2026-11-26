import { useEffect, useState } from 'react';
import { AppSettings, Language, Member } from '../types/barnhem';

export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30_000;

interface PinGuardRecord {
  failures: number;
  lockedUntilMs: number;
}

const STORAGE_PREFIX = 'barnhem_pin_guard_v1_';

function readRecord(scopeKey: string): PinGuardRecord {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${scopeKey}`);
    if (!raw) return { failures: 0, lockedUntilMs: 0 };
    const parsed = JSON.parse(raw) as Partial<PinGuardRecord>;
    return {
      failures: typeof parsed.failures === 'number' ? parsed.failures : 0,
      lockedUntilMs: typeof parsed.lockedUntilMs === 'number' ? parsed.lockedUntilMs : 0,
    };
  } catch {
    return { failures: 0, lockedUntilMs: 0 };
  }
}

function writeRecord(scopeKey: string, rec: PinGuardRecord): void {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${scopeKey}`, JSON.stringify(rec));
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function usePinGuard(scopeKey: string) {
  const [record, setRecord] = useState<PinGuardRecord>(() => readRecord(scopeKey));
  const [tickNowMs, setTickNowMs] = useState<number>(() => Date.now());

  const remainingMs = Math.max(0, record.lockedUntilMs - tickNowMs);
  const isLocked = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const attemptsLeft = Math.max(0, MAX_PIN_ATTEMPTS - record.failures);

  useEffect(() => {
    if (record.lockedUntilMs <= Date.now()) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setTickNowMs(now);
      if (now >= record.lockedUntilMs) {
        const reset: PinGuardRecord = { failures: 0, lockedUntilMs: 0 };
        writeRecord(scopeKey, reset);
        setRecord(reset);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [record.lockedUntilMs, scopeKey]);

  const recordFailure = (): { lockedNow: boolean; lockSec: number; attemptsRemaining: number } => {
    const now = Date.now();
    const current = readRecord(scopeKey);
    if (current.lockedUntilMs > now) {
      setRecord(current);
      setTickNowMs(now);
      return {
        lockedNow: true,
        lockSec: Math.ceil((current.lockedUntilMs - now) / 1000),
        attemptsRemaining: 0,
      };
    }
    const nextFailures = current.failures + 1;
    if (nextFailures >= MAX_PIN_ATTEMPTS) {
      const lockedUntilMs = now + LOCKOUT_DURATION_MS;
      const next: PinGuardRecord = { failures: MAX_PIN_ATTEMPTS, lockedUntilMs };
      writeRecord(scopeKey, next);
      setRecord(next);
      setTickNowMs(now);
      return {
        lockedNow: true,
        lockSec: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        attemptsRemaining: 0,
      };
    }
    const next: PinGuardRecord = { failures: nextFailures, lockedUntilMs: 0 };
    writeRecord(scopeKey, next);
    setRecord(next);
    setTickNowMs(now);
    return {
      lockedNow: false,
      lockSec: 0,
      attemptsRemaining: Math.max(0, MAX_PIN_ATTEMPTS - nextFailures),
    };
  };

  const recordSuccess = () => {
    const reset: PinGuardRecord = { failures: 0, lockedUntilMs: 0 };
    writeRecord(scopeKey, reset);
    setRecord(reset);
  };

  return {
    isLocked,
    remainingSec,
    attemptsLeft,
    recordFailure,
    recordSuccess,
  };
}

export function formatPinLockoutMessage(remainingSec: number, lang: Language): string {
  return lang === 'th'
    ? `กรอกรหัส PIN ผิดครบ ${MAX_PIN_ATTEMPTS} ครั้ง ระบบล็อกชั่วคราว ${remainingSec} วินาที เพื่อป้องกันการเดารหัสค่ะ`
    : `Too many incorrect PIN attempts (${MAX_PIN_ATTEMPTS}). Locked for ${remainingSec}s to prevent guessing.`;
}

export function formatPinAttemptsHint(attemptsRemaining: number, lang: Language): string {
  return lang === 'th'
    ? `เหลือโอกาสลองได้อีก ${attemptsRemaining} ครั้ง ก่อนระบบล็อกชั่วคราว 30 วินาที`
    : `${attemptsRemaining} attempt(s) remaining before a 30-second cooldown.`;
}

export interface PinConflictResult {
  conflict: boolean;
  conflictOwnerLabel?: string;
}

export const ACTIVITY_LOG_VIEWER_PIN = '0001';
export const KIDS_STAR_SUMMARY_PIN = '0002';
export const KIDS_DUTY_ROSTER_PIN = '0003';
export const SECRET_VOTE_PIN = '0004';
export const SUPPLY_REQUEST_PIN = '0005';
export const LOST_FOUND_PIN = '0006';
export const HOUSE_RULES_GUIDE_PIN = '0007';

/**
 * Ensures 4-digit PINs never collide between kids, staff, chefs, tutors, managers, creator master PINs, or reserved viewer PINs.
 */
export function findPinConflict(
  pin: string,
  members: Member[],
  creatorPins: string[],
  excludeMemberId?: string
): PinConflictResult {
  const clean = pin.trim();
  if (!/^\d{4}$/.test(clean)) return { conflict: false };

  if (clean === ACTIVITY_LOG_VIEWER_PIN) {
    return {
      conflict: true,
      conflictOwnerLabel: 'รหัส 0001 (ดูประวัติบันทึกการทำรายการของเด็ก)',
    };
  }

  if (clean === KIDS_STAR_SUMMARY_PIN) {
    return {
      conflict: true,
      conflictOwnerLabel: 'รหัส 0002 (เช็คยอดดาวของเด็กๆ ทั้งหมด)',
    };
  }

  if (clean === KIDS_DUTY_ROSTER_PIN) {
    return {
      conflict: true,
      conflictOwnerLabel: 'รหัส 0003 (เช็คตารางเวรเด็กทั้งหมด)',
    };
  }

  if (clean === SECRET_VOTE_PIN) {
    return {
      conflict: true,
      conflictOwnerLabel: 'รหัส 0004 (โหวตลับ)',
    };
  }

  if (clean === SUPPLY_REQUEST_PIN) {
    return {
      conflict: true,
      conflictOwnerLabel: 'รหัส 0005 (ขอเบิกของใช้)',
    };
  }

  if (clean === LOST_FOUND_PIN) {
    return {
      conflict: true,
      conflictOwnerLabel: 'รหัส 0006 (แจ้งของหาย/แจ้งพบเจอของเก็บได้)',
    };
  }

  if (clean === HOUSE_RULES_GUIDE_PIN) {
    return {
      conflict: true,
      conflictOwnerLabel: 'รหัส 0007 (ข้อตกลงและขั้นตอนการกดระบบประจำวัน)',
    };
  }

  if (creatorPins.includes(clean)) {
    return {
      conflict: true,
      conflictOwnerLabel: 'โหมดผู้สร้างสูงสุด (Creator PIN)',
    };
  }

  const dupMember = members.find(
    (m) => m.id !== excludeMemberId && m.pin.trim() === clean
  );
  if (dupMember) {
    return {
      conflict: true,
      conflictOwnerLabel: `${dupMember.emoji} ${dupMember.nickname} (${dupMember.id})`,
    };
  }

  return { conflict: false };
}

/**
 * Returns the active 4-digit secret code set by Creator for days when staff are away,
 * ONLY if it is a valid 4-digit string matching `todayKey` (YYYY-MM-DD).
 */
export function getActiveKidAwaySecretCode(
  settings: Partial<AppSettings> | undefined,
  todayKey: string
): string | null {
  const code = (settings?.kidAwaySecretCode ?? '').trim();
  const dateKey = settings?.kidAwaySecretDateKey ?? null;
  if (!/^\d{4}$/.test(code) || !dateKey || dateKey !== todayKey) return null;
  return code;
}

/**
 * Generates a random 4-digit numeric code (1000..9999) that does not collide
 * with any member PIN or Creator PIN.
 */
export function generateNonConflicting4DigitCode(
  members: Member[],
  creatorPins: string[]
): string {
  for (let i = 0; i < 200; i += 1) {
    const candidate = String(Math.floor(1000 + Math.random() * 9000));
    if (!findPinConflict(candidate, members, creatorPins).conflict) {
      return candidate;
    }
  }
  return '4829';
}
