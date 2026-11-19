import React, { useEffect, useRef, useState } from 'react';
import { CustomOutfitDesign, Language } from '../types/barnhem';

interface CustomOutfitStudioProps {
  initialDesign?: CustomOutfitDesign;
  lang: Language;
  canWearNow: boolean;
  onSaveDesign: (design: CustomOutfitDesign, equipNow: boolean) => void;
}

const PALETTE = [
  '#FADADD',
  '#D4F0F0',
  '#DCEEF8',
  '#FFF5BA',
  '#EAE4F2',
  '#FDE2D2',
  '#F3A6B8',
  '#8EC5E8',
  '#8FD3C8',
  '#F5C97B',
  '#C5B8E8',
  '#FFFFFF',
];

const EMBLEMS = ['🌸', '⭐', '🍓', '🦋', '🐻', '🌈', '🎀', '⚡', '🐱', '💎'];

export const CustomOutfitStudio: React.FC<CustomOutfitStudioProps> = ({
  initialDesign,
  lang,
  canWearNow,
  onSaveDesign,
}) => {
  const [design, setDesign] = useState<CustomOutfitDesign>(
    initialDesign ?? {
      style: 'hoodie',
      primaryColor: '#FADADD',
      secondaryColor: '#FFF5BA',
      pattern: 'stars',
      emblem: '🌸',
    }
  );
  const [brushColor, setBrushColor] = useState('#3D322C');
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (design.drawingDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = design.drawingDataUrl;
    }
  }, []);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getPointerPos(e);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getPointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDesign((prev) => ({ ...prev, drawingDataUrl: canvas.toDataURL('image/png') }));
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDesign((prev) => ({ ...prev, drawingDataUrl: undefined }));
  };

  return (
    <div className="rounded-[24px] border-2 border-[#EAE4F2] bg-[#FAF7FD] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-sm text-[#3D322C]">
          ✏️ {lang === 'th' ? 'ห้องออกแบบชุดของฉัน (Custom Outfit Designer)' : 'Custom Outfit Design Studio'}
        </div>
        <span className="text-[11px] text-[#6E5C52]">
          {canWearNow
            ? lang === 'th'
              ? '✅ สวมใส่ได้ทันที'
              : '✅ Ready to wear now'
            : lang === 'th'
            ? '🏫 ออกแบบไว้ก่อนได้ (ใส่ได้หลัง 18:30 / วันหยุด)'
            : '🏫 Design anytime (wearable after 18:30 / weekends)'}
        </span>
      </div>

      {/* Style & Pattern */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <span className="font-bold block mb-1.5">{lang === 'th' ? 'แบบชุดอนิเมะ' : 'Outfit Style'}</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'hoodie', labelTh: '🧥 เสื้อฮู้ด', labelEn: '🧥 Hoodie' },
              { id: 'dress', labelTh: '👗 เดรสฟรุ้งฟริ้ง', labelEn: '👗 Dress' },
              { id: 'overalls', labelTh: '👖 ชุดเอี๊ยม', labelEn: '👖 Overalls' },
              { id: 'preppy', labelTh: '🎀 กะลาสีโบว์', labelEn: '🎀 Sailor Bow' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() =>
                  setDesign((prev) => ({
                    ...prev,
                    style: st.id as CustomOutfitDesign['style'],
                  }))
                }
                className={`rounded-xl px-2.5 py-2 font-bold border cursor-pointer ${
                  design.style === st.id
                    ? 'bg-[#3D322C] text-white border-[#3D322C]'
                    : 'bg-white text-[#3D322C] border-[#EBD8C3]'
                }`}
              >
                {lang === 'th' ? st.labelTh : st.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="font-bold block mb-1.5">{lang === 'th' ? 'ลวดลายผ้า & สติกเกอร์' : 'Pattern & Sticker'}</span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { id: 'none', label: 'เรียบ' },
              { id: 'dots', label: 'จุด' },
              { id: 'stripes', label: 'ทาง' },
              { id: 'stars', label: 'ดาว' },
              { id: 'hearts', label: 'หัวใจ' },
            ].map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() =>
                  setDesign((prev) => ({
                    ...prev,
                    pattern: pt.id as CustomOutfitDesign['pattern'],
                  }))
                }
                className={`rounded-xl px-2.5 py-1 font-bold border cursor-pointer ${
                  design.pattern === pt.id
                    ? 'bg-[#3D322C] text-white border-[#3D322C]'
                    : 'bg-white text-[#3D322C] border-[#EBD8C3]'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {EMBLEMS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setDesign((prev) => ({ ...prev, emblem: em }))}
                className={`h-7 w-7 rounded-lg text-sm cursor-pointer border ${
                  design.emblem === em ? 'bg-[#FFF5BA] border-[#3D322C]' : 'bg-white border-[#EBD8C3]'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <span className="font-bold block mb-1">{lang === 'th' ? 'สีหลักของชุด' : 'Primary Color'}</span>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={`p_${c}`}
                type="button"
                onClick={() => setDesign((prev) => ({ ...prev, primaryColor: c }))}
                className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                  design.primaryColor === c ? 'border-[#3D322C] scale-110' : 'border-white'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <span className="font-bold block mb-1">{lang === 'th' ? 'สีแต่งปก / กางเกง-กระโปรง' : 'Accent Color'}</span>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={`s_${c}`}
                type="button"
                onClick={() => setDesign((prev) => ({ ...prev, secondaryColor: c }))}
                className={`h-6 w-6 rounded-full border-2 cursor-pointer ${
                  design.secondaryColor === c ? 'border-[#3D322C] scale-110' : 'border-white'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Freehand Drawing Pad on Shirt Front */}
      <div className="rounded-2xl bg-white border border-[#EBD8C3] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-[#3D322C]">
            🖌️ {lang === 'th' ? 'วาดลวดลายบนหน้าอกเสื้อเอง' : 'Draw Custom Art on Shirt'}
          </span>
          <div className="flex items-center gap-1.5">
            {['#3D322C', '#E86F87', '#42699E', '#3A9D8F', '#E09F3E', '#FFFFFF'].map((bc) => (
              <button
                key={bc}
                type="button"
                onClick={() => setBrushColor(bc)}
                className={`h-5 w-5 rounded-full border cursor-pointer ${
                  brushColor === bc ? 'border-[#3D322C] scale-110' : 'border-[#D5C5B8]'
                }`}
                style={{ backgroundColor: bc }}
              />
            ))}
            <select
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="rounded-lg border border-[#EBD8C3] px-1.5 py-0.5 text-[11px]"
            >
              <option value={2}>เส้นเล็ก</option>
              <option value={4}>กลาง</option>
              <option value={8}>ใหญ่</option>
            </select>
            <button
              type="button"
              onClick={clearDrawing}
              className="rounded-lg bg-[#FADADD] px-2 py-0.5 font-bold text-[#3D322C] cursor-pointer"
            >
              ล้างลาย
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={180}
            height={110}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
            className="rounded-xl border-2 border-dashed border-[#D8C7B8] touch-none cursor-crosshair"
            style={{ backgroundColor: design.primaryColor }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSaveDesign(design, false)}
          className="flex-1 min-h-[42px] rounded-xl bg-white border-2 border-[#EBD8C3] hover:bg-[#FFF5BA]/50 text-xs font-bold text-[#3D322C] cursor-pointer"
        >
          💾 {lang === 'th' ? 'บันทึกแบบชุด' : 'Save Design'}
        </button>
        <button
          type="button"
          onClick={() => onSaveDesign(design, true)}
          className="flex-1 min-h-[42px] rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-xs font-bold text-white cursor-pointer"
        >
          ✨ {lang === 'th' ? 'บันทึก & สวมใส่ชุดนี้เลย!' : 'Save & Wear Now!'}
        </button>
      </div>
    </div>
  );
};
