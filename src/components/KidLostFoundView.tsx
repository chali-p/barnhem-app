import React, { useMemo, useState } from 'react';
import {
  Language,
  LostFoundItem,
  Member,
  ModalAlertPayload,
} from '../types/barnhem';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';

interface KidLostFoundViewProps {
  orgName: string;
  members: Member[];
  lostFoundItems: LostFoundItem[];
  linkedKidMember: Member | null;
  now: Date;
  lang: Language;
  onAddLostFound: (item: LostFoundItem) => void;
  onClaimLostFound: (itemId: string, kid: Member) => void;
  onResolveLostFound: (itemId: string) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onBackHome: () => void;
}

export const KidLostFoundView: React.FC<KidLostFoundViewProps> = ({
  orgName,
  members,
  lostFoundItems,
  linkedKidMember,
  now,
  lang,
  onAddLostFound,
  onClaimLostFound,
  onResolveLostFound,
  onShowAlert,
  onBackHome,
}) => {
  const postPinGuard = usePinGuard('pin0006_lostfound_post');
  const claimPinGuard = usePinGuard('pin0006_lostfound_claim');

  const kids = useMemo(
    () => members.filter((m) => m.role === 'kid'),
    [members]
  );

  const [verifiedMemberId, setVerifiedMemberId] = useState<string | null>(
    linkedKidMember?.id ?? null
  );
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [lfStatus, setLfStatus] = useState<'lost' | 'found'>('lost');
  const [lfTitle, setLfTitle] = useState('');
  const [lfLocation, setLfLocation] = useState('');
  const [lfDesc, setLfDesc] = useState('');
  const [lfPhotoBase64, setLfPhotoBase64] = useState<string | undefined>(undefined);

  const [boardFilter, setBoardFilter] = useState<'all' | 'lost' | 'found' | 'claimed'>('all');
  const [search, setSearch] = useState('');

  // Modal state when claiming an item without pre-verified kid PIN
  const [claimingItem, setClaimingItem] = useState<LostFoundItem | null>(null);
  const [claimPinInput, setClaimPinInput] = useState('');

  const verifiedMember = useMemo(
    () => members.find((m) => m.id === verifiedMemberId) ?? null,
    [members, verifiedMemberId]
  );

  const counts = useMemo(() => {
    let lost = 0;
    let found = 0;
    let claimed = 0;
    for (const item of lostFoundItems) {
      if (item.status === 'lost') lost += 1;
      else if (item.status === 'found') found += 1;
      else if (item.status === 'claimed') claimed += 1;
    }
    return { total: lostFoundItems.length, lost, found, claimed };
  }, [lostFoundItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lostFoundItems.filter((item) => {
      if (boardFilter !== 'all' && item.status !== boardFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.locationFound.toLowerCase().includes(q) ||
        item.postedByName.toLowerCase().includes(q)
      );
    });
  }, [lostFoundItems, boardFilter, search]);

  const verifyAnyMemberPin = (rawPin: string) => {
    const clean = rawPin.trim();
    if (postPinGuard.isLocked) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ล็อกชั่วคราว 30 วินาที' : 'Temporarily Locked',
        message: formatPinLockoutMessage(postPinGuard.remainingSec, lang),
        tone: 'pink',
      });
      return;
    }
    if (!/^\d{4}$/.test(clean)) {
      onShowAlert({
        icon: '🔑',
        title: lang === 'th' ? 'กรุณากรอก PIN 4 หลัก' : 'Enter 4-Digit PIN',
        message:
          lang === 'th'
            ? 'กรอกรหัส PIN 4 หลักของน้องหรือพี่เลี้ยง เพื่อระบุชื่อผู้แจ้งค่ะ'
            : 'Enter your 4-digit kid or staff PIN to verify who is posting.',
        tone: 'yellow',
      });
      return;
    }
    const matched = members.find((m) => m.pin.trim() === clean);
    if (!matched) {
      const res = postPinGuard.recordFailure();
      setPinInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '🔐',
        title: res.lockedNow
          ? lang === 'th'
            ? 'ล็อกชั่วคราว 30 วินาที'
            : 'Locked for 30s'
          : lang === 'th'
          ? 'ไม่พบรหัส PIN นี้'
          : 'PIN Not Found',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${
              lang === 'th'
                ? 'กรุณาตรวจสอบรหัส PIN 4 หลักอีกครั้งค่ะ'
                : 'Please check your 4-digit PIN.'
            }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
      return;
    }
    postPinGuard.recordSuccess();
    setVerifiedMemberId(matched.id);
    setPinInput('');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const maxW = 420;
        const w = Math.min(maxW, img.width || maxW);
        const h = Math.round(((img.height || 300) / (img.width || maxW)) * w);
        c.width = w;
        c.height = h;
        c.getContext('2d')?.drawImage(img, 0, 0, w, h);
        setLfPhotoBase64(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedMember) {
      onShowAlert({
        icon: '🔐',
        title: lang === 'th' ? 'กรุณายืนยันรหัส PIN ก่อนโพสต์ค่ะ' : 'Verify PIN First',
        message:
          lang === 'th'
            ? 'กรอกรหัส PIN 4 หลักของน้องหรือพี่เลี้ยงด้านบน เพื่อระบุชื่อผู้แจ้งค่ะ'
            : 'Enter a 4-digit kid or staff PIN above to post.',
        tone: 'yellow',
      });
      return;
    }
    if (!lfTitle.trim()) {
      onShowAlert({
        icon: '🔎',
        title: lang === 'th' ? 'กรุณาระบุชื่อสิ่งของ' : 'Item Name Required',
        message:
          lang === 'th'
            ? 'เช่น กระติกน้ำสีฟ้า เสื้อพละ ร่ม กล่องดินสอ'
            : 'Please enter the item name.',
        tone: 'yellow',
      });
      return;
    }

    const posterName =
      verifiedMember.role === 'kid'
        ? `น้อง${verifiedMember.nickname}`
        : verifiedMember.nickname;

    onAddLostFound({
      id: `lf_${Date.now()}`,
      title: lfTitle.trim(),
      description: lfDesc.trim() || '-',
      locationFound: lfLocation.trim() || 'บ้าน Barnhem',
      status: lfStatus,
      photoBase64: lfPhotoBase64,
      postedByName: posterName,
      postedByRole: verifiedMember.role,
      createdAt: now.toISOString(),
    });

    setLfTitle('');
    setLfLocation('');
    setLfDesc('');
    setLfPhotoBase64(undefined);

    onShowAlert({
      icon: lfStatus === 'found' ? '🎁✨' : '❓📢',
      title:
        lfStatus === 'found'
          ? lang === 'th'
            ? 'แจ้งพบเจอของเก็บได้แล้ว!'
            : 'Found Item Posted!'
          : lang === 'th'
          ? 'ลงประกาศตามหาของหายแล้ว!'
          : 'Lost Item Posted!',
      message:
        lang === 'th'
          ? `โพสต์โดย ${posterName} เรียบร้อย ทุกคนในบ้านสามารถดูและกดแสดงตัวรับคืนได้ทันทีค่ะ`
          : `Posted by ${posterName}.`,
      tone: 'mint',
    });
  };

  const handleClaimConfirm = (rawPin: string) => {
    if (!claimingItem) return;
    const clean = rawPin.trim();
    if (claimPinGuard.isLocked) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ล็อกชั่วคราว 30 วินาที' : 'Locked for 30s',
        message: formatPinLockoutMessage(claimPinGuard.remainingSec, lang),
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
            ? 'กรอกรหัส PIN ของน้องที่เป็นเจ้าของ เพื่อยืนยันการรับของคืนค่ะ'
            : 'Enter the owner kid’s 4-digit PIN.',
        tone: 'yellow',
      });
      return;
    }
    const kid = kids.find((k) => k.pin.trim() === clean);
    if (!kid) {
      const res = claimPinGuard.recordFailure();
      setClaimPinInput('');
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
                ? 'กรุณาใช้รหัส PIN 4 หลักของน้องเพื่อรับของคืนค่ะ'
                : 'Please enter a valid kid 4-digit PIN.'
            }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
      return;
    }
    claimPinGuard.recordSuccess();
    onClaimLostFound(claimingItem.id, kid);
    const claimedTitle = claimingItem.title;
    setClaimingItem(null);
    setClaimPinInput('');
    onShowAlert({
      icon: '🙋🎉',
      title: lang === 'th' ? 'แจ้งรับของคืนเรียบร้อย!' : 'Claim Recorded!',
      message:
        lang === 'th'
          ? `บันทึกชื่อน้อง${kid.nickname} ว่าเป็นเจ้าของ "${claimedTitle}" แล้ว ติดต่อรับของที่พี่เลี้ยงได้เลยค่ะ`
          : `${kid.nickname} claimed "${claimedTitle}".`,
      tone: 'mint',
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header Card */}
      <section className="rounded-[28px] border-2 border-[#F4DB73] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#F4DB73] bg-[#FFFBEB] px-3 py-1 text-xs font-extrabold text-[#7A5411]">
              <span>🔑 PIN 0006</span>
              <span>·</span>
              <span>{orgName}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
              🔎 {lang === 'th' ? 'แจ้งของหาย / แจ้งพบเจอของเก็บได้' : 'Lost & Found Board'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5C52]">
              {lang === 'th'
                ? 'แจ้งของหาย แจ้งเก็บของได้พร้อมแนบรูปถ่าย และกดแสดงตัวเป็นเจ้าของรับคืนด้วยรหัส PIN 4 หลักได้เลยค่ะ'
                : 'Report lost items, post found items with photos, and claim items with your 4-digit PIN.'}
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
              {lang === 'th' ? 'ประกาศทั้งหมด' : 'Total Posts'}
            </div>
            <div className="text-2xl font-extrabold text-[#3D322C] tabular-nums">{counts.total}</div>
          </div>
          <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFF4F6] px-4 py-3">
            <div className="text-[11px] font-bold text-[#8B1D36]">
              ❓ {lang === 'th' ? 'กำลังตามหา' : 'Lost'}
            </div>
            <div className="text-2xl font-extrabold text-[#8B1D36] tabular-nums">{counts.lost}</div>
          </div>
          <div className="rounded-2xl border border-[#F4DB73] bg-[#FFFBEB] px-4 py-3">
            <div className="text-[11px] font-bold text-[#7A5411]">
              🎁 {lang === 'th' ? 'เก็บของได้ (รอรับ)' : 'Found'}
            </div>
            <div className="text-2xl font-extrabold text-[#7A5411] tabular-nums">{counts.found}</div>
          </div>
          <div className="rounded-2xl border border-[#A5DDD3] bg-[#EFFAF7] px-4 py-3">
            <div className="text-[11px] font-bold text-[#1D5A50]">
              ✅ {lang === 'th' ? 'คืนเจ้าของแล้ว' : 'Claimed'}
            </div>
            <div className="text-2xl font-extrabold text-[#1D5A50] tabular-nums">{counts.claimed}</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Post Form */}
        <section className="lg:col-span-5 rounded-[24px] border-2 border-[#F4DB73] bg-[#FFFDF2] p-5 space-y-3.5 h-fit pastel-shadow">
          <div className="font-extrabold text-base text-[#3D322C]">
            📢 {lang === 'th' ? 'ลงประกาศใหม่' : 'Post Lost or Found'}
          </div>

          {verifiedMember ? (
            <div className="rounded-2xl border border-[#A5DDD3] bg-white px-3.5 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{verifiedMember.emoji}</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-[#1D5A50]">
                    🔓 {lang === 'th' ? 'ผู้แจ้ง' : 'Posting As'}
                  </div>
                  <div className="text-xs font-extrabold text-[#3D322C] truncate">
                    {verifiedMember.role === 'kid'
                      ? `น้อง${verifiedMember.nickname}`
                      : `${verifiedMember.nickname} (ผู้ดูแล)`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVerifiedMemberId(null);
                  setPinInput('');
                }}
                className="rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] hover:bg-[#FFF5BA] px-2.5 py-1 text-[11px] font-bold text-[#5E4E45] cursor-pointer shrink-0"
              >
                🔄 {lang === 'th' ? 'สลับคน' : 'Switch'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#F4DB73] bg-white p-3 space-y-1.5">
              <div className="text-xs font-bold text-[#7A5411]">
                🔐 {lang === 'th' ? 'ยืนยันรหัส PIN 4 หลัก (น้องหรือพี่เลี้ยง) เพื่อโพสต์' : 'Enter 4-Digit PIN to Post'}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  disabled={postPinGuard.isLocked}
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPinInput(val);
                    if (val.length === 4) {
                      verifyAnyMemberPin(val);
                    }
                  }}
                  placeholder={
                    postPinGuard.isLocked
                      ? `🔒 รอ ${postPinGuard.remainingSec}s`
                      : lang === 'th'
                      ? 'รหัส PIN 4 หลัก...'
                      : '4-digit PIN...'
                  }
                  className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-2 text-xs font-bold text-[#3D322C] focus:outline-none"
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
                  disabled={postPinGuard.isLocked}
                  onClick={() => verifyAnyMemberPin(pinInput)}
                  className="rounded-xl bg-[#7A5411] hover:bg-[#5E411D] disabled:opacity-50 text-white px-3 py-2 text-xs font-bold cursor-pointer"
                >
                  {lang === 'th' ? 'ยืนยัน' : 'OK'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitPost} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLfStatus('lost')}
                className={`rounded-xl py-2.5 px-2 text-xs font-extrabold border-2 cursor-pointer transition-colors ${
                  lfStatus === 'lost'
                    ? 'bg-[#FADADD] border-[#E66C84] text-[#6B2D39]'
                    : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                }`}
              >
                ❓ {lang === 'th' ? 'แจ้งของหาย' : 'Lost Item'}
              </button>
              <button
                type="button"
                onClick={() => setLfStatus('found')}
                className={`rounded-xl py-2.5 px-2 text-xs font-extrabold border-2 cursor-pointer transition-colors ${
                  lfStatus === 'found'
                    ? 'bg-[#D4F0F0] border-[#7CC6B8] text-[#1D5A50]'
                    : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                }`}
              >
                🎁 {lang === 'th' ? 'พบเจอของเก็บได้' : 'Found Item'}
              </button>
            </div>

            <input
              type="text"
              value={lfTitle}
              onChange={(e) => setLfTitle(e.target.value)}
              placeholder={
                lang === 'th'
                  ? 'ชื่อสิ่งของ * เช่น ขวดน้ำสีฟ้า เสื้อพละ ร่ม...'
                  : 'Item name *...'
              }
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-sm text-[#3D322C]"
            />

            <input
              type="text"
              value={lfLocation}
              onChange={(e) => setLfLocation(e.target.value)}
              placeholder={
                lfStatus === 'found'
                  ? lang === 'th'
                    ? 'บริเวณที่เก็บได้ เช่น โต๊ะทำการบ้าน โรงอาหาร...'
                    : 'Where found...'
                  : lang === 'th'
                  ? 'บริเวณที่คาดว่าทำหาย เช่น ห้องซักผ้า สนาม...'
                  : 'Where lost...'
              }
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
            />

            <textarea
              rows={2}
              value={lfDesc}
              onChange={(e) => setLfDesc(e.target.value)}
              placeholder={lang === 'th' ? 'ลักษณะ / จุดสังเกตเพิ่มเติม...' : 'Details...'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
            />

            <div className="flex flex-wrap items-center gap-2">
              <label className="rounded-xl border border-[#EBD8C3] bg-white hover:bg-[#FFF5BA]/50 px-3 py-2 text-xs font-bold text-[#3D322C] cursor-pointer">
                📷 {lang === 'th' ? 'แนบรูปภาพ (ถ้ามี)' : 'Attach Photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {lfPhotoBase64 && (
                <div className="flex items-center gap-1.5">
                  <img
                    src={lfPhotoBase64}
                    alt="Preview"
                    className="h-10 w-10 rounded-lg object-cover border border-[#EBD8C3]"
                  />
                  <button
                    type="button"
                    onClick={() => setLfPhotoBase64(undefined)}
                    className="text-xs font-bold text-[#8B1D36] cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-2xl bg-[#3D322C] hover:bg-[#2A221E] text-white text-sm font-extrabold cursor-pointer"
            >
              📢 {lfStatus === 'found' ? 'โพสต์แจ้งพบเจอของเก็บได้' : 'โพสต์แจ้งของหาย'}
            </button>
          </form>
        </section>

        {/* Right: Board Items */}
        <section className="lg:col-span-7 rounded-[24px] border-2 border-[#EBD8C3] bg-white p-5 space-y-3 pastel-shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-extrabold text-base text-[#3D322C]">
              📋 {lang === 'th' ? 'รายการกระดานของหาย / เก็บได้' : 'Lost & Found Items'} ({filteredItems.length})
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'th' ? '🔍 ค้นหาสิ่งของ / สถานที่...' : '🔍 Search items...'}
              className="rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-1.5 text-xs w-full sm:w-56"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', labelTh: 'ทั้งหมด', labelEn: 'All' },
                { id: 'lost', labelTh: '❓ ของหาย', labelEn: 'Lost' },
                { id: 'found', labelTh: '🎁 เก็บของได้', labelEn: 'Found' },
                { id: 'claimed', labelTh: '✅ คืนเจ้าของแล้ว', labelEn: 'Claimed' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setBoardFilter(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold border cursor-pointer ${
                  boardFilter === tab.id
                    ? 'bg-[#FFF5BA] border-[#E0C76B] text-[#3D322C]'
                    : 'bg-[#FFFDF9] border-[#EBD8C3] text-[#6E5C52]'
                }`}
              >
                {lang === 'th' ? tab.labelTh : tab.labelEn}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-0.5">
            {filteredItems.length === 0 ? (
              <p className="text-sm text-[#7B695F] text-center py-8">
                {lang === 'th' ? 'ยังไม่มีรายการในหมวดนี้ค่ะ' : 'No items found in this filter.'}
              </p>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {item.photoBase64 && (
                      <img
                        src={item.photoBase64}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-14 w-14 rounded-xl object-cover border border-[#EBD8C3] shrink-0"
                      />
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="font-extrabold text-sm text-[#3D322C]">
                        {item.status === 'claimed'
                          ? '✅ [คืนเจ้าของแล้ว] '
                          : item.status === 'found'
                          ? '🎁 [เก็บของได้] '
                          : '❓ [ตามหา] '}
                        {item.title}
                      </div>
                      <div className="text-[#5E4E45]">{item.description}</div>
                      <div className="text-[11px] text-[#7B695F]">
                        📍 {item.locationFound} · แจ้งโดย {item.postedByName} ·{' '}
                        {new Date(item.createdAt).toLocaleString(
                          lang === 'th' ? 'th-TH' : 'en-US',
                          { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                        )}
                      </div>
                      {item.claimedByNickname && (
                        <div className="text-xs font-extrabold text-[#1D5A50]">
                          🙋 น้อง{item.claimedByNickname} แสดงตัวรับคืนแล้ว
                        </div>
                      )}
                    </div>
                  </div>

                  {item.status !== 'claimed' && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (verifiedMember && verifiedMember.role === 'kid') {
                            onClaimLostFound(item.id, verifiedMember);
                            onShowAlert({
                              icon: '🙋🎉',
                              title: lang === 'th' ? 'แจ้งรับของคืนเรียบร้อย!' : 'Claim Recorded!',
                              message:
                                lang === 'th'
                                  ? `บันทึกชื่อน้อง${verifiedMember.nickname} ว่าเป็นเจ้าของ "${item.title}" แล้ว ติดต่อรับของที่พี่เลี้ยงได้เลยค่ะ`
                                  : `${verifiedMember.nickname} claimed "${item.title}".`,
                              tone: 'mint',
                            });
                            return;
                          }
                          setClaimPinInput('');
                          setClaimingItem(item);
                        }}
                        className="rounded-xl bg-[#D4F0F0] hover:bg-[#BDE6E6] text-[#1D5A50] px-3 py-2 text-xs font-extrabold cursor-pointer"
                      >
                        🙋 {lang === 'th' ? 'ของหนูเอง! (รับคืน)' : 'Mine!'}
                      </button>

                      {verifiedMember && verifiedMember.role !== 'kid' && (
                        <button
                          type="button"
                          onClick={() => onResolveLostFound(item.id)}
                          className="rounded-xl bg-[#FFF5BA] hover:bg-[#F5E69D] text-[#3D322C] px-3 py-2 text-xs font-extrabold cursor-pointer"
                        >
                          ✓ {lang === 'th' ? 'ส่งคืนแล้ว' : 'Resolved'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Inline Claim Modal for entering Kid 4-digit PIN */}
      {claimingItem && (
        <div className="fixed inset-0 z-50 bg-[#3D322C]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-[26px] border-2 border-[#A5DDD3] bg-[#FFFDF9] p-5 space-y-3.5 pastel-shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-[#1D5A50]">
                  🙋 {lang === 'th' ? 'ยืนยันตัวตนรับของคืน' : 'Verify Ownership'}
                </div>
                <h3 className="text-base font-extrabold text-[#3D322C] mt-0.5">
                  {claimingItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClaimingItem(null)}
                className="text-sm font-bold text-[#7B695F] hover:text-[#3D322C] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#6E5C52]">
              {lang === 'th'
                ? 'กรอกรหัส PIN 4 หลักของน้อง เพื่อบันทึกชื่อเจ้าของและนัดรับของคืนจากพี่เลี้ยงค่ะ'
                : 'Enter your 4-digit kid PIN to claim this item.'}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleClaimConfirm(claimPinInput);
              }}
              className="space-y-2.5"
            >
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                disabled={claimPinGuard.isLocked}
                value={claimPinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setClaimPinInput(val);
                  if (val.length === 4) {
                    handleClaimConfirm(val);
                  }
                }}
                placeholder={
                  claimPinGuard.isLocked
                    ? `🔒 รอ ${claimPinGuard.remainingSec}s`
                    : lang === 'th'
                    ? 'รหัส PIN น้อง 4 หลัก...'
                    : '4-digit Kid PIN...'
                }
                className="w-full rounded-xl border border-[#A5DDD3] bg-white px-3.5 py-2.5 text-sm font-bold text-[#3D322C] focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setClaimingItem(null)}
                  className="flex-1 rounded-xl border border-[#EBD8C3] bg-white py-2 text-xs font-bold text-[#5E4E45] cursor-pointer"
                >
                  {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={claimPinGuard.isLocked}
                  className="flex-1 rounded-xl bg-[#1D5A50] hover:bg-[#15453D] disabled:opacity-50 text-white py-2 text-xs font-extrabold cursor-pointer"
                >
                  {lang === 'th' ? 'ยืนยันรับคืน' : 'Confirm Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
