import * as Speech from "expo-speech";

class SpeechService {
  private currentLineIndex: number = 0;
  private lines: string[] = [];
  private isPaused: boolean = false;
  private onLineComplete?: (lineIndex: number) => void;

  async speak(
    lines: string[],
    startLine: number = 0,
    options?: {
      rate?: number;
      pitch?: number;
      voice?: string;
      onLineComplete?: (lineIndex: number) => void;
    },
  ) {
    // Stop any existing speech first to ensure clean state
    Speech.stop();

    this.lines = lines;
    this.currentLineIndex = startLine >= lines.length ? 0 : startLine;
    this.isPaused = false;
    this.onLineComplete = options?.onLineComplete;

    await this.speakCurrentLine(options);
  }

  private async speakCurrentLine(options?: Speech.SpeechOptions) {
    if (this.currentLineIndex >= this.lines.length) {
      this.stop();
      return;
    }

    const line = this.lines[this.currentLineIndex];
    // Skip empty lines (should already be filtered by book service, but check as safety)
    if (!line || line.length === 0) {
      this.currentLineIndex++;
      if (this.onLineComplete) {
        this.onLineComplete(this.currentLineIndex);
      }
      this.speakCurrentLine(options);
      return;
    }

    console.log(`currentLineIndex, lines.length :`, this.currentLineIndex, this.lines.length);

    try {
      // Check if speech is available
      const isSpeaking = await Speech.isSpeakingAsync();
      console.log('Is already speaking:', isSpeaking);

      // Try to get available voices (iOS specific - helps diagnose)
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        console.log('Available voices count:', voices.length);
        if (voices.length > 0) {
          console.log('First voice:', voices[0]);
        }
      } catch (voiceError) {
        console.log('Could not get voices (may not be supported):', voiceError);
      }

      const speechOptions = {
        rate: options?.rate || 1.0,
        pitch: options?.pitch || 1.0,
        language: "en-US",
        voice: options?.voice,
        volume: 1.0, // Explicitly set volume
        onStart: () => {
          console.log('Speech started successfully');
        },
        onDone: () => {
          console.log('Speech finished for line:', this.currentLineIndex, this.lines[this.currentLineIndex]);
          if (!this.isPaused) {
            this.currentLineIndex++;
            if (this.onLineComplete) {
              this.onLineComplete(this.currentLineIndex);
            }
            this.speakCurrentLine(options);
          }
        },
        onStopped: () => {
          console.log('Speech stopped');
        },
        onError: (error: any) => {
          console.error("Speech error:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          // Continue to next line on error
          if (!this.isPaused) {
            this.currentLineIndex++;
            if (this.onLineComplete) {
              this.onLineComplete(this.currentLineIndex);
            }
            this.speakCurrentLine(options);
          }
        },
      };

      console.log('Speech options:', { ...speechOptions, onStart: '[function]', onDone: '[function]', onError: '[function]' });

      Speech.speak(line, speechOptions);

      // Verify speech started
      setTimeout(async () => {
        const stillSpeaking = await Speech.isSpeakingAsync();
        console.log('Speech status after 100ms:', stillSpeaking);
      }, 100);
    } catch (error) {
      console.error("Error starting speech:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      // Continue to next line on error
      if (!this.isPaused) {
        this.currentLineIndex++;
        if (this.onLineComplete) {
          this.onLineComplete(this.currentLineIndex);
        }
        this.speakCurrentLine(options);
      }
    }
  }

  pause() {
    this.isPaused = true;
    Speech.pause();
  }

  resume(options?: Speech.SpeechOptions) {
    if (!this.isPaused) return;
    this.isPaused = false;
    Speech.resume();
  }

  stop() {
    Speech.stop();
    this.isPaused = false;
    this.lines = [];
    this.currentLineIndex = 0;
  }

  getCurrentLine(): number {
    return this.currentLineIndex;
  }

  async isSpeaking(): Promise<boolean> {
    return await Speech.isSpeakingAsync();
  }

  skipToLine(lineIndex: number, options?: Speech.SpeechOptions) {
    this.currentLineIndex = lineIndex;
    this.stop();
    this.speakCurrentLine(options);
  }
}

export const speechService = new SpeechService();
