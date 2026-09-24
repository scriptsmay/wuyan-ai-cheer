import { ref } from 'vue';
import { ApiError, generateCheerStream, type CheerStreamCallbacks } from '../lib/api';
import type { CheerResult, Mood } from '../types';

export interface UseStreamingOptions {
  onStreamingComplete?: (result: CheerResult) => void;
  onError?: (code: string, message: string) => void;
}

export function useStreaming(options: UseStreamingOptions = {}) {
  const useStreaming = ref(true);
  const showStreamingModal = ref(false);
  const streamingThinkingText = ref('');
  const streamingText = ref('');
  const streamingRetryMessage = ref('');
  const streamingError = ref('');
  const isStreamingComplete = ref(false);
  const result = ref<CheerResult | null>(null);

  // 检查是否启用流式模式
  if (typeof window !== 'undefined') {
    const streamingPref = localStorage.getItem('vite_use_streaming');
    if (streamingPref !== null) {
      useStreaming.value = streamingPref === 'true';
    }
  }

  function resetStreamingState() {
    streamingThinkingText.value = '';
    streamingText.value = '';
    streamingRetryMessage.value = '';
    streamingError.value = '';
    isStreamingComplete.value = false;
    result.value = null;
  }

  async function submitWithStreaming(
    mood: Mood,
    text: string,
    requestId: string,
    onComplete?: (result: CheerResult) => void
  ): Promise<void> {
    resetStreamingState();
    showStreamingModal.value = true;

    let streamErrorReported = false;
    const callbacks: CheerStreamCallbacks = {
      onConnected: () => {},
      onThinking: (text: string) => {
        // 清理思考文本中的 { 符号
        streamingThinkingText.value = text.replace(/\{/g, '').replace(/\}/g, '');
      },
      onChunk: (text: string) => {
        // 只保留当前 chunk 的文本，并清理 { 符号
        streamingText.value = text.replace(/\{/g, '').replace(/\}/g, '');
      },
      onRetry: (msg: string, attempt: number) => {
        streamingRetryMessage.value = `${msg} (${attempt}/2)`;
        streamingThinkingText.value = '';
        streamingText.value = '';
      },
      onComplete: (resultData: CheerResult) => {
        isStreamingComplete.value = true;
        result.value = resultData;
        options.onStreamingComplete?.(resultData);
        onComplete?.(resultData);
      },
      onError: (code: string, msg: string) => {
        if (streamErrorReported) return;
        streamErrorReported = true;
        streamingError.value = msg;
        options.onError?.(code, msg);
      },
    };

    try {
      await generateCheerStream(mood, text.trim(), requestId, callbacks);
    } catch (error) {
      if (error instanceof Error && !streamErrorReported) {
        const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
        streamingError.value = error.message;
        options.onError?.(code, error.message);
      }
    }
  }

  function handleCloseStreamingModal() {
    showStreamingModal.value = false;
  }

  return {
    useStreaming,
    showStreamingModal,
    streamingThinkingText,
    streamingText,
    streamingRetryMessage,
    streamingError,
    isStreamingComplete,
    result,
    resetStreamingState,
    submitWithStreaming,
    handleCloseStreamingModal,
  };
}
