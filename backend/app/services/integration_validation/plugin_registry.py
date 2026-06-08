from __future__ import annotations

from typing import Callable, Dict, List

from .edi_parser import parse_edi_with_raw, raw_segment_by_tag
from .schemas import DetectedProfile, ValidationFinding

from .plugins.validate_amazon_856_spec import validate_amazon_856
from .plugins.validate_burlington_856_spec import validate_burlington_856
from .plugins.validate_delhaize_856_spec import validate_delhaize_856
from .plugins.validate_doitbest_856_spec import validate_doitbest_856
from .plugins.validate_fleet_farm_856_spec import validate_fleet_farm_856
from .plugins.validate_sps_commerce_856_spec import validate_sps_commerce_856
from .plugins.validate_walmart_856_spec import validate_walmart_856


ValidatorFn = Callable[[List[List[str]]], List[dict]]

PLUGIN_REGISTRY: Dict[str, ValidatorFn] = {
    "amazon": validate_amazon_856,
    "burlington": validate_burlington_856,
    "delhaize": validate_delhaize_856,
    "doitbest": validate_doitbest_856,
    "fleet_farm": validate_fleet_farm_856,
    "sps": validate_sps_commerce_856,
    "walmart": validate_walmart_856,
}


def plugin_available(profile: DetectedProfile | None) -> bool:
    return bool(profile and profile.plugin_key in PLUGIN_REGISTRY)


def bilingual_message(message: str, segment: str, element: str) -> tuple[str, str]:
    contains_cjk = any("\u4e00" <= char <= "\u9fff" for char in message)
    location = " ".join(part for part in [segment, element] if part).strip()
    if contains_cjk:
        return message, f"Validation issue{f' at {location}' if location else ''}: {message}"
    zh_prefix = f"{location} 校验失败：" if location else "校验失败："
    return zh_prefix + message, message


def run_plugin_validation(profile: DetectedProfile, edi_text: str) -> List[ValidationFinding]:
    validator = PLUGIN_REGISTRY.get(profile.plugin_key)
    if validator is None:
        return []
    segments, raw_segments, _separator = parse_edi_with_raw(edi_text)
    results = validator(segments)
    findings: List[ValidationFinding] = []
    for item in results:
        message = str(item.get("message", "")).strip()
        segment = str(item.get("segment", "")).strip()
        element = str(item.get("element", "")).strip()
        message_zh, message_en = bilingual_message(message, segment, element)
        raw_segment, raw_index = raw_segment_by_tag(segments, raw_segments, segment) if segment else ("", 0)
        findings.append(
            ValidationFinding(
                code=str(item.get("code", "PLUGIN")),
                severity=str(item.get("severity", "Error")),
                segment=segment,
                element=element,
                message_zh=message_zh,
                message_en=message_en,
                source="plugin",
                raw_segment=raw_segment,
                raw_segment_index=raw_index,
            )
        )
    return findings
