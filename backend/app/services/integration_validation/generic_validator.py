from __future__ import annotations

import re
from typing import List

from .edi_parser import element_index, element_value, hl_chunks, parse_edi_with_raw, raw_segment_by_tag, segment_occurrences
from .schemas import ValidationFinding, ValidationPoint


def is_date(value: str, fmt: str) -> bool:
    if fmt == "CCYYMMDD":
        return bool(re.fullmatch(r"\d{8}", value or ""))
    if fmt == "YYMMDD":
        return bool(re.fullmatch(r"\d{6}", value or ""))
    return False


def is_time(value: str, fmt: str) -> bool:
    if fmt == "HHMM":
        return bool(re.fullmatch(r"\d{4}", value or ""))
    if fmt == "HHMMSS":
        return bool(re.fullmatch(r"\d{6}", value or ""))
    return False


def matches_data_type(value: str, dtype: str) -> bool:
    normalized = (value or "").strip()
    if not normalized:
        return False
    if dtype in {"DT", "TM"}:
        return True
    if dtype.startswith("N"):
        return bool(re.fullmatch(r"\d+", normalized))
    if dtype == "R":
        return bool(re.fullmatch(r"[+-]?\d+(?:\.\d+)?", normalized))
    if dtype in {"ID", "AN"}:
        return True
    return True


def to_number(value: str) -> float | None:
    normalized = (value or "").strip()
    if not normalized:
        return None
    if re.fullmatch(r"-?\d+(?:\.\d+)?", normalized):
        return float(normalized)
    return None


def make_finding(
    code: str,
    severity: str,
    segment: str,
    element: str,
    message_zh: str,
    message_en: str,
    point_id: str = "",
    raw_segment: str = "",
    raw_segment_index: int = 0,
) -> ValidationFinding:
    return ValidationFinding(
        code=code,
        severity=severity,
        segment=segment,
        element=element,
        message_zh=message_zh,
        message_en=message_en,
        source="generic",
        point_id=point_id,
        raw_segment=raw_segment,
        raw_segment_index=raw_segment_index,
    )


def segment_for_element(element_ref: str) -> str:
    match = re.fullmatch(r"([A-Z]+)(\d{2})", element_ref.upper())
    if not match:
        return element_ref[:-2].upper()
    prefix, suffix = match.groups()
    if len(prefix) == 2 and prefix[1].isdigit():
        return f"{prefix[0]}0{prefix[1]}"
    return prefix


def validate_generic(edi_text: str, points: List[ValidationPoint]) -> List[ValidationFinding]:
    segments, raw_segments, _separator = parse_edi_with_raw(edi_text)
    if not segments:
        return [
            make_finding(
                "PARSE001",
                "Error",
                "",
                "",
                "未解析到任何有效 EDI 段，请检查分隔符或报文内容。",
                "No valid EDI segments were parsed. Please check the delimiters or message content.",
            )
        ]

    findings: List[ValidationFinding] = []
    for point in points:
        if not point.compiled:
            continue

        if point.rule_type == "segment_required":
            if not segment_occurrences(segments, point.segment):
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        "",
                        f"缺少必填段 {point.segment}。",
                        f"Required segment {point.segment} is missing.",
                        point.id,
                    )
                )

        elif point.rule_type == "qualified_segment_required":
            matched = False
            raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, point.segment)
            for segment in segment_occurrences(segments, point.segment):
                if element_value(segment, 1).upper() == point.qualifier.upper():
                    matched = True
                    break
            if not matched:
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        f"{point.segment}*{point.qualifier}",
                        f"缺少必填限定段 {point.segment}*{point.qualifier}。",
                        f"Required qualified segment {point.segment}*{point.qualifier} is missing.",
                        point.id,
                        raw_segment,
                        raw_index,
                    )
                )

        elif point.rule_type == "element_required":
            segment_list = segment_occurrences(segments, point.segment)
            if not segment_list:
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        point.element,
                        f"缺少段 {point.segment}，无法满足 {point.element} 必填规则。",
                        f"Segment {point.segment} is missing, so required element {point.element} cannot be validated.",
                        point.id,
                    )
                )
                continue
            index = element_index(point.element)
            if not any(element_value(segment, index) for segment in segment_list):
                raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, point.segment)
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        point.element,
                        f"{point.element} 必填，但当前报文为空或缺失。",
                        f"{point.element} is required but missing or empty in the current EDI message.",
                        point.id,
                        raw_segment,
                        raw_index,
                    )
                )

        elif point.rule_type in {"element_equals", "element_one_of"}:
            segment_list = segment_occurrences(segments, point.segment)
            if not segment_list:
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        point.element,
                        f"缺少段 {point.segment}，无法校验 {point.element} 的取值。",
                        f"Segment {point.segment} is missing, so {point.element} cannot be validated.",
                        point.id,
                    )
                )
                continue
            index = element_index(point.element)
            actual_values = [element_value(segment, index).upper() for segment in segment_list if element_value(segment, index)]
            expected_values = [value.upper() for value in point.expected]
            if not actual_values:
                raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, point.segment)
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        point.element,
                        f"{point.element} 缺失，期望值为 {' / '.join(point.expected)}。",
                        f"{point.element} is missing. Expected {' / '.join(point.expected)}.",
                        point.id,
                        raw_segment,
                        raw_index,
                    )
                )
            else:
                bad_segment = ""
                bad_index = 0
                for idx, segment in enumerate(segments, start=1):
                    if segment and segment[0].upper() == point.segment.upper():
                        value = element_value(segment, index).upper()
                        if value and value not in expected_values:
                            bad_segment = raw_segments[idx - 1]
                            bad_index = idx
                            break
                if any(value not in expected_values for value in actual_values):
                    findings.append(
                        make_finding(
                            point.id,
                            point.severity,
                            point.segment,
                            point.element,
                            f"{point.element} 取值不符合规则，期望 {' / '.join(point.expected)}，实际 {' / '.join(actual_values)}。",
                            f"{point.element} does not match the expected value set. Expected {' / '.join(point.expected)}, got {' / '.join(actual_values)}.",
                            point.id,
                            bad_segment,
                            bad_index,
                        )
                    )

        elif point.rule_type in {"date_format", "time_format"}:
            segment_list = segment_occurrences(segments, point.segment)
            index = element_index(point.element)
            values = [element_value(segment, index) for segment in segment_list if element_value(segment, index)]
            fmt = point.expected[0] if point.expected else ""
            checker = is_date if point.rule_type == "date_format" else is_time
            if not values:
                raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, point.segment)
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        point.element,
                        f"{point.element} 缺失，无法校验 {fmt} 格式。",
                        f"{point.element} is missing, so {fmt} format cannot be validated.",
                        point.id,
                        raw_segment,
                        raw_index,
                    )
                )
            else:
                bad_segment = ""
                bad_index = 0
                for idx, segment in enumerate(segments, start=1):
                    if segment and segment[0].upper() == point.segment.upper():
                        value = element_value(segment, index)
                        if value and not checker(value, fmt):
                            bad_segment = raw_segments[idx - 1]
                            bad_index = idx
                            break
                if any(not checker(value, fmt) for value in values):
                    findings.append(
                        make_finding(
                            point.id,
                            point.severity,
                            point.segment,
                            point.element,
                            f"{point.element} 格式错误，期望 {fmt}。",
                            f"{point.element} has an invalid format. Expected {fmt}.",
                            point.id,
                            bad_segment,
                            bad_index,
                        )
                    )

        elif point.rule_type == "element_length_range":
            segment_list = segment_occurrences(segments, point.segment)
            index = element_index(point.element)
            dtype = str(point.metadata.get("dtype", "")).upper()
            min_len = int(point.metadata.get("min", 0) or 0)
            max_len = int(point.metadata.get("max", 0) or 0)
            for raw_idx, segment in enumerate(segments, start=1):
                if not segment or segment[0].upper() != point.segment.upper():
                    continue
                value = element_value(segment, index)
                if not value:
                    continue
                if min_len <= len(value) <= max_len and matches_data_type(value, dtype):
                    continue
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        point.segment,
                        point.element,
                        f"{point.element} 长度或类型不符合 {dtype} {min_len}/{max_len} 约束。",
                        f"{point.element} does not satisfy the {dtype} {min_len}/{max_len} length or type constraint.",
                        point.id,
                        raw_segments[raw_idx - 1],
                        raw_idx,
                    )
                )
                break

        elif point.rule_type == "paired_elements":
            first = point.metadata.get("first", "")
            second = point.metadata.get("second", "")
            first_segment = segment_for_element(str(first))
            second_segment = segment_for_element(str(second))
            if first_segment != second_segment:
                continue
            segment_list = segment_occurrences(segments, first_segment)
            first_index = element_index(first)
            second_index = element_index(second)
            for segment in segment_list:
                first_value = element_value(segment, first_index)
                second_value = element_value(segment, second_index)
                if bool(first_value) ^ bool(second_value):
                    raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, first_segment)
                    findings.append(
                        make_finding(
                            point.id,
                            point.severity,
                            first_segment,
                            f"{first}/{second}",
                            f"{first} 和 {second} 必须同时出现。",
                            f"{first} and {second} must appear together.",
                            point.id,
                            raw_segment,
                            raw_index,
                        )
                    )
                    break

        elif point.rule_type == "all_or_none":
            refs = [str(ref) for ref in point.metadata.get("refs", [])]
            if not refs:
                continue
            segment_name = segment_for_element(refs[0])
            if any(segment_for_element(ref) != segment_name for ref in refs):
                continue
            indexes = [element_index(ref) for ref in refs]
            for raw_idx, segment in enumerate(segments, start=1):
                if not segment or segment[0].upper() != segment_name.upper():
                    continue
                values = [element_value(segment, index) for index in indexes]
                if not any(values) or all(values):
                    continue
                joined = "/".join(refs)
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        segment_name,
                        joined,
                        f"{joined} 必须同时出现。",
                        f"{joined} must appear together.",
                        point.id,
                        raw_segments[raw_idx - 1],
                        raw_idx,
                    )
                )
                break

        elif point.rule_type == "conditional_dependency":
            trigger = point.metadata.get("trigger", "")
            required = point.metadata.get("required", "")
            trigger_segment = segment_for_element(str(trigger))
            required_segment = segment_for_element(str(required))
            if trigger_segment != required_segment:
                continue
            segment_list = segment_occurrences(segments, trigger_segment)
            trigger_index = element_index(trigger)
            required_index = element_index(required)
            for segment in segment_list:
                if element_value(segment, trigger_index) and not element_value(segment, required_index):
                    raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, trigger_segment)
                    findings.append(
                        make_finding(
                            point.id,
                            point.severity,
                            trigger_segment,
                            required,
                            f"当 {trigger} 存在时，{required} 必填。",
                            f"When {trigger} is present, {required} is required.",
                            point.id,
                            raw_segment,
                            raw_index,
                        )
                    )
                    break

        elif point.rule_type == "at_least_one_of":
            refs = point.metadata.get("refs", [])
            missing = True
            for ref in refs:
                ref_segment = segment_for_element(str(ref))
                ref_index = element_index(ref)
                for segment in segment_occurrences(segments, ref_segment):
                    if element_value(segment, ref_index):
                        missing = False
                        break
                if not missing:
                    break
            if missing:
                joined = " / ".join(refs)
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        "",
                        joined,
                        f"{joined} 中至少需要一个有值。",
                        f"At least one of {joined} must have a value.",
                        point.id,
                    )
                )

        elif point.rule_type == "cross_segment_match":
            left = str(point.metadata.get("left", ""))
            right = str(point.metadata.get("right", ""))
            if not left or not right:
                continue
            left_segment = segment_for_element(left)
            right_segment = segment_for_element(right)
            left_segments = segment_occurrences(segments, left_segment)
            right_segments = segment_occurrences(segments, right_segment)
            left_value = element_value(left_segments[0], element_index(left)) if left_segments else ""
            right_value = element_value(right_segments[-1], element_index(right)) if right_segments else ""
            if not left_value or not right_value or left_value != right_value:
                raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, right_segment)
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        right_segment,
                        f"{left}/{right}",
                        f"{left} 与 {right} 必须一致。",
                        f"{left} and {right} must match.",
                        point.id,
                        raw_segment,
                        raw_index,
                    )
                )

        elif point.rule_type == "numeric_lte":
            left = str(point.metadata.get("left", ""))
            right = str(point.metadata.get("right", ""))
            if not left or not right:
                continue
            segment_name = segment_for_element(left)
            if segment_name != segment_for_element(right):
                continue
            left_index = element_index(left)
            right_index = element_index(right)
            for raw_idx, segment in enumerate(segments, start=1):
                if not segment or segment[0].upper() != segment_name.upper():
                    continue
                left_value = to_number(element_value(segment, left_index))
                right_value = to_number(element_value(segment, right_index))
                if left_value is None or right_value is None:
                    continue
                if left_value <= right_value:
                    continue
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        segment_name,
                        f"{left}/{right}",
                        f"{left} 必须小于或等于 {right}。",
                        f"{left} must be less than or equal to {right}.",
                        point.id,
                        raw_segments[raw_idx - 1],
                        raw_idx,
                    )
                )
                break

        elif point.rule_type == "sum_equals":
            source = str(point.metadata.get("source", ""))
            target = str(point.metadata.get("target", ""))
            if not source or not target:
                continue
            source_segment = segment_for_element(source)
            target_segment = segment_for_element(target)
            source_index = element_index(source)
            target_index = element_index(target)
            total = 0.0
            count = 0
            for segment in segment_occurrences(segments, source_segment):
                value = to_number(element_value(segment, source_index))
                if value is None:
                    continue
                total += value
                count += 1
            target_segments = segment_occurrences(segments, target_segment)
            target_value = to_number(element_value(target_segments[0], target_index)) if target_segments else None
            if count == 0 or target_value is None:
                continue
            if abs(total - target_value) < 1e-9:
                continue
            raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, target_segment)
            findings.append(
                make_finding(
                    point.id,
                    point.severity,
                    target_segment,
                    f"{source}/{target}",
                    f"{source} 求和必须等于 {target}，当前求和 {total:g}，目标值 {target_value:g}。",
                    f"The sum of {source} must equal {target}. Got {total:g}, expected {target_value:g}.",
                    point.id,
                    raw_segment,
                    raw_index,
                )
            )

        elif point.rule_type == "unique_element":
            if not point.segment or not point.element:
                continue
            index = element_index(point.element)
            seen_values: dict[str, int] = {}
            for raw_idx, segment in enumerate(segments, start=1):
                if not segment or segment[0].upper() != point.segment.upper():
                    continue
                value = element_value(segment, index)
                if not value:
                    continue
                upper_value = value.upper()
                if upper_value in seen_values:
                    findings.append(
                        make_finding(
                            point.id,
                            point.severity,
                            point.segment,
                            point.element,
                            f"{point.element} 的值必须唯一，发现重复值 {value}。",
                            f"{point.element} must be unique. Duplicate value {value} was found.",
                            point.id,
                            raw_segments[raw_idx - 1],
                            raw_idx,
                        )
                    )
                    break
                seen_values[upper_value] = raw_idx

        elif point.rule_type == "segment_count_matches":
            st_positions = [idx for idx, segment in enumerate(segments) if segment and segment[0].upper() == "ST"]
            se_positions = [idx for idx, segment in enumerate(segments) if segment and segment[0].upper() == "SE"]
            if not st_positions or not se_positions:
                continue
            st_pos = st_positions[0]
            se_pos = se_positions[-1]
            actual_count = se_pos - st_pos + 1 if se_pos >= st_pos else 0
            se_segment = segments[se_pos]
            expected = element_value(se_segment, element_index("SE01"))
            if not expected or not expected.isdigit() or int(expected) != actual_count:
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        "SE",
                        "SE01",
                        f"SE01 必须等于 ST 到 SE 的实际段数，当前期望 {actual_count}。",
                        f"SE01 must equal the actual segment count from ST through SE. Expected {actual_count}.",
                        point.id,
                        raw_segments[se_pos],
                        se_pos + 1,
                    )
                )

        elif point.rule_type == "basic_loop_requirement":
            level = str(point.metadata.get("level", "")).upper()
            required_segments = [str(item).upper() for item in point.metadata.get("segments", [])]
            loop_chunks = [chunk for chunk_level, chunk in hl_chunks(segments) if chunk_level == level]
            if not loop_chunks:
                raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, "HL")
                findings.append(
                    make_finding(
                        point.id,
                        point.severity,
                        "HL",
                        level,
                        f"缺少 {level} 层级，无法满足循环规则。",
                        f"Required HL level {level} is missing, so the loop rule cannot be validated.",
                        point.id,
                        raw_segment,
                        raw_index,
                    )
                )
                continue
            for chunk in loop_chunks:
                tags = {segment[0].upper() for segment in chunk if segment}
                if any(required_segment not in tags for required_segment in required_segments):
                    first_chunk_segment = chunk[0] if chunk else []
                    raw_segment = ""
                    raw_index = 0
                    if first_chunk_segment in segments:
                        idx = segments.index(first_chunk_segment)
                        raw_segment = raw_segments[idx]
                        raw_index = idx + 1
                    findings.append(
                        make_finding(
                            point.id,
                            point.severity,
                            "HL",
                            level,
                            f"{level} 层级缺少必需段 {' / '.join(required_segments)}。",
                            f"HL level {level} is missing one or more required segments: {' / '.join(required_segments)}.",
                            point.id,
                            raw_segment,
                            raw_index,
                        )
                    )
                    break

    return findings
