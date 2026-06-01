import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { mockCourseData, mockCourseDataA } from "../mocks/courseData";
import type { CoursePlace } from "../types/course";
import { C, GS } from "../constants/theme";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const CAT_EMOJI: Record<string, string> = {
  cafe: "☕",
  culture: "🎨",
  restaurant: "🍽️",
  activity: "🏃",
  shopping: "🛍️",
};

function PlaceRow({ place, last }: { place: CoursePlace; last: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 0",
        borderBottom: last ? "none" : "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "#999",
          fontFamily: "monospace",
          width: 40,
          flexShrink: 0,
        }}
      >
        {place.time}
      </span>
      <span style={{ fontSize: 14 }}>{CAT_EMOJI[place.category] || "📍"}</span>
      <span style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>
        {place.name}
      </span>
    </div>
  );
}

export default function CourseSelectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [showAI, setShowAI] = useState(false);
  const [selected, setSelected] = useState<"A" | "B" | null>(null);
  const [placesA, setPlacesA] = useState<CoursePlace[]>(mockCourseDataA.places);
  const [placesB, setPlacesB] = useState<CoursePlace[]>(mockCourseData.places);

  useEffect(() => {
    setTimeout(() => setShowAI(true), 500);

    const region = params.get("region") || "";
    const lat = parseFloat(params.get("lat") || "37.5665");
    const lon = parseFloat(params.get("lon") || "126.9780");
    const budget = parseInt(params.get("budget") || "100000");
    const weather = params.get("weather") || "cloudy";
    const session = params.get("session") || "";

    if (!region) return;

    fetch(`${API_BASE}/course/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: `${session}_A`,
        region,
        lat,
        lon,
        start_time: "13:00",
        end_time: "21:00",
        budget,
        weather,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const a = data.courses?.[0]?.places || [];
        const b = data.courses?.[1]?.places || [];
        if (a.length > 0)
          setPlacesA(
            a.map((p: any) => ({
              time: p.time,
              name: p.name,
              category:
                p.category === "카페"
                  ? "cafe"
                  : p.category === "식당"
                    ? "restaurant"
                    : p.category === "바"
                      ? "activity"
                      : "activity",
              spaceType: "indoor" as const,
              satisfactionA: p.satisfaction_a,
              satisfactionB: p.satisfaction_b,
              lat: p.latitude || 37.5665,
              lon: p.longitude || 126.978,
              estimatedCost: p.price,
              budgetRatio: 0,
              isOverBudget: false,
              recommendedMenus: [],
              reservationAvailable: false,
              relationKeywords: [],
              desc: p.category,
            })),
          );
        if (b.length > 0)
          setPlacesB(
            b.map((p: any) => ({
              time: p.time,
              name: p.name,
              category:
                p.category === "카페"
                  ? "cafe"
                  : p.category === "식당"
                    ? "restaurant"
                    : p.category === "바"
                      ? "activity"
                      : "activity",
              spaceType: "indoor" as const,
              satisfactionA: p.satisfaction_a,
              satisfactionB: p.satisfaction_b,
              lat: p.latitude || 37.5665,
              lon: p.longitude || 126.978,
              estimatedCost: p.price,
              budgetRatio: 0,
              isOverBudget: false,
              recommendedMenus: [],
              reservationAvailable: false,
              relationKeywords: [],
              desc: p.category,
            })),
          );
      })
      .catch(() => {});
  }, []);

  const handlePick = (course: "A" | "B") => {
    if (selected) return;
    setSelected(course);
    const next = new URLSearchParams(params);
    next.set("course", course);
    setTimeout(() => navigate("/result?" + next.toString()), 700);
  };

  const coursesConfig = [
    {
      id: "A" as const,
      label: "차분한 감성 코스",
      icon: "🌿",
      bg: "#FFFDE7",
      selectedBorder: "#8BC34A",
      selectedBadge: "#8BC34A",
      textColor: "#5a7a3a",
      places: placesA,
    },
    {
      id: "B" as const,
      label: "액티브 핫플 코스",
      icon: "⚡",
      bg: "#FFF3E0",
      selectedBorder: "#FF9800",
      selectedBadge: "#FF9800",
      textColor: "#a05800",
      places: placesB,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        padding: "32px 20px 60px",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <style>{GS}</style>

      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 28,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 900, color: C.mainDark }}>
          Date<span style={{ color: C.main }}>Flow</span>
        </span>
        <span style={{ fontSize: 11, color: C.main, letterSpacing: "0.1em" }}>
          코스 선택
        </span>
      </div>

      {/* AI 말풍선 */}
      {showAI && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            marginBottom: 24,
            animation: "fadeUp 0.4s ease",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.main,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            🌸 DateFlow AI
          </div>
          <div
            style={{
              background: C.mainDark,
              color: C.card,
              borderRadius: "18px 18px 18px 4px",
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            두 가지로 짜봤어요!
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: C.main }}>
            마음에 드는 코스를 선택해보세요
          </div>
        </div>
      )}

      {/* 코스 카드 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {coursesConfig.map(
          ({
            id,
            label,
            icon,
            bg,
            selectedBorder,
            selectedBadge,
            textColor,
            places,
          }) => {
            const isSelected = selected === id;
            const isUnselected = selected !== null && !isSelected;
            return (
              <div
                key={id}
                onClick={() => handlePick(id)}
                style={{
                  background: isUnselected ? "#f5f5f5" : bg,
                  border: `2px solid ${isSelected ? selectedBorder : C.cardBorder}`,
                  borderRadius: 16,
                  padding: "16px 18px",
                  cursor: selected ? "default" : "pointer",
                  opacity: isUnselected ? 0.45 : 1,
                  transition: "all 0.22s ease",
                  boxShadow: isSelected
                    ? `0 6px 24px ${selectedBorder}40`
                    : "0 2px 8px rgba(0,0,0,0.05)",
                  animation: "fadeUp 0.4s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span
                    style={{ fontSize: 14, fontWeight: 700, color: textColor }}
                  >
                    {label}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        background: selectedBadge,
                        color: "#fff",
                        padding: "2px 10px",
                        borderRadius: "999px",
                        fontWeight: 700,
                      }}
                    >
                      선택됨 ✓
                    </span>
                  )}
                </div>
                {places.map((p, i) => (
                  <PlaceRow key={i} place={p} last={i === places.length - 1} />
                ))}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
