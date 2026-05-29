/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

declare var kakao: any;

const API_BASE     = import.meta.env.VITE_API_URL            || "http://localhost:8001";
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_MAPS_API_KEY || "";

// ── 카카오 Maps SDK ──────────────────────────────────────────────
let _sdkPromise: Promise<void> | null = null;
function loadKakaoSDK() {
  if (_sdkPromise) return _sdkPromise;
  if (window.kakao?.maps?.services) return (_sdkPromise = Promise.resolve());
  _sdkPromise = new Promise((resolve, reject) => {
    const prev = document.getElementById("kakao-maps-sdk");
    if (prev) { prev.addEventListener("load", () => kakao.maps.load(resolve)); return; }
    const s   = document.createElement("script");
    s.id      = "kakao-maps-sdk";
    s.src     = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`;
    s.onload  = () => kakao.maps.load(resolve);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _sdkPromise;
}

async function searchKakaoPlaces(query: string) {
  if (!KAKAO_JS_KEY || !query.trim()) return [];
  await loadKakaoSDK();
  return new Promise<{ name: string; address: string; lat: number; lon: number }[]>((resolve) => {
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(query, (results: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK) { resolve([]); return; }
      resolve(results.slice(0, 8).map(d => ({
        name:    d.place_name,
        address: d.address_name,
        lat:     parseFloat(d.y),
        lon:     parseFloat(d.x),
      })));
    });
  });
}

// ── 날씨 ────────────────────────────────────────────────────────
const weatherCodeToType = (c: number) => {
  if ([0, 1].includes(c))                        return "sunny";
  if ([2, 3].includes(c))                        return "cloudy";
  if ([51,53,55,61,63,65,80,81,82].includes(c)) return "rainy";
  if ([71,73,75,77,85,86].includes(c))           return "snow";
  return "cloudy";
};
const WEATHER_META: Record<string, { icon: string; label: string; note: string }> = {
  sunny:  { icon: "☀️", label: "맑음",    note: "실외 코스 포함" },
  cloudy: { icon: "⛅",  label: "흐림",    note: "실내·외 혼합 코스" },
  rainy:  { icon: "🌧️", label: "비",      note: "실내 중심 코스" },
  snow:   { icon: "❄️", label: "눈·추위", note: "따뜻한 실내 코스" },
};

async function fetchWeatherWithFallback(lat: number, lon: number, cityName: string, targetDate?: string) {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const dateParam = targetDate ? `&target_date=${targetDate.replace(/-/g, "")}` : "";
    const res   = await fetch(
      `${API_BASE}/weather/?lat=${lat}&lon=${lon}&region=${encodeURIComponent(cityName || "")}${dateParam}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const d = await res.json();
      if (!d.error && d.pty_code !== null && d.pty_code !== undefined) {
        let type = "cloudy";
        if (d.pty_code > 0) {
          if ([1, 2, 4].includes(d.pty_code)) type = "rainy";
          else if (d.pty_code === 3) type = "snow";
        } else { type = d.sky_code === 1 ? "sunny" : "cloudy"; }
        return { type, temp: d.temperature !== null ? Math.round(d.temperature) : null, cityName: cityName || d.region || "선택 지역", source: "kma", humidity: d.humidity, windSpeed: d.wind_speed, pop: d.pop, skyDesc: d.sky_desc, isOutdoorOk: d.is_outdoor_ok };
      }
    }
  } catch { /* 백엔드 미연결 → 폴백 */ }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tgt   = targetDate ? new Date(targetDate + "T00:00:00") : null;
  if (tgt && tgt >= today) {
    const days = Math.min(Math.ceil((tgt.getTime() - today.getTime()) / 86400000) + 2, 16);
    const w: any = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=${days}`
    ).then(r => r.json());
    const idx = (w.daily?.time || []).indexOf(targetDate);
    if (idx >= 0) {
      const avg = Math.round((w.daily.temperature_2m_max[idx] + w.daily.temperature_2m_min[idx]) / 2);
      return { type: weatherCodeToType(w.daily.weathercode[idx]), temp: avg, cityName: cityName || "선택 지역", source: "openmeteo" };
    }
  }
  const w: any = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weathercode,temperature_2m&timezone=Asia%2FSeoul`
  ).then(r => r.json());
  return { type: weatherCodeToType(w.current.weathercode), temp: Math.round(w.current.temperature_2m), cityName: cityName || "선택 지역", source: "openmeteo" };
}

async function fetchWeatherByCoords(lat: number, lon: number, cityName: string, targetDate?: string) {
  return fetchWeatherWithFallback(lat, lon, cityName, targetDate);
}
async function fetchWeatherByCity(city: string, targetDate?: string) {
  const g: any = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ko`
  ).then(r => r.json());
  if (!g.results?.length) throw new Error("지역을 찾을 수 없어요");
  const { latitude, longitude, name } = g.results[0];
  return fetchWeatherWithFallback(latitude, longitude, name, targetDate);
}

// ── 예산 ────────────────────────────────────────────────────────
const BUDGET_VALUES = [10000,20000,30000,50000,70000,100000,150000,200000,300000,500000,Infinity];
const BUDGET_LABELS = ["1만","2만","3만","5만","7만","10만","15만","20만","30만","50만","∞"];
const fmtBudget = (v: number) => v === Infinity ? "제한없음" : `${v / 10000}만원`;
const snapToBudgetIdx = (raw: string | number) => {
  const num = parseInt(String(raw).replace(/[^0-9]/g, ""), 10);
  if (!num || num <= 0) return 0;
  let bestIdx = 0, bestDiff = Infinity;
  BUDGET_VALUES.forEach((v, i) => {
    const bv = v === Infinity ? 99999999 : v;
    const diff = Math.abs(bv - num);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  });
  return bestIdx;
};

// ── 디자인 시스템 ────────────────────────────────────────────────
const C = {
  bg: "#F5F3FB", card: "#FFFFFF", cardBorder: "#E8E4F4",
  main: "#B8A9D9", mainDim: "#EAE5F5",
  point: "#E8A0B4", pointDim: "#FCE8EE",
  text: "#3D3257", textDim: "#7B6FA0", textMuted: "#B0A8CC",
  inputBg: "#F0EDF9", inputBorder: "#D8D0EE",
  error: "#E87070",
  sky: "#A8C4E0", skyDim: "#DFF0F9",
  green: "#388E3C", greenBg: "#E8F5E9",
};
const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.45} }
  * { box-sizing:border-box; }
  input:focus { border-color:#B8A9D9 !important; outline:none; box-shadow:0 0 0 3px #B8A9D922; }
  input[type=range] { -webkit-appearance:none; appearance:none; height:4px; background:transparent; cursor:pointer; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:#B8A9D9; cursor:grab; border:3px solid #F5F3FB; box-shadow:0 2px 8px #B8A9D950; }
`;

// ── 날짜 헬퍼 ───────────────────────────────────────────────────
const KO_DAYS = ["일","월","화","수","목","금","토"];
function todayStr() { return new Date().toISOString().split("T")[0]; }
function formatDateKo(s: string) {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  const suffix = diff === 0 ? "(오늘)" : diff === 1 ? "(내일)" : `(${KO_DAYS[d.getDay()]}요일)`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${suffix}`;
}
function isWeekendDate(s: string) {
  const dow = new Date(s + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

// ── 기어 메뉴 (ChatPage 스타일) ──────────────────────────────────
function GearMenu() {
  const [open, setOpen] = useState(false);
  const { logout }      = useAuth();
  const navigate        = useNavigate();
  const ref             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: 34, height: 34, borderRadius: "50%", border: `1.5px solid ${C.cardBorder}`, background: open ? C.mainDim : C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.textDim, transition: "all 0.15s" }}
      >⚙</button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 42, background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 12, boxShadow: "0 4px 20px #B8A9D930", minWidth: 150, zIndex: 100, overflow: "hidden" }}>
          <button
            onClick={() => { setOpen(false); navigate("/preferences"); }}
            style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", borderBottom: `1px solid ${C.cardBorder}`, textAlign: "left", fontSize: 14, color: C.text, cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif" }}
          >✦ 취향 재설정</button>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 14, color: "#E87070", cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif" }}
          >→ 로그아웃</button>
        </div>
      )}
    </div>
  );
}

// ── 공통 컴포넌트 ────────────────────────────────────────────────
function PageHeader({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
      <GearMenu />
    </div>
  );
}

function ProgressBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: "999px", background: i < step ? C.main : C.cardBorder, transition: "background 0.3s" }} />
      ))}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel, nextDisabled }: { onBack: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <button onClick={onBack} style={{ flex: 1, padding: 14, background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 14, color: C.textDim, fontSize: 14, cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif" }}>← 이전</button>
      <button onClick={onNext} disabled={nextDisabled} style={{ flex: 2, padding: 14, background: nextDisabled ? C.inputBg : C.main, border: "none", borderRadius: 14, color: nextDisabled ? C.textMuted : "#fff", fontSize: 15, fontWeight: 700, cursor: nextDisabled ? "not-allowed" : "pointer", fontFamily: "'Noto Sans KR',sans-serif", boxShadow: nextDisabled ? "none" : "0 4px 14px #B8A9D940", transition: "all 0.2s" }}>{nextLabel}</button>
    </div>
  );
}

// ── 지역 검색 ────────────────────────────────────────────────────
type RegionValue = { name: string; lat: number | null; lon: number | null } | null;

function RegionInput({ value, onChange }: { value: RegionValue; onChange: (v: RegionValue) => void }) {
  const [query,   setQuery]   = useState(value?.name || "");
  const [results, setResults] = useState<{ name: string; address: string; lat: number; lon: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const ref    = useRef<HTMLDivElement>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const list = await searchKakaoPlaces(q);
      setResults(list); setOpen(list.length > 0);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value; setQuery(q); onChange(null);
    if (KAKAO_JS_KEY) { if (debRef.current) clearTimeout(debRef.current); debRef.current = setTimeout(() => doSearch(q), 350); }
  };
  const handleFreeForm = () => { if (query.trim() && !value?.name) onChange({ name: query.trim(), lat: null, lon: null }); };
  const handleSelect = (r: { name: string; address: string; lat: number; lon: number }) => { setQuery(r.name); setOpen(false); onChange(r); };

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 8 }}>
      <div style={{ position: "relative" }}>
        <input value={query} onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={handleFreeForm}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleFreeForm(); setOpen(false); } }}
          placeholder={KAKAO_JS_KEY ? "지역·장소 검색 (예: 홍대, 해운대)" : "지역명 입력 후 Enter (예: 성수동)"}
          style={{ width: "100%", padding: "14px 16px", background: C.card, border: `1.5px solid ${C.inputBorder}`, borderRadius: 14, color: C.text, fontSize: 15, fontFamily: "'Noto Sans KR',sans-serif" }} />
        {loading && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textMuted, animation: "pulse 1s ease infinite" }}>검색 중</span>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, zIndex: 200, overflow: "hidden", boxShadow: "0 8px 24px #B8A9D930", animation: "fadeIn 0.15s ease" }}>
          {results.map((r, i) => (
            <button key={i} onClick={() => handleSelect(r)}
              style={{ width: "100%", padding: "11px 16px", background: "transparent", border: "none", borderBottom: i < results.length - 1 ? `1px solid ${C.cardBorder}` : "none", color: C.text, fontSize: 14, textAlign: "left", cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif" }}
              onMouseEnter={e => (e.currentTarget.style.background = C.mainDim)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>📍 {r.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{r.address}</div>
            </button>
          ))}
        </div>
      )}
      {value?.name && <p style={{ fontSize: 11, color: C.main, margin: "6px 0 0 4px", fontWeight: 600 }}>✓ {value.name} 선택됨</p>}
    </div>
  );
}

// ── 날씨 배지 ────────────────────────────────────────────────────
function WeatherBadge({ wx, loading }: { wx: any; loading: boolean }) {
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.inputBg, borderRadius: 12, fontSize: 13, color: C.textMuted, animation: "pulse 1.2s ease infinite" }}>
      <span style={{ animation: "spin 1.4s linear infinite", display: "inline-block" }}>◎</span> 날씨 확인 중...
    </div>
  );
  if (!wx) return null;
  const m = WEATHER_META[wx.type];
  const isKMA = wx.source === "kma";
  return (
    <div style={{ padding: "12px 14px", background: C.skyDim, border: `1px solid ${C.sky}44`, borderRadius: 14, animation: "fadeUp 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{m.icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            {wx.cityName} {wx.skyDesc || m.label}{wx.temp !== null ? ` · ${wx.temp}°C` : ""}
            <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: isKMA ? C.greenBg : C.skyDim, color: isKMA ? C.green : C.sky }}>{isKMA ? "기상청" : "open-meteo"}</span>
          </div>
          <div style={{ fontSize: 11, color: C.textDim }}>{m.note}</div>
        </div>
      </div>
    </div>
  );
}

// ── 예산 슬라이더 ────────────────────────────────────────────────
function BudgetSlider({ minIdx, maxIdx, onMinChange, onMaxChange }: { minIdx: number; maxIdx: number; onMinChange: (v: number) => void; onMaxChange: (v: number) => void; }) {
  const [showDirect, setShowDirect] = useState(false);
  const [dMin, setDMin] = useState(""); const [dMax, setDMax] = useState("");
  const applyDirect = () => {
    if (dMin.trim()) onMinChange(Math.min(snapToBudgetIdx(dMin), maxIdx));
    if (dMax.trim()) onMaxChange(Math.max(snapToBudgetIdx(dMax), minIdx));
    setDMin(""); setDMax("");
  };
  const leftPct = (minIdx / 10) * 100, rightPct = (maxIdx / 10) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.textDim }}>1인 예산</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.main }}>{fmtBudget(BUDGET_VALUES[minIdx])} ~ {fmtBudget(BUDGET_VALUES[maxIdx])}</span>
      </div>
      <div style={{ position: "relative", height: 4, background: C.inputBg, borderRadius: 2, margin: "14px 0" }}>
        <div style={{ position: "absolute", left: `${leftPct}%`, width: `${rightPct - leftPct}%`, height: "100%", background: C.main, borderRadius: 2, opacity: 0.7 }} />
        <input type="range" min={0} max={10} value={minIdx} onChange={e => { const v = Number(e.target.value); if (v <= maxIdx) onMinChange(v); }} style={{ position: "absolute", width: "100%", top: -8, left: 0, margin: 0, accentColor: C.main, zIndex: 1 }} />
        <input type="range" min={0} max={10} value={maxIdx} onChange={e => { const v = Number(e.target.value); if (v >= minIdx) onMaxChange(v); }} style={{ position: "absolute", width: "100%", top: -8, left: 0, margin: 0, accentColor: C.main, zIndex: 2 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {BUDGET_LABELS.map((l, i) => <span key={i} style={{ fontSize: 9, color: i === minIdx || i === maxIdx ? C.main : C.textMuted, fontFamily: "monospace" }}>{l}</span>)}
      </div>
      <button onClick={() => setShowDirect(v => !v)} style={{ marginTop: 12, padding: "6px 14px", background: "transparent", border: `1px dashed ${C.inputBorder}`, borderRadius: 8, color: C.textDim, fontSize: 12, cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif" }}>
        {showDirect ? "▲ 슬라이더로" : "⌨️ 금액 직접 입력"}
      </button>
      {showDirect && (
        <div style={{ marginTop: 10, padding: "14px 16px", background: C.inputBg, borderRadius: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "최솟값", val: dMin, set: setDMin }, { label: "최댓값", val: dMax, set: setDMax }].map(({ label, val, set }) => (
              <div key={label} style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: C.main, fontWeight: 600, display: "block", marginBottom: 4 }}>{label} (원)</label>
                <input type="number" value={val} onChange={e => set(e.target.value)} onBlur={applyDirect} onKeyDown={e => e.key === "Enter" && applyDirect()}
                  style={{ width: "100%", padding: "10px 12px", background: C.card, border: `1.5px solid ${C.inputBorder}`, borderRadius: 10, color: C.text, fontSize: 14, fontFamily: "'Noto Sans KR',sans-serif" }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 달력 ────────────────────────────────────────────────────────
function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = todayStr();
  const [view, setView] = useState(() => { const d = new Date((value || today) + "T00:00:00"); return { year: d.getFullYear(), month: d.getMonth() }; });
  const { year: vy, month: vm } = view;
  const prevMonth = () => setView(v => v.month === 0  ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0  } : { ...v, month: v.month + 1 });
  const firstDow = new Date(vy, vm, 1).getDay();
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 20, padding: "16px 14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.inputBg, color: C.textDim, fontSize: 16, cursor: "pointer" }}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "'Noto Sans KR',sans-serif" }}>{vy}년 {vm + 1}월</span>
          <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.inputBg, color: C.textDim, fontSize: 16, cursor: "pointer" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
          {["일","월","화","수","목","금","토"].map((d, i) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0", color: i === 0 ? "#E07070" : i === 6 ? "#6090D0" : C.textMuted }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px" }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={`e${idx}`} />;
            const ds = `${vy}-${String(vm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dow = new Date(vy, vm, day).getDay();
            const isPast = ds < today; const isSel = ds === value; const isToday = ds === today;
            return <button key={ds} onClick={() => !isPast && onChange(ds)} style={{ padding: "8px 2px", borderRadius: 10, border: isToday && !isSel ? `1.5px solid ${C.main}` : "none", background: isSel ? C.main : "transparent", color: isPast ? C.textMuted : isSel ? "#fff" : dow === 0 ? "#E07070" : dow === 6 ? "#6090D0" : C.text, fontSize: 13, fontWeight: isSel || isToday ? 700 : 400, cursor: isPast ? "default" : "pointer", opacity: isPast ? 0.3 : 1, fontFamily: "'Noto Sans KR',sans-serif" }}>{day}</button>;
          })}
        </div>
      </div>
      {value && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600, fontFamily: "'Noto Sans KR',sans-serif" }}>📅 {formatDateKo(value)}</span>
          <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: "999px", fontWeight: 600, background: isWeekendDate(value) ? "#FCE8EE" : C.mainDim, color: isWeekendDate(value) ? C.point : C.main }}>{isWeekendDate(value) ? "주말" : "평일"}</span>
        </div>
      )}
    </div>
  );
}

// ── 로딩 화면 ────────────────────────────────────────────────────
const LOADING_STEPS = ["지역 좌표를 확인하는 중...", "현재 날씨를 확인하는 중...", "취향을 분석하는 중...", "데이트 코스를 구성하는 중..."];
function LoadingScreen({ message }: { message: string }) {
  const stepIdx = LOADING_STEPS.indexOf(message);
  const pct = stepIdx < 0 ? 100 : Math.round(((stepIdx + 1) / LOADING_STEPS.length) * 100);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px", fontFamily: "'Noto Sans KR',sans-serif" }}>
      <style>{GS}</style>
      <div style={{ textAlign: "center", width: "100%", maxWidth: 320 }}>
        <div style={{ fontSize: 44, animation: "spin 1.6s linear infinite", display: "inline-block", marginBottom: 24, color: C.main }}>◎</div>
        <p style={{ color: C.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>코스 생성 중</p>
        <p style={{ color: C.textDim, fontSize: 14, animation: "pulse 1.5s ease infinite", marginBottom: 28 }}>{message}</p>
        <div style={{ background: C.inputBg, borderRadius: "999px", height: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${C.main},${C.point})`, borderRadius: "999px", transition: "width 0.5s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ══════════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [region,    setRegion]    = useState<RegionValue>(null);
  const [dateStr,   setDateStr]   = useState(todayStr());
  const [budgetMin, setBudgetMin] = useState(2);
  const [budgetMax, setBudgetMax] = useState(5);
  const [step,      setStep]      = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [wxPreview, setWxPreview] = useState<any>(null);
  const [wxLoading, setWxLoading] = useState(false);

  const sessionRef = useRef(`df_${Date.now()}`);

  useEffect(() => {
    if (!region?.name) { setWxPreview(null); setWxLoading(false); return; }
    let cancelled = false;
    setWxPreview(null); setWxLoading(true);
    (async () => {
      try {
        const wx = region.lat
          ? await fetchWeatherByCoords(region.lat, region.lon!, region.name, dateStr)
          : await fetchWeatherByCity(region.name, dateStr);
        if (!cancelled) setWxPreview(wx);
      } catch { if (!cancelled) setWxPreview(null); }
      finally  { if (!cancelled) setWxLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [region, dateStr]);

  const handleGenerate = async () => {
    setLoadingMsg(LOADING_STEPS[0]);
    let lat = region?.lat || 37.5665, lon = region?.lon || 126.9780, cityName = region?.name || "";
    if (!region?.lat) {
      try {
        const g: any = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=ko`).then(r => r.json());
        if (g.results?.length) { lat = g.results[0].latitude; lon = g.results[0].longitude; cityName = g.results[0].name; }
      } catch { /* ignore */ }
    }
    setLoadingMsg(LOADING_STEPS[1]);
    let weatherObj = wxPreview || { type: "cloudy", temp: null, cityName };
    if (!wxPreview) { try { weatherObj = await fetchWeatherByCoords(lat, lon, cityName); } catch { /* ignore */ } }

    setLoadingMsg(LOADING_STEPS[2]);
    const budgetMaxVal = BUDGET_VALUES[budgetMax] === Infinity ? 999999 : BUDGET_VALUES[budgetMax];
    const budgetMinVal = BUDGET_VALUES[budgetMin];

    setLoadingMsg(LOADING_STEPS[3]);
    let courseData: any = null;
    try {
      const res = await fetch(`${API_BASE}/courses/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({
          user_id:    user?.user_id ?? sessionRef.current,
          region:     cityName,
          lat,
          lon,
          date:       dateStr,
          weather:    weatherObj.type,
          temp:       weatherObj.temp ?? null,
          budget_min: budgetMinVal,
          budget_max: budgetMaxVal,
        }),
      });
      if (res.ok) courseData = await res.json();
    } catch { /* ignore — result page uses fallback */ }

    setLoadingMsg("결과 페이지로 이동합니다 ✦");
    await new Promise(r => setTimeout(r, 700));
    navigate("/result", { state: { courseData } });
  };

  const wrap  = { minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR',sans-serif", display: "flex" as const, flexDirection: "column" as const, alignItems: "center" as const, padding: "0 0 80px" };
  const inner = { maxWidth: "420px", width: "100%", padding: "40px 20px 0" };

  if (loadingMsg) return <LoadingScreen message={loadingMsg} />;

  // ── STEP 0: 날짜 + 지역 ─────────────────────────────────────
  if (step === 0) return (
    <div style={wrap}><style>{GS}</style>
      <div style={{ ...inner, animation: "fadeUp 0.4s ease" }}>
        <PageHeader title="데이트 설정" />
        <ProgressBar step={0} total={2} />

        <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 8, fontWeight: 500 }}>📅 날짜</label>
        <CalendarPicker value={dateStr} onChange={setDateStr} />

        <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 8, fontWeight: 500, marginTop: 4 }}>📍 지역</label>
        <RegionInput value={region} onChange={setRegion} />

        <div style={{ marginTop: 8, marginBottom: 20, minHeight: wxLoading ? 48 : 0 }}>
          <WeatherBadge wx={wxPreview} loading={wxLoading && !wxPreview} />
        </div>

        <button onClick={() => setStep(1)} disabled={!region?.name} style={{ width: "100%", padding: 16, background: region?.name ? C.main : C.inputBg, color: region?.name ? "#fff" : C.textMuted, border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: region?.name ? "pointer" : "not-allowed", fontFamily: "'Noto Sans KR',sans-serif", boxShadow: region?.name ? "0 4px 20px #B8A9D950" : "none", transition: "all 0.2s" }}>
          예산 설정 →
        </button>
      </div>
    </div>
  );

  // ── STEP 1: 예산 + 요약 ─────────────────────────────────────
  return (
    <div style={wrap}><style>{GS}</style>
      <div style={{ ...inner, animation: "fadeUp 0.35s ease" }}>
        <PageHeader title="예산 설정" />
        <ProgressBar step={1} total={2} />

        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 20, padding: "20px 20px 24px", marginBottom: 20, boxShadow: "0 2px 12px #B8A9D912" }}>
          <BudgetSlider minIdx={budgetMin} maxIdx={budgetMax} onMinChange={setBudgetMin} onMaxChange={setBudgetMax} />
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.main, marginBottom: 10, fontWeight: 700 }}>✦ 입력 요약</div>
          {[
            { k: "지역", v: region?.name || "" },
            { k: "날짜", v: formatDateKo(dateStr) },
            { k: "날씨", v: wxPreview ? `${WEATHER_META[wxPreview.type].label} · ${wxPreview.temp ?? "?"}°C` : "자동 확인" },
            { k: "예산", v: `${fmtBudget(BUDGET_VALUES[budgetMin])} ~ ${fmtBudget(BUDGET_VALUES[budgetMax])}` },
          ].map(({ k, v }) => (
            <div key={k} style={{ display: "flex", gap: 10, fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: C.textMuted, width: 40, flexShrink: 0 }}>{k}</span>
              <span style={{ color: C.text }}>{v}</span>
            </div>
          ))}
        </div>

        <NavButtons onBack={() => setStep(0)} onNext={handleGenerate} nextLabel="코스 생성 ✦" />
      </div>
    </div>
  );
}
