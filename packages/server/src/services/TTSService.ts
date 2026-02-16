import { voiceByLocale } from '@audiobook/shared';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';

/**
 * Service to handle Google Cloud Text-to-Speech operations.
 * Free Tier limits: 1M (Neural2/WaveNet) or 4M (Standard) characters/month.
 */
export class TTSGoogle {
  private client: TextToSpeechClient | null = null;
  private useMock = process.env.NODE_ENV === 'development' || process.env.MOCK_TTS === 'true';

  async synthesize(text: string, languageCode: string = 'en-US'): Promise<Uint8Array | string | null | undefined> {
    if (this.useMock) {
      console.log(`[MOCK TTS] Synthesizing: "${text.substring(0, 20)}..."`);
      // Return a valid mock buffer immediately and EXIT
      return Buffer.from('SUQzBAAAAAAAAFRTU0UAAAANAAADTGFtZTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
    }

    try {
      if (!this.client) {
        this.client = new TextToSpeechClient();
      }

      const voiceName = voiceByLocale[languageCode] || voiceByLocale.default;
      const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: { languageCode, name: voiceName, ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1.0 },
      };

      const [response] = await this.client.synthesizeSpeech(request);
      return response.audioContent;
    } catch (error) {
      console.error(`TTS Synthesis Error for ${languageCode}:`, error);
      throw error;
    }
  }

  // Lists available voices for a specific language.
  async getVoices(languageCode: string = 'en-US') {
    if (this.useMock) return [];

    if (!this.client) this.client = new TextToSpeechClient();
    const [result] = await this.client.listVoices({ languageCode });
    return result.voices;
  }
}
