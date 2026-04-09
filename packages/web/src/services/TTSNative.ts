import { getNowISOString, type SpeechOptions } from '@audiobook/shared';
import type { SpeechStatus } from './SpeechService';

export interface TTSConfigs extends Omit<SpeechOptions, 'voice'> {
  voice?: SpeechSynthesisVoice | string;
  lang?: string;
}

export class TTSNative {
  private synthesis: SpeechSynthesis = window.speechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastBoundaryTimestamp: number | null = null;
  private status: SpeechStatus = 'idle';

  constructor() {
    this.synthesis.onvoiceschanged = () => {
      console.log('Voices loaded:', this.synthesis.getVoices().length);
    };
  }

  speak(text: string, configs: TTSConfigs = {}, onEnd?: () => void, onError?: () => void): void {
    // Cancel any ongoing speech
    this.stop();

    this.utterance = new SpeechSynthesisUtterance(text);

    // Apply configs
    this.utterance.lang = configs.lang ?? 'eng';
    this.utterance.rate = configs.rate ?? 1.0;
    this.utterance.pitch = configs.pitch ?? 1.0;
    this.utterance.volume = configs.volume ?? 1.0;

    if (configs.voice) {
      this.utterance.voice = typeof configs.voice === 'string' ? this.getVoice(configs) : configs.voice;
    }

    this.utterance.onboundary = () => {
      this.lastBoundaryTimestamp = performance.now();
    };

    this.utterance.onstart = () => {
      this.status = 'speaking';
      this.lastBoundaryTimestamp = performance.now();
      this.startHeartbeat();
    };

    this.utterance.onend = () => {
      this.status = 'idle';
      this.lastBoundaryTimestamp = null;
      this.clearHeartbeat();
      onEnd?.();
    };

    this.utterance.onerror = (event) => {
      if (event.error !== 'interrupted') {
        console.error('❌ TTS error:', event);
      }
      this.status = 'idle';
      this.lastBoundaryTimestamp = null;
      this.clearHeartbeat();
      onError?.();
    };

    try {
      this.synthesis.speak(this.utterance);
    } catch (error) {
      console.error('❌ Failed to start TTS speech:', error);
      this.status = 'idle';
      this.lastBoundaryTimestamp = null;
      this.clearHeartbeat();
      onError?.();
    }
  }

  pause(): void {
    if (this.synthesis.speaking) {
      this.synthesis.pause();
      this.status = 'paused';
    }
  }

  resume(): void {
    if (this.synthesis.paused) {
      this.synthesis.resume();
      this.status = 'speaking';
    }
  }

  stop(): void {
    this.status = 'idle';
    this.clearHeartbeat();
    this.synthesis.cancel();
    this.utterance = null;
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      // Chrome/Safari Fix: SpeechSynthesis often "times out" after 15s.
      // Pausing and resuming instantly keeps the engine active.
      if (!this.synthesis.speaking || this.synthesis.paused) return;

      const now = performance.now();
      const idleMs = this.lastBoundaryTimestamp ? now - this.lastBoundaryTimestamp : Infinity;

      if (idleMs < 12000) return;

      console.log('[TTSNative] heartbeat', this.synthesis.speaking, this.synthesis.paused, idleMs, getNowISOString());

      this.synthesis.pause();
      this.synthesis.resume();
    }, 5000);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getStatus(): SpeechStatus {
    return this.status;
  }

  getVoices(configs: TTSConfigs): SpeechSynthesisVoice[] {
    const voices = this.synthesis.getVoices();
    const foundVoices = voices.filter((v) => v.lang === configs.lang && v.localService);
    return foundVoices;
  }

  getVoice(configs: TTSConfigs): SpeechSynthesisVoice | null {
    const foundVoices = this.getVoices(configs);
    const defaultVoice = foundVoices[0] || null;
    if (!configs.voice) return defaultVoice;

    const found = foundVoices.find((v) => v.name === configs.voice || v.voiceURI === configs.voice);
    return found || defaultVoice;
  }

  setRate(rate: number): void {
    if (this.utterance) this.utterance.rate = rate;
  }

  setPitch(pitch: number): void {
    if (this.utterance) this.utterance.pitch = pitch;
  }

  setVolume(volume: number): void {
    if (this.utterance) this.utterance.volume = volume;
  }
}
