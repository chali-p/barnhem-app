import React, { useEffect, useRef, useState } from 'react';
import { Language, ModalAlertPayload } from '../types/barnhem';
import { KioskResult } from '../utils/expressKiosk';

interface CenteredAlertModalProps {
  alert: ModalAlertPayload | null;
  lang: Language;
  onClose: () => void;
}

const TONE_CLASSES: Record<NonNullable<ModalAlertPayload['tone']>, string> = {
  pink: 'bg-[#FFFDF9] border-[#FADADD]',
  mint: 'bg-[#FFFDF9] border-[#D4F0F0]',
  blue: 'bg-[#FFFDF9] border-[#DCEEF8]',
  yellow: 'bg-[#FFFDF9] border-[#FFF5BA]',
  lavender: 'bg-[#FFFDF9] border-[#EAE4F2]',
  peach: 'bg-[#FFFDF9] border-[#FDE2D2]',
};

const ICON_BG_CLASSES: Record<NonNullable<ModalAlertPayload['tone']>, string> = {
  pink: 'bg-[#FADADD]',
  mint: 'bg-[#D4F0F0]',
  blue: 'bg-[#DCEEF8]',
  yellow: 'bg-[#FFF5BA]',
  lavender: 'bg-[#EAE4F2]',
  peach: 'bg-[#FDE2D2]',
};

export const CenteredAlertModal: React.FC<CenteredAlertModalProps> = ({ alert, lang, onClose }) => {
  if (!alert) return null;
  const tone = alert.tone ?? 'pink';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3D322C]/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-md rounded-[32px] border-4 ${TONE_CLASSES[tone]} p-7 text-center pastel-shadow transform transition-all`}
      >
        <div
          className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${ICON_BG_CLASSES[tone]} text-4xl shadow-sm`}
        >
          {alert.icon}
        </div>
        <h3 className="text-xl font-bold text-[#3D322C] leading-snug mb-2">{alert.title}</h3>
        <p className="text-base text-[#5E4E45] leading-relaxed whitespace-pre-line mb-6">
          {alert.message}
        </p>
        <button
          type="button"
          onClick={() => {
            if (alert.onConfirm) alert.onConfirm();
            onClose();
          }}
          className="w-full min-h-[52px] rounded-[22px] bg-[#3D322C] hover:bg-[#2C231E] text-[#FFFDF9] text-lg font-semibold px-6 py-3 shadow-md transition-transform active:scale-[0.98] cursor-pointer"
        >
          {alert.confirmLabel ?? (lang === 'th' ? 'ตกลง (OK) ✓' : 'OK ✓')}
        </button>
      </div>
    </div>
  );
};

interface PinPadModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  heavyPrivacyBlur?: boolean;
  lockedRemainingSec?: number;
  lang: Language;
  onCancel: () => void;
  onSubmitPin: (pin: string) => void;
}

export const PinPadModal: React.FC<PinPadModalProps> = ({
  open,
  title,
  subtitle,
  heavyPrivacyBlur = false,
  lockedRemainingSec = 0,
  lang,
  onCancel,
  onSubmitPin,
}) => {
  const isLocked = lockedRemainingSec > 0;
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const handleDigit = (d: string) => {
    if (isLocked || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        onSubmitPin(next);
        setPin('');
      }, 120);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        heavyPrivacyBlur
          ? 'bg-[#3D322C]/75 backdrop-blur-2xl'
          : 'bg-[#3D322C]/40 backdrop-blur-sm'
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-[32px] border-4 border-[#EAE4F2] bg-[#FFFDF9] p-6 text-center pastel-shadow">
        {heavyPrivacyBlur && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#D4F0F0] px-3 py-1 text-[11px] font-bold text-[#214F4B]">
            🛡️ {lang === 'th' ? 'เบลอโปรไฟล์น้องอัตโนมัติเพื่อความเป็นส่วนตัว' : 'Profile blurred for kid privacy'}
          </div>
        )}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAE4F2] text-2xl">
          🔐
        </div>
        <h3 className="text-lg font-bold text-[#3D322C]">{title}</h3>
        {subtitle && <p className="text-sm text-[#6E5C52] mt-1">{subtitle}</p>}
        {isLocked && (
          <div className="mt-3 rounded-2xl border border-[#EE9CAF] bg-[#FFE8ED] px-3 py-2 text-xs font-bold text-[#8B1D36] tabular-nums">
            🔒 {lang === 'th' ? `ล็อกชั่วคราว รอ ${lockedRemainingSec} วินาที` : `Locked for ${lockedRemainingSec}s`}
          </div>
        )}

        <div className="my-4 flex justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-12 w-12 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold tabular-nums transition-colors ${
                pin[idx]
                  ? 'border-[#3D322C] bg-[#FFF5BA] text-[#3D322C]'
                  : 'border-[#EBD8C3] bg-white text-[#C4B2A3]'
              }`}
            >
              {pin[idx] ? '●' : '○'}
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={4}
          disabled={isLocked}
          value={pin}
          onChange={(e) => {
            if (isLocked) return;
            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
            setPin(val);
            if (val.length === 4) {
              setTimeout(() => {
                onSubmitPin(val);
                setPin('');
              }, 120);
            }
          }}
          placeholder={
            isLocked
              ? lang === 'th'
                ? `รอ ${lockedRemainingSec} วิ...`
                : `Wait ${lockedRemainingSec}s...`
              : lang === 'th'
              ? 'พิมพ์ PIN 4 หลัก'
              : 'Enter 4-digit PIN'
          }
          className="w-full mb-4 rounded-2xl border border-[#EBD8C3] bg-white px-4 py-2 text-center text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-[#FADADD] disabled:bg-[#F5ECE2]"
        />

        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isLocked}
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-2xl bg-[#FDE2D2]/60 hover:bg-[#FDE2D2] text-lg font-bold text-[#3D322C] transition-transform active:scale-95 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={isLocked}
            onClick={() => setPin('')}
            className="h-12 rounded-2xl bg-[#FADADD]/70 hover:bg-[#FADADD] text-sm font-semibold text-[#3D322C] cursor-pointer disabled:opacity-45"
          >
            {lang === 'th' ? 'ล้าง' : 'Clear'}
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => handleDigit('0')}
            className="h-12 rounded-2xl bg-[#FDE2D2]/60 hover:bg-[#FDE2D2] text-lg font-bold text-[#3D322C] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="h-12 rounded-2xl bg-[#DCEEF8]/80 hover:bg-[#DCEEF8] text-sm font-semibold text-[#3D322C] cursor-pointer disabled:opacity-45"
          >
            ⌫
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full min-h-[44px] rounded-2xl border border-[#EBD8C3] bg-white hover:bg-[#FFF5BA]/40 text-sm font-semibold text-[#6E5C52] cursor-pointer"
        >
          {lang === 'th' ? 'ยกเลิก / Cancel' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};

interface QrScannerModalProps {
  open: boolean;
  lang: Language;
  initialKioskMode?: boolean;
  onClose: () => void;
  onDetectedCode: (code: string) => void;
  onExpressKioskScan?: (code: string) => KioskResult | null;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  open,
  lang,
  initialKioskMode = false,
  onClose,
  onDetectedCode,
  onExpressKioskScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [kioskMode, setKioskMode] = useState(initialKioskMode);
  const [kioskFeedback, setKioskFeedback] = useState<KioskResult | null>(null);

  useEffect(() => {
    if (open) {
      setKioskMode(initialKioskMode);
      setKioskFeedback(null);
      setTimeout(() => manualInputRef.current?.focus(), 80);
    }
  }, [open, initialKioskMode]);

  const handleScanTrigger = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    const nowMs = Date.now();
    // Prevent duplicate rapid-fire scans of the exact same card within 1.8s
    if (lastScanRef.current.code === clean && nowMs - lastScanRef.current.at < 1800) {
      return;
    }
    lastScanRef.current = { code: clean, at: nowMs };

    if (kioskMode && onExpressKioskScan) {
      const res = onExpressKioskScan(clean);
      if (res) {
        setKioskFeedback(res);
      } else {
        setKioskFeedback({
          success: false,
          emoji: '🔍',
          starsDelta: 0,
          bannerTitle: lang === 'th' ? `ไม่พบรหัส "${clean}"` : `ID "${clean}" not found`,
          bannerSubtitle: lang === 'th' ? 'ลองสแกนบัตรใหม่อีกครั้ง' : 'Please scan card again',
        });
      }
      setManualCode('');
      manualInputRef.current?.focus();
      return;
    }

    onDetectedCode(clean);
  };

  useEffect(() => {
    if (!open) return;
    setCameraError(null);
    setManualCode('');
    let activeStream: MediaStream | null = null;
    let rafId = 0;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError(
            lang === 'th'
              ? 'อุปกรณ์นี้ไม่รองรับกล้องในเบราว์เซอร์ ใช้เครื่องยิงบาร์โค้ด USB หรือพิมพ์รหัสด้านล่างได้เลย'
              : 'Camera unavailable. Use USB barcode scanner or type ID below.'
          );
          return;
        }
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          await videoRef.current.play();
        }
        const BarcodeDetectorCtor = (window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
          };
        }).BarcodeDetector;
        if (BarcodeDetectorCtor && videoRef.current) {
          const detector = new BarcodeDetectorCtor({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
          });
          const scanLoop = async () => {
            if (!videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0 && codes[0].rawValue) {
                handleScanTrigger(codes[0].rawValue);
                if (!kioskMode) return;
              }
            } catch {
              // continue scanning
            }
            rafId = requestAnimationFrame(scanLoop);
          };
          rafId = requestAnimationFrame(scanLoop);
        }
      } catch {
        setCameraError(
          lang === 'th'
            ? 'ไม่สามารถเปิดกล้องได้ ใช้เครื่องยิงบาร์โค้ด USB หรือพิมพ์รหัสด้านล่างได้เลย'
            : 'Camera access blocked. Use USB barcode scanner or enter ID below.'
        );
      }
    }

    startCamera();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [open, lang, kioskMode]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3D322C]/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-[32px] border-4 border-[#D4F0F0] bg-[#FFFDF9] p-6 pastel-shadow space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-[#3D322C]">
            {kioskMode
              ? lang === 'th'
                ? '⚡ โหมดติ๊ดเช็คอินด่วน (Express Kiosk)'
                : '⚡ Express Kiosk Check-in'
              : lang === 'th'
              ? '📷 สแกน QR / บาร์โค้ด'
              : '📷 Scan QR / Barcode'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-full bg-[#FADADD] text-[#3D322C] font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Toggle between Personal Login vs Express Kiosk */}
        {onExpressKioskScan && (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#F4ECE4] p-1">
            <button
              type="button"
              onClick={() => {
                setKioskMode(false);
                setKioskFeedback(null);
              }}
              className={`rounded-xl py-2 text-xs font-bold cursor-pointer transition-colors ${
                !kioskMode ? 'bg-white text-[#3D322C] shadow-xs' : 'text-[#6E5C52]'
              }`}
            >
              🔑 {lang === 'th' ? 'เข้าหน้าส่วนตัว' : 'Personal Login'}
            </button>
            <button
              type="button"
              onClick={() => {
                setKioskMode(true);
                setKioskFeedback(null);
              }}
              className={`rounded-xl py-2 text-xs font-bold cursor-pointer transition-colors ${
                kioskMode ? 'bg-[#FFF5BA] text-[#3D322C] shadow-xs' : 'text-[#6E5C52]'
              }`}
            >
              ⚡ {lang === 'th' ? 'ติ๊ดเช็คอินด่วน (Kiosk)' : 'Express Kiosk Scan'}
            </button>
          </div>
        )}

        {kioskMode && (
          <div className="rounded-2xl bg-[#FFF5BA]/70 border border-[#F4DB73] p-3 text-[11px] text-[#53433A] space-y-0.5">
            <div className="font-bold text-[#3D322C]">
              {lang === 'th' ? 'ตารางติ๊ดเช็คอินอัตโนมัติ:' : 'Auto Check-in Time Windows:'}
            </div>
            <div>05:00–06:45 ➔ 🍚 กินข้าวเช้า (&lt;06:40 +5⭐) · 06:46–07:30 ➔ 🚐 รถตู้ (≤07:01 +10⭐)</div>
            <div>16:00–16:40 ➔ 🥷 กลับบ้าน + Ninja 20 นาที · 16:41–17:30 ➔ 📚 เรียนเสริม (≤16:50 +10⭐)</div>
            <div>17:31–19:30 ➔ 🧹 งานบ้าน &amp; ตากชุด (&lt;18:15 +10⭐ / ≤18:50 +3⭐)</div>
          </div>
        )}

        {/* Instant Kiosk Confirmation Banner (Non-blocking, ready for next kid immediately!) */}
        {kioskMode && kioskFeedback && (
          <div
            className={`rounded-2xl border-2 p-4 text-center transition-all ${
              kioskFeedback.success
                ? 'border-[#7CC6B8] bg-[#D4F0F0] text-[#214F4B]'
                : 'border-[#F3B7C0] bg-[#FADADD] text-[#6B2D39]'
            }`}
          >
            <div className="text-3xl mb-1">{kioskFeedback.emoji}</div>
            <div className="text-base font-bold">{kioskFeedback.bannerTitle}</div>
            <div className="text-xs opacity-90 mt-0.5">{kioskFeedback.bannerSubtitle}</div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border-2 border-[#DCEEF8] bg-[#3D322C]/5 aspect-video flex items-center justify-center">
          {cameraError ? (
            <p className="p-4 text-center text-sm text-[#6E5C52]">{cameraError}</p>
          ) : (
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScanTrigger(manualCode);
          }}
          className="flex gap-2"
        >
          <input
            ref={manualInputRef}
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={
              kioskMode
                ? lang === 'th'
                  ? 'ยิงบาร์โค้ด / พิมพ์รหัส เช่น j1 แล้วกด Enter...'
                  : 'Scan barcode or type ID (e.g. j1) + Enter...'
                : lang === 'th'
                ? 'พิมพ์รหัส PIN 4 หลัก หรือสแกน QR'
                : 'Enter 4-digit PIN or scan QR'
            }
            className="flex-1 rounded-2xl border border-[#EBD8C3] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4F0F0]"
          />
          <button
            type="submit"
            className="rounded-2xl bg-[#3D322C] text-white px-5 py-2.5 text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            {kioskMode ? (lang === 'th' ? 'ติ๊ดเช็คอิน' : 'Check-in') : lang === 'th' ? 'เข้าสู่ระบบ' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
};
