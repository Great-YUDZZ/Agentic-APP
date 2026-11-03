import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  RotateCw,
  Search,
  Server,
  Layers,
  Clock,
  BarChart3,
  Cpu,
} from 'lucide-react';
import {
  UsagePeriod,
  UsageStatsResult,
  UsageChartPoint,
  UsageRecord,
  ProviderUsageSummary,
} from '../../types';
import { ProviderLogo } from '../common/ProviderLogos';
import { ActivityHeatmap } from './ActivityHeatmap';
import { useStore } from '../../store/useStore';

const PERIODS: { value: UsagePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '60d', label: '60D' },
  { value: 'all', label: 'All' },
];

function fmtNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0';
  return new Intl.NumberFormat().format(n);
}

function fmtTokensCompact(n: number | undefined | null): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(isoString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'recently';
  }
}

// Sub-komponen waktu relatif yang auto update tanpa re-render induk
function TimeAgoItem({ timestamp }: { timestamp: string }) {
  const [ago, setAgo] = useState(() => timeAgo(timestamp));

  useEffect(() => {
    setAgo(timeAgo(timestamp));
    const interval = setInterval(() => {
      setAgo(timeAgo(timestamp));
    }, 5000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <>{ago}</>;
}

// Sub-komponen Topologi Provider Aktif (Flat Design dengan Logo Resmi SVG & Animated Pulse Curves)
function ProviderTopologyMap({
  byProvider,
  recentRequests,
}: {
  byProvider: Record<string, ProviderUsageSummary>;
  recentRequests: UsageRecord[];
}) {
  const { apiKeys } = useStore();

  const providerKeys = useMemo(() => {
    const list: string[] = [];

    // 1. Tambahkan provider yang kuncinya aktif di Pengaturan
    (apiKeys || []).forEach((k) => {
      if (k.is_active === false) return;
      if (k.provider.startsWith('custom')) {
        const label = k.name?.trim() || k.provider;
        if (!list.includes(label)) list.push(label);
      } else if (k.api_key && k.api_key.trim().length > 0) {
        if (!list.includes(k.provider)) list.push(k.provider);
      }
    });

    // 2. Tambahkan provider yang memiliki riwayat penggunaan di basis data
    Object.keys(byProvider || {}).forEach((k) => {
      if (!list.includes(k)) list.push(k);
    });

    return list;
  }, [byProvider, apiKeys]);

  const lastUsedProvider = recentRequests[0]?.provider?.toLowerCase() || '';

  const leftProviders = useMemo(() => {
    return providerKeys.slice(0, Math.ceil(providerKeys.length / 2));
  }, [providerKeys]);

  const rightProviders = useMemo(() => {
    return providerKeys.slice(Math.ceil(providerKeys.length / 2));
  }, [providerKeys]);

  return (
    <div className="flex flex-col h-[320px] rounded-2xl bg-[#262626] border border-[#383838] p-4 relative overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-[#303030] shrink-0">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[#ececec]" />
          <span className="text-xs font-semibold text-[#ececec] uppercase tracking-wider">
            Provider Topology Map
          </span>
        </div>
        <span className="text-[11px] text-[#707070]">
          {providerKeys.length} provider terdeteksi
        </span>
      </div>

      {providerKeys.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2.5">
          <div className="w-11 h-11 rounded-2xl bg-[#1e1e1e] border border-[#333333] flex items-center justify-center text-[#707070]">
            <Server className="w-5 h-5 stroke-1" />
          </div>
          <div className="space-y-1 max-w-xs">
            <h4 className="text-xs font-semibold text-[#ececec]">Belum Ada Provider Terhubung</h4>
            <p className="text-[11px] text-[#707070] leading-relaxed">
              Tambahkan kunci API atau Custom Endpoint lokal (seperti LM Studio) di menu Pengaturan Models untuk mulai memantau topologi.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative flex items-center justify-center p-2">
          {/* SVG Connecting Curves */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 400 240"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="curveGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#ececec" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Left connections (from x=110 to center x=200, y=120) */}
            {leftProviders.map((prov, i) => {
              const count = leftProviders.length;
              const yStart = count === 1 ? 120 : 55 + (i / Math.max(1, count - 1)) * 130;
              const isRecent = prov.toLowerCase() === lastUsedProvider;
              const d = `M 110 ${yStart} C 150 ${yStart}, 160 120, 195 120`;
              return (
                <g key={`curve-left-${prov}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={isRecent ? 'url(#curveGradientActive)' : '#333333'}
                    strokeWidth={isRecent ? '2' : '1.2'}
                    strokeDasharray={isRecent ? '5 4' : '3 3'}
                    className={isRecent ? 'animate-pulse' : ''}
                  />
                </g>
              );
            })}

            {/* Right connections (from center x=200, y=120 to x=290) */}
            {rightProviders.map((prov, i) => {
              const count = rightProviders.length;
              const yEnd = count === 1 ? 120 : 55 + (i / Math.max(1, count - 1)) * 130;
              const isRecent = prov.toLowerCase() === lastUsedProvider;
              const d = `M 205 120 C 240 120, 250 ${yEnd}, 290 ${yEnd}`;
              return (
                <g key={`curve-right-${prov}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={isRecent ? 'url(#curveGradientActive)' : '#333333'}
                    strokeWidth={isRecent ? '2' : '1.2'}
                    strokeDasharray={isRecent ? '5 4' : '3 3'}
                    className={isRecent ? 'animate-pulse' : ''}
                  />
                </g>
              );
            })}
          </svg>

          {/* Pusat Hub Node */}
          <div className="relative z-10 flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-[#171717] border-2 border-[#4f4f4f] shadow-lg text-center p-2">
            <div className="w-8 h-8 rounded-xl bg-[#2f2f2f] flex items-center justify-center mb-1 text-[#ececec] border border-[#383838]">
              <Cpu className="w-4 h-4 text-[#ececec]" />
            </div>
            <span className="text-xs font-bold text-[#ececec]">Nodra</span>
            <span className="text-[9px] text-[#707070] font-mono">Tokio Core</span>
          </div>

          {/* Orbit Nodes Provider */}
          <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
            {/* Kolom Kiri */}
            <div className="flex flex-col gap-2.5 pointer-events-auto max-w-[130px]">
              {leftProviders.map((prov) => {
                const info = byProvider[prov];
                const isRecent = prov.toLowerCase() === lastUsedProvider;
                return (
                  <div
                    key={prov}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                      isRecent
                        ? 'bg-[#2f2f2f] border-[#4f4f4f] text-[#ececec] shadow-sm'
                        : 'bg-[#1b1b1b] border-[#303030] text-[#b4b4b4] hover:border-[#383838]'
                    }`}
                    title={`${prov} - ${fmtNumber(info?.requests || 0)} requests`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#242424] border border-[#333333] flex items-center justify-center text-[#ececec] shrink-0">
                      <ProviderLogo provider={prov} size={14} />
                    </div>
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="font-semibold capitalize text-[#ececec] truncate text-[11px] leading-tight">
                        {prov}
                      </span>
                      <span className="text-[9px] text-[#707070] leading-none mt-0.5">
                        {fmtNumber(info?.requests || 0)} req
                      </span>
                    </div>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ml-auto shrink-0 ${
                        isRecent ? 'bg-emerald-400 animate-pulse' : 'bg-[#555555]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Kolom Kanan */}
            <div className="flex flex-col gap-2.5 pointer-events-auto max-w-[130px]">
              {rightProviders.map((prov) => {
                const info = byProvider[prov];
                const isRecent = prov.toLowerCase() === lastUsedProvider;
                return (
                  <div
                    key={prov}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                      isRecent
                        ? 'bg-[#2f2f2f] border-[#4f4f4f] text-[#ececec] shadow-sm'
                        : 'bg-[#1b1b1b] border-[#303030] text-[#b4b4b4] hover:border-[#383838]'
                    }`}
                    title={`${prov} - ${fmtNumber(info?.requests || 0)} requests`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#242424] border border-[#333333] flex items-center justify-center text-[#ececec] shrink-0">
                      <ProviderLogo provider={prov} size={14} />
                    </div>
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="font-semibold capitalize text-[#ececec] truncate text-[11px] leading-tight">
                        {prov}
                      </span>
                      <span className="text-[9px] text-[#707070] leading-none mt-0.5">
                        {fmtNumber(info?.requests || 0)} req
                      </span>
                    </div>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ml-auto shrink-0 ${
                        isRecent ? 'bg-emerald-400 animate-pulse' : 'bg-[#555555]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// Sub-komponen Tabel Recent Requests
function RecentRequestsCard({ requests }: { requests: UsageRecord[] }) {
  return (
    <div className="flex flex-col h-[320px] rounded-2xl bg-[#262626] border border-[#383838] p-4 overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-[#303030] shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#ececec]" />
          <span className="text-xs font-semibold text-[#ececec] uppercase tracking-wider">
            Recent Requests
          </span>
        </div>
        <span className="text-[11px] text-[#707070]">
          {requests.length} tercatat
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <p className="text-xs text-[#707070]">Belum ada permintaan API tercatat.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto mt-2 pr-1 space-y-1.5 scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#262626] z-10 text-[10px] uppercase tracking-wider text-[#707070] border-b border-[#303030]">
              <tr>
                <th className="py-1.5 px-2 w-3"></th>
                <th className="py-1.5 px-2 font-semibold">Model</th>
                <th className="py-1.5 px-2 font-semibold text-right">In / Out</th>
                <th className="py-1.5 px-2 font-semibold text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303030]">
              {requests.map((r) => {
                const isOk = !r.status || r.status === 'ok' || r.status === 'success';
                return (
                  <tr key={r.id} className="hover:bg-[#2f2f2f] transition-colors">
                    <td className="py-2 px-2">
                      <span
                        className={`block w-1.5 h-1.5 rounded-full ${
                          isOk ? 'bg-emerald-400' : 'bg-rose-500'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-2 font-mono text-[11px] text-[#ececec] truncate max-w-[130px]" title={r.model}>
                      {r.model}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap font-mono text-[11px]">
                      <span className="text-[#ececec] font-medium">{fmtTokensCompact(r.prompt_tokens)}↑</span>
                      {' '}
                      <span className="text-emerald-400 font-medium">{fmtTokensCompact(r.completion_tokens)}↓</span>
                    </td>
                    <td className="py-2 px-2 text-right text-[10px] text-[#707070] whitespace-nowrap">
                      <TimeAgoItem timestamp={r.timestamp} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Sub-komponen Responsive SVG Curve Line Chart
function TokenUsageSvgChart({
  data,
  viewMetric,
}: {
  data: UsageChartPoint[];
  viewMetric: 'tokens' | 'requests';
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = useMemo(() => {
    return data.map((d) => (viewMetric === 'tokens' ? d.tokens : d.requests));
  }, [data, viewMetric]);

  const maxVal = useMemo(() => {
    const m = Math.max(...values, 0);
    return m === 0 ? 10 : m;
  }, [values]);

  const width = 640;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const points = useMemo(() => {
    if (data.length === 0) return [];
    if (data.length === 1) {
      const y = paddingTop + chartH - (values[0] / maxVal) * chartH;
      return [{ x: paddingLeft + chartW / 2, y, val: values[0], label: data[0].label, data: data[0] }];
    }
    const stepX = chartW / (data.length - 1);
    return data.map((d, i) => {
      const x = paddingLeft + i * stepX;
      const y = paddingTop + chartH - (values[i] / maxVal) * chartH;
      return { x, y, val: values[i], label: d.label, data: d };
    });
  }, [data, values, maxVal, chartW, chartH]);

  // Bangun smooth curve path SVG (Bezier Catmull-Rom atau cubic bezier)
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 2;
      const cpY1 = curr.y;
      const cpX2 = curr.x + (next.x - curr.x) / 2;
      const cpY2 = next.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    return d;
  }, [points]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = paddingTop + chartH;
    return `${pathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [pathD, points, paddingTop, chartH]);

  const hasAnyData = values.some((v) => v > 0);

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[220px] overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ececec" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ececec" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines horizontal */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = paddingTop + chartH * (1 - pct);
          const valAtPct = Math.round(maxVal * pct);
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#303030"
                strokeDasharray="3 3"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                fill="#707070"
                fontSize="9"
                textAnchor="end"
                fontFamily="monospace"
              >
                {viewMetric === 'tokens' ? fmtTokensCompact(valAtPct) : fmtNumber(valAtPct)}
              </text>
            </g>
          );
        })}

        {hasAnyData && (
          <>
            {/* Area Fill */}
            <path d={areaD} fill="url(#areaGradient)" />

            {/* Line Path */}
            <path
              d={pathD}
              fill="none"
              stroke="#ececec"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {points.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={hoverIndex === i ? 5 : 3}
                fill="#171717"
                stroke="#ececec"
                strokeWidth={hoverIndex === i ? 2.5 : 1.5}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
            ))}
          </>
        )}

        {/* Labels Sumbu X */}
        {points.map((pt, i) => {
          // Hanya tampilkan label secukupnya agar tidak tumpang tindih
          const showLabel =
            points.length <= 10 ||
            i === 0 ||
            i === points.length - 1 ||
            i % Math.ceil(points.length / 6) === 0;

          if (!showLabel) return null;

          return (
            <text
              key={i}
              x={pt.x}
              y={height - 10}
              fill="#707070"
              fontSize="10"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              {pt.label}
            </text>
          );
        })}

        {/* Vertical Hover Indicator */}
        {hoverIndex !== null && points[hoverIndex] && (
          <line
            x1={points[hoverIndex].x}
            y1={paddingTop}
            x2={points[hoverIndex].x}
            y2={paddingTop + chartH}
            stroke="#4f4f4f"
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Floating Tooltip */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div
          className="absolute z-30 pointer-events-none px-3 py-2 rounded-xl bg-[#171717] border border-[#383838] shadow-xl text-xs space-y-1 transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${(points[hoverIndex].x / width) * 100}%`,
            top: `${(points[hoverIndex].y / height) * 100 - 8}%`,
          }}
        >
          <div className="font-semibold text-[#ececec]">
            {points[hoverIndex].label}
          </div>
          <div className="text-[11px] text-[#b4b4b4] flex items-center justify-between gap-4 font-mono">
            <span>Tokens:</span>
            <span className="text-[#ececec] font-bold">
              {fmtNumber(points[hoverIndex].data.tokens)}
            </span>
          </div>
          <div className="text-[11px] text-[#707070] flex items-center justify-between gap-4 font-mono">
            <span>Requests:</span>
            <span>{fmtNumber(points[hoverIndex].data.requests)}</span>
          </div>
          <div className="text-[10px] text-[#707070] flex items-center justify-between gap-4 font-mono pt-1 border-t border-[#262626]">
            <span>In / Out:</span>
            <span>
              {fmtTokensCompact(points[hoverIndex].data.prompt_tokens)}↑ / {fmtTokensCompact(points[hoverIndex].data.completion_tokens)}↓
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function UsageAnalyticsTab() {
  const [subTab, setSubTab] = useState<'overview' | 'details'>('overview');
  const [period, setPeriod] = useState<UsagePeriod>('7d');
  const [viewMetric, setViewMetric] = useState<'tokens' | 'requests'>('tokens');
  const [modelSearch, setModelSearch] = useState('');
  const [sortField, setSortField] = useState<'total_tokens' | 'requests' | 'raw_model'>('total_tokens');
  const [sortAsc, setSortAsc] = useState(false);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStatsResult | null>(null);
  const [chartData, setChartData] = useState<UsageChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      if (!isTauri) {
        // Mock data jika diuji di browser non-Tauri
        setStats({
          total_requests: 12,
          total_prompt_tokens: 14200,
          total_completion_tokens: 3800,
          total_cached_tokens: 1200,
          total_tokens: 18000,
          by_model: {
            'lfm3:1.7b|ollama': {
              requests: 8,
              prompt_tokens: 9500,
              completion_tokens: 2400,
              cached_tokens: 800,
              total_tokens: 11900,
              raw_model: 'lfm3:1.7b',
              provider: 'ollama',
              last_used: new Date().toISOString(),
            },
            'gemini-2.5-flash|gemini': {
              requests: 4,
              prompt_tokens: 4700,
              completion_tokens: 1400,
              cached_tokens: 400,
              total_tokens: 6100,
              raw_model: 'gemini-2.5-flash',
              provider: 'gemini',
              last_used: new Date(Date.now() - 3600000).toISOString(),
            },
          },
          by_provider: {
            ollama: {
              requests: 8,
              prompt_tokens: 9500,
              completion_tokens: 2400,
              cached_tokens: 800,
              total_tokens: 11900,
              provider: 'ollama',
            },
            gemini: {
              requests: 4,
              prompt_tokens: 4700,
              completion_tokens: 1400,
              cached_tokens: 400,
              total_tokens: 6100,
              provider: 'gemini',
            },
          },
          recent_requests: [
            {
              id: 1,
              timestamp: new Date().toISOString(),
              provider: 'ollama',
              model: 'lfm3:1.7b',
              prompt_tokens: 817,
              completion_tokens: 5,
              cached_tokens: 0,
              status: 'ok',
            },
          ],
        });
        setChartData([
          { label: 'Day 1', tokens: 1200, prompt_tokens: 1000, completion_tokens: 200, cached_tokens: 0, requests: 2 },
          { label: 'Day 2', tokens: 3400, prompt_tokens: 2800, completion_tokens: 600, cached_tokens: 200, requests: 3 },
          { label: 'Day 3', tokens: 5800, prompt_tokens: 4600, completion_tokens: 1200, cached_tokens: 400, requests: 4 },
          { label: 'Day 4', tokens: 18000, prompt_tokens: 14200, completion_tokens: 3800, cached_tokens: 1200, requests: 12 },
        ]);
        setLoading(false);
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const [fetchedStats, fetchedChart] = await Promise.all([
        invoke<UsageStatsResult>('get_usage_stats', { period }),
        invoke<UsageChartPoint[]>('get_usage_chart', { period }),
      ]);
      setStats(fetchedStats);
      setChartData(fetchedChart);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Model list array dengan filter & sort
  const filteredModels = useMemo(() => {
    if (!stats?.by_model) return [];
    let list = Object.values(stats.by_model);

    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.raw_model.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [stats?.by_model, modelSearch, sortField, sortAsc]);

  const handleSort = (field: 'total_tokens' | 'requests' | 'raw_model') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Sub-tab Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#2e2e2e]">
        <div>
          <h3 className="text-base font-semibold text-[#ececec] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#ececec]" />
            Usage & Analytics
          </h3>
          <p className="text-xs text-[#707070] mt-0.5">
            Pantau konsumsi token, topologi provider aktif, dan riwayat permintaan model.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Sub-tab Pill Toggle */}
          <div className="flex items-center rounded-xl bg-[#171717] border border-[#303030] p-1">
            <button
              type="button"
              onClick={() => setSubTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subTab === 'overview'
                  ? 'bg-[#262626] text-[#ececec] font-semibold'
                  : 'text-[#707070] hover:text-[#ececec]'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setSubTab('details')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subTab === 'details'
                  ? 'bg-[#262626] text-[#ececec] font-semibold'
                  : 'text-[#707070] hover:text-[#ececec]'
              }`}
            >
              Details
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-xl bg-[#262626] border border-[#383838] text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors"
            title="Muat ulang analitik"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Period Filter Selector */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#b4b4b4]">Rentang Waktu:</span>
        <div className="flex items-center gap-1 rounded-xl bg-[#171717] border border-[#303030] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-[#262626] text-[#ececec] font-semibold'
                  : 'text-[#707070] hover:text-[#ececec]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Boundary State: Error */}
      {error && (
        <div className="p-4 rounded-xl bg-[#2f2f2f] border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>Gagal memuat analitik: {error}</span>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="px-2.5 py-1 rounded-lg bg-[#262626] hover:bg-[#383838] text-[#ececec] border border-[#383838]"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 4 Metric Cards (Flat Solid Surfaces) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Requests */}
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-[#262626] border border-[#383838]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
            Total Requests
          </span>
          <div className="text-2xl font-bold text-[#ececec] font-mono mt-1">
            {loading ? '-' : fmtNumber(stats?.total_requests)}
          </div>
          <span className="text-[10px] text-[#707070]">Permintaan selesai diproses</span>
        </div>

        {/* Card 2: Total Input Tokens */}
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-[#262626] border border-[#383838]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
            Total Input Tokens
          </span>
          <div className="text-2xl font-bold text-[#ececec] font-mono mt-1">
            {loading ? '-' : fmtNumber(stats?.total_prompt_tokens)}
          </div>
          <span className="text-[10px] text-[#707070]">Prompt dan konteks masuk</span>
        </div>

        {/* Card 3: Cached Tokens */}
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-[#262626] border border-[#383838]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
            Cached Tokens
          </span>
          <div className="text-2xl font-bold text-sky-400 font-mono mt-1">
            {loading ? '-' : fmtNumber(stats?.total_cached_tokens)}
          </div>
          <span className="text-[10px] text-[#707070]">Token dari cache provider</span>
        </div>

        {/* Card 4: Output Tokens */}
        <div className="flex flex-col gap-1 p-4 rounded-2xl bg-[#262626] border border-[#383838]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#707070]">
            Output Tokens
          </span>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {loading ? '-' : fmtNumber(stats?.total_completion_tokens)}
          </div>
          <span className="text-[10px] text-[#707070]">Generasi respons teks</span>
        </div>
      </div>

      {/* Sub-tab Content: Overview */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          {/* Provider Topology & Recent Requests (2 Kolom) */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)] gap-4">
            <ProviderTopologyMap
              byProvider={stats?.by_provider || {}}
              recentRequests={stats?.recent_requests || []}
            />
            <RecentRequestsCard requests={stats?.recent_requests || []} />
          </div>

          {/* Developer Activity Heatmap (GitHub Style) */}
          <ActivityHeatmap />
        </div>
      )}

      {/* Sub-tab Content: Details */}
      {subTab === 'details' && (
        <div className="space-y-6">
          {/* Chart Card dengan Toggle Tokens vs Requests */}
          <div className="p-5 rounded-2xl bg-[#262626] border border-[#383838] space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#ececec]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#ececec]">
                  Kurva Konsumsi Token & Permintaan
                </span>
              </div>

              {/* Toggle View Metric */}
              <div className="flex items-center rounded-xl bg-[#171717] border border-[#303030] p-1">
                <button
                  type="button"
                  onClick={() => setViewMetric('tokens')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMetric === 'tokens'
                      ? 'bg-[#262626] text-[#ececec] font-semibold'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  Tokens
                </button>
                <button
                  type="button"
                  onClick={() => setViewMetric('requests')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMetric === 'requests'
                      ? 'bg-[#262626] text-[#ececec] font-semibold'
                      : 'text-[#707070] hover:text-[#ececec]'
                  }`}
                >
                  Requests
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-[#707070]">
                Memuat grafik analitik...
              </div>
            ) : (
              <TokenUsageSvgChart data={chartData} viewMetric={viewMetric} />
            )}
          </div>

          {/* Model Breakdown Table */}
          <div className="p-5 rounded-2xl bg-[#262626] border border-[#383838] space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#ececec]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#ececec]">
                  Usage by Model
                </span>
              </div>

              {/* Search input */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari model atau provider..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#171717] border border-[#303030] text-[#ececec] placeholder-[#707070] focus:outline-none focus:border-[#4f4f4f]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#303030] text-[10px] uppercase tracking-wider text-[#707070]">
                    <th
                      className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[#ececec]"
                      onClick={() => handleSort('raw_model')}
                    >
                      Model / Provider
                    </th>
                    <th
                      className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-[#ececec]"
                      onClick={() => handleSort('requests')}
                    >
                      Requests
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">Input Tokens</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cached</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Output Tokens</th>
                    <th
                      className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-[#ececec]"
                      onClick={() => handleSort('total_tokens')}
                    >
                      Total Tokens
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right">Last Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#303030]">
                  {filteredModels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#707070] text-xs">
                        Tidak ada model yang cocok dengan kriteria.
                      </td>
                    </tr>
                  ) : (
                    filteredModels.map((m) => (
                      <tr key={`${m.raw_model}-${m.provider}`} className="hover:bg-[#2f2f2f] transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs text-[#ececec] font-medium">
                              {m.raw_model}
                            </span>
                            <span className="text-[10px] text-[#707070] capitalize">
                              {m.provider}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#ececec]">
                          {fmtNumber(m.requests)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#b4b4b4]">
                          {fmtNumber(m.prompt_tokens)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-sky-400">
                          {fmtNumber(m.cached_tokens)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                          {fmtNumber(m.completion_tokens)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#ececec] font-bold">
                          {fmtNumber(m.total_tokens)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[10px] text-[#707070] whitespace-nowrap">
                          {m.last_used ? <TimeAgoItem timestamp={m.last_used} /> : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
