"""
backend/services/asr/whisper_service.py
1.3.1 – ASR Integration (OpenAI Whisper / Tanzanian Swahili)

Handles:
  • Audio upload → Whisper transcription (language="sw")
  • Confidence scoring via log-probability average
  • Fallback mock for offline / test environments
  • Supported formats: mp3, wav, m4a, ogg, webm (from PWA MediaRecorder)
"""
import os
import io
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# Supported audio MIME types from browser MediaRecorder
SUPPORTED_TYPES = {
    "audio/webm", "audio/webm;codecs=opus",
    "audio/ogg", "audio/ogg;codecs=opus",
    "audio/mp4", "audio/mpeg",
    "audio/wav", "audio/x-wav",
}

MAX_AUDIO_SIZE_MB = 25  # Whisper API limit


@dataclass
class ASRResult:
    transcript: str
    language: str
    confidence: float          # 0.0 – 1.0 (estimated from avg log-prob)
    duration_seconds: float
    segments: list             # Raw Whisper segments for debugging


class WhisperASRService:
    """
    Wraps OpenAI Whisper API for Tanzanian Swahili transcription.
    Falls back to MockASRService when OPENAI_API_KEY is not set.
    """

    SWAHILI_PROMPT = (
        "Hii ni rekodi ya biashara ndogo ya Afrika Mashariki. "
        "Mtumiaji anasema kuhusu mapato, gharama, mauzo, au manunuzi. "
        "Tafadhali andika kwa Kiswahili sahihi."
    )

    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key or api_key.startswith("sk-..."):
            logger.warning("OPENAI_API_KEY not set – using MockASRService")
            self._client = None
        else:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=api_key)
            except ImportError:
                logger.error("openai package not installed")
                self._client = None

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> ASRResult:
        """
        Transcribe audio bytes using Whisper.
        Returns ASRResult with Swahili transcript and confidence.
        """
        if len(audio_bytes) > MAX_AUDIO_SIZE_MB * 1024 * 1024:
            raise ValueError(f"Audio file exceeds {MAX_AUDIO_SIZE_MB}MB limit")

        if self._client is None:
            return await _mock_transcribe(audio_bytes, filename)

        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename  # Required by OpenAI client

        try:
            response = await self._client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="sw",                   # Swahili
                prompt=self.SWAHILI_PROMPT,       # Tanzanian context
                response_format="verbose_json",   # Includes segments + avg_logprob
                temperature=0.0,                  # Deterministic
            )

            # Extract confidence from segment log-probabilities
            segments = response.segments or []
            confidence = _estimate_confidence(segments)

            return ASRResult(
                transcript=response.text.strip(),
                language=response.language or "sw",
                confidence=confidence,
                duration_seconds=response.duration or 0.0,
                segments=segments,
            )

        except Exception as e:
            logger.error(f"Whisper API error: {e}")
            raise RuntimeError(f"Transcription failed: {str(e)}") from e


def _estimate_confidence(segments: list) -> float:
    """
    Convert Whisper's avg_logprob per segment to a 0–1 confidence score.
    avg_logprob is typically in range [-1, 0]; we map to [0, 1].
    """
    if not segments:
        return 0.5
    log_probs = [s.get("avg_logprob", -0.5) for s in segments if "avg_logprob" in s]
    if not log_probs:
        return 0.5
    avg = sum(log_probs) / len(log_probs)
    # Clamp: -1.0 → 0.0, 0.0 → 1.0
    return max(0.0, min(1.0, avg + 1.0))


# ── Mock service for development / testing ───────────────────────────────────
MOCK_RESPONSES = [
    "Nimeuza ndizi mia mbili leo, jumla shilingi elfu ishirini",
    "Nimenunua unga wa dona mifuko mitano, bei shilingi elfu kumi na mbili",
    "Leo nimepata mapato ya huduma shilingi elfu thelathini na tano",
    "Nililipa kodi ya duka shilingi elfu hamsini mwezi huu",
    "Nimenunua malighafi ya nyama kilo tano, shilingi elfu kumi na nane",
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