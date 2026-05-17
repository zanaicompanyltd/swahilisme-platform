"""
backend/services/asr/whisper_service.py
1.3.1 – ASR Integration using Groq Whisper Large V3 Turbo

Converts audio to mp3 via ffmpeg before sending to Groq (fixes webm rejection).
Falls back to sending raw audio if ffmpeg not available.
"""
import os
import logging
import tempfile
import subprocess
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_AUDIO_SIZE_MB = 25

# Short vocabulary hint only — no instructions (instructions leak into transcript)
SWAHILI_PROMPT = (
    "biashara, mauzo, gharama, mapato, shilingi, elfu, "
    "nimenunua, nimeuza, nililipa, malighafi, kodi, mshahara"
)


@dataclass
class ASRResult:
    transcript: str
    language: str
    confidence: float
    duration_seconds: float
    segments: list


class WhisperASRService:

    def __init__(self):
        self._api_key = os.getenv("GROQ_API_KEY", "")
        if not self._api_key:
            logger.warning("GROQ_API_KEY not set – using MockASRService")
        else:
            logger.info("WhisperASRService ready using Groq Whisper Large V3 Turbo")

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> ASRResult:
        if len(audio_bytes) > MAX_AUDIO_SIZE_MB * 1024 * 1024:
            raise ValueError(f"Audio file exceeds {MAX_AUDIO_SIZE_MB}MB limit")

        if not self._api_key:
            return await _mock_transcribe(audio_bytes, filename)

        # Save original audio to temp file
        suffix = Path(filename).suffix or ".webm"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        # Convert to mp3 using ffmpeg (Groq supports mp3 reliably)
        mp3_path = tmp_path.replace(suffix, ".mp3")
        converted = False

        try:
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_path,
                 "-ar", "16000", "-ac", "1", "-b:a", "64k",
                 mp3_path],
                capture_output=True, timeout=30
            )
            if result.returncode == 0:
                converted = True
                logger.info("Audio converted to mp3 successfully")
            else:
                logger.warning(f"ffmpeg conversion failed: {result.stderr.decode()}")
        except (FileNotFoundError, subprocess.TimeoutExpired) as e:
            logger.warning(f"ffmpeg not available: {e} — sending raw audio")

        # Use converted mp3 if available, else raw audio
        send_path = mp3_path if converted else tmp_path
        send_name = "audio.mp3" if converted else "audio.mp4"

        try:
            from groq import Groq
            client = Groq(api_key=self._api_key)

            with open(send_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model="whisper-large-v3-turbo",
                    file=(send_name, audio_file),
                    language="sw",
                    prompt=SWAHILI_PROMPT,
                    response_format="verbose_json",
                    temperature=0.0,
                )

            transcript = _clean_transcript(response.text.strip())
            segments = getattr(response, "segments", []) or []
            confidence = _estimate_confidence(segments)
            duration = getattr(response, "duration", 0.0) or 0.0

            return ASRResult(
                transcript=transcript,
                language=getattr(response, "language", "sw") or "sw",
                confidence=confidence,
                duration_seconds=float(duration),
                segments=segments,
            )

        except Exception as e:
            logger.error(f"Groq Whisper error: {e}")
            raise RuntimeError(f"Transcription failed: {str(e)}") from e

        finally:
            for path in [tmp_path, mp3_path]:
                try:
                    os.unlink(path)
                except Exception:
                    pass


def _clean_transcript(text: str) -> str:
    """Remove common Whisper hallucinations and prompt leakage."""
    hallucinations = [
        "tafadhali andika",
        "tafadhali andika kuhusu",
        "kuhusu mapato, gharama",
        "mauzo, au manunuzi",
        "hii ni rekodi",
        "mtumiaji anasema",
        "kwa kiswahili sahihi",
        "asante kwa kutazama",
    ]
    text_lower = text.lower()
    for phrase in hallucinations:
        idx = text_lower.find(phrase)
        if idx > 10:
            text = text[:idx].strip()
            text_lower = text.lower()
    return text.rstrip(".,;: ")


def _estimate_confidence(segments: list) -> float:
    if not segments:
        return 0.85
    log_probs = [s.get("avg_logprob", -0.5) for s in segments if "avg_logprob" in s]
    if not log_probs:
        return 0.85
    avg = sum(log_probs) / len(log_probs)
    return max(0.0, min(1.0, avg + 1.0))


# ── Mock fallback ─────────────────────────────────────────────────────────────
MOCK_RESPONSES = [
    "Nimeuza ndizi mia mbili leo, jumla shilingi elfu ishirini",
    "Nimenunua unga wa dona mifuko mitano, bei shilingi elfu kumi na mbili",
    "Leo nimepata mapato ya huduma shilingi elfu thelathini na tano",
    "Nililipa kodi ya duka shilingi elfu hamsini mwezi huu",
]

_mock_index = 0


async def _mock_transcribe(audio_bytes: bytes, filename: str) -> ASRResult:
    global _mock_index
    transcript = MOCK_RESPONSES[_mock_index % len(MOCK_RESPONSES)]
    _mock_index += 1
    logger.info(f"[MOCK ASR] Returning: {transcript}")
    return ASRResult(
        transcript=transcript,
        language="sw",
        confidence=0.92,
        duration_seconds=3.5,
        segments=[],
    )


# ── Singleton ─────────────────────────────────────────────────────────────────
_asr_service: WhisperASRService | None = None


def get_asr_service() -> WhisperASRService:
    global _asr_service
    if _asr_service is None:
        _asr_service = WhisperASRService()
    return _asr_service
