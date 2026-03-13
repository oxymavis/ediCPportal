#!/usr/bin/env python3
"""Generate ER diagram SVG from backend models (vector format)."""
import textwrap

# 25 tables, relationships from models
TABLES = [
    "users", "sessions", "email_verification_tokens", "partners", "subsidiaries",
    "as2_profiles", "certificates", "transactions", "transaction_links", "notifications",
    "unis_specifications", "tp_specifications", "integration_clients", "api_clients",
    "oauth_tokens", "api_call_logs", "api_quotas", "api_messages", "api_message_schemas",
    "api_message_samples", "api_message_mappings", "connection_test_runs",
    "connection_test_steps", "document_test_reports", "validator_reports",
]
RELATIONSHIPS = [
    ("users", "sessions", "user_id"),
    ("users", "email_verification_tokens", "user_id"),
    ("partners", "subsidiaries", "partner_id"),
    ("subsidiaries", "as2_profiles", "subsidiary_id"),
    ("transactions", "transaction_links", "from_transaction_id"),
    ("transactions", "transaction_links", "to_transaction_id"),
    ("api_clients", "oauth_tokens", "client_id"),
    ("api_messages", "api_message_schemas", "message_code"),
    ("api_messages", "api_message_samples", "message_code"),
    ("api_messages", "api_message_mappings", "message_code"),
    ("connection_test_runs", "connection_test_steps", "run_id"),
]

BOX_W, BOX_H = 160, 28
MARGIN = 40
COLS = 5
FONT_SIZE = 11
TITLE_SIZE = 14

def px(v):
    return f"{v}"

def main():
    # layout: grid of boxes
    positions = {}
    for i, t in enumerate(TABLES):
        row, col = i // COLS, i % COLS
        x = MARGIN + col * (BOX_W + 50)
        y = MARGIN + 50 + row * (BOX_H + 24)
        positions[t] = (x, y)

    # canvas size
    max_x = max(x + BOX_W for x, _ in positions.values()) + MARGIN
    max_y = max(y + BOX_H for _, y in positions.values()) + MARGIN + 30
    width, height = max_x, max_y

    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">')
    lines.append('  <style>')
    lines.append('    .table-box { fill: #f0f4f8; stroke: #1565c0; stroke-width: 1.5; rx: 4; }')
    lines.append('    .table-title { font: bold 11px sans-serif; fill: #1565c0; }')
    lines.append('    .link { stroke: #666; stroke-width: 1; fill: none; }')
    lines.append('    .link-label { font: 9px sans-serif; fill: #333; }')
    lines.append('  </style>')
    lines.append(f'  <text x="{MARGIN}" y="{MARGIN}" class="table-title" font-size="{TITLE_SIZE}">EDI Portal 数据库 ER 图（25 张表）</text>')

    # relationship lines (simplified: from center of one box to center of another)
    for a, b, label in RELATIONSHIPS:
        if a not in positions or b not in positions:
            continue
        x1, y1 = positions[a][0] + BOX_W // 2, positions[a][1] + BOX_H
        x2, y2 = positions[b][0] + BOX_W // 2, positions[b][1]
        mid_y = (y1 + y2) / 2
        lines.append(f'  <path d="M {px(x1)} {px(y1)} L {px(x1)} {px(mid_y)} L {px(x2)} {px(mid_y)} L {px(x2)} {px(y2)}" class="link"/>')
        lines.append(f'  <text x="{px((x1+x2)/2)}" y="{px(mid_y - 2)}" text-anchor="middle" class="link-label">{label}</text>')

    # table boxes
    for t, (x, y) in positions.items():
        lines.append(f'  <rect x="{px(x)}" y="{px(y)}" width="{BOX_W}" height="{BOX_H}" class="table-box"/>')
        lines.append(f'  <text x="{px(x + BOX_W/2)}" y="{px(y + BOX_H/2 + 4)}" text-anchor="middle" class="table-title">{t}</text>')

    lines.append('</svg>')
    return "\n".join(lines)

if __name__ == "__main__":
    out = main()
    out_path = "docs/ER-diagram.svg"
    import os
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base, out_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(out)
    print("Written:", path)
