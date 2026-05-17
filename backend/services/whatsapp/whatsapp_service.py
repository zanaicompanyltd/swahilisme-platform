import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")


class WhatsAppService:

    BASE_URL = f"https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages"

    @staticmethod
    def send_message(phone_number: str, message: str):

        headers = {
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }

        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "text",
            "text": {
                "body": message
            }
        }

        response = requests.post(
            WhatsAppService.BASE_URL,
            headers=headers,
            json=payload
        )

        return response.json()