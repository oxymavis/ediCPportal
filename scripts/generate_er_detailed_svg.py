#!/usr/bin/env python3
"""
生成带每表字段及主外键信息的详细 ER 图（矢量 SVG）。
表结构从 backend/app/models/models.py 提取。
"""
import os
import xml.sax.saxutils as sax

# 表名 -> [(列名, 类型简写, 是否主键, 是否唯一, 外键引用 "table.col" 或 None)]
SCHEMA = {
    "users": [
        ("id", "string(64)", True, False, None),
        ("email", "string(255)", False, True, None),
        ("name", "string(120)", False, False, None),
        ("password_hash", "string(255)", False, False, None),
        ("password_algo", "string(16)", False, False, None),
        ("email_verified", "boolean", False, False, None),
        ("created_at", "datetime", False, False, None),
        ("updated_at", "datetime", False, False, None),
    ],
    "sessions": [
        ("id", "string(128)", True, False, None),
        ("user_id", "string(64)", False, False, "users.id"),
        ("expires_at", "datetime", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "email_verification_tokens": [
        ("token", "string(128)", True, False, None),
        ("user_id", "string(64)", False, False, "users.id"),
        ("expires_at", "datetime", False, False, None),
        ("used", "boolean", False, False, None),
    ],
    "partners": [
        ("id", "string(64)", True, False, None),
        ("name", "string(120)", False, False, None),
        ("code", "string(20)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("industry", "string(50)", False, False, None),
        ("website", "string(255)", False, False, None),
        ("contact_name", "string(120)", False, False, None),
        ("contact_email", "string(255)", False, False, None),
        ("contact_phone", "string(30)", False, False, None),
        ("integration_type", "string(16)", False, False, None),
        ("communication_channel", "string(20)", False, False, None),
        ("current_step_id", "int", False, False, None),
        ("onboarding_start_date", "string(10)", False, False, None),
        ("step_completion_dates", "json", False, False, None),
        ("api_config", "json", False, False, None),
        ("environment", "string(20)", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "subsidiaries": [
        ("id", "string(64)", True, False, None),
        ("partner_id", "string(64)", False, False, "partners.id"),
        ("name", "string(120)", False, False, None),
        ("code", "string(30)", False, False, None),
        ("region", "string(80)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("supported_doc_types_x12", "json", False, False, None),
        ("supported_doc_types_edifact", "json", False, False, None),
        ("message_routing", "json", False, False, None),
    ],
    "as2_profiles": [
        ("id", "string(64)", True, False, None),
        ("subsidiary_id", "string(64)", False, False, "subsidiaries.id"),
        ("name", "string(120)", False, False, None),
        ("as2_id", "string(128)", False, False, None),
        ("as2_url", "string(255)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("encryption_cert", "string(255)", False, False, None),
        ("signing_cert", "string(255)", False, False, None),
        ("mdn_required", "boolean", False, False, None),
        ("mdn_signed", "boolean", False, False, None),
        ("encryption_algorithm", "string(30)", False, False, None),
        ("signature_algorithm", "string(30)", False, False, None),
    ],
    "certificates": [
        ("id", "int", True, False, None),
        ("name", "string(255)", False, False, None),
        ("serial_number", "string(255)", False, False, None),
        ("fingerprint", "string(255)", False, False, None),
        ("issuer", "string(255)", False, False, None),
        ("subject", "string(255)", False, False, None),
        ("algorithm", "string(50)", False, False, None),
        ("key_size", "string(20)", False, False, None),
        ("created", "string(10)", False, False, None),
        ("expires", "string(10)", False, False, None),
        ("usage", "string(50)", False, False, None),
        ("type", "string(50)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("partner", "string(120)", False, False, None),
        ("environment", "string(20)", False, False, None),
        ("file_path", "string(500)", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "transactions": [
        ("id", "string(80)", True, False, None),
        ("type", "string(20)", False, False, None),
        ("doc_type", "string(20)", False, False, None),
        ("type_name", "string(120)", False, False, None),
        ("partner", "string(120)", False, False, None),
        ("direction", "string(16)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("date", "string(10)", False, False, None),
        ("time", "string(8)", False, False, None),
        ("size", "string(20)", False, False, None),
        ("records", "int", False, False, None),
        ("control_number", "string(50)", False, False, None),
        ("sender_id", "string(50)", False, False, None),
        ("receiver_id", "string(50)", False, False, None),
        ("integration_type", "string(16)", False, False, None),
        ("channel", "string(20)", False, False, None),
        ("source_system", "string(20)", False, False, None),
        ("external_event_id", "string(120)", False, False, None),
        ("idempotency_key", "string(120)", False, True, None),
        ("business_refs", "json", False, False, None),
        ("control_refs", "json", False, False, None),
        ("occurred_at", "datetime", False, False, None),
        ("raw", "text", False, False, None),
        ("logs", "json", False, False, None),
        ("errors", "json", False, False, None),
        ("environment", "string(20)", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "transaction_links": [
        ("id", "int", True, False, None),
        ("from_transaction_id", "string(80)", False, False, "transactions.id"),
        ("to_transaction_id", "string(80)", False, False, "transactions.id"),
        ("relation_type", "string(20)", False, False, None),
        ("match_rule", "string(120)", False, False, None),
        ("confidence", "int", False, False, None),
        ("evidence", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "notifications": [
        ("id", "int", True, False, None),
        ("type", "string(16)", False, False, None),
        ("title", "string(255)", False, False, None),
        ("message", "text", False, False, None),
        ("date", "string(10)", False, False, None),
        ("time", "string(8)", False, False, None),
        ("read", "boolean", False, False, None),
        ("archived", "boolean", False, False, None),
        ("environment", "string(20)", False, False, None),
        ("action", "json", False, False, None),
        ("details", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "unis_specifications": [
        ("id", "int", True, False, None),
        ("code", "string(10)", False, True, None),
        ("name", "string(120)", False, False, None),
        ("description", "text", False, False, None),
        ("category", "string(80)", False, False, None),
        ("version", "string(30)", False, False, None),
        ("last_updated", "string(10)", False, False, None),
    ],
    "tp_specifications": [
        ("id", "string(64)", True, False, None),
        ("message_type", "string(20)", False, False, None),
        ("message_name", "string(120)", False, False, None),
        ("partner", "string(120)", False, False, None),
        ("partner_code", "string(30)", False, False, None),
        ("version", "string(30)", False, False, None),
        ("uploaded_date", "string(10)", False, False, None),
        ("uploaded_by", "string(255)", False, False, None),
        ("file_type", "string(20)", False, False, None),
        ("file_name", "string(255)", False, False, None),
        ("size", "string(20)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("file_path", "string(500)", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "integration_clients": [
        ("id", "string(64)", True, False, None),
        ("name", "string(120)", False, False, None),
        ("api_key_hash", "string(128)", False, True, None),
        ("status", "string(16)", False, False, None),
        ("allowed_sources", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
        ("last_used_at", "datetime", False, False, None),
    ],
    "api_clients": [
        ("client_id", "string(80)", True, False, None),
        ("name", "string(120)", False, False, None),
        ("secret_hash", "string(255)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("scopes", "json", False, False, None),
        ("environment", "string(20)", False, False, None),
        ("created_at", "datetime", False, False, None),
        ("last_used_at", "datetime", False, False, None),
    ],
    "oauth_tokens": [
        ("jti", "string(80)", True, False, None),
        ("client_id", "string(80)", False, False, "api_clients.client_id"),
        ("expires_at", "datetime", False, False, None),
        ("revoked", "boolean", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "api_call_logs": [
        ("id", "int", True, False, None),
        ("trace_id", "string(64)", False, False, None),
        ("client_id", "string(80)", False, False, None),
        ("method", "string(10)", False, False, None),
        ("path", "string(255)", False, False, None),
        ("status_code", "int", False, False, None),
        ("latency_ms", "int", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "api_quotas": [
        ("id", "int", True, False, None),
        ("client_id", "string(80)", False, False, None),
        ("period", "string(10)", False, False, None),
        ("period_key", "string(20)", False, False, None),
        ("count", "int", False, False, None),
        ("updated_at", "datetime", False, False, None),
    ],
    "api_messages": [
        ("code", "string(20)", True, False, None),
        ("name", "string(120)", False, False, None),
        ("category", "string(80)", False, False, None),
        ("x12_equivalent", "string(20)", False, False, None),
        ("version", "string(30)", False, False, None),
        ("created_at", "datetime", False, False, None),
        ("updated_at", "datetime", False, False, None),
    ],
    "api_message_schemas": [
        ("id", "int", True, False, None),
        ("message_code", "string(20)", False, False, "api_messages.code"),
        ("version", "string(30)", False, False, None),
        ("schema", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "api_message_samples": [
        ("id", "int", True, False, None),
        ("message_code", "string(20)", False, False, "api_messages.code"),
        ("sample_type", "string(16)", False, False, None),
        ("content", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "api_message_mappings": [
        ("id", "int", True, False, None),
        ("message_code", "string(20)", False, False, "api_messages.code"),
        ("json_field", "string(255)", False, False, None),
        ("x12_segment", "string(50)", False, False, None),
        ("x12_element", "string(50)", False, False, None),
        ("notes", "string(500)", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "connection_test_runs": [
        ("id", "string(64)", True, False, None),
        ("partner_id", "string(64)", False, False, None),
        ("test_type", "string(16)", False, False, None),
        ("environment", "string(20)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("summary", "json", False, False, None),
        ("started_at", "datetime", False, False, None),
        ("finished_at", "datetime", False, False, None),
        ("trace_id", "string(64)", False, False, None),
    ],
    "connection_test_steps": [
        ("id", "int", True, False, None),
        ("run_id", "string(64)", False, False, "connection_test_runs.id"),
        ("step_no", "int", False, False, None),
        ("name", "string(80)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("latency_ms", "int", False, False, None),
        ("detail", "string(500)", False, False, None),
        ("evidence", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "document_test_reports": [
        ("id", "string(64)", True, False, None),
        ("partner_id", "string(64)", False, False, None),
        ("environment", "string(20)", False, False, None),
        ("message_type", "string(20)", False, False, None),
        ("status", "string(16)", False, False, None),
        ("errors", "json", False, False, None),
        ("payload", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
    "validator_reports": [
        ("id", "string(64)", True, False, None),
        ("format", "string(16)", False, False, None),
        ("valid", "boolean", False, False, None),
        ("errors", "json", False, False, None),
        ("warnings", "json", False, False, None),
        ("created_at", "datetime", False, False, None),
    ],
}

ROW_H = 18
HEADER_H = 24
CELL_PAD = 6
FONT_SIZE = 10
COL_WIDTH = 260  # 列名+类型+PK/FK 足够宽


def esc(s):
    return sax.escape(str(s))


def col_label(col_name, typ, pk, uk, fk_ref):
    parts = [esc(col_name), " ", esc(typ)]
    if pk:
        parts.append(" PK")
    if uk and not pk:
        parts.append(" UK")
    if fk_ref:
        parts.append(" FK→" + esc(fk_ref))
    return "".join(parts)


def measure_box(table_name, rows):
    w = max(COL_WIDTH, len(table_name) * 7)
    h = HEADER_H + len(rows) * ROW_H
    return w, h


def main():
    tables_order = list(SCHEMA.keys())
    # 布局：按域分块，5 列
    positions = {}
    box_sizes = {}
    for t in tables_order:
        rows = SCHEMA[t]
        w, h = measure_box(t, rows)
        box_sizes[t] = (w, h)

    # 网格布局：5 列，每行高度取该行最大框高
    col_w = max(box_sizes[t][0] for t in tables_order) + 40
    y = 60
    row_idx = -1
    for i, t in enumerate(tables_order):
        col_idx = i % 5
        if col_idx == 0:
            row_idx += 1
            row_tables = tables_order[i : i + 5]
            max_h = max(box_sizes[t][1] for t in row_tables)
            if i > 0:
                y += max_h + 28
            row_y = y
        x = 30 + col_idx * (col_w + 20)
        positions[t] = (x, row_y)
    last_row = tables_order[5 * row_idx :]
    max_h_last = max(box_sizes[t][1] for t in last_row) if last_row else 0
    height = y + max_h_last + 40
    width = 30 + 5 * (col_w + 20)

    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">'
    )
    lines.append("  <style>")
    lines.append("    .table-header { fill: #1565c0; font: bold 11px sans-serif; fill: white; }")
    lines.append("    .table-row { font: 10px monospace; fill: #333; }")
    lines.append("    .table-box { stroke: #1565c0; stroke-width: 1.5; fill: #fafbfc; rx: 4; }")
    lines.append("    .table-header-rect { fill: #1565c0; rx: 4; }")
    lines.append("    .link { stroke: #666; stroke-width: 1; fill: none; stroke-dasharray: 4,2; }")
    lines.append("  </style>")
    lines.append(
        f'  <text x="30" y="28" font-size="16" font-weight="bold" fill="#1565c0">EDI Portal 数据库详细 ER 图（25 表 · 每表字段及主外键）</text>'
    )

    # 外键关系线：(from_table, from_col_ref) -> (to_table, to_col)
    fk_list = []
    for t in tables_order:
        for col_name, typ, pk, uk, fk_ref in SCHEMA[t]:
            if fk_ref:
                ref_table, ref_col = fk_ref.split(".", 1)
                fk_list.append((t, ref_table, col_name, ref_col))

    # 画关系线（从子表框底到父表框顶）
    for from_t, to_t, from_col, to_col in fk_list:
        if from_t not in positions or to_t not in positions:
            continue
        x1 = positions[from_t][0] + box_sizes[from_t][0] // 2
        y1 = positions[from_t][1] + box_sizes[from_t][1]
        x2 = positions[to_t][0] + box_sizes[to_t][0] // 2
        y2 = positions[to_t][1]
        mid_y = (y1 + y2) / 2
        lines.append(
            f'  <path d="M {x1} {y1} L {x1} {mid_y} L {x2} {mid_y} L {x2} {y2}" class="link"/>'
        )

    # 画每个表框
    for t in tables_order:
        x, y = positions[t]
        w, h = box_sizes[t]
        lines.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" class="table-box"/>')
        lines.append(
            f'  <rect x="{x}" y="{y}" width="{w}" height="{HEADER_H}" class="table-header-rect"/>'
        )
        lines.append(f'  <text x="{x + CELL_PAD}" y="{y + HEADER_H - 6}" class="table-header">{t}</text>')
        for i, (col_name, typ, pk, uk, fk_ref) in enumerate(SCHEMA[t]):
            row_y = y + HEADER_H + (i + 1) * ROW_H - 5
            label = col_label(col_name, typ, pk, uk, fk_ref)
            # 过长则截断
            if len(label) > 48:
                label = label[:45] + "..."
            lines.append(f'  <text x="{x + CELL_PAD}" y="{row_y}" class="table-row">{esc(label)}</text>')

    lines.append("</svg>")
    return "\n".join(lines)


if __name__ == "__main__":
    out = main()
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base, "docs", "ER-diagram-detailed.svg")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(out)
    print("Written:", path)
