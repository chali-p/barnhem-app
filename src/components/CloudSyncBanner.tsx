import { User } from 'firebase/auth';
import React, { useState } from 'react';
import { signInWithGoogleCloud, signOutCloud } from '../firebase';
import { AppState, Language, ModalAlertPayload } from '../types/barnhem';
import { buildExecutiveLineDigest } from '../utils/houseChores';

interface CloudSyncBannerProps {
  cloudUser: User | null;
  cloudSyncing: boolean;
  state: AppState;
  now: Date;
  lang: Language;
  onForceSeedCloud: () => Promise<void>;
  onShowAlert: (payload: ModalAlertPayload) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const CloudSyncBanner: React.FC<CloudSyncBannerProps> = ({
  cloudUser,
  cloudSyncing,
  state,
  now,
  lang,
  onForceSeedCloud,
  onShowAlert,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [authBusy, setAuthBusy] = useState(false);

  const copyExecutiveDigest = async () => {
    const text = buildExecutiveLineDigest(state, now, lang);
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      document.body.removeChild(textarea);
    }

    onShowAlert({
      icon: '📊📋',
      title: copied
        ? lang === 'th'
          ? 'คัดลอกสรุปรายงานส่ง LINE ผู้บริหารแล้ว!'
          : 'Executive LINE Digest Copied!'
        : lang === 'th'
        ? 'สรุปรายงานประจำวันพร้อมส่ง'
        : 'Daily Executive Digest Ready',
      message: text,
      tone: 'blue',
    });
  };

  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    try {
      await signInWithGoogleCloud();
      onShowAlert({
        icon: '☁️✨',
        title:
          lang === 'th'
            ? 'เชื่อมต่อซิงค์ออนไลน์สำเร็จ!'
            : 'Cloud Real-time Sync Connected!',
        message:
          lang === 'th'
            ? 'ข้อมูลระหว่างเครื่อง Kiosk แท็บเล็ต มือถือพี่เลี้ยง และคอมพิวเตอร์ผู้จัดการจะอัปเดตตรงกันแบบเรียลไทม์แล้วค่ะ'
            : 'Real-time database sync is now active across all connected devices.',
        tone: 'mint',
      });
    } catch (err) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'เชื่อมต่อคลาวด์ไม่สำเร็จ' : 'Cloud Sign-In Failed',
        message: err instanceof Error ? err.message : String(err),
        tone: 'pink',
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const useOwnStorage = Boolean(state.settings.useOwnStorageOnly);

  return (
    <div className="no-print rounded-[28px] border-2 border-[#DCEEF8] bg-[#FFFDF9] p-4 flex flex-wrap items-center justify-between gap-3 pastel-shadow">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center text-xl ${
            useOwnStorage ? 'bg-[#E8FAF6]' : cloudUser ? 'bg-[#D4F0F0]' : 'bg-[#FFF5BA]'
          }`}
        >
          {useOwnStorage ? '💾' : cloudUser ? '☁️' : '📲'}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#3D322C] truncate">
            {useOwnStorage
              ? lang === 'th'
                ? 'โหมดเก็บข้อมูลองค์กรเอง (ไม่ใช้พื้นที่คลาวด์กลาง 0 KB)'
                : 'Own Organization Storage Mode (0 KB Central Cloud)'
              : cloudUser
              ? lang === 'th'
                ? `ซิงค์ออนไลน์เรียลไทม์ทำงานอยู่ (${cloudUser.email})`
                : `Live Cloud Sync Active (${cloudUser.email})`
              : lang === 'th'
              ? 'โหมดเก็บข้อมูลในเครื่อง (กดเชื่อมต่อ Google เพื่อซิงค์ข้ามหลายเครื่อง)'
              : 'Local Device Storage (Sign in with Google for Multi-Device Real-Time Sync)'}
          </div>
          <div className="text-xs text-[#6E5C52]">
            {useOwnStorage
              ? state.settings.syncWebhookUrl?.trim()
                ? lang === 'th'
                  ? 'บันทึกบนเครื่องนี้ + ส่งข้อมูลอัตโนมัติไปยัง Google Sheet ขององค์กรคุณเอง'
                  : 'Stored locally + auto-synced to your organization Google Sheet'
                : lang === 'th'
                ? 'บันทึกบนเครื่องนี้ 100% (ตั้งค่าลิงก์ Google Sheet ด้านบนเพื่อสำรองข้อมูลอัตโนมัติ)'
                : 'Stored 100% locally (add your Google Sheet URL above for external backup)'
              : cloudSyncing
              ? lang === 'th'
                ? 'กำลังอัปเดตข้อมูลกับฐานข้อมูลคลาวด์...'
                : 'Syncing with cloud database...'
              : cloudUser
              ? lang === 'th'
                ? 'ซิงค์ข้ามเครื่องแบบเรียลไทม์ (ระบบตัดประวัติบนคลาวด์เกิน 7-14 วันอัตโนมัติเพื่อประหยัดพื้นที่ฟรี)'
                : 'Real-time multi-device sync (cloud logs auto-trimmed to recent 7-14 days)'
              : lang === 'th'
              ? 'แนะนำให้ล็อกอินบัญชีผู้ดูแลบนเครื่อง Kiosk และมือถือผู้ดูแล'
              : 'Sign in on Kiosk tablets & staff phones to share live state'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!collapsed && (
          <>
            <button
              type="button"
              onClick={() => void copyExecutiveDigest()}
              className="min-h-[42px] rounded-2xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#F4DB73] px-4 py-2 text-xs font-bold text-[#3D322C] cursor-pointer whitespace-nowrap"
            >
              📋 {lang === 'th' ? 'คัดลอกสรุปรายงานส่ง LINE ผู้บริหาร' : 'Copy LINE Executive Digest'}
            </button>

            {!cloudUser ? (
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleGoogleLogin()}
                className="min-h-[42px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {authBusy
                  ? lang === 'th'
                    ? 'กำลังเชื่อมต่อ...'
                    : 'Connecting...'
                  : lang === 'th'
                  ? '☁️ เชื่อมต่อ Google Sync ข้ามเครื่อง'
                  : '☁️ Connect Google Cloud Sync'}
              </button>
            ) : (
              <>
                {!useOwnStorage && (
                  <button
                    type="button"
                    disabled={cloudSyncing}
                    onClick={() => void onForceSeedCloud()}
                    className="min-h-[42px] rounded-2xl bg-[#D4F0F0] hover:bg-[#B8E5E1] px-3.5 py-2 text-xs font-bold text-[#214F4B] cursor-pointer whitespace-nowrap"
                  >
                    🔄 {lang === 'th' ? 'อัปโหลดข้อมูลเครื่องนี้ขึ้นคลาวด์' : 'Push Local to Cloud'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void signOutCloud()}
                  className="min-h-[42px] rounded-2xl bg-[#FADADD] hover:bg-[#F3B7C0] px-3.5 py-2 text-xs font-bold text-[#7B2E3B] cursor-pointer whitespace-nowrap"
                >
                  {lang === 'th' ? 'ตัดการเชื่อมต่อคลาวด์' : 'Disconnect'}
                </button>
              </>
            )}
          </>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap border ${
              collapsed
                ? 'bg-[#DCEEF8] hover:bg-[#C6E2F3] border-[#A7D3EC] text-[#1E445C]'
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
  );
};
