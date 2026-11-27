import React, { useMemo, useState } from 'react';
import { Language, Member, ModalAlertPayload, SecretPoll } from '../types/barnhem';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';

interface KidSecretVoteViewProps {
  orgName: string;
  kids: Member[];
  polls: SecretPoll[];
  linkedKidMember: Member | null;
  lang: Language;
  cloudUserEmail?: string | null;
  cloudSyncing?: boolean;
  isCloudAuthorizedForVotes?: boolean;
  onRefreshPolls?: () => Promise<void> | void;
  onConnectCloud?: () => Promise<void> | void;
  onCastSecretVote: (pollId: string, optionId: string, kidId: string) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onBackHome: () => void;
}

export const KidSecretVoteView: React.FC<KidSecretVoteViewProps> = ({
  orgName,
  kids,
  polls,
  linkedKidMember,
  lang,
  cloudUserEmail = null,
  cloudSyncing = false,
  isCloudAuthorizedForVotes = false,
  onRefreshPolls,
  onConnectCloud,
  onCastSecretVote,
  onShowAlert,
  onBackHome,
}) => {
  const pinGuard = usePinGuard('pin0004_secret_vote');
  const [verifiedKidId, setVerifiedKidId] = useState<string | null>(
    linkedKidMember?.id ?? null
  );
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const verifiedKid = useMemo(
    () => kids.find((k) => k.id === verifiedKidId) ?? null,
    [kids, verifiedKidId]
  );

  const sortedPolls = useMemo(() => {
    return [...polls].sort((a, b) => {
      if (a.closed !== b.closed) return a.closed ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [polls]);

  const openPollsCount = useMemo(
    () => polls.filter((p) => !p.closed).length,
    [polls]
  );

  const verifyKidPin = (rawPin: string) => {
    const clean = rawPin.trim();
    if (pinGuard.isLocked) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ล็อกชั่วคราว 30 วินาที' : 'Temporarily Locked',
        message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
        tone: 'pink',
      });
      return;
    }
    if (!/^\d{4}$/.test(clean)) {
      onShowAlert({
        icon: '🔑',
        title: lang === 'th' ? 'กรุณากรอก PIN น้อง 4 หลัก' : 'Enter 4-Digit Kid PIN',
        message:
          lang === 'th'
            ? 'กรอกรหัส PIN ประจำตัวน้อง 4 หลัก เพื่อยืนยันสิทธิ์โหวตลับค่ะ'
            : 'Please enter your 4-digit kid PIN to cast an anonymous vote.',
        tone: 'lavender',
      });
      return;
    }
    const matched = kids.find((k) => k.pin.trim() === clean);
    if (!matched) {
      const res = pinGuard.recordFailure();
      setPinInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '🔐',
        title:
          res.lockedNow
            ? lang === 'th'
              ? 'ล็อกชั่วคราว 30 วินาที'
              : 'Locked for 30s'
            : lang === 'th'
            ? 'ไม่พบรหัส PIN ของน้อง'
            : 'Kid PIN Not Found',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${
              lang === 'th'
                ? 'กรุณาตรวจสอบรหัส PIN 4 หลักของน้องอีกครั้งค่ะ'
                : 'Please check your 4-digit kid PIN.'
            }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
      return;
    }
    pinGuard.recordSuccess();
    setVerifiedKidId(matched.id);
    setPinInput('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header Card */}
      <section className="rounded-[28px] border-2 border-[#C8B7EB] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#C8B7EB] bg-[#F4EFFE] px-3 py-1 text-xs font-extrabold text-[#473174]">
              <span>🔑 PIN 0004</span>
              <span>·</span>
              <span>{orgName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
              🗳️ {lang === 'th' ? 'โหวตลับ (ไม่ระบุตัวตน)' : 'Secret Anonymous Polls'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5C52]">
              {lang === 'th'
                ? 'ระบบบันทึกเฉพาะสิทธิ์ว่าใช้เสียงแล้วเพื่อป้องกันโหวตซ้ำ โดยไม่แสดงว่าน้องคนไหนเลือกข้อใดค่ะ'
                : 'Your choice is strictly anonymous; only participation is recorded to prevent duplicate votes.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[42px] rounded-2xl border border-[#EBD8C3] bg-white hover:bg-[#FADADD]/40 px-4 py-2 text-xs sm:text-sm font-bold text-[#3D322C] cursor-pointer whitespace-nowrap"
          >
            ← {lang === 'th' ? 'ออก / กลับหน้าแรก' : 'Back Home'}
          </button>
        </div>

        {/* Summary & Kid Verification Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          <div className="md:col-span-4 rounded-2xl border border-[#E6DCD2] bg-[#FAF7F3] px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#6E5C52]">
                {lang === 'th' ? 'หัวข้อที่เปิดโหวตอยู่' : 'Open Polls'}
              </div>
              <div className="text-2xl font-extrabold text-[#3D322C] tabular-nums">
                {openPollsCount}
                <span className="text-xs font-semibold text-[#7B695F] ml-1.5">
                  / {polls.length} {lang === 'th' ? 'หัวข้อ' : 'total'}
                </span>
              </div>
            </div>
            <span className="text-2xl">🗳️</span>
          </div>

          <div className="md:col-span-8 rounded-2xl border border-[#C8B7EB] bg-[#F9F6FF] px-4 py-3">
            {verifiedKid ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{verifiedKid.emoji}</span>
                  <div>
                    <div className="text-xs font-extrabold text-[#473174]">
                      🔓 {lang === 'th' ? 'ยืนยันตัวตนพร้อมโหวตแล้ว' : 'Verified to Vote'}
                    </div>
                    <div className="text-sm font-extrabold text-[#3D322C]">
                      น้อง{verifiedKid.nickname} ({verifiedKid.fullName})
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVerifiedKidId(null);
                    setSelectedOptions({});
                    setPinInput('');
                  }}
                  className="min-h-[36px] rounded-xl border border-[#C8B7EB] bg-white hover:bg-[#F4EFFE] px-3 py-1.5 text-xs font-bold text-[#473174] cursor-pointer"
                >
                  🔄 {lang === 'th' ? 'สลับคน / ล้างรหัส' : 'Switch Kid'}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyKidPin(pinInput);
                }}
                className="flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-[#473174] mb-1">
                    🔐 {lang === 'th' ? 'กรอกรหัส PIN น้อง 4 หลัก เพื่อโหวตลับ' : 'Enter 4-Digit Kid PIN to Vote'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      disabled={pinGuard.isLocked}
                      value={pinInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setPinInput(val);
                        if (val.length === 4) {
                          verifyKidPin(val);
                        }
                      }}
                      placeholder={
                        pinGuard.isLocked
                          ? `🔒 รอ ${pinGuard.remainingSec}s`
                          : lang === 'th'
                          ? 'PIN น้อง 4 หลัก...'
                          : '4-digit PIN...'
                      }
                      className="flex-1 min-w-0 rounded-xl border border-[#C8B7EB] bg-white px-3 py-2 text-sm font-bold text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#C8B7EB]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((s) => !s)}
                      className="rounded-xl border border-[#EBD8C3] bg-white px-2.5 py-2 text-xs cursor-pointer"
                    >
                      {showPin ? '🙈' : '👁️'}
                    </button>
                    <button
                      type="submit"
                      disabled={pinGuard.isLocked}
                      className="rounded-xl bg-[#473174] hover:bg-[#38255E] disabled:opacity-50 text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer whitespace-nowrap"
                    >
                      {lang === 'th' ? 'ยืนยัน' : 'Verify'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Cloud Sync & Refresh Bar for Tablets */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E6DCD2] bg-[#FAF7F3] px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-[#5E4E45] font-semibold">
            <span>{isCloudAuthorizedForVotes ? '☁️' : '📲'}</span>
            <span>
              {isCloudAuthorizedForVotes
                ? lang === 'th'
                  ? `เชื่อมต่อหัวข้อโหวตออนไลน์แล้ว${cloudUserEmail ? ` (${cloudUserEmail})` : ''}`
                  : `Online vote sync active${cloudUserEmail ? ` (${cloudUserEmail})` : ''}`
                : lang === 'th'
                ? 'โหมดดูหัวข้อจากคลาวด์ (กดรีเฟรชเพื่ออัปเดตล่าสุด)'
                : 'Cloud board view (tap refresh for latest polls)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onRefreshPolls && (
              <button
                type="button"
                disabled={cloudSyncing}
                onClick={() => void onRefreshPolls()}
                className="min-h-[34px] rounded-xl border border-[#7CC6B8] bg-[#E8F8F5] hover:bg-[#D4F0F0] disabled:opacity-60 px-3 py-1 text-xs font-extrabold text-[#1A564D] cursor-pointer whitespace-nowrap"
              >
                {cloudSyncing
                  ? lang === 'th'
                    ? '⏳ กำลังอัปเดต...'
                    : '⏳ Syncing...'
                  : lang === 'th'
                  ? '🔄 รีเฟรชหัวข้อโหวต'
                  : '🔄 Refresh Polls'}
              </button>
            )}
            {!isCloudAuthorizedForVotes && onConnectCloud && (
              <button
                type="button"
                onClick={() => {
                  void Promise.resolve(onConnectCloud()).catch((err) => {
                    onShowAlert({
                      icon: '⚠️',
                      title: lang === 'th' ? 'เชื่อมต่อ Google ไม่สำเร็จ' : 'Google Sign-In Failed',
                      message: err instanceof Error ? err.message : String(err),
                      tone: 'pink',
                    });
                  });
                }}
                className="min-h-[34px] rounded-xl border border-[#C8B7EB] bg-white hover:bg-[#F4EFFE] px-3 py-1 text-xs font-extrabold text-[#473174] cursor-pointer whitespace-nowrap"
              >
                ☁️ {lang === 'th' ? 'เชื่อมต่อ Google Sync' : 'Connect Google Sync'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Polls List */}
      <section className="space-y-4">
        {sortedPolls.length === 0 ? (
          <div className="rounded-[24px] border-2 border-[#EBD8C3] bg-white p-8 text-center text-sm text-[#7B695F] pastel-shadow">
            {lang === 'th' ? 'ยังไม่มีหัวข้อโหวตลับในขณะนี้ค่ะ' : 'No secret polls available right now.'}
          </div>
        ) : (
          sortedPolls.map((poll) => {
            const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
            const hasVoted = verifiedKid ? poll.votedKidIds.includes(verifiedKid.id) : false;
            const chosenOpt = selectedOptions[poll.id];
            const showResults = poll.closed || hasVoted;

            return (
              <div
                key={poll.id}
                className="rounded-[24px] border-2 border-[#EBD8C3] bg-white p-5 space-y-3 pastel-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-extrabold text-base text-[#3D322C]">
                      {poll.question}
                    </div>
                    <div className="text-[11px] text-[#7B695F]">
                      {lang === 'th' ? 'ตั้งโดย' : 'By'} {poll.authorName} ·{' '}
                      {new Date(poll.createdAt).toLocaleDateString(
                        lang === 'th' ? 'th-TH' : 'en-US',
                        { day: 'numeric', month: 'short', year: 'numeric' }
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-xl px-2.5 py-1 text-xs font-extrabold ${
                      poll.closed
                        ? 'bg-[#F4ECE4] text-[#6E5C52]'
                        : 'bg-[#D4F0F0] text-[#1A564D]'
                    }`}
                  >
                    {poll.closed
                      ? lang === 'th'
                        ? '🔒 ปิดโหวตแล้ว'
                        : '🔒 Closed'
                      : lang === 'th'
                      ? '🟢 เปิดโหวต'
                      : '🟢 Open'}
                  </span>
                </div>

                {showResults ? (
                  <div className="space-y-2 pt-1">
                    {poll.options.map((opt) => {
                      const pct =
                        totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                      return (
                        <div key={opt.id} className="space-y-1 text-xs">
                          <div className="flex justify-between font-bold text-[#3D322C]">
                            <span>{opt.label}</span>
                            <span className="tabular-nums">
                              {opt.votes} ({pct}%)
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-[#F4ECE4] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#7CC6B8] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-[11px] text-[#7B695F] tabular-nums pt-1">
                      {hasVoted && !poll.closed
                        ? lang === 'th'
                          ? `✅ น้อง${verifiedKid?.nickname} โหวตหัวข้อนี้แล้ว · รวม ${totalVotes} เสียง (ไม่แสดงรายชื่อ)`
                          : `✅ You voted · Total ${totalVotes} anonymous votes`
                        : lang === 'th'
                        ? `จำนวนผู้ใช้สิทธิ์ทั้งหมด ${totalVotes} เสียง (ไม่แสดงรายชื่อ)`
                        : `Total votes cast: ${totalVotes} (anonymous)`}
                    </div>
                  </div>
                ) : verifiedKid ? (
                  <div className="space-y-2 pt-1">
                    {poll.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [poll.id]: opt.id,
                          }))
                        }
                        className={`w-full min-h-[44px] rounded-xl border-2 px-4 py-2 text-left text-sm font-semibold cursor-pointer transition-all ${
                          chosenOpt === opt.id
                            ? 'border-[#3D322C] bg-[#FFF5BA] text-[#3D322C]'
                            : 'border-[#EBD8C3] bg-[#FFFDF9] hover:bg-[#FAF5EE] text-[#3D322C]'
                        }`}
                      >
                        {chosenOpt === opt.id ? '🔘 ' : '⚪ '}
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={!chosenOpt}
                      onClick={() => {
                        if (!chosenOpt) return;
                        onCastSecretVote(poll.id, chosenOpt, verifiedKid.id);
                        onShowAlert({
                          icon: '🗳️🔒',
                          title:
                            lang === 'th'
                              ? 'ส่งเสียงโหวตลับเรียบร้อย!'
                              : 'Secret Vote Recorded!',
                          message: isCloudAuthorizedForVotes
                            ? lang === 'th'
                              ? `ขอบคุณน้อง${verifiedKid.nickname} ที่ใช้สิทธิ์ คะแนนถูกนับรวมแบบไม่ระบุตัวตนเรียบร้อยแล้วค่ะ`
                              : 'Your vote was counted anonymously!'
                            : lang === 'th'
                            ? `บันทึกโหวตของน้อง${verifiedKid.nickname} บนเครื่องนี้เรียบร้อยแล้วค่ะ (หากต้องการส่งผลโหวตกลับเครื่องหลัก กรุณากดเชื่อมต่อ Google Sync ด้านบนค่ะ)`
                            : 'Saved on this device. Connect Google Sync above to send votes back to the main computer.',
                          tone: 'mint',
                        });
                      }}
                      className="w-full min-h-[46px] rounded-2xl bg-[#3D322C] hover:bg-[#2A221E] disabled:bg-[#C9BEB5] text-white font-bold text-sm cursor-pointer mt-1"
                    >
                      🗳️ {lang === 'th' ? 'ยืนยันโหวต (ความลับ)' : 'Submit Secret Vote'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {poll.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#5E4E45]"
                        >
                          ⚪ {opt.label}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-[#C8B7EB] bg-[#F9F6FF] px-3.5 py-2 text-xs font-bold text-[#473174]">
                      🔐{' '}
                      {lang === 'th'
                        ? `กรอกรหัส PIN น้อง 4 หลักด้านบน เพื่อเลือกข้อและกดโหวตลับได้เลยค่ะ (มีผู้ใช้สิทธิ์แล้ว ${totalVotes} เสียง)`
                        : `Enter your 4-digit kid PIN above to vote (${totalVotes} vote(s) so far).`}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
