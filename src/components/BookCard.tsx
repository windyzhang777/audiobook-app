import { Book } from "@models/Book";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface BookCardProps {
  book: Book;
  onPress: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export const BookCard = ({ book, onPress, onDelete }: BookCardProps) => {
  const progressPercentage = Math.round(
    (book.currentLine / book.totalLines) * 100,
  );
  const isFinished = book.currentLine >= book.totalLines;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(book)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {book.title}
          </Text>
          {book.author && (
            <Text style={styles.bookAuthor} numberOfLines={1}>
              by {book.author}
            </Text>
          )}

          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              {book.currentLine.toLocaleString()} /{" "}
              {book.totalLines.toLocaleString()} lines
            </Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.statsText}>{formatDate(book.lastRead)}</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercentage}%` },
                  isFinished && styles.progressBarFinished,
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {isFinished ? "✓ Finished" : `${progressPercentage}%`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete(book);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardContent: {
    flexDirection: "row",
    padding: 16,
  },
  bookInfo: {
    flex: 1,
    marginRight: 12,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontStyle: "italic",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statsText: {
    fontSize: 13,
    color: "#999",
  },
  separator: {
    marginHorizontal: 8,
    color: "#ccc",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  progressBarFinished: {
    backgroundColor: "#34C759",
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    minWidth: 60,
    textAlign: "right",
  },
  deleteButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
  },
  deleteButtonText: {
    fontSize: 24,
  },
});
