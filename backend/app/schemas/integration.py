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
