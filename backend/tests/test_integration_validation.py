from __future__ import annotations

from uuid import uuid4

from app.services.integration_validation.generic_validator import validate_generic
from app.services.integration_validation.rule_extractor import compile_points


def _auth(client):
    email = f"validation-{uuid4().hex[:8]}@example.com"
    res = client.post(
        "/v1/auth/register",
        json={
            "name": "Validation User",
            "email": email,
            "password": "Password1",
            "confirmPassword": "Password1",
        },
    )
    assert res.status_code == 200
    csrf = client.cookies.get("edi_csrf")
    assert csrf
    return {"x-csrf-token": csrf}


def test_upload_spec_and_validate_message(client):
    headers = _auth(client)
    spec_text = "\n".join(
        [
            "BSN segment is required",
            "BSN03 must use CCYYMMDD format",
            "DTM*011 required",
            "LIN02 must be one of IN / VP",
        ]
    )
    upload = client.post(
        "/v1/integration-validation/spec/upload",
        headers=headers,
        files=[("specFiles", ("sample-spec.md", spec_text.encode("utf-8"), "text/markdown"))],
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["success"] is True
    spec_id = body["data"]["specId"]
    assert body["data"]["summary"]["totalPoints"] >= 3

    validate = client.post(
        "/v1/integration-validation/validate",
        headers=headers,
        json={
            "specId": spec_id,
            "ediMessage": "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*U*00401*000000001*0*P*>~GS*SH*SENDER*RECEIVER*20240101*1200*1*X*004010~ST*856*0001~SE*2*0001~GE*1*1~IEA*1*000000001~",
        },
    )
    assert validate.status_code == 200
    result = validate.json()
    assert result["success"] is True
    assert result["data"]["summary"]["total"] >= 1
    assert any(item["code"] for item in result["data"]["findings"])

    report = client.get(result["data"]["downloadUrl"])
    assert report.status_code == 200
    assert report.headers["content-type"].startswith("text/markdown")


def test_compile_points_from_compact_spec_lines():
    spec_text = "\n".join(
        [
            "Functional Group= SW",
            "ST01329Transaction Set Identifier CodeMID3/3Must use",
            "Code List Summary (Total Codes: 298, Included: 1)",
            "Code Name",
            "945Warehouse Shipping Advice",
            "W0603373DateOAN1/22Must use",
            "Description: Date in CCYYMMDD",
            "At least one of N102 or N103 is required.",
            "If either W0607 or W0608 is present, then the other is required.",
            "If either W1210, W1211 or W1212 are present, then the others are required.",
        ]
    )
    points = compile_points("warehouse-945.md", spec_text)
    compiled = [point for point in points if point.compiled]

    assert any(point.rule_type == "element_equals" and point.element == "GS01" and point.expected == ["SW"] for point in compiled)
    assert any(point.rule_type == "element_equals" and point.element == "ST01" and point.expected == ["945"] for point in compiled)
    assert any(point.rule_type == "date_format" and point.element == "W0603" for point in compiled)
    assert any(point.rule_type == "at_least_one_of" and point.metadata.get("refs") == ["N102", "N103"] for point in compiled)
    assert any(point.rule_type == "paired_elements" and point.metadata.get("first") == "W0607" and point.metadata.get("second") == "W0608" for point in compiled)
    assert any(point.rule_type == "all_or_none" and point.metadata.get("refs") == ["W1210", "W1211", "W1212"] for point in compiled)


def test_generic_validator_supports_cross_segment_and_all_or_none_rules():
    spec_text = "\n".join(
        [
            "ST02329Transaction Set Control NumberMAN4/9Must use",
            "SE02329Transaction Set Control NumberMAN4/9Must use",
            "SE0196Number of Included SegmentsMN01/10Must use",
            "If either W1210, W1211 or W1212 are present, then the others are required.",
        ]
    )
    points = compile_points("cross-rules.md", spec_text)
    findings = validate_generic(
        "ISA*00*          *00*          *ZZ*SENDER*ZZ*RECEIVER*240101*1200*U*00401*000000001*0*P*>~"
        "GS*SW*SENDER*RECEIVER*20240101*1200*1*X*004010~"
        "ST*945*0001~"
        "W12*CC*10*9**EA*****100~"
        "SE*2*9999~"
        "GE*1*1~IEA*1*000000001~",
        points,
    )

    codes = {finding.code for finding in findings}
    assert any("W1210/W1211/W1212" in finding.element for finding in findings)
    assert any("ST02/SE02" in finding.element for finding in findings)
    assert "cross-rules-segment-count" in codes


def test_945_business_cross_rules_are_generated_and_validated():
    spec_text = "\n".join(
        [
            "ST01329Transaction Set Identifier CodeMID3/3Must use",
            "Code List Summary (Total Codes: 298, Included: 1)",
            "Code Name",
            "945Warehouse Shipping Advice",
            "N1NameHeading - Mandatory",
            "N10198Entity Identifier CodeMID2/3Must use",
            "Code List Summary (Total Codes: 1312, Included: 2)",
            "Code Name",
            "SFShip From",
            "STShip To",
            "W0603373DateOAN1/22Must use",
            "Description: Date in CCYYMMDD",
            "G6202373DateXDT8/8Must use",
            "Description: Date expressed as CCYYMMDD",
            "W1202330QUANTITY ORDEREDOR1/15Must use",
            "W1203382Number of Units ShippedOR1/10Must use",
            "W121081WeightOR1/10Must use",
            "W03Summary Area",
            "W301382Number of Units ShippedRID1/10Must use",
            "W30281WeightOR1/10Must use",
            "LX01554Assigned NumberMN01/6Must use",
            "MAN0287Marks and NumbersMAN1/48Must use",
        ]
    )
    points = compile_points("unis-945.md", spec_text)
    compiled = [point for point in points if point.compiled]

    assert any(point.rule_type == "qualified_segment_required" and point.segment == "N1" and point.qualifier == "SF" for point in compiled)
    assert any(point.rule_type == "qualified_segment_required" and point.segment == "N1" and point.qualifier == "ST" for point in compiled)
    assert any(point.rule_type == "cross_segment_match" and point.metadata.get("left") == "W0603" and point.metadata.get("right") == "G6202" for point in compiled)
    assert any(point.rule_type == "numeric_lte" and point.metadata.get("left") == "W1203" and point.metadata.get("right") == "W1202" for point in compiled)
    assert any(point.rule_type == "sum_equals" and point.metadata.get("source") == "W1203" and point.metadata.get("target") == "W301" for point in compiled)
    assert any(point.rule_type == "sum_equals" and point.metadata.get("source") == "W1210" and point.metadata.get("target") == "W302" for point in compiled)
    assert any(point.rule_type == "unique_element" and point.element == "LX01" for point in compiled)
    assert any(point.rule_type == "unique_element" and point.element == "MAN02" for point in compiled)

    edi = (
        "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *240101*1200*U*00401*000000001*0*P*>~"
        "GS*SW*SENDER*RECEIVER*20240101*1200*1*X*004010~"
        "ST*945*0001~"
        "W06*F*ORD1*20240222*SHIP1**PO1~"
        "N1*SF*ShipFrom~"
        "N1*ST*ShipTo~"
        "G62*11*20240223~"
        "LX*1~"
        "MAN*GM*SSCC1~"
        "LX*1~"
        "MAN*GM*SSCC1~"
        "W12*CC*10*12**EA*123456789012*VA*ITEM1**2.5*G*L*****UK*SKU1~"
        "W12*CC*10*4**EA*123456789013*VA*ITEM2**1.0*G*L*****UK*SKU2~"
        "W03*20*5~"
        "SE*13*0001~"
        "GE*1*1~IEA*1*000000001~"
    )
    findings = validate_generic(edi, points)
    finding_elements = {finding.element for finding in findings}
    assert "W0603/G6202" in finding_elements
    assert "W1203/W1202" in finding_elements
    assert "W1203/W301" in finding_elements
    assert "W1210/W302" in finding_elements
    assert "LX01" in finding_elements
    assert "MAN02" in finding_elements
