"""데이트 코스 생성 엔드포인트 (B1 호환 인터페이스).

B2의 Place DB를 직접 조회하여 코스를 생성한다.
장소가 없으면 실시간 카카오 검색으로 수집 후 재조회한다.
딥에이전트 연동 준비: TODO 주석 위치에 서버 주소/포맷 확정 후 채워 넣는다.
"""
import uuid
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.place import Place
from app.models.user import User, UserPreference
from app.schemas.course_schema import CourseItem, CourseRequest, CourseResponse, PlaceItem
from app.services.place_collector import collect_and_save
from app.services.weather import get_weather

router = APIRouter(prefix="/courses", tags=["courses"])

DEEP_AGENT_URL = os.getenv("DEEP_AGENT_URL", "")  # 딥에이전트 서버 주소 (환경변수)


async def _fetch_places(category: str, area: str, db: AsyncSession, size: int = 5) -> list[Place]:
    stmt = (
        select(Place)
        .where(Place.is_active == True)
        .where(Place.category == category)
        .where(
            (Place.road_address.ilike(f"%{area}%")) |
            (Place.address.ilike(f"%{area}%"))
        )
        .limit(size)
    )
    result = await db.execute(stmt)
    places = result.scalars().all()

    if not places:
        await collect_and_save(query=f"{area} {category}", db=db)
        result = await db.execute(stmt)
        places = result.scalars().all()

    return list(places)


@router.post(
    "/generate",
    response_model=CourseResponse,
    summary="데이트 코스 생성",
    description=(
        "사용자 취향과 지역, 예산을 기반으로 데이트 코스를 생성합니다.\n\n"
        "DB에 장소가 없으면 카카오 API로 실시간 수집 후 코스를 구성합니다.\n\n"
        "DEEP_AGENT_URL 환경변수가 설정되면 딥에이전트 서버로 포워딩합니다."
    ),
)
async def generate_course(
    req: CourseRequest,
    db: AsyncSession = Depends(get_db),
) -> CourseResponse:
    budget_max = req.budget_max if req.budget_max > 0 else (req.budget if req.budget > 0 else 100000)
    if budget_max < 10000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="예산은 최소 10,000원 이상이어야 합니다.",
        )

    # 1. 취향 태그 확보 — 프론트가 보내지 않았으면 DB에서 조회
    tags_m: list[str] = list(req.tags_m)
    tags_f: list[str] = list(req.tags_f)
    mood = "감성적"

    user = None
    try:
        uid = uuid.UUID(req.user_id)
        result = await db.execute(select(User).where(User.id == uid))
        user = result.scalar_one_or_none()
    except ValueError:
        pass
    if not user:
        result = await db.execute(select(User).where(User.kakao_id == req.user_id))
        user = result.scalar_one_or_none()

    if user:
        pref_result = await db.execute(
            select(UserPreference).where(UserPreference.user_id == user.id)
        )
        pref = pref_result.scalar_one_or_none()
        if pref and pref.extra:
            mood = pref.extra.get("mood", mood)
            if not tags_m:
                tags_m = (pref.extra.get("person1") or {}).get("tags", [])
            if not tags_f:
                tags_f = (pref.extra.get("person2") or {}).get("tags", [])

    # 2. [TODO] 딥에이전트 서버 호출 — DEEP_AGENT_URL 확정 후 아래 주석 해제
    # if DEEP_AGENT_URL:
    #     import httpx
    #     ai_payload = {
    #         "region": req.region, "lat": req.lat, "lon": req.lon,
    #         "date": req.date, "weather": req.weather, "temp": req.temp,
    #         "budget_min": req.budget_min, "budget_max": budget_max,
    #         "tags_m": tags_m, "tags_f": tags_f,
    #     }
    #     async with httpx.AsyncClient() as client:
    #         ai_res = await client.post(f"{DEEP_AGENT_URL}/generate", json=ai_payload, timeout=30)
    #         ai_data = ai_res.json()
    #     return CourseResponse(
    #         course_id=str(uuid.uuid4()), user_id=req.user_id,
    #         region=req.region, date=req.date, weather=req.weather,
    #         budget_max=budget_max, tags_m=tags_m, tags_f=tags_f,
    #         courses=ai_data.get("courses", []),
    #     )

    # 3. 임시: DB 기반 코스 생성
    cafe_budget = int(budget_max * 0.15)
    dinner_budget = int(budget_max * 0.50)
    activity_budget = int(budget_max * 0.35)

    weather_info = await get_weather(req.lat, req.lon, req.region)

    cafes = await _fetch_places("카페", req.region, db)
    restaurants = await _fetch_places("레스토랑", req.region, db)
    activities = await _fetch_places("문화", req.region, db)

    def _place_item(p: Place | None, fallback: str, cat: str, time: str, price: int) -> PlaceItem:
        return PlaceItem(
            name=p.name if p else fallback,
            category=cat,
            region=req.region,
            time=time,
            price=price,
            is_open=True,
            latitude=float(p.latitude) if p and p.latitude else None,
            longitude=float(p.longitude) if p and p.longitude else None,
        )

    weather_desc = req.weather or weather_info.get("description", "")
    course = CourseItem(
        title=f"{mood} 코스 ({weather_desc})",
        total_price=cafe_budget + dinner_budget + activity_budget,
        places=[
            _place_item(cafes[0] if cafes else None, f"{req.region} 카페", "카페", req.start_time, cafe_budget),
            _place_item(activities[0] if activities else None, f"{req.region} 문화시설", "문화", "15:00", activity_budget),
            _place_item(restaurants[0] if restaurants else None, f"{req.region} 레스토랑", "레스토랑", "18:00", dinner_budget),
        ],
    )

    return CourseResponse(
        course_id=str(uuid.uuid4()),
        user_id=req.user_id,
        region=req.region,
        date=req.date,
        weather=req.weather or weather_info.get("description"),
        budget_max=budget_max,
        tags_m=tags_m,
        tags_f=tags_f,
        courses=[course],
    )


@router.get(
    "/{course_id}",
    summary="코스 조회",
    description="코스 ID로 저장된 코스를 조회합니다. (향후 DB 저장 연동 예정)",
)
async def get_course(course_id: str) -> dict:
    return {"course_id": course_id, "message": "코스 조회 기능 구현 예정"}
