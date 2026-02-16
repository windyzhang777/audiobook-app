import { type SpeechOptions } from '@audiobook/shared';

export type TTSStatus = 'idle' | 'speaking' | 'paused';

export interface TTSOptions extends Omit<SpeechOptions, 'voice'> {
  voice?: SpeechSynthesisVoice;
  lang?: string;
}

export class TTSNative {
  private synthesis: SpeechSynthesis = window.speechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private status: TTSStatus = 'idle';

  constructor() {
    this.synthesis.onvoiceschanged = () => {
      console.log('Voices loaded:', this.synthesis.getVoices().length);
    };
  }

  speak(text: string, options: TTSOptions = {}, onEnd?: () => void, onError?: () => void): void {
    // Cancel any ongoing speech
    this.stop();

    this.utterance = new SpeechSynthesisUtterance(text);

    // Apply options
    this.utterance.lang = options.lang ?? 'eng';
    this.utterance.rate = options.rate ?? 1.0;
    this.utterance.pitch = options.pitch ?? 1.0;
    this.utterance.volume = options.volume ?? 1.0;
    if (options.voice) this.utterance.voice = options.voice;

    this.utterance.onstart = () => {
      this.status = 'speaking';
      this.startHeartbeat();
    };

    this.utterance.onend = () => {
      this.status = 'idle';
      this.clearHeartbeat();
      onEnd?.();
    };

    this.utterance.onerror = () => {
      this.status = 'idle';
      this.clearHeartbeat();
      onError?.();
    };

    this.synthesis.speak(this.utterance);
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
      if (this.synthesis.speaking && !this.synthesis.paused) {
        this.synthesis.pause();
        this.synthesis.resume();
      }
    }, 10000);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getStatus(): TTSStatus {
    return this.status;
  }

  getVoice(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
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

export const ttsNative = new TTSNative();
