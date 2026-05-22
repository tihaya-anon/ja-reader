import html
import json
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET


Segment = dict[str, str]


def main() -> None:
    epub_path = Path(sys.argv[1])

    with zipfile.ZipFile(epub_path) as archive:
        opf_path = read_opf_path(archive)
        opf_root = ET.fromstring(archive.read(opf_path))
        namespace = {
            "opf": "http://www.idpf.org/2007/opf",
            "dc": "http://purl.org/dc/elements/1.1/",
            "xhtml": "http://www.w3.org/1999/xhtml",
        }

        title = get_text(opf_root.find(".//dc:title", namespace), epub_path.stem)
        author = get_text(opf_root.find(".//dc:creator", namespace), "Unknown author")
        language = get_text(opf_root.find(".//dc:language", namespace), "ja")

        manifest = {
            item.attrib["id"]: item.attrib["href"]
            for item in opf_root.findall(".//opf:manifest/opf:item", namespace)
        }
        spine = [
            item.attrib["idref"]
            for item in opf_root.findall(".//opf:spine/opf:itemref", namespace)
        ]
        opf_directory = PurePosixPath(opf_path).parent

        chapters = []
        for chapter_index, item_id in enumerate(spine):
            relative_path = manifest[item_id]
            chapter_path = str(opf_directory / relative_path)
            chapter_xml = archive.read(chapter_path).decode("utf-8")
            chapters.append(build_chapter(chapter_index, relative_path, chapter_xml))

        book = {
            "id": slugify(title),
            "sourceFile": epub_path.name,
            "title": title,
            "author": author,
            "language": language,
            "chapterCount": len(chapters),
            "chapters": chapters,
        }

    print(json.dumps(book, ensure_ascii=False, indent=2))


def read_opf_path(archive: zipfile.ZipFile) -> str:
    container_root = ET.fromstring(archive.read("META-INF/container.xml"))
    rootfile = container_root.find(
        ".//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile"
    )

    if rootfile is None:
        raise RuntimeError("Unable to locate OPF path in container.xml")

    return rootfile.attrib["full-path"]


def build_chapter(chapter_index: int, fallback_id: str, chapter_xml: str) -> dict:
    namespace = {"xhtml": "http://www.w3.org/1999/xhtml"}
    root = ET.fromstring(chapter_xml)
    title = (
        get_text(root.find(".//xhtml:h2", namespace))
        or get_text(root.find(".//xhtml:title", namespace))
        or f"Chapter {chapter_index + 1}"
    )

    paragraphs = [build_paragraph(paragraph) for paragraph in root.findall(".//xhtml:p", namespace)]
    paragraphs = [paragraph for paragraph in paragraphs if paragraph["text"]]
    word_count = sum(len(tokenize_japanese(paragraph["text"])) for paragraph in paragraphs)

    return {
        "id": slugify(f"{chapter_index + 1}-{fallback_id}"),
        "title": title,
        "paragraphs": paragraphs,
        "wordCount": word_count,
    }


def build_paragraph(element: ET.Element | None) -> dict:
    segments: list[Segment] = []

    def append_text(value: str | None) -> None:
        cleaned = sanitize_text(value)
        if not cleaned:
            return

        if segments and segments[-1]["type"] == "text":
            segments[-1]["text"] += cleaned
        else:
            segments.append({"type": "text", "text": cleaned})

    def walk(node: ET.Element) -> None:
        append_text(node.text)

        for child in node:
            if child.tag.endswith("ruby"):
                ruby_segment = extract_ruby_segment(child)
                if ruby_segment is not None:
                    segments.append(ruby_segment)
            elif not child.tag.endswith("rt"):
                walk(child)

            append_text(child.tail)

    if element is not None:
        walk(element)

    merged_segments: list[Segment] = []
    for segment in segments:
        if segment["type"] == "text":
            segment_text = sanitize_text(segment["text"])
            if not segment_text:
                continue
            if merged_segments and merged_segments[-1]["type"] == "text":
                merged_segments[-1]["text"] += segment_text
            else:
                merged_segments.append({"type": "text", "text": segment_text})
            continue

        base = sanitize_text(segment["base"])
        reading = sanitize_text(segment["reading"])
        if not base:
            continue
        if not reading:
            if merged_segments and merged_segments[-1]["type"] == "text":
                merged_segments[-1]["text"] += base
            else:
                merged_segments.append({"type": "text", "text": base})
            continue
        merged_segments.append({"type": "ruby", "base": base, "reading": reading})

    paragraph_text = "".join(
        segment["text"] if segment["type"] == "text" else segment["base"]
        for segment in merged_segments
    )

    return {
        "text": paragraph_text,
        "segments": merged_segments,
    }


def extract_ruby_segment(node: ET.Element) -> Segment | None:
    base_parts: list[str] = []
    reading_parts: list[str] = []

    append_if_present(base_parts, node.text)

    for child in node:
        if child.tag.endswith("rt"):
            append_if_present(reading_parts, extract_all_text(child))
        else:
            append_if_present(base_parts, extract_plain_text(child))
        append_if_present(base_parts, child.tail)

    base = sanitize_text("".join(base_parts))
    reading = sanitize_text("".join(reading_parts))
    if not base:
        return None

    return {"type": "ruby", "base": base, "reading": reading}


def extract_plain_text(element: ET.Element | None) -> str:
    if element is None:
        return ""

    text_parts: list[str] = []

    def walk(node: ET.Element) -> None:
        if node.tag.endswith("rt"):
            return

        append_if_present(text_parts, node.text)
        for child in node:
            walk(child)
            append_if_present(text_parts, child.tail)

    walk(element)
    return "".join(text_parts)


def extract_all_text(element: ET.Element | None) -> str:
    if element is None:
        return ""

    text_parts: list[str] = []

    def walk(node: ET.Element) -> None:
        append_if_present(text_parts, node.text)
        for child in node:
            walk(child)
            append_if_present(text_parts, child.tail)

    walk(element)
    return "".join(text_parts)


def sanitize_text(value: str | None) -> str:
    if not value:
        return ""
    cleaned = html.unescape(value).replace("\u00a0", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def append_if_present(parts: list[str], value: str | None) -> None:
    if value:
        parts.append(value)


def tokenize_japanese(text: str) -> list[str]:
    tokens: list[str] = []
    current = ""
    current_type = ""

    for character in text:
      next_type = classify_character(character)

      if next_type == "space":
        if current:
          tokens.append(current)
          current = ""
          current_type = ""
        continue

      if not current or next_type == current_type:
        current += character
        current_type = next_type
        continue

      tokens.append(current)
      current = character
      current_type = next_type

    if current:
      tokens.append(current)

    return tokens


def classify_character(character: str) -> str:
    if character.isspace():
        return "space"
    if re.match(r"[一-龯々]", character):
        return "kanji"
    if re.match(r"[ぁ-ゖゝゞー]", character):
        return "hiragana"
    if re.match(r"[ァ-ヺヽヾ]", character):
        return "katakana"
    if re.match(r"[A-Za-z]", character):
        return "latin"
    if re.match(r"[0-9]", character):
        return "number"
    return "punctuation"


def get_text(element: ET.Element | None, fallback: str = "") -> str:
    return sanitize_text(extract_plain_text(element)) if element is not None else fallback


def slugify(value: str) -> str:
    lowered = value.lower()
    slug = re.sub(r"[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+", "-", lowered)
    return slug.strip("-")


if __name__ == "__main__":
    main()
