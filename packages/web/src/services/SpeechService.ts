import { VOICE_FALLBACK, type VoiceOption } from '@/common/useBookSettings';
import { TTSNative } from '@/services/TTSNative';
import { hasMarker, MAX_BOOKMARK_TEXT, type BookContent, type SpeechOptions } from '@audiobook/shared';

export type SpeechStatus = 'idle' | 'speaking' | 'paused' | 'loading';

export interface SpeechConfigs extends Omit<BookContent, 'pagination'>, SpeechOptions {
  totalLines: number;
  selectedVoice: VoiceOption;
}

export class SpeechService {
  private static instance: SpeechService;
  private ttsNative = new TTSNative();
  private silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
  private cloudAudio: HTMLAudioElement = new Audio();
  private isRestarting: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private currentBookId: string | null = null;

  onLineEnd: ((index: number) => void) | null = null;
  onIsPlayingChange: ((isPlaying: boolean) => void) | null = null;
  onLoadMoreLines: ((index: number) => void) | null = null;
  onBookCompleted: (() => void) | null = null;

  private constructor() {
    this.silentAudio.loop = true;
    this.silentAudio.volume = 0.001;
    this.cloudAudio.onerror = () => this.onIsPlayingChange?.(false);

    window.addEventListener('beforeunload', () => {
      this.stop();
    });
  }

  static getInstance() {
    if (!SpeechService.instance) SpeechService.instance = new SpeechService();
    return SpeechService.instance;
  }

  getStatus(): SpeechStatus {
    if (this.ttsNative.getStatus() === 'speaking' && !this.cloudAudio.paused) return 'speaking';
    if (this.ttsNative.getStatus() === 'paused' && this.cloudAudio.paused) return 'paused';
    return 'idle';
  }

  start(index: number, configs: SpeechConfigs) {
    // Notify UI to show Pause icon
    this.onIsPlayingChange?.(true);
    this.play(index, configs);
  }

  private play(index: number, configs: SpeechConfigs) {
    if (!configs.bookId || !configs.totalLines || !configs.selectedVoice) return;

    // Boundary Check
    if (index < 0 || index >= configs.totalLines) {
      this.onIsPlayingChange?.(false);
      this.onBookCompleted?.();
      return;
    }

    // Loading Check
    if (index >= configs.lines.length) {
      this.pause();
      this.onLoadMoreLines?.(index);
      return;
    }

    // Skip reading image and chapter title
    if (hasMarker(configs.lines[index])) {
      console.warn(`⚠️ [Skip] no utterance line:`, configs.lines[index]);
      // Skip image lines but trigger line end to update progress
      const next = index + 1;
      this.onLineEnd?.(next);
      this.play(next, configs);
      return;
    }

    // Hardware keep-alive
    if (this.silentAudio.paused) {
      this.silentAudio.play().catch((e) => console.error('❌ Audio play failed:', e));
    }

    // MediaSession setup
    this.setupMediaSession(index, configs);

    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';

    if (configs.selectedVoice.type === 'cloud') {
      this.ttsNative.stop();
      this.startCloudSpeech(index, configs);
    }

    if (configs.selectedVoice.type === 'system') {
      this.stopCloud();
      this.startSystemSpeech(index, configs);
    }
  }

  private startCloudSpeech(index: number, configs: SpeechConfigs) {
    const cloudSrc = `/api/books/${configs.bookId}/audio/${index}?voice=${configs.selectedVoice.id}`;

    this.cloudAudio.pause();
    this.cloudAudio.src = cloudSrc;
    this.cloudAudio.playbackRate = configs.rate || 1.0;

    this.cloudAudio.onended = () => {
      const next = index + 1;
      this.onLineEnd?.(next);
      this.start(next, configs);
    };

    this.cloudAudio.onerror = () => {
      console.error('❌ Cloud playback error on line:', index);
      console.error('↩️ Falling back to system TTS');
      // Fallback to Native TTS
      this.stopCloud();
      this.startSystemSpeech(index, { ...configs, selectedVoice: VOICE_FALLBACK });
    };

    this.cloudAudio.play().catch((e) => {
      // Check if it was interrupted by a new request (common when skipping lines)
      if (e.name !== 'AbortError') {
        console.error('❌ Cloud playback error:', e);
      } else {
        console.log('❌ Cloud playback was interrupted by a new request');
      }
      this.onIsPlayingChange?.(false);
    });
  }

  private startSystemSpeech = (index: number, configs: SpeechConfigs) => {
    this.ttsNative.speak(
      configs.lines[index],
      { ...configs, voice: configs.selectedVoice.id },
      () => {
        const next = index + 1;
        this.onLineEnd?.(next);
        this.start(next, configs);
      },
      () => {
        if (!this.isRestarting) {
          console.warn('⚠️ TTS error on line:', configs.lines[index].slice(0, MAX_BOOKMARK_TEXT) + '...');
          this.onIsPlayingChange?.(false);
        }
      },
    );
  };

  stop() {
    this.isRestarting = false;
    if (this.timer) clearTimeout(this.timer);
    this.silentAudio.pause();
    this.stopCloud();
    this.ttsNative.stop();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      this.clearMediaSession();
    }

    this.onIsPlayingChange?.(false);
  }

  pause() {
    if (this.timer) clearTimeout(this.timer);
    this.silentAudio.pause();
    this.stopCloud();
    this.ttsNative.stop();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  resume(index: number, configs: SpeechConfigs) {
    if (this.timer) clearTimeout(this.timer);

    // pause
    this.pause();

    this.isRestarting = true;
    // immediate resume
    this.play(index, configs);
    this.timer = setTimeout(() => {
      this.isRestarting = false;
    }, 1000);
    // requestAnimationFrame(() => {
    //   this.isRestarting = false;
    // });
  }

  private stopCloud() {
    this.cloudAudio.pause();
    this.cloudAudio.onended = null;

    // Unloads the audio resource without destroying the object
    this.cloudAudio.removeAttribute('src');
    this.cloudAudio.load();
  }

  getNativeVoices(lang: string) {
    return this.ttsNative.getVoices({ lang });
  }

  private setupMediaSession(index: number, configs: SpeechConfigs) {
    if (!('mediaSession' in navigator)) return;

    if (this.currentBookId !== configs.bookId) {
      this.currentBookId = configs.bookId;

      // TODO: Set Metadata (Shows Book Title/Author on Lock Screen - Crucial for iOS/macOS stability)
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Audiobook',
        artist: 'Reading...',
        album: 'My Library',
        // artwork: [{ src: 'icon.png', sizes: '512x512', type: 'image/png' }],
      });
    }

    if ('setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: configs.totalLines,
          playbackRate: configs.rate || 1.0,
          position: index,
        });
      } catch (error) {
        console.error('❌ Error updating position state:', error);
      }
    }

    this.updateActionHandlers(index, configs);
  }

  private updateActionHandlers(index: number, configs: SpeechConfigs) {
    // Set the Play/Pause handlers (AirPod Taps)
    navigator.mediaSession.setActionHandler('play', () => this.start(index, configs));
    navigator.mediaSession.setActionHandler('pause', () => this.pause());

    // Set the prev/next track handlers (AirPod Taps)
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const next = Math.min(index + 1, configs.lines.length - 1);
      this.onLineEnd?.(next);
      this.resume(next, configs);
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const prev = Math.max(index - 1, 0);
      this.onLineEnd?.(prev);
      this.resume(prev, configs);
    });
  }

  private clearMediaSession() {
    const actions: MediaSessionAction[] = ['play', 'pause', 'nexttrack', 'previoustrack'] as const;
    actions.forEach((action) => navigator.mediaSession.setActionHandler(action, null));
  }
}

export const speechService = SpeechService.getInstance();
