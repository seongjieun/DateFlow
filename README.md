# DateFlow — 변경 파일 모음 (`feature/ai-course-generate`)

로그인 시스템 추가 + 딥에이전트 AI 연동 준비를 위해 수정·추가된 파일만 모아둔 브랜치입니다.

```
backend/
  app/routers/auth_router.py       ← 회원가입 / 로그인 / JWT 발급 (신규)
  app/routers/user_pref_router.py  ← 취향 저장·조회 (신규)
  app/routers/course_router.py     ← POST /courses/generate 개선
  app/schemas/course_schema.py     ← 요청·응답 필드 확장
frontend/
  src/App.tsx                      ← 라우팅 구조 변경
  src/contexts/AuthContext.tsx     ← JWT 세션 관리 (신규)
  src/pages/LoginPage.tsx          ← 로그인·회원가입 탭 (신규)
  src/pages/PreferencesPage.tsx    ← 최초 1회 취향 설정 (신규)
  src/pages/OnboardingPage.tsx     ← handleGenerate 리팩토링
  src/pages/CourseResultPage.tsx   ← location.state로 코스 수신
```

---

## 1. 로그인 시스템 변경 내용

### 화면 흐름

```
/ (SmartHome)
  └─ 항상 세션 초기화 후 /login으로 이동

/login
  ├─ 회원가입  → /preferences  (취향 최초 등록)
  └─ 로그인    → GET /prefs/{user_id}
                  ├─ 취향 있음 → /onboarding
                  └─ 취향 없음 → /preferences

/preferences  (최초 1회)
  └─ 남자분 태그 선택 → 여자분 태그 선택 → POST /prefs → /onboarding

/onboarding   (매 데이트마다)
  └─ 날짜·지역·날씨 → 예산 → POST /courses/generate → /result

/result
  └─ AI 서버 응답 코스 표시
```

### 백엔드 — `auth_router.py` (신규)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /auth/register` | 회원가입. username 중복 체크, bcrypt 해싱, JWT 발급 |
| `POST /auth/login` | 로그인. 비밀번호 검증 후 JWT 발급 |
| `GET /auth/me` | 토큰으로 현재 사용자 정보 조회 |

**회원가입 유효성 검사 규칙**
- username: 영문 소문자·숫자·언더스코어, 4~20자, 숫자 시작 불가
- password: 8자 이상, 영문+숫자 조합 필수

**로그인 응답 (`TokenResponse`)**
```json
{
  "access_token": "eyJ...",
  "token_type":   "bearer",
  "user_id":      "UUID",
  "username":     "hong123",
  "nickname":     "홍길동",
  "gender":       "M"
}
```

### 백엔드 — `user_pref_router.py` (신규)

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /prefs` | 취향 저장. 기존 취향이 있으면 덮어쓰기 |
| `GET /prefs/{user_id}` | 취향 조회. 없으면 404 반환 |

취향은 `UserPreference.extra` JSONB 컬럼에 저장합니다:

```json
{
  "mood":      "로맨틱",
  "food_type": ["감성 카페", "맛집 탐방"],
  "budget":    100000,
  "person1":   { "tags": ["로맨틱", "감성 카페", "산책·자연"], "gender": "M" },
  "person2":   { "tags": ["고급스러운", "맛집 탐방", "핫플 방문"], "gender": "F" }
}
```

### 프론트엔드 — `AuthContext.tsx` (신규)

JWT 토큰과 사용자 정보를 `localStorage`에 저장해 브라우저 새로고침 후에도 세션이 유지됩니다.

```typescript
const { user, login, logout } = useAuth();
// user.token    → Authorization 헤더에 사용
// user.user_id  → 취향·코스 조회에 사용
```

### 프론트엔드 — `LoginPage.tsx` (신규)

- 로그인 / 회원가입 탭 전환 UI
- 마운트 시 `logout()` 호출 → 이전 세션 자동 초기화
- 로그인 성공 후 `GET /prefs/{user_id}` 호출해 취향 유무로 다음 화면 결정

### 프론트엔드 — `PreferencesPage.tsx` (신규)

- Step 1: 남자분 취향 태그 선택 (분위기·활동·카페 카테고리)
- Step 2: 여자분 취향 태그 선택
- 완료 시 `POST /prefs`로 저장 후 `/onboarding`으로 이동
- 온보딩 우측 상단 ⚙ 메뉴에서 언제든 재설정 가능

### 프론트엔드 — `App.tsx` (수정)

```
이전: 카카오 로그인 기반, 단일 페이지 구조
이후: 로컬 JWT 기반, 4단계 페이지 라우팅
```

`SmartHome`이 항상 `logout()` 후 `/login`으로 리다이렉트해 이전 세션이 남아있어도 로그인 화면부터 시작합니다.

---

## 2. AI 코스 생성 연동 변경 내용

### 백엔드 — `course_schema.py` (수정)

`CourseRequest` 추가 필드:

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `date` | `str` | 없음(선택) | 데이트 날짜 (`"YYYY-MM-DD"`) |
| `temp` | `float` | 없음(선택) | 기온 (°C) |
| `budget_min` | `int` | `0` | 최소 예산 (원) |
| `budget_max` | `int` | `100000` | 최대 예산 (원) |
| `tags_m` | `list[str]` | `[]` | 남자분 취향 태그 — 생략 시 DB 자동 조회 |
| `tags_f` | `list[str]` | `[]` | 여자분 취향 태그 — 생략 시 DB 자동 조회 |

`CourseResponse`에 `date`, `weather`, `budget_max`, `tags_m`, `tags_f`, 각 장소의 `latitude`/`longitude` 추가.

### 백엔드 — `course_router.py` (수정)

1. **UUID 기반 유저 조회** — 회원가입 UUID와 레거시 kakao_id 모두 지원
2. **취향 태그 자동 조회** — `tags_m/f` 비어 있으면 `UserPreference.extra.person1/2.tags` 조회
3. **딥에이전트 플레이스홀더** — `DEEP_AGENT_URL` 환경변수 설정 후 TODO 주석 해제로 즉시 연동

### 프론트엔드 — `OnboardingPage.tsx` (수정)

**변경 전**: 모든 데이터를 URL 파라미터로 조립 → `navigate("/result?session=…&region=…")`

**변경 후**: 백엔드 `POST /courses/generate` 호출 → `navigate("/result", { state: { courseData } })`

```typescript
const res = await fetch(`${API_BASE}/courses/generate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.token}`,   // JWT 토큰
  },
  body: JSON.stringify({
    user_id:    user.user_id,
    region:     cityName,
    lat,  lon,
    date:       dateStr,          // "YYYY-MM-DD"
    weather:    weatherObj.type,  // "sunny" | "cloudy" | "rainy" | "snow"
    temp:       weatherObj.temp,  // 기온 (°C)
    budget_min: BUDGET_VALUES[budgetMin],
    budget_max: BUDGET_VALUES[budgetMax],
    // tags_m / tags_f 생략 → 백엔드가 DB에서 자동 조회
  }),
});
const courseData = await res.json();
navigate("/result", { state: { courseData } });
```

### 프론트엔드 — `CourseResultPage.tsx` (수정)

**변경 전**: URL 파라미터 파싱 후 내부에서 백엔드 재호출

**변경 후**: `useLocation().state.courseData` 우선 읽기, URL 파라미터는 fallback으로 유지

---

## 3. 딥에이전트 AI 서버 연동 방법

### 데이터 흐름

```
사용자 입력 (온보딩)
  └─ POST /courses/generate (백엔드)
       ├─ DB 조회: tags_m, tags_f (취향 태그)
       ├─ → 딥에이전트 서버로 포워딩
       │       요청: region, lat, lon, date, weather, temp,
       │             budget_min, budget_max, tags_m, tags_f
       │       응답: courses[].places[]
       └─ 프론트로 반환
  └─ location.state로 /result 전달
```

### Step 1 — 환경변수 설정

백엔드 `.env` 파일에 딥에이전트 서버 주소 추가:

```env
DEEP_AGENT_URL=http://딥에이전트서버주소:포트
```

### Step 2 — `course_router.py` 주석 해제

`DEEP_AGENT_URL`이 설정되면 이 블록이 실행됩니다. 딥에이전트 요청 포맷에 맞게 `ai_payload` 키 이름만 수정하면 됩니다.

```python
# course_router.py — generate_course 함수 안 (현재 주석 처리된 부분)

if DEEP_AGENT_URL:
    import httpx
    ai_payload = {
        "region":     req.region,
        "lat":        req.lat,
        "lon":        req.lon,
        "date":       req.date,
        "weather":    req.weather,
        "temp":       req.temp,
        "budget_min": req.budget_min,
        "budget_max": budget_max,
        "tags_m":     tags_m,    # 남자분 취향 태그
        "tags_f":     tags_f,    # 여자분 취향 태그
    }
    async with httpx.AsyncClient() as client:
        ai_res = await client.post(
            f"{DEEP_AGENT_URL}/generate",   # ← 딥에이전트 엔드포인트 경로 확인
            json=ai_payload,
            timeout=30,
        )
    return CourseResponse(
        course_id=str(uuid.uuid4()),
        user_id=req.user_id,
        region=req.region,
        date=req.date,
        weather=req.weather,
        budget_max=budget_max,
        tags_m=tags_m,
        tags_f=tags_f,
        courses=ai_res.json().get("courses", []),  # ← 응답 구조에 맞게 수정
    )
```

### Step 3 — 딥에이전트가 받는 전체 데이터 예시

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

### Step 4 — 딥에이전트가 반환해야 하는 응답 포맷

프론트엔드의 `adaptPlaces()` 함수가 아래 구조를 파싱합니다:

```json
{
  "courses": [
    {
      "title": "로맨틱 홍대 코스",
      "total_price": 95000,
      "places": [
        {
          "name":      "카페 이름",
          "category":  "카페",
          "region":    "홍대",
          "time":      "13:00",
          "price":     15000,
          "is_open":   true,
          "latitude":  37.555,
          "longitude": 126.923
        },
        { ... },
        { ... }
      ]
    }
  ]
}
```

`category` 값에 따라 아이콘이 바뀝니다:

| category 값 | 표시 |
|------------|------|
| `카페` 포함 | 카페 아이콘 |
| `식당` / `레스토랑` / `바` / `펍` 포함 | 식당 아이콘 |
| `쇼핑` / `팝업` 포함 | 쇼핑 아이콘 |
| `전시` / `갤러리` 포함 | 문화 아이콘 |
| 그 외 | 액티비티 아이콘 |

### Step 5 — 연동 테스트

```bash
# 딥에이전트 연결 없이 현재 동작 확인
curl -X POST http://localhost:8001/courses/generate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "테스트-UUID",
    "region":  "홍대",
    "lat":     37.5563, "lon": 126.9234,
    "date":    "2026-06-01",
    "weather": "sunny",
    "budget_min": 30000, "budget_max": 100000
  }'

# .env에 DEEP_AGENT_URL 추가 후 서버 재시작 → 같은 curl로 딥에이전트 응답 확인
```
