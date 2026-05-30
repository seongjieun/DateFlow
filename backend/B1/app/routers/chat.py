import sys
import os
import math
from pathlib import Path
from fastapi import APIRouter
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.weather import get_weather
from app.routers.course import fetch_places

# AI 모듈 경로 추가
AI_PATH = str(Path.home() / "DateFlow/ai")
sys.path.insert(0, AI_PATH)

# AI .env 로드
from dotenv import load_dotenv
load_dotenv(Path(AI_PATH) / ".env")

router = APIRouter()

def calc_walk_minutes(lat1, lon1, lat2, lon2):
    if not all([lat1, lon1, lat2, lon2]):
        return None
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    distance = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return round(distance / 67)

@router.post("/message", response_model=ChatResponse)
async def chat_message(req: ChatRequest):
    msg = req.message
    region = req.region or "홍대"
    lat = req.lat or 37.556
    lon = req.lon or 126.923
    budget = req.budget or 100000

    # 1. 날씨 조회
    weather = await get_weather(lat, lon, region)
    temp = weather.get("temperature")
    desc = weather.get("description", "")
    pop = weather.get("pop", 0)
    is_outdoor = weather.get("is_outdoor_ok", True)
    weather_info = f"현재 {region} 날씨는 {desc}, {temp}°C, 강수확률 {pop}%예요."

    # 2. AI 추천 호출
    ai_events = []
    try:
        from agents.pipeline1 import recommend_events
        ai_result = recommend_events(
            natural_language=msg,
            weather={"condition": desc, "temp_celsius": temp},
            area=region,
        )
        ai_events = ai_result.get("events", [])
    except Exception as e:
        print(f"AI 호출 실패: {e}")

    # 3. AI 결과가 있으면 AI 기반 코스
    if ai_events:
        places = []
        times = ["13:00", "15:00", "17:00", "19:00", "20:00"]
        for i, event in enumerate(ai_events[:4]):
            places.append({
                "name": event.get("name", ""),
                "category": event.get("category", "기타"),
                "time": times[i] if i < len(times) else "21:00",
                "price": int(budget / len(ai_events[:4])),
                "latitude": None,
                "longitude": None,
                "reason": event.get("reason", ""),
                "address": event.get("address", ""),
                "place_url": event.get("place_url", ""),
            })

        # 도보 이동시간
        for i in range(len(places) - 1):
            places[i]["walk_minutes_to_next"] = 10  # AI 장소는 좌표 없으므로 기본값

        reply = f"AI가 {region} 데이트 코스를 추천했어요! {weather_info}"
        suggestions = ["다른 코스 추천", "시간 변경", "예산 줄여줘", "실내로 변경"]

    # 4. AI 실패시 기존 방식
    else:
        cafes = await fetch_places("카페", region)
        restaurants = await fetch_places("레스토랑", region)
        bars = await fetch_places("바/펍", region)
        if not bars:
            bars = await fetch_places("기타", region)

        cafe_budget = int(budget * 0.15)
        dinner_budget = int(budget * 0.50)
        bar_budget = int(budget * 0.35)

        def pick_place(data, fallback, category, time, price):
            if data:
                return {
                    "name": data[0]["name"],
                    "category": category,
                    "time": time,
                    "price": price,
                    "latitude": float(data[0]["latitude"]) if data[0].get("latitude") else None,
                    "longitude": float(data[0]["longitude"]) if data[0].get("longitude") else None,
                }
            return {"name": fallback, "category": category, "time": time, "price": price, "latitude": None, "longitude": None}

        places = [
            pick_place(cafes, f"{region} 카페", "카페", "14:00", cafe_budget),
            pick_place(restaurants, f"{region} 레스토랑", "식당", "18:00", dinner_budget),
            pick_place(bars, f"{region} 바", "바", "20:00", bar_budget),
        ]

        for i in range(len(places) - 1):
            places[i]["walk_minutes_to_next"] = calc_walk_minutes(
                places[i]["latitude"], places[i]["longitude"],
                places[i+1]["latitude"], places[i+1]["longitude"],
            )

        reply = f"데이트 코스를 준비했어요! {weather_info}"
        suggestions = ["카페 바꿔줘", "예산 줄여줘", "실내로 변경", "동선 지도 보기"]

    return ChatResponse(
        reply=reply,
        course={
            "title": f"{region} 데이트 코스 ({desc})",
            "total_price": budget,
            "weather": {"description": desc, "temperature": temp, "pop": pop},
            "places": places,
        },
        suggestions=suggestions,
    )