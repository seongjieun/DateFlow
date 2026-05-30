from pydantic import BaseModel
from typing import Optional, List

class ChatRequest(BaseModel):
    user_id: str
    message: str
    region: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    budget: Optional[int] = None

class ChatResponse(BaseModel):
    reply: str
    course: Optional[dict] = None
    suggestions: List[str] = []