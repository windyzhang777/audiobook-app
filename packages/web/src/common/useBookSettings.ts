import { api } from '@/services/api';
import { speechService } from '@/services/SpeechService';
import { ALIGNMENT_DEFAULT, FONT_SIZE_DEFAULT, INDENT_DEFAULT, LINE_HEIGHT_DEFAULT, RATE_DEFAULT, type BookSetting, type SpeechOptions, type VoiceType } from '@audiobook/shared';
import { useEffect, useMemo, useState } from 'react';
import { useBookUpdate } from './useBookUpdate';

export interface VoiceOption {
  type: VoiceType;
  id: NonNullable<SpeechOptions['voice']>;
  displayName: string;
  enabled: boolean;
}

export const VOICE_FALLBACK: VoiceOption = { type: 'system', id: 'system-default', displayName: 'System (Browser)', enabled: true };

export function useReaderSettings(_id: string | undefined, lang: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [setting, setSetting] = useState<BookSetting>();
  const [fontSize, setFontSize] = useState<NonNullable<BookSetting['fontSize']>>();
  const [rate, setRate] = useState<NonNullable<BookSetting['rate']>>();
  const [lineHeight, setLineHeight] = useState<NonNullable<BookSetting['lineHeight']>>();
  const [indent, setIndent] = useState<NonNullable<BookSetting['indent']>>();
  const [alignment, setAlignment] = useState<NonNullable<BookSetting['alignment']>>();
  const [voice, setVoice] = useState<VoiceOption['id']>(VOICE_FALLBACK.id);

  const availableVoices = useMemo(() => {
    if (!lang) return [VOICE_FALLBACK];
    const nativeVoices = speechService.getNativeVoices(lang);
    const nativeOptions: VoiceOption[] = nativeVoices.map((voice) => ({ type: 'system', id: voice.name, displayName: voice.name, enabled: true }));
    const cloudOptions: VoiceOption[] = [{ type: 'cloud', id: 'google-neural2', displayName: 'Google AI (Neural2)', enabled: false }];
    return [...(nativeOptions.length > 0 ? nativeOptions : [VOICE_FALLBACK]), ...cloudOptions];
  }, [lang]);

  const selectedVoice = useMemo(() => {
    if (!voice) return VOICE_FALLBACK;
    return availableVoices.find((v) => v.id === voice) || availableVoices[0];
  }, [availableVoices, voice]);

  const updates: Partial<BookSetting> = useMemo(() => ({ fontSize, rate, voice: selectedVoice.id, lineHeight, indent, alignment }), [alignment, fontSize, indent, lineHeight, rate, selectedVoice.id]);

  const canUpdate =
    !loading &&
    JSON.stringify(updates) !==
      JSON.stringify({ fontSize: setting?.fontSize, rate: setting?.rate, voice: setting?.voice, lineHeight: setting?.lineHeight, indent: setting?.indent, alignment: setting?.alignment });

  const updateBookSetting = async (_id: string, updates: Partial<BookSetting>) => {
    if (!_id) return;

    try {
      await api.books.updateSetting(_id, updates);
    } catch (error) {
      console.error('❌ Failed to update setting: ', updates, error);
    }
  };

  const { flushUpdate: flushSetting } = useBookUpdate(_id, updates, canUpdate, updateBookSetting);

  useEffect(() => {
    const loadBookSetting = async () => {
      if (!_id) return;

      try {
        const setting = await api.books.getSetting(_id);
        if (!setting) return;

        setSetting((prev) => setting || prev);
        setVoice(() => setting.voice || VOICE_FALLBACK.id);
        setRate(() => setting.rate || RATE_DEFAULT);
        setFontSize(() => setting.fontSize || FONT_SIZE_DEFAULT);
        setLineHeight(() => setting.lineHeight || LINE_HEIGHT_DEFAULT);
        setIndent(() => setting.indent || INDENT_DEFAULT);
        setAlignment(() => setting.alignment || ALIGNMENT_DEFAULT);
      } catch (error) {
        console.error('❌ Failed to load setting: ', error);
      } finally {
        setLoading(false);
      }
    };

    loadBookSetting();
  }, [_id]);

  return {
    loading,
    fontSize,
    setFontSize,
    rate,
    setRate,
    setVoice,
    selectedVoice,
    lineHeight,
    setLineHeight,
    indent,
    setIndent,
    alignment,
    setAlignment,

    flushSetting,
    availableVoices,
  };
}
