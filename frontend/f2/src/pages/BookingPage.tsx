import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { mockCourseData, mockCourseDataA } from "../mocks/courseData";
import type { CoursePlace } from "../types/course";
import { C, GS } from "../constants/theme";
import ActionButtonGroup from "../components/ActionButtonGroup";

type PlaceWithUrl = CoursePlace & { naverReservationUrl?: string; reservationUrl?: string };

function bookingButton(place: CoursePlace) {
  const naverSearch = (q: string) =>
    `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;

  if (place.reservationAvailable) {
    const p   = place as PlaceWithUrl;
    const url = p.naverReservationUrl
      ?? p.reservationUrl
      ?? naverSearch(place.name + " 예약");
    return { label: "예약하기", url };
  }
  if ((place.admissionFee ?? 0) > 0) {
    return { label: "입장권", url: naverSearch(place.name + " 입장권") };
  }
  return null;
}

export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params   = new URLSearchParams(location.search);

  const course = (params.get("course") || "A") as "A" | "B";
  const places = course === "A" ? mockCourseDataA.places : mockCourseData.places;

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 20px 60px", fontFamily: "'Noto Sans KR', sans-serif" }}>
      <style>{GS}</style>

      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: C.mainDim, border: "none", borderRadius: "8px", padding: "6px 12px", color: C.mainDark, fontSize: "13px", cursor: "pointer", flexShrink: 0 }}
          >
            ← 뒤로
          </button>
          <span style={{ fontSize: 20, fontWeight: 900, color: C.mainDark }}>
            Date<span style={{ color: C.main }}>Flow</span>
          </span>
          <span style={{ fontSize: 11, color: C.main, letterSpacing: "0.1em" }}>예약 안내</span>
        </div>
        {(params.get("region") || params.get("date")) && (() => {
          const KO_DAYS = ["일","월","화","수","목","금","토"];
          const d = params.get("date");
          const r = params.get("region");
          const dateLabel = d ? (() => { const dt = new Date(d + "T00:00:00"); return `${dt.getMonth()+1}월 ${dt.getDate()}일 (${KO_DAYS[dt.getDay()]})`; })() : "";
          return <p style={{ fontSize: 13, color: C.textMuted, margin: 0, paddingLeft: 4 }}>📍 {r}{dateLabel && ` · 📅 ${dateLabel}`}</p>;
        })()}
      </div>

      {/* AI 말풍선 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: 20, animation: "fadeUp 0.4s ease" }}>
        <div style={{ fontSize: 11, color: C.main, marginBottom: 6, fontWeight: 600 }}>🌸 DateFlow AI</div>
        <div style={{ background: C.mainDark, color: C.card, borderRadius: "18px 18px 18px 4px", padding: "12px 20px", fontSize: 14, fontWeight: 600, maxWidth: 280 }}>
          각 장소에서 바로 예매하실 수 있어요!
        </div>
      </div>

      {/* 장소 예약 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {places.map((place, i) => {
          const btn      = bookingButton(place);
          const isOpen   = expandedIdx === i;
          return (
            <div key={i} style={{
              background: isOpen ? C.mainDim : C.card,
              border: `1px solid ${isOpen ? C.main : C.cardBorder}`,
              borderRadius: 14, padding: "14px 16px",
              boxShadow: "0 1px 4px rgba(184,169,217,0.12)",
              animation: `fadeUp 0.3s ease ${i * 0.07}s both`,
              cursor: "pointer", transition: "all 0.2s",
            }}
              onClick={() => setExpandedIdx(isOpen ? null : i)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.main, fontFamily: "monospace" }}>{place.time}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{place.name}</span>
                  </div>
                  {place.openingHours && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, marginLeft: 36 }}>
                      {place.openingHours}
                      {place.closedDays && place.closedDays !== "없음" && ` · 휴무 ${place.closedDays}`}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {btn ? (
                    <button
                      onClick={e => { e.stopPropagation(); window.open(btn.url, "_blank"); }}
                      style={{ padding: "6px 14px", background: C.mainDark, color: C.card, border: "none", borderRadius: "999px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      {btn.label}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: C.textMuted }}>{place.openingHours === "상시 개방" ? "상시 개방" : "예약 불필요"}</span>
                  )}
                </div>
              </div>

              {/* 액션 버튼 (펼쳐졌을 때) */}
              {isOpen && (
                <div onClick={e => e.stopPropagation()}>
                  <ActionButtonGroup place={place} hideNavigation />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => navigate("/complete?" + params.toString())}
        style={{ width: "100%", padding: 16, background: C.mainDark, color: C.card, border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(90,68,128,0.3)", fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        코스 확정하기 →
      </button>
    </div>
  );
}
