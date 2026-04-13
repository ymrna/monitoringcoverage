from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

import os  # ✅ WAJIB

from app.models import Points
from app.optimizer import cluster_points

app = FastAPI(title="SFR Coverage Optimizer")

# ✅ FIX PATH ABSOLUTE
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ✅ STATIC FIX
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(BASE_DIR, "static")),
    name="static"
)

# ✅ TEMPLATE FIX
templates = Jinja2Templates(
    directory=os.path.join(BASE_DIR, "templates")
)

# ✅ CORS
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