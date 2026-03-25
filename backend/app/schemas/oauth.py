from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DeveloperClientCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    scopes: list[str] = Field(min_length=1)
    environment: Literal['production', 'sandbox', 'all'] = 'sandbox'


class DeveloperClientStatusRequest(BaseModel):
    status: Literal['active', 'disabled']
