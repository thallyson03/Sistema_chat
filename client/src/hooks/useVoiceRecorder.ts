import { useCallback, useEffect, useRef, useState } from 'react';

export type VoicePreview = {
  blob: Blob;
  url: string;
  mimeType: string;
  extension: string;
};

type VoiceRecorderOptions = {
  onSend: (file: File, meta: { mimeType: string; extension: string }) => Promise<void>;
  onError?: (message: string) => void;
};

function pickMimeType(): string {
  const mimeTypes = [
    'audio/ogg;codecs=opus',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/wav',
  ];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return '';
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  return 'ogg';
}

export function useVoiceRecorder({ onSend, onError }: VoiceRecorderOptions) {
  const reportError = useCallback(
    (message: string) => {
      if (onError) onError(message);
      else alert(message);
    },
    [onError],
  );

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [preview, setPreview] = useState<VoicePreview | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [sending, setSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const revokePreview = useCallback((item: VoicePreview | null) => {
    if (item?.url) URL.revokeObjectURL(item.url);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewPlaying(false);
  }, []);

  const resetSession = useCallback(() => {
    clearTimer();
    cleanupStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    mimeTypeRef.current = '';
    setIsActive(false);
    setIsPaused(false);
    setElapsedSec(0);
  }, [clearTimer, cleanupStream]);

  const cancelAll = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    resetSession();
    setPreview((prev) => {
      revokePreview(prev);
      return null;
    });
  }, [resetSession, revokePreview]);

  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  const start = useCallback(async () => {
    if (isActive || preview || sending) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      reportError('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge.');
      return;
    }

    try {
      const permission = await navigator.permissions
        ?.query({ name: 'microphone' as PermissionName })
        .catch(() => null);
      if (permission?.state === 'denied') {
        reportError(
          'Permissão de microfone negada. Permita o acesso nas configurações do navegador.',
        );
        return;
      }
    } catch {
      /* permissions.query opcional */
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (mediaError: unknown) {
      const err = mediaError as { name?: string; message?: string };
      let msg = 'Erro ao acessar o microfone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão de microfone negada. Recarregue a página após permitir o acesso.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Nenhum microfone encontrado.';
      } else if (err.name === 'NotReadableError') {
        msg = 'O microfone está em uso por outro aplicativo.';
      }
      reportError(msg);
      return;
    }

    if (!window.MediaRecorder) {
      stream.getTracks().forEach((t) => t.stop());
      reportError('Seu navegador não suporta gravação de áudio. Use Chrome, Firefox ou Edge atualizado.');
      return;
    }

    const selectedMimeType = pickMimeType();
    mimeTypeRef.current = selectedMimeType;
    chunksRef.current = [];

    const recorder = selectedMimeType
      ? new MediaRecorder(stream, { mimeType: selectedMimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onerror = () => {
      reportError('Erro durante a gravação. Tente novamente.');
      resetSession();
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.onstop = () => {
      clearTimer();
      cleanupStream();
      mediaRecorderRef.current = null;
      setIsActive(false);
      setIsPaused(false);

      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (chunks.length === 0) {
        reportError('Nenhum áudio foi gravado. Tente novamente.');
        return;
      }

      const mimeType = mimeTypeRef.current || recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) {
        reportError('O áudio gravado está vazio. Tente novamente.');
        return;
      }

      const extension = extensionFromMime(mimeType);
      const url = URL.createObjectURL(blob);
      setPreview({ blob, url, mimeType, extension });
    };

    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsActive(true);
    setIsPaused(false);
    setElapsedSec(0);
    clearTimer();
    timerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  }, [
    isActive,
    preview,
    sending,
    reportError,
    resetSession,
    clearTimer,
    cleanupStream,
  ]);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    if (typeof recorder.pause !== 'function') {
      reportError('Seu navegador não suporta pausar a gravação.');
      return;
    }
    recorder.pause();
    setIsPaused(true);
    clearTimer();
  }, [reportError, clearTimer]);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    setIsPaused(false);
    clearTimer();
    timerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  }, [clearTimer]);

  const finish = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    clearTimer();
    recorder.stop();
  }, [clearTimer]);

  const discardPreview = useCallback(() => {
    setPreview((prev) => {
      revokePreview(prev);
      return null;
    });
  }, [revokePreview]);

  const togglePreviewPlayback = useCallback(() => {
    if (!preview) return;
    let audio = previewAudioRef.current;
    if (!audio) {
      audio = new Audio(preview.url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewPlaying(false);
      audio.onpause = () => setPreviewPlaying(false);
    }
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
    } else {
      audio.play().then(() => setPreviewPlaying(true)).catch(() => {
        reportError('Não foi possível reproduzir o áudio.');
      });
    }
  }, [preview, previewPlaying, reportError]);

  const sendPreview = useCallback(async () => {
    if (!preview || sending) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setPreviewPlaying(false);
    }
    setSending(true);
    try {
      const file = new File([preview.blob], `audio.${preview.extension}`, {
        type: preview.mimeType,
      });
      await onSend(file, { mimeType: preview.mimeType, extension: preview.extension });
      setPreview((prev) => {
        revokePreview(prev);
        return null;
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      reportError(err.message || 'Erro ao enviar áudio.');
    } finally {
      setSending(false);
    }
  }, [preview, sending, onSend, revokePreview, reportError]);

  const formatElapsed = useCallback(() => {
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [elapsedSec]);

  /** true enquanto grava ou está pausado (antes do preview) */
  const isRecordingSession = isActive;
  /** para presença WhatsApp: gravando ativamente */
  const isRecordingLive = isActive && !isPaused;

  return {
    isActive,
    isPaused,
    isRecordingSession,
    isRecordingLive,
    preview,
    previewPlaying,
    sending,
    elapsedSec,
    formatElapsed,
    start,
    pause,
    resume,
    finish,
    cancelAll,
    discardPreview,
    togglePreviewPlayback,
    sendPreview,
    supportsPause: typeof MediaRecorder !== 'undefined' && 'pause' in MediaRecorder.prototype,
  };
}
