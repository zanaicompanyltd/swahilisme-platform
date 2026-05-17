from apscheduler.schedulers.background import BackgroundScheduler
from services.whatsapp.whatsapp_service import WhatsAppService

scheduler = BackgroundScheduler()


def send_weekly_summary():

    summary_message = (
        "Muhtasari wa wiki:\n"
        "Mapato: TZS 462,000\n"
        "Gharama: TZS 225,100\n"
        "Faida: TZS 236,900\n"
        "Hongera kwa maendeleo ya biashara yako!"
    )

    WhatsAppService.send_message(
        phone_number="2557XXXXXXXX",
        message=summary_message
    )


scheduler.add_job(
    send_weekly_summary,
    trigger="interval",
    weeks=1
)

scheduler.start()