# DateFlow — AI 코스 생성 연동 변경 파일 (`feature/ai-course-generate`)

딥에이전트 AI 서버 연동을 위해 수정된 파일만 모아둔 브랜치입니다.

```
backend/
  app/routers/course_router.py   ← POST /courses/generate 개선
  app/schemas/course_schema.py   ← 요청·응답 필드 확장
frontend/
  src/pages/OnboardingPage.tsx   ← handleGenerate 리팩토링
  src/pages/CourseResultPage.tsx ← location.state로 코스 수신
```

---

## 변경 내용 요약

### 백엔드

#### `backend/app/schemas/course_schema.py`

`CourseRequest`에 필드 추가:

| 필드 | 타입 | 설명 |
|------|------|------|
| `date` | `str?` | 데이트 날짜 (`"YYYY-MM-DD"`) |
| `temp` | `float?` | 기온 (°C) |
| `budget_min` | `int` | 최소 예산 (원), 기본값 0 |
| `budget_max` | `int` | 최대 예산 (원), 기본값 100000 |
| `tags_m` | `list[str]` | 남자분 취향 태그 (생략 시 DB에서 자동 조회) |
| `tags_f` | `list[str]` | 여자분 취향 태그 (생략 시 DB에서 자동 조회) |

`CourseResponse`에 `date`, `weather`, `budget_max`, `tags_m`, `tags_f` 추가.  
`PlaceItem`에 `latitude`, `longitude` 추가.

#### `backend/app/routers/course_router.py`

1. **UUID 기반 유저 조회** — 회원가입 유저(UUID)와 레거시 kakao_id 유저 모두 지원
2. **취향 태그 자동 조회** — `tags_m/f`가 비어 있으면 `UserPreference.extra.person1.tags` / `person2.tags`를 DB에서 조회
3. **딥에이전트 플레이스홀더** — `DEEP_AGENT_URL` 환경변수 설정 후 TODO 주석 해제하면 즉시 연동

---

### 프론트엔드

#### `frontend/src/pages/OnboardingPage.tsx` — `handleGenerate`

**변경 전**: 수집 데이터를 URL 파라미터로 조립 후 `navigate("/result?...")`

**변경 후**: 백엔드 `POST /courses/generate` 호출 → `navigate("/result", { state: { courseData } })`

```typescript
const res = await fetch(`${API_BASE}/courses/generate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.token}`,
  },
  body: JSON.stringify({
    user_id:    user.user_id,
    region:     cityName,
    lat,  lon,
    date:       dateStr,
    weather:    weatherObj.type,
    temp:       weatherObj.temp ?? null,
    budget_min: BUDGET_VALUES[budgetMin],
    budget_max: BUDGET_VALUES[budgetMax],
    // tags_m / tags_f 생략 → 백엔드가 DB에서 자동 조회
  }),
});
const courseData = await res.json();
navigate("/result", { state: { courseData } });
```

#### `frontend/src/pages/CourseResultPage.tsx`

**변경 전**: URL 파라미터 파싱 후 내부에서 백엔드 재호출

**변경 후**: `useLocation().state.courseData` 우선 사용, URL 파라미터는 fallback으로 유지

---

## AI 서버로 전달되는 전체 데이터

`POST /courses/generate` 요청 JSON:

```json
{
  "user_id":    "사용자-UUID",
  "region":     "홍대",
  "lat":        37.5563,
  "lon":        126.9234,
  "date":       "2026-06-01",
  "weather":    "sunny",
  "temp":       24.0,
  "budget_min": 30000,
  "budget_max": 100000
}
```

백엔드가 DB에서 추가로 조회해 AI에게 넘기는 데이터:

```json
{
  "tags_m": ["로맨틱", "감성 카페", "산책·자연"],
  "tags_f": ["고급스러운", "맛집 탐방", "핫플 방문"]
}
```

최종적으로 딥에이전트가 받는 전체 payload (`course_router.py` TODO 주석 참고):

```json
{
  "region":     "홍대",
  "lat":        37.5563,
  "lon":        126.9234,
  "date":       "2026-06-01",
  "weather":    "sunny",
  "temp":       24.0,
  "budget_min": 30000,
  "budget_max": 100000,
  "tags_m":     ["로맨틱", "감성 카페", "산책·자연"],
  "tags_f":     ["고급스러운", "맛집 탐방", "핫플 방문"]
}
```

---

## 딥에이전트 연동 시 할 일

1. 백엔드 `.env`에 추가:
   ```
   DEEP_AGENT_URL=http://딥에이전트서버주소
   ```

2. `course_router.py`에서 `# if DEEP_AGENT_URL:` 블록 주석 해제

3. 딥에이전트 응답 포맷에 맞게 `courses[].places[]` 구조 확인
