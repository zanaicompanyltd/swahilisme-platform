"""The speech service must never return canned text as if Whisper heard it."""
import asyncio
import pathlib
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from services.asr.whisper_service import WhisperASRService  # noqa: E402


def test_missing_groq_key_fails_clearly_instead_of_fabricating_transcription(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    service = WhisperASRService()

    try:
        asyncio.run(service.transcribe(b"real-looking-audio-bytes", "recording.webm"))
    except RuntimeError as exc:
        assert "GROQ_API_KEY is not configured" in str(exc)
    else:
        raise AssertionError("ASR returned a transcript without a configured provider")
