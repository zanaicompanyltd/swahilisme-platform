from fastapi import APIRouter, Request
from services.whatsapp.whatsapp_service import WhatsAppService
import os

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")


@router.get("/webhook")
def verify_webhook(
    hub_mode: str = None,
    hub_verify_token: str = None,
    hub_challenge: str = None
):

    if hub_verify_token == VERIFY_TOKEN:
        return int(hub_challenge)

    return {"error": "Verification failed"}


@router.post("/webhook")
async def receive_webhook(request: Request):

    body = await request.json()

    print("Webhook received:")
    print(body)

    return {"status": "received"}


@router.post("/send")
def send_test_message():

    return result