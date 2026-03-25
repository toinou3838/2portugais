from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TranslationIn(BaseModel):
    text: str = Field(min_length=1, max_length=255)
    direction: Literal["fr_to_pt", "pt_to_fr"]


class TranslationOut(BaseModel):
    original_text: str
    translated_text: str
    direction: Literal["fr_to_pt", "pt_to_fr"]
    provider: str
    confidence: float
    found: bool

