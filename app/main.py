from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.models import Points
from app.optimizer import cluster_points
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI(title="SFR Coverage Optimizer")



app.mount("/coverage/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(
    directory=os.path.join(BASE_DIR, "templates")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # bisa dibatasi nanti
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/optimize")
def optimize(data: Points):
    centers = cluster_points(data.locations)
    return {"recommended_points": centers}
