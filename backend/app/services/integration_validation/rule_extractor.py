from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Iterable, List

from .schemas import ValidationPoint


ERROR_WORDS = ("MUST", "REQUIRED", "MANDATORY", "必填", "必须", "缺少", "MUST USE")
WARNING_WORDS = ("SHOULD", "RECOMMENDED", "TYPICALLY", "建议", "推荐", "通常")
DATE_FORMATS = {"CCYYMMDD", "YYMMDD"}
TIME_FORMATS = {"HHMM", "HHMMSS"}
DATA_TYPES = {"ID", "AN", "DT", "TM", "R", "N0", "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9"}
SEGMENT_STOPWORDS = {
    "IS",
    "ARE",
    "THE",
    "FOR",
    "WITH",
    "AND",
    "USE",
    "NOT",
    "ONE",
    "TWO",
    "THREE",
    "HAS",
    "HAVE",
    "HAD",
    "THIS",
    "THAT",
    "WHEN",
    "THEN",
    "MAY",
    "MUST",
    "CAN",
    "SHOULD",
    "FROM",
    "INTO",
    "ITS",
    "PER",
    "ALL",
    "ANY",
}

QUALIFIED_REQUIRED_RE = re.compile(
    r"\b([A-Z][A-Z0-9]{1,2})\*([A-Z0-9]{2,4})\b.*?(REQUIRED|MANDATORY|MUST USE|必填|必须|缺少)",
    re.IGNORECASE,
)
QUALIFIED_MISSING_RE = re.compile(r"\bMISSING\s+([A-Z][A-Z0-9]{1,2})\*([A-Z0-9]{2,4})\b", re.IGNORECASE)
ELEMENT_REQUIRED_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,2}\d{2})\b.*?(REQUIRED|MANDATORY|MUST USE|必填|必须|缺少)", re.IGNORECASE)
SEGMENT_REQUIRED_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,2})\b(?:\s+SEGMENT)?\s+(?:IS\s+)?(REQUIRED|MANDATORY|MUST USE|必填|必须|缺少)", re.IGNORECASE)
MUST_BE_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,2}\d{2})\b.*?(?:MUST BE|应为|必须是)\s+([A-Z0-9/\- ,|]+)", re.IGNORECASE)
ONE_OF_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,2}\d{2})\b.*?(?:ONE OF|其中之一|必须是)\s+([A-Z0-9/\- ,|]+)", re.IGNORECASE)
FORMAT_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,2}\d{2})\b.*?(CCYYMMDD|YYMMDD|HHMMSS|HHMM)\b", re.IGNORECASE)
CONDITIONAL_RE = re.compile(r"IF\s+([A-Z][A-Z0-9]{1,2}\d{2})\s+(?:IS\s+)?PRESENT\s+THEN\s+([A-Z][A-Z0-9]{1,2}\d{2})\s+(?:IS\s+)?REQUIRED", re.IGNORECASE)
PAIRED_RE = re.compile(r"\b([A-Z][A-Z0-9]{1,2}\d{2})\b\s+AND\s+\b([A-Z][A-Z0-9]{1,2}\d{2})\b.*?(?:TOGETHER|APPEAR TOGETHER|MUST APPEAR TOGETHER)", re.IGNORECASE)
AT_LEAST_ONE_RE = re.compile(r"AT LEAST ONE OF\s+([A-Z][A-Z0-9]{1,2}\d{2}(?:\s*(?:,|/|OR)\s*[A-Z][A-Z0-9]{1,2}\d{2})+)", re.IGNORECASE)
IF_EITHER_PAIR_RE = re.compile(
    r"IF EITHER\s+([A-Z][A-Z0-9]{1,2}\d{2})\s+OR\s+([A-Z][A-Z0-9]{1,2}\d{2})\s+IS\s+PRESENT,\s+THEN\s+THE\s+OTHER\s+IS\s+REQUIRED",
    re.IGNORECASE,
)
IF_EITHER_MULTI_RE = re.compile(
    r"IF EITHER\s+([A-Z][A-Z0-9]{1,2}\d{2})(?:,\s*([A-Z][A-Z0-9]{1,2}\d{2}))?(?:\s+OR\s+([A-Z][A-Z0-9]{1,2}\d{2}))?\s+ARE\s+PRESENT,\s+THEN\s+THE\s+OTHERS\s+ARE\s+REQUIRED",
    re.IGNORECASE,
)
LEVEL_REQUIRED_RE = re.compile(r"\b(SHIPMENT|ORDER|PACK|PACKAGE|TARE|ITEM)\s+(?:LEVEL|HL)?\s+([A-Z][A-Z0-9]{1,2})\b.*?(REQUIRED|MANDATORY|缺少|必填)", re.IGNORECASE)
LOOP_CONTAINS_RE = re.compile(r"\b(ITEM|PACK|PACKAGE|ORDER|SHIPMENT|TARE)\s+HL\b.*?(?:CONTAIN|WITH)\s+([A-Z][A-Z0-9]{1,2})(?:\s+AND\s+([A-Z][A-Z0-9]{1,2}))?", re.IGNORECASE)
SYNTAX_NOTE_RE = re.compile(r"^\s*\d+\.\s+[CPR]\d{4}\b", re.IGNORECASE)
COMPACT_ELEMENT_TAIL_RE = re.compile(
    r"^(?P<name>.*?)(?P<req>[MORX])(?P<dtype>ID|AN|DT|TM|R|N\d)(?P<min>\d{1,3})/(?P<max>\d{1,3})(?P<usage>Must use|Used|Optional)?$",
    re.IGNORECASE,
)
SPACED_ELEMENT_ROW_RE = re.compile(
    r"^(?P<element>[A-Z][A-Z0-9]{1,2}\d{2})\s+(?P<ref>\d{1,4})\s+(?P<name>.*?)\s+(?P<req>[MORX])\s+(?P<dtype>ID|AN|DT|TM|R|N\d)\s+(?P<min>\d{1,3})/(?P<max>\d{1,3})(?:\s+(?P<usage>Must use|Used|Optional))?$",
    re.IGNORECASE,
)
FUNCTIONAL_GROUP_RE = re.compile(r"FUNCTIONAL GROUP\s*=\s*([A-Z0-9]{1,4})", re.IGNORECASE)
CODE_LINE_RE = re.compile(r"^([A-Z0-9]{1,4})(?:\s+|(?=[A-Z][a-z]))")
MIN_MAX_RE = re.compile(r"^(\d{1,3})/(\d{1,3})$")
SEGMENT_HEADER_RE = re.compile(r"^([A-Z](?:\d{1,2})?|[A-Z]{2,3})(?=[A-Z])")


def severity_for_line(line_upper: str) -> str:
    if any(token in line_upper for token in WARNING_WORDS):
        return "Warning"
    return "Error"


def normalize_values(raw: str) -> List[str]:
    normalized = raw.replace("或", "/").replace(" OR ", "/").replace(" or ", "/").replace(",", "/").replace("|", "/")
    values = [item for item in re.findall(r"[A-Z0-9]{1,16}", normalized.upper()) if item not in {"MUST", "BE", "ONE", "OF"}]
    dedup: List[str] = []
    for value in values:
        if value not in dedup:
            dedup.append(value)
    return dedup[:10]


def freeze_value(value: object) -> object:
    if isinstance(value, dict):
        return tuple(sorted((key, freeze_value(val)) for key, val in value.items()))
    if isinstance(value, list):
        return tuple(freeze_value(item) for item in value)
    return value


def is_syntax_note_line(line_upper: str) -> bool:
    return bool(
        SYNTAX_NOTE_RE.search(line_upper)
        or " IF " in f" {line_upper} "
        or " AT LEAST ONE OF " in f" {line_upper} "
        or " THEN " in f" {line_upper} "
        or " THE OTHER IS REQUIRED" in line_upper
        or " THE OTHERS ARE REQUIRED" in line_upper
    )


def compact_segment_key(segment: str) -> str:
    if segment == "W03":
        return "W3"
    return segment


def segment_for_element(element: str) -> str:
    match = re.fullmatch(r"([A-Z]+)(\d{2})", element.upper())
    if not match:
        return element[:-2].upper()
    prefix, suffix = match.groups()
    if len(prefix) == 2 and prefix[1].isdigit():
        return f"{prefix[0]}0{prefix[1]}"
    return prefix


def candidate_score(segment: str, ref: str, name: str) -> int:
    score = segment_shape_score(segment) * 10 + len(ref)
    stripped_name = name.strip()
    if stripped_name[:1].isalpha():
        score += 50
    elif stripped_name[:1].isdigit():
        score -= 50
    return score


def parse_element_row(line: str, known_segments: set[str] | None = None) -> Dict[str, object] | None:
    if " | " in line:
        parts = [part.strip() for part in line.split("|")]
        if not parts:
            return None
        element = ""
        name = ""
        lead = parts[0].strip()
        if re.fullmatch(r"[A-Z][A-Z0-9]{1,2}\d{2}", lead.upper()):
            element = lead.upper()
            name = parts[2] if len(parts) > 2 else ""
        else:
            lead_match = re.fullmatch(r"([A-Z][A-Z0-9]{1,2}\d{2})\s+\d{1,4}\s+(.+)", lead, re.IGNORECASE)
            if not lead_match:
                return None
            element = lead_match.group(1).upper()
            name = lead_match.group(2).strip()
        min_idx = next((idx for idx, token in enumerate(parts) if MIN_MAX_RE.fullmatch(token.strip())), -1)
        if min_idx == -1:
            return None

        req = ""
        dtype = ""
        req_type = parts[min_idx - 1].replace(" ", "").upper() if min_idx >= 1 else ""
        parsed_req_type = re.fullmatch(r"([MORX])(ID|AN|DT|TM|R|N\d)", req_type)
        if parsed_req_type:
            req, dtype = parsed_req_type.groups()
        elif req_type in DATA_TYPES and min_idx >= 2:
            req_token = parts[min_idx - 2].strip().upper()
            if req_token in {"M", "O", "R", "X"}:
                req = req_token
                dtype = req_type

        if not dtype:
            return None

        mm = MIN_MAX_RE.fullmatch(parts[min_idx].strip())
        if not mm:
            return None
        usage = parts[min_idx + 1] if min_idx + 1 < len(parts) else ""
        return {
            "element": element,
            "segment": segment_for_element(element),
            "name": name,
            "req": req,
            "dtype": dtype,
            "min": int(mm.group(1)),
            "max": int(mm.group(2)),
            "usage": usage,
        }

    spaced = SPACED_ELEMENT_ROW_RE.fullmatch(line.strip())
    if spaced:
        element = spaced.group("element").upper()
        return {
            "element": element,
            "segment": segment_for_element(element),
            "name": spaced.group("name").strip(),
            "req": spaced.group("req").upper(),
            "dtype": spaced.group("dtype").upper(),
            "min": int(spaced.group("min")),
            "max": int(spaced.group("max")),
            "usage": (spaced.group("usage") or "").strip(),
        }

    compact_line = line.strip()
    if known_segments:
        contextual_candidates: list[Dict[str, object]] = []
        for segment in sorted(known_segments, key=len, reverse=True):
            key = compact_segment_key(segment)
            if not compact_line.upper().startswith(key.upper()):
                continue
            if len(compact_line) <= len(key) + 2:
                continue
            element_suffix = compact_line[len(key):len(key) + 2]
            if not element_suffix.isdigit():
                continue
            for ref_len in range(1, 5):
                start = len(key) + 2
                end = start + ref_len
                if len(compact_line) <= end:
                    continue
                ref = compact_line[start:end]
                if not ref.isdigit():
                    continue
                tail = compact_line[end:]
                compact = COMPACT_ELEMENT_TAIL_RE.fullmatch(tail)
                if not compact:
                    continue
                contextual_candidates.append(
                    {
                        "element": f"{key.upper()}{element_suffix}",
                        "segment": segment.upper(),
                        "name": compact.group("name").strip(),
                        "req": compact.group("req").upper(),
                        "dtype": compact.group("dtype").upper(),
                        "min": int(compact.group("min")),
                        "max": int(compact.group("max")),
                        "usage": (compact.group("usage") or "").strip(),
                        "_score": candidate_score(segment.upper(), ref, compact.group("name")),
                    }
                )
        if contextual_candidates:
            best = max(contextual_candidates, key=lambda item: int(item.get("_score", 0)))
            best.pop("_score", None)
            return best

    candidates: list[Dict[str, object]] = []
    for element_len in (4, 5):
        if len(compact_line) <= element_len + 1:
            continue
        element = compact_line[:element_len].upper()
        if not re.fullmatch(r"[A-Z][A-Z0-9]{1,2}\d{2}", element):
            continue
        for ref_len in range(1, 5):
            if len(compact_line) <= element_len + ref_len:
                continue
            ref = compact_line[element_len:element_len + ref_len]
            if not ref.isdigit():
                continue
            tail = compact_line[element_len + ref_len:]
            compact = COMPACT_ELEMENT_TAIL_RE.fullmatch(tail)
            if not compact:
                continue
            candidate = {
                "element": element,
                "segment": segment_for_element(element),
                "name": compact.group("name").strip(),
                "req": compact.group("req").upper(),
                "dtype": compact.group("dtype").upper(),
                "min": int(compact.group("min")),
                "max": int(compact.group("max")),
                "usage": (compact.group("usage") or "").strip(),
            }
            candidate["_score"] = candidate_score(str(candidate["segment"]), ref, str(candidate["name"]))
            candidates.append(candidate)
    if not candidates:
        return None
    best = max(candidates, key=lambda item: int(item.get("_score", 0)))
    best.pop("_score", None)
    return best


def parse_code_value(line: str) -> str | None:
    stripped = line.strip()
    match = CODE_LINE_RE.match(stripped)
    if not match:
        return None
    code = match.group(1).strip().upper()
    if code in {"CODE", "NAME", "REF", "ID", "LOOP", "POS", "MAX", "REQ", "TYPE"}:
        return None
    if len(code) == len(stripped) and not any(ch.isdigit() for ch in code):
        return None
    return code


def should_collect_code_line(line: str) -> bool:
    line_upper = line.upper()
    if not line_upper or line_upper == "CODE NAME":
        return False
    if line_upper.endswith(":"):
        return False
    if any(
        line_upper.startswith(prefix)
        for prefix in (
            "DESCRIPTION:",
            "SYNTAX RULES:",
            "SEMANTICS:",
            "COMMENTS:",
            "ELEMENT SUMMARY:",
            "USER OPTION",
            "PURPOSE:",
            "LOOP SUMMARY:",
            "HEADING",
            "DETAIL",
            "SUMMARY",
        )
    ):
        return False
    return parse_code_value(line) is not None


def should_require(row: Dict[str, object]) -> bool:
    usage = str(row.get("usage", "")).upper()
    req = str(row.get("req", "")).upper()
    return "MUST USE" in usage or req in {"M", "R"}


def segment_shape_score(segment: str) -> int:
    if segment.isalpha():
        return 100 + len(segment)
    if re.fullmatch(r"[A-Z]\d{2}", segment):
        return 90
    if re.fullmatch(r"[A-Z]\d", segment):
        return 80
    if re.fullmatch(r"[A-Z]{2}\d", segment):
        return 70
    return 0


def _make_point(point_id: str, file_name: str, source_line: str, title: str, category: str, rule_type: str, **kwargs: object) -> ValidationPoint:
    severity = kwargs.pop("severity", severity_for_line(source_line.upper()))
    point = ValidationPoint(
        id=point_id,
        title=title,
        source_line=source_line,
        source_file=file_name,
        category=category,
        rule_type=rule_type,
        severity=severity,
        **kwargs,
    )
    point.compiled = rule_type != "informational"
    point.description_zh = source_line
    point.description_en = title
    return point


def compile_points(file_name: str, text: str) -> List[ValidationPoint]:
    points: List[ValidationPoint] = []
    seen: set[tuple] = set()
    active_element: Dict[str, object] | None = None
    collecting_codes = False
    code_values: List[str] = []
    saw_elements: set[str] = set()
    known_segments: set[str] = set()

    def add_point(point: ValidationPoint) -> None:
        key = (
            point.rule_type,
            point.segment,
            point.element,
            point.qualifier,
            tuple(point.expected),
            freeze_value(point.metadata),
            point.source_line,
        )
        if key not in seen:
            seen.add(key)
            points.append(point)

    def flush_codes(point_id: str) -> None:
        nonlocal collecting_codes, code_values
        if active_element and code_values:
            values = []
            for code in code_values:
                if code not in values:
                    values.append(code)
            if values:
                rule_type = "element_one_of" if len(values) > 1 else "element_equals"
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        str(active_element.get("element", "")),
                        f"{active_element['element']} must be {' / '.join(values)}",
                        "Value Constraint",
                        rule_type,
                        segment=str(active_element["segment"]),
                        element=str(active_element["element"]),
                        expected=values,
                    )
                )
        collecting_codes = False
        code_values = []

    lines = text.splitlines()
    for idx, line in enumerate(lines, start=1):
        line = line.strip()
        if not line:
            continue
        upper = line.upper()
        point_id = f"{Path(file_name).stem}-{idx}"

        if not (" | " in line):
            segment_header = SEGMENT_HEADER_RE.match(line)
            if segment_header:
                candidate = segment_header.group(1).upper()
                if re.fullmatch(r"[A-Z]{2,3}|[A-Z]\d|[A-Z]\d{2}", candidate):
                    known_segments.add(candidate)

        row = parse_element_row(line, known_segments=known_segments)
        if collecting_codes and upper == "CODE NAME":
            continue
        if collecting_codes and (row or not should_collect_code_line(line)):
            flush_codes(point_id)
        if collecting_codes and should_collect_code_line(line):
            code = parse_code_value(line)
            if code:
                code_values.append(code)
                continue

        if row:
            active_element = row
            saw_elements.add(str(row["element"]))
            if should_require(row):
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        line,
                        f"{row['element']} is required",
                        "Required",
                        "element_required",
                        segment=str(row["segment"]),
                        element=str(row["element"]),
                    )
                )
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{row['element']} must satisfy {row['dtype']} {row['min']}/{row['max']}",
                    "Format",
                    "element_length_range",
                    segment=str(row["segment"]),
                    element=str(row["element"]),
                    metadata={
                        "dtype": row["dtype"],
                        "min": row["min"],
                        "max": row["max"],
                    },
                )
            )
            continue

        if active_element and upper.startswith("DESCRIPTION:"):
            match = FORMAT_RE.search(upper)
            ordered_formats = tuple(sorted((*DATE_FORMATS, *TIME_FORMATS), key=len, reverse=True))
            fmt = match.group(2) if match else next((token for token in ordered_formats if token in upper), "")
            if fmt:
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        line,
                        f"{active_element['element']} must use {fmt.upper()} format",
                        "Format",
                        "date_format" if fmt.upper() in DATE_FORMATS else "time_format",
                        segment=str(active_element["segment"]),
                        element=str(active_element["element"]),
                        expected=[fmt.upper()],
                    )
                )
            continue

        if active_element and upper.startswith("CODE LIST SUMMARY"):
            collecting_codes = True
            code_values = []
            continue

        match = FUNCTIONAL_GROUP_RE.search(upper)
        if match:
            value = match.group(1).upper()
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"GS01 must be {value}",
                    "Value Constraint",
                    "element_equals",
                    segment="GS",
                    element="GS01",
                    expected=[value],
                )
            )
            continue

        match = QUALIFIED_REQUIRED_RE.search(upper) or QUALIFIED_MISSING_RE.search(upper)
        if match:
            segment, qualifier = match.groups()[:2]
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{segment}*{qualifier} is required",
                    "Required",
                    "qualified_segment_required",
                    segment=segment,
                    qualifier=qualifier,
                )
            )
            continue

        match = IF_EITHER_MULTI_RE.search(upper)
        if match:
            refs = [value.upper() for value in match.groups() if value]
            if len(refs) >= 3:
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        line,
                        f"{' / '.join(refs)} must appear together",
                        "Dependency",
                        "all_or_none",
                        metadata={"refs": refs},
                    )
                )
                continue

        match = IF_EITHER_PAIR_RE.search(upper)
        if match:
            first, second = (value.upper() for value in match.groups())
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{first} and {second} must appear together",
                    "Dependency",
                    "paired_elements",
                    metadata={"first": first, "second": second},
                )
            )
            continue

        match = CONDITIONAL_RE.search(upper)
        if match:
            trigger, required = match.groups()
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"If {trigger} is present, {required} is required",
                    "Dependency",
                    "conditional_dependency",
                    metadata={"trigger": trigger, "required": required},
                )
            )
            continue

        match = PAIRED_RE.search(upper)
        if match:
            first, second = match.groups()
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{first} and {second} must appear together",
                    "Dependency",
                    "paired_elements",
                    metadata={"first": first, "second": second},
                )
            )
            continue

        match = AT_LEAST_ONE_RE.search(upper)
        if match:
            refs = normalize_values(match.group(1))
            if refs:
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        line,
                        f"At least one of {' / '.join(refs)} is required",
                        "Dependency",
                        "at_least_one_of",
                        metadata={"refs": refs},
                    )
                )
                continue

        match = LOOP_CONTAINS_RE.search(upper)
        if match:
            level_name, first_seg, second_seg = match.groups()
            required_segments = [first_seg]
            if second_seg:
                required_segments.append(second_seg)
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{level_name.title()} HL must contain {' and '.join(required_segments)}",
                    "Loop Rule",
                    "basic_loop_requirement",
                    metadata={"level": level_name[:1], "segments": required_segments},
                )
            )
            continue

        match = LEVEL_REQUIRED_RE.search(upper)
        if match:
            level_name, segment, _ = match.groups()
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{level_name.title()} level {segment} is required",
                    "Loop Rule",
                    "basic_loop_requirement",
                    metadata={"level": level_name[:1], "segments": [segment]},
                )
            )
            continue

        match = FORMAT_RE.search(upper)
        if match:
            element, fmt = match.groups()
            rule_type = "date_format" if fmt.upper() in DATE_FORMATS else "time_format"
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{element} must use {fmt.upper()} format",
                    "Format",
                    rule_type,
                    segment=segment_for_element(element),
                    element=element,
                    expected=[fmt.upper()],
                )
            )
            continue

        match = ONE_OF_RE.search(upper)
        if match:
            element, raw = match.groups()
            values = normalize_values(raw)
            if len(values) >= 2:
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        line,
                        f"{element} must be one of {' / '.join(values)}",
                        "Value Constraint",
                        "element_one_of",
                        segment=segment_for_element(element),
                        element=element,
                        expected=values,
                    )
                )
                continue

        match = MUST_BE_RE.search(upper)
        if match:
            element, raw = match.groups()
            values = normalize_values(raw)
            rule_type = "element_one_of" if len(values) > 1 else "element_equals"
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    f"{element} must be {' / '.join(values) if values else raw.strip()}",
                    "Value Constraint",
                    rule_type,
                    segment=segment_for_element(element),
                    element=element,
                    expected=values,
                )
            )
            continue

        match = ELEMENT_REQUIRED_RE.search(upper)
        if match:
            if not is_syntax_note_line(upper):
                element = match.group(1)
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        line,
                        f"{element} is required",
                        "Required",
                        "element_required",
                        segment=segment_for_element(element),
                        element=element,
                    )
                )
                continue

        match = SEGMENT_REQUIRED_RE.search(upper)
        if match:
            segment = match.group(1)
            if segment not in SEGMENT_STOPWORDS and not is_syntax_note_line(upper):
                add_point(
                    _make_point(
                        point_id,
                        file_name,
                        line,
                        f"{segment} segment is required",
                        "Required",
                        "segment_required",
                        segment=segment,
                    )
                )
                continue

        if any(token in upper for token in ERROR_WORDS + WARNING_WORDS):
            add_point(
                _make_point(
                    point_id,
                    file_name,
                    line,
                    "Informational validation point",
                    "Informational",
                    "informational",
                    compiled=False,
                )
            )
    flush_codes(f"{Path(file_name).stem}-final")

    if {"ST02", "SE02"}.issubset(saw_elements):
        add_point(
            _make_point(
                f"{Path(file_name).stem}-tx-control",
                file_name,
                "ST02 must match SE02",
                "ST02 must match SE02",
                "Dependency",
                "cross_segment_match",
                metadata={"left": "ST02", "right": "SE02"},
            )
        )
    if "SE01" in saw_elements:
        add_point(
            _make_point(
                f"{Path(file_name).stem}-segment-count",
                file_name,
                "SE01 must equal transaction segment count",
                "SE01 must equal transaction segment count",
                "Dependency",
                "segment_count_matches",
                segment="SE",
                element="SE01",
            )
        )

    if {"W0603", "G6202"}.issubset(saw_elements):
        add_point(
            _make_point(
                f"{Path(file_name).stem}-ship-date-match",
                file_name,
                "W0603 must match G6202",
                "W0603 must match G6202",
                "Dependency",
                "cross_segment_match",
                metadata={"left": "W0603", "right": "G6202"},
            )
        )

    if {"W1202", "W1203"}.issubset(saw_elements):
        add_point(
            _make_point(
                f"{Path(file_name).stem}-ship-qty-le-order",
                file_name,
                "W1203 must be less than or equal to W1202",
                "W1203 must be less than or equal to W1202",
                "Value Constraint",
                "numeric_lte",
                metadata={"left": "W1203", "right": "W1202"},
            )
        )

    if {"W301", "W1203"}.issubset(saw_elements):
        add_point(
            _make_point(
                f"{Path(file_name).stem}-sum-shipped-units",
                file_name,
                "Sum of W1203 must equal W301",
                "Sum of W1203 must equal W301",
                "Dependency",
                "sum_equals",
                metadata={"source": "W1203", "target": "W301"},
            )
        )

    if {"W302", "W1210"}.issubset(saw_elements):
        add_point(
            _make_point(
                f"{Path(file_name).stem}-sum-weights",
                file_name,
                "Sum of W1210 must equal W302",
                "Sum of W1210 must equal W302",
                "Dependency",
                "sum_equals",
                metadata={"source": "W1210", "target": "W302"},
            )
        )

    if "MAN02" in saw_elements:
        add_point(
            _make_point(
                f"{Path(file_name).stem}-unique-man02",
                file_name,
                "MAN02 values must be unique",
                "MAN02 values must be unique",
                "Dependency",
                "unique_element",
                segment="MAN",
                element="MAN02",
            )
        )

    if "LX01" in saw_elements:
        add_point(
            _make_point(
                f"{Path(file_name).stem}-unique-lx01",
                file_name,
                "LX01 values must be unique",
                "LX01 values must be unique",
                "Dependency",
                "unique_element",
                segment="LX",
                element="LX01",
            )
        )

    if "N101" in saw_elements:
        n101_points = [
            point
            for point in points
            if point.rule_type in {"element_one_of", "element_equals"} and point.element == "N101"
        ]
        n101_values = sorted({value for point in n101_points for value in point.expected})
        for qualifier in ("SF", "ST"):
            if qualifier in n101_values:
                add_point(
                    _make_point(
                        f"{Path(file_name).stem}-n1-{qualifier.lower()}",
                        file_name,
                        f"N1*{qualifier} is required",
                        f"N1*{qualifier} is required",
                        "Dependency",
                        "qualified_segment_required",
                        segment="N1",
                        qualifier=qualifier,
                    )
                )

    return points


def group_points(points: Iterable[ValidationPoint]) -> List[Dict[str, object]]:
    grouped: Dict[str, List[ValidationPoint]] = {}
    for point in points:
        grouped.setdefault(point.category, []).append(point)
    ordered = []
    for category in ("Required", "Value Constraint", "Dependency", "Format", "Loop Rule", "Informational"):
        items = grouped.get(category, [])
        if not items:
            continue
        items.sort(key=lambda item: (item.segment, item.element, item.qualifier, item.title))
        ordered.append({"category": category, "count": len(items), "items": [item.to_dict() for item in items]})
    return ordered
