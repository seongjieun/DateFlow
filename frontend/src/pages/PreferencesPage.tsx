import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:8001";

const C = {
  bg: "#F5F3FB", card: "#FFFFFF", cardBorder: "#E8E4F4",
  main: "#B8A9D9", mainDim: "#EAE5F5",
  point: "#E8A0B4", pointDim: "#FCE8EE",
  text: "#3D3257", textDim: "#7B6FA0", textMuted: "#B0A8CC",
  inputBg: "#F0EDF9", inputBorder: "#D8D0EE",
  male: "#6BAED6", maleDim: "#DEEBF7",
  female: "#E8A0B4", femaleDim: "#FCE8EE",
};

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  * { box-sizing:border-box; }
`;

const PREF_TAGS: Record<string, string[]> = {
  분위기: ["조용한 분위기", "활기찬 분위기", "로맨틱", "캐주얼", "고급스러운"],
  활동:   ["전시·문화", "맛집 탐방", "활동적인 코스", "핫플 방문", "산책·자연"],
  카페:   ["여유로운 카페", "감성 카페", "디저트 맛집", "브런치"],
};

function TagButton({ label, selected, onClick, color = C.main }: { label: string; selected: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", borderRadius: "999px",
      border: selected ? "none" : `1.5px solid ${C.cardBorder}`,
      background: selected ? color : C.card,
      color: selected ? "#fff" : C.textDim,
      fontSize: 13, fontFamily: "'Noto Sans KR',sans-serif",
      fontWeight: selected ? 700 : 400, cursor: "pointer",
      transition: "all 0.18s",
    }}>{label}</button>
  );
}

const tagToMood = (tags: string[]) => {
  if (tags.includes("로맨틱"))        return "로맨틱";
  if (tags.includes("고급스러운"))    return "고급스러운";
  if (tags.includes("조용한 분위기")) return "조용한";
  if (tags.includes("활기찬 분위기")) return "활기찬";
  return "감성적";
};
const FOOD_TAGS = ["맛집 탐방","여유로운 카페","감성 카페","디저트 맛집","브런치","전시·문화","활동적인 코스","산책·자연","핫플 방문"];
const tagToFoodType = (tags: string[]) => tags.filter(t => FOOD_TAGS.includes(t));

export default function PreferencesPage() {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const [step,      setStep]   = useState(1);
  const [tagsM,     setTagsM]  = useState<string[]>([]);
  const [tagsF,     setTagsF]  = useState<string[]>([]);
  const [loading,   setLoading] = useState(false);
  const [error,     setError]  = useState("");

  const saveAndContinue = async () => {
    setLoading(true);
    setError("");
    try {
      if (user) {
        await fetch(`${API}/prefs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
          body: JSON.stringify({
            user_id:   user.user_id,
            mood:      tagToMood(tagsM),
            food_type: tagToFoodType([...tagsM, ...tagsF]),
            budget:    50000,
            age_group: "20대",
            extra: {
              person1: { tags: tagsM, gender: "M" },
              person2: { tags: tagsF, gender: "F" },
            },
          }),
        });
      }
      navigate("/onboarding");
    } catch {
      setError("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const wrap  = { minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR',sans-serif", display: "flex" as const, flexDirection: "column" as const, alignItems: "center" as const, padding: "0 0 80px" };
  const inner = { maxWidth: "420px", width: "100%", padding: "48px 20px 0" };

  // ── 진행 바 ─────────────────────────────────────────────────
  const ProgressBar = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
      {[1, 2].map(i => (
        <div key={i} style={{ flex: 1, height: 4, borderRadius: "999px", background: i <= step ? C.main : C.cardBorder, transition: "background 0.3s" }} />
      ))}
    </div>
  );

  // ── STEP 1: 남자 분 취향 ─────────────────────────────────────
  if (step === 1) return (
    <div style={wrap}><style>{GS}</style>
      <div style={{ ...inner, animation: "fadeUp 0.4s ease" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 4px" }}>
            Date<span style={{ color: C.main }}>Flow</span>
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>취향을 등록하면 맞춤 코스를 만들어드려요</p>
        </div>

        <ProgressBar />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.maleDim, border: `1px solid ${C.male}44`, borderRadius: "999px", padding: "5px 14px", marginBottom: 14, fontSize: 12, fontWeight: 700, color: C.male }}>
          👨 1 / 2 · 남자 분 취향
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>
          <span style={{ color: C.male }}>남자 분</span>의 취향을 알려주세요
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 24px" }}>여러 개 선택 가능해요</p>

        {Object.entries(PREF_TAGS).map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 600 }}>{cat}</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              {list.map(t => (
                <TagButton key={t} label={t} selected={tagsM.includes(t)} color={C.male}
                  onClick={() => setTagsM(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
              ))}
            </div>
          </div>
        ))}

        {tagsM.length > 0 && (
          <div style={{ background: C.maleDim, border: `1px solid ${C.male}33`, borderRadius: 14, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.male, marginBottom: 6, fontWeight: 600 }}>선택됨</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {tagsM.map(t => <span key={t} style={{ fontSize: 12, background: C.male, color: "#fff", padding: "3px 10px", borderRadius: "999px" }}>{t}</span>)}
            </div>
          </div>
        )}

        <button onClick={() => setStep(2)} style={{
          width: "100%", padding: 15, background: C.male, border: "none", borderRadius: 14,
          color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
          fontFamily: "'Noto Sans KR',sans-serif", boxShadow: "0 4px 14px #6BAED640",
        }}>
          여자 분 취향 →
        </button>
      </div>
    </div>
  );

  // ── STEP 2: 여자 분 취향 ─────────────────────────────────────
  return (
    <div style={wrap}><style>{GS}</style>
      <div style={{ ...inner, animation: "fadeUp 0.4s ease" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: "0 0 4px" }}>
            Date<span style={{ color: C.main }}>Flow</span>
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>취향을 등록하면 맞춤 코스를 만들어드려요</p>
        </div>

        <ProgressBar />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.femaleDim, border: `1px solid ${C.female}44`, borderRadius: "999px", padding: "5px 14px", marginBottom: 14, fontSize: 12, fontWeight: 700, color: C.female }}>
          👩 2 / 2 · 여자 분 취향
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>
          <span style={{ color: C.female }}>여자 분</span>의 취향을 알려주세요
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 24px" }}>여러 개 선택 가능해요</p>

        {Object.entries(PREF_TAGS).map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.08em", fontWeight: 600 }}>{cat}</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
              {list.map(t => (
                <TagButton key={t} label={t} selected={tagsF.includes(t)} color={C.female}
                  onClick={() => setTagsF(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
              ))}
            </div>
          </div>
        ))}

        {tagsF.length > 0 && (
          <div style={{ background: C.femaleDim, border: `1px solid ${C.female}33`, borderRadius: 14, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.female, marginBottom: 6, fontWeight: 600 }}>선택됨</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {tagsF.map(t => <span key={t} style={{ fontSize: 12, background: C.female, color: "#fff", padding: "3px 10px", borderRadius: "999px" }}>{t}</span>)}
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: 13, color: "#E87070", marginBottom: 12 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setStep(1)} style={{ flex: 1, padding: 14, background: C.card, border: `1.5px solid ${C.cardBorder}`, borderRadius: 14, color: C.textDim, fontSize: 14, cursor: "pointer", fontFamily: "'Noto Sans KR',sans-serif" }}>
            ← 이전
          </button>
          <button onClick={saveAndContinue} disabled={loading} style={{
            flex: 2, padding: 14, background: loading ? C.inputBg : C.main, border: "none", borderRadius: 14,
            color: loading ? C.textMuted : "#fff", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Noto Sans KR',sans-serif",
            boxShadow: loading ? "none" : "0 4px 14px #B8A9D940", transition: "all 0.2s",
          }}>
            {loading ? "저장 중..." : "완료 · 코스 설정 시작 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
