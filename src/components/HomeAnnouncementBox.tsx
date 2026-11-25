import React, { useMemo, useState } from 'react';
import {
  Announcement,
  Language,
  ModalAlertPayload,
} from '../types/barnhem';
import { compressImageFileToDataUrl } from '../utils/imageUpload';

interface HomeAnnouncementBoxProps {
  announcements: Announcement[];
  showOnHome: boolean;
  lang: Language;
  now: Date;
  variant: 'home' | 'creator';
  defaultAuthorName?: string;
  defaultAuthorRole?: string;
  onAddAnnouncement: (ann: Announcement) => void;
  onUpdateAnnouncement: (annId: string, updates: Partial<Announcement>) => void;
  onTogglePinAnnouncement: (annId: string) => void;
  onDeleteAnnouncement: (annId: string) => void;
  onToggleShowOnHome?: (nextShow: boolean) => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

export const HomeAnnouncementBox: React.FC<HomeAnnouncementBoxProps> = ({
  announcements,
  showOnHome,
  lang,
  now,
  variant,
  defaultAuthorName = 'ผู้สร้าง (Creator)',
  defaultAuthorRole = 'Creator',
  onAddAnnouncement,
  onUpdateAnnouncement,
  onTogglePinAnnouncement,
  onDeleteAnnouncement,
  onToggleShowOnHome,
  onShowAlert,
}) => {
  const isCreatorPanel = variant === 'creator';

  // Filter out internal staff-only tasks; show only Creator/public announcements
  const publicAnnouncements = useMemo(() => {
    return [...announcements]
      .filter((a) => a.audience !== 'staff_only')
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [announcements]);

  // Creator form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState<'normal' | 'urgent'>('normal');
  const [pinnedDraft, setPinnedDraft] = useState(false);
  const [imageDraft, setImageDraft] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitleDraft('');
    setBodyDraft('');
    setPriorityDraft('normal');
    setPinnedDraft(false);
    setImageDraft(undefined);
  };

  const loadAnnouncementIntoForm = (ann: Announcement) => {
    setEditingId(ann.id);
    setTitleDraft(ann.title);
    setBodyDraft(ann.body);
    setPriorityDraft(ann.priority);
    setPinnedDraft(ann.pinned);
    setImageDraft(ann.imageBase64);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 720, 0.76);
      setImageDraft(dataUrl);
    } catch {
      onShowAlert({
        icon: '🖼️',
        title: lang === 'th' ? 'อัปโหลดรูปภาพไม่สำเร็จ' : 'Image Upload Failed',
        message:
          lang === 'th'
            ? 'กรุณาลองเลือกรูปภาพไฟล์ JPG / PNG อีกครั้งค่ะ'
            : 'Please select a valid JPG or PNG image.',
        tone: 'pink',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = titleDraft.trim();
    const cleanBody = bodyDraft.trim();
    if (!cleanTitle && !cleanBody && !imageDraft) {
      onShowAlert({
        icon: '📢',
        title: lang === 'th' ? 'กรุณาใส่ข้อความหรือรูปภาพ' : 'Content Required',
        message:
          lang === 'th'
            ? 'กรุณาพิมพ์หัวข้อ ข้อความ หรือแนบรูปภาพอย่างน้อย 1 อย่างก่อนบันทึกค่ะ'
            : 'Please enter a title, message, or attach an image.',
        tone: 'yellow',
      });
      return;
    }

    const finalTitle =
      cleanTitle || (lang === 'th' ? 'ประกาศจากผู้สร้าง' : 'Creator Announcement');
    const finalBody = cleanBody;

    if (editingId) {
      onUpdateAnnouncement(editingId, {
        title: finalTitle,
        body: finalBody,
        priority: priorityDraft,
        pinned: pinnedDraft,
        imageBase64: imageDraft,
        updatedAt: now.toISOString(),
      });
      resetForm();
      onShowAlert({
        icon: '✏️✅',
        title: lang === 'th' ? 'แก้ไขประกาศเรียบร้อยแล้ว!' : 'Announcement Updated!',
        message: finalTitle,
        tone: 'mint',
      });
      return;
    }

    onAddAnnouncement({
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      title: finalTitle,
      body: finalBody,
      ...(imageDraft ? { imageBase64: imageDraft } : {}),
      priority: priorityDraft,
      pinned: pinnedDraft,
      authorName: defaultAuthorName,
      authorRole: defaultAuthorRole,
      createdAt: now.toISOString(),
      audience: 'all',
    });
    resetForm();
    onShowAlert({
      icon: '📢✨',
      title: lang === 'th' ? 'ลงประกาศเรียบร้อยแล้ว!' : 'Announcement Published!',
      message: showOnHome
        ? lang === 'th'
          ? 'ประกาศถูกส่งไปแสดงบนหน้าแรกอัตโนมัติแล้วค่ะ'
          : 'Automatically displayed on the Home screen.'
        : lang === 'th'
        ? 'บันทึกประกาศแล้ว (ตอนนี้ตั้งค่าหยุดโชว์หน้าแรกอยู่ สามารถกดอนุญาตให้โชว์ได้ด้านบนค่ะ)'
        : 'Saved (Home display is currently stopped by Creator).',
      tone: 'mint',
    });
  };

  // On Home screen: stay hidden unless Creator allows showing AND at least 1 announcement exists
  if (!isCreatorPanel) {
    if (!showOnHome || publicAnnouncements.length === 0) {
      return null;
    }

    return (
      <>
        <section
          className="rounded-[24px] border-2 bg-white px-4 py-4 sm:px-5 sm:py-4 pastel-shadow space-y-3"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-extrabold text-[#3D322C]">
                📢 {lang === 'th' ? 'ประกาศจากผู้สร้าง' : 'Creator Announcements'}
              </span>
              <span className="rounded-full bg-[#FADADD]/75 px-2.5 py-0.5 text-[11px] font-extrabold text-[#7B2E3B] tabular-nums">
                {publicAnnouncements.length}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {publicAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className={`rounded-2xl border p-3.5 sm:p-4 space-y-2 ${
                  ann.priority === 'urgent'
                    ? 'border-[#F3B7C0] bg-[#FFF4F6]'
                    : ann.pinned
                    ? 'border-[#F0D568] bg-[#FFFDF0]'
                    : 'border-[#EFE2D5] bg-[#FFFCF9]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-[#3D322C]">
                  {ann.pinned && (
                    <span className="rounded-md bg-[#FFF5BA] border border-[#ECCD62] px-1.5 py-0.5 text-[10px] font-extrabold text-[#6E4F05]">
                      📌 {lang === 'th' ? 'ปักหมุด' : 'Pinned'}
                    </span>
                  )}
                  {ann.priority === 'urgent' && (
                    <span className="rounded-md bg-[#FFE2E8] border border-[#EE9CAF] px-1.5 py-0.5 text-[10px] font-extrabold text-[#8B1D36]">
                      🚨 {lang === 'th' ? 'ด่วน' : 'Urgent'}
                    </span>
                  )}
                  <span className="break-words">{ann.title}</span>
                </div>

                {ann.body && (
                  <p className="text-xs sm:text-sm text-[#4E3F38] whitespace-pre-line leading-relaxed">
                    {ann.body}
                  </p>
                )}

                {ann.imageBase64 && (
                  <div>
                    <img
                      src={ann.imageBase64}
                      alt={ann.title}
                      referrerPolicy="no-referrer"
                      onClick={() => setLightboxImage({ src: ann.imageBase64!, title: ann.title })}
                      className="max-h-80 w-auto rounded-2xl border border-[#EBD8C3] object-contain bg-white cursor-pointer hover:opacity-95 transition-opacity"
                    />
                  </div>
                )}

                <div className="text-[11px] text-[#7B695F]">
                  {ann.authorName} ·{' '}
                  {new Date(ann.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                  {ann.updatedAt
                    ? ` · ${lang === 'th' ? 'แก้ไขล่าสุด' : 'Edited'} ${new Date(
                        ann.updatedAt
                      ).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}`
                    : ''}
                </div>
              </div>
            ))}
          </div>
        </section>

        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
            onClick={() => setLightboxImage(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="max-w-3xl max-h-[90dvh] rounded-3xl bg-white p-3 space-y-2 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-sm font-extrabold text-[#3D322C] truncate">
                  {lightboxImage.title}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="h-8 w-8 rounded-full bg-[#FADADD] text-[#3D322C] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[76dvh] w-auto mx-auto rounded-2xl object-contain"
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // CREATOR VIEW PANEL: All add/edit/image/show-stop controls live here
  return (
    <section className="no-print rounded-[28px] border-2 border-[#E6B8D0] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-[#5E2843]">
            📢{' '}
            {lang === 'th'
              ? 'ประกาศผู้สร้าง (เด้งแสดงหน้าแรกอัตโนมัติ · เพิ่มรูปภาพ & แก้ไขข้อความ)'
              : 'Creator Announcements (Auto-Pop to Home · Photos & Editable Text)'}
          </h3>
          <p className="text-xs text-[#6E5C52] mt-0.5">
            {lang === 'th'
              ? 'หากมีประกาศอยู่ที่นี่และเปิดอนุญาตไว้ ประกาศจะถูกเด้งไปแสดงที่หน้าแรกทันที และผู้สร้างสามารถสั่งหยุดโชว์หรืออนุญาตให้โชว์ได้ตลอดเวลาค่ะ'
              : 'When announcements exist and Home display is allowed, they automatically appear on the Home screen.'}
          </p>
        </div>
      </div>

      {/* Creator Show / Stop Permission Bar */}
      {onToggleShowOnHome && (
        <div
          className={`rounded-2xl border-2 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
            showOnHome
              ? 'border-[#8AD1BA] bg-[#E8FAF3]'
              : 'border-[#F3B7C0] bg-[#FFF1F4]'
          }`}
        >
          <div className="space-y-0.5 text-xs">
            <div className="font-extrabold text-[#3D322C]">
              {showOnHome
                ? lang === 'th'
                  ? '🟢 สิทธิ์ผู้สร้าง: อนุญาตให้โชว์ประกาศที่หน้าแรกอยู่ (เมื่อมีประกาศจะเด้งหน้าแรกทันที)'
                  : '🟢 Creator Permission: Allowed to show on Home when announcements exist'
                : lang === 'th'
                ? '⏸️ สิทธิ์ผู้สร้าง: หยุดโชว์ประกาศหน้าแรกชั่วคราว'
                : '⏸️ Creator Permission: Stopped / Hidden on Home'}
            </div>
            <p className="text-[11px] text-[#6B5749]">
              {showOnHome
                ? lang === 'th'
                  ? `ตอนนี้มี ${publicAnnouncements.length} ประกาศ${
                      publicAnnouncements.length > 0
                        ? ' — กำลังแสดงบนหน้าแรกแล้วค่ะ'
                        : ' — หน้าแรกจะซ่อนไว้จนกว่าผู้สร้างจะเพิ่มประกาศ'
                    }`
                  : `${publicAnnouncements.length} announcement(s) — ${
                      publicAnnouncements.length > 0
                        ? 'currently displayed on the Home screen.'
                        : 'Home screen stays clean until an announcement is added.'
                    }`
                : lang === 'th'
                ? 'ซ่อนประกาศจากหน้าแรกชั่วคราว โดยข้อความและรูปภาพทั้งหมดยังคงถูกเก็บไว้ที่นี่ค่ะ'
                : 'Hidden from Home screen while announcements remain saved here.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleShowOnHome(!showOnHome)}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-colors cursor-pointer shrink-0 ${
              showOnHome
                ? 'bg-[#8B1D36] hover:bg-[#6E162A] text-white'
                : 'bg-[#1F6F58] hover:bg-[#175745] text-white'
            }`}
          >
            {showOnHome
              ? lang === 'th'
                ? '⏸️ หยุดโชว์หน้าแรก'
                : '⏸️ Stop Showing on Home'
              : lang === 'th'
              ? '🟢 อนุญาตให้โชว์หน้าแรก'
              : '🟢 Allow Showing on Home'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <form
          onSubmit={handleSaveAnnouncement}
          className="lg:col-span-5 rounded-2xl border border-[#EADBC8] bg-[#FFFDF9] p-4 space-y-3 text-xs sm:text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-extrabold text-[#3D322C]">
              {editingId
                ? lang === 'th'
                  ? '✏️ แก้ไขประกาศ & รูปภาพ'
                  : '✏️ Edit Announcement'
                : lang === 'th'
                ? '✍️ สร้างประกาศใหม่ (ข้อความ & รูปภาพ)'
                : '✍️ Create Announcement (Text & Photo)'}
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-[#E5D7C6] bg-white hover:bg-[#FAF5EF] px-2.5 py-1 text-xs font-bold text-[#6E5C52] cursor-pointer"
              >
                {lang === 'th' ? 'ยกเลิกการแก้ไข' : 'Cancel Edit'}
              </button>
            )}
          </div>

          <input
            type="text"
            maxLength={140}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder={
              lang === 'th'
                ? 'หัวข้อประกาศ (เช่น แจ้งข่าวสาร / กิจกรรมบ้าน)...'
                : 'Announcement title...'
            }
            className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2 text-sm font-bold text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#F3B7C0]"
          />

          <textarea
            rows={3}
            maxLength={2000}
            value={bodyDraft}
            onChange={(e) => setBodyDraft(e.target.value)}
            placeholder={
              lang === 'th'
                ? 'รายละเอียดข้อความประกาศ (แก้ไขได้ทุกเมื่อ)...'
                : 'Announcement message details...'
            }
            className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#F3B7C0]"
          />

          <div className="rounded-2xl border border-dashed border-[#D6BFA8] bg-[#FAF6F0]/70 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-[#5E4E45]">
                🖼️ {lang === 'th' ? 'รูปภาพประกอบประกาศ (ไม่บังคับ)' : 'Announcement Photo (Optional)'}
              </label>
              {imageDraft && (
                <button
                  type="button"
                  onClick={() => setImageDraft(undefined)}
                  className="rounded-lg border border-[#F3B7C0] bg-white hover:bg-[#FFF0F3] px-2.5 py-1 text-[11px] font-bold text-[#8B1D36] cursor-pointer"
                >
                  🗑️ {lang === 'th' ? 'ลบรูปภาพ' : 'Remove Photo'}
                </button>
              )}
            </div>

            <label className="inline-flex items-center gap-2 rounded-xl border border-[#D4C3AE] bg-white hover:bg-[#FFF8EF] px-3 py-2 text-xs font-bold text-[#3D322C] cursor-pointer">
              <span>📷</span>
              <span>
                {uploadingImage
                  ? lang === 'th'
                    ? 'กำลังย่อขนาดรูปภาพ...'
                    : 'Processing image...'
                  : imageDraft
                  ? lang === 'th'
                    ? 'เปลี่ยนรูปภาพใหม่'
                    : 'Change Image'
                  : lang === 'th'
                  ? 'เลือกรูปภาพจากเครื่อง'
                  : 'Upload Image'}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingImage}
                onChange={handleImageFileChange}
                className="hidden"
              />
            </label>

            {imageDraft && (
              <div className="pt-1">
                <img
                  src={imageDraft}
                  alt={titleDraft || 'Announcement preview'}
                  referrerPolicy="no-referrer"
                  className="max-h-48 w-auto rounded-xl border border-[#EBD8C3] object-contain bg-white"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={priorityDraft}
                onChange={(e) => setPriorityDraft(e.target.value as 'normal' | 'urgent')}
                className="rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs font-bold text-[#3D322C]"
              >
                <option value="normal">{lang === 'th' ? '📢 ประกาศทั่วไป' : '📢 Normal'}</option>
                <option value="urgent">{lang === 'th' ? '🚨 ประกาศด่วน' : '🚨 Urgent'}</option>
              </select>

              <label className="inline-flex items-center gap-1.5 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs font-bold text-[#3D322C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinnedDraft}
                  onChange={(e) => setPinnedDraft(e.target.checked)}
                  className="h-4 w-4 accent-[#3D322C]"
                />
                <span>📌 {lang === 'th' ? 'ปักหมุดด้านบน' : 'Pin to Top'}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={uploadingImage}
              className="min-h-[40px] rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-5 py-2 text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-50"
            >
              {editingId
                ? lang === 'th'
                  ? '💾 บันทึกการแก้ไข'
                  : '💾 Save Changes'
                : lang === 'th'
                ? '📢 ลงประกาศ'
                : '📢 Publish'}
            </button>
          </div>
        </form>

        <div className="lg:col-span-7 space-y-2.5">
          <div className="text-xs font-extrabold text-[#5E4E45]">
            📋{' '}
            {lang === 'th'
              ? `รายการประกาศจากผู้สร้าง (${publicAnnouncements.length})`
              : `Creator Announcements (${publicAnnouncements.length})`}
          </div>
          {publicAnnouncements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#DFD2C3] bg-white p-6 text-center text-xs text-[#7B695F]">
              {lang === 'th'
                ? 'ยังไม่มีประกาศจากผู้สร้าง — เมื่อเพิ่มประกาศที่นี่ ระบบจะเด้งไปแสดงที่หน้าแรกให้อัตโนมัติค่ะ'
                : 'No announcements yet. Published announcements automatically show on Home.'}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-0.5">
              {publicAnnouncements.map((ann) => {
                const isEditingThis = editingId === ann.id;
                return (
                  <div
                    key={ann.id}
                    className={`rounded-2xl border p-3.5 space-y-2 text-xs ${
                      isEditingThis
                        ? 'border-[#3D322C] bg-[#FFF9ED] ring-2 ring-[#F4DB73]'
                        : ann.priority === 'urgent'
                        ? 'border-[#F3B7C0] bg-[#FFF3F6]'
                        : 'border-[#EBD8C3] bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 font-extrabold text-sm text-[#3D322C]">
                          {ann.pinned && <span>📌</span>}
                          <span>{ann.priority === 'urgent' ? '🚨' : '📢'}</span>
                          <span className="break-words">{ann.title}</span>
                        </div>
                        <div className="text-[11px] text-[#7B695F]">
                          {ann.authorName} ·{' '}
                          {new Date(ann.createdAt).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                          {ann.updatedAt
                            ? ` · (${lang === 'th' ? 'แก้ไขแล้ว' : 'Edited'})`
                            : ''}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => loadAnnouncementIntoForm(ann)}
                          className="rounded-xl border border-[#C8B7EB] bg-[#F5F0FF] hover:bg-[#EAE1FA] px-2.5 py-1 text-[11px] font-bold text-[#3E2B63] cursor-pointer"
                        >
                          ✏️ {lang === 'th' ? 'แก้ไข' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onTogglePinAnnouncement(ann.id)}
                          className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                            ann.pinned
                              ? 'border-[#E6C87A] bg-[#FFF5BA] text-[#5A4208]'
                              : 'border-[#E5D7C6] bg-[#FAF6F0] text-[#5E4E45]'
                          }`}
                        >
                          {ann.pinned
                            ? lang === 'th'
                              ? '📌 เลิกปักหมุด'
                              : 'Unpin'
                            : lang === 'th'
                            ? '📌 ปักหมุด'
                            : 'Pin'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingId === ann.id) resetForm();
                            onDeleteAnnouncement(ann.id);
                          }}
                          className="rounded-xl border border-[#F3C5CE] bg-[#FFF0F3] hover:bg-[#FADADD] px-2.5 py-1 text-[11px] font-bold text-[#8B1D36] cursor-pointer"
                        >
                          🗑️ {lang === 'th' ? 'ลบ' : 'Del'}
                        </button>
                      </div>
                    </div>

                    {ann.body && (
                      <p className="text-xs text-[#4E3F38] whitespace-pre-line leading-relaxed">
                        {ann.body}
                      </p>
                    )}

                    {ann.imageBase64 && (
                      <img
                        src={ann.imageBase64}
                        alt={ann.title}
                        referrerPolicy="no-referrer"
                        onClick={() => setLightboxImage({ src: ann.imageBase64!, title: ann.title })}
                        className="max-h-48 w-auto rounded-xl border border-[#EBD8C3] object-contain bg-[#FAF6F0] cursor-pointer hover:opacity-95"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-3xl max-h-[90dvh] rounded-3xl bg-white p-3 space-y-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-sm font-extrabold text-[#3D322C] truncate">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="h-8 w-8 rounded-full bg-[#FADADD] text-[#3D322C] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.title}
              referrerPolicy="no-referrer"
              className="max-h-[76dvh] w-auto mx-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
};
