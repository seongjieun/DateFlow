# DateFlow

**환경 변수**

**frontend/f2/.env**

```
VITE_API_URL=http://localhost:8000

VITE_KAKAO_MAPS_API_KEY=발급받은키
```

**backend/B1/.env**

```
DATABASE_URL=sqlite:///./dateflow.db

SECRET_KEY=dev-secret-key

KMA_API_KEY=발급받은키

KAKAO_REST_API_KEY=발급받은키

GOOGLE_API_KEY=발급받은키
```
**backend/B2/.env**

```
KAKAO_REST_API_KEY=발급받은키
```

---

**feature/login-and-map-integration 브랜치 변경사항**

✅ 완료

백엔드 (B1)

- ```course_router.py``` (수정) — 카카오 모빌리티 API로 실제 이동시간(도보/자동차) 계산, 좌표 없는 장소 카카오 키워드 검색으로 자동 좌표 조회, A안/B안 두 가지 코스 생성
- ```course_schema.py```  (수정) — ```car_minutes_to_next``` 필드 추가
  
프론트엔드 (f2)

- ```CourseResultPage.tsx``` (수정) — A안/B안 탭 백엔드 연동, 이동시간(```walk_minutes_to_next```, ```car_minutes_to_next```) 표시
- ```CourseSelectPage.tsx``` (수정) — 목업 → 백엔드 실제 데이터 연동
- ```BookingPage.tsx``` (수정) — 목업 → 백엔드 실제 데이터 연동
- ```CompletePage.tsx``` (수정) — 목업 → 백엔드 실제 데이터 연동
- ```types/course.ts``` (수정) — ```BackendPlace``` 타입 추가, ```car_minutes_to_next``` 필드 추가

❌ 미완료

- ```user_pref_router.py``` — 취향 저장/조회 API
- ```PreferencesPage.tsx``` — 취향 입력 페이지
- 딥에이전트 AI 연동 (현재 Gemini 폴백으로 동작 중)
