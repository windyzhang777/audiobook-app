import { useNavigation, useRoute } from "@react-navigation/native";
import { speechService } from "@services/speech.service";
import { Minus, Pause, Play, Plus } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import type { Book } from "../models/Book";
import { bookService } from "../services/book.service";
import { storageService } from "../services/storage.service";

interface TextSelection {
  start: number;
  end: number;
  text: string;
}

export const BookReaderScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { bookId } = route.params;

  // Book data
  const [book, setBook] = useState<Book | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Audio control
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0);

  // Text selection
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);

  // Layout
  const [textSize, setTextSize] = useState<number>(18);
  const [scrollViewHeight, setScrollViewHeight] = useState<number>(0);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const lineRefs = useRef<{ [key: number]: View | null }>({});
  const linePositionsRef = useRef<{ [key: number]: { y: number; height: number } }>({});
  const hasScrolledToInitialPosition = useRef<boolean>(false);

  console.log(`currentLineIndex, lines.length :`, currentLineIndex, lines.length);

  useEffect(() => {
    void loadBook();
    hasScrolledToInitialPosition.current = false; // Reset flag when book changes

    return () => {
      speechService.stop();
    };
  }, [bookId]);

  // Scroll to saved position when content is loaded and layout is ready (only once)
  useEffect(() => {
    if (
      !hasScrolledToInitialPosition.current &&
      lines.length > 0 &&
      currentLineIndex > 0 &&
      scrollViewHeight > 0 &&
      contentHeight > 0
    ) {
      // Use requestAnimationFrame to ensure layout measurements are ready
      requestAnimationFrame(() => {
        const lineData = linePositionsRef.current[currentLineIndex];
        const isLastLine = currentLineIndex === lines.length - 1;
        
        if (lineData) {
          if (isLastLine) {
            // For the last line, show it at the bottom
            const lineBottom = lineData.y + lineData.height;
            const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
            const scrollY = Math.min(maxScrollY, Math.max(0, lineBottom - scrollViewHeight));
            scrollViewRef.current?.scrollTo({
              y: scrollY,
              animated: false,
            });
          } else {
            // For other lines, center them in the viewport
            const centeredY = lineData.y + lineData.height / 2 - scrollViewHeight / 2;
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, centeredY),
              animated: false,
            });
          }
          hasScrolledToInitialPosition.current = true;
        } else {
          // Fallback to calculated position if measurement not available yet
          // Try again after a short delay to allow layout to complete
          setTimeout(() => {
            const lineData = linePositionsRef.current[currentLineIndex];
            if (lineData) {
              const isLastLine = currentLineIndex === lines.length - 1;
              if (isLastLine) {
                const lineBottom = lineData.y + lineData.height;
                const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
                const scrollY = Math.min(maxScrollY, Math.max(0, lineBottom - scrollViewHeight));
                scrollViewRef.current?.scrollTo({
                  y: scrollY,
                  animated: false,
                });
              } else {
                const centeredY = lineData.y + lineData.height / 2 - scrollViewHeight / 2;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, centeredY),
                  animated: false,
                });
              }
              hasScrolledToInitialPosition.current = true;
            } else {
              // Final fallback to calculated position
              const lineHeight = textSize * 1.5 + 8;
              const lineY = 20 + currentLineIndex * lineHeight;
              const isLastLine = currentLineIndex === lines.length - 1;
              if (isLastLine) {
                const lineBottom = lineY + lineHeight;
                const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
                const scrollY = Math.min(maxScrollY, Math.max(0, lineBottom - scrollViewHeight));
                scrollViewRef.current?.scrollTo({
                  y: scrollY,
                  animated: false,
                });
              } else {
                const centeredY = lineY + lineHeight / 2 - scrollViewHeight / 2;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, centeredY),
                  animated: false,
                });
              }
              hasScrolledToInitialPosition.current = true;
            }
          }, 100);
        }
      });
    }
  }, [lines.length, currentLineIndex, scrollViewHeight, contentHeight, textSize]);

  const loadBook = async (): Promise<void> => {
    try {
      const bookData = await storageService.getBook(bookId);
      if (bookData) {
        setBook(bookData);
        setCurrentLineIndex(bookData.currentLine || 0);
        navigation.setOptions({ title: bookData.title });

        // Load book content
        const content = await bookService.getBookContent(bookData);
        setLines(content);

        // Set text size from saved settings
        if (bookData.settings?.rate) {
          setTextSize(18); // Default, can be customized
        }
      }
    } catch (error) {
      console.error("Error loading book:", error);
      Alert.alert("Error", "Failed to load book content");
    } finally {
      setLoading(false);
    }
  };

  const handleLineClick = (lineIndex: number): void => {
    // Pause if currently playing
    if (isPlaying) {
      speechService.pause();
      setIsPlaying(false);
    }

    // Set the clicked line as current
    setCurrentLineIndex(lineIndex);

    // Save progress
    if (book) {
      void storageService.updateProgress(book.id, lineIndex);
    }

    // Scroll to center the clicked line
    requestAnimationFrame(() => {
      const lineData = linePositionsRef.current[lineIndex];
      const isLastLine = lineIndex === lines.length - 1;

      if (lineData && scrollViewHeight > 0) {
        if (isLastLine) {
          // For the last line, show it at the bottom
          const lineBottom = lineData.y + lineData.height;
          const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
          const scrollY = Math.min(maxScrollY, Math.max(0, lineBottom - scrollViewHeight));
          scrollViewRef.current?.scrollTo({
            y: scrollY,
            animated: true,
          });
        } else {
          // For other lines, center them
          const centeredY = lineData.y + lineData.height / 2 - scrollViewHeight / 2;
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, centeredY),
            animated: true,
          });
        }
      } else {
        // Fallback to calculated position
        const lineHeight = textSize * 1.5 + 8;
        const lineY = 20 + lineIndex * lineHeight;
        if (isLastLine) {
          const lineBottom = lineY + lineHeight;
          const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
          const scrollY = Math.min(maxScrollY, Math.max(0, lineBottom - scrollViewHeight));
          scrollViewRef.current?.scrollTo({
            y: scrollY,
            animated: true,
          });
        } else {
          const centeredY = lineY + lineHeight / 2 - scrollViewHeight / 2;
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, centeredY),
            animated: true,
          });
        }
      }
    });
  };

  const handlePlayPause = async (): Promise<void> => {
    if (isPlaying) {
      // Pause
      speechService.pause();
      setIsPlaying(false);

      // Save current progress
      if (book) {
        await storageService.updateProgress(book.id, currentLineIndex);
      }
    } else {
      // Play from current position
      if (lines.length === 0) {
        Alert.alert("Error", "No content available to read");
        return;
      }
      
      // If we're at or past the last line, restart from the beginning
      const startLine = currentLineIndex >= lines.length - 1 ? 0 : currentLineIndex;
      if (startLine === 0 && currentLineIndex >= lines.length - 1) {
        setCurrentLineIndex(0);
        // Update saved progress to beginning
        if (book) {
          await storageService.updateProgress(book.id, 0);
        }
        // Scroll to the beginning
        scrollViewRef.current?.scrollTo({
          y: 0,
          animated: true,
        });
      }
      
      setIsPlaying(true);

      await speechService.speak(lines, startLine, {
        rate: book?.settings?.rate ?? 1.0,
        pitch: book?.settings?.pitch ?? 1.0,
        onLineComplete: (lineIndex: number) => {
          // If reached the last line, stop playing and reset button to play
          // Don't scroll anymore once finished
          if (lineIndex >= lines.length) {
            setIsPlaying(false);
            speechService.stop(); // Ensure speech stops
            // Set to last line but don't scroll
            setCurrentLineIndex(lines.length - 1);
            // Save final progress
            if (book) {
              void storageService.updateProgress(book.id, lines.length - 1);
            }
            return; // Exit early, don't scroll
          }

          // Clamp lineIndex to valid range
          const actualLineIndex = Math.min(lineIndex, lines.length - 1);
          setCurrentLineIndex(actualLineIndex);

          // Use requestAnimationFrame to ensure layout measurements are ready
          requestAnimationFrame(() => {
            const lineData = linePositionsRef.current[actualLineIndex];
            const isLastLine = actualLineIndex === lines.length - 1;
            
            if (lineData && scrollViewHeight > 0) {
              // onLayout gives us position relative to ScrollView content container
              if (isLastLine) {
                // For the last line, always ensure it's visible at the bottom of viewport
                // Don't center it to avoid scrolling up unnecessarily
                const lineBottom = lineData.y + lineData.height;
                const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
                
                // Scroll to show the line at the bottom of viewport
                // Position so the line's bottom is visible (align with viewport bottom)
                const scrollY = Math.min(maxScrollY, Math.max(0, lineBottom - scrollViewHeight));
                scrollViewRef.current?.scrollTo({
                  y: scrollY,
                  animated: false,
                });
              } else {
                // For other lines, center them in the viewport
                const centeredY = lineData.y + lineData.height / 2 - scrollViewHeight / 2;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, centeredY),
                  animated: false,
                });
              }
            } else {
              // Fallback to calculated position if measurement not available
              const lineHeight = textSize * 1.5 + 8;
              const actualLineIndex = Math.min(lineIndex, lines.length - 1);
              const isLastLine = actualLineIndex === lines.length - 1;
              const lineY = 20 + actualLineIndex * lineHeight;
              
              if (isLastLine) {
                // For last line, always ensure it's visible at the bottom
                const lineBottom = lineY + lineHeight;
                const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
                const scrollY = Math.min(maxScrollY, Math.max(0, lineBottom - scrollViewHeight));
                scrollViewRef.current?.scrollTo({
                  y: scrollY,
                  animated: false,
                });
              } else {
                const centeredY = lineY + lineHeight / 2 - scrollViewHeight / 2;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, centeredY),
                  animated: false,
                });
              }
            }
          });

          // Auto-save progress periodically
          if (book && lineIndex % 10 === 0) {
            void storageService.updateProgress(book.id, lineIndex);
          }
        },
      });
    }
  };

  const handleTextSizeIncrease = (): void => {
    setTextSize((prev) => Math.min(prev + 2, 32));
  };

  const handleTextSizeDecrease = (): void => {
    setTextSize((prev) => Math.max(prev - 2, 12));
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading book...</Text>
      </View>
    );
  }

  if (!book || lines.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Book not found or empty</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main reading area */}
      <TouchableWithoutFeedback onPress={() => setShowControls(!showControls)}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 20 }}
          bounces={false}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setScrollViewHeight(height);
          }}
          onContentSizeChange={(_contentWidth, contentHeight) => {
            setContentHeight(contentHeight);
          }}
        >
          {lines.map((line, index) => (
            <View
              key={index}
              ref={(ref) => {
                lineRefs.current[index] = ref;
              }}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                // Store in ref for immediate synchronous access
                linePositionsRef.current[index] = { y, height };
              }}
              collapsable={false}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleLineClick(index)}
              >
                <Text
                  style={[
                    styles.bookText,
                    { fontSize: textSize },
                    index === currentLineIndex && styles.highlightedLine,
                  ]}
                >
                  {line}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Control bar */}
      {showControls && (
        <View style={styles.controlBar}>
          {/* Text size controls */}
          <View style={styles.textSizeControls}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleTextSizeDecrease}
              disabled={textSize <= 12}
            >
              <Minus size={20} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.textSizeLabel}>{textSize}</Text>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleTextSizeIncrease}
              disabled={textSize >= 32}
            >
              <Plus size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {/* Play controls */}
          <View style={styles.playControls}>
            <TouchableOpacity
              style={[styles.playButton, isPlaying && styles.playButtonActive]}
              onPress={handlePlayPause}
            >
              {isPlaying ? (
                <Pause size={24} color="#fff" />
              ) : (
                <Play size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFEF7", // Warm paper color
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 18,
    color: "#ff3b30",
  },
  readingArea: {
    flex: 1,
  },
  bookText: {
    color: "#333",
    lineHeight: undefined, // Will be calculated as fontSize * 1.5
    textAlign: "left",
    marginBottom: 8,
  },
  highlightedLine: {
    backgroundColor: "#FFFF00", // Yellow highlight
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  controlBar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingBottom: 24, // Extra padding for iPhone home indicator
  },
  textSizeControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    gap: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
  },
  textSizeLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    minWidth: 30,
    textAlign: "center",
  },
  playControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#34C759",
    borderRadius: 30,
  },
  playButtonActive: {
    backgroundColor: "#FF9500",
  },
});
