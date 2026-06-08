from __future__ import annotations

import io
import re
from xml.etree import ElementTree as ET
from pathlib import Path
from typing import List
from zipfile import ZipFile

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".xls", ".txt", ".md"}


def normalize_whitespace(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text).strip()


def split_lines(text: str) -> List[str]:
    raw = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return [normalize_whitespace(line) for line in raw if normalize_whitespace(line)]


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        import pdfplumber  # type: ignore
    except ModuleNotFoundError as exc:
        raise ValueError("PDF extraction requires the optional dependency pdfplumber.") from exc
    parts: List[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text)
    return "\n".join(parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    def paragraph_text(node: ET.Element) -> str:
        parts: list[str] = []
        for child in node.iter():
            tag = child.tag.split("}")[-1]
            if tag == "t" and child.text:
                parts.append(child.text)
            elif tag == "tab":
                parts.append("\t")
            elif tag in {"br", "cr"}:
                parts.append(" ")
        return normalize_whitespace("".join(parts))

    lines: list[str] = []
    with ZipFile(io.BytesIO(file_bytes)) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))

    body = root.find("w:body", namespace)
    if body is None:
        return ""

    for child in body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            text = paragraph_text(child)
            if text:
                lines.append(text)
            continue
        if tag != "tbl":
            continue

        for row in child.findall("w:tr", namespace):
            cells: list[str] = []
            for cell in row.findall("w:tc", namespace):
                paragraphs = [
                    paragraph_text(paragraph)
                    for paragraph in cell.findall(".//w:p", namespace)
                ]
                paragraphs = [paragraph for paragraph in paragraphs if paragraph]
                if paragraphs:
                    cells.append(" / ".join(paragraphs))
                else:
                    cells.append("")
            row_text = " | ".join(cells).strip()
            if row_text.strip("| "):
                lines.append(row_text)

    return "\n".join(split_lines("\n".join(lines)))


def _xlsx_shared_strings(zf: ZipFile) -> list[str]:
    try:
        xml = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(xml)
    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    values: list[str] = []
    for item in root.findall("main:si", namespace):
        text = "".join(node.text or "" for node in item.findall(".//main:t", namespace))
        values.append(text)
    return values


def _xlsx_sheet_names(zf: ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    ns_main = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    ns_rel = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
    rel_map = {
        rel.attrib.get("Id", ""): rel.attrib.get("Target", "")
        for rel in rels.findall("rel:Relationship", ns_rel)
    }
    sheets: list[tuple[str, str]] = []
    for sheet in workbook.findall("main:sheets/main:sheet", ns_main):
        rel_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", "")
        target = rel_map.get(rel_id, "")
        if target:
            sheet_name = sheet.attrib.get("name", "Sheet")
            normalized_target = target if target.startswith("xl/") else f"xl/{target}"
            sheets.append((sheet_name, normalized_target))
    return sheets


def _xlsx_cell_text(cell: ET.Element, shared_strings: list[str], namespace: dict[str, str]) -> str:
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", namespace)).strip()
    value = (cell.findtext("main:v", default="", namespaces=namespace) or "").strip()
    if not value:
        return ""
    if cell_type == "s":
        try:
            return shared_strings[int(value)].strip()
        except (ValueError, IndexError):
            return value
    return value


def extract_text_from_xlsx(file_bytes: bytes) -> str:
    namespace = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    lines: list[str] = []
    with ZipFile(io.BytesIO(file_bytes)) as zf:
        shared_strings = _xlsx_shared_strings(zf)
        sheets = _xlsx_sheet_names(zf)
        for sheet_name, path in sheets:
            lines.append(f"[Sheet] {sheet_name}")
            root = ET.fromstring(zf.read(path))
            for row in root.findall(".//main:sheetData/main:row", namespace):
                row_values = [
                    value
                    for cell in row.findall("main:c", namespace)
                    if (value := _xlsx_cell_text(cell, shared_strings, namespace))
                ]
                if row_values:
                    lines.append(" | ".join(row_values))
    return "\n".join(lines)


def extract_text_from_xls(file_bytes: bytes) -> str:
    try:
        return extract_text_from_xlsx(file_bytes)
    except Exception:
        decoded = file_bytes.decode("latin1", "ignore")
        tokens = re.findall(r"[A-Za-z0-9*|/_\-\.\(\):, ]{5,}", decoded)
        lines = [normalize_whitespace(token) for token in tokens]
        lines = [line for line in lines if line and any(ch.isalpha() for ch in line)]
        return "\n".join(lines)


def extract_text(file_name: str, file_bytes: bytes) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {suffix}")
    if suffix == ".pdf":
        text = extract_text_from_pdf(file_bytes)
    elif suffix == ".docx":
        text = extract_text_from_docx(file_bytes)
    elif suffix == ".xlsx":
        text = extract_text_from_xlsx(file_bytes)
    elif suffix == ".xls":
        text = extract_text_from_xls(file_bytes)
    else:
        text = file_bytes.decode("utf-8", "ignore")
    cleaned = "\n".join(split_lines(text))
    if not cleaned:
        raise ValueError("No extractable text found in the uploaded file.")
    return cleaned
