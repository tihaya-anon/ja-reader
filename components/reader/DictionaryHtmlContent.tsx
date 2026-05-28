import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import RenderHtml from "react-native-render-html";

type DictionaryHtmlContentProps = {
  html: string;
  textColor: string;
  linkColor?: string;
  accentColor?: string;
};

export function DictionaryHtmlContent({
  html,
  textColor,
  linkColor = "#466C9B",
  accentColor = "#9B4D2F",
}: DictionaryHtmlContentProps) {
  const { width } = useWindowDimensions();
  const source = useMemo(
    () => ({
      html: normalizeDictionaryHtml(html),
    }),
    [html],
  );

  return (
    <View style={{ userSelect: "text" }}>
      <RenderHtml
        contentWidth={Math.max(width - 96, 240)}
        source={source}
        systemFonts={["Arial", "Georgia", "Times New Roman", "Hiragino Sans", "Hiragino Mincho ProN"]}
        baseStyle={{
          color: textColor,
          fontSize: 14,
          lineHeight: 22,
          userSelect: "text",
        }}
        tagsStyles={{
          a: {
            color: linkColor,
            textDecorationLine: "underline",
          },
          b: {
            fontWeight: "700",
            color: accentColor,
          },
          div: {
            marginBottom: 4,
          },
          span: {
            color: textColor,
          },
          p: {
            marginTop: 0,
            marginBottom: 10,
          },
        }}
      />
    </View>
  );
}

function normalizeDictionaryHtml(html: string) {
  return html
    .replace(/<body2>/gi, "")
    .replace(/<\/body2>/gi, "")
    .replace(/color=“/gi, 'color="')
    .replace(/”/g, '"')
    .replace(/<font\b([^>]*)>/gi, (_, attributes: string) => {
      const styles = extractFontStyles(attributes);
      return styles ? `<span style="${styles}">` : "<span>";
    })
    .replace(/<\/font>/gi, "</span>");
}

function extractFontStyles(attributes: string) {
  const styles: string[] = [];
  const colorMatch = attributes.match(/color\s*=\s*["']?([^"' >]+)["']?/i);
  const faceMatch = attributes.match(/face\s*=\s*["']?([^"'>]+)["']?/i);

  if (colorMatch?.[1]) {
    styles.push(`color: ${colorMatch[1]}`);
  }

  if (faceMatch?.[1]) {
    styles.push(`font-family: ${faceMatch[1]}`);
  }

  return styles.join("; ");
}
