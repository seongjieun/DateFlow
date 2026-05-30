# DateFlow

**환경 변수**

**capstone-backend/.env**

```
DATABASE_URL=sqlite:///./dateflow.db

SECRET_KEY=dev-secret-key

KMA_API_KEY=발급받은키

KAKAO_REST_API_KEY=발급받은키

GOOGLE_API_KEY=발급받은키
```

**frontend/f2/.env**

```
VITE_API_URL=http://localhost:8000

VITE_KAKAO_MAPS_API_KEY=발급받은키
```

**backend/B2/.env**

```
KAKAO_REST_API_KEY=발급받은키
```

---

**feature/login-and-map-integration 브랜치 변경사항**

✅ 완료

백엔드 (B1)

- ```auth_router.py``` (신규) — 회원가입/로그인/JWT 발급

- ```course_schema.py``` (수정) — ```budget_min/max```, ```date```, ```temp``` 필드 추가, ```CourseResponse```에 ```budget_max``` 추가
- ```course_router.py``` (수정) — ```budget_max``` 통일, AI 장소 카카오 좌표 조회 추가

  
프론트엔드 (f2)

- ```AuthContext.tsx``` (신규) — JWT 세션 전역 관리
- ```LoginPage.tsx``` (신규) — 로그인/회원가입 UI
- ```App.tsx``` (수정) — ```/login``` 라우트 추가, AuthProvider 적용
- ```OnboardingPage.tsx``` (수정) — JWT 포함 POST + ```state```로 결과 전달
- ```CourseResultPage.tsx``` (수정) — ```location.state``` 우선 읽기, URL 파라미터 fallback 유지

❌ 미완료

- ```user_pref_router.py``` — 취향 저장/조회 API
- ```PreferencesPage.tsx``` — 취향 입력 페이지
- 딥에이전트 AI 연동 (현재 Gemini 폴백으로 동작 중)
- 로그인 후 취향 유무 판단 → ```/preferences``` or ```/onboarding``` 분기 처리
