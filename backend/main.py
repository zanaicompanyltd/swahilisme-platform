import os
import sys

# Import root bootstrap — see backend/api/app.py. The backend uses flat
# top-level imports (db.database, models.*, services.*), so `backend/` must be
# importable no matter which directory or start command launched this file.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import FastAPI
from db.database import init_db
from fastapi.exceptions import RequestValidationError
from fastapi import Request, status
from fastapi.responses import JSONResponse

app = FastAPI()

# include routes
    
@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/")
def home():
    return {"message": "API running"}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"Validation Error Payload: {exc.body}")
    print(f"Validation Error Details: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )
