import type { VoiceOption } from '@/pages/BookReader';
import { SpeechService, type SpeechConfigs } from '@/services/SpeechService';
import { TTSNative } from '@/services/TTSNative';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/TTSNative');

// arrow functions do not have a [[Construct]] internal method and cannot be used as constructors
// Mock Audio
const mockAudioPlay = vi.fn().mockResolvedValue(undefined);
const mockAudioPause = vi.fn();
const mockAudioRemoveAttribute = vi.fn();
const mockAudioLoad = vi.fn();
global.Audio = vi.fn().mockImplementation(function () {
  return {
    play: mockAudioPlay,
    pause: mockAudioPause,
    load: mockAudioLoad,
    removeAttribute: mockAudioRemoveAttribute,
    loop: false,
    volume: 1,
    src: '',
    onerror: vi.fn(),
    onended: vi.fn(),
    playbackRate: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}) as unknown as typeof Audio;

// Mock SpeechSynthesis
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
global.speechSynthesis = {
  speak: mockSpeak,
  cancel: mockCancel,
  pause: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as SpeechSynthesis;

global.SpeechSynthesisUtterance = vi.fn().mockImplementation(function (text: string) {
  return {
    text,
    lang: '',
    rate: 1,
    onend: null,
    onerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}) as unknown as typeof SpeechSynthesisUtterance;

// Mock MediaSession
const mockSetActionHandler = vi.fn();
const mockSetPositionState = vi.fn();
global.MediaMetadata = vi.fn().mockImplementation(function (init) {
  return init;
}) as unknown as typeof MediaMetadata;
Object.defineProperty(navigator, 'mediaSession', {
  value: {
    metadata: null,
    playbackState: 'none',
    setActionHandler: mockSetActionHandler,
    setPositionState: mockSetPositionState,
  },
  configurable: true,
  writable: true,
});

describe('SpeechService', () => {
  let speechService: SpeechService;
  const mockConfigs: SpeechConfigs = {
    bookId: '123',
    lang: 'en-US',
    totalLines: 10,
    lines: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6', 'Line 7', 'Line 8', 'Line 9', 'Line 10'],
    selectedVoice: { id: 'voice1', type: 'system', displayName: 'Voice 1', enabled: true } as VoiceOption,
    rate: 1,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // @ts-expect-error - reset singleton for clean test state
    SpeechService.instance = undefined;
    speechService = SpeechService.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should play silent audio and system audio when starting', () => {
    speechService.start(0, mockConfigs);

    // Once for silent audio, system doesn't use the Audio class
    expect(mockAudioPlay).toHaveBeenCalled();
    const ttsNativeInstance = vi.mocked(TTSNative).mock.instances[0];
    expect(ttsNativeInstance.speak).toHaveBeenCalledWith('Line 1', expect.objectContaining({ voice: 'voice1' }), expect.any(Function), expect.any(Function));
  });

  it('should reuse cloud audio instance and update src when voice type is cloud', () => {
    const cloudConfigs: SpeechConfigs = {
      ...mockConfigs,
      selectedVoice: { id: 'google-1', type: 'cloud', displayName: 'Google Voice 1', enabled: true } as VoiceOption,
    };

    speechService.start(0, cloudConfigs);

    // We check the second Audio instance (index 1) because index 0 is silentAudio
    // Cloud Audio is initialized in the constructor
    const cloudAudioInstance = vi.mocked(global.Audio).mock.results[1].value;
    expect(cloudAudioInstance.src).toContain('/api/books/123/audio/0');
    expect(cloudAudioInstance.play).toHaveBeenCalled();
  });

  it('should only update MediaMetadata when bookId changes', () => {
    speechService.start(0, mockConfigs);
    expect(vi.mocked(global.MediaMetadata)).toHaveBeenCalledTimes(1);

    // Play next line of same book
    speechService.start(1, mockConfigs);
    expect(vi.mocked(global.MediaMetadata)).toHaveBeenCalledTimes(1); // No increase

    // Play different book
    speechService.start(0, { ...mockConfigs, bookId: '999' });
    expect(vi.mocked(global.MediaMetadata)).toHaveBeenCalledTimes(2); // Increased
  });

  it('should update setPositionState on every play', () => {
    speechService.start(5, mockConfigs);
    expect(mockSetPositionState).toHaveBeenCalledWith({
      duration: 10,
      playbackRate: 1,
      position: 5,
    });
  });

  it('should unload cloud audio correctly in stopCloud', () => {
    const cloudConfigs: SpeechConfigs = {
      ...mockConfigs,
      selectedVoice: { id: 'google-1', type: 'cloud', displayName: 'Google Voice 1', enabled: true } as VoiceOption,
    };
    speechService.start(0, cloudConfigs);
    speechService.stop();

    // Cloud Audio is the 2nd instance created in constructor
    const cloudAudioInstance = vi.mocked(global.Audio).mock.results[1].value;

    expect(cloudAudioInstance.pause).toHaveBeenCalled();
    expect(cloudAudioInstance.removeAttribute).toHaveBeenCalledWith('src');
    expect(cloudAudioInstance.load).toHaveBeenCalled();
    expect(cloudAudioInstance.onended).toBeNull();
  });

  it('should debounce play calls via resume with a timer', () => {
    speechService.resume(1, mockConfigs);

    // Should not play immediately
    expect(vi.mocked(TTSNative).mock.instances[0].speak).not.toHaveBeenCalled();

    // Fast forward timer
    vi.advanceTimersByTime(1000);
    expect(vi.mocked(TTSNative).mock.instances[0].speak).toHaveBeenCalled();
  });
});
