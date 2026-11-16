from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import os

from app.models import Points, Base, CoverageHistory, HistoryCreate
from app.optimizer import cluster_points

app = FastAPI(title="SFR Coverage Optimizer")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local.db")

# ✅ Force driver postgresql+psycopg2 agar tidak error ModulenotFoundError 'psycopg'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Auto-create table di PostgreSQL / SQLite saat app start
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Static & Templates Setup
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(BASE_DIR, "static")),
    name="static"
)

templates = Jinja2Templates(
    directory=os.path.join(BASE_DIR, "templates")
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )

@app.post("/optimize")
def optimize(data: Points):
    centers = cluster_points(data.locations)
    return {"recommended_points": centers}

# ================= DATABASE ENDPOINTS =================

@app.get("/api/history")
def get_history(db: Session = Depends(get_db)):
    records = db.query(CoverageHistory).order_by(CoverageHistory.id.desc()).all()
    return [
        {
            "id": r.id,
            "nama": r.nama,
            "tanggal": r.tanggal,
            "rawPoints": r.raw_points,
            "standingPoints": r.standing_points
        } for r in records
    ]

@app.post("/api/history")
def create_history(item: HistoryCreate, db: Session = Depends(get_db)):
    record = CoverageHistory(
        nama=item.nama,
        tanggal=item.tanggal,
        raw_points=item.rawPoints,
        standing_points=item.standingPoints
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"status": "success", "id": record.id}

@app.delete("/api/history/{history_id}")
def delete_history(history_id: int, db: Session = Depends(get_db)):
    record = db.query(CoverageHistory).filter(CoverageHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(record)
    db.commit()
    return {"status": "deleted"}