export const C = {
  bg:          "#F5F3FB",
  card:        "#FFFFFF",
  cardBorder:  "#E8E4F4",

  main:        "#B8A9D9",
  mainDark:    "#5a4480",
  mainDim:     "#EAE5F5",

  point:       "#E8A0B4",
  pointDark:   "#D4849A",
  pointDim:    "#FCE8EE",
  sub:         "#D4849A",   // pointDark alias (OnboardingPage 호환)

  sky:         "#A8C4E0",
  skyDim:      "#DFF0F9",

  text:        "#3D3257",
  textDim:     "#7B6FA0",
  textMuted:   "#B0A8CC",

  inputBg:     "#F0EDF9",
  inputBorder: "#D8D0EE",

  error:       "#E87070",
  errorBg:     "#FDE8E8",
  warn:        "#D4900A",
  warnBg:      "#FFF6E0",
  warnBorder:  "#FFD54F",

  green:       "#388E3C",
  greenBg:     "#E8F5E9",
};

/** 공통 keyframes + reset. OnboardingPage-specific input 스타일은 해당 파일 로컬 GS에 포함. */
export const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes popIn  { 0%{opacity:0;transform:scale(0.88)} 100%{opacity:1;transform:scale(1)} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
  @keyframes shake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
  * { box-sizing:border-box; }
`;
