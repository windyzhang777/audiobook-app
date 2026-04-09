import { type VoiceOption } from '@/common/useBookSettings';
import { speechService } from '@/services/SpeechService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export default function useBookSpeech(
  _id: string | undefined,
  lines: string[],
  lang: string,
  totalLines: number,
  selectedVoice: VoiceOption,
  rate: number | undefined,
  currentLine: number,
  onLineEnd: (index: number) => void,
  loadMoreLines: (offset?: number, limit?: number) => Promise<void>,
  onBookCompleted: () => void,
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const shouldResumeRef = useRef(false);

  const speechConfigs = useMemo(() => {
    if (!_id) return null;
    return { bookId: _id, lines, lang, rate, totalLines, selectedVoice };
  }, [_id, lines, lang, rate, totalLines, selectedVoice]);

  const play = useCallback(
    (index: number = currentLine) => {
      if (!_id || !speechConfigs) return;
      speechService.start(index, speechConfigs);
    },
    [_id, currentLine, speechConfigs],
  );

  const pause = useCallback(() => speechService.pause(), []);

  const resume = useCallback(
    (index: number) => {
      if (!speechConfigs) return;
      speechService.resume(index, speechConfigs);
    },
    [speechConfigs],
  );

  const stop = useCallback(() => speechService.stop(), []);

  // setup speech service callbacks
  useEffect(() => {
    speechService.onLineEnd = (index) => onLineEnd(index);
    speechService.onIsPlayingChange = (playing) => setIsPlaying(playing);
    speechService.onLoadMoreLines = (linesIndex) => {
      shouldResumeRef.current = true;
      loadMoreLines(linesIndex);
    };
    speechService.onBookCompleted = () => onBookCompleted();

    return () => {
      speechService.onLineEnd = null;
      speechService.onIsPlayingChange = null;
      speechService.onLoadMoreLines = null;
      speechService.onBookCompleted = null;
    };
  }, [onLineEnd, loadMoreLines, onBookCompleted]);

  // auto-resume after loading more lines
  useEffect(() => {
    if (!speechConfigs || !isPlaying || !lines[currentLine] || !shouldResumeRef.current) return;

    shouldResumeRef.current = false;
    speechService.resume(currentLine, speechConfigs);
  }, [isPlaying, lines, currentLine, speechConfigs]);

  return { isPlaying, play, pause, resume, stop };
}
