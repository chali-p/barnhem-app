import React from 'react';
import {
  AppSettings,
  GoldenPoolLog,
  KidAllowanceState,
  Language,
  Member,
} from '../types/barnhem';
import {
  computeGoldenPoolBalance,
  getKidEconomyConfig,
  WEEKDAY_NAMES_EN,
  WEEKDAY_NAMES_TH,
} from '../utils/piggyBank';
import { GoldenPiggySvg, PinkPiggySvg } from './PiggyBankSvg';

interface PiggyBankModalsProps {
  activeModal: 'pink' | 'gold' | null;
  kid: Member;
  allowance: KidAllowanceState;
  goldenPoolLogs: GoldenPoolLog[];
  settings?: Partial<AppSettings>;
  lang: Language;
  onClose: () => void;
  onExchangeStarsToCoins: () => void;
}

export const PiggyBankModals: React.FC<PiggyBankModalsProps> = ({
  activeModal,
  kid,
  allowance,
  goldenPoolLogs,
  settings,
  lang,
  onClose,
  onExchangeStarsToCoins,
}) => {
  if (!activeModal) return null;

  const eco = getKidEconomyConfig(kid, settings);
  const goldenTotal = computeGoldenPoolBalance(goldenPoolLogs);
  const nextMondayNet = Math.max(0, eco.weeklyBaseThb - allowance.weeklyPenaltyThb);
  const canExchange = kid.stars >= eco.starToCoinStars;
  const isNegative = allowance.coins < 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3D322C]/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-[32px] border-4 p-6 sm:p-7 pastel-shadow ${
          activeModal === 'pink'
            ? 'border-[#FADADD] bg-[#FFFDF9]'
            : 'border-[#F4DB73] bg-[#FFFDF9]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {activeModal === 'pink' ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-[#FFEAF0] border border-[#F3B7C0] flex items-center justify-center shrink-0">
                  <PinkPiggySvg className="w-11 h-11" isNegative={isNegative} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-[#3D322C]">
                    {lang === 'th'
                      ? `กระปุกหมูสีชมพูของน้อง${kid.nickname}`
                      : `${kid.nickname}'s Pink Piggy Bank`}
                  </h3>
                  <p className="text-xs text-[#6E5C52]">
                    {lang === 'th'
                      ? `ค่าไปโรงเรียน ${eco.dailyAllowanceThb} ฿/วัน × ${eco.schoolDaysPerWeek} วัน (1 เหรียญ = 1 บาท)`
                      : `School allowance ${eco.dailyAllowanceThb} THB/day × ${eco.schoolDaysPerWeek} days`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] rounded-full bg-[#FADADD] hover:bg-[#F3B7C0] font-bold text-[#3D322C] cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Balance & Monday Carryover Formula */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className={`rounded-2xl border-2 p-4 ${
                  isNegative
                    ? 'border-[#E66C85] bg-[#FFE8EC]'
                    : 'border-[#F3B7C0] bg-[#FFF4F7]'
                }`}
              >
                <div className="text-xs font-bold text-[#7A3548]">
                  {lang === 'th' ? 'เหรียญคงเหลือในกระปุกตอนนี้' : 'Current Piggy Balance'}
                </div>
                <div
                  className={`text-3xl font-extrabold tabular-nums mt-1 ${
                    isNegative ? 'text-[#B8253E]' : 'text-[#3D322C]'
                  }`}
                >
                  {allowance.coins.toLocaleString()} <span className="text-base">฿</span>
                </div>
                <div className="text-[11px] text-[#6E5C52] mt-1">
                  {isNegative
                    ? lang === 'th'
                      ? 'มียอดติดลบจากค่าปรับ! จะถูกหักออกจากเงินกองกลางวันจันทร์หน้า'
                      : 'Negative due to penalty — will deduct from next Monday top-up.'
                    : lang === 'th'
                    ? 'หักอัตโนมัติทุกเช้าวันที่เช็คอินไปโรงเรียน'
                    : 'Automatically deducted each school morning check-in.'}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[#B5EAD7] bg-[#F1FBF7] p-4">
                <div className="text-xs font-bold text-[#1B5B51]">
                  {lang === 'th' ? '📅 คาดการณ์วันจันทร์สัปดาห์หน้า' : '📅 Next Monday Carryover'}
                </div>
                <div className="text-2xl font-extrabold text-[#114A42] tabular-nums mt-1">
                  {nextMondayNet.toLocaleString()} <span className="text-sm">฿</span>
                </div>
                <div className="text-[11px] text-[#285E54] mt-1 tabular-nums">
                  {lang === 'th'
                    ? `${eco.weeklyBaseThb} - หักทำผิดกฎ ${allowance.weeklyPenaltyThb} = ${nextMondayNet} ฿`
                    : `${eco.weeklyBaseThb} - penalties ${allowance.weeklyPenaltyThb} = ${nextMondayNet} THB`}
                </div>
              </div>
            </div>

            {/* Mon - Fri Daily School Deduction Breakdown */}
            <div className="rounded-2xl border border-[#EBD8C3] bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#3D322C]">
                <span>
                  🚌 {lang === 'th' ? 'สถานะหักค่าไปโรงเรียนรายวัน (จันทร์–ศุกร์)' : 'Daily School Deduction Status (Mon–Fri)'}
                </span>
                <span className="text-[#6E5C52] tabular-nums">
                  {allowance.deductedWeekdays.length}/{eco.schoolDaysPerWeek}{' '}
                  {lang === 'th' ? 'วัน' : 'days'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: eco.schoolDaysPerWeek }, (_, idx) => idx + 1).map((dayNum) => {
                  const deducted = allowance.deductedWeekdays.includes(dayNum);
                  return (
                    <div
                      key={dayNum}
                      className={`rounded-xl border p-2 text-center ${
                        deducted
                          ? 'border-[#8DD6C7] bg-[#E6FAF5] text-[#114A42]'
                          : 'border-[#EAE1D8] bg-[#FFFDF9] text-[#7B695F]'
                      }`}
                    >
                      <div className="text-[11px] font-bold">
                        {lang === 'th' ? WEEKDAY_NAMES_TH[dayNum] : WEEKDAY_NAMES_EN[dayNum]}
                      </div>
                      <div className="text-xs font-extrabold tabular-nums mt-0.5">
                        {deducted ? `-${eco.dailyAllowanceThb}` : `${eco.dailyAllowanceThb} ฿`}
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {deducted
                          ? lang === 'th'
                            ? 'ใช้แล้ว ✓'
                            : 'Paid ✓'
                          : lang === 'th'
                          ? 'คงเหลือ'
                          : 'Ready'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Star-to-Coin Exchange Box */}
            <div className="rounded-2xl border-2 border-[#F4DB73] bg-[#FFF9DC] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-extrabold text-[#5A4208]">
                  ⭐ {lang === 'th' ? 'แลกดาวความดีเป็นเหรียญเข้ากระปุก' : 'Convert Stars to Piggy Coins'}
                </div>
                <div className="text-xs text-[#6B4E0C]">
                  {lang === 'th'
                    ? `ใช้ ${eco.starToCoinStars} ⭐ แลกได้ +${eco.starToCoinThb} ฿ · ตอนนี้หนูมี ${kid.stars.toLocaleString()} ⭐`
                    : `Rate: ${eco.starToCoinStars} ⭐ = +${eco.starToCoinThb} THB · Your stars: ${kid.stars.toLocaleString()} ⭐`}
                </div>
                <div className="text-[11px] text-[#846216]">
                  {lang === 'th'
                    ? '💡 สะสมดาวไว้เยอะๆ ช่วยเป็นโบนัสหรือแลกขนมในมินิมาร์ทได้ด้วยนะ'
                    : '💡 Saving lots of stars earns bonuses and free minimart snacks!'}
                </div>
              </div>
              <button
                type="button"
                onClick={onExchangeStarsToCoins}
                disabled={!canExchange}
                className={`min-h-[42px] rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-colors ${
                  canExchange
                    ? 'bg-[#3D322C] hover:bg-[#2B221D] text-white cursor-pointer'
                    : 'bg-[#EADBC8] text-[#8C7A6B] cursor-not-allowed'
                }`}
              >
                {canExchange
                  ? lang === 'th'
                    ? `แลก ${eco.starToCoinStars} ⭐ → +${eco.starToCoinThb} ฿`
                    : `Trade ${eco.starToCoinStars} ⭐ → +${eco.starToCoinThb} THB`
                  : lang === 'th'
                  ? `ต้องมี ${eco.starToCoinStars} ⭐`
                  : `Need ${eco.starToCoinStars} ⭐`}
              </button>
            </div>

            {/* Coin History Log */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-[#3D322C]">
                📜 {lang === 'th' ? 'ประวัติรายการเข้า-ออกกระปุกหมูสีชมพู' : 'Pink Piggy Bank History'}
              </h4>
              {allowance.coinHistory.length === 0 ? (
                <div className="rounded-xl bg-white border border-[#EAE1D8] p-3 text-xs text-[#7B695F]">
                  {lang === 'th' ? 'ยังไม่มีรายการเคลื่อนไหวในสัปดาห์นี้' : 'No coin transactions yet.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {allowance.coinHistory.map((tx) => (
                    <div
                      key={tx.id}
                      className="rounded-xl border border-[#EAE1D8] bg-white px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#3D322C] truncate">{tx.reason}</div>
                        <div className="text-[10px] text-[#8B786D] tabular-nums">
                          {new Date(tx.timestamp).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                        </div>
                      </div>
                      <span
                        className={`font-extrabold tabular-nums shrink-0 ${
                          tx.amount >= 0 ? 'text-[#1B6B5A]' : 'text-[#C63D55]'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} ฿
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Golden Pool Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-[#FFF3C4] border border-[#F0C84B] flex items-center justify-center shrink-0">
                  <GoldenPiggySvg className="w-11 h-11" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-[#3D322C]">
                    {lang === 'th'
                      ? 'กระปุกหมูสีทอง (กองทุนกลางส่วนรวม)'
                      : 'Golden Piggy Bank (Shared Pool)'}
                  </h3>
                  <p className="text-xs text-[#6E5C52]">
                    {lang === 'th'
                      ? 'โปร่งใส ดูได้ทุกคน — เงินที่ถูกหักจากการทำผิดกฎจะโอนมารวมที่นี่ เพื่อจัดกิจกรรมส่วนรวม'
                      : 'Visible to everyone — penalty deductions flow here for shared house treats.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] rounded-full bg-[#FFF3C4] hover:bg-[#FFE680] font-bold text-[#3D322C] cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Golden Pool Total Banner */}
            <div className="rounded-2xl border-2 border-[#F0C84B] bg-gradient-to-r from-[#FFF8D6] to-[#FFECB3] p-5 text-center">
              <div className="text-xs font-bold text-[#7A520B]">
                {lang === 'th' ? 'ยอดรวมกองทุนกลางปัจจุบัน' : 'Current Shared Golden Pool'}
              </div>
              <div className="text-4xl font-extrabold text-[#5A3900] tabular-nums mt-1">
                {goldenTotal.toLocaleString()} <span className="text-lg">฿</span>
              </div>
              <div className="text-[11px] text-[#7A520B] mt-1">
                {lang === 'th'
                  ? 'หากทุกคนรักษากฎครบถ้วน จะไม่ถูกหักเงินค่าไปโรงเรียนและได้รับดาวครบเต็มจำนวน!'
                  : 'Follow house rules together to keep full school allowance and earn maximum stars!'}
              </div>
            </div>

            {/* Transparent Pool Ledger */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-[#3D322C]">
                📒 {lang === 'th' ? 'สมุดบัญชีกองทุนกลาง (อัปเดตเรียลไทม์)' : 'Golden Pool Transparent Ledger'}
              </h4>
              {goldenPoolLogs.length === 0 ? (
                <div className="rounded-xl bg-[#F1FBF7] border border-[#B5EAD7] p-4 text-center text-xs font-semibold text-[#1B5B51]">
                  ✨{' '}
                  {lang === 'th'
                    ? 'เยี่ยมมาก! ยังไม่มีใครถูกหักเงินผิดกฎเข้ากระปุกหมูสีทองเลย'
                    : 'Awesome! No penalty transfers into the Golden Piggy Bank yet.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {goldenPoolLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#3D322C] truncate">
                          {log.kind === 'penalty_in'
                            ? `${log.kidNickname} · ${log.reason}`
                            : `🎁 ${log.reason}`}
                        </div>
                        <div className="text-[10px] text-[#8B786D]">
                          {lang === 'th' ? `บันทึกโดย: ${log.recordedBy}` : `By: ${log.recordedBy}`} ·{' '}
                          {new Date(log.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                        </div>
                      </div>
                      <span
                        className={`font-extrabold tabular-nums shrink-0 ${
                          log.amount >= 0 ? 'text-[#9A6300]' : 'text-[#C63D55]'
                        }`}
                      >
                        {log.amount >= 0 ? `+${log.amount}` : log.amount} ฿
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
