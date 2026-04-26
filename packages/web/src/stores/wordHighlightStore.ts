export interface WordHighlight {
  lineIndex: number;
  charIndex: number;
  charLength: number;
}

type Listener = () => void;

let _activeWord: WordHighlight | null = null;
let _prevLineIndex: number | null = null;
const _lineListener = new Map<number, Set<Listener>>();
const _globalListener = new Set<Listener>();

function notifyLine(lineIndex: number) {
  _lineListener.get(lineIndex)?.forEach((listener) => listener());
}

export const wordHighlightStore = {
  // Subscribe to changes for a specific line index
  subscribeLine(lineIndex: number, listener: Listener) {
    let set = _lineListener.get(lineIndex);
    if (!set) {
      set = new Set<Listener>();
      _lineListener.set(lineIndex, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set?.size === 0) {
        _lineListener.delete(lineIndex);
      }
    };
  },

  // Subscribe to any activeWord change
  subscribe(listener: Listener) {
    _globalListener.add(listener);
    return () => _globalListener.delete(listener);
  },

  getActiveWord() {
    return _activeWord;
  },

  getActiveWordForLine(lineIndex: number): WordHighlight | null {
    if (_activeWord?.lineIndex === lineIndex) {
      return _activeWord;
    }
    return null;
  },

  setActiveWord(word: WordHighlight | null) {
    const prevLine = _prevLineIndex;
    _activeWord = word;
    _prevLineIndex = word?.lineIndex ?? null;

    // Notify only the affected lines (old + new)
    if (prevLine !== null) notifyLine(prevLine);
    if (word?.lineIndex !== prevLine) notifyLine(word?.lineIndex ?? -1);

    // Notify global
    _globalListener.forEach((listener) => listener());
  },
};
