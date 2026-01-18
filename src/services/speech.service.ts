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
    if (!line) return;

    console.log('Speaking line:', line);
    console.log(`currentLineIndex :`, this.currentLineIndex);
    console.log(`lines.length :`, this.lines.length);
    Speech.speak(line, {
      rate: options?.rate || 1.0,
      pitch: options?.pitch || 1.0,
      language: "en-US",
      voice: options?.voice,
      onDone: () => {
        if (!this.isPaused) {
          this.currentLineIndex++;
          if (this.onLineComplete) {
            this.onLineComplete(this.currentLineIndex);
          }
          this.speakCurrentLine(options);
        }
      },
      onStopped: () => {
        // Handle stop
      },
      onError: (error) => {
        console.error("Speech error:", error);
      },
    });
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
