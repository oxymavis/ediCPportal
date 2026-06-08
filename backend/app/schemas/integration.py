from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class BusinessRefs(BaseModel):
    orderNo: str | None = None
    poNo: str | None = None
    shipmentNo: str | None = None
    loadNo: str | None = None
    bolNo: str | None = None
    warehouseOrderNo: str | None = None


class ControlRefs(BaseModel):
    isaControlNo: str | None = None
    gsControlNo: str | None = None
    stControlNo: str | None = None


class IntegrationEvent(BaseModel):
    idempotencyKey: str = Field(min_length=8, max_length=120)
    sourceSystem: Literal['edi', 'oms', 'wms', 'tms']
    environment: Literal['production', 'sandbox']
    partner: str = Field(min_length=1, max_length=120)
    docType: str = Field(min_length=2, max_length=20)
    direction: Literal['inbound', 'outbound']
    status: str = Field(min_length=1, max_length=20)
    occurredAt: datetime
    businessRefs: BusinessRefs = Field(default_factory=BusinessRefs)
    controlRefs: ControlRefs = Field(default_factory=ControlRefs)
    externalEventId: str | None = Field(default=None, max_length=120)
    rawPayload: dict[str, Any] = Field(default_factory=dict)


class IntegrationEventResult(BaseModel):
    success: bool
    transactionId: str | None = None
    error: str | None = None
    code: str | None = None
    linking: dict[str, Any] | None = None


class TransactionPushRequest(BaseModel):
    idempotencyKey: str = Field(min_length=8, max_length=120)
    sourceSystem: Literal['edi', 'oms', 'wms', 'tms']
    environment: Literal['production', 'sandbox']
    partner: str = Field(min_length=1, max_length=120)
    docType: str = Field(min_length=2, max_length=20)
    direction: Literal['inbound', 'outbound']
    status: str = Field(min_length=1, max_length=80)
    occurredAt: datetime
    businessRefs: BusinessRefs = Field(default_factory=BusinessRefs)
    controlRefs: ControlRefs = Field(default_factory=ControlRefs)
    externalEventId: str | None = Field(default=None, max_length=120)
    payloadFormat: Literal['x12', 'json', 'xml', 'text'] = 'json'
    rawContent: str = Field(min_length=1)
    rawPayload: dict[str, Any] = Field(default_factory=dict)


class SystemEventError(BaseModel):
    code: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    field: str | None = Field(default=None, max_length=255)
    severity: Literal['warning', 'error', 'fatal'] = 'error'
    retryable: bool = False
    details: dict[str, Any] = Field(default_factory=dict)


class TransactionSystemEventRequest(BaseModel):
    idempotencyKey: str = Field(min_length=8, max_length=120)
    system: str = Field(min_length=2, max_length=80)
    stage: str = Field(min_length=2, max_length=120)
    eventType: Literal['received', 'validation', 'transformation', 'processing', 'delivery', 'acknowledgement']
    status: str = Field(min_length=1, max_length=80)
    occurredAt: datetime
    message: str | None = Field(default=None, max_length=1000)
    inputFormat: Literal['x12', 'json', 'xml', 'text'] | None = None
    inputData: Any | None = None
    outputFormat: Literal['x12', 'json', 'xml', 'text'] | None = None
    outputData: Any | None = None
    errors: list[SystemEventError] = Field(default_factory=list)
    durationMs: int | None = Field(default=None, ge=0)
    traceId: str | None = Field(default=None, max_length=120)
    attemptNo: int = Field(default=1, ge=1)
    isFinal: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
