import React from 'react';
import { Language } from '../types/barnhem';
import { KioskPenaltyAlert } from '../utils/expressKiosk';

interface PenaltyNoticeModalProps {
  notice: KioskPenaltyAlert | null;
  lang: Language;
  onClose: () => void;
}

export const PenaltyNoticeModal: React.FC<PenaltyNoticeModalProps> = ({
  notice,
  lang,
  onClose,
}) => {
  if (!notice) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-[#2A0B12]/75 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-[34px] border-4 border-[#E11D48] bg-[#FFF8FA] p-6 sm:p-8 text-center shadow-2xl space-y-5 animate-[fadeIn_0.18s_ease-out]"
      >
        {/* Top Warning Emblem + Kid Identity */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#FDA4AF] bg-[#FFE4EA] text-5xl shadow-md">
            🚨
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#FECDD3] bg-white px-4 py-1.5 text-base sm:text-lg font-extrabold text-[#3D322C] shadow-xs">
            {notice.kidEmoji && <span className="text-xl">{notice.kidEmoji}</span>}
            <span>
              {lang === 'th' ? `น้อง${notice.kidNickname}` : notice.kidNickname}
            </span>
          </div>
        </div>

        {/* Giant Headline */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-[#9F1239] tracking-tight leading-tight">
            {notice.headline}
          </h2>
          <p className="text-base sm:text-lg font-bold text-[#5E2832] leading-relaxed">
            {notice.reasonLine}
          </p>
        </div>

        {/* Highlighted Penalty Box */}
        <div className="rounded-[24px] border-3 border-[#F43F5E] bg-[#FFE4EA] px-5 py-4 sm:py-5 space-y-1.5 shadow-inner">
          <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-[#9F1239]">
            ⚖️ {lang === 'th' ? 'บทลงโทษที่ได้รับทันที' : 'IMMEDIATE PENALTY APPLIED'}
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#881337] leading-snug">
            {notice.penaltyText}
          </div>
          {notice.clockNote && (
            <div className="text-xs sm:text-sm font-bold text-[#7F1D3A] pt-1 tabular-nums">
              🕒 {notice.clockNote}
            </div>
          )}
        </div>

        {/* Acknowledge Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[58px] rounded-[22px] bg-[#9F1239] hover:bg-[#881337] text-white text-lg sm:text-xl font-extrabold px-6 py-3.5 shadow-lg transition-transform active:scale-[0.98] cursor-pointer"
        >
          {lang === 'th' ? 'รับทราบ (เข้าใจแล้ว) ✓' : 'I Understand ✓'}
        </button>
      </div>
    </div>
  );
};
