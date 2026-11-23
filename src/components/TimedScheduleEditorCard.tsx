import React, { useEffect, useState } from 'react';
import { AppSettings, Language, TimedScheduleSlot } from '../types/barnhem';
import {
  DEFAULT_HOMEWORK_CURFEW_MINS,
  getEffectiveHomeQuickActions,
  getEffectiveHomeworkCurfewMins,
  minsToHHMM,
} from '../utils/expressKiosk';

interface TimedScheduleEditorCardProps {
  settings?: Partial<AppSettings>;
  lang: Language;
  onSave: (nextSchedule: Record<string, TimedScheduleSlot>, nextCurfewMins: number) => void;
  onClose?: () => void;
}

function parseHHMM(val: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(val.trim());
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return h * 60 + min;
}

export const TimedScheduleEditorCard: React.FC<TimedScheduleEditorCardProps> = ({
  settings,
  lang,
  onSave,
  onClose,
}) => {
  const [draftSlots, setDraftSlots] = useState<Record<string, { start: string; end: string }>>(() => {
    const actions = getEffectiveHomeQuickActions(settings);
    const out: Record<string, { start: string; end: string }> = {};
    for (const a of actions) {
      out[a.id] = { start: minsToHHMM(a.startMins), end: minsToHHMM(a.endMins) };
    }
    return out;
  });

  const [draftCurfew, setDraftCurfew] = useState<string>(() =>
    minsToHHMM(getEffectiveHomeworkCurfewMins(settings))
  );

  useEffect(() => {
    const actions = getEffectiveHomeQuickActions(settings);
    const next: Record<string, { start: string; end: string }> = {};
    for (const a of actions) {
      next[a.id] = { start: minsToHHMM(a.startMins), end: minsToHHMM(a.endMins) };
    }
    setDraftSlots(next);
    setDraftCurfew(minsToHHMM(getEffectiveHomeworkCurfewMins(settings)));
  }, [settings]);

  const effectiveActions = getEffectiveHomeQuickActions(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const outSchedule: Record<string, TimedScheduleSlot> = {};
    for (const a of effectiveActions) {
      const slot = draftSlots[a.id];
      outSchedule[a.id] = {
        startMins: parseHHMM(slot?.start ?? '', a.startMins),
        endMins: parseHHMM(slot?.end ?? '', a.endMins),
      };
    }
    const nextCurfew = parseHHMM(draftCurfew, DEFAULT_HOMEWORK_CURFEW_MINS);
    onSave(outSchedule, nextCurfew);
  };

  const handleReset = () => {
    onSave({}, DEFAULT_HOMEWORK_CURFEW_MINS);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border-2 border-[#C8B7EB] bg-[#FBF8FF] p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-extrabold text-[#3E2B63]">
            ⚙️ {lang === 'th' ? 'ตั้งค่าเวลาเปิด–ปิดคำสั่งหลักทั้งหมด (แก้ไขได้เองทันที)' : 'Edit Core Timed Schedules'}
          </div>
          <p className="text-[11px] text-[#5B4782] mt-0.5">
            {lang === 'th'
              ? 'ปรับเวลาเปิด–ปิดของทั้ง 7 คำสั่ง และเส้นตายคืนมือถือ (มีผลทั้งหน้าแรก ช่องที่ 3 และระบบแจ้งเตือน)'
              : 'Adjust start/end windows for all 7 core actions and curfew deadline across all screens.'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#6E5C52] hover:text-[#3D322C] cursor-pointer shrink-0"
          >
            {lang === 'th' ? 'ปิด' : 'Close'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {effectiveActions.map((act) => {
          const slot = draftSlots[act.id] ?? {
            start: minsToHHMM(act.startMins),
            end: minsToHHMM(act.endMins),
          };
          return (
            <div
              key={act.id}
              className="rounded-xl border border-[#E2D8F6] bg-white px-3 py-2 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{act.emoji}</span>
                <span className="text-xs font-extrabold text-[#3D322C] truncate">
                  {lang === 'th' ? act.titleTh : act.titleEn}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) =>
                    setDraftSlots((prev) => ({
                      ...prev,
                      [act.id]: { ...slot, start: e.target.value },
                    }))
                  }
                  className="rounded-lg border border-[#D4C5B4] bg-[#FFFDF9] px-2 py-1 font-bold tabular-nums text-[#3D322C]"
                />
                <span className="font-bold text-[#7B695F]">–</span>
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) =>
                    setDraftSlots((prev) => ({
                      ...prev,
                      [act.id]: { ...slot, end: e.target.value },
                    }))
                  }
                  className="rounded-lg border border-[#D4C5B4] bg-[#FFFDF9] px-2 py-1 font-bold tabular-nums text-[#3D322C]"
                />
              </div>
            </div>
          );
        })}

        {/* Curfew Deadline for Free Day Forfeit Rule */}
        <div className="rounded-xl border-2 border-[#F3B7C0] bg-[#FFF5F7] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[#8B1D36]">
              ⚖️ {lang === 'th' ? 'เส้นตายเก็บมือถือ (เกินเวลานี้งดใช้โทรศัพท์วัน Free Day 1 วัน)' : 'Curfew Deadline (Free Day Forfeit)'}
            </div>
            <div className="text-[11px] text-[#7A3547]">
              {lang === 'th' ? 'ค่าเริ่มต้น: 21:00 น. (3 ทุ่ม)' : 'Default: 21:00'}
            </div>
          </div>
          <input
            type="time"
            value={draftCurfew}
            onChange={(e) => setDraftCurfew(e.target.value)}
            className="rounded-lg border border-[#F3B7C0] bg-white px-2.5 py-1 text-xs font-extrabold tabular-nums text-[#8B1D36]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 min-h-[40px] rounded-xl bg-[#3E2B63] hover:bg-[#2F1F4E] text-white text-xs sm:text-sm font-extrabold px-4 py-2 cursor-pointer"
        >
          💾 {lang === 'th' ? 'บันทึกเวลาทั้งหมด' : 'Save Schedule'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="min-h-[40px] rounded-xl border border-[#D4C5B4] bg-white hover:bg-[#FAF6F2] text-xs font-bold text-[#6E5C52] px-3 py-2 cursor-pointer"
        >
          ↺ {lang === 'th' ? 'คืนค่าเดิม' : 'Reset'}
        </button>
      </div>
    </form>
  );
};
