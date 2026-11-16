from pydantic import BaseModel
from typing import List, Any  # ✅ Tambahkan Any di sini
from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class CoverageHistory(Base):
    __tablename__ = "coverage_history"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String, nullable=False)
    tanggal = Column(String, nullable=False)
    raw_points = Column(JSON, nullable=False)
    standing_points = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Points(BaseModel):
    locations: List[List[float]]

class HistoryCreate(BaseModel):
    nama: str
    tanggal: str
    rawPoints: List[Any]
    standingPoints: List[Any]