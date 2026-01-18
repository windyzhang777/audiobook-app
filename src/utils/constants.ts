import { SpeechOptions } from "expo-speech";

export const SPEECH_RATES = {
  SLOW: 0.75,
  NORMAL: 1.0,
  FAST: 1.25,
  VERY_FAST: 1.5,
};

export const DEFAULT_SETTINGS: SpeechOptions = {
  rate: SPEECH_RATES.NORMAL,
  pitch: 1.0,
  voice: "",
};
