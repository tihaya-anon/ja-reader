import html
import json
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET


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

    paragraphs = [
        sanitize_paragraph(extract_text(paragraph))
        for paragraph in root.findall(".//xhtml:p", namespace)
    ]
    paragraphs = [paragraph for paragraph in paragraphs if paragraph]
    word_count = sum(len(tokenize_japanese(paragraph)) for paragraph in paragraphs)

    return {
        "id": slugify(f"{chapter_index + 1}-{fallback_id}"),
        "title": title,
        "paragraphs": paragraphs,
        "wordCount": word_count,
    }


def extract_text(element: ET.Element | None) -> str:
    if element is None:
        return ""

    text_parts: list[str] = []

    def walk(node: ET.Element) -> None:
        if node.tag.endswith("rt"):
            if node.tail:
                text_parts.append(node.tail)
            return

        if node.text:
            text_parts.append(node.text)

        for child in node:
            walk(child)

        if node.tail:
            text_parts.append(node.tail)

    walk(element)
    return "".join(text_parts)


def sanitize_paragraph(value: str) -> str:
    cleaned = html.unescape(value).replace("\u00a0", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


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
    return sanitize_paragraph(extract_text(element)) if element is not None else fallback


def slugify(value: str) -> str:
    lowered = value.lower()
    slug = re.sub(r"[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+", "-", lowered)
    return slug.strip("-")


if __name__ == "__main__":
    main()
