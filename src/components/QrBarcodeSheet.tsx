import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { KidGroup, Language, Member } from '../types/barnhem';

function generateBarcodeSvgString(code: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, code, {
    format: 'CODE128',
    width: 1.8,
    height: 44,
    displayValue: true,
    fontSize: 12,
    margin: 3,
    lineColor: '#2E231D',
    background: '#FFFFFF',
  });
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!svg.getAttribute('width') && svg.getAttribute('viewBox')) {
    const parts = svg.getAttribute('viewBox')!.split(/\s+/);
    if (parts.length === 4) {
      svg.setAttribute('width', parts[2]);
      svg.setAttribute('height', parts[3]);
    }
  }
  return new XMLSerializer().serializeToString(svg);
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

interface KidIdCardItemProps {
  kid: Member;
  lang: Language;
}

const KidIdCardItem: React.FC<KidIdCardItemProps> = ({ kid, lang }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(kid.id.toUpperCase(), {
      width: 150,
      margin: 1,
      color: { dark: '#2E231D', light: '#FFFFFF' },
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        // ignore
      });

    if (barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, kid.id.toUpperCase(), {
          format: 'CODE128',
          width: 1.6,
          height: 36,
          displayValue: true,
          fontSize: 11,
          margin: 2,
          lineColor: '#2E231D',
          background: '#FFFFFF',
        });
      } catch {
        // ignore
      }
    }

    return () => {
      mounted = false;
    };
  }, [kid.id]);

  return (
    <div className="print-a4-card rounded-2xl border-2 border-[#EBD8C3] bg-white p-3.5 text-center flex flex-col items-center justify-between gap-2 shadow-xs">
      <div className="w-full flex items-center justify-between text-xs font-bold text-[#3D322C] border-b border-[#F3E9DF] pb-1.5">
        <span>
          {kid.emoji} {kid.nickname}
        </span>
        <span className="text-[11px] text-[#7B695F] font-mono">
          {kid.id.toUpperCase()} · G{kid.group}
        </span>
      </div>

      <div className="text-[11px] text-[#6E5C52] line-clamp-1">{kid.fullName}</div>

      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt={`QR ${kid.id}`}
          className="h-24 w-24 object-contain rounded-lg border border-[#F5ECE2] p-1 bg-white"
        />
      )}

      <svg ref={barcodeSvgRef} className="max-w-full h-11" />

      <div className="text-[10px] text-[#8D7B70]">
        Barnhem Care &amp; Kids · {lang === 'th' ? 'บัตรสแกนเช็คอิน' : 'Express Check-in Card'}
      </div>
    </div>
  );
};

interface QrBarcodeSheetProps {
  kids: Member[];
  lang: Language;
  onOpenExpressKiosk: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const QrBarcodeSheet: React.FC<QrBarcodeSheetProps> = ({
  kids,
  lang,
  onOpenExpressKiosk,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [groupFilter, setGroupFilter] = useState<'all' | KidGroup>(1);
  const [exporting, setExporting] = useState<'none' | 'png' | 'html'>('none');
  const [printNotice, setPrintNotice] = useState<'none' | 'iframe_blocked' | 'exported'>('none');
  const [exportStatusText, setExportStatusText] = useState('');

  const filteredKids =
    groupFilter === 'all' ? kids : kids.filter((k) => k.group === groupFilter);

  const handlePrintA4 = () => {
    let didTriggerPrint = false;
    const onBeforePrint = () => {
      didTriggerPrint = true;
    };
    window.addEventListener('beforeprint', onBeforePrint, { once: true });

    try {
      window.print();
    } catch {
      // Blocked in sandboxed iframe
    }

    const insideIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    window.setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!didTriggerPrint || insideIframe) {
        setPrintNotice('iframe_blocked');
      }
    }, 450);
  };

  const handleDownloadA4Png = async () => {
    if (filteredKids.length === 0) return;
    setExporting('png');
    try {
      const perPage = 9; // 3x3 A4 portrait layout
      const totalPages = Math.ceil(filteredKids.length / perPage);
      const pageW = 1240;
      const pageH = 1754;
      const marginX = 56;
      const headerH = 88;
      const gap = 24;
      const cols = 3;
      const rows = 3;
      const cardW = Math.floor((pageW - marginX * 2 - gap * (cols - 1)) / cols);
      const cardH = Math.floor((pageH - headerH - 64 - gap * (rows - 1)) / rows);

      for (let p = 0; p < totalPages; p++) {
        const chunk = filteredKids.slice(p * perPage, (p + 1) * perPage);
        const canvas = document.createElement('canvas');
        canvas.width = pageW;
        canvas.height = pageH;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // White A4 sheet
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, pageW, pageH);

        // Header line
        ctx.fillStyle = '#3D322C';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          `Barnhem Care & Kids · บัตรสแกน QR & บาร์โค้ดขนาด A4 (หน้า ${p + 1}/${totalPages})`,
          marginX,
          52
        );
        ctx.strokeStyle = '#EBD8C3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marginX, 68);
        ctx.lineTo(pageW - marginX, 68);
        ctx.stroke();

        for (let i = 0; i < chunk.length; i++) {
          const kid = chunk[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = marginX + col * (cardW + gap);
          const y = headerH + row * (cardH + gap);

          // Card background & border
          ctx.fillStyle = '#FFFFFF';
          drawRoundedRect(ctx, x, y, cardW, cardH, 20);
          ctx.fill();
          ctx.strokeStyle = '#D8C7B8';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Top bar text
          ctx.fillStyle = '#3D322C';
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${kid.emoji} ${kid.nickname}`, x + 18, y + 36);

          ctx.fillStyle = '#7B695F';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${kid.id.toUpperCase()} · G${kid.group}`, x + cardW - 18, y + 35);

          ctx.strokeStyle = '#F3E9DF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 48);
          ctx.lineTo(x + cardW - 16, y + 48);
          ctx.stroke();

          // Full name
          ctx.fillStyle = '#6E5C52';
          ctx.font = '15px sans-serif';
          ctx.textAlign = 'center';
          const shortName =
            kid.fullName.length > 34 ? `${kid.fullName.slice(0, 33)}…` : kid.fullName;
          ctx.fillText(shortName, x + cardW / 2, y + 74);

          // QR Code
          const qrUrl = await QRCode.toDataURL(kid.id.toUpperCase(), {
            width: 240,
            margin: 1,
            color: { dark: '#2E231D', light: '#FFFFFF' },
          });
          const qrImg = await loadImageFromSrc(qrUrl);
          const qrSize = 210;
          ctx.drawImage(qrImg, x + (cardW - qrSize) / 2, y + 90, qrSize, qrSize);

          // Barcode SVG -> Canvas
          const svgStr = generateBarcodeSvgString(kid.id.toUpperCase());
          const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
          const svgUrl = URL.createObjectURL(svgBlob);
          try {
            const barcodeImg = await loadImageFromSrc(svgUrl);
            const targetW = Math.min(cardW - 36, 280);
            const targetH = 92;
            ctx.drawImage(
              barcodeImg,
              x + (cardW - targetW) / 2,
              y + 318,
              targetW,
              targetH
            );
          } finally {
            URL.revokeObjectURL(svgUrl);
          }

          // Footer
          ctx.fillStyle = '#8D7B70';
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            lang === 'th' ? 'Barnhem Care & Kids · บัตรสแกนเช็คอิน' : 'Barnhem Express Check-in Card',
            x + cardW / 2,
            y + cardH - 18
          );
        }

        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              triggerFileDownload(
                blob,
                `barnhem-a4-barcodes-${groupFilter}-p${p + 1}.png`
              );
            }
            resolve();
          }, 'image/png');
        });
      }

      setPrintNotice('exported');
      setExportStatusText(
        lang === 'th'
          ? `ดาวน์โหลดภาพขนาด A4 เรียบร้อย (${Math.ceil(filteredKids.length / 9)} แผ่น) เปิดรูปเพื่อสั่งพิมพ์ได้เลยค่ะ`
          : `Downloaded ${Math.ceil(filteredKids.length / 9)} A4 PNG sheet(s).`
      );
    } finally {
      setExporting('none');
    }
  };

  const handleDownloadPrintableHtml = async () => {
    if (filteredKids.length === 0) return;
    setExporting('html');
    const esc = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    try {
      const cardsHtml: string[] = [];
      for (const kid of filteredKids) {
        const qrUrl = await QRCode.toDataURL(kid.id.toUpperCase(), {
          width: 180,
          margin: 1,
          color: { dark: '#2E231D', light: '#FFFFFF' },
        });
        const barcodeSvg = generateBarcodeSvgString(kid.id.toUpperCase());
        cardsHtml.push(`
          <div class="card">
            <div class="card-head">
              <span>${esc(kid.emoji)} ${esc(kid.nickname)}</span>
              <span class="mono">${esc(kid.id.toUpperCase())} · G${kid.group}</span>
            </div>
            <div class="fullname">${esc(kid.fullName)}</div>
            <img class="qr" src="${qrUrl}" alt="QR ${esc(kid.id)}" />
            <div class="barcode">${barcodeSvg}</div>
            <div class="foot">Barnhem Care &amp; Kids · ${
              lang === 'th' ? 'บัตรสแกนเช็คอิน' : 'Express Check-in Card'
            }</div>
          </div>
        `);
      }

      const htmlDoc = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <title>Barnhem A4 QR &amp; Barcode Sheet</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 14px; font-family: system-ui, -apple-system, sans-serif; background: #FFFDF9; color: #3D322C; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; margin-bottom: 14px; border-radius: 16px; border: 2px solid #FADADD; background: #fff; }
    .print-btn { border: none; border-radius: 12px; background: #3D322C; color: #fff; font-weight: 700; padding: 10px 18px; cursor: pointer; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8mm; }
    .card { break-inside: avoid; page-break-inside: avoid; border: 1.5px solid #D8C7B8; border-radius: 14px; background: #fff; padding: 10px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .card-head { width: 100%; display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; border-bottom: 1px solid #F3E9DF; padding-bottom: 4px; }
    .mono { font-family: monospace; color: #7B695F; font-size: 11px; }
    .fullname { font-size: 11px; color: #6E5C52; }
    .qr { width: 92px; height: 92px; object-fit: contain; border: 1px solid #F5ECE2; border-radius: 8px; padding: 3px; }
    .barcode svg { max-width: 100%; height: 42px; }
    .foot { font-size: 10px; color: #8D7B70; }
    @media print {
      body { padding: 0; background: #fff; }
      .toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><strong>Barnhem Care &amp; Kids — แผ่นพิมพ์บัตร QR &amp; บาร์โค้ดขนาด A4 (${filteredKids.length} คน)</strong></div>
    <button class="print-btn" onclick="window.print()">🖨️ สั่งพิมพ์ A4 / Save PDF</button>
  </div>
  <div class="grid">${cardsHtml.join('\n')}</div>
</body>
</html>`;

      triggerFileDownload(
        new Blob([htmlDoc], { type: 'text/html;charset=utf-8' }),
        `barnhem-a4-barcodes-${groupFilter}.html`
      );
      setPrintNotice('exported');
      setExportStatusText(
        lang === 'th'
          ? 'ดาวน์โหลดไฟล์ A4 พร้อมพิมพ์ (.html) แล้ว เปิดไฟล์ในเบราว์เซอร์เพื่อกดสั่งพิมพ์หรือ Save PDF ได้เลยค่ะ'
          : 'Downloaded printable A4 HTML file. Open it in your browser to print or save as PDF.'
      );
    } finally {
      setExporting('none');
    }
  };

  return (
    <section className="rounded-[28px] border-2 border-[#FADADD] bg-[#FFFDF9] p-5 pastel-shadow space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#3D322C]">
            🪪 {lang === 'th' ? 'ระบบ QR Code & บาร์โค้ดขนาด A4 (สำหรับน้องไม่มีมือถือ)' : 'QR Code & A4 Barcode Print Studio'}
          </h3>
          <p className="text-xs text-[#6E5C52]">
            {lang === 'th'
              ? 'สร้างบัตรสแกน QR Code และ Barcode (Code-128) สำหรับพิมพ์ใส่กระดาษ A4 เคลือบแข็งให้น้องใช้ติ๊ดเช็คอินด่วน'
              : 'Printable A4 QR & Code-128 Barcode cards for kids without smartphones.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!collapsed && (
            <>
              <button
                type="button"
                onClick={onOpenExpressKiosk}
                className="min-h-[42px] rounded-2xl bg-[#FFF5BA] hover:bg-[#FCEB8E] border border-[#F4DB73] px-4 py-2 text-xs sm:text-sm font-bold text-[#3D322C] cursor-pointer"
              >
                ⚡ {lang === 'th' ? 'เปิดโหมดติ๊ดเช็คอินด่วน (Kiosk)' : 'Open Express Kiosk'}
              </button>

              <button
                type="button"
                disabled={exporting !== 'none' || filteredKids.length === 0}
                onClick={handleDownloadA4Png}
                className="min-h-[42px] rounded-2xl bg-[#DCF7F2] hover:bg-[#C3EFE7] border border-[#8AD9CA] text-[#114A42] px-4 py-2 text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {exporting === 'png'
                  ? lang === 'th'
                    ? '⏳ กำลังสร้างแผ่น A4...'
                    : '⏳ Exporting A4...'
                  : lang === 'th'
                  ? '🖼️ โหลดแผ่น A4 (PNG)'
                  : '🖼️ Download A4 PNG'}
              </button>

              <button
                type="button"
                disabled={exporting !== 'none' || filteredKids.length === 0}
                onClick={handleDownloadPrintableHtml}
                className="min-h-[42px] rounded-2xl bg-[#EFE8FC] hover:bg-[#E1D4FA] border border-[#C8B7EB] text-[#3E2B63] px-4 py-2 text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {exporting === 'html'
                  ? lang === 'th'
                    ? '⏳ กำลังสร้างไฟล์...'
                    : '⏳ Building HTML...'
                  : lang === 'th'
                  ? '📄 โหลดไฟล์พิมพ์ A4 (HTML)'
                  : '📄 Printable A4 File'}
              </button>

              <button
                type="button"
                onClick={handlePrintA4}
                className="min-h-[42px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-5 py-2 text-xs sm:text-sm font-bold cursor-pointer"
              >
                🖨️ {lang === 'th' ? 'พิมพ์ขนาด A4' : 'Print A4 Sheet'}
              </button>
            </>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap border ${
                collapsed
                  ? 'bg-[#FADADD] hover:bg-[#F5C2C8] border-[#EE9CAF] text-[#6E2638]'
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

      {printNotice === 'iframe_blocked' && (
        <div className="no-print rounded-2xl border border-[#F4DB73] bg-[#FFF8CC] px-4 py-3 text-xs sm:text-sm text-[#5A4614] flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>💡 {lang === 'th' ? 'หากปุ่มสั่งพิมพ์ไม่เด้งในหน้าต่างตัวอย่าง:' : 'If direct print is blocked in preview:'}</strong>{' '}
            {lang === 'th'
              ? 'ระบบเบราว์เซอร์ในหน้าต่างนี้จำกัดคำสั่งพิมพ์ตรง กรุณากด “🖼️ โหลดแผ่น A4 (PNG)” หรือ “📄 โหลดไฟล์พิมพ์ A4 (HTML)” ด้านบนเพื่อสั่งพิมพ์ขนาด A4 ได้ทันที 100% ค่ะ'
              : 'Preview iframe blocks direct print dialogs. Use “Download A4 PNG” or “Printable A4 File” above to print immediately.'}
          </div>
          <button
            type="button"
            onClick={() => setPrintNotice('none')}
            className="rounded-xl bg-white border border-[#E5CF7B] px-3 py-1 text-xs font-bold cursor-pointer"
          >
            {lang === 'th' ? 'รับทราบ' : 'OK'}
          </button>
        </div>
      )}

      {printNotice === 'exported' && exportStatusText && (
        <div className="no-print rounded-2xl border border-[#9FE2D6] bg-[#DCF7F2] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#114A42] flex items-center justify-between gap-3">
          <span>✅ {exportStatusText}</span>
          <button
            type="button"
            onClick={() => setPrintNotice('none')}
            className="rounded-xl bg-white border border-[#9FE2D6] px-2.5 py-1 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Group filter tabs */}
      <div className="no-print flex flex-wrap gap-2">
        {[
          { id: 1, labelTh: '🐣 กลุ่ม 1 น้องเล็ก (ไม่มีมือถือ)', labelEn: '🐣 Group 1 (No Phone)' },
          { id: 2, labelTh: '🌟 กลุ่ม 2 พี่โต', labelEn: '🌟 Group 2' },
          { id: 3, labelTh: '🎓 กลุ่ม 3 พี่ใหญ่', labelEn: '🎓 Group 3' },
          { id: 'all', labelTh: 'ทุกคน (All)', labelEn: 'All Kids' },
        ].map((tab) => (
          <button
            key={String(tab.id)}
            type="button"
            onClick={() => setGroupFilter(tab.id as 'all' | KidGroup)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
              groupFilter === tab.id
                ? 'bg-[#3D322C] text-white'
                : 'bg-[#FDE2D2]/60 text-[#3D322C] hover:bg-[#FADADD]'
            }`}
          >
            {lang === 'th' ? tab.labelTh : tab.labelEn}
          </button>
        ))}
      </div>

      {/* A4 Printable Grid */}
      <div className="print-a4-sheet grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {filteredKids.map((kid) => (
          <KidIdCardItem key={kid.id} kid={kid} lang={lang} />
        ))}
      </div>
        </>
      )}
    </section>
  );
};

