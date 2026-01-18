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
  const scrollViewRef = useRef<ScrollView>(null);

  console.log(`currentLineIndex :`, currentLineIndex);
  console.log(`isPlaying :`, isPlaying);
  console.log(`lines.length :`, lines.length);

  useEffect(() => {
    void loadBook();

    return () => {
      speechService.stop();
    };
  }, [bookId]);

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
      setIsPlaying(true);

      await speechService.speak(lines, currentLineIndex, {
        rate: book?.settings?.rate ?? 1.0,
        pitch: book?.settings?.pitch ?? 1.0,
        onLineComplete: (lineIndex: number) => {
          setCurrentLineIndex(lineIndex);

          // Scroll to center the current line
          const lineHeight = textSize * 1.5 + 8; // fontSize * 1.5 + marginBottom
          const lineY = 20 + lineIndex * lineHeight; // paddingTop + index * lineHeight
          const centeredY = lineY + lineHeight / 2 - scrollViewHeight / 2;
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, centeredY),
            animated: false,
          });

          // Auto-save progress periodically
          if (book && lineIndex % 10 === 0) {
            void storageService.updateProgress(book.id, lineIndex);
          }

          // If reached the last line, stop playing and reset button to play
          if (lineIndex >= lines.length) {
            setIsPlaying(false);
            speechService.stop(); // Ensure speech stops
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
        >
          {lines.map((line, index) => (
            <Text
              key={index}
              style={[
                styles.bookText,
                { fontSize: textSize },
                index === currentLineIndex && styles.highlightedLine,
              ]}
            >
              {line}
            </Text>
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
