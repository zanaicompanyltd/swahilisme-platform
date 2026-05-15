// frontend/src/hooks/useVoiceRecorder.js
// PWA-compatible MediaRecorder hook for Swahili voice input

import { useState, useRef, useCallback } from "react";

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function getSupportedMimeType() {
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function useVoiceRecorder() {
  const [state, setState] = useState("idle"); // idle | requesting | recording | processing
  const [error, setError] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,   // Whisper prefers 16kHz
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        // Stop microphone tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(200); // Collect data every 200ms for low latency
      startTimeRef.current = Date.now();

      // Update duration counter
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      setState("recording");
    } catch (err) {
      let msg = "Hitilafu ya kurekodi.";
      if (err.name === "NotAllowedError") msg = "Ruhusa ya maikrofoni inahitajika.";
      else if (err.name === "NotFoundError") msg = "Maikrofoni haikupatikana.";
      setError(msg);
      setState("idle");
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    setDuration(0);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setState("processing");
    }
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setError(null);
    setDuration(0);
    setState("idle");
  }, []);

  return {
    state,      // "idle" | "requesting" | "recording" | "processing"
    error,
    audioBlob,
    duration,
    startRecording,
    stopRecording,
    reset,
    isRecording: state === "recording",
    isProcessing: state === "processing",
  };
}