import React, { useEffect, useState } from 'react';
import {
  Announcement,
  DeedRedemption,
  KindnessCard,
  Language,
  LostFoundItem,
  Member,
  ModalAlertPayload,
  OutingTrip,
  PrivateCareMessage,
  SecretPoll,
  SickReport,
  SupplyRequest,
} from '../types/barnhem';
import { getDateKey } from '../utils/timeRules';

interface CareCommunityPanelProps {
  authorName: string;
  authorRole: string;
  members: Member[];
  announcements: Announcement[];
  polls: SecretPoll[];
  trips: OutingTrip[];
  privateMessages: PrivateCareMessage[];
  lostFoundItems: LostFoundItem[];
  supplyRequests: SupplyRequest[];
  kindnessCards?: KindnessCard[];
  deedRedemptions: DeedRedemption[];
  sickReports?: SickReport[];
  lang: Language;
  onAddAnnouncement: (ann: Announcement) => void;
  onTogglePinAnnouncement: (annId: string) => void;
  onDeleteAnnouncement: (annId: string) => void;
  onCreatePoll: (poll: SecretPoll) => void;
  onToggleClosePoll: (pollId: string) => void;
  onDeletePoll: (pollId: string) => void;
  onCreateTrip: (trip: OutingTrip) => void;
  onDeleteTrip: (tripId: string) => void;
  onReplyPrivateMessage: (msgId: string, replyText: string, staffName: string) => void;
  onMarkMessageRead: (msgId: string) => void;
  onAddLostFound: (item: LostFoundItem) => void;
  onResolveLostFound: (itemId: string) => void;
  onDeleteLostFound: (itemId: string) => void;
  onUpdateSupplyStatus: (reqId: string, status: 'approved' | 'delivered', staffName: string) => void;
  onAssignDeedRedemption: (deed: DeedRedemption) => void;
  onApproveDeedRedemption: (deedId: string) => void;
  onAddSickReport?: (report: SickReport) => void;
  onResolveSick?: (reportId: string) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  requestedTab?: {
    tab: 'polls' | 'trips' | 'inbox' | 'lost_found' | 'supplies' | 'deeds' | 'sick';
    seq: number;
  } | null;
}

export const CareCommunityPanel: React.FC<CareCommunityPanelProps> = ({
  authorName,
  authorRole,
  members,
  polls,
  trips,
  privateMessages,
  lostFoundItems,
  supplyRequests,
  deedRedemptions,
  sickReports = [],
  lang,
  onCreatePoll,
  onToggleClosePoll,
  onDeletePoll,
  onCreateTrip,
  onDeleteTrip,
  onReplyPrivateMessage,
  onMarkMessageRead,
  onAddLostFound,
  onResolveLostFound,
  onDeleteLostFound,
  onUpdateSupplyStatus,
  onAssignDeedRedemption,
  onApproveDeedRedemption,
  onAddSickReport,
  onResolveSick,
  onShowAlert,
  collapsed = false,
  onToggleCollapse,
  requestedTab = null,
}) => {
  const [tab, setTab] = useState<
    'polls' | 'trips' | 'inbox' | 'lost_found' | 'supplies' | 'deeds' | 'sick'
  >('polls');

  useEffect(() => {
    if (requestedTab?.tab) {
      setTab(requestedTab.tab);
    }
  }, [requestedTab]);

  // Secret Poll form state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsInput, setPollOptionsInput] = useState<string[]>(['', '', '']);

  // Trip form state
  const [tripTitle, setTripTitle] = useState('');
  const [tripLocation, setTripLocation] = useState('');
  const [tripDateText, setTripDateText] = useState('');
  const [tripChaperone, setTripChaperone] = useState('ทีมพี่เลี้ยง');
  const [tripDetails, setTripDetails] = useState('');

  // Lost & Found form state
  const [lfTitle, setLfTitle] = useState('');
  const [lfLocation, setLfLocation] = useState('');
  const [lfDesc, setLfDesc] = useState('');
  const [lfStatus, setLfStatus] = useState<'found' | 'lost'>('found');
  const [lfPhotoBase64, setLfPhotoBase64] = useState<string | undefined>(undefined);

  // Good-Deed Redemption form state
  const [deedKidId, setDeedKidId] = useState('');
  const [deedTitle, setDeedTitle] = useState('ช่วยจัดระเบียบห้องสมุดและชั้นหนังสือ');
  const [deedReduction, setDeedReduction] = useState(20);
  const [deedStars, setDeedStars] = useState(5);

  // Illness report form state
  const [sickKidId, setSickKidId] = useState('');
  const [sickSymptoms, setSickSymptoms] = useState('มีไข้ / ตัวร้อน');
  const [sickDetails, setSickDetails] = useState('');

  // Reply drafts per private message
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const kids = members.filter((m) => m.role === 'kid');
  const unreadInboxCount = privateMessages.filter((m) => !m.readByStaff).length;
  const unclaimedLostCount = lostFoundItems.filter((i) => i.status !== 'claimed').length;
  const pendingSupplyCount = supplyRequests.filter((s) => s.status === 'pending').length;
  const pendingDeedCount = deedRedemptions.filter((d) => d.status !== 'approved').length;
  const activeSickReports = sickReports.filter((r) => !r.resolved);

  const handlePublishPoll = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pollOptionsInput.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleaned.length < 2) {
      onShowAlert({
        icon: '🗳️',
        title: lang === 'th' ? 'กรุณาใส่คำถามและตัวเลือกอย่างน้อย 2 ข้อ' : 'Need Question & 2+ Options',
        message: lang === 'th' ? 'ระบุหัวข้อโหวตและตัวเลือกให้น้องกดอย่างน้อย 2 ข้อ' : 'Provide question and at least 2 options.',
        tone: 'yellow',
      });
      return;
    }
    onCreatePoll({
      id: `poll_${Date.now()}`,
      question: pollQuestion.trim(),
      options: cleaned.map((label, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        label,
        votes: 0,
      })),
      votedKidIds: [],
      closed: false,
      authorName,
      createdAt: new Date().toISOString(),
    });
    setPollQuestion('');
    setPollOptionsInput(['', '', '']);
    onShowAlert({
      icon: '🗳️🔒',
      title: lang === 'th' ? 'เปิดหัวข้อโหวตลับแล้ว!' : 'Secret Poll Created!',
      message: lang === 'th' ? 'น้องทุกคนสามารถกดโหวตได้โดยไม่แสดงชื่อผู้โหวต' : 'Kids can now vote anonymously.',
      tone: 'mint',
    });
  };

  const handlePublishTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripTitle.trim() || !tripLocation.trim()) {
      onShowAlert({
        icon: '🗺️',
        title: lang === 'th' ? 'กรุณากรอกชื่อกิจกรรมและสถานที่' : 'Incomplete Outing Info',
        message: lang === 'th' ? 'ใส่ชื่อทริปและสถานที่ให้น้องดูให้ครบก่อนนะ' : 'Provide trip name and location.',
        tone: 'yellow',
      });
      return;
    }
    onCreateTrip({
      id: `trip_${Date.now()}`,
      title: tripTitle.trim(),
      location: tripLocation.trim(),
      dateText: tripDateText.trim() || (lang === 'th' ? 'เร็วๆ นี้' : 'Upcoming'),
      chaperone: tripChaperone.trim() || authorName,
      details: tripDetails.trim() || '-',
      attendeeIds: [],
      createdAt: new Date().toISOString(),
      authorName,
    });
    setTripTitle('');
    setTripLocation('');
    setTripDateText('');
    setTripDetails('');
    onShowAlert({
      icon: '🗺️🎒',
      title: lang === 'th' ? 'เพิ่มกิจกรรมสถานที่เที่ยวแล้ว!' : 'Outing Added!',
      message: lang === 'th' ? 'น้องๆ สามารถกดดูรายชื่อคนไปและลงชื่อหรือทักหลังไมค์ได้แล้ว' : 'Kids can RSVP and message caretakers.',
      tone: 'mint',
    });
  };

  return (
    <section className="no-print rounded-[28px] border-2 border-[#EAE4F2] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#3D322C]">
            💬 {lang === 'th' ? 'โหวตลับ · ทริปเที่ยว · ของหาย & กล่องหลังไมค์น้องๆ' : 'Secret Polls · Trips · Lost & Found & Private Inbox'}
          </h3>
          <p className="text-xs text-[#6E5C52]">
            {lang === 'th'
              ? 'สื่อสารและดูแลน้องๆ อย่างปลอดภัย: โหวตไม่ระบุชื่อ ทริปเที่ยว ของหาย ขอเบิกของ และข้อความหลังไมค์เฉพาะผู้ดูแล'
              : 'Safe communication hub: secret-ballot voting, outings, lost & found, supplies, and private kid inbox.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!collapsed && (
            <div className="flex flex-wrap gap-1.5 rounded-2xl bg-[#F4ECE4] p-1">
              {[
                { id: 'polls', labelTh: `🗳️ โหวตลับ (${polls.length})`, labelEn: `🗳️ Polls (${polls.length})` },
                { id: 'trips', labelTh: `🗺️ ทริปเที่ยว (${trips.length})`, labelEn: `🗺️ Outings (${trips.length})` },
                {
                  id: 'inbox',
                  labelTh: `💌 หลังไมค์${unreadInboxCount > 0 ? ` (${unreadInboxCount} ใหม่)` : ` (${privateMessages.length})`}`,
                  labelEn: `💌 Inbox${unreadInboxCount > 0 ? ` (${unreadInboxCount} new)` : ''}`,
                },
                { id: 'lost_found', labelTh: `🔎 ของหาย (${unclaimedLostCount})`, labelEn: `🔎 Lost & Found (${unclaimedLostCount})` },
                { id: 'supplies', labelTh: `📦 ขอเบิกของ (${pendingSupplyCount})`, labelEn: `📦 Supplies (${pendingSupplyCount})` },
                { id: 'deeds', labelTh: `⚖️ ไถ่ค่าปรับ (${pendingDeedCount})`, labelEn: `⚖️ Fine Deeds (${pendingDeedCount})` },
                { id: 'sick', labelTh: `🤒 แจ้งเจ็บป่วย (${activeSickReports.length})`, labelEn: `🤒 Illness (${activeSickReports.length})` },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as typeof tab)}
                  className={`min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    tab === item.id
                      ? 'bg-white text-[#3D322C] shadow-xs'
                      : 'text-[#6E5C52] hover:text-[#3D322C]'
                  }`}
                >
                  {lang === 'th' ? item.labelTh : item.labelEn}
                </button>
              ))}
            </div>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap border ${
                collapsed
                  ? 'bg-[#EAE4F2] hover:bg-[#DDD3EA] border-[#C8B7EB] text-[#3E2B63]'
                  : 'bg-[#F7F1EB] hover:bg-[#EDE2D7] border-[#E2D4C5] text-[#5C4B42]'
              }`}
            >
              {collapsed
                ? lang === 'th'
                  ? '👁️ แสดง ▾'
                  : '👁️ Show ▾'
                : lang === 'th'
                ? '🙈 ซ่อน ▴'
                : '🙈 Hide ▴'}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>

      {/* TAB 2: SECRET BALLOT POLLS */}
      {tab === 'polls' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handlePublishPoll} className="lg:col-span-5 rounded-2xl bg-[#FFFDF9] border border-[#EBD8C3] p-4 space-y-2.5 text-sm">
            <div className="font-bold text-[#3D322C]">
              🗳️ {lang === 'th' ? 'สร้างหัวข้อโหวตลับ (ไม่ระบุตัวตนผู้โหวต)' : 'Create Secret-Ballot Poll'}
            </div>
            <p className="text-xs text-[#2F685E]">
              🔒 {lang === 'th' ? 'ระบบเก็บเฉพาะยอดคะแนนรวม ไม่มีใครสามารถดูได้ว่าน้องคนไหนเลือกข้อไหน' : 'Strictly anonymous: stores aggregate option counts only.'}
            </p>
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder={lang === 'th' ? 'คำถามโหวต เช่น อยากไปเที่ยวที่ไหน?' : 'Poll question...'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
            />
            {pollOptionsInput.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                value={opt}
                onChange={(e) =>
                  setPollOptionsInput((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                }
                placeholder={`${lang === 'th' ? 'ตัวเลือกที่' : 'Option'} ${idx + 1}`}
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
              />
            ))}
            {pollOptionsInput.length < 5 && (
              <button
                type="button"
                onClick={() => setPollOptionsInput((prev) => [...prev, ''])}
                className="rounded-xl bg-[#DCEEF8] px-3 py-1.5 text-xs font-bold text-[#28445A] cursor-pointer"
              >
                + {lang === 'th' ? 'เพิ่มตัวเลือก' : 'Add Option'}
              </button>
            )}
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white font-bold cursor-pointer"
            >
              🗳️ {lang === 'th' ? 'เปิดโหวตให้น้องทุกคน' : 'Launch Secret Poll'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3 max-h-80 overflow-y-auto">
            {polls.map((poll) => {
              const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
              return (
                <div key={poll.id} className="rounded-2xl border border-[#DCEEF8] bg-white p-4 space-y-2 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#3D322C]">{poll.question}</div>
                      <div className="text-[11px] text-[#7B695F] tabular-nums">
                        {lang === 'th' ? `ผู้ร่วมโหวตทั้งหมด ${poll.votedKidIds.length} คน · ปิดรับ: ${poll.closed ? 'ปิดแล้ว' : 'เปิดอยู่'}` : `${poll.votedKidIds.length} voted · ${poll.closed ? 'Closed' : 'Open'}`}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleClosePoll(poll.id)}
                        className="rounded-lg bg-[#FFF5BA] px-2.5 py-1 text-xs font-bold text-[#3D322C] cursor-pointer"
                      >
                        {poll.closed ? (lang === 'th' ? 'เปิดใหม่' : 'Reopen') : lang === 'th' ? 'ปิดโหวต' : 'Close'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePoll(poll.id)}
                        className="rounded-lg bg-[#FADADD] px-2.5 py-1 text-xs font-bold text-[#7B2E3B] cursor-pointer"
                      >
                        {lang === 'th' ? 'ลบ' : 'Del'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {poll.options.map((opt) => {
                      const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                      return (
                        <div key={opt.id} className="space-y-0.5 text-xs">
                          <div className="flex justify-between font-semibold text-[#3D322C]">
                            <span>{opt.label}</span>
                            <span className="tabular-nums">{opt.votes} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#F4ECE4] overflow-hidden">
                            <div className="h-full rounded-full bg-[#7CC6B8]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: TRIPS & OUTINGS */}
      {tab === 'trips' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handlePublishTrip} className="lg:col-span-5 rounded-2xl bg-[#FFFDF9] border border-[#EBD8C3] p-4 space-y-2.5 text-sm">
            <div className="font-bold text-[#3D322C]">
              🗺️ {lang === 'th' ? 'สร้างกิจกรรมสถานที่เที่ยวใหม่' : 'Create New Outing / Trip'}
            </div>
            <input
              type="text"
              value={tripTitle}
              onChange={(e) => setTripTitle(e.target.value)}
              placeholder={lang === 'th' ? 'ชื่อทริป เช่น เที่ยวสวนสัตว์ / ค่ายศิลปะ' : 'Trip title'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
            />
            <input
              type="text"
              value={tripLocation}
              onChange={(e) => setTripLocation(e.target.value)}
              placeholder={lang === 'th' ? 'สถานที่ปลายทาง' : 'Destination'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={tripDateText}
                onChange={(e) => setTripDateText(e.target.value)}
                placeholder={lang === 'th' ? 'วัน/เวลา เช่น เสาร์ 09:00' : 'Date & time'}
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={tripChaperone}
                onChange={(e) => setTripChaperone(e.target.value)}
                placeholder={lang === 'th' ? 'พี่เลี้ยงที่ไปด้วย' : 'Staff chaperones'}
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
              />
            </div>
            <textarea
              rows={2}
              value={tripDetails}
              onChange={(e) => setTripDetails(e.target.value)}
              placeholder={lang === 'th' ? 'สิ่งที่ต้องเตรียม / หมายเหตุเพิ่มเติม...' : 'Details & things to pack...'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white font-bold cursor-pointer"
            >
              🚌 {lang === 'th' ? 'เพิ่มกิจกรรมสถานที่เที่ยว' : 'Add Outing'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3 max-h-80 overflow-y-auto">
            {trips.map((trip) => {
              const goingKids = kids.filter((k) => trip.attendeeIds.includes(k.id));
              return (
                <div key={trip.id} className="rounded-2xl border border-[#B2E0DC] bg-white p-4 space-y-2 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#3D322C]">🗺️ {trip.title}</div>
                      <div className="text-xs text-[#6E5C52]">
                        📍 {trip.location} · 🗓️ {trip.dateText} · 👩‍🏫 {trip.chaperone}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteTrip(trip.id)}
                      className="rounded-lg bg-[#FADADD] px-2.5 py-1 text-xs font-bold text-[#7B2E3B] cursor-pointer"
                    >
                      {lang === 'th' ? 'ลบ' : 'Del'}
                    </button>
                  </div>
                  <p className="text-xs text-[#5E4E45]">{trip.details}</p>
                  <div className="rounded-xl bg-[#D4F0F0]/55 p-2.5 text-xs text-[#214F4B]">
                    <span className="font-bold">
                      🙋 {lang === 'th' ? `รายชื่อน้องที่ลงชื่อไป (${goingKids.length} คน): ` : `Attending (${goingKids.length}): `}
                    </span>
                    {goingKids.length === 0
                      ? lang === 'th'
                        ? 'ยังไม่มีผู้ลงชื่อ'
                        : 'None yet'
                      : goingKids.map((k) => `${k.emoji} ${k.nickname}`).join(', ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CONFIDENTIAL BACKCHANNEL INBOX */}
      {tab === 'inbox' && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {privateMessages.length === 0 ? (
            <p className="text-sm text-[#7B695F]">
              {lang === 'th'
                ? 'ยังไม่มีข้อความหลังไมค์จากน้องๆ ในตอนนี้'
                : 'No private messages from kids yet.'}
            </p>
          ) : (
            privateMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-2xl border p-4 space-y-2 text-sm ${
                  msg.readByStaff ? 'border-[#EBD8C3] bg-white' : 'border-[#F3B7C0] bg-[#FADADD]/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-[#3D322C]">
                    💌 {lang === 'th' ? `จากน้อง${msg.kidNickname} (${msg.kidId})` : `From ${msg.kidNickname}`}
                    {msg.tripTitle ? ` · 🗺️ ${msg.tripTitle}` : ''}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#7B695F]">
                    <span>{new Date(msg.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}</span>
                    {!msg.readByStaff && (
                      <button
                        type="button"
                        onClick={() => onMarkMessageRead(msg.id)}
                        className="rounded-lg bg-[#D4F0F0] px-2.5 py-1 font-bold text-[#214F4B] cursor-pointer"
                      >
                        {lang === 'th' ? 'รับทราบแล้ว' : 'Mark Read'}
                      </button>
                    )}
                  </div>
                </div>

                <p className="rounded-xl bg-[#FFFDF9] border border-[#F0E3D7] p-3 text-sm text-[#3D322C] whitespace-pre-line">
                  {msg.message}
                </p>

                {msg.staffReply && (
                  <div className="rounded-xl bg-[#D4F0F0]/55 p-2.5 text-xs text-[#214F4B]">
                    <span className="font-bold">↩️ {msg.staffReplyBy}: </span>
                    {msg.staffReply}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyDrafts[msg.id] ?? ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                    }
                    placeholder={
                      lang === 'th'
                        ? `พิมพ์ตอบกลับส่วนตัวถึงน้อง${msg.kidNickname}...`
                        : `Reply privately to ${msg.kidNickname}...`
                    }
                    className="flex-1 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const text = (replyDrafts[msg.id] ?? '').trim();
                      if (!text) return;
                      onReplyPrivateMessage(msg.id, text, authorName);
                      setReplyDrafts((prev) => ({ ...prev, [msg.id]: '' }));
                      onShowAlert({
                        icon: '💌',
                        title: lang === 'th' ? 'ส่งข้อความตอบกลับส่วนตัวแล้ว' : 'Private Reply Sent',
                        message: lang === 'th' ? `น้อง${msg.kidNickname} จะเห็นข้อความตอบกลับในหน้าโปรไฟล์ส่วนตัว` : `Sent to ${msg.kidNickname}'s private inbox.`,
                        tone: 'mint',
                      });
                    }}
                    className="rounded-xl bg-[#3D322C] text-white px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    {lang === 'th' ? 'ตอบหลังไมค์' : 'Reply'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 5: LOST & FOUND */}
      {tab === 'lost_found' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!lfTitle.trim()) return;
              onAddLostFound({
                id: `lf_${Date.now()}`,
                title: lfTitle.trim(),
                description: lfDesc.trim() || '-',
                locationFound: lfLocation.trim() || 'พื้นที่ส่วนกลาง',
                status: lfStatus,
                photoBase64: lfPhotoBase64,
                postedByName: authorName,
                postedByRole: authorRole,
                createdAt: new Date().toISOString(),
              });
              setLfTitle('');
              setLfDesc('');
              setLfLocation('');
              setLfPhotoBase64(undefined);
              onShowAlert({
                icon: '🔎',
                title: lang === 'th' ? 'ลงประกาศของหาย/เก็บได้แล้ว!' : 'Lost & Found Posted!',
                message: lang === 'th' ? 'น้องทุกคนสามารถเข้ามาดูและกดรับคืนในโปรไฟล์ได้ทันที' : 'Visible to all kids now.',
                tone: 'mint',
              });
            }}
            className="lg:col-span-5 rounded-2xl bg-[#FFFDF9] border border-[#EBD8C3] p-4 space-y-2.5 text-sm"
          >
            <div className="font-bold text-[#3D322C]">
              🔎 {lang === 'th' ? 'ลงประกาศแจ้งของหาย / เก็บของได้' : 'Post Lost or Found Item'}
            </div>
            <select
              value={lfStatus}
              onChange={(e) => setLfStatus(e.target.value as 'found' | 'lost')}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs font-bold"
            >
              <option value="found">🎁 เก็บของได้ในบ้าน (รอเจ้าของมารับ)</option>
              <option value="lost">❓ ประกาศตามหาของหาย</option>
            </select>
            <input
              type="text"
              value={lfTitle}
              onChange={(e) => setLfTitle(e.target.value)}
              placeholder={lang === 'th' ? 'สิ่งของ เช่น กระติกน้ำ / เสื้อกันหนาว' : 'Item title'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2"
            />
            <input
              type="text"
              value={lfLocation}
              onChange={(e) => setLfLocation(e.target.value)}
              placeholder={lang === 'th' ? 'จุดที่พบ / สถานที่' : 'Location found'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
            />
            <textarea
              rows={2}
              value={lfDesc}
              onChange={(e) => setLfDesc(e.target.value)}
              placeholder={lang === 'th' ? 'ลักษณะเพิ่มเติม...' : 'Details...'}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
            />
            <div className="text-xs">
              <label className="font-bold text-[#6E5C52] block mb-1">
                📷 {lang === 'th' ? 'แนบรูปภาพ (ถ้ามี)' : 'Attach Photo (Optional)'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
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
                  reader.readAsDataURL(f);
                }}
                className="w-full text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer"
            >
              📢 {lang === 'th' ? 'ลงบอร์ดของหาย / เก็บได้' : 'Post Item'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-2.5 max-h-80 overflow-y-auto">
            {lostFoundItems.length === 0 ? (
              <p className="text-sm text-[#7B695F]">{lang === 'th' ? 'ยังไม่มีรายการของหาย' : 'No items posted.'}</p>
            ) : (
              lostFoundItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#EBD8C3] bg-white p-3.5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.photoBase64 && (
                      <img src={item.photoBase64} alt={item.title} referrerPolicy="no-referrer" className="h-14 w-14 rounded-xl object-cover shrink-0 border border-[#EBD8C3]" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-[#3D322C] truncate">
                        {item.status === 'claimed' ? '✅ ' : item.status === 'lost' ? '❓ ' : '🎁 '}
                        {item.title}
                      </div>
                      <div className="text-xs text-[#6E5C52]">
                        📍 {item.locationFound} · {item.description}
                      </div>
                      {item.claimedByNickname && (
                        <div className="text-xs font-bold text-[#2F685E]">
                          🙋 น้อง{item.claimedByNickname} แสดงตัวรับคืนแล้ว
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {item.status !== 'claimed' && (
                      <button
                        type="button"
                        onClick={() => onResolveLostFound(item.id)}
                        className="rounded-xl bg-[#D4F0F0] px-3 py-1.5 text-xs font-bold text-[#214F4B] cursor-pointer"
                      >
                        {lang === 'th' ? 'ส่งคืนแล้ว ✓' : 'Resolved ✓'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteLostFound(item.id)}
                      className="rounded-xl bg-[#FADADD] px-2.5 py-1.5 text-xs font-bold text-[#7B2E3B] cursor-pointer"
                    >
                      {lang === 'th' ? 'ลบ' : 'Del'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: SUPPLY & STUDY ESSENTIALS REQUESTS */}
      {tab === 'supplies' && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {supplyRequests.length === 0 ? (
            <p className="text-sm text-[#7B695F]">
              {lang === 'th' ? 'ยังไม่มีคำขอเบิกของใช้จำเป็นหรืออุปกรณ์การเรียนจากน้องๆ' : 'No supply requests yet.'}
            </p>
          ) : (
            supplyRequests.map((req) => (
              <div key={req.id} className="rounded-2xl border border-[#DCEEF8] bg-white p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-bold text-[#3D322C]">
                    {req.urgency === 'urgent' ? '🚨 ' : '📦 '}
                    น้อง{req.kidNickname} ขอเบิก: {req.itemName}
                  </div>
                  <div className="text-xs text-[#6E5C52]">
                    หมวด: {req.category} · หมายเหตุ: {req.note || '-'} · สถานะ:{' '}
                    <span className="font-bold">
                      {req.status === 'delivered' ? 'ส่งมอบแล้ว ✓' : req.status === 'approved' ? 'อนุมัติแล้ว รอจัดส่ง' : 'รอดำเนินการ'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {req.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => onUpdateSupplyStatus(req.id, 'approved', authorName)}
                      className="rounded-xl bg-[#FFF5BA] px-3 py-1.5 text-xs font-bold text-[#3D322C] cursor-pointer"
                    >
                      👍 {lang === 'th' ? 'อนุมัติจัดซื้อ' : 'Approve'}
                    </button>
                  )}
                  {req.status !== 'delivered' && (
                    <button
                      type="button"
                      onClick={() => onUpdateSupplyStatus(req.id, 'delivered', authorName)}
                      className="rounded-xl bg-[#D4F0F0] px-3 py-1.5 text-xs font-bold text-[#214F4B] cursor-pointer"
                    >
                      ✅ {lang === 'th' ? 'ส่งมอบให้น้องแล้ว' : 'Delivered'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 7: GOOD-DEED FINE REDEMPTION */}
      {tab === 'deeds' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const target = kids.find((k) => k.id === deedKidId);
              if (!target || !deedTitle.trim()) {
                onShowAlert({
                  icon: '⚖️',
                  title: lang === 'th' ? 'กรุณาเลือกชื่อน้องและภารกิจความดี' : 'Select Kid & Good Deed',
                  message: lang === 'th' ? 'เลือกน้องและระบุกิจกรรมไถ่ค่าปรับ' : 'Choose a kid and deed description.',
                  tone: 'yellow',
                });
                return;
              }
              onAssignDeedRedemption({
                id: `deed_${Date.now()}`,
                kidId: target.id,
                kidNickname: target.nickname,
                deedTitle: deedTitle.trim(),
                fineReductionThb: Math.max(5, Number(deedReduction) || 20),
                starsBonus: Math.max(0, Number(deedStars) || 0),
                status: 'assigned',
                assignedBy: authorName,
                createdAt: new Date().toISOString(),
              });
              onShowAlert({
                icon: '⚖️💛',
                title: lang === 'th' ? 'มอบภารกิจไถ่ค่าปรับแล้ว!' : 'Good-Deed Task Assigned!',
                message: `น้อง${target.nickname}: ${deedTitle.trim()} (ลดค่าปรับ ฿${deedReduction})`,
                tone: 'mint',
              });
            }}
            className="lg:col-span-5 rounded-2xl bg-[#FFFDF9] border border-[#EBD8C3] p-4 space-y-2.5 text-sm"
          >
            <div className="font-bold text-[#3D322C]">
              ⚖️ {lang === 'th' ? 'มอบภารกิจ "ไถ่ค่าปรับด้วยความดี"' : 'Assign Good-Deed Fine Redemption'}
            </div>
            <select
              value={deedKidId}
              onChange={(e) => setDeedKidId(e.target.value)}
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs font-bold"
            >
              <option value="">-- เลือกน้อง (แสดงยอดค่าปรับปัจจุบัน) --</option>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.emoji} {k.nickname} (ค่าปรับปัจจุบัน ฿{k.penalty.lateFineThb})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={deedTitle}
              onChange={(e) => setDeedTitle(e.target.value)}
              placeholder="ภารกิจความดี เช่น ช่วยจัดห้องสมุด"
              className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-[#6E5C52]">ลดค่าปรับ (บาท)</label>
                <input
                  type="number"
                  min={5}
                  value={deedReduction}
                  onChange={(e) => setDeedReduction(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#6E5C52]">ดาวโบนัส (+⭐)</label>
                <input
                  type="number"
                  min={0}
                  value={deedStars}
                  onChange={(e) => setDeedStars(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-2xl bg-[#3D322C] text-white font-bold cursor-pointer"
            >
              ✨ {lang === 'th' ? 'ส่งภารกิจความดีให้น้อง' : 'Assign Good Deed'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-2.5 max-h-80 overflow-y-auto">
            {deedRedemptions.length === 0 ? (
              <p className="text-sm text-[#7B695F]">{lang === 'th' ? 'ยังไม่มีรายการไถ่ค่าปรับด้วยความดี' : 'No good-deed redemptions yet.'}</p>
            ) : (
              deedRedemptions.map((deed) => (
                <div key={deed.id} className="rounded-2xl border border-[#EBD8C3] bg-white p-3.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-bold text-[#3D322C]">
                      น้อง{deed.kidNickname} — {deed.deedTitle}
                    </div>
                    <div className="text-xs text-[#2F685E] font-semibold">
                      ลดค่าปรับ ฿{deed.fineReductionThb} {deed.starsBonus > 0 ? `+ ${deed.starsBonus} ⭐` : ''} · สถานะ:{' '}
                      {deed.status === 'approved'
                        ? 'อนุมัติลดค่าปรับแล้ว ✓'
                        : deed.status === 'kid_submitted'
                        ? 'น้องกดส่งงานแล้ว รอตรวจ!'
                        : 'กำลังทำภารกิจ'}
                    </div>
                  </div>
                  {deed.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => {
                        onApproveDeedRedemption(deed.id);
                        onShowAlert({
                          icon: '💚⚖️',
                          title: lang === 'th' ? 'อนุมัติไถ่ค่าปรับสำเร็จ!' : 'Good Deed Approved!',
                          message: `ลดค่าปรับให้น้อง${deed.kidNickname} ฿${deed.fineReductionThb} เรียบร้อยแล้ว`,
                          tone: 'mint',
                        });
                      }}
                      className="rounded-xl bg-[#D4F0F0] hover:bg-[#B8E5E1] px-3.5 py-2 text-xs font-bold text-[#214F4B] cursor-pointer"
                    >
                      ✅ {lang === 'th' ? 'ตรวจผ่าน & ลดค่าปรับ' : 'Approve & Reduce Fine'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 8: ILLNESS REPORTS */}
      {tab === 'sick' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {onAddSickReport && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = kids.find((k) => k.id === sickKidId);
                if (!target) {
                  onShowAlert({
                    icon: '🤒',
                    title: lang === 'th' ? 'กรุณาเลือกชื่อน้อง' : 'Select a Kid',
                    message:
                      lang === 'th'
                        ? 'เลือกชื่อน้องที่เจ็บป่วยหรือต้องการแจ้งอาการก่อนบันทึกค่ะ'
                        : 'Please select the kid before submitting.',
                    tone: 'yellow',
                  });
                  return;
                }
                const nowDate = new Date();
                onAddSickReport({
                  id: `sick_${Date.now()}`,
                  kidId: target.id,
                  kidNickname: target.nickname,
                  dateKey: getDateKey(nowDate),
                  reportedAt: nowDate.toISOString(),
                  symptoms: sickSymptoms,
                  details: sickDetails.trim() || '-',
                  resolved: false,
                });
                setSickDetails('');
                onShowAlert({
                  icon: '🤒💚',
                  title: lang === 'th' ? 'บันทึกแจ้งเจ็บป่วยเรียบร้อย!' : 'Illness Report Saved!',
                  message:
                    lang === 'th'
                      ? `บันทึกอาการของน้อง${target.nickname} (${sickSymptoms}) และยกเว้นค่าปรับสายวันนี้เรียบร้อยค่ะ`
                      : `Recorded illness for ${target.nickname} (${sickSymptoms}).`,
                  tone: 'mint',
                });
              }}
              className="lg:col-span-5 rounded-2xl bg-[#FFFDF9] border border-[#F3B7C0] p-4 space-y-2.5 text-sm"
            >
              <div className="font-bold text-[#8B1D36]">
                🤒 {lang === 'th' ? 'บันทึกแจ้งเจ็บป่วย / ไม่สบาย' : 'Report Kid Illness'}
              </div>
              <select
                value={sickKidId}
                onChange={(e) => setSickKidId(e.target.value)}
                className="w-full rounded-xl border border-[#F3B7C0] bg-white px-3 py-2 text-xs font-bold text-[#3D322C]"
              >
                <option value="">-- เลือกชื่อน้อง --</option>
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.emoji} {k.nickname} (กลุ่ม {k.group})
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1.5">
                {['มีไข้ / ตัวร้อน', 'ปวดหัว / เวียนหัว', 'ปวดท้อง', 'เจ็บคอ / ไอ', 'ปวดเมื่อย / บาดเจ็บ'].map(
                  (sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setSickSymptoms(sym)}
                      className={`rounded-xl px-2.5 py-1 text-xs font-semibold border cursor-pointer ${
                        sickSymptoms === sym
                          ? 'bg-[#FADADD] border-[#E66C84] text-[#702D22]'
                          : 'bg-white border-[#EBD8C3] text-[#6E5C52]'
                      }`}
                    >
                      {sym}
                    </button>
                  )
                )}
              </div>
              <textarea
                rows={2}
                value={sickDetails}
                onChange={(e) => setSickDetails(e.target.value)}
                placeholder={lang === 'th' ? 'รายละเอียดอาการเพิ่มเติม หรือยาที่ให้รับประทาน...' : 'Symptom details...'}
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="w-full min-h-[42px] rounded-2xl bg-[#8B1D36] hover:bg-[#6E1529] text-white font-bold cursor-pointer"
              >
                🚑 {lang === 'th' ? 'บันทึกแจ้งอาการเจ็บป่วย' : 'Submit Illness Report'}
              </button>
            </form>
          )}

          <div className={`${onAddSickReport ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-2.5 max-h-80 overflow-y-auto`}>
            {sickReports.length === 0 ? (
              <p className="text-sm text-[#7B695F]">
                {lang === 'th' ? 'ยังไม่มีรายการแจ้งเจ็บป่วยในตอนนี้ค่ะ 💚' : 'No illness reports right now.'}
              </p>
            ) : (
              sickReports.slice(0, 20).map((rep) => (
                <div
                  key={rep.id}
                  className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-2 text-sm ${
                    rep.resolved
                      ? 'border-[#E6DCD2] bg-[#FAF6F1] opacity-80'
                      : 'border-[#F3B7C0] bg-[#FFF5F7]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#3D322C]">
                      {rep.resolved ? '✅' : '🤒'} น้อง{rep.kidNickname} — {rep.symptoms}
                    </div>
                    <div className="text-xs text-[#5E4E45]">{rep.details}</div>
                    <div className="text-[11px] text-[#7B695F] tabular-nums mt-0.5">
                      {new Date(rep.reportedAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                      {rep.resolved ? ' · หายป่วยแล้ว' : ' · กำลังดูแล'}
                    </div>
                  </div>
                  {!rep.resolved && onResolveSick && (
                    <button
                      type="button"
                      onClick={() => {
                        onResolveSick(rep.id);
                        onShowAlert({
                          icon: '💚',
                          title: lang === 'th' ? 'ปิดเคสอาการป่วยแล้ว' : 'Sick Case Closed',
                          message: `${rep.kidNickname} ${lang === 'th' ? 'หายป่วยเรียบร้อยแล้ว!' : 'recovered!'}`,
                          tone: 'mint',
                        });
                      }}
                      className="rounded-xl bg-[#D4F0F0] hover:bg-[#B8E5E1] px-3.5 py-2 text-xs font-bold text-[#214F4B] cursor-pointer whitespace-nowrap"
                    >
                      ✅ {lang === 'th' ? 'หายป่วยแล้ว' : 'Recovered'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
        </>
      )}
    </section>
  );
};
