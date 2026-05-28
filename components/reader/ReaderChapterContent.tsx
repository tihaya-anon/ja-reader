import { Pressable, ScrollView, Text, View } from "react-native";

import { readerScreenStyles as styles } from "@/components/reader/reader-screen-styles";
import type {
  NoteAnnotatedRange,
  ParagraphUnit,
  ReaderSelection,
} from "@/features/reader/reader-screen-types";
import { getTokenHighlightState, getTokenNoteMarkers } from "@/features/reader/reader-screen-utils";
import type { ReaderParagraph } from "@/data/book-data";
import type { ReaderToken } from "@/features/reader/tokenize";

type ReaderChapterContentProps = {
  chapterId: string;
  paragraphUnits: {
    paragraph: ReaderParagraph;
    units: ParagraphUnit[];
  }[];
  selectedParagraphIndex: number;
  selection: ReaderSelection | null;
  noteAnnotatedRanges: NoteAnnotatedRange[];
  readingViewportHeight: number;
  readingPanelStyle: { gap: number; paddingHorizontal: number };
  paragraphRowStyle: { rowGap: number };
  baseTextStyle: { fontFamily: string; fontSize: number; lineHeight: number };
  rubyTextStyle: { fontSize: number; lineHeight: number };
  textColor: string;
  sentenceHighlightColor: string;
  tokenHighlightColor: string;
  rubyBookColor: string;
  rubyDictionaryColor: string;
  onSelectParagraph: (index: number) => void;
  onPressToken: (paragraphIndex: number, paragraph: ReaderParagraph, token: ReaderToken) => void;
};

export function ReaderChapterContent({
  chapterId,
  paragraphUnits,
  selectedParagraphIndex,
  selection,
  noteAnnotatedRanges,
  readingViewportHeight,
  readingPanelStyle,
  paragraphRowStyle,
  baseTextStyle,
  rubyTextStyle,
  textColor,
  sentenceHighlightColor,
  tokenHighlightColor,
  rubyBookColor,
  rubyDictionaryColor,
  onSelectParagraph,
  onPressToken,
}: ReaderChapterContentProps) {
  return (
    <View style={[styles.readingViewport, { height: readingViewportHeight }]}>
      <ScrollView
        contentContainerStyle={[styles.readingViewportScroll, readingPanelStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {paragraphUnits.map(({ paragraph, units }, index) => (
          <Pressable
            key={`${chapterId}-${index}`}
            onPress={() => onSelectParagraph(index)}
            style={styles.paragraphBlock}
          >
            <View style={[styles.paragraphRow, paragraphRowStyle]}>
              {units.map((unit) => (
                <ReaderTokenUnit
                  key={`${index}-${unit.token.start}-${unit.token.end}-${unit.token.surface}`}
                  paragraph={paragraph}
                  paragraphIndex={index}
                  selectedParagraphIndex={selectedParagraphIndex}
                  selection={selection}
                  noteAnnotatedRanges={noteAnnotatedRanges}
                  unit={unit}
                  baseTextStyle={baseTextStyle}
                  rubyTextStyle={rubyTextStyle}
                  textColor={textColor}
                  sentenceHighlightColor={sentenceHighlightColor}
                  tokenHighlightColor={tokenHighlightColor}
                  rubyBookColor={rubyBookColor}
                  rubyDictionaryColor={rubyDictionaryColor}
                  onPressToken={onPressToken}
                />
              ))}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ReaderTokenUnit({
  paragraph,
  paragraphIndex,
  selectedParagraphIndex,
  selection,
  noteAnnotatedRanges,
  unit,
  baseTextStyle,
  rubyTextStyle,
  textColor,
  sentenceHighlightColor,
  tokenHighlightColor,
  rubyBookColor,
  rubyDictionaryColor,
  onPressToken,
}: {
  paragraph: ReaderParagraph;
  paragraphIndex: number;
  selectedParagraphIndex: number;
  selection: ReaderSelection | null;
  noteAnnotatedRanges: NoteAnnotatedRange[];
  unit: ParagraphUnit;
  baseTextStyle: { fontFamily: string; fontSize: number; lineHeight: number };
  rubyTextStyle: { fontSize: number; lineHeight: number };
  textColor: string;
  sentenceHighlightColor: string;
  tokenHighlightColor: string;
  rubyBookColor: string;
  rubyDictionaryColor: string;
  onPressToken: (paragraphIndex: number, paragraph: ReaderParagraph, token: ReaderToken) => void;
}) {
  const token = unit.token;
  const isHighlighted = getTokenHighlightState({
    paragraphIndex,
    selectedParagraphIndex,
    selection,
    token,
  });
  const noteMarkers =
    paragraphIndex === selectedParagraphIndex
      ? getTokenNoteMarkers(token, noteAnnotatedRanges)
      : null;
  const rubyColor =
    unit.rubySource === "dictionary" ? rubyDictionaryColor : rubyBookColor;

  return (
    <Pressable
      onPress={() => onPressToken(paragraphIndex, paragraph, token)}
      style={[
        styles.inlineUnit,
        unit.needsSideSpacing && styles.inlineUnitWithSpacing,
        isHighlighted.sentence && { backgroundColor: sentenceHighlightColor },
        isHighlighted.token && { backgroundColor: tokenHighlightColor },
      ]}
    >
      <View style={styles.inlineUnitContent}>
        {unit.rubyText ? (
          <View style={styles.rubyUnit}>
            <Text style={[styles.rubyText, rubyTextStyle, { color: rubyColor }]}>
              {unit.rubyText}
            </Text>
            <Text style={[styles.baseText, baseTextStyle, { color: textColor }]}>
              {token.surface}
            </Text>
          </View>
        ) : (
          <View style={styles.baseTokenWrap}>
            <Text
              style={[
                styles.baseText,
                baseTextStyle,
                {
                  color: textColor,
                  opacity: paragraphIndex === selectedParagraphIndex ? 1 : 0.92,
                },
              ]}
            >
              {token.surface}
            </Text>
          </View>
        )}
        {noteMarkers?.hasSentenceNote ? (
          <View
            style={[
              styles.sentenceNoteUnderline,
              noteMarkers.isSentenceStart && styles.sentenceNoteUnderlineStart,
              noteMarkers.isSentenceEnd && styles.sentenceNoteUnderlineEnd,
            ]}
          />
        ) : null}
        {noteMarkers?.hasTokenNote ? <View style={styles.tokenNoteUnderline} /> : null}
      </View>
    </Pressable>
  );
}
