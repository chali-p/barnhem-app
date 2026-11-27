import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Language, Member, ModalAlertPayload, ReturnHomePhoto } from '../types/barnhem';
import {
  formatPinAttemptsHint,
  formatPinLockoutMessage,
  usePinGuard,
} from '../utils/pinGuard';
import {
  copyTextToClipboard,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  postTimestampPhotoToGoogleSheet,
} from '../utils/syncStorage';
import { formatDigitalClock, formatReadableDate, getDateKey } from '../utils/timeRules';

export interface TimestampActivityOption {
  id: string;
  emoji: string;
  labelTh: string;
  labelEn: string;
}

export const TIMESTAMP_ACTIVITIES: TimestampActivityOption[] = [
  { id: 'visitor_checkin', emoji: '📦', labelTh: 'บุคคลภายนอก / ติดต่อ / ส่งของ', labelEn: 'Visitor / Delivery' },
  { id: 'return_home', emoji: '🏡', labelTh: 'มาถึง / กลับถึงบ้าน', labelEn: 'Arrived Home' },
  { id: 'morning_school', emoji: '🎒', labelTh: 'ไปโรงเรียน', labelEn: 'Going to School' },
  { id: 'uniform_check', emoji: '👕', labelTh: 'ตรวจชุด / เก็บมือถือ', labelEn: 'Uniform & Phone Check' },
  { id: 'general_checkin', emoji: '📌', labelTh: 'เช็คอินทั่วไป', labelEn: 'General Check-In' },
];

interface TimestampCameraModalProps {
  open: boolean;
  kids: Member[];
  staffPins: string[];
  now: Date;
  lang: Language;
  orgName: string;
  todayPhotos: ReturnHomePhoto[];
  allPhotos?: ReturnHomePhoto[];
  returnHomeDriveUrl: string;
  syncWebhookUrl?: string;
  staffCreatorUnlocked?: boolean;
  initialTab?: 'camera' | 'gallery';
  onSavePhoto: (photo: ReturnHomePhoto) => void;
  onDeletePhoto?: (photoId: string) => void;
  onClose: () => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

export const TimestampCameraModal: React.FC<TimestampCameraModalProps> = ({
  open,
  kids,
  staffPins,
  now,
  lang,
  orgName,
  todayPhotos,
  allPhotos = todayPhotos,
  returnHomeDriveUrl,
  syncWebhookUrl,
  staffCreatorUnlocked = false,
  initialTab = 'camera',
  onSavePhoto,
  onDeletePhoto,
  onClose,
  onShowAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'gallery'>(initialTab);
  const [galleryUnlocked, setGalleryUnlocked] = useState(staffCreatorUnlocked);
  const [galleryPinInput, setGalleryPinInput] = useState('');
  const [galleryFilter, setGalleryFilter] = useState<'today' | 'all'>('today');
  const [showAppsScriptBox, setShowAppsScriptBox] = useState(false);

  const [groupFilter, setGroupFilter] = useState<0 | 1 | 2 | 3>(0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [customPersonName, setCustomPersonName] = useState('');
  const [activityId, setActivityId] = useState<string>('visitor_checkin');
  const [customNote, setCustomNote] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [mirrorPreview, setMirrorPreview] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [camLoading, setCamLoading] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [sendingSheet, setSendingSheet] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<{
    dataUrl: string;
    capturedAtIso: string;
  } | null>(null);
  const [liveTick, setLiveTick] = useState<Date>(() => new Date());
  const [lightboxPhoto, setLightboxPhoto] = useState<ReturnHomePhoto | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pinGuard = usePinGuard('timestamp_gallery_staff_only');

  const isGalleryAccessible = staffCreatorUnlocked || galleryUnlocked;

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setGalleryUnlocked(staffCreatorUnlocked);
    setGalleryPinInput('');
    setLiveTick(new Date());
    const id = window.setInterval(() => setLiveTick(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [open, initialTab, staffCreatorUnlocked]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamActive(false);
    setCamLoading(false);
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      setCamError(null);
      setCamLoading(true);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamLoading(false);
        setCamError(
          lang === 'th'
            ? 'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องสด กรุณากดปุ่ม "ถ่ายจากกล้องเครื่อง / เลือกรูป" ด้านล่างได้เลยค่ะ'
            : 'Live webcam is unavailable. Use "Device Camera / Upload" below.'
        );
        return;
      }

      try {
        stopCamera();
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        streamRef.current = stream;
        setCamActive(true);
        setCamLoading(false);
        window.setTimeout(async () => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
              await videoRef.current.play();
            } catch {
              // ignore autoplay errors
            }
          }
        }, 60);
      } catch {
        setCamLoading(false);
        setCamError(
          lang === 'th'
            ? 'ไม่สามารถเข้าถึงกล้องสดได้ กรุณากดปุ่ม "ถ่ายจากกล้องเครื่อง / เลือกรูป" ด้านล่างแทนได้ทันทีค่ะ'
            : 'Camera access blocked or unavailable. Use "Device Camera / Upload" below instead.'
        );
      }
    },
    [lang, stopCamera]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setCapturedPreview(null);
      setLightboxPhoto(null);
      setGalleryUnlocked(staffCreatorUnlocked);
      return;
    }
    if (activeTab === 'camera' && !capturedPreview) {
      void startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, activeTab, capturedPreview, facingMode, staffCreatorUnlocked, startCamera, stopCamera]);

  const filteredKids = useMemo(() => {
    return kids.filter((k) => groupFilter === 0 || k.group === groupFilter);
  }, [kids, groupFilter]);

  const selectedKid = useMemo(
    () => kids.find((k) => k.id === selectedSubjectId) ?? null,
    [kids, selectedSubjectId]
  );

  const selectedActivity = useMemo(
    () => TIMESTAMP_ACTIVITIES.find((a) => a.id === activityId) ?? TIMESTAMP_ACTIVITIES[0],
    [activityId]
  );

  const resolvedPersonName = useMemo(() => {
    const typed = customPersonName.trim();
    if (typed) return typed;
    if (selectedKid) return `${selectedKid.emoji} น้อง${selectedKid.nickname}`;
    if (selectedSubjectId === 'house_general') {
      return lang === 'th' ? '🏡 พี่เลี้ยง / ภาพรวมบ้าน' : '🏡 House / Staff';
    }
    return '';
  }, [customPersonName, selectedKid, selectedSubjectId, lang]);

  const effectiveTimestampDate = useMemo(() => {
    return now && Math.abs(now.getTime() - Date.now()) > 120_000 ? now : liveTick;
  }, [now, liveTick]);

  const burnTimestampOntoCanvas = (
    drawImageFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    srcW: number,
    srcH: number
  ) => {
    const captureMoment =
      now && Math.abs(now.getTime() - Date.now()) > 120_000 ? now : new Date();
    const targetW = Math.min(720, Math.max(320, srcW));
    const targetH = Math.max(240, Math.round((srcH / srcW) * targetW));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawImageFn(ctx, targetW, targetH);

    const timeStr = formatDigitalClock(captureMoment);
    const dateStr = captureMoment.toLocaleDateString('th-TH', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // Subtle top-right organization & live clock badge
    const topLabel = `${orgName} · ${timeStr} น.`;
    ctx.font = 'bold 12px sans-serif';
    const topMetrics = ctx.measureText(topLabel);
    const topPadX = 12;
    const topBoxW = Math.min(targetW - 24, topMetrics.width + topPadX * 2);
    ctx.fillStyle = 'rgba(20, 17, 15, 0.72)';
    ctx.fillRect(targetW - topBoxW - 12, 12, topBoxW, 26);
    ctx.fillStyle = '#FFFDF9';
    ctx.fillText(topLabel, targetW - topBoxW - 12 + topPadX, 29);

    // Bottom measured dark timestamp bar
    const barH = Math.max(76, Math.round(targetH * 0.2));
    const barTop = targetH - barH;
    const grad = ctx.createLinearGradient(0, barTop - 14, 0, targetH);
    grad.addColorStop(0, 'rgba(20, 17, 15, 0)');
    grad.addColorStop(0.2, 'rgba(20, 17, 15, 0.86)');
    grad.addColorStop(1, 'rgba(15, 12, 10, 0.94)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barTop - 14, targetW, barH + 14);

    ctx.fillStyle = '#F5C469';
    ctx.fillRect(0, barTop, targetW, 2);

    const padX = 16;
    const actText = `${selectedActivity.emoji} ${
      lang === 'th' ? selectedActivity.labelTh : selectedActivity.labelEn
    }`;
    const subjectText =
      resolvedPersonName || (lang === 'th' ? '👤 ผู้เช็คอินหน้าบ้าน' : '👤 Front Door Check-In');
    const cleanNote = customNote.trim();

    const clockFontSize = Math.max(17, Math.round(barH * 0.28));
    ctx.font = `bold ${clockFontSize}px sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${timeStr} น.  ·  ${dateStr}`, padX, barTop + Math.round(barH * 0.34));

    const subFontSize = Math.max(13, Math.round(barH * 0.21));
    ctx.font = `bold ${subFontSize}px sans-serif`;
    ctx.fillStyle = '#FDE68A';
    const row2Text = `${subjectText}  ·  ${actText}${cleanNote ? ` — ${cleanNote}` : ''}`;
    ctx.fillText(row2Text, padX, barTop + Math.round(barH * 0.64), targetW - padX * 2);

    const metaFontSize = Math.max(10, Math.round(barH * 0.14));
    ctx.font = `${metaFontSize}px sans-serif`;
    ctx.fillStyle = '#D6CCC2';
    const isoStamp = captureMoment.toISOString();
    const subjectIdTag = selectedKid
      ? selectedKid.id.toUpperCase()
      : selectedSubjectId === 'house_general'
      ? 'HOUSE'
      : 'VISITOR';
    ctx.fillText(
      `TIMESTAMP CHECK-IN · ${orgName} · ${subjectIdTag} · ${isoStamp}`,
      padX,
      barTop + Math.round(barH * 0.87),
      targetW - padX * 2
    );

    setCapturedPreview({
      dataUrl: canvas.toDataURL('image/jpeg', 0.72),
      capturedAtIso: isoStamp,
    });
    stopCamera();
  };

  const handleCaptureLiveFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      onShowAlert({
        icon: '📷',
        title: lang === 'th' ? 'กล้องยังไม่พร้อม' : 'Camera Not Ready',
        message:
          lang === 'th'
            ? 'กรุณารอสักครู่ให้ภาพกล้องแสดงขึ้น หรือใช้ปุ่มเลือกรูป/กล้องเครื่องด้านล่างค่ะ'
            : 'Please wait for video feed or use the Device Camera button below.',
        tone: 'yellow',
      });
      return;
    }

    const shouldMirror = facingMode === 'user' && mirrorPreview;
    burnTimestampOntoCanvas(
      (ctx, w, h) => {
        if (shouldMirror) {
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(video, 0, 0, w, h);
        }
      },
      video.videoWidth,
      video.videoHeight
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        burnTimestampOntoCanvas(
          (ctx, w, h) => {
            ctx.drawImage(img, 0, 0, w, h);
          },
          img.width || 720,
          img.height || 540
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAndSendToSheet = async () => {
    if (!capturedPreview) return;
    const typedName = customPersonName.trim();
    if (!typedName && !selectedKid && selectedSubjectId !== 'house_general') {
      onShowAlert({
        icon: '👤',
        title: lang === 'th' ? 'กรุณาระบุชื่อผู้เช็คอินก่อนบันทึก' : 'Enter or Select Name First',
        message:
          lang === 'th'
            ? 'พิมพ์ชื่อผู้เช็คอิน (บุคคลภายนอก) หรือแตะเลือกชื่อสมาชิกด้านบนก่อนกดบันทึกค่ะ'
            : 'Please type a name or select a member before saving.',
        tone: 'yellow',
      });
      return;
    }

    const dateKey = getDateKey(effectiveTimestampDate);
    const displayName =
      typedName ||
      (selectedKid
        ? selectedKid.nickname
        : lang === 'th'
        ? 'ภาพรวมบ้าน / พี่เลี้ยง'
        : 'House / Staff');
    const photo: ReturnHomePhoto = {
      id: `tsc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kidId: typedName
        ? 'visitor_external'
        : selectedKid
        ? selectedKid.id
        : 'house_general',
      kidNickname: displayName,
      dateKey,
      capturedAt: capturedPreview.capturedAtIso,
      imageBase64: capturedPreview.dataUrl,
      driveFolderUrl: returnHomeDriveUrl,
      activityTag: selectedActivity.id,
      activityLabel: `${selectedActivity.emoji} ${
        lang === 'th' ? selectedActivity.labelTh : selectedActivity.labelEn
      }`,
      note: customNote.trim() || undefined,
    };

    setSendingSheet(true);
    onSavePhoto(photo);
    const sentToSheet = await postTimestampPhotoToGoogleSheet(syncWebhookUrl, photo, orgName);
    setSendingSheet(false);

    setCapturedPreview(null);
    setCustomNote('');
    if (!typedName) setSelectedSubjectId('');
    setCustomPersonName('');

    const timeLabel = new Date(photo.capturedAt).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    onShowAlert({
      icon: sentToSheet ? '📸✅' : '📸💾',
      title: sentToSheet
        ? lang === 'th'
          ? 'บันทึกและส่งเข้า Google Sheet แล้ว!'
          : 'Saved & Sent to Google Sheet!'
        : lang === 'th'
        ? 'บันทึกภาพเช็คอินไทม์แสตมป์แล้ว!'
        : 'Timestamp Photo Saved!',
      message: sentToSheet
        ? `${photo.kidNickname} · ${photo.activityLabel ?? ''} · ${timeLabel} น.\n(ส่งข้อมูลเข้าแท็บ TimestampCheckIns ใน Google Sheet เรียบร้อยค่ะ)`
        : `${photo.kidNickname} · ${photo.activityLabel ?? ''} · ${timeLabel} น.\n(ยังไม่ได้ตั้งค่าลิงก์ Google Sheet Web App ในโหมดผู้สร้าง ข้อมูลจึงถูกบันทึกไว้ในระบบบ้านค่ะ)`,
      tone: 'mint',
    });
  };

  const handleUnlockGallery = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinGuard.isLocked) {
      onShowAlert({
        icon: '🔒',
        title: lang === 'th' ? 'ระบบล็อกชั่วคราว' : 'Temporarily Locked',
        message: formatPinLockoutMessage(pinGuard.remainingSec, lang),
        tone: 'pink',
      });
      return;
    }
    const clean = galleryPinInput.trim();
    if (staffPins.includes(clean)) {
      pinGuard.recordSuccess();
      setGalleryUnlocked(true);
      setGalleryPinInput('');
    } else {
      const res = pinGuard.recordFailure();
      setGalleryPinInput('');
      onShowAlert({
        icon: res.lockedNow ? '🔒' : '🔐',
        title: res.lockedNow
          ? lang === 'th'
            ? 'ล็อกชั่วคราว 30 วินาที'
            : 'Locked for 30 Seconds'
          : lang === 'th'
          ? 'เฉพาะผู้สร้างและพนักงานเท่านั้น'
          : 'Staff & Creator Only',
        message: res.lockedNow
          ? formatPinLockoutMessage(res.lockSec, lang)
          : `${
              lang === 'th'
                ? 'หน้าคลังภาพและ Google Sheet สงวนสิทธิ์เฉพาะผู้สร้างและพนักงานเท่านั้นค่ะ'
                : 'Photo logs & Google Sheet sync are restricted to Creator & Staff only.'
            }\n${formatPinAttemptsHint(res.attemptsRemaining, lang)}`,
        tone: 'pink',
      });
    }
  };

  const displayedGalleryPhotos = galleryFilter === 'today' ? todayPhotos : allPhotos;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#2E2520]/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'th' ? 'กล้องเช็คอินไทม์แสตมป์' : 'Timestamp Check-In Camera'}
    >
      <div className="w-full max-w-3xl max-h-[94dvh] flex flex-col rounded-[24px] sm:rounded-[30px] border-4 border-[#BEDBF0] bg-[#FFFDF9] p-4 sm:p-6 pastel-shadow space-y-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
          <div className="min-w-0">
            <h3 className="text-base sm:text-xl font-extrabold text-[#163B59] flex items-center gap-2">
              <span>📸</span>
              <span className="truncate">
                {lang === 'th' ? 'กล้องเช็คอินไทม์แสตมป์' : 'Timestamp Check-In Camera'}
              </span>
            </h3>
            <p className="text-xs text-[#6E5C52] mt-0.5 tabular-nums">
              {orgName} · {formatReadableDate(effectiveTimestampDate, lang)} ·{' '}
              <strong className="text-[#163B59]">{formatDigitalClock(effectiveTimestampDate)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] min-w-[42px] rounded-full bg-[#FADADD] hover:bg-[#F7C7CD] text-[#3D322C] font-bold cursor-pointer shrink-0 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Mode Tabs: Public Camera vs Staff/Creator-Only Logs & Google Sheet */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#F3ECE4] border border-[#E5DAD0]">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 min-h-[40px] rounded-xl px-3 py-1.5 text-xs sm:text-sm font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'camera'
                ? 'bg-white text-[#163B59] shadow-xs'
                : 'text-[#6E5C52] hover:text-[#3D322C]'
            }`}
          >
            📷 {lang === 'th' ? 'กล้องถ่ายเช็คอิน (บุคคลทั่วไปใช้ได้)' : 'Check-In Camera'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 min-h-[40px] rounded-xl px-3 py-1.5 text-xs sm:text-sm font-extrabold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
              activeTab === 'gallery'
                ? 'bg-white text-[#163B59] shadow-xs'
                : 'text-[#6E5C52] hover:text-[#3D322C]'
            }`}
          >
            {isGalleryAccessible ? '🖼️' : '🔐'}{' '}
            {lang === 'th'
              ? `คลังภาพ & Google Sheet (ผู้สร้าง/พนักงาน)`
              : `Logs & Google Sheet (Staff/Creator)`}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
          {activeTab === 'camera' && (
            <div className="space-y-4">
              {/* Step 1: Person Name (External Visitor Input OR Quick Select) & Activity */}
              <div className="rounded-2xl border border-[#E6DCD2] bg-white p-3.5 space-y-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-extrabold text-[#3D322C]">
                      1. {lang === 'th' ? 'ชื่อผู้เช็คอิน (พิมพ์ชื่อบุคคลภายนอก หรือเลือกสมาชิก)' : 'Check-In Person Name'}
                    </label>
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        { id: 0 as const, label: lang === 'th' ? 'ทั้งหมด' : 'All' },
                        { id: 1 as const, label: lang === 'th' ? 'เด็กเล็ก' : 'Younger' },
                        { id: 2 as const, label: lang === 'th' ? 'เด็กโต' : 'Older' },
                        { id: 3 as const, label: lang === 'th' ? 'พี่ใหญ่' : 'Senior' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGroupFilter(g.id)}
                          className={`min-h-[30px] rounded-lg px-2 py-0.5 text-[11px] font-bold cursor-pointer transition-colors ${
                            groupFilter === g.id
                              ? 'bg-[#3D322C] text-white'
                              : 'bg-[#F5EFE9] text-[#5E4E45] hover:bg-[#EAE1D8]'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={customPersonName}
                    maxLength={60}
                    onChange={(e) => {
                      setCustomPersonName(e.target.value);
                      if (e.target.value.trim()) setSelectedSubjectId('');
                    }}
                    placeholder={
                      lang === 'th'
                        ? 'พิมพ์ชื่อบุคคลภายนอก / ผู้มาติดต่อ เช่น คุณสมชาย (หรือแตะเลือกชื่อด้านล่าง)'
                        : 'Type visitor name (or select member below)...'
                    }
                    className="w-full min-h-[42px] rounded-xl border border-[#DFD2C3] bg-[#FFFDF9] px-3 py-2 text-xs sm:text-sm font-medium text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#BEDBF0]"
                  />

                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId('house_general');
                        setCustomPersonName('');
                      }}
                      className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-extrabold cursor-pointer transition-colors whitespace-nowrap ${
                        !customPersonName.trim() && selectedSubjectId === 'house_general'
                          ? 'border-[#163B59] bg-[#163B59] text-white'
                          : 'border-[#DCEEF8] bg-[#F5FAFF] hover:bg-[#E6F3FC] text-[#1E445C]'
                      }`}
                    >
                      🏡 {lang === 'th' ? 'พี่เลี้ยง / ภาพรวมบ้าน' : 'House / Staff'}
                    </button>
                    {filteredKids.map((kid) => {
                      const active = !customPersonName.trim() && selectedSubjectId === kid.id;
                      return (
                        <button
                          key={kid.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubjectId(kid.id);
                            setCustomPersonName('');
                          }}
                          className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                            active
                              ? 'border-[#163B59] bg-[#DCEEF8] text-[#163B59] font-extrabold'
                              : 'border-[#E6DCD2] bg-[#FFFDF9] hover:bg-[#FAF3EC] text-[#3D322C]'
                          }`}
                        >
                          {kid.emoji} {kid.nickname}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Activity Type & Optional Note */}
                <div className="pt-2 border-t border-[#F1EAE2] space-y-2">
                  <div className="text-xs font-extrabold text-[#3D322C]">
                    2. {lang === 'th' ? 'ประเภทการเช็คอิน & หมายเหตุ' : 'Check-In Activity & Note'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TIMESTAMP_ACTIVITIES.map((act) => {
                      const active = activityId === act.id;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => setActivityId(act.id)}
                          className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                            active
                              ? 'border-[#D97706] bg-[#FEF3C7] text-[#78350F] font-extrabold'
                              : 'border-[#E6DCD2] bg-white hover:bg-[#FAF5EF] text-[#5E4E45]'
                          }`}
                        >
                          {act.emoji} {lang === 'th' ? act.labelTh : act.labelEn}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={customNote}
                    maxLength={80}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder={
                      lang === 'th'
                        ? 'หมายเหตุเพิ่มเติม (ถ้ามี) เช่น นำของมาบริจาค / ส่งเอกสาร / กลับถึงบ้าน'
                        : 'Optional note...'
                    }
                    className="w-full min-h-[40px] rounded-xl border border-[#DFD2C3] bg-[#FFFDF9] px-3 py-2 text-xs font-medium text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#BEDBF0]"
                  />
                </div>
              </div>

              {/* Step 2: Live Viewfinder OR Captured Preview */}
              {capturedPreview ? (
                <div className="rounded-2xl border-2 border-[#8AD9CA] bg-white p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#114A42]">
                    <span>✅ {lang === 'th' ? 'ภาพเช็คอินพร้อมไทม์แสตมป์' : 'Timestamped Photo Ready'}</span>
                    <a
                      href={capturedPreview.dataUrl}
                      download={`barnhem_checkin_${getDateKey(effectiveTimestampDate)}.jpg`}
                      className="text-[#1D4ED8] hover:underline font-bold"
                    >
                      ⬇️ {lang === 'th' ? 'ดาวน์โหลด JPG' : 'Download JPG'}
                    </a>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[#E5DAD0] bg-[#181412]">
                    <img
                      src={capturedPreview.dataUrl}
                      alt="Timestamp Check-In Preview"
                      className="w-full max-h-[360px] object-contain mx-auto"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={sendingSheet}
                      onClick={() => void handleSaveAndSendToSheet()}
                      className="min-h-[48px] rounded-2xl bg-[#114A42] hover:bg-[#0B3630] disabled:opacity-60 text-white text-sm font-extrabold px-4 cursor-pointer transition-colors"
                    >
                      {sendingSheet
                        ? lang === 'th'
                          ? '⏳ กำลังบันทึก & ส่งเข้า Google Sheet...'
                          : '⏳ Saving & Sending...'
                        : lang === 'th'
                        ? '💾 บันทึก & ส่งเข้า Google Sheet'
                        : '💾 Save & Send to Google Sheet'}
                    </button>
                    <button
                      type="button"
                      disabled={sendingSheet}
                      onClick={() => setCapturedPreview(null)}
                      className="min-h-[48px] rounded-2xl border border-[#E5DAD0] bg-[#FAF5EF] hover:bg-[#F2E9DF] text-[#3D322C] text-sm font-bold px-4 cursor-pointer transition-colors"
                    >
                      🔄 {lang === 'th' ? 'ถ่ายใหม่' : 'Retake Photo'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Viewfinder Box */}
                  <div className="relative overflow-hidden rounded-2xl border-2 border-[#BEDBF0] bg-[#181412] aspect-video flex items-center justify-center">
                    {camActive ? (
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${
                          facingMode === 'user' && mirrorPreview ? 'scale-x-[-1]' : ''
                        }`}
                      />
                    ) : (
                      <div className="p-6 text-center space-y-2 text-[#E5DDD5]">
                        <div className="text-4xl">{camLoading ? '⏳' : '📷'}</div>
                        <div className="text-xs sm:text-sm font-bold">
                          {camLoading
                            ? lang === 'th'
                              ? 'กำลังเปิดกล้อง...'
                              : 'Starting camera...'
                            : camError ??
                              (lang === 'th'
                                ? 'กดปุ่มเปิดกล้องสด หรือเลือกถ่ายจากกล้องเครื่องด้านล่างค่ะ'
                                : 'Start live camera or use device camera below')}
                        </div>
                        {!camLoading && (
                          <button
                            type="button"
                            onClick={() => void startCamera(facingMode)}
                            className="mt-2 min-h-[40px] rounded-xl bg-white text-[#181412] px-4 py-1.5 text-xs font-extrabold cursor-pointer"
                          >
                            🔄 {lang === 'th' ? 'ลองเปิดกล้องสดอีกครั้ง' : 'Retry Camera'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Top Corner Tag */}
                    <div className="pointer-events-none absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[11px] font-bold text-white">
                      <span className="rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-xs truncate">
                        📍 {orgName}
                      </span>
                      <span className="rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur-xs tabular-nums shrink-0">
                        {camActive ? '🔴 LIVE · ' : ''}
                        {formatDigitalClock(effectiveTimestampDate)} น.
                      </span>
                    </div>

                    {/* Bottom Measured Scrim Timestamp Overlay */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-8 pb-3 px-4 text-white">
                      <div className="text-base sm:text-lg font-extrabold tabular-nums leading-tight">
                        ⏰ {formatDigitalClock(effectiveTimestampDate)} น. ·{' '}
                        <span className="text-xs sm:text-sm font-semibold text-[#F5EFE9]">
                          {formatReadableDate(effectiveTimestampDate, lang)}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#FDE68A] mt-0.5 truncate">
                        {resolvedPersonName ||
                          (lang === 'th' ? 'กรุณาระบุชื่อด้านบนก่อนบันทึก' : 'Enter name above')}{' '}
                        · {selectedActivity.emoji}{' '}
                        {lang === 'th' ? selectedActivity.labelTh : selectedActivity.labelEn}
                        {customNote.trim() ? ` — ${customNote.trim()}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Camera Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {camActive ? (
                      <button
                        type="button"
                        onClick={handleCaptureLiveFrame}
                        className="min-h-[50px] rounded-2xl bg-[#3D322C] hover:bg-[#261E1A] text-white text-sm sm:text-base font-extrabold px-5 flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98]"
                      >
                        <span>📸</span>
                        <span>{lang === 'th' ? 'แชะ! ถ่ายภาพประทับเวลา' : 'Capture Timestamp Photo'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="min-h-[50px] rounded-2xl bg-[#3D322C] hover:bg-[#261E1A] text-white text-sm font-extrabold px-5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <span>📷</span>
                        <span>{lang === 'th' ? 'เปิดกล้องสด' : 'Open Live Camera'}</span>
                      </button>
                    )}

                    <label className="min-h-[50px] rounded-2xl border-2 border-[#8AD9CA] bg-[#E8FAF6] hover:bg-[#D4F3EC] text-[#0F4C42] text-sm font-extrabold px-4 flex items-center justify-center gap-2 cursor-pointer text-center transition-colors">
                      <span>🖼️</span>
                      <span>
                        {lang === 'th'
                          ? 'ถ่ายจากกล้องเครื่อง / เลือกรูป'
                          : 'Device Camera / Upload Photo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {camActive && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFacingMode((prev) => {
                              const next = prev === 'user' ? 'environment' : 'user';
                              setMirrorPreview(next === 'user');
                              return next;
                            })
                          }
                          className="min-h-[36px] rounded-xl border border-[#E5DAD0] bg-white hover:bg-[#FAF5EF] px-3 py-1.5 font-bold text-[#3D322C] cursor-pointer"
                        >
                          🔄{' '}
                          {facingMode === 'user'
                            ? lang === 'th'
                              ? 'สลับเป็นกล้องหลัง'
                              : 'Switch to Back Camera'
                            : lang === 'th'
                            ? 'สลับเป็นกล้องหน้า'
                            : 'Switch to Front Camera'}
                        </button>
                        {facingMode === 'user' && (
                          <button
                            type="button"
                            onClick={() => setMirrorPreview((v) => !v)}
                            className="min-h-[36px] rounded-xl border border-[#E5DAD0] bg-white hover:bg-[#FAF5EF] px-3 py-1.5 font-bold text-[#3D322C] cursor-pointer"
                          >
                            🪞{' '}
                            {mirrorPreview
                              ? lang === 'th'
                                ? 'กลับด้านกระจก: เปิด'
                                : 'Mirror: On'
                              : lang === 'th'
                              ? 'กลับด้านกระจก: ปิด'
                              : 'Mirror: Off'}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="min-h-[36px] rounded-xl border border-[#F3B7C0] bg-[#FFF0F3] hover:bg-[#FFE0E7] px-3 py-1.5 font-bold text-[#8B1D36] cursor-pointer"
                      >
                        ⏹️ {lang === 'th' ? 'พักกล้อง' : 'Stop Camera'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            !isGalleryAccessible ? (
              <div className="rounded-2xl border-2 border-[#F3B7C0] bg-white p-6 max-w-md mx-auto space-y-4 text-center">
                <div className="text-4xl">🔐</div>
                <div>
                  <h4 className="text-base font-extrabold text-[#8B1D36]">
                    {lang === 'th'
                      ? 'สงวนสิทธิ์เฉพาะผู้สร้างและพนักงานเท่านั้น'
                      : 'Creator & Staff Only'}
                  </h4>
                  <p className="text-xs text-[#6E5C52] mt-1">
                    {lang === 'th'
                      ? 'กรอกรหัส PIN 4 หลักของพี่เลี้ยง ผู้จัดการ หรือผู้สร้าง เพื่อดูคลังภาพเช็คอินและส่งข้อมูลเข้า Google Sheet ค่ะ'
                      : 'Enter a 4-digit Staff, Manager, or Creator PIN to view check-in logs and sync to Google Sheet.'}
                  </p>
                </div>

                {pinGuard.isLocked && (
                  <div className="rounded-xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-2 text-xs font-bold text-[#8B1D36] tabular-nums">
                    🔒 {formatPinLockoutMessage(pinGuard.remainingSec, lang)}
                  </div>
                )}

                <form onSubmit={handleUnlockGallery} className="space-y-3">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    disabled={pinGuard.isLocked}
                    value={galleryPinInput}
                    onChange={(e) =>
                      setGalleryPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="••••"
                    className="w-full min-h-[48px] rounded-xl border-2 border-[#E5DAD0] bg-[#FFFDF9] px-4 text-center text-lg font-extrabold tracking-[0.45em] text-[#3D322C]"
                  />
                  <button
                    type="submit"
                    disabled={pinGuard.isLocked}
                    className="w-full min-h-[44px] rounded-xl bg-[#3D322C] hover:bg-[#261E1A] disabled:opacity-50 text-white text-sm font-extrabold cursor-pointer"
                  >
                    🔓 {lang === 'th' ? 'ปลดล็อกเข้าหน้าผู้สร้าง / พนักงาน' : 'Unlock Logs & Sheet'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Staff / Creator Google Sheet Controls */}
                <div className="rounded-2xl border border-[#8AD9CA] bg-[#F1FBF8] p-3.5 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-[#114A42]">
                        📊 {lang === 'th' ? 'การเชื่อมต่อ Google Sheet (TimestampCheckIns)' : 'Google Sheet Integration'}
                      </div>
                      <div className="text-[11px] text-[#2B5850] mt-0.5 truncate max-w-md">
                        {syncWebhookUrl?.trim()
                          ? lang === 'th'
                            ? `เชื่อมต่อลิงก์ Webhook แล้ว — ภาพใหม่ทุกภาพจะถูกส่งเข้าชีตอัตโนมัติค่ะ`
                            : 'Webhook active — new check-in photos auto-dispatch to your Google Sheet.'
                          : lang === 'th'
                          ? 'ยังไม่ได้ตั้งค่าลิงก์ Webhook (ตั้งค่าได้ที่หน้าโหมดผู้สร้าง)'
                          : 'No Google Sheet Webhook URL configured yet (set inside Creator Mode).'}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyTextToClipboard(GOOGLE_APPS_SCRIPT_TEMPLATE);
                          setShowAppsScriptBox((v) => !v);
                          onShowAlert({
                            icon: '📋',
                            title: ok
                              ? lang === 'th'
                                ? 'คัดลอกโค้ด Apps Script แล้ว!'
                                : 'Apps Script Copied!'
                              : 'Apps Script',
                            message:
                              lang === 'th'
                                ? 'นำไปวางใน Google Sheet > ส่วนขยาย > Apps Script และ Deploy เป็น Web App เพื่อให้บันทึกลงแท็บ TimestampCheckIns ได้ทันทีค่ะ'
                                : 'Paste into Google Sheet > Extensions > Apps Script and deploy as Web App.',
                            tone: 'mint',
                          });
                        }}
                        className="min-h-[34px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3 py-1 font-bold cursor-pointer"
                      >
                        📋 {lang === 'th' ? 'คัดลอกโค้ด Apps Script' : 'Copy Apps Script'}
                      </button>
                    </div>
                  </div>
                  {showAppsScriptBox && (
                    <pre className="rounded-xl bg-[#181412] text-[#F5EFE9] p-3 text-[10px] overflow-x-auto max-h-40">
                      {GOOGLE_APPS_SCRIPT_TEMPLATE}
                    </pre>
                  )}
                </div>

                {/* Filter Today vs All */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F3ECE4]">
                    <button
                      type="button"
                      onClick={() => setGalleryFilter('today')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer tabular-nums ${
                        galleryFilter === 'today'
                          ? 'bg-white text-[#163B59] shadow-2xs'
                          : 'text-[#6E5C52]'
                      }`}
                    >
                      {lang === 'th' ? `วันนี้ (${todayPhotos.length})` : `Today (${todayPhotos.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer tabular-nums ${
                        galleryFilter === 'all'
                          ? 'bg-white text-[#163B59] shadow-2xs'
                          : 'text-[#6E5C52]'
                      }`}
                    >
                      {lang === 'th' ? `ทั้งหมด (${allPhotos.length})` : `All (${allPhotos.length})`}
                    </button>
                  </div>
                </div>

                {displayedGalleryPhotos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#DFD2C3] bg-[#FAF6F0] p-8 text-center space-y-3">
                    <div className="text-4xl">📸</div>
                    <div className="text-sm font-bold text-[#3D322C]">
                      {lang === 'th'
                        ? 'ยังไม่มีภาพเช็คอินไทม์แสตมป์ในหมวดนี้ค่ะ'
                        : 'No timestamp check-in photos found.'}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {displayedGalleryPhotos.map((photo) => {
                      const timeStr = new Date(photo.capturedAt).toLocaleString('th-TH', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      return (
                        <div
                          key={photo.id}
                          className="rounded-2xl border border-[#E5DAD0] bg-white overflow-hidden flex flex-col"
                        >
                          <button
                            type="button"
                            onClick={() => setLightboxPhoto(photo)}
                            className="relative aspect-video bg-[#181412] overflow-hidden cursor-pointer group"
                          >
                            <img
                              src={photo.imageBase64}
                              alt={photo.kidNickname}
                              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                            />
                          </button>
                          <div className="p-3 space-y-2 text-xs">
                            <div className="min-w-0">
                              <div className="font-extrabold text-[#3D322C] truncate">
                                {photo.kidNickname}{' '}
                                {photo.activityLabel ? `· ${photo.activityLabel}` : ''}
                              </div>
                              <div className="text-[11px] text-[#6E5C52] tabular-nums truncate">
                                ⏰ {timeStr} น.{photo.note ? ` · ${photo.note}` : ''}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!syncWebhookUrl?.trim()) {
                                    onShowAlert({
                                      icon: '⚠️',
                                      title: lang === 'th' ? 'ยังไม่ได้ตั้งค่าลิงก์ Google Sheet' : 'No Webhook URL',
                                      message:
                                        lang === 'th'
                                          ? 'กรุณาตั้งค่าลิงก์ Web App URL ในโหมดผู้สร้างก่อนส่งค่ะ'
                                          : 'Configure Google Sheet Web App URL in Creator mode first.',
                                      tone: 'yellow',
                                    });
                                    return;
                                  }
                                  const ok = await postTimestampPhotoToGoogleSheet(
                                    syncWebhookUrl,
                                    photo,
                                    orgName
                                  );
                                  onShowAlert({
                                    icon: ok ? '📤✅' : '⚠️',
                                    title: ok
                                      ? lang === 'th'
                                        ? 'ส่งภาพเข้า Google Sheet แล้ว!'
                                        : 'Sent to Google Sheet!'
                                      : lang === 'th'
                                      ? 'ส่งไม่สำเร็จ'
                                      : 'Send Failed',
                                    message: `${photo.kidNickname} · ${timeStr}`,
                                    tone: ok ? 'mint' : 'pink',
                                  });
                                }}
                                className="min-h-[32px] rounded-lg border border-[#8AD9CA] bg-[#E8FAF6] hover:bg-[#D4F3EC] px-2.5 py-1 text-[11px] font-bold text-[#114A42] cursor-pointer"
                              >
                                📤 {lang === 'th' ? 'ส่งเข้า Sheet' : 'Send Sheet'}
                              </button>
                              <a
                                href={photo.imageBase64}
                                download={`barnhem_${photo.kidId}_${photo.dateKey}.jpg`}
                                className="min-h-[32px] rounded-lg border border-[#BEDBF0] bg-[#F5FAFF] hover:bg-[#E7F3FD] px-2.5 py-1 text-[11px] font-bold text-[#1B4A73] flex items-center"
                              >
                                ⬇️ {lang === 'th' ? 'โหลด JPG' : 'JPG'}
                              </a>
                              {onDeletePhoto && (
                                <button
                                  type="button"
                                  onClick={() => onDeletePhoto(photo.id)}
                                  title={lang === 'th' ? 'ลบภาพนี้' : 'Delete photo'}
                                  className="min-h-[32px] rounded-lg border border-[#F3B7C0] bg-[#FFF0F3] hover:bg-[#FFE0E7] px-2 text-[11px] font-bold text-[#8B1D36] cursor-pointer ml-auto"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full rounded-2xl bg-[#181412] p-3 space-y-2.5 border border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto.imageBase64}
              alt={lightboxPhoto.kidNickname}
              className="w-full max-h-[78dvh] object-contain rounded-xl"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white px-1">
              <span>
                {lightboxPhoto.kidNickname}
                {lightboxPhoto.activityLabel ? ` · ${lightboxPhoto.activityLabel}` : ''} ·{' '}
                {new Date(lightboxPhoto.capturedAt).toLocaleString('th-TH')}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxPhoto.imageBase64}
                  download={`barnhem_${lightboxPhoto.kidId}_${lightboxPhoto.dateKey}.jpg`}
                  className="rounded-xl bg-[#114A42] hover:bg-[#166055] px-3 py-1.5 font-bold text-white"
                >
                  ⬇️ {lang === 'th' ? 'ดาวน์โหลด JPG' : 'Download JPG'}
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="rounded-xl bg-white/15 hover:bg-white/25 px-3 py-1.5 font-bold text-white cursor-pointer"
                >
                  ✕ {lang === 'th' ? 'ปิด' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
