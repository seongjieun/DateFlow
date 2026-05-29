"""코스 생성 스키마 (B1 호환 인터페이스)."""
from typing import List, Optional
from pydantic import BaseModel


class CourseRequest(BaseModel):
    user_id: str
    region: str
    lat: float
    lon: float
    start_time: str = "13:00"
    end_time: str = "21:00"
    budget: int = 0           # 레거시 호환
    budget_min: int = 0
    budget_max: int = 100000
    date: Optional[str] = None
    weather: Optional[str] = None
    temp: Optional[float] = None
    tags_m: List[str] = []    # 없으면 백엔드가 DB에서 조회
    tags_f: List[str] = []
    natural_input: Optional[str] = None


class PlaceItem(BaseModel):
    name: str
    category: str
    region: str
    time: str
    price: int
    is_open: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CourseItem(BaseModel):
    title: str
    total_price: int
    places: List[PlaceItem]


class CourseResponse(BaseModel):
    course_id: str
    user_id: str
    region: str
    date: Optional[str] = None
    weather: Optional[str] = None
    budget_max: int = 100000
    tags_m: List[str] = []
    tags_f: List[str] = []
    courses: List[CourseItem]
