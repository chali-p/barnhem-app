import { WeeklyActivityLog } from '../types/barnhem';

export const ACTIVITY_LOG_RETENTION_DAYS = 7;
export const ACTIVITY_LOG_RETENTION_MS = ACTIVITY_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const ACTIVITY_LOG_MAX_ITEMS = 1500;

export function parseActivityLogTimestampMs(log: WeeklyActivityLog): number | null {
  if (log.createdAt) {
    const ms = Date.parse(log.createdAt);
    if (!Number.isNaN(ms)) return ms;
  }
  if (log.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(log.dateKey)) {
    const ms = Date.parse(`${log.dateKey}T23:59:59`);
    if (!Number.isNaN(ms)) return ms;
  }
  return null;
}

export function isActivityLogWithinRetention(
  log: WeeklyActivityLog,
  now: Date = new Date()
): boolean {
  const ts = parseActivityLogTimestampMs(log);
  if (ts === null) return false;
  const ageMs = now.getTime() - ts;
  return ageMs <= ACTIVITY_LOG_RETENTION_MS;
}

export function pruneWeeklyActivityLogs(
  logs: WeeklyActivityLog[] | undefined,
  now: Date = new Date()
): WeeklyActivityLog[] {
  if (!Array.isArray(logs) || logs.length === 0) return [];
  const valid = logs.filter((log) => isActivityLogWithinRetention(log, now));
  valid.sort((a, b) => {
    const ta = parseActivityLogTimestampMs(a) ?? 0;
    const tb = parseActivityLogTimestampMs(b) ?? 0;
    return tb - ta;
  });
  return valid.slice(0, ACTIVITY_LOG_MAX_ITEMS);
}

export function hasExpiredWeeklyActivityLogs(
  logs: WeeklyActivityLog[] | undefined,
  now: Date = new Date()
): boolean {
  if (!Array.isArray(logs) || logs.length === 0) return false;
  return logs.some((log) => !isActivityLogWithinRetention(log, now));
}

export function getRemainingRetentionDays(
  log: WeeklyActivityLog,
  now: Date = new Date()
): number {
  const ts = parseActivityLogTimestampMs(log);
  if (ts === null) return 0;
  const remainingMs = ACTIVITY_LOG_RETENTION_MS - Math.max(0, now.getTime() - ts);
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}
