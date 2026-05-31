import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { CoursePlace, CourseResult, WeatherType } from "../types/course";
import { mockCourseData, mockCourseDataA } from "../mocks/courseData";
import PreferenceIntersection from "../components/PreferenceIntersection";
import CourseTimeline from "../components/CourseTimeline";
import PlaceDetailCard from "../components/PlaceDetailCard";
import KakaoMap from "../components/KakaoMap";
import { getWeatherEmoji } from "../utils/getWeatherEmoji";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function mapCategory(cat: string): CoursePlace["category"] {
    if (cat.includes("카페")) return "cafe";
    if (cat.includes("식당") || cat.includes("레스토랑")) return "restaurant";
    if (cat.includes("바") || cat.includes("펍")) return "restaurant";
    if (cat.includes("쇼핑") || cat.includes("팝업")) return "shopping";
    if (cat.includes("전시") || cat.includes("갤러리")) return "culture";
    return "activity";
}

type BackendPlace = { name: string; category?: string; time?: string; price?: number; latitude?: string; longitude?: string };

function adaptPlaces(backendPlaces: BackendPlace[], budget: number): CoursePlace[] {
    const fallbackTimes = ["13:00", "15:30", "18:00", "20:00"];
    return backendPlaces.map((p, i) => {
        const cost = p.price || 0;
        return {
            time:                p.time || fallbackTimes[i] || "13:00",
            name:                p.name,
            desc:                p.category || "",
            category:            mapCategory(p.category || ""),
            spaceType:           "indoor" as const,
            satisfactionA:       70 + ((p.name.charCodeAt(0) || 0) % 25),
            satisfactionB:       68 + ((p.name.charCodeAt(1) || 0) % 27),
            lat:                 p.latitude  ? parseFloat(p.latitude)  : 37.5665,
            lon:                 p.longitude ? parseFloat(p.longitude) : 126.9780,
            estimatedCost:       cost,
            budgetRatio:         budget > 0 ? Math.round((cost / budget) * 100) : 0,
            isOverBudget:        cost > budget,
            recommendedMenus:    [],
            reservationAvailable: false,
            relationKeywords:    [],
            travelTimeToNext:    10,
            travelModeToNext:    "walk" as const,
        };
    });
}

type CourseTab = "A" | "B";

function initCourseData(): CourseResult {
    const p       = new URLSearchParams(window.location.search);
    const region  = p.get("region") || "";
    const tagsA   = (p.get("tagsA") || "").split(",").filter(Boolean);
    const tagsB   = (p.get("tagsB") || "").split(",").filter(Boolean);
    const common  = tagsA.filter(t => tagsB.includes(t));
    const bMaxA   = parseInt(p.get("budgetMaxA") || "0");
    const bMaxB   = parseInt(p.get("budgetMaxB") || "0");
    // budget URL param = 백엔드용 교집합 최솟값이므로 표시 예산으로 쓰지 않음
    const budget  = bMaxA > 0 && bMaxB > 0 ? bMaxA + bMaxB : mockCourseData.budget;
    const weather = (p.get("weather") || "cloudy") as WeatherType;
    return {
        ...mockCourseData,
        title:   region ? `${region} 데이트 코스` : mockCourseData.title,
        tagsA: tagsA.length > 0 ? tagsA : mockCourseData.tagsA,
        tagsB: tagsB.length > 0 ? tagsB : mockCourseData.tagsB,
        common:  tagsA.length > 0 || tagsB.length > 0 ? common : mockCourseData.common,
        budget,
        weather: {
            pop: parseInt(p.get("pop") || "0"),
            weatherType:       weather,
            description:       p.get("skyDesc") || weather,
        },
    };
}

export default function CourseResultPage() {
    const navigate = useNavigate();

    const [selectedPlace, setSelectedPlace] = useState<CoursePlace | null>(null);
    const [courseData]                      = useState<CourseResult>(initCourseData);
    const [placesA, setPlacesA]             = useState<CoursePlace[]>(mockCourseDataA.places);
    const [placesB, setPlacesB]             = useState<CoursePlace[]>(mockCourseData.places);
    const [activeTab, setActiveTab]         = useState<CourseTab>(() => {
        const p = new URLSearchParams(window.location.search);
        return (p.get("course") as CourseTab) || "A";
    });
    const [isLoading, setIsLoading]         = useState(false);

    const places    = activeTab === "A" ? placesA : placesB;
    const setPlaces = activeTab === "A" ? setPlacesA : setPlacesB;

    useEffect(() => {
        const params  = new URLSearchParams(window.location.search);
        const session = params.get("session");
        if (!session) return;

        const region  = params.get("region") || "";
        const lat     = parseFloat(params.get("lat") || "37.5665");
        const lon     = parseFloat(params.get("lon") || "126.9780");
        const weather = (params.get("weather") || "cloudy") as WeatherType;
        const bMaxA   = parseInt(params.get("budgetMaxA") || "0");
        const bMaxB   = parseInt(params.get("budgetMaxB") || "0");
        const budget  = bMaxA > 0 && bMaxB > 0 ? bMaxA + bMaxB : mockCourseData.budget;

        // 백엔드에서 실제 코스 가져오기 (비동기 시작 후 setState)
        fetch(`${API_BASE}/course/generate`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id:    `${session}_A`,
                region, lat, lon,
                start_time: "13:00",
                end_time:   "21:00",
                budget,
                weather,
            }),
        })
            .then(r => { setIsLoading(true); return r.json(); })
            .then(data => {
                const backendPlaces = data.courses?.[0]?.places || [];
                const adapted = adaptPlaces(backendPlaces, budget);
                if (adapted.length > 0) setPlacesB(adapted);
            })
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, []);

    const totalCost    = places.reduce((sum, p) => sum + p.estimatedCost, 0);
    const isOverBudget = totalCost > courseData.budget;

    // 선택한 날짜 기준 휴무 장소 체크
    const dateStr = new URLSearchParams(window.location.search).get("date") || "";
    const KO_DAY  = ["일","월","화","수","목","금","토"];
    const closedWarnings = dateStr
        ? places.filter(p => {
            if (!p.closedDays || p.closedDays === "없음") return false;
            const dow = new Date(dateStr + "T00:00:00").getDay();
            return p.closedDays.includes(KO_DAY[dow]) || p.possiblyClosedWarning;
          })
        : [];

    return (
        <div style={{ minHeight: "100vh", background: "#F5F3FB", padding: "24px 32px" }}>

            {/* 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: "#EAE5F5", border: "none", borderRadius: "8px", padding: "6px 12px", color: "#5a4480", fontSize: "13px", cursor: "pointer", flexShrink: 0 }}
                >
                    ← 뒤로
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: "22px", fontWeight: "bold", color: "#5a4480", margin: 0 }}>
                        {courseData.title} {getWeatherEmoji(courseData.weather.weatherType)}
                    </h1>
                    {(() => {
                        const p = new URLSearchParams(window.location.search);
                        const d = p.get("date");
                        const r = p.get("region");
                        if (!d && !r) return null;
                        const KO_DAYS = ["일","월","화","수","목","금","토"];
                        const dateLabel = d
                            ? (() => { const dt = new Date(d + "T00:00:00"); return `${dt.getMonth()+1}월 ${dt.getDate()}일 (${KO_DAYS[dt.getDay()]})`; })()
                            : "";
                        return (
                            <p style={{ fontSize: "13px", color: "#9B8EC4", margin: "4px 0 0" }}>
                                📍 {r}{dateLabel && ` · 📅 ${dateLabel}`}
                            </p>
                        );
                    })()}
                    {isLoading && (
                        <p style={{ fontSize: "12px", color: "#B8A9D9", margin: "2px 0 0" }}>
                            코스 불러오는 중...
                        </p>
                    )}
                </div>
            </div>

            {/* A/B 코스 선택 탭 */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
                {(["A", "B"] as CourseTab[]).map(tab => {
                    const label = tab === "A" ? "A안 · 차분한 감성 코스" : "B안 · 액티브 핫플 코스";
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSelectedPlace(null); }}
                            style={{
                                padding:       "10px 20px",
                                borderRadius:  "999px",
                                border:        isActive ? "none" : "1.5px solid #C9BCEB",
                                background:    isActive ? "#5a4480" : "#ffffff",
                                color:         isActive ? "#ffffff" : "#7a6aaa",
                                fontSize:      "14px",
                                fontWeight:    isActive ? 700 : 400,
                                cursor:        "pointer",
                                transition:    "all 0.2s ease",
                                boxShadow:     isActive ? "0 2px 8px rgba(90,68,128,0.25)" : "none",
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* 예산 진행 바 */}
            {(() => {
                const urlP  = new URLSearchParams(window.location.search);
                const aMin  = parseInt(urlP.get("budgetMinA") || "0");
                const aMax  = parseInt(urlP.get("budgetMaxA") || "0");
                const bMin  = parseInt(urlP.get("budgetMinB") || "0");
                const bMax  = parseInt(urlP.get("budgetMaxB") || "0");
                const fmtW  = (v: number) => v >= 999999 ? "제한없음" : `${Math.round(v/10000)}만원`;
                const hasRange = aMin > 0 && aMax > 0 && bMin > 0 && bMax > 0;
                const totalMin = aMin + bMin;
                const totalMax = aMax + bMax;
                const rangeLabel = hasRange
                    ? `A+B 합산 ${fmtW(totalMin)} ~ ${fmtW(totalMax)}`
                    : `예산 ${courseData.budget.toLocaleString()}원`;
                return (
                    <div style={{
                        background:   "#ffffff",
                        borderRadius: "12px",
                        padding:      "14px 18px",
                        marginBottom: "24px",
                        border:       `1px solid ${isOverBudget ? "#f5c0c0" : "#e8e4f4"}`,
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "13px", color: "#888" }}>예상 총 비용</span>
                            <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: "14px", fontWeight: 700, color: isOverBudget ? "#e05555" : "#5a4480" }}>
                                    {totalCost.toLocaleString()}원
                                </span>
                                <span style={{ fontSize: "11px", color: "#bbb", marginLeft: "6px" }}>{rangeLabel}</span>
                            </div>
                        </div>
                        <div style={{ width: "100%", height: "8px", background: "#eee", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{
                                width:        `${Math.min((totalCost / courseData.budget) * 100, 100)}%`,
                                height:       "100%",
                                background:   isOverBudget ? "#e05555" : "#b8a9d9",
                                borderRadius: "999px",
                                transition:   "width 0.3s ease",
                            }} />
                        </div>
                        <div style={{ marginTop: "6px", fontSize: "12px", color: isOverBudget ? "#e05555" : "#b8a9d9", textAlign: "right" }}>
                            {isOverBudget
                                ? `⚠️ ${(totalCost - courseData.budget).toLocaleString()}원 초과`
                                : `${(courseData.budget - totalCost).toLocaleString()}원 남음`}
                        </div>
                    </div>
                );
            })()}

            {/* 메인 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", alignItems: "start" }}>

                {/* 왼쪽 — 취향 교집합 + 지도 */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <PreferenceIntersection
                        personA={courseData.tagsA}
                        personB={courseData.tagsB}
                        common={courseData.common}
                    />
                    <KakaoMap
                        places={places}
                        selectedPlace={selectedPlace}
                        onSelectPlace={setSelectedPlace}
                    />
                </div>

                {/* 오른쪽 — 코스 타임라인 */}
                <div style={{
                    background:   "#FFFFFF",
                    borderRadius: "16px",
                    padding:      "16px",
                    border:       "1px solid #E8E4F4",
                    boxShadow:    "0 1px 4px rgba(184,169,217,0.15)",
                }}>
                    {/* 휴무 경고 */}
                    {closedWarnings.length > 0 && (
                        <div style={{ marginBottom: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {closedWarnings.map(p => (
                                <div key={p.name} style={{ background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: "10px", padding: "9px 14px", fontSize: "12px", color: "#a05800" }}>
                                    ⚠ <strong>{p.name}</strong> — {p.closedDays} 휴무예요. 예약 전 확인하세요.
                                </div>
                            ))}
                        </div>
                    )}
                    <CourseTimeline
                        places={places}
                        onSelectPlace={setSelectedPlace}
                    />
                </div>
            </div>

            {/* 장소 상세 카드 */}
            {selectedPlace && (
                <div style={{ marginTop: "24px" }}>
                    <PlaceDetailCard
                        place={selectedPlace}
                        onClose={() => setSelectedPlace(null)}
                        onSkip={(place) => setPlaces(prev => prev.filter(p => p.name !== place.name))}
                        onRecommendOther={(place) => alert(`${place.name} 대신 다른 장소를 추천받을게요!`)}
                        onWishlist={(place) => console.log("찜하기:", place.name)}
                    />
                </div>
            )}

            {/* 다음 단계 */}
            <div style={{ marginTop: "32px" }}>
                <button
                    onClick={() => {
                        const p = new URLSearchParams(window.location.search);
                        p.set("course", activeTab);
                        navigate("/booking?" + p.toString());
                    }}
                    style={{ width: "100%", padding: "16px", background: "#5a4480", color: "#fff", border: "none", borderRadius: "14px", fontSize: "16px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(90,68,128,0.3)" }}
                >
                    {activeTab === "A" ? "A안 선택 →" : "B안 선택 →"}
                </button>
            </div>
        </div>
    );
}
