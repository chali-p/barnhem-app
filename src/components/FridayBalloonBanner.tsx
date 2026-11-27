import React from 'react';
import { Language } from '../types/barnhem';

interface FridayBalloonBannerProps {
  lang: Language;
  variant?: 'home' | 'kid' | 'return_home' | 'menu';
}

const BalloonClusterSvg: React.FC<{ side: 'left' | 'right'; compact?: boolean }> = ({
  side,
  compact = false,
}) => {
  const w = compact ? 52 : 68;
  const h = compact ? 64 : 82;
  const palette =
    side === 'left'
      ? { a: '#F497A9', b: '#7BC9BD', c: '#F6CF65' }
      : { a: '#93C5FD', b: '#F497A9', c: '#B8A4E3' };

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 68 82"
      fill="none"
      aria-hidden="true"
      className="shrink-0 select-none motion-safe:animate-[floatSlow_4.5s_ease-in-out_infinite]"
    >
      {/* Strings */}
      <path
        d="M21 44 C19 56, 25 66, 28 79"
        stroke="#B8A394"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M47 40 C49 54, 41 65, 36 79"
        stroke="#B8A394"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M34 36 C34 52, 33 65, 32 79"
        stroke="#A48E80"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Left balloon */}
      <ellipse cx="20" cy="26" rx="13" ry="16" fill={palette.a} />
      <path d="M18 42 L22 42 L20 45 Z" fill={palette.a} />
      <ellipse
        cx="15"
        cy="20"
        rx="2.6"
        ry="5.2"
        transform="rotate(-18 15 20)"
        fill="#FFFFFF"
        fillOpacity="0.45"
      />

      {/* Right balloon */}
      <ellipse cx="48" cy="23" rx="12.5" ry="15.5" fill={palette.b} />
      <path d="M46 38.5 L50 38.5 L48 41.5 Z" fill={palette.b} />
      <ellipse
        cx="43"
        cy="17.5"
        rx="2.4"
        ry="4.8"
        transform="rotate(-16 43 17.5)"
        fill="#FFFFFF"
        fillOpacity="0.45"
      />

      {/* Center top balloon */}
      <ellipse cx="34" cy="18" rx="13.5" ry="16.5" fill={palette.c} />
      <path d="M32 34.5 L36 34.5 L34 37.5 Z" fill={palette.c} />
      <ellipse
        cx="28.5"
        cy="12"
        rx="2.8"
        ry="5.5"
        transform="rotate(-16 28.5 12)"
        fill="#FFFFFF"
        fillOpacity="0.5"
      />
    </svg>
  );
};

export const FridayBalloonBanner: React.FC<FridayBalloonBannerProps> = ({
  lang,
  variant = 'home',
}) => {
  const isCompact = variant === 'menu';

  const heading =
    variant === 'return_home'
      ? lang === 'th'
        ? '🎈 ยินดีต้อนรับกลับบ้าน! คืนวันศุกร์ Free Day สุดพิเศษ'
        : '🎈 Welcome Home! Special Friday Free Day'
      : lang === 'th'
      ? '🎈 วันศุกร์ Free Day คืนพิเศษ!'
      : '🎈 Special Friday Free Day Night!';

  const sevenElevenLine =
    lang === 'th'
      ? '🏪 วันนี้สามารถสั่งเซเว่นได้นะคะ'
      : '🏪 You can order from 7-Eleven today!';

  const scheduleLine1 =
    lang === 'th'
      ? 'กลับบ้าน & เก็บมือถือ 15:00–18:00 น. · มารับมือถือ 18:15–22:45 น. · คืนวันศุกร์ไม่ต้องเก็บมือถือ'
      : 'Return home & store phone 15:00–18:00 · Pick up phone 18:15–22:45 · Keep phone tonight';

  const scheduleLine2 =
    lang === 'th'
      ? 'วันเสาร์เปิดตื่น 08:15–08:35 น. (อนุโลมได้ไม่เกิน 1 นาที / ถึง 08:36 น.)'
      : 'Saturday check-in opens 08:15–08:35 (1-min grace to 08:36)';

  const alarmNotice =
    lang === 'th'
      ? '⏰ ทุกคนที่มีโทรศัพท์จะต้องตั้งปลุกก่อนเวลาเผื่อเดินมาเช็คอินด้วยนะเด็กๆ'
      : '⏰ Everyone with a phone must set an alarm early enough to walk over and check in, kids!';

  const holidayPenaltyNotice =
    lang === 'th'
      ? '⚠️ วันเสาร์กดเลือกชื่อตัวเองได้เลย ไม่ต้องใส่รหัส · เกิน 08:36 น. บทลงโทษตามที่ตัวเองโหวตขึ้นโชว์ที่หน้าจออัตโนมัติ'
      : '⚠️ Saturday: tap your own name directly without a PIN · Past 08:36 automatically shows your voted penalty.';

  return (
    <section
      aria-label={heading}
      className={`relative overflow-hidden rounded-[22px] sm:rounded-[26px] border-2 border-[#F3B7C0] bg-gradient-to-r from-[#FFF5F8] via-[#FFFDF5] to-[#EFFAF8] ${
        isCompact ? 'px-3 py-2.5' : 'px-3.5 py-3 sm:px-5 sm:py-3.5'
      } shadow-xs`}
    >
      {/* Subtle festive confetti dots */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1.5 flex justify-around opacity-55"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#F497A9]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#F6CF65]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#7BC9BD]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#93C5FD]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#B8A4E3]" />
      </div>

      <div className="relative flex items-center justify-between gap-2.5 sm:gap-4">
        <BalloonClusterSvg side="left" compact={isCompact} />

        <div className="flex-1 min-w-0 text-center space-y-1">
          <div
            className={`${
              isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            } font-extrabold text-[#7D243C] leading-snug`}
          >
            {heading}
          </div>

          <div
            className={`${
              isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            } font-black text-[#0F5C4E] leading-snug`}
          >
            {sevenElevenLine}
          </div>

          <p
            className={`${
              isCompact ? 'text-[10px]' : 'text-[11px] sm:text-xs'
            } font-semibold text-[#634E44] leading-relaxed tabular-nums space-y-0.5`}
          >
            <span className="block">{scheduleLine1}</span>
            <span className="block">{scheduleLine2}</span>
          </p>

          <p
            className={`${
              isCompact ? 'text-[11px]' : 'text-xs sm:text-[13px]'
            } font-extrabold text-[#8A3B12] leading-snug`}
          >
            {alarmNotice}
          </p>

          <p
            className={`${
              isCompact ? 'text-[10px]' : 'text-[11px] sm:text-xs'
            } font-bold text-[#9F1239] leading-snug`}
          >
            {holidayPenaltyNotice}
          </p>
        </div>

        <BalloonClusterSvg side="right" compact={isCompact} />
      </div>
    </section>
  );
};
