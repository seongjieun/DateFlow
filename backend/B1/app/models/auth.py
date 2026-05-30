from sqlalchemy import Column, String, DateTime
from app.database import Base
from datetime import datetime, timezone

def utcnow():
    return datetime.now(timezone.utc)

class LocalAuth(Base):
    __tablename__ = "local_auth"

    id           = Column(String, primary_key=True)  # uuid4 문자열
    username     = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    user_id      = Column(String, unique=True, nullable=False)
    nickname     = Column(String(50), nullable=False)
    gender       = Column(String(10), nullable=False, default="N")
    created_at   = Column(DateTime, default=utcnow)