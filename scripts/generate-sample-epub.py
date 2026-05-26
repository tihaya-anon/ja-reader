from __future__ import annotations

import textwrap
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = PROJECT_ROOT / "data" / "dev-sample-ja.epub"


CHAPTERS = [
    {
        "file": "chapter-1.xhtml",
        "title": "第一章 朝の支度",
        "paragraphs": [
            "春の朝、<ruby>窓辺<rt>まどべ</rt></ruby>にはやわらかな光が差しこんでいた。綾は湯気の立つ<ruby>急須<rt>きゅうす</rt></ruby>を両手で包み、小さく息をついた。",
            "台所では時計の針が静かに進み、机の上には昨夜読みかけた本と、青い表紙のノートが並んでいる。",
            "今日は駅前の図書館で調べものをするつもりだったが、その前に古い手紙をもう一度読み返しておきたかった。",
        ],
    },
    {
        "file": "chapter-2.xhtml",
        "title": "第二章 駅前の午後",
        "paragraphs": [
            "昼すぎの駅前通りは、買い物帰りの人と学生たちでにぎわっていた。綾は信号を待ちながら、遠くで鳴る踏切の音に耳を澄ませた。",
            "図書館の二階には郷土資料の棚があり、古い地図や新聞の縮刷版がきちんと整理されている。紙の匂いには、少しだけ雨上がりの空気に似た落ち着きがあった。",
            "受付の<ruby>司書<rt>ししょ</rt></ruby>は親切で、探していた名字の載った名簿をすぐに見つけてくれた。",
        ],
    },
    {
        "file": "chapter-3.xhtml",
        "title": "第三章 夜のメモ",
        "paragraphs": [
            "帰宅したあと、綾は机の明かりだけをつけて、今日わかったことを順番に書き留めた。",
            "祖父の故郷、川沿いの町、そして手紙の最後に記されていた<ruby>約束<rt>やくそく</rt></ruby>。点のように散らばっていた記憶が、ようやく一本の線で結ばれはじめる。",
            "窓の外では風が木々を揺らしていたが、部屋の中には鉛筆の走る音だけが静かに続いていた。",
        ],
    },
]


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(OUTPUT_PATH, "w") as archive:
        archive.writestr(
            "mimetype",
            "application/epub+zip",
            compress_type=zipfile.ZIP_STORED,
        )
        archive.writestr("META-INF/container.xml", build_container_xml())
        archive.writestr("OEBPS/content.opf", build_content_opf())

        for index, chapter in enumerate(CHAPTERS, start=1):
            archive.writestr(
                f"OEBPS/{chapter['file']}",
                build_chapter_xhtml(index, chapter["title"], chapter["paragraphs"]),
            )

    print(f"Wrote {OUTPUT_PATH}")


def build_container_xml() -> str:
    return textwrap.dedent(
        """\
        <?xml version="1.0" encoding="UTF-8"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
        """
    ).strip()


def build_content_opf() -> str:
    manifest_items = "\n".join(
        f'    <item id="chapter-{index}" href="{chapter["file"]}" media-type="application/xhtml+xml"/>'
        for index, chapter in enumerate(CHAPTERS, start=1)
    )
    spine_items = "\n".join(
        f'    <itemref idref="chapter-{index}"/>'
        for index in range(1, len(CHAPTERS) + 1)
    )

    return textwrap.dedent(
        f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:identifier id="bookid">dev-sample-ja</dc:identifier>
            <dc:title>開発用サンプル日本語EPUB</dc:title>
            <dc:creator>Codex</dc:creator>
            <dc:language>ja</dc:language>
          </metadata>
          <manifest>
        {manifest_items}
          </manifest>
          <spine>
        {spine_items}
          </spine>
        </package>
        """
    ).strip()


def build_chapter_xhtml(index: int, title: str, paragraphs: list[str]) -> str:
    paragraph_markup = "\n".join(f"    <p>{paragraph}</p>" for paragraph in paragraphs)

    return textwrap.dedent(
        f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja" lang="ja">
          <head>
            <title>{title}</title>
          </head>
          <body>
            <h2>{title}</h2>
        {paragraph_markup}
          </body>
        </html>
        """
    ).strip()


if __name__ == "__main__":
    main()
