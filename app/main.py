from fastapi import FastAPI, Request, HTTPException, Depends, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import os

from app.models import Points, Base, CoverageHistory, HistoryCreate
from app.optimizer import cluster_points

app = FastAPI(title="SFR Coverage Optimizer")

# ✅ Kunci Rahasia Session (bisa diatur dari Environment Render)
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-this")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# ✅ Username & Password Default (dapat diubah via Environment Variable Render)
ADMIN_USERNAME = os.getenv("APP_USER", "admin")
ADMIN_PASSWORD = os.getenv("APP_PASS", "admin123")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg2://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Middleware Pengecekan Login
def verify_login(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=status.HTTP_307_TEMPORARY_REDIRECT, headers={"Location": "/login"})
    return user

# Static & Templates Setup
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(BASE_DIR, "static")),
    name="static"
)

templates = Jinja2Templates(
    directory=os.path.join(BASE_DIR, "templates")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= AUTH ENDPOINTS =================

@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if request.session.get("user"):
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(request=request, name="login.html")

@app.post("/login")
def login_action(request: Request, username: str = Form(...), password: str = Form(...)):
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        request.session["user"] = username
        return RedirectResponse(url="/", status_code=303)
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={"error": "Username atau Password salah!"}
    )

@app.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)

# ================= PROTECTED APP ENDPOINTS =================

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    if not request.session.get("user"):
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse(
        request=request,
        name="index.html"
    )

@app.post("/optimize")
def optimize(data: Points, request: Request):
    if not request.session.get("user"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    centers = cluster_points(data.locations)
    return {"recommended_points": centers}

# ================= PROTECTED DATABASE ENDPOINTS =================

@app.get("/api/history")
def get_history(request: Request, db: Session = Depends(get_db)):
    if not request.session.get("user"):
        raise HTTPException(status_code=401, detail="Unauthorized")
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
def create_history(item: HistoryCreate, request: Request, db: Session = Depends(get_db)):
    if not request.session.get("user"):
        raise HTTPException(status_code=401, detail="Unauthorized")
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
def delete_history(history_id: int, request: Request, db: Session = Depends(get_db)):
    if not request.session.get("user"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    record = db.query(CoverageHistory).filter(CoverageHistory.id == history_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(record)
    db.commit()
    return {"status": "deleted"}