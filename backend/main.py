from fastapi import FastAPI

from db.database import init_db

app = FastAPI()

# include routes


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/")
def home():
    return {"message": "API running"}