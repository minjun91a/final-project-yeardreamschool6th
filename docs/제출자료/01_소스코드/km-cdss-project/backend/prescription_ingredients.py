"""Keep corporate reference doses separate from clinician-entered doses."""
import re
from decimal import Decimal

from fastapi import HTTPException
from pydantic import BaseModel, model_validator


class Ingredient(BaseModel):
    model_config = {"extra": "forbid", "strict": True}
    compositionId: int | None
    id: int | None
    name: str
    amount: str | None
    unit: str | None
    preparation: str | None
    originalDoseInfo: str | None
    prescribedAmount: str | None = None
    prescribedUnit: str | None = None

    @model_validator(mode="after")
    def validate_prescribed_dose(self):
        self.prescribedAmount = (self.prescribedAmount or "").strip() or None
        self.prescribedUnit = (self.prescribedUnit or "").strip() or None
        if (self.prescribedAmount is None) != (self.prescribedUnit is None):
            raise ValueError("실제 처방량과 단위를 함께 입력해주세요.")
        if self.prescribedAmount is not None:
            if (len(self.prescribedAmount) > 32
                    or not re.fullmatch(r"(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)", self.prescribedAmount)
                    or Decimal(self.prescribedAmount) <= 0):
                raise ValueError("실제 처방량은 0보다 큰 수치로 입력해주세요.")
            if len(self.prescribedUnit) > 32 or any(ord(c) < 32 for c in self.prescribedUnit):
                raise ValueError("실제 처방량 단위를 확인해주세요.")
        return self


def validate_ingredient_copy(ingredient, originals, seen):
    """Validate immutable source fields, then add explicitly entered dosing fields."""
    reference = ingredient.model_dump()
    dose = {key: reference.pop(key) for key in ("prescribedAmount", "prescribedUnit")}
    reference["name"] = reference["name"].strip()
    if not reference["name"]:
        raise HTTPException(400, "약재명을 입력해야 합니다.")
    composition_id = reference["compositionId"]
    if composition_id is not None:
        if composition_id in seen or originals.get(composition_id) != reference:
            raise HTTPException(400, "복사한 약재 구성은 저장된 원본과 일치해야 합니다.")
        seen.add(composition_id)
    elif any(reference[key] is not None for key in ("amount", "unit", "preparation", "originalDoseInfo")):
        raise HTTPException(400, "직접 입력 약재에는 확인되지 않은 원본 정보를 넣을 수 없습니다.")
    # Legacy payloads remain byte-for-byte equivalent when no actual dose is entered.
    return {**reference, **dose} if dose["prescribedAmount"] is not None else reference
