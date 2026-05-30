import sys
import math
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import UserPreference
from app.schemas.course import CourseRequest, CourseResponse, CourseItem, PlaceItem
from app.services.weather import get_weather
import uuid
import httpx

# AI 모듈 경로 추가
AI_PATH = str(Path.home() / "DateFlow/ai")
sys.path.insert(0, AI_PATH)
from dotenv import load_dotenv
import os
KAKAO_KEY = os.getenv("KAKAO_REST_API_KEY", "")  # .env에 KAKAO_REST_API_KEY 설정 필요
load_dotenv(Path(AI_PATH) / ".env")

router = APIRouter()

B2_URL = "http://localhost:8001"

async def fetch_places(category: str, area: str) -> list[dict]:
    """B2 API에서 실제 장소 데이터 가져오기 (없으면 실시간 수집)"""
    clean_area = area.replace("공원", "").replace("입구", "").replace("역", "").strip()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{B2_URL}/places",
                params={"category": category, "area": clean_area, "size": 5}
            )
            data = res.json()
            places = data.get("places", [])
            if not places:
                await client.post(
                    f"{B2_URL}/places/collect",
                    json={"query": f"{clean_area} {category}", "crawl_supplement": False}
                )
                res = await client.get(
                    f"{B2_URL}/places",
                    params={"category": category, "area": clean_area, "size": 5}
                )
                data = res.json()
                places = data.get("places", [])
            return places
    except Exception:
        return []

import httpx

async def calc_transport_minutes(lat1, lon1, lat2, lon2):
    """카카오 모빌리티 API로 자동차/도보 이동 시간 계산"""
    if not all([lat1, lon1, lat2, lon2]):
        return None, None
    
    KAKAO_KEY = os.getenv("KAKAO_REST_API_KEY")
    headers = {"Authorization": f"KakaoAK {KAKAO_KEY}"}

    # 자동차
    car_minutes = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://apis-navi.kakaomobility.com/v1/directions",
                headers=headers,
                params={
                    "origin": f"{lon1},{lat1}",
                    "destination": f"{lon2},{lat2}",
                    "priority": "RECOMMEND"
                }
            )
            data = resp.json()
            car_minutes = round(data["routes"][0]["summary"]["duration"] / 60)
    except:
        pass

    # 도보
    walk_minutes = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://apis-navi.kakaomobility.com/v1/directions",
                headers=headers,
                params={
                    "origin": f"{lon1},{lat1}",
                    "destination": f"{lon2},{lat2}",
                    "priority": "WALK"
                }
            )
            data = resp.json()
            walk_minutes = round(data["routes"][0]["summary"]["duration"] / 60)
    except:
        # 폴백: 직선거리
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        distance = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        walk_minutes = round(distance / 67)

    return car_minutes, walk_minutes

def calc_satisfaction(tags: list, category: str) -> int:
    """취향 태그와 장소 카테고리 매칭해서 만족도 계산"""
    score = 60  # 기본 점수

    MATCH = {
        "카페": ["감성 카페", "여유로운 카페", "디저트 맛집", "브런치", "조용한 분위기"],
        "식당": ["맛집 탐방", "디저트 맛집", "브런치", "활기찬 분위기"],
        "레스토랑": ["맛집 탐방", "로맨틱", "고급스러운", "조용한 분위기"],
        "바": ["활기찬 분위기", "핫플 방문", "캐주얼"],
        "전시": ["전시·문화", "조용한 분위기", "감성 카페", "로맨틱"],
        "공연": ["전시·문화", "활기찬 분위기", "활동적인 코스"],
        "체험": ["활동적인 코스", "핫플 방문"],
        "기타": ["핫플 방문", "산책·자연"],
    }

    matches = MATCH.get(category, [])
    for tag in tags:
        if tag in matches:
            score += 10
    
    # 최대 95, 최소 55
    return min(95, max(55, score))

@router.post("/generate", response_model=CourseResponse)
async def generate_course(req: CourseRequest, db: Session = Depends(get_db)):

    # 1. 사용자 취향 조회
    prefs = db.query(UserPreference).filter(
        UserPreference.user_id == req.user_id
    ).first()

    mood   = prefs.mood   if prefs else "감성적"
    budget = prefs.budget if prefs else req.budget_max

    # 취향 태그 (프론트에서 보낸 것 또는 DB)
    tags_a = []
    tags_b = []
    if prefs:
        tags_a = prefs.mood.split(",") if prefs.mood else ["감성 카페"]
        tags_b = ["맛집 탐방"]  # TODO: B님 취향도 DB에서 가져오기
    else:
        tags_a = ["감성 카페", "로맨틱"]
        tags_b = ["맛집 탐방", "활기찬 분위기"]

    # 2. 예산 필터링
    if req.budget_max < 10000:
        raise HTTPException(status_code=400, detail="예산은 최소 10,000원 이상이어야 합니다.")

    # 3. 날씨 조회
    weather = await get_weather(req.lat, req.lon, req.region)



    # 4. AI 추천 시도
    ai_places = []
    print(">>> AI 추천 시도 시작")
    try:
        from agents.pipeline1 import recommend_events
        print(">>> AI import 성공")
        ai_result = recommend_events(
            natural_language=req.natural_input or f"{req.region}에서 {mood} 데이트",
            weather={"condition": weather.get("description", ""), "temp_celsius": weather.get("temperature", 20)},
            area=req.region,
        )
        print(f">>> AI 결과: {ai_result}")
        ai_events = ai_result.get("events", [])
        print(f">>> AI 이벤트 수: {len(ai_events)}")
        if ai_events:
            times = ["13:00", "15:00", "17:00", "19:00"]
            for i, event in enumerate(ai_events[:4]):
                # 카카오 place_id에서 좌표 조회
                lat, lon = None, None
                place_id = event.get("place_id", "")
                if place_id.startswith("kakao:"):
                    kakao_id = place_id.replace("kakao:", "")
                    try:
                        async with httpx.AsyncClient(timeout=5.0) as client:
                            r = await client.get(
                                f"https://dapi.kakao.com/v2/local/place/id.json",
                                params={"id": kakao_id},
                                headers={"Authorization": f"KakaoAK {KAKAO_KEY}"}
                            )
                            d = r.json()
                            if d.get("documents"):
                                lat = float(d["documents"][0]["y"])
                                lon = float(d["documents"][0]["x"])
                    except Exception:
                        pass
                ai_places.append(PlaceItem(
                    name=event.get("name", ""),
                    category=event.get("category", "기타"),
                    region=req.region,
                    time=times[i] if i < len(times) else "20:00",
                    price=int(budget / len(ai_events[:4])),
                    is_open=True,   
                    latitude=lat,
                    longitude=lon,
                    satisfaction_a=calc_satisfaction(tags_a, event.get("category", "기타")),
                    satisfaction_b=calc_satisfaction(tags_b, event.get("category", "기타")),
                ))
            # 도보 이동시간
            for i in range(len(ai_places) - 1):
                car_min, walk_min = await calc_transport_minutes(
                    ai_places[i].latitude, ai_places[i].longitude,
                    ai_places[i+1].latitude, ai_places[i+1].longitude,
                )
                ai_places[i].walk_minutes_to_next = walk_min if walk_min else 10
                ai_places[i].car_minutes_to_next = car_min
    except Exception as e:
        print(f"AI 호출 실패, B2 폴백: {e}")

    # 5. AI 성공시 AI 코스, 실패시 B2 코스
    if ai_places:
        place_list = ai_places
        title = f"AI 추천 {mood} 코스 ({weather['description']})"
    else:
        cafe_budget = int(budget * 0.15)
        dinner_budget = int(budget * 0.50)
        bar_budget = int(budget * 0.35)

        cafes = await fetch_places("카페", req.region)
        restaurants = await fetch_places("레스토랑", req.region)
        bars = await fetch_places("바/펍", req.region)
        if not bars:
            bars = await fetch_places("기타", req.region)

        cafe_data = cafes[0] if cafes else None
        restaurant_data = restaurants[0] if restaurants else None
        bar_data = bars[0] if bars else None

        async def make_place(data, fallback_name, category, time, price):
            name = data["name"] if data else fallback_name
            lat = float(data["latitude"]) if data and data.get("latitude") else None
            lon = float(data["longitude"]) if data and data.get("longitude") else None

            # 좌표 없으면 카카오 Local API로 검색
            if not lat or not lon:
                try:
                    KAKAO_KEY = os.getenv("KAKAO_REST_API_KEY")
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(
                            "https://dapi.kakao.com/v2/local/search/keyword.json",
                            headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
                            params={"query": f"{req.region} {name}", "size": 1}
                        )
                        result = resp.json()
                        if result.get("documents"):
                            doc = result["documents"][0]
                            lat = float(doc["y"])
                            print(f">>> 좌표 조회 성공: {name} → {lat}, {lon}")
                            lon = float(doc["x"])
                except:
                    print(f">>> 좌표 조회 실패: {name}")
                    pass

            return PlaceItem(
                name=name,
                category=category,
                region=req.region,
                time=time,
                price=price,
                is_open=True,
                latitude=lat,
                longitude=lon,
                satisfaction_a=calc_satisfaction(tags_a, category),
                satisfaction_b=calc_satisfaction(tags_b, category),
            )

        place_list = [
            await make_place(cafe_data, f"{req.region} 카페", "카페", "13:00", cafe_budget),
            await make_place(restaurant_data, f"{req.region} 레스토랑", "식당", "18:00", dinner_budget),
            await make_place(bar_data, f"{req.region} 바", "바", "20:00", bar_budget),
        ]

        for i in range(len(place_list) - 1):
            car_min, walk_min = await calc_transport_minutes(
                place_list[i].latitude, place_list[i].longitude,
                place_list[i+1].latitude, place_list[i+1].longitude,
            )
            place_list[i].walk_minutes_to_next = walk_min
            place_list[i].car_minutes_to_next = car_min
        title = f"{mood} 코스 ({weather['description']})"

    course = CourseItem(
        title=title,
        total_price=budget,
        places=place_list,
    )

    return CourseResponse(
    course_id=str(uuid.uuid4()),
    user_id=req.user_id,
    region=req.region,
    budget_max=budget,  
    courses=[course],
)

@router.get("/{course_id}")
def get_course(course_id: str):
    return {"course_id": course_id, "message": "코스 조회 기능 구현 예정"}