import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flame,
  Zap,
  TrendingUp,
  RotateCw,
  Cpu,
  Clock,
  Sparkles,
  Bot,
  MessageSquare,
  Award,
} from 'lucide-react';
import { ActivityHeatmapResult, HeatmapDay } from '../../types';
import { ProviderLogo } from '../common/ProviderLogos';

function formatCompactTokens(n: number | undefined | null): string {
  if (!n) return '0';
  if (n >= 1_000_000) {
    const val = (n / 1_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
    return `${val} jt`;
  }
  if (n >= 1_000) {
    const val = (n / 1_000).toLocaleString('id-ID', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
    return `${val} rb`;
  }
  return n.toLocaleString('id-ID');
}

function formatDateIndo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return `${day} ${months[monthIdx] || ''} ${year}`;
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return `${day} ${months[monthIdx] || ''}`;
  } catch {
    return dateStr;
  }
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const DAY_LABELS = ['Sen', '', 'Rab', '', 'Jum', '', ''];

const LEVEL_BG: Record<number, string> = {
  0: '#21262d',
  1: '#0e4429',
  2: '#006d32',
  3: '#26a641',
  4: '#39d353',
};

export function ActivityHeatmap() {
  const [data, setData] = useState<ActivityHeatmapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{
    day: HeatmapDay;
    x: number;
    y: number;
  } | null>(null);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== 'undefined' && !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
        // Fallback mockup jika di browser biasa
        const mockDays: HeatmapDay[] = [];
        const now = new Date();
        for (let i = 364; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 86400000);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const isAct = i % 3 === 0 || i < 15;
          const tok = isAct ? Math.floor(Math.random() * 50000) + 1200 : 0;
          const req = isAct ? Math.floor(Math.random() * 15) + 1 : 0;
          const lvl = tok === 0 ? 0 : tok > 30000 ? 4 : tok > 15000 ? 3 : tok > 5000 ? 2 : 1;
          mockDays.push({
            date: `${y}-${m}-${day}`,
            tokens: tok,
            requests: req,
            level: lvl,
          });
        }
        setData({
          days: mockDays,
          total_tokens_year: 1425000,
          total_requests_year: 480,
          active_days_count: 145,
          peak_day_date: '2026-10-15',
          peak_day_tokens: 85200,
          current_streak_days: 14,
          current_streak_start: '2026-10-21',
          longest_streak_days: 35,
          longest_streak_start: '2026-08-11',
          longest_streak_end: '2026-09-14',
          top_provider: ['gemini', 82.5],
          top_model: 'gemini-2.5-flash',
          busiest_day_of_week: 'Kamis',
          teammates: [
            { name: 'Chatbot', role: 'Chatbot', tokens: 920000 },
            { name: 'Lead Architect', role: 'Lead Architect', tokens: 310000 },
            { name: 'Coder Agent', role: 'Coder Agent', tokens: 195000 },
          ],
        });
        setLoading(false);
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<ActivityHeatmapResult>('get_activity_heatmap');
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  // Transform 365 days into weekly columns for GitHub-style layout
  const { weeks, monthHeaders } = useMemo(() => {
    if (!data?.days || data.days.length === 0) {
      return { weeks: [], monthHeaders: [] };
    }

    const cols: Array<Array<HeatmapDay | null>> = [];
    const headers: Array<{ label: string; colIndex: number }> = [];

    // Tentukan hari pertama
    const firstDateParts = data.days[0].date.split('-').map(Number);
    const firstDateObj = new Date(firstDateParts[0], firstDateParts[1] - 1, firstDateParts[2]);
    // Di JavaScript: 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    // Kita buat 0 = Senin, ..., 6 = Minggu
    let dayOfWeek = firstDateObj.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;

    let currentWeek: Array<HeatmapDay | null> = [];
    // Isi padding hari kosong sebelum hari pertama
    for (let p = 0; p < dayOfWeek; p++) {
      currentWeek.push(null);
    }

    let lastMonth = -1;

    for (let i = 0; i < data.days.length; i++) {
      const day = data.days[i];
      const dParts = day.date.split('-').map(Number);
      const mIdx = dParts[1] - 1;

      if (mIdx !== lastMonth) {
        headers.push({
          label: MONTH_NAMES[mIdx],
          colIndex: cols.length,
        });
        lastMonth = mIdx;
      }

      currentWeek.push(day);

      if (currentWeek.length === 7) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      cols.push(currentWeek);
    }

    return { weeks: cols, monthHeaders: headers };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* 5 Kartu Statistik Utama */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Tokens */}
        <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8b949e]">
            <span className="text-xs font-medium">Tokens</span>
            <Zap className="w-3.5 h-3.5 text-[#39d353]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold tracking-tight text-[#ececec]">
              {loading ? (
                <div className="h-7 w-20 bg-[#303030] rounded animate-pulse" />
              ) : (
                formatCompactTokens(data?.total_tokens_year)
              )}
            </div>
            <div className="text-[11px] text-[#707070] mt-0.5">Past year</div>
          </div>
        </div>

        {/* Card 2: Peak day */}
        <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8b949e]">
            <span className="text-xs font-medium">Peak day</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#26a641]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold tracking-tight text-[#ececec]">
              {loading ? (
                <div className="h-7 w-16 bg-[#303030] rounded animate-pulse" />
              ) : data?.peak_day_tokens ? (
                formatCompactTokens(data.peak_day_tokens)
              ) : (
                '0'
              )}
            </div>
            <div className="text-[11px] text-[#707070] mt-0.5 truncate">
              {formatDateIndo(data?.peak_day_date)}
            </div>
          </div>
        </div>

        {/* Card 3: Messages */}
        <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8b949e]">
            <span className="text-xs font-medium">Messages</span>
            <MessageSquare className="w-3.5 h-3.5 text-[#58a6ff]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold tracking-tight text-[#ececec]">
              {loading ? (
                <div className="h-7 w-16 bg-[#303030] rounded animate-pulse" />
              ) : (
                formatCompactTokens(data?.total_requests_year)
              )}
            </div>
            <div className="text-[11px] text-[#707070] mt-0.5">Past year</div>
          </div>
        </div>

        {/* Card 4: Current streak */}
        <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8b949e]">
            <span className="text-xs font-medium">Current streak</span>
            <Flame className="w-3.5 h-3.5 text-[#f0883e]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold tracking-tight text-[#ececec]">
              {loading ? (
                <div className="h-7 w-16 bg-[#303030] rounded animate-pulse" />
              ) : (
                `${data?.current_streak_days || 0} ${data?.current_streak_days === 1 ? 'day' : 'days'}`
              )}
            </div>
            <div className="text-[11px] text-[#707070] mt-0.5 truncate">
              {data?.current_streak_start
                ? `Since ${formatDateShort(data.current_streak_start)}`
                : 'No active streak'}
            </div>
          </div>
        </div>

        {/* Card 5: Longest streak */}
        <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[#8b949e]">
            <span className="text-xs font-medium">Longest streak</span>
            <Award className="w-3.5 h-3.5 text-[#d29922]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold tracking-tight text-[#ececec]">
              {loading ? (
                <div className="h-7 w-16 bg-[#303030] rounded animate-pulse" />
              ) : (
                `${data?.longest_streak_days || 0} ${data?.longest_streak_days === 1 ? 'day' : 'days'}`
              )}
            </div>
            <div className="text-[11px] text-[#707070] mt-0.5 truncate">
              {data?.longest_streak_start && data?.longest_streak_end
                ? `${formatDateShort(data.longest_streak_start)} - ${formatDateShort(data.longest_streak_end)}`
                : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Kontainer Utama Heatmap (Activity on this computer) */}
      <div className="p-5 rounded-2xl bg-[#262626] border border-[#383838] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#ececec]">
              Activity on this computer
            </h3>
            <p className="text-xs text-[#707070] mt-0.5">
              {data?.active_days_count ?? 0} active days in the past year
            </p>
          </div>
          <button
            type="button"
            onClick={fetchHeatmap}
            title="Muat ulang data aktivitas"
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#b4b4b4] hover:text-[#ececec] bg-[#1f1f1f] border border-[#333333] hover:border-[#444444] transition-colors"
          >
            <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-xs text-red-300">
            Gagal memuat matriks aktivitas: {error}
          </div>
        )}

        {/* Heatmap Grid Wrapper */}
        <div className="overflow-x-auto pb-2 pt-1 select-none relative">
          <div className="inline-block min-w-full">
            {/* Header Bulan */}
            <div className="flex text-[10px] text-[#707070] mb-1.5 ml-7 h-4 relative">
              {monthHeaders.map((m, idx) => (
                <div
                  key={`month-${m.label}-${idx}`}
                  style={{
                    position: 'absolute',
                    left: `${m.colIndex * 15}px`,
                  }}
                  className="font-mono"
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Matrix Body: Row 0..6 (Sen..Min) x Cols */}
            <div className="flex items-start gap-1">
              {/* Day Labels di Kiri */}
              <div className="flex flex-col gap-[3px] text-[9px] text-[#707070] font-mono pr-1.5 pt-[1px] w-5 select-none">
                {DAY_LABELS.map((lbl, idx) => (
                  <div key={`day-label-${idx}`} className="h-[11px] leading-[11px]">
                    {lbl}
                  </div>
                ))}
              </div>

              {/* Columns of weeks */}
              <div className="flex gap-[3px]">
                {weeks.map((week, colIdx) => (
                  <div key={`week-col-${colIdx}`} className="flex flex-col gap-[3px]">
                    {week.map((day, rowIdx) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${colIdx}-${rowIdx}`}
                            className="w-[11px] h-[11px] rounded-[2px] opacity-0"
                          />
                        );
                      }

                      const lvl = day.level;
                      const bgColor = LEVEL_BG[lvl] || LEVEL_BG[0];

                      return (
                        <div
                          key={day.date}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredDay({
                              day,
                              x: rect.left + rect.width / 2,
                              y: rect.top - 8,
                            });
                          }}
                          onMouseLeave={() => setHoveredDay(null)}
                          style={{ backgroundColor: bgColor }}
                          className="w-[11px] h-[11px] rounded-[2px] transition-transform duration-75 hover:scale-125 cursor-pointer outline outline-1 outline-black/20"
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legenda Kurva Less -> More */}
            <div className="flex items-center justify-end gap-1.5 text-[10px] text-[#707070] mt-3 pr-2">
              <span>Less</span>
              <div className="flex items-center gap-[3px]">
                <div className="w-[10px] h-[10px] rounded-[2px] bg-[#21262d] outline outline-1 outline-black/20" />
                <div className="w-[10px] h-[10px] rounded-[2px] bg-[#0e4429] outline outline-1 outline-black/20" />
                <div className="w-[10px] h-[10px] rounded-[2px] bg-[#006d32] outline outline-1 outline-black/20" />
                <div className="w-[10px] h-[10px] rounded-[2px] bg-[#26a641] outline outline-1 outline-black/20" />
                <div className="w-[10px] h-[10px] rounded-[2px] bg-[#39d353] outline outline-1 outline-black/20" />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredDay && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredDay.x}px`,
            top: `${hoveredDay.y}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="px-2.5 py-1.5 rounded-lg bg-[#161b22] border border-[#30363d] text-xs shadow-xl text-center backdrop-blur-md"
        >
          <div className="font-semibold text-[#ececec]">
            {hoveredDay.day.tokens > 0 ? (
              <>
                {hoveredDay.day.tokens.toLocaleString('id-ID')} tokens
                <span className="text-[#8b949e] font-normal">
                  {' '}
                  ({hoveredDay.day.requests} {hoveredDay.day.requests === 1 ? 'request' : 'requests'})
                </span>
              </>
            ) : (
              'Tidak ada aktivitas'
            )}
          </div>
          <div className="text-[10px] text-[#8b949e] mt-0.5">
            {formatDateIndo(hoveredDay.day.date)}
          </div>
        </div>
      )}

      {/* Bagian Bawah: Insights & Most Active Teammates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Insights Card */}
        <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#303030]">
            <Sparkles className="w-4 h-4 text-[#d29922]" />
            <h4 className="text-xs font-semibold text-[#ececec] uppercase tracking-wider">
              Insights
            </h4>
          </div>

          <div className="space-y-3 pt-1">
            {/* Most Used Provider */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ProviderLogo
                  provider={data?.top_provider?.[0] || 'gemini'}
                  className="w-4 h-4"
                />
                <span className="text-xs text-[#b4b4b4]">Most used provider</span>
              </div>
              <span className="text-xs font-mono font-medium text-[#ececec]">
                {data?.top_provider ? (
                  <>
                    <span className="capitalize">{data.top_provider[0]}</span>{' '}
                    <span className="text-[#39d353]">({data.top_provider[1]}%)</span>
                  </>
                ) : (
                  '-'
                )}
              </span>
            </div>

            {/* Top Model */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#58a6ff]" />
                <span className="text-xs text-[#b4b4b4]">Top model</span>
              </div>
              <span className="text-xs font-mono font-medium text-[#ececec] truncate max-w-[180px]">
                {data?.top_model || '-'}
              </span>
            </div>

            {/* Busiest Day */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#f0883e]" />
                <span className="text-xs text-[#b4b4b4]">Busiest day</span>
              </div>
              <span className="text-xs font-medium text-[#ececec]">
                {data?.busiest_day_of_week || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Most Active Teammates Card */}
        <div className="p-4 rounded-xl bg-[#262626] border border-[#383838] space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#303030]">
            <Bot className="w-4 h-4 text-[#39d353]" />
            <h4 className="text-xs font-semibold text-[#ececec] uppercase tracking-wider">
              Most Active Teammates
            </h4>
          </div>

          <div className="space-y-2.5 pt-1">
            {!data?.teammates || data.teammates.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#707070]">
                Belum ada aktivitas agen yang tercatat.
              </div>
            ) : (
              data.teammates.slice(0, 4).map((tm, idx) => (
                <div
                  key={`teammate-${tm.role}-${idx}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#1f1f1f] border border-[#303030]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#2d333b] border border-[#444c56] flex items-center justify-center text-[10px] font-bold text-[#ececec]">
                      {tm.role.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#ececec]">
                        {tm.role}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-mono font-semibold text-[#39d353]">
                    {formatCompactTokens(tm.tokens)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
