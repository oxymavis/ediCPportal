from __future__ import annotations
from datetime import datetime
import csv
import io
import zipfile
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Transaction, TransactionLink
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope
from app.services.mappers import transaction_link_to_api, transaction_to_api

router = APIRouter(prefix='/v1/transactions', tags=['transactions'], dependencies=[Depends(get_actor), Depends(require_scope('transactions'))])


def _col_name(idx: int) -> str:
    name = ''
    n = idx + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        name = chr(65 + rem) + name
    return name


def _xlsx_bytes(headers: list[str], rows: list[list[str]]) -> bytes:
    def cell_ref(r: int, c: int) -> str:
        return f'{_col_name(c)}{r}'

    sheet_rows = []
    all_rows = [headers] + rows
    for r_idx, row in enumerate(all_rows, start=1):
        cells = []
        for c_idx, val in enumerate(row):
            escaped = (
                str(val)
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
            )
            cells.append(f'<c r="{cell_ref(r_idx, c_idx)}" t="inlineStr"><is><t>{escaped}</t></is></c>')
        sheet_rows.append(f'<row r="{r_idx}">{"".join(cells)}</row>')
    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData>'
        '</worksheet>'
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            '[Content_Types].xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '</Types>',
        )
        zf.writestr(
            '_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>',
        )
        zf.writestr(
            'xl/workbook.xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Transactions" sheetId="1" r:id="rId1"/></sheets>'
            '</workbook>',
        )
        zf.writestr(
            'xl/_rels/workbook.xml.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '</Relationships>',
        )
        zf.writestr(
            'xl/styles.xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
            '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
            '<borders count="1"><border/></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
            '</styleSheet>',
        )
        zf.writestr('xl/worksheets/sheet1.xml', sheet_xml)
    return buf.getvalue()


@router.get('')
def list_transactions(
    environment: str | None = None,
    type: str | None = None,
    status: str | None = None,
    direction: str | None = None,
    partner: str | None = None,
    dateFrom: str | None = None,
    dateTo: str | None = None,
    search: str | None = None,
    relatedDocType: str | None = None,
    relatedRef: str | None = None,
    integrationType: str | None = None,
    channel: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if environment:
        q = q.filter(Transaction.environment == environment)
    if type and type != 'all':
        q = q.filter((Transaction.type == type) | (Transaction.doc_type == type))
    if status and status != 'all':
        q = q.filter(Transaction.status == status)
    if direction and direction != 'all':
        q = q.filter(Transaction.direction == direction)
    if partner and partner != 'all':
        q = q.filter(Transaction.partner == partner)
    if integrationType and integrationType != 'all':
        q = q.filter(Transaction.integration_type == integrationType)
    if channel and channel != 'all':
        q = q.filter(Transaction.channel == channel)
    rows = q.all()

    if dateFrom:
        rows = [r for r in rows if r.date >= dateFrom]
    if dateTo:
        rows = [r for r in rows if r.date <= dateTo]
    if search:
        s = search.lower()
        rows = [r for r in rows if s in r.id.lower() or s in r.partner.lower() or s in r.control_number.lower() or s in r.sender_id.lower() or s in r.receiver_id.lower()]
    if relatedDocType:
        rows = [r for r in rows if (r.doc_type or r.type) == relatedDocType]
    if relatedRef:
        key = relatedRef.lower()
        rows = [
            r
            for r in rows
            if any(key in str(v).lower() for v in (r.business_refs or {}).values()) or any(key in str(v).lower() for v in (r.control_refs or {}).values())
        ]

    rows = sorted(rows, key=lambda r: f'{r.date}{r.time}', reverse=True)
    return ok([transaction_to_api(r) for r in rows])


@router.post('')
async def create_transaction(
    file: UploadFile | None = File(default=None),
    type: str = Form(default='850'),
    partner: str = Form(default='Unknown'),
    environment: str = Form(default='production'),
    integrationType: str = Form(default='edi'),
    channel: str = Form(default='AS2'),
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    raw = ''
    if file:
        raw = (await file.read()).decode('utf-8', errors='ignore')
    if not raw:
        raw = 'ISA*00*...~'

    trx = Transaction(
        id=f'TRX-{type}-{uuid4().hex[:10]}',
        type=type,
        doc_type=type,
        type_name=f'Document {type}',
        partner=partner,
        direction='outbound',
        status='processing',
        date=now.strftime('%Y-%m-%d'),
        time=now.strftime('%H:%M:%S'),
        size=f'{max(len(raw) / 1024, 1):.1f} KB',
        records=0,
        control_number=uuid4().hex[:10].upper(),
        sender_id='1234567890123',
        receiver_id='9876543210987',
        integration_type=integrationType,
        channel=channel,
        source_system='manual',
        external_event_id=None,
        idempotency_key=None,
        business_refs={},
        control_refs={},
        occurred_at=now,
        raw=raw[:100000],
        logs=[{'timestamp': now.isoformat(), 'level': 'info', 'message': 'Document received and queued for processing'}],
        errors=[],
        environment=environment,
    )
    db.add(trx)
    db.commit()
    db.refresh(trx)
    return ok(transaction_to_api(trx))


@router.get('/export')
def export_transactions(
    format: str = 'csv',
    environment: str | None = None,
    db: Session = Depends(get_db),
):
    rows = db.query(Transaction)
    if environment:
        rows = rows.filter(Transaction.environment == environment)
    data = rows.order_by(Transaction.date.desc(), Transaction.time.desc()).all()
    headers = [
        'id', 'docType', 'typeName', 'partner', 'status', 'direction', 'environment',
        'integrationType', 'channel', 'date', 'time', 'controlNumber',
    ]

    rows = [
        [
            r.id, r.doc_type or r.type, r.type_name, r.partner, r.status, r.direction, r.environment,
            r.integration_type or '', r.channel or '', r.date, r.time, r.control_number,
        ]
        for r in data
    ]
    if format == 'xlsx':
        body = _xlsx_bytes(headers, rows)
        return StreamingResponse(
            iter([body]),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment; filename="transactions.xlsx"'},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="transactions.csv"'},
    )


@router.get('/{trx_id}')
def get_transaction(trx_id: str, db: Session = Depends(get_db)):
    t = db.query(Transaction).filter(Transaction.id == trx_id).first()
    if not t:
        return fail('Transaction not found', 'TRX_NOT_FOUND')
    return ok(transaction_to_api(t))


@router.get('/{trx_id}/related')
def get_related_transactions(trx_id: str, db: Session = Depends(get_db)):
    trx = db.query(Transaction).filter(Transaction.id == trx_id).first()
    if not trx:
        return fail('Transaction not found', 'TRX_NOT_FOUND')

    upstream_links = db.query(TransactionLink).filter(TransactionLink.from_transaction_id == trx_id).all()
    downstream_links = db.query(TransactionLink).filter(TransactionLink.to_transaction_id == trx_id).all()

    upstream = []
    for link in upstream_links:
        related = db.query(Transaction).filter(Transaction.id == link.to_transaction_id).first()
        if related:
            upstream.append(transaction_link_to_api(link, related))

    downstream = []
    for link in downstream_links:
        related = db.query(Transaction).filter(Transaction.id == link.from_transaction_id).first()
        if related:
            downstream.append(transaction_link_to_api(link, related))

    return ok({'upstream': upstream, 'downstream': downstream})
