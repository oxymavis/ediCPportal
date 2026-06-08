from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "TRANSACTION-PUSH-API.md"
OUTPUT = ROOT / "docs" / "Transaction-Push-API-v1.docx"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PR = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
XML = "http://www.w3.org/XML/1998/namespace"

ET.register_namespace("w", W)
ET.register_namespace("r", R)


def qn(namespace: str, name: str) -> str:
    return f"{{{namespace}}}{name}"


def child(parent: ET.Element, namespace: str, name: str) -> ET.Element:
    found = parent.find(qn(namespace, name))
    if found is None:
        found = ET.SubElement(parent, qn(namespace, name))
    return found


def set_val(element: ET.Element, value: str) -> None:
    element.set(qn(W, "val"), value)


def set_fonts(rpr: ET.Element, ascii_font: str, east_asia_font: str | None = None) -> None:
    fonts = child(rpr, W, "rFonts")
    for key in ("asciiTheme", "hAnsiTheme", "eastAsiaTheme", "cstheme"):
        fonts.attrib.pop(qn(W, key), None)
    fonts.set(qn(W, "ascii"), ascii_font)
    fonts.set(qn(W, "hAnsi"), ascii_font)
    fonts.set(qn(W, "cs"), ascii_font)
    fonts.set(qn(W, "eastAsia"), east_asia_font or ascii_font)


def set_size(rpr: ET.Element, half_points: int) -> None:
    set_val(child(rpr, W, "sz"), str(half_points))
    set_val(child(rpr, W, "szCs"), str(half_points))


def set_spacing(
    ppr: ET.Element,
    *,
    before: int = 0,
    after: int = 0,
    line: int | None = None,
) -> None:
    spacing = child(ppr, W, "spacing")
    spacing.set(qn(W, "before"), str(before))
    spacing.set(qn(W, "after"), str(after))
    if line is not None:
        spacing.set(qn(W, "line"), str(line))
        spacing.set(qn(W, "lineRule"), "auto")


def style_by_id(root: ET.Element, style_id: str) -> ET.Element | None:
    for style in root.findall(qn(W, "style")):
        if style.get(qn(W, "styleId")) == style_id:
            return style
    return None


def configure_style(
    root: ET.Element,
    style_id: str,
    *,
    size: int | None = None,
    color: str | None = None,
    bold: bool | None = None,
    before: int | None = None,
    after: int | None = None,
    line: int | None = None,
    ascii_font: str = "Calibri",
    east_asia_font: str = "Microsoft YaHei",
) -> None:
    style = style_by_id(root, style_id)
    if style is None:
        return
    ppr = child(style, W, "pPr")
    rpr = child(style, W, "rPr")
    set_fonts(rpr, ascii_font, east_asia_font)
    if size is not None:
        set_size(rpr, size)
    if color:
        set_val(child(rpr, W, "color"), color)
    if bold is True:
        child(rpr, W, "b")
    elif bold is False:
        bold_node = rpr.find(qn(W, "b"))
        if bold_node is not None:
            rpr.remove(bold_node)
    if before is not None or after is not None or line is not None:
        current = ppr.find(qn(W, "spacing"))
        set_spacing(
            ppr,
            before=before if before is not None else int(current.get(qn(W, "before"), "0")) if current is not None else 0,
            after=after if after is not None else int(current.get(qn(W, "after"), "0")) if current is not None else 0,
            line=line,
        )


def patch_styles(path: Path) -> None:
    tree = ET.parse(path)
    root = tree.getroot()
    defaults = child(child(root, W, "docDefaults"), W, "rPrDefault")
    default_rpr = child(defaults, W, "rPr")
    set_fonts(default_rpr, "Calibri", "Microsoft YaHei")
    set_size(default_rpr, 22)
    set_val(child(default_rpr, W, "lang"), "zh-CN")

    p_defaults = child(child(root, W, "docDefaults"), W, "pPrDefault")
    set_spacing(child(p_defaults, W, "pPr"), after=120, line=300)

    configure_style(root, "Normal", size=22, after=120, line=300)
    configure_style(root, "BodyText", size=22, before=0, after=120, line=300)
    configure_style(root, "FirstParagraph", size=22, before=0, after=120, line=300)
    configure_style(root, "Compact", size=22, before=36, after=72, line=300)
    configure_style(root, "Title", size=52, color="163A5F", bold=True, before=0, after=100, line=300)
    configure_style(root, "Subtitle", size=28, color="4B5563", bold=False, before=0, after=100, line=280)
    configure_style(root, "Author", size=21, color="6B7280", before=0, after=40, line=260)
    configure_style(root, "Date", size=21, color="6B7280", before=0, after=240, line=260)
    configure_style(root, "Heading1", size=32, color="2E74B5", bold=True, before=360, after=200, line=300)
    configure_style(root, "Heading2", size=26, color="2E74B5", bold=True, before=280, after=140, line=300)
    configure_style(root, "Heading3", size=24, color="1F4D78", bold=True, before=200, after=100, line=300)
    configure_style(
        root,
        "SourceCode",
        size=18,
        color="1F2937",
        before=80,
        after=120,
        line=240,
        ascii_font="Menlo",
        east_asia_font="Microsoft YaHei",
    )
    configure_style(
        root,
        "VerbatimChar",
        size=19,
        color="9B1C1C",
        ascii_font="Menlo",
        east_asia_font="Microsoft YaHei",
    )

    table_style = style_by_id(root, "Table")
    if table_style is not None:
        rpr = child(table_style, W, "rPr")
        set_fonts(rpr, "Calibri", "Microsoft YaHei")
        set_size(rpr, 19)

    tree.write(path, encoding="UTF-8", xml_declaration=True)


def distribute_widths(grid_cols: list[ET.Element], total: int = 9360) -> list[int]:
    values = [max(int(col.get(qn(W, "w"), "1")), 1) for col in grid_cols]
    value_total = sum(values)
    widths = [max(round(total * value / value_total), 600) for value in values]
    widths[-1] += total - sum(widths)
    return widths


def patch_document(path: Path) -> None:
    tree = ET.parse(path)
    root = tree.getroot()
    body = root.find(qn(W, "body"))
    if body is None:
        raise RuntimeError("DOCX body is missing")

    for table in body.iter(qn(W, "tbl")):
        tbl_pr = child(table, W, "tblPr")
        tbl_w = child(tbl_pr, W, "tblW")
        tbl_w.set(qn(W, "w"), "9360")
        tbl_w.set(qn(W, "type"), "dxa")
        tbl_ind = child(tbl_pr, W, "tblInd")
        tbl_ind.set(qn(W, "w"), "120")
        tbl_ind.set(qn(W, "type"), "dxa")
        set_val(child(tbl_pr, W, "tblLayout"), "fixed")

        margins = child(tbl_pr, W, "tblCellMar")
        for side, amount in (("top", 100), ("bottom", 100), ("start", 120), ("end", 120)):
            node = child(margins, W, side)
            node.set(qn(W, "w"), str(amount))
            node.set(qn(W, "type"), "dxa")

        grid = table.find(qn(W, "tblGrid"))
        grid_cols = grid.findall(qn(W, "gridCol")) if grid is not None else []
        widths = distribute_widths(grid_cols) if grid_cols else []
        for index, col in enumerate(grid_cols):
            col.set(qn(W, "w"), str(widths[index]))

        rows = table.findall(qn(W, "tr"))
        for row_index, row in enumerate(rows):
            tr_pr = child(row, W, "trPr")
            child(tr_pr, W, "cantSplit")
            if row_index == 0:
                child(tr_pr, W, "tblHeader")
            for cell_index, cell in enumerate(row.findall(qn(W, "tc"))):
                tc_pr = child(cell, W, "tcPr")
                if widths:
                    tc_w = child(tc_pr, W, "tcW")
                    tc_w.set(qn(W, "w"), str(widths[min(cell_index, len(widths) - 1)]))
                    tc_w.set(qn(W, "type"), "dxa")
                set_val(child(tc_pr, W, "vAlign"), "center")
                if row_index == 0:
                    shading = child(tc_pr, W, "shd")
                    shading.set(qn(W, "fill"), "E8EEF5")
                    for paragraph in cell.findall(qn(W, "p")):
                        for run in paragraph.findall(qn(W, "r")):
                            child(child(run, W, "rPr"), W, "b")

    sect_pr = body.find(qn(W, "sectPr"))
    if sect_pr is None:
        sect_pr = ET.SubElement(body, qn(W, "sectPr"))
    page_size = child(sect_pr, W, "pgSz")
    page_size.set(qn(W, "w"), "12240")
    page_size.set(qn(W, "h"), "15840")
    page_margin = child(sect_pr, W, "pgMar")
    for key, value in {
        "top": "1440",
        "right": "1440",
        "bottom": "1440",
        "left": "1440",
        "header": "708",
        "footer": "708",
        "gutter": "0",
    }.items():
        page_margin.set(qn(W, key), value)

    footer_reference = ET.Element(qn(W, "footerReference"))
    footer_reference.set(qn(W, "type"), "default")
    footer_reference.set(qn(R, "id"), "rIdTransactionApiFooter")
    sect_pr.insert(0, footer_reference)

    tree.write(path, encoding="UTF-8", xml_declaration=True)


def patch_numbering(path: Path) -> None:
    tree = ET.parse(path)
    root = tree.getroot()
    for level in root.iter(qn(W, "lvl")):
        ppr = child(level, W, "pPr")
        tabs = child(ppr, W, "tabs")
        tab = child(tabs, W, "tab")
        tab.set(qn(W, "val"), "num")
        tab.set(qn(W, "pos"), "540")
        ind = child(ppr, W, "ind")
        ind.set(qn(W, "left"), "540")
        ind.set(qn(W, "hanging"), "270")
        set_spacing(ppr, after=80, line=300)
    tree.write(path, encoding="UTF-8", xml_declaration=True)


def add_footer(unpacked: Path) -> None:
    footer = ET.Element(qn(W, "ftr"))
    paragraph = ET.SubElement(footer, qn(W, "p"))
    ppr = ET.SubElement(paragraph, qn(W, "pPr"))
    set_val(ET.SubElement(ppr, qn(W, "jc")), "right")
    set_spacing(ppr, before=80, after=0, line=240)

    label_run = ET.SubElement(paragraph, qn(W, "r"))
    label_rpr = ET.SubElement(label_run, qn(W, "rPr"))
    set_fonts(label_rpr, "Calibri", "Microsoft YaHei")
    set_size(label_rpr, 18)
    set_val(child(label_rpr, W, "color"), "6B7280")
    label = ET.SubElement(label_run, qn(W, "t"))
    label.text = "Transaction Push API  |  "

    field_start = ET.SubElement(paragraph, qn(W, "r"))
    start_char = ET.SubElement(field_start, qn(W, "fldChar"))
    start_char.set(qn(W, "fldCharType"), "begin")
    instruction_run = ET.SubElement(paragraph, qn(W, "r"))
    instruction = ET.SubElement(instruction_run, qn(W, "instrText"))
    instruction.set(qn(XML, "space"), "preserve")
    instruction.text = " PAGE "
    field_end = ET.SubElement(paragraph, qn(W, "r"))
    end_char = ET.SubElement(field_end, qn(W, "fldChar"))
    end_char.set(qn(W, "fldCharType"), "end")

    ET.ElementTree(footer).write(unpacked / "word" / "footer1.xml", encoding="UTF-8", xml_declaration=True)

    rels_path = unpacked / "word" / "_rels" / "document.xml.rels"
    rels_tree = ET.parse(rels_path)
    rels_root = rels_tree.getroot()
    relationship = ET.SubElement(rels_root, qn(PR, "Relationship"))
    relationship.set("Id", "rIdTransactionApiFooter")
    relationship.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer")
    relationship.set("Target", "footer1.xml")
    rels_tree.write(rels_path, encoding="UTF-8", xml_declaration=True)

    types_path = unpacked / "[Content_Types].xml"
    types_tree = ET.parse(types_path)
    types_root = types_tree.getroot()
    override = ET.SubElement(types_root, qn(CT, "Override"))
    override.set("PartName", "/word/footer1.xml")
    override.set("ContentType", "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml")
    types_tree.write(types_path, encoding="UTF-8", xml_declaration=True)


def prepare_markdown(source: str) -> str:
    lines = source.splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and (lines[0].startswith("版本：") or lines[0].startswith("更新日期：") or not lines[0].strip()):
        lines.pop(0)
    body = "\n".join(lines).strip()
    section_titles = []
    for line in body.splitlines():
        if not line.startswith("## "):
            continue
        title = re.sub(r"^\d+\.\s*", "", line[3:].strip())
        section_titles.append(title)
    contents = ["# 目录", ""]
    contents.extend(f"{index}. {title}" for index, title in enumerate(section_titles, start=1))
    contents.append("")
    page_break = (
        '```{=openxml}\n'
        '<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n'
        '```\n\n'
    )
    return "\n".join(contents) + page_break + body + "\n"


def zip_directory(source: Path, destination: Path) -> None:
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source).as_posix())


def build() -> None:
    pandoc = shutil.which("pandoc")
    if not pandoc:
        raise RuntimeError("pandoc is required")

    with tempfile.TemporaryDirectory(prefix="transaction-api-docx-") as temp_name:
        temp = Path(temp_name)
        markdown = temp / "transaction-api.md"
        reference = temp / "reference.docx"
        generated = temp / "generated.docx"
        unpacked_reference = temp / "reference"
        unpacked_output = temp / "output"

        markdown.write_text(prepare_markdown(SOURCE.read_text(encoding="utf-8")), encoding="utf-8")
        with reference.open("wb") as handle:
            subprocess.run(
                [pandoc, "--print-default-data-file", "reference.docx"],
                check=True,
                stdout=handle,
            )
        with zipfile.ZipFile(reference) as archive:
            archive.extractall(unpacked_reference)
        patch_styles(unpacked_reference / "word" / "styles.xml")
        patch_numbering(unpacked_reference / "word" / "numbering.xml")
        zip_directory(unpacked_reference, reference)

        subprocess.run(
            [
                pandoc,
                str(markdown),
                "--from=gfm+raw_attribute",
                "--to=docx",
                "--reference-doc",
                str(reference),
                "--resource-path",
                str(SOURCE.parent),
                "--metadata",
                "title=Transaction Push API",
                "--metadata",
                "subtitle=外部系统交易数据接入规范",
                "--metadata",
                "author=UNIS Integration Platform",
                "--metadata",
                "date=版本 v1 · 2026-06-08",
                "--highlight-style=tango",
                "--output",
                str(generated),
            ],
            check=True,
        )

        with zipfile.ZipFile(generated) as archive:
            archive.extractall(unpacked_output)
        patch_document(unpacked_output / "word" / "document.xml")
        add_footer(unpacked_output)

        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        zip_directory(unpacked_output, OUTPUT)

    with zipfile.ZipFile(OUTPUT) as archive:
        bad_file = archive.testzip()
        if bad_file:
            raise RuntimeError(f"Corrupt DOCX member: {bad_file}")
    print(OUTPUT)


if __name__ == "__main__":
    build()
