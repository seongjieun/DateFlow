import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { C, GS } from "../constants/theme";
import { mockCourseData, mockCourseDataA } from "../mocks/courseData";
import type { CoursePlace } from "../types/course";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

declare const Kakao: {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: { sendDefault: (opts: Record<string, unknown>) => void };
};

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAPS_API_KEY as string | undefined;

const CAT_EMOJI: Record<string, string> = {
  cafe: "☕",
  culture: "🎨",
  restaurant: "🍽️",
  activity: "🏃",
  shopping: "🛍️",
};

function PlaceRow({ place, index }: { place: CoursePlace; index: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: `1px solid ${C.cardBorder}`,
        animation: `fadeUp 0.3s ease ${index * 0.06}s both`,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: C.main,
          fontFamily: "monospace",
          width: 40,
          flexShrink: 0,
        }}
      >
        {place.time}
      </span>
      <span style={{ fontSize: 18 }}>{CAT_EMOJI[place.category] || "📍"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
          {place.name}
        </div>
        {place.openingHours && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            {place.openingHours}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const courseKey = params.get("course") || "A";
  const region = params.get("region") || "성수동";
  const courseLabel =
    courseKey === "A" ? "차분한 감성 코스" : "액티브 핫플 코스";

  const [placesA, setPlacesA] = useState<CoursePlace[]>(mockCourseDataA.places);
  const [placesB, setPlacesB] = useState<CoursePlace[]>(mockCourseData.places);
  const places = courseKey === "A" ? placesA : placesB;
  useEffect(() => {
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
        const map = (p: any) => ({
          time: p.time,
          name: p.name,
          category:
            p.category === "카페"
              ? "cafe"
              : p.category === "식당"
                ? "restaurant"
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
        });
        if (a.length > 0) setPlacesA(a.map(map));
        if (b.length > 0) setPlacesB(b.map(map));
      })
      .catch(() => {});
  }, []);

  const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const d = params.get("date");
  const dateLabel = d
    ? (() => {
        const dt = new Date(d + "T00:00:00");
        return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${KO_DAYS[dt.getDay()]})`;
      })()
    : "";

  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleKakaoShare = () => {
    if (!KAKAO_KEY) return;
    try {
      if (!Kakao.isInitialized()) Kakao.init(KAKAO_KEY);
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `DateFlow · ${region} ${courseLabel}`,
          description: dateLabel
            ? `📅 ${dateLabel}`
            : "두 사람의 취향으로 만든 데이트 코스",
          imageUrl: "https://via.placeholder.com/400x200?text=DateFlow",
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
        buttons: [
          {
            title: "코스 보기",
            link: {
              mobileWebUrl: window.location.href,
              webUrl: window.location.href,
            },
          },
        ],
      });
    } catch {
      handleCopyLink();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        padding: "40px 24px 60px",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <style>{GS}</style>

      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        {/* 파티 이모지 */}
        <div
          style={{
            textAlign: "center",
            fontSize: 64,
            marginBottom: 20,
            animation: "bounce 1s ease 0.3s both",
          }}
        >
          🎉
        </div>

        {/* 확정 카드 */}
        <div
          style={{
            background: `linear-gradient(135deg, ${C.mainDark} 0%, ${C.point} 100%)`,
            color: C.card,
            borderRadius: 24,
            padding: "24px 28px",
            marginBottom: 16,
            boxShadow: "0 12px 40px rgba(122,92,189,0.35)",
            animation: "popIn 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.2s both",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>
            데이트 코스 확정! 💕
          </div>
          <div style={{ fontSize: 13, opacity: 0.88 }}>두 분의 하루 시작!</div>
        </div>

        {/* 코스 정보 */}
        <div
          style={{
            background: C.card,
            borderRadius: 16,
            padding: "14px 20px",
            border: `1px solid ${C.cardBorder}`,
            marginBottom: 16,
            animation: "fadeUp 0.5s ease 0.4s both",
          }}
        >
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
            📍 {region}
            {dateLabel && ` · 📅 ${dateLabel}`}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            {courseLabel}
          </div>
        </div>

        {/* 코스 장소 목록 */}
        <div
          style={{
            background: C.card,
            borderRadius: 16,
            padding: "4px 20px 8px",
            border: `1px solid ${C.cardBorder}`,
            marginBottom: 16,
            boxShadow: "0 2px 12px rgba(184,169,217,0.1)",
            animation: "fadeUp 0.5s ease 0.5s both",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.main,
              fontWeight: 700,
              letterSpacing: "0.08em",
              padding: "14px 0 4px",
              textTransform: "uppercase",
            }}
          >
            오늘의 코스
          </div>
          {places.map((place, i) => (
            <PlaceRow key={place.name} place={place} index={i} />
          ))}
        </div>

        {/* 공유 버튼 */}
        <div
          style={{
            background: C.card,
            borderRadius: 16,
            padding: "18px 20px",
            border: `1px solid ${C.cardBorder}`,
            marginBottom: 20,
            boxShadow: "0 2px 12px rgba(184,169,217,0.15)",
            animation: "fadeUp 0.5s ease 0.6s both",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleCopyLink}
              style={{
                flex: 1,
                padding: "10px 0",
                background: copied ? C.greenBg : C.inputBg,
                border: `1.5px solid ${copied ? C.green : C.cardBorder}`,
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                color: copied ? C.green : C.textDim,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              {copied ? "✓ 복사됨" : "🔗 링크 복사"}
            </button>
            <button
              onClick={handleKakaoShare}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "#FEE500",
                border: "none",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                color: "#3C1E1E",
                cursor: "pointer",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              💬 카카오톡 공유
            </button>
          </div>
        </div>

        {/* 처음으로 */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "12px 32px",
              background: "transparent",
              border: `1.5px solid ${C.main}`,
              borderRadius: "999px",
              color: C.mainDark,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
