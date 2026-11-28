import React from 'react';
import { Language } from '../types/barnhem';

export type AmPmPeriod = 'AM' | 'PM';

export interface Parsed12HourTime {
  hour12: number;
  minute: number;
  period: AmPmPeriod;
  hour24: number;
  hhmm24: string;
}

export function parseHHMMTo12Hour(hhmm: string): Parsed12HourTime {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  const h24 = m ? Math.min(23, Math.max(0, Number(m[1]))) : 8;
  const min = m ? Math.min(59, Math.max(0, Number(m[2]))) : 0;
  const period: AmPmPeriod = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {
    hour12,
    minute: min,
    period,
    hour24: h24,
    hhmm24: `${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
}

export function buildHHMMFrom12Hour(
  hour12: number,
  minute: number,
  period: AmPmPeriod
): string {
  const safe12 = Math.min(12, Math.max(1, Math.round(hour12)));
  const safeMin = Math.min(59, Math.max(0, Math.round(minute)));
  let h24 = safe12 % 12;
  if (period === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(safeMin).padStart(2, '0')}`;
}

export function formatHHMMAs12Hour(hhmm: string): string {
  const { hour12, minute, period } = parseHHMMTo12Hour(hhmm);
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

interface TimeAmPmInputProps {
  value: string;
  onChange: (nextHHMM: string) => void;
  tone?: 'default' | 'pink' | 'mint' | 'lavender';
  compact?: boolean;
  lang?: Language;
  ariaLabel?: string;
}

export const TimeAmPmInput: React.FC<TimeAmPmInputProps> = ({
  value,
  onChange,
  tone = 'default',
  compact = false,
  lang = 'th',
  ariaLabel,
}) => {
  const parsed = parseHHMMTo12Hour(value);

  const containerStyle =
    tone === 'pink'
      ? 'border-2 border-[#E7B5C2] bg-[#FFF9FB]'
      : tone === 'mint'
      ? 'border-2 border-[#8FD4C6] bg-[#F3FCFA]'
      : tone === 'lavender'
      ? 'border border-[#C8B7EB] bg-[#FBF8FF]'
      : 'border border-[#DFD2C3] bg-[#FFFDF9]';

  const selectStyle = compact
    ? 'rounded-lg border border-[#E2D6C8] bg-white px-1.5 py-1 text-xs font-extrabold tabular-nums text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#7CC6B8] cursor-pointer'
    : 'rounded-lg border border-[#E2D6C8] bg-white px-2 py-1.5 text-xs sm:text-sm font-extrabold tabular-nums text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#7CC6B8] cursor-pointer';

  const daypartTh =
    parsed.hour24 === 0
      ? 'เที่ยงคืน'
      : parsed.hour24 < 6
      ? 'เช้ามืด'
      : parsed.hour24 < 12
      ? 'เช้า'
      : parsed.hour24 === 12
      ? 'เที่ยง'
      : parsed.hour24 < 16
      ? 'บ่าย'
      : parsed.hour24 < 19
      ? 'เย็น'
      : 'ค่ำ/ดึก';

  return (
    <div className="space-y-1" aria-label={ariaLabel}>
      <div
        className={`inline-flex flex-wrap items-center gap-1.5 rounded-xl ${containerStyle} ${
          compact ? 'px-2 py-1' : 'px-2.5 py-1.5 w-full justify-between'
        }`}
      >
        <div className="flex items-center gap-1">
          <select
            aria-label={lang === 'th' ? 'ชั่วโมง (1-12)' : 'Hour (1-12)'}
            value={parsed.hour12}
            onChange={(e) =>
              onChange(buildHHMMFrom12Hour(Number(e.target.value), parsed.minute, parsed.period))
            }
            className={selectStyle}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}
              </option>
            ))}
          </select>
          <span className="font-extrabold text-[#6E5C52] text-xs sm:text-sm">:</span>
          <select
            aria-label={lang === 'th' ? 'นาที (00-59)' : 'Minute (00-59)'}
            value={parsed.minute}
            onChange={(e) =>
              onChange(buildHHMMFrom12Hour(parsed.hour12, Number(e.target.value), parsed.period))
            }
            className={selectStyle}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>

        <div
          className="inline-flex rounded-lg border border-[#E2D6C8] bg-[#F5EFE8] p-0.5 shrink-0"
          role="group"
          aria-label="AM / PM"
        >
          <button
            type="button"
            aria-pressed={parsed.period === 'AM'}
            onClick={() =>
              onChange(buildHHMMFrom12Hour(parsed.hour12, parsed.minute, 'AM'))
            }
            className={`rounded-md ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
            } font-extrabold cursor-pointer transition-colors ${
              parsed.period === 'AM'
                ? 'bg-[#FFF0B3] text-[#6E4905] shadow-2xs border border-[#E8C563]'
                : 'text-[#7B695F] hover:text-[#3D322C]'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            aria-pressed={parsed.period === 'PM'}
            onClick={() =>
              onChange(buildHHMMFrom12Hour(parsed.hour12, parsed.minute, 'PM'))
            }
            className={`rounded-md ${
              compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
            } font-extrabold cursor-pointer transition-colors ${
              parsed.period === 'PM'
                ? 'bg-[#3D322C] text-white shadow-2xs'
                : 'text-[#7B695F] hover:text-[#3D322C]'
            }`}
          >
            PM
          </button>
        </div>
      </div>

      {!compact && (
        <div className="text-[10px] font-bold text-[#7B695F] tabular-nums px-0.5">
          {lang === 'th'
            ? `= ${parsed.hhmm24} น. (${daypartTh})`
            : `= ${parsed.hhmm24} (24h)`}
        </div>
      )}
    </div>
  );
};
