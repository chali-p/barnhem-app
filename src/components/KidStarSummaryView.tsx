import React, { useMemo, useState } from 'react';
import { KidGroup, Language, Member, ModalAlertPayload } from '../types/barnhem';

interface KidStarSummaryViewProps {
  orgName: string;
  kids: Member[];
  lang: Language;
  onShowAlert: (payload: ModalAlertPayload) => void;
  onBackHome: () => void;
}

const GROUP_LABELS: Record<KidGroup, { th: string; en: string; badgeCls: string }> = {
  1: {
    th: 'กลุ่ม 1 · ประถม',
    en: 'Group 1 · Primary',
    badgeCls: 'bg-[#FFF3DB] text-[#8A5A10] border-[#F2DA84]',
  },
  2: {
    th: 'กลุ่ม 2 · มัธยม',
    en: 'Group 2 · Secondary',
    badgeCls: 'bg-[#E8FAF6] text-[#114A42] border-[#8FD4C6]',
  },
  3: {
    th: 'กลุ่ม 3 · วิทยาลัย/ฝึกงาน',
    en: 'Group 3 · College',
    badgeCls: 'bg-[#EAE4F2] text-[#3E2B63] border-[#C8B7EB]',
  },
};

export const KidStarSummaryView: React.FC<KidStarSummaryViewProps> = ({
  orgName,
  kids,
  lang,
  onShowAlert,
  onBackHome,
}) => {
  const [groupFilter, setGroupFilter] = useState<0 | KidGroup>(0);
  const [sortBy, setSortBy] = useState<'stars_desc' | 'stars_asc' | 'group_name'>('stars_desc');
  const [search, setSearch] = useState('');
  const [expandedKidId, setExpandedKidId] = useState<string | null>(null);
  const [copiedJustNow, setCopiedJustNow] = useState(false);

  const stats = useMemo(() => {
    const totalStars = kids.reduce((sum, k) => sum + (k.stars ?? 0), 0);
    const avgStars = kids.length > 0 ? Math.round(totalStars / kids.length) : 0;
    const sorted = [...kids].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    const topKid = sorted[0] ?? null;
    return { totalStars, avgStars, topKid };
  }, [kids]);

  const rankByKidId = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...kids].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    sorted.forEach((k, idx) => map.set(k.id, idx + 1));
    return map;
  }, [kids]);

  const displayedKids = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = kids.filter((k) => {
      if (groupFilter !== 0 && k.group !== groupFilter) return false;
      if (!q) return true;
      return (
        k.nickname.toLowerCase().includes(q) ||
        k.fullName.toLowerCase().includes(q) ||
        k.id.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'stars_desc') return (b.stars ?? 0) - (a.stars ?? 0);
      if (sortBy === 'stars_asc') return (a.stars ?? 0) - (b.stars ?? 0);
      const ga = a.group ?? 9;
      const gb = b.group ?? 9;
      if (ga !== gb) return ga - gb;
      return a.nickname.localeCompare(b.nickname, 'th');
    });
    return list;
  }, [kids, groupFilter, sortBy, search]);

  const summaryText = useMemo(() => {
    const lines = [
      `⭐ สรุปยอดดาวสะสมของเด็กๆ ทั้งหมด (${orgName})`,
      `👧👦 จำนวน ${displayedKids.length} คน · รวมทั้งหมด ${displayedKids
        .reduce((s, k) => s + (k.stars ?? 0), 0)
        .toLocaleString()} ⭐`,
      '',
    ];
    displayedKids.forEach((k, idx) => {
      lines.push(`${idx + 1}. ${k.emoji} ${k.nickname} (${k.fullName}): ${(k.stars ?? 0).toLocaleString()} ⭐`);
    });
    return lines.join('\n').slice(0, 1800);
  }, [displayedKids, orgName]);

  const handleCopySummary = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      }
      setCopiedJustNow(true);
      window.setTimeout(() => setCopiedJustNow(false), 2500);
      onShowAlert({
        icon: '⭐',
        title: lang === 'th' ? 'คัดลอกสรุปยอดดาวแล้ว!' : 'Star Summary Copied!',
        message:
          lang === 'th'
            ? 'สามารถนำไปวางส่งในกลุ่ม LINE หรือบันทึกได้ทันทีค่ะ'
            : 'Ready to paste into LINE or notes.',
        tone: 'yellow',
      });
    } catch {
      onShowAlert({
        icon: '⭐',
        title: lang === 'th' ? 'สรุปยอดดาวทั้งหมด' : 'All Kids Star Summary',
        message: summaryText,
        tone: 'yellow',
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header Card */}
      <section className="rounded-[28px] border-2 border-[#F2DA84] bg-[#FFFDF9] p-5 sm:p-6 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#F2DA84] bg-[#FFF7D6] px-3 py-1 text-xs font-extrabold text-[#7A5411]">
              <span>🔑 PIN 0002</span>
              <span>·</span>
              <span>
                {lang === 'th' ? 'เช็คยอดดาวของเด็กๆ ทั้งหมด' : 'All Kids Star Balances'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#3D322C]">
              ⭐ {lang === 'th' ? 'สรุปยอดดาวสะสมของเด็กๆ ทั้งหมด' : 'All Kids Star Balances'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6E5C52]">
              {lang === 'th'
                ? 'ตรวจสอบยอดดาวคงเหลือ อันดับดาว และกดที่ชื่อน้องเพื่อดูประวัติดาวเข้า-ออกล่าสุดได้เลยค่ะ'
                : 'View current star balances, rankings, and tap any kid card to inspect recent star history.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://line.me/R/share?text=${encodeURIComponent(summaryText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-2xl bg-[#06C755] hover:bg-[#05B24C] text-white px-4 py-2 text-xs font-extrabold shadow-xs"
            >
              <span>💚</span>
              <span>{lang === 'th' ? 'ส่งเข้า LINE' : 'Send to LINE'}</span>
            </a>

            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="min-h-[40px] rounded-2xl border border-[#F2DA84] bg-[#FFF7D6] hover:bg-[#FCEFA8] text-[#6B4800] px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              {copiedJustNow
                ? lang === 'th'
                  ? '✅ คัดลอกแล้ว'
                  : '✅ Copied'
                : lang === 'th'
                ? '📋 คัดลอกยอดดาว'
                : '📋 Copy Summary'}
            </button>

            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[40px] rounded-2xl border border-[#EBD8C3] bg-white hover:bg-[#FAF5EF] text-[#3D322C] px-3.5 py-2 text-xs font-bold cursor-pointer"
            >
              ← {lang === 'th' ? 'ออก / กลับหน้าแรก' : 'Exit to Home'}
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-[#EBD8C3] bg-white px-4 py-3">
            <div className="text-[11px] font-semibold text-[#7B695F]">
              👧👦 {lang === 'th' ? 'จำนวนน้องทั้งหมด' : 'Total Kids'}
            </div>
            <div className="text-2xl font-extrabold text-[#3D322C] tabular-nums mt-0.5">
              {kids.length} {lang === 'th' ? 'คน' : ''}
            </div>
          </div>

          <div className="rounded-2xl border border-[#F2DA84] bg-[#FFF7D6] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#7A5411]">
              ⭐ {lang === 'th' ? 'ยอดดาวรวมทั้งหมด' : 'Total Stars'}
            </div>
            <div className="text-2xl font-extrabold text-[#6B4800] tabular-nums mt-0.5">
              {stats.totalStars.toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#114A42]">
              📊 {lang === 'th' ? 'เฉลี่ยต่อคน' : 'Average / Kid'}
            </div>
            <div className="text-2xl font-extrabold text-[#114A42] tabular-nums mt-0.5">
              {stats.avgStars.toLocaleString()} ⭐
            </div>
          </div>

          <div className="rounded-2xl border border-[#F3B7C0] bg-[#FFF0F3] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#8B1D36]">
              🏆 {lang === 'th' ? 'ดาวสูงสุดตอนนี้' : 'Top Star Earner'}
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[#8B1D36] truncate mt-1 tabular-nums">
              {stats.topKid
                ? `${stats.topKid.emoji} ${stats.topKid.nickname} (${(stats.topKid.stars ?? 0).toLocaleString()} ⭐)`
                : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Kid List */}
      <section className="rounded-[28px] border-2 border-[#EBD8C3] bg-white p-4 sm:p-5 pastel-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Group Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 0 as const, th: 'ทั้งหมด', en: 'All' },
                { id: 1 as const, th: 'กลุ่ม 1 · ประถม', en: 'Group 1' },
                { id: 2 as const, th: 'กลุ่ม 2 · มัธยม', en: 'Group 2' },
                { id: 3 as const, th: 'กลุ่ม 3 · วิทยาลัย', en: 'Group 3' },
              ]
            ).map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupFilter(g.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors ${
                  groupFilter === g.id
                    ? 'border-[#3D322C] bg-[#3D322C] text-white'
                    : 'border-[#EBD8C3] bg-[#FFFDF9] text-[#5E4E45] hover:bg-[#FAF1E6]'
                }`}
              >
                {lang === 'th' ? g.th : g.en}
              </button>
            ))}
          </div>

          {/* Sort & Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'stars_desc' | 'stars_asc' | 'group_name')
              }
              className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] px-3 py-2 text-xs font-bold text-[#3D322C]"
            >
              <option value="stars_desc">
                {lang === 'th' ? '⭐ ดาวมาก → น้อย' : 'Stars High → Low'}
              </option>
              <option value="stars_asc">
                {lang === 'th' ? '⭐ ดาวน้อย → มาก' : 'Stars Low → High'}
              </option>
              <option value="group_name">
                {lang === 'th' ? '👥 เรียงตามกลุ่ม & ชื่อ' : 'Group & Name'}
              </option>
            </select>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'th' ? '🔍 ค้นหาชื่อน้อง...' : '🔍 Search kid...'}
              className="rounded-2xl border border-[#EBD8C3] bg-[#FFFDF9] px-3.5 py-2 text-xs text-[#3D322C] w-full sm:w-48"
            />
          </div>
        </div>

        {displayedKids.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DFD2C3] bg-[#FFFDF9] p-8 text-center text-xs text-[#7B695F]">
            {lang === 'th' ? 'ไม่พบรายชื่อน้องตามเงื่อนไขที่ค้นหาค่ะ' : 'No matching kids found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayedKids.map((kid) => {
              const rank = rankByKidId.get(kid.id) ?? 0;
              const rankBadge =
                rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
              const groupMeta = kid.group ? GROUP_LABELS[kid.group] : null;
              const isExpanded = expandedKidId === kid.id;
              const recentHistory = (kid.starHistory ?? []).slice(0, 6);

              return (
                <div
                  key={kid.id}
                  className="rounded-2xl border border-[#EFE6DC] bg-[#FFFDF9] p-4 space-y-2.5 transition-colors hover:border-[#E5C97B]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-2xl bg-[#FFF6D6] border border-[#F2DA84] flex items-center justify-center text-sm font-extrabold text-[#6B4800] shrink-0 tabular-nums">
                        {rankBadge}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm sm:text-base font-extrabold text-[#3D322C] truncate">
                            {kid.emoji} {kid.nickname}
                          </span>
                          {groupMeta && (
                            <span
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${groupMeta.badgeCls}`}
                            >
                              {lang === 'th' ? groupMeta.th : groupMeta.en}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#7B695F] truncate">{kid.fullName}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedKidId(isExpanded ? null : kid.id)}
                      className="rounded-2xl border border-[#F2DA84] bg-[#FFF7D6] hover:bg-[#FCEFA8] px-3.5 py-2 text-right cursor-pointer shrink-0 transition-colors"
                    >
                      <div className="text-base sm:text-lg font-extrabold text-[#6B4800] tabular-nums leading-tight">
                        {(kid.stars ?? 0).toLocaleString()} ⭐
                      </div>
                      <div className="text-[10px] font-bold text-[#8A5A10]">
                        {isExpanded
                          ? lang === 'th'
                            ? 'ซ่อนประวัติ ▴'
                            : 'Hide ▴'
                          : lang === 'th'
                          ? 'ดูประวัติ ▾'
                          : 'History ▾'}
                      </div>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="rounded-xl border border-[#F2E9DF] bg-white p-3 space-y-1.5">
                      <div className="text-[11px] font-extrabold text-[#5E4E45]">
                        🕒 {lang === 'th' ? 'ประวัติดาวล่าสุด' : 'Recent Star History'}
                      </div>
                      {recentHistory.length === 0 ? (
                        <div className="text-[11px] text-[#8B796E]">
                          {lang === 'th' ? 'ยังไม่มีประวัติดาวเข้า-ออกค่ะ' : 'No star transactions yet.'}
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {recentHistory.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between gap-2 text-[11px] border-b border-[#F7F1EB] last:border-b-0 pb-1 last:pb-0"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-[#3D322C] truncate">
                                  {tx.reason}
                                </div>
                                <div className="text-[10px] text-[#8B796E] tabular-nums">
                                  {new Date(tx.timestamp).toLocaleString(
                                    lang === 'th' ? 'th-TH' : 'en-US',
                                    {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }
                                  )}
                                </div>
                              </div>
                              <span
                                className={`font-extrabold tabular-nums shrink-0 ${
                                  tx.amount >= 0 ? 'text-[#114A42]' : 'text-[#8B1D36]'
                                }`}
                              >
                                {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} ⭐
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
