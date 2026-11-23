import React, { useEffect, useState } from 'react';
import { Language } from '../types/barnhem';

interface MinimartGateDemoModalProps {
  open: boolean;
  orgName?: string;
  lang: Language;
  onClose: () => void;
}

interface DemoShelfItem {
  id: string;
  emoji: string;
  nameTh: string;
  nameEn: string;
  priceThb: number;
}

const DEMO_SHELF_ITEMS: DemoShelfItem[] = [
  { id: 'water', emoji: '💧', nameTh: 'น้ำดื่มเย็น 600ml', nameEn: 'Chilled Water', priceThb: 10 },
  { id: 'bun', emoji: '🥐', nameTh: 'ขนมปังไส้ครีม', nameEn: 'Cream Bun', priceThb: 18 },
  { id: 'coffee', emoji: '☕', nameTh: 'กาแฟกระป๋องพร้อมดื่ม', nameEn: 'Iced Coffee Can', priceThb: 20 },
  { id: 'cup', emoji: '🍜', nameTh: 'บะหมี่ถ้วย + น้ำร้อน', nameEn: 'Cup Noodles', priceThb: 22 },
  { id: 'juice', emoji: '🧃', nameTh: 'น้ำส้มกล่อง', nameEn: 'Orange Juice', priceThb: 15 },
  { id: 'tissue', emoji: '🧻', nameTh: 'ทิชชู่พกพาฉุกเฉิน', nameEn: 'Pocket Tissue', priceThb: 15 },
];

interface GeneratedReceipt {
  receiptNo: string;
  gatePin: string;
  totalThb: number;
  itemsSummary: string;
  paidAt: string;
  used: boolean;
}

export const MinimartGateDemoModal: React.FC<MinimartGateDemoModalProps> = ({
  open,
  orgName,
  lang,
  onClose,
}) => {
  const [cart, setCart] = useState<Record<string, number>>({ water: 1, bun: 1 });
  const [receipt, setReceipt] = useState<GeneratedReceipt | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [gateSecondsLeft, setGateSecondsLeft] = useState<number>(0);
  const [gateMessage, setGateMessage] = useState<{ type: 'idle' | 'open' | 'error'; text: string }>({
    type: 'idle',
    text: '',
  });

  useEffect(() => {
    if (gateSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setGateSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gateSecondsLeft]);

  if (!open) return null;

  const cartLines = DEMO_SHELF_ITEMS.filter((item) => (cart[item.id] ?? 0) > 0);
  const totalThb = cartLines.reduce((sum, item) => sum + item.priceThb * (cart[item.id] ?? 0), 0);
  const totalCount = cartLines.reduce((sum, item) => sum + (cart[item.id] ?? 0), 0);

  const adjustQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleSelfCheckout = () => {
    if (totalCount <= 0) return;
    const randomPin = String(Math.floor(100000 + Math.random() * 900000));
    const randomNo = `RCP-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const summary = cartLines
      .map((i) => `${i.emoji} ${lang === 'th' ? i.nameTh : i.nameEn} x${cart[i.id]}`)
      .join(', ');
    setReceipt({
      receiptNo: randomNo,
      gatePin: randomPin,
      totalThb,
      itemsSummary: summary,
      paidAt: new Date().toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      used: false,
    });
    setPinInput(randomPin);
    setGateSecondsLeft(0);
    setGateMessage({ type: 'idle', text: '' });
  };

  const handleScanReceiptToOpenDoor = (submittedCode?: string) => {
    if (!receipt) return;
    const codeToCheck = (submittedCode ?? pinInput).trim();
    if (receipt.used) {
      setGateMessage({
        type: 'error',
        text:
          lang === 'th'
            ? '🚫 ใบเสร็จนี้สแกนเปิดประตูไปแล้ว (ระบบป้องกันการใช้ใบเสร็จเดิมซ้ำ)'
            : '🚫 This receipt has already been used to exit.',
      });
      return;
    }
    if (codeToCheck !== receipt.gatePin && codeToCheck !== receipt.receiptNo) {
      setGateMessage({
        type: 'error',
        text:
          lang === 'th'
            ? '❌ รหัสใบเสร็จไม่ถูกต้อง กรุณาสแกน QR จากใบเสร็จล่าสุด'
            : '❌ Invalid receipt code. Please scan your latest receipt.',
      });
      return;
    }
    setReceipt((prev) => (prev ? { ...prev, used: true } : prev));
    setGateSecondsLeft(10);
    setGateMessage({
      type: 'open',
      text:
        lang === 'th'
          ? '🔓 ประตูปลดล็อกอัตโนมัติแล้ว! ขอบคุณที่แวะมาอุดหนุนค่ะ'
          : '🔓 Exit gate unlocked! Thank you for shopping with us.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] border-2 border-[#8FD4C6] bg-[#FFFDF9] p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#EFE6DC] pb-3">
          <div>
            <div className="text-xs font-extrabold text-[#114A42]">
              🏪🚪 {lang === 'th' ? 'ระบบจำลองจุดขายอัตโนมัติ (ไม่ต้องมีคนเฝ้าร้าน)' : 'Unmanned Minimart Live Flow Demo'}
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-[#3D322C]">
              {orgName?.trim() || (lang === 'th' ? 'มินิมาร์ทจ่ายเอง → รับใบเสร็จเปิดประตู' : 'Self-Checkout → Receipt Exit Gate')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] rounded-xl border border-[#EBD8C3] bg-white hover:bg-[#FAF6F1] px-3 py-1 text-xs font-bold text-[#3D322C] cursor-pointer"
          >
            ✕ {lang === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
          </button>
        </div>

        {/* 3-step guide pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className={`rounded-xl border px-3 py-2 font-bold ${!receipt ? 'border-[#114A42] bg-[#E8FAF6] text-[#114A42]' : 'border-[#EFE6DC] bg-white text-[#6E5C52]'}`}>
            1️⃣ {lang === 'th' ? 'ลูกค้าหยิบสินค้า & กดคิดเงินเอง' : '1. Pick items & Self-Checkout'}
          </div>
          <div className={`rounded-xl border px-3 py-2 font-bold ${receipt && !receipt.used ? 'border-[#114A42] bg-[#E8FAF6] text-[#114A42]' : 'border-[#EFE6DC] bg-white text-[#6E5C52]'}`}>
            2️⃣ {lang === 'th' ? 'จ่าย QR รับใบเสร็จเปิดประตู' : '2. Pay QR & Get Exit Receipt'}
          </div>
          <div className={`rounded-xl border px-3 py-2 font-bold ${receipt?.used ? 'border-[#114A42] bg-[#E8FAF6] text-[#114A42]' : 'border-[#EFE6DC] bg-white text-[#6E5C52]'}`}>
            3️⃣ {lang === 'th' ? 'สแกนใบเสร็จปลดล็อกประตูออก' : '3. Scan Receipt to Unlock Gate'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Customer Self-Checkout */}
          <div className="rounded-2xl border border-[#EBD8C3] bg-white p-4 space-y-3">
            <div className="text-sm font-extrabold text-[#3D322C]">
              🛒 {lang === 'th' ? 'ตู้/ชั้นวางสินค้า (ลูกค้ากดเลือกเอง)' : 'Self-Service Shelf'}
            </div>
            <div className="space-y-2">
              {DEMO_SHELF_ITEMS.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#F3EAE0] bg-[#FFFDF9] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#3D322C] truncate">
                        {item.emoji} {lang === 'th' ? item.nameTh : item.nameEn}
                      </div>
                      <div className="text-[11px] font-extrabold text-[#114A42] tabular-nums">
                        ฿{item.priceThb}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => adjustQty(item.id, -1)}
                        className="w-7 h-7 rounded-lg border border-[#EBD8C3] bg-white font-extrabold text-[#3D322C] cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-extrabold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        onClick={() => adjustQty(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-[#114A42] text-white font-extrabold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-[#FAF6F1] p-3 flex items-center justify-between gap-2">
              <div className="text-xs">
                <div className="text-[#6E5C52]">
                  {lang === 'th' ? `รวม ${totalCount} ชิ้น` : `${totalCount} items`}
                </div>
                <div className="text-base font-extrabold text-[#3D322C] tabular-nums">
                  {totalThb.toLocaleString()} ฿
                </div>
              </div>
              <button
                type="button"
                disabled={totalCount <= 0}
                onClick={handleSelfCheckout}
                className="min-h-[40px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-4 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-45"
              >
                💳 {lang === 'th' ? 'ชำระเงินเอง & ออกใบเสร็จ' : 'Pay & Issue Receipt'}
              </button>
            </div>
          </div>

          {/* Right: Digital Receipt + Automatic Exit Gate Scanner */}
          <div className="space-y-3">
            <div className="rounded-2xl border-2 border-dashed border-[#8FD4C6] bg-[#F5FCFA] p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-[#114A42]">
                  🧾 {lang === 'th' ? 'ใบเสร็จเปิดประตูอัตโนมัติ' : 'Exit Gate Digital Receipt'}
                </div>
                {receipt && (
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${
                      receipt.used
                        ? 'bg-[#FFE8ED] text-[#8B1D36]'
                        : 'bg-[#DCF7F2] text-[#114A42]'
                    }`}
                  >
                    {receipt.used
                      ? lang === 'th'
                        ? 'ใช้เปิดประตูแล้ว'
                        : 'USED'
                      : lang === 'th'
                      ? 'พร้อมใช้เปิดประตู (1 ครั้ง)'
                      : 'READY (1 EXIT)'}
                  </span>
                )}
              </div>

              {!receipt ? (
                <div className="rounded-xl bg-white/80 border border-[#D2EFE8] p-4 text-center text-xs text-[#6E5C52]">
                  {lang === 'th'
                    ? 'กด "ชำระเงินเอง & ออกใบเสร็จ" ทางซ้าย เพื่อดูตัวอย่างใบเสร็จ QR สำหรับเปิดประตูทางออกค่ะ'
                    : 'Tap "Pay & Issue Receipt" on the left to generate an exit receipt.'}
                </div>
              ) : (
                <div className="rounded-xl bg-white border border-[#D2EFE8] p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-[#3D322C]">
                    <span>{receipt.receiptNo}</span>
                    <span>{receipt.paidAt}</span>
                  </div>
                  <div className="text-[11px] text-[#6E5C52]">{receipt.itemsSummary}</div>
                  <div className="flex items-center justify-between border-t border-dashed border-[#EBD8C3] pt-2">
                    <div>
                      <div className="text-[10px] text-[#7B695F]">
                        {lang === 'th' ? 'รหัสเปิดประตู (Door PIN)' : 'Door Exit PIN'}
                      </div>
                      <div className="text-lg font-extrabold tracking-widest text-[#114A42] tabular-nums">
                        {receipt.gatePin}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#3D322C] bg-[#FFFDF9] px-2.5 py-1.5 text-center">
                      <div className="text-lg leading-none">▦</div>
                      <div className="text-[9px] font-bold text-[#3D322C] mt-0.5">QR GATE</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Door Gate Lock / Unlock Hardware Simulator */}
            <div
              className={`rounded-2xl border-2 p-4 space-y-3 transition-colors ${
                gateSecondsLeft > 0
                  ? 'border-[#38B288] bg-[#E8FAF3]'
                  : 'border-[#EBD8C3] bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-[#3D322C]">
                  {gateSecondsLeft > 0 ? '🔓' : '🚪🔒'}{' '}
                  {lang === 'th' ? 'เครื่องสแกนหน้าประตูทางออก' : 'Smart Exit Door Controller'}
                </div>
                <span
                  className={`rounded-lg px-2.5 py-0.5 text-[11px] font-extrabold ${
                    gateSecondsLeft > 0
                      ? 'bg-[#1F6F58] text-white'
                      : 'bg-[#F3EAE0] text-[#5B4B42]'
                  }`}
                >
                  {gateSecondsLeft > 0
                    ? lang === 'th'
                      ? `เปิดอยู่ (${gateSecondsLeft} วิ)`
                      : `OPEN (${gateSecondsLeft}s)`
                    : lang === 'th'
                    ? 'ประตูล็อกอยู่'
                    : 'LOCKED'}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={lang === 'th' ? 'รหัส 6 หลักท้ายใบเสร็จ...' : '6-digit receipt PIN...'}
                  className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-2 text-xs font-bold tabular-nums text-[#3D322C]"
                />
                <button
                  type="button"
                  disabled={!receipt}
                  onClick={() => handleScanReceiptToOpenDoor()}
                  className="rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-40 whitespace-nowrap"
                >
                  📱 {lang === 'th' ? 'สแกนเปิดประตู' : 'Scan to Open'}
                </button>
              </div>

              {gateMessage.text && (
                <div
                  className={`rounded-xl px-3 py-2 text-xs font-bold ${
                    gateMessage.type === 'open'
                      ? 'bg-white text-[#145844] border border-[#8AD1BA]'
                      : 'bg-[#FFE8ED] text-[#8B1D36] border border-[#F3B7C0]'
                  }`}
                >
                  {gateMessage.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
