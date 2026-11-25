import React, { useMemo, useState } from 'react';
import {
  Language,
  Member,
  ModalAlertPayload,
  SupplyRequest,
} from '../types/barnhem';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';

interface KidSupplyRequestViewProps {
  orgName: string;
  kids: Member[];
  supplyRequests: SupplyRequest[];
  linkedKidMember: Member | null;
  now: Date;
  lang: Language;
  onSubmitSupplyRequest: (req: SupplyRequest) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onBackHome: () => void;
}

const CATEGORY_LABEL_TH: Record<SupplyRequest['category'], string> = {
  hygiene: '🪥 ของใช้ส่วนตัว',
  study: '✏️ อุปกรณ์การเรียน',
  uniform: '👔 ชุดนักเรียน / รองเท้า',
  other: '📦 อื่นๆ',
};

export const KidSupplyRequestView: React.FC<KidSupplyRequestViewProps> = ({
  orgName,
  kids,
  supplyRequests,
  linkedKidMember,
  now,
  lang,
  onSubmitSupplyRequest,
  onShowAlert,
  onBackHome,
}) => {
  const pinGuard = usePinGuard('pin0005_supply_request');
  const [verifiedKidId, setVerifiedKidId] = useState<string | null>(
    linkedKidMember?.id ?? null
  );
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<SupplyRequest['category']>('hygiene');
  const [urgency, setUrgency] = useState<SupplyRequest['urgency']>('normal');
  const [note, setNote] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SupplyRequest['status']>('all');
  const [onlyMine, setOnlyMine] = useState(false);

  const verifiedKid = useMemo(
    () => kids.find((k) => k.id === verifiedKidId) ?? null,
    [kids, verifiedKidId]
  );

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let delivered = 0;
    for (const r of supplyRequests) {
      if (r.status === 'pending') pending += 1;
      else if (r.status === 'approved') approved += 1;
      else if (r.status === 'delivered') delivered += 1;
    }
    return { total: supplyRequests.length, pending, approved, delivered };
  }, [supplyRequests]);

  const filteredRequests = useMemo(() => {
    return supplyRequests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (onlyMine && verifiedKid && r.kidId !== verifiedKid.id) return false;
      return true;
    });
  }, [supplyRequests, statusFilter, onlyMine, verifiedKid]);

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
            ? 'กรอกรหัส PIN ประจำตัวน้อง 4 หลัก เพื่อส่งคำขอเบิกของใช้ค่ะ'
            : 'Please enter your 4-digit kid PIN to submit a supply request.',
        tone: 'blue',
      });
      return;
    }
    const matched = kids.find((k) => k.pin.trim() === clean);
    if (!matched) {
      const res = pinGuard.recordFailure();
      setPinInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '🔐',
        title: res.lockedNow
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedKid) {
      onShowAlert({
        icon: '🔐',
        title: lang === 'th' ? 'กรุณายืนยันรหัส PIN น้องก่อนค่ะ' : 'Verify Kid PIN First',
        message:
          lang === 'th'
            ? 'กรอกรหัส PIN 4 หลักของน้องในช่องยืนยันตัวตน เพื่อระบุชื่อผู้ขอเบิกค่ะ'
            : 'Enter your 4-digit kid PIN above so staff know who needs the item.',
        tone: 'blue',
      });
      return;
    }
    if (!itemName.trim()) {
      onShowAlert({
        icon: '📦',
        title: lang === 'th' ? 'กรุณาระบุชื่อสิ่งของที่ขอเบิก' : 'Item Name Required',
        message:
          lang === 'th'
            ? 'เช่น แปรงสีฟัน ยาสีฟัน สมุด ปากกา ถุงเท้า'
            : 'Please enter the item you need.',
        tone: 'yellow',
      });
      return;
    }

    onSubmitSupplyRequest({
      id: `sup_${Date.now()}`,
      kidId: verifiedKid.id,
      kidNickname: verifiedKid.nickname,
      itemName: itemName.trim(),
      category,
      urgency,
      note: note.trim() || '-',
      status: 'pending',
      createdAt: now.toISOString(),
    });
    setItemName('');
    setNote('');
    setUrgency('normal');
    onShowAlert({
      icon: '📦✨',
      title: lang === 'th' ? 'ส่งคำขอเบิกของใช้แล้ว!' : 'Supply Request Sent!',
      message:
        lang === 'th'
          ? `บันทึกคำขอของน้อง${verifiedKid.nickname} ส่งถึงพี่เลี้ยงและผู้จัดการเรียบร้อย รอติดตามสถานะด้านล่างได้เลยค่ะ`
          : `Request from ${verifiedKid.nickname} sent to caretakers.`,
      tone: 'mint',
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header Card */}
      <section className="rounded-[28px] border-2 border-[#BEDBF0] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#BEDBF0] bg-[#EDF6FF] px-3 py-1 text-xs font-extrabold text-[#1D4D73]">
              <span>🔑 PIN 0005</span>
              <span>·</span>
              <span>{orgName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
              📦 {lang === 'th' ? 'ขอเบิกของใช้จำเป็น & อุปกรณ์การเรียน' : 'Supply & Study Essentials Requests'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5C52]">
              {lang === 'th'
                ? 'น้องๆ ยืนยันด้วย PIN 4 หลักเพื่อส่งรายการขอเบิกถึงพี่เลี้ยงและผู้จัดการ และติดตามสถานะจัดซื้อ/รับของได้ทันทีค่ะ'
                : 'Kids can verify with their 4-digit PIN to submit supply requests and track approval/delivery status.'}
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-[#EBD8C3] bg-white px-4 py-3">
            <div className="text-[11px] font-bold text-[#6E5C52]">
              {lang === 'th' ? 'คำขอทั้งหมด' : 'Total'}
            </div>
            <div className="text-2xl font-extrabold text-[#3D322C] tabular-nums">{counts.total}</div>
          </div>
          <div className="rounded-2xl border border-[#EBD8C3] bg-[#FAF7F3] px-4 py-3">
            <div className="text-[11px] font-bold text-[#6E5C52]">
              ⏳ {lang === 'th' ? 'รอตรวจ' : 'Pending'}
            </div>
            <div className="text-2xl font-extrabold text-[#6E5C52] tabular-nums">{counts.pending}</div>
          </div>
          <div className="rounded-2xl border border-[#F0D999] bg-[#FFFBEB] px-4 py-3">
            <div className="text-[11px] font-bold text-[#7A5411]">
              👍 {lang === 'th' ? 'อนุมัติแล้ว' : 'Approved'}
            </div>
            <div className="text-2xl font-extrabold text-[#7A5411] tabular-nums">{counts.approved}</div>
          </div>
          <div className="rounded-2xl border border-[#A5DDD3] bg-[#EFFAF7] px-4 py-3">
            <div className="text-[11px] font-bold text-[#1D5A50]">
              🎉 {lang === 'th' ? 'ส่งมอบแล้ว' : 'Delivered'}
            </div>
            <div className="text-2xl font-extrabold text-[#1D5A50] tabular-nums">{counts.delivered}</div>
          </div>
        </div>
      </section>

      {/* Request Form + History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Kid PIN Verify + Submit Form */}
        <section className="lg:col-span-5 rounded-[24px] border-2 border-[#BEDBF0] bg-[#F5FAFE] p-5 space-y-3.5 h-fit pastel-shadow">
          <div className="font-extrabold text-base text-[#1D4D73]">
            ✍️ {lang === 'th' ? 'ส่งคำขอเบิกของใช้ใหม่' : 'New Supply Request'}
          </div>

          {verifiedKid ? (
            <div className="rounded-2xl border border-[#A5DDD3] bg-white px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{verifiedKid.emoji}</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-[#1D5A50]">
                    🔓 {lang === 'th' ? 'ผู้ขอเบิก' : 'Requester'}
                  </div>
                  <div className="text-xs font-extrabold text-[#3D322C] truncate">
                    น้อง{verifiedKid.nickname} ({verifiedKid.fullName})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVerifiedKidId(null);
                  setOnlyMine(false);
                  setPinInput('');
                }}
                className="rounded-xl border border-[#BEDBF0] bg-[#F5FAFE] hover:bg-[#E4F2FC] px-2.5 py-1 text-[11px] font-bold text-[#1D4D73] cursor-pointer shrink-0"
              >
                🔄 {lang === 'th' ? 'สลับคน' : 'Switch'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#BEDBF0] bg-white p-3 space-y-1.5">
              <div className="text-xs font-bold text-[#1D4D73]">
                🔐 {lang === 'th' ? 'ยืนยันรหัส PIN น้อง 4 หลักก่อนเบิก' : 'Enter 4-Digit Kid PIN'}
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
                      ? 'รหัส PIN น้อง 4 หลัก...'
                      : '4-digit Kid PIN...'
                  }
                  className="flex-1 min-w-0 rounded-xl border border-[#BEDBF0] bg-[#FFFDF9] px-3 py-2 text-xs font-bold text-[#3D322C] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  className="rounded-xl border border-[#EBD8C3] bg-white px-2.5 py-2 text-xs cursor-pointer"
                >
                  {showPin ? '🙈' : '👁️'}
                </button>
                <button
                  type="button"
                  disabled={pinGuard.isLocked}
                  onClick={() => verifyKidPin(pinInput)}
                  className="rounded-xl bg-[#1D4D73] hover:bg-[#163C5A] disabled:opacity-50 text-white px-3 py-2 text-xs font-bold cursor-pointer"
                >
                  {lang === 'th' ? 'ยืนยัน' : 'OK'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {lang === 'th' ? 'สิ่งของที่ขอเบิก *' : 'Item Name *'}
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={
                  lang === 'th'
                    ? 'เช่น แปรงสีฟัน สบู่ สมุด ปากกา ถุงเท้า...'
                    : 'e.g. Toothbrush, Notebook, Pens...'
                }
                className="w-full rounded-xl border border-[#BEDBF0] bg-white px-3 py-2 text-sm text-[#3D322C]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {lang === 'th' ? 'หมวดหมู่' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupplyRequest['category'])}
                className="w-full rounded-xl border border-[#BEDBF0] bg-white px-3 py-2 text-xs font-bold text-[#3D322C]"
              >
                <option value="hygiene">🪥 ของใช้ส่วนตัว (สบู่ / ยาสีฟัน / แชมพู)</option>
                <option value="study">✏️ อุปกรณ์การเรียน (สมุด / ปากกา / สี)</option>
                <option value="uniform">👔 ชุดนักเรียน / ถุงเท้า / รองเท้า</option>
                <option value="other">📦 อื่นๆ</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setUrgency((u) => (u === 'normal' ? 'urgent' : 'normal'))
                }
                className={`rounded-xl px-3 py-2 text-xs font-bold border cursor-pointer shrink-0 ${
                  urgency === 'urgent'
                    ? 'bg-[#FADADD] border-[#E66C84] text-[#6B2D39]'
                    : 'bg-white border-[#BEDBF0] text-[#5E4E45]'
                }`}
              >
                {urgency === 'urgent' ? '🚨 ด่วนมาก (หมดแล้ว)' : '⏳ ปกติ'}
              </button>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={lang === 'th' ? 'หมายเหตุเพิ่มเติม (เช่น ไซส์/สี)...' : 'Note (optional)...'}
                className="flex-1 min-w-0 rounded-xl border border-[#BEDBF0] bg-white px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-2xl bg-[#3D322C] hover:bg-[#2A221E] text-white text-sm font-extrabold cursor-pointer"
            >
              📤 {lang === 'th' ? 'ส่งคำขอเบิกถึงพี่เลี้ยง' : 'Submit Supply Request'}
            </button>
          </form>
        </section>

        {/* Right: All Requests List */}
        <section className="lg:col-span-7 rounded-[24px] border-2 border-[#EBD8C3] bg-white p-5 space-y-3 pastel-shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-extrabold text-base text-[#3D322C]">
              📋 {lang === 'th' ? 'รายการขอเบิกของใช้ทั้งหมด' : 'All Supply Requests'} ({filteredRequests.length})
            </div>

            {verifiedKid && (
              <button
                type="button"
                onClick={() => setOnlyMine((v) => !v)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  onlyMine
                    ? 'border-[#3D322C] bg-[#3D322C] text-white'
                    : 'border-[#EBD8C3] bg-[#FFFDF9] text-[#5E4E45]'
                }`}
              >
                {onlyMine
                  ? `✓ เฉพาะของน้อง${verifiedKid.nickname}`
                  : `ดูเฉพาะของน้อง${verifiedKid.nickname}`}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', labelTh: 'ทั้งหมด', labelEn: 'All' },
                { id: 'pending', labelTh: '⏳ รอตรวจ', labelEn: 'Pending' },
                { id: 'approved', labelTh: '👍 อนุมัติแล้ว', labelEn: 'Approved' },
                { id: 'delivered', labelTh: '🎉 ส่งมอบแล้ว', labelEn: 'Delivered' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#FFF5BA] border-[#E0C76B] text-[#3D322C]'
                    : 'bg-[#FFFDF9] border-[#EBD8C3] text-[#6E5C52]'
                }`}
              >
                {lang === 'th' ? tab.labelTh : tab.labelEn}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-0.5">
            {filteredRequests.length === 0 ? (
              <p className="text-sm text-[#7B695F] text-center py-8">
                {lang === 'th' ? 'ยังไม่มีรายการขอเบิกในหมวดนี้ค่ะ' : 'No supply requests in this filter.'}
              </p>
            ) : (
              filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs ${
                    verifiedKid && req.kidId === verifiedKid.id
                      ? 'border-[#96C3E6] bg-[#F5FAFE]'
                      : 'border-[#EBD8C3] bg-[#FFFDF9]'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-extrabold text-sm text-[#3D322C]">
                      {req.urgency === 'urgent' ? '🚨 ' : '📦 '}
                      น้อง{req.kidNickname} ขอเบิก: {req.itemName}
                    </div>
                    <div className="text-[#6E5C52]">
                      {CATEGORY_LABEL_TH[req.category]} · หมายเหตุ: {req.note || '-'}
                    </div>
                    <div className="text-[11px] text-[#7B695F] tabular-nums">
                      🕒{' '}
                      {new Date(req.createdAt).toLocaleString(
                        lang === 'th' ? 'th-TH' : 'en-US',
                        { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                      )}
                      {req.approvedBy ? ` · ผู้ดำเนินการ: ${req.approvedBy}` : ''}
                    </div>
                  </div>
                  <span
                    className={`rounded-xl px-3 py-1.5 font-extrabold shrink-0 ${
                      req.status === 'delivered'
                        ? 'bg-[#D4F0F0] text-[#1D5A50]'
                        : req.status === 'approved'
                        ? 'bg-[#FFF5BA] text-[#6B5412]'
                        : 'bg-[#F4ECE4] text-[#5E4E45]'
                    }`}
                  >
                    {req.status === 'delivered'
                      ? '🎉 ส่งมอบแล้ว'
                      : req.status === 'approved'
                      ? '👍 อนุมัติแล้ว รอจัดส่ง'
                      : '⏳ รอตรวจ'}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
