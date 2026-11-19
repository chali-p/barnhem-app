import React, { useState } from 'react';
import { KitchenVerificationLog, Language, Member, ModalAlertPayload } from '../types/barnhem';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';
import { getDateKey } from '../utils/timeRules';
import { PinPadModal } from './CenteredAlertModal';

interface ChefViewProps {
  members: Member[];
  kitchenLogs: KitchenVerificationLog[];
  now: Date;
  lang: Language;
  loggedInChef: Member | null;
  onLoginChef: (chef: Member) => void;
  onLogoutChef: () => void;
  onConfirmKitchenDuty: (
    kidId: string,
    slot: 'evening1530' | 'sat0930' | 'sun0915',
    chef: Member,
    starsAwarded: number
  ) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

export const ChefView: React.FC<ChefViewProps> = ({
  members,
  kitchenLogs,
  now,
  lang,
  loggedInChef,
  onLoginChef,
  onLogoutChef,
  onConfirmKitchenDuty,
  onShowAlert,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<null | {
    kid: Member;
    slot: 'evening1530' | 'sat0930' | 'sun0915';
    stars: number;
  }>(null);

  const chefs = members.filter((m) => m.role === 'chef');
  const kids = members.filter((m) => m.role === 'kid');
  const todayKey = getDateKey(now);
  const pinGuard = usePinGuard('chef');

  const tryLogin = (pin: string) => {
    if (pinGuard.isLocked) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
        message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
        tone: 'pink',
      });
      return;
    }
    const found = chefs.find((c) => c.pin === pin.trim());
    if (!found) {
      const res = pinGuard.recordFailure();
      setPinInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '👩‍🍳',
        title: res.lockedNow
          ? lang === 'th'
            ? 'ล็อกชั่วคราว 30 วินาที'
            : 'Locked for 30 Seconds'
          : lang === 'th'
          ? 'รหัส PIN แม่ครัวไม่ถูกต้อง'
          : 'Invalid Chef PIN',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${lang === 'th' ? 'กรุณาใส่รหัส PIN 4 หลักประจำตัวแม่ครัวให้ถูกต้อง' : 'Please enter your 4-digit Chef PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'peach',
      });
      return;
    }
    pinGuard.recordSuccess();
    setPinInput('');
    setPinModalOpen(false);
    onLoginChef(found);
  };

  if (!loggedInChef) {
    return (
      <div className="max-w-md mx-auto rounded-[36px] border-2 border-[#FDE2D2] bg-[#FFFDF9] p-7 text-center pastel-shadow">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FDE2D2] text-3xl">
          👩‍🍳
        </div>
        <h2 className="text-2xl font-bold text-[#3D322C]">
          {lang === 'th' ? 'โหมดแม่ครัว — ยืนยันเวรห้องครัว' : 'Kitchen Chef Verification'}
        </h2>
        <p className="text-sm text-[#6E5C52] mt-1 mb-5">
          {lang === 'th'
            ? 'สำหรับแม่ครัวเหมียว และแม่ครัวพร ใส่รหัส PIN 4 หลักเพื่อยืนยันการเข้าทำเวรห้องครัวและมอบดาวให้น้อง (ไม่มีการหักเงิน)'
            : 'For Chef Meaw & Chef Porn to confirm real kitchen duty attendance & award stars (zero fines).'}
        </p>

        {pinGuard.isLocked && (
          <div className="mb-3 rounded-2xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-2 text-xs font-bold text-[#8B1D36] tabular-nums">
            🔒 {formatPinLockoutMessage(pinGuard.remainingSec, lang)}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin(pinInput);
          }}
          className="space-y-3"
        >
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            disabled={pinGuard.isLocked}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={
              pinGuard.isLocked
                ? lang === 'th'
                  ? `รอ ${pinGuard.remainingSec} วินาที...`
                  : `Wait ${pinGuard.remainingSec}s...`
                : lang === 'th'
                ? 'รหัส PIN แม่ครัว 4 หลัก'
                : '4-digit Chef PIN'
            }
            className="w-full rounded-2xl border-2 border-[#EBD8C3] bg-white px-4 py-3 text-center text-xl tracking-widest disabled:bg-[#F5ECE2]"
          />
          <button
            type="submit"
            disabled={pinGuard.isLocked}
            className="w-full min-h-[48px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {lang === 'th' ? 'เข้าสู่ระบบแม่ครัว' : 'Sign In as Chef'}
          </button>
          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            className="w-full min-h-[44px] rounded-2xl bg-[#FDE2D2] text-[#3D322C] font-bold text-sm cursor-pointer"
          >
            🔢 {lang === 'th' ? 'เปิดแป้นพิมพ์ PIN' : 'Open PIN Keypad'}
          </button>
        </form>

        <PinPadModal
          open={pinModalOpen}
          lang={lang}
          lockedRemainingSec={pinGuard.remainingSec}
          title={lang === 'th' ? 'เข้าสู่ระบบแม่ครัว' : 'Chef PIN Login'}
          onCancel={() => setPinModalOpen(false)}
          onSubmitPin={tryLogin}
        />
      </div>
    );
  }

  const slotConfigs: {
    slot: 'evening1530' | 'sat0930' | 'sun0915';
    titleTh: string;
    titleEn: string;
    windowTh: string;
    windowEn: string;
    stars: number;
    bg: string;
  }[] = [
    {
      slot: 'evening1530',
      titleTh: '🍳 เวรครัวตอนเย็น 15:30 น. (เท่ากันทั้ง 3 วัน)',
      titleEn: '🍳 Evening Shift 15:30 (Same on Sat / Sun / Holiday)',
      windowTh: 'เวลา 15:30 น. เท่ากันทั้งวันเสาร์ อาทิตย์ และวันหยุดนักขัตฤกษ์ (รวมเย็นวันปกติ) ยืนยันเมื่อทำเวรเสร็จ รับ +10 ⭐',
      windowEn: '15:30 across Saturday, Sunday & Public Holidays (+ weekday evenings). Confirm after duty for +10 ⭐',
      stars: 10,
      bg: 'bg-[#FFF5BA]/60 border-[#F4DB73]',
    },
    {
      slot: 'sat0930',
      titleTh: '🌞 เวรเช้า เสาร์–นักขัตฤกษ์ (09:30 น.)',
      titleEn: '🌞 Morning Sat & Public Holiday (09:30)',
      windowTh: 'เริ่ม 09:30 น. (เสาร์และวันหยุดนักขัตฤกษ์) · แม่ครัวยืนยันหลังทำเสร็จช่วง 10:00-12:00 น. รับ +15 ⭐',
      windowEn: 'Starts 09:30 on Saturday & Public Holidays · Chef confirms 10:00-12:00 (+15 ⭐)',
      stars: 15,
      bg: 'bg-[#D4F0F0]/65 border-[#9CD8D2]',
    },
    {
      slot: 'sun0915',
      titleTh: '🌻 เวรเช้า วันอาทิตย์ (09:15 น.)',
      titleEn: '🌻 Morning Sunday (09:15)',
      windowTh: 'เริ่ม 09:15 น. (วันอาทิตย์) · แม่ครัวยืนยันหลังทำเสร็จช่วง 10:00-12:00 น. รับ +15 ⭐',
      windowEn: 'Starts 09:15 on Sunday · Chef confirms 10:00-12:00 (+15 ⭐)',
      stars: 15,
      bg: 'bg-[#FADADD]/60 border-[#F3B7C0]',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border-2 border-[#FDE2D2] bg-[#FFFDF9] p-5 flex flex-wrap items-center justify-between gap-4 pastel-shadow">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{loggedInChef.emoji}</span>
          <div>
            <h2 className="text-xl font-bold text-[#3D322C]">
              {lang === 'th' ? `สวัสดี ${loggedInChef.nickname} — ระบบยืนยันเวรห้องครัว` : `Hello ${loggedInChef.nickname} — Kitchen Duty Confirmation`}
            </h2>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'th'
                ? 'ไม่มีการหักเงินใดๆ ทั้งสิ้น เมื่อน้องทำครัวเสร็จให้กดยืนยันเพื่อมอบดาวความดีและบันทึกพฤติกรรม'
                : 'Zero financial deductions — confirm real attendance to award stars & log behavior.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogoutChef}
          className="min-h-[42px] rounded-2xl bg-[#FADADD] hover:bg-[#F3B7C0] px-4 py-2 text-sm font-bold text-[#3D322C] cursor-pointer"
        >
          🚪 {lang === 'th' ? 'ออกจากโหมดแม่ครัว' : 'Logout Chef'}
        </button>
      </div>

      {/* Kitchen Duty Schedule Summary */}
      <div className="rounded-[22px] border-2 border-[#EBD8C3] bg-[#FFFDF9] px-4 py-3 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-[#3D322C] pastel-shadow">
        <span className="font-extrabold">⏰ {lang === 'th' ? 'เวลาเวรห้องครัว:' : 'Kitchen Duty Hours:'}</span>
        <span className="rounded-full bg-[#D4F0F0] px-3 py-1 font-bold text-[#19534B]">
          🌞 {lang === 'th' ? 'เช้า เสาร์–นักขัตฤกษ์ 09:30 น.' : 'Morning Sat & Holiday: 09:30'}
        </span>
        <span className="rounded-full bg-[#FADADD] px-3 py-1 font-bold text-[#7B2E3B]">
          🌻 {lang === 'th' ? 'เช้า อาทิตย์ 09:15 น.' : 'Morning Sun: 09:15'}
        </span>
        <span className="rounded-full bg-[#FFF5BA] px-3 py-1 font-bold text-[#5A4614]">
          🍳 {lang === 'th' ? 'เย็น 15:30 น. เท่ากันทั้ง 3 วัน (เสาร์ / อาทิตย์ / นักขัตฤกษ์)' : 'Evening 15:30 (Same all 3 days)'}
        </span>
      </div>

      {/* Food Allergy & Health Safety Alert for Kitchen */}
      {(() => {
        const allergyKids = kids.filter(
          (k) =>
            k.healthProfile &&
            k.healthProfile.foodAllergies.trim() !== '' &&
            k.healthProfile.foodAllergies.trim() !== 'ไม่มี' &&
            k.healthProfile.foodAllergies.trim().toLowerCase() !== 'none'
        );
        return (
          <section className="rounded-[24px] border-2 border-[#F3B7C0] bg-[#FADADD]/35 p-4 pastel-shadow">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-sm text-[#7B2E3B]">
                🥗⚠️ {lang === 'th' ? 'ข้อมูลแพ้อาหารของน้องๆ (สำหรับห้องครัว)' : 'Kids Food Allergy Alerts (Kitchen Safety)'}
              </div>
              <span className="text-xs text-[#6E5C52]">
                {allergyKids.length > 0
                  ? lang === 'th'
                    ? `มีน้องแพ้อาหาร ${allergyKids.length} คน — โปรดระวังเป็นพิเศษ`
                    : `${allergyKids.length} kid(s) with food allergies`
                  : lang === 'th'
                  ? 'ยังไม่มีบันทึกการแพ้อาหารในตอนนี้'
                  : 'No food allergies recorded'}
              </span>
            </div>
            {allergyKids.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {allergyKids.map((k) => (
                  <div
                    key={k.id}
                    className="rounded-xl border border-[#F3B7C0] bg-white px-3 py-1.5 text-xs text-[#3D322C]"
                  >
                    <span className="font-bold">
                      {k.emoji} {k.nickname}:
                    </span>{' '}
                    <span className="font-semibold text-[#B84A39]">{k.healthProfile?.foodAllergies}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {slotConfigs.map((cfg) => {
          const assignedKids = kids.filter((k) => k.kitchenDuty[cfg.slot]);
          return (
            <section
              key={cfg.slot}
              className={`rounded-[28px] border-2 p-5 ${cfg.bg} pastel-shadow flex flex-col justify-between`}
            >
              <div>
                <h3 className="text-base font-bold text-[#3D322C] mb-1">
                  {lang === 'th' ? cfg.titleTh : cfg.titleEn}
                </h3>
                <p className="text-xs text-[#5E4E45] mb-4">
                  {lang === 'th' ? cfg.windowTh : cfg.windowEn}
                </p>

                {assignedKids.length === 0 ? (
                  <div className="rounded-2xl bg-white/75 p-4 text-sm text-[#7B695F] text-center">
                    {lang === 'th'
                      ? 'ยังไม่มีรายชื่อน้องในเวรนี้ (พี่เลี้ยงติ๊กรายชื่อได้ที่โหมดพี่เลี้ยงทุกเย็นวันศุกร์)'
                      : 'No kids assigned to this slot yet (Staff can tick names in Staff Mode).'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {assignedKids.map((kid) => {
                      const alreadyDone =
                        (cfg.slot === 'evening1530' && kid.daily.kitchenEveningDone) ||
                        (cfg.slot === 'sat0930' && kid.daily.kitchenSatDone) ||
                        (cfg.slot === 'sun0915' && kid.daily.kitchenSunDone);
                      return (
                        <div
                          key={kid.id}
                          className="rounded-2xl bg-white p-3.5 flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div>
                            <div className="font-bold text-[#3D322C]">
                              {kid.emoji} {kid.nickname}
                            </div>
                            <div className="text-xs text-[#7B695F]">{kid.fullName}</div>
                          </div>
                          <button
                            type="button"
                            disabled={alreadyDone}
                            onClick={() =>
                              setPendingConfirm({ kid, slot: cfg.slot, stars: cfg.stars })
                            }
                            className={`rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
                              alreadyDone
                                ? 'bg-[#D4F0F0] text-[#214F4B]'
                                : 'bg-[#3D322C] hover:bg-[#2B221D] text-white'
                            }`}
                          >
                            {alreadyDone
                              ? lang === 'th'
                                ? 'ยืนยันแล้ว ✓'
                                : 'Confirmed ✓'
                              : lang === 'th'
                              ? `ใส่ PIN ยืนยัน (+${cfg.stars}⭐)`
                              : `Verify PIN (+${cfg.stars}⭐)`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Kitchen Verification History Log */}
      <section className="rounded-[28px] border-2 border-[#EBD8C3] bg-[#FFFDF9] p-5 pastel-shadow">
        <h3 className="text-lg font-bold text-[#3D322C] mb-3">
          📋 {lang === 'th' ? 'บันทึกประวัติการทำเวรห้องครัวจริง (Behavioral Log)' : 'Kitchen Duty Verification Log'}
        </h3>
        {kitchenLogs.length === 0 ? (
          <p className="text-sm text-[#7B695F]">
            {lang === 'th' ? 'ยังไม่มีรายการยืนยันเวรห้องครัว' : 'No kitchen verifications logged yet.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EBD8C3] text-[#6E5C52] text-xs">
                  <th className="py-2 pr-3">{lang === 'th' ? 'น้อง' : 'Kid'}</th>
                  <th className="py-2 px-3">{lang === 'th' ? 'รอบเวร' : 'Shift'}</th>
                  <th className="py-2 px-3">{lang === 'th' ? 'แม่ครัวยืนยัน' : 'Verified By'}</th>
                  <th className="py-2 px-3 text-right">{lang === 'th' ? 'ดาวที่มอบ' : 'Stars'}</th>
                  <th className="py-2 pl-3 text-right">{lang === 'th' ? 'เวลายืนยัน' : 'Timestamp'}</th>
                </tr>
              </thead>
              <tbody>
                {kitchenLogs.slice(0, 25).map((log) => (
                  <tr key={log.id} className="border-b border-[#F5ECE2]">
                    <td className="py-2.5 pr-3 font-bold">{log.kidNickname}</td>
                    <td className="py-2.5 px-3">{log.slotLabel}</td>
                    <td className="py-2.5 px-3">{log.chefName}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#2F685E] tabular-nums">
                      +{log.starsAwarded} ⭐
                    </td>
                    <td className="py-2.5 pl-3 text-right text-xs text-[#7B695F] tabular-nums">
                      {new Date(log.verifiedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PinPadModal
        open={Boolean(pendingConfirm)}
        lang={lang}
        lockedRemainingSec={pinGuard.remainingSec}
        title={
          pendingConfirm
            ? lang === 'th'
              ? `ยืนยันเวรครัว: ${pendingConfirm.kid.nickname}`
              : `Verify Kitchen Duty: ${pendingConfirm.kid.nickname}`
            : ''
        }
        subtitle={
          lang === 'th'
            ? `ใส่รหัส PIN 4 หลักของ${loggedInChef.nickname} เพื่อยืนยันว่าน้องมาทำครัวจริงและเพิ่มดาวให้`
            : `Enter ${loggedInChef.nickname}'s 4-digit PIN to confirm attendance & award stars`
        }
        onCancel={() => setPendingConfirm(null)}
        onSubmitPin={(pin) => {
          if (pinGuard.isLocked) {
            onShowAlert({
              icon: '🔒',
              title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
              message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
              tone: 'pink',
            });
            return;
          }
          const matchedChef = chefs.find((c) => c.pin === pin);
          if (!matchedChef || !pendingConfirm) {
            const res = pinGuard.recordFailure();
            onShowAlert({
              icon: res.lockedNow ? '🔒' : '🔐',
              title: res.lockedNow
                ? lang === 'th'
                  ? 'ล็อกชั่วคราว 30 วินาที'
                  : 'Locked for 30 Seconds'
                : lang === 'th'
                ? 'รหัส PIN แม่ครัวไม่ถูกต้อง'
                : 'Incorrect Chef PIN',
              message: res.lockedNow
                ? formatPinLockoutMessage(res.lockSec, lang)
                : `${lang === 'th' ? 'กรุณาใส่รหัส PIN 4 หลักของแม่ครัวให้ถูกต้อง' : 'Please enter a valid Chef PIN.'}\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
              tone: 'pink',
            });
            return;
          }
          pinGuard.recordSuccess();
          const { kid, slot, stars } = pendingConfirm;
          setPendingConfirm(null);
          onConfirmKitchenDuty(kid.id, slot, matchedChef, stars);
          onShowAlert({
            icon: '👩‍🍳⭐',
            title: lang === 'th' ? 'ยืนยันทำเวรห้องครัวสำเร็จ!' : 'Kitchen Duty Verified!',
            message:
              lang === 'th'
                ? `แม่ครัว${matchedChef.nickname} ยืนยัน ${kid.nickname} ทำเวรเสร็จเรียบร้อย (+${stars} ⭐)\nบันทึกวันที่ ${todayKey} ไม่มีหักเงินใดๆ`
                : `${matchedChef.nickname} confirmed ${kid.nickname}'s kitchen duty (+${stars} ⭐).`,
            tone: 'mint',
          });
        }}
      />
    </div>
  );
};
