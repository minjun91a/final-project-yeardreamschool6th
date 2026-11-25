"""Dose validation without a database or model runtime."""
import json
import sys
import unittest
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prescription_ingredients import Ingredient, validate_ingredient_copy


ORIGINAL = {"compositionId": 1, "id": 2, "name": "가상 약재", "amount": "9.0",
            "unit": "L", "preparation": None, "originalDoseInfo": "원문 메모"}
MANUAL = {"compositionId": None, "id": None, "name": "직접 입력", "amount": None,
          "unit": None, "preparation": None, "originalDoseInfo": None}


class PrescriptionIngredients(unittest.TestCase):
    def test_legacy_payload_is_preserved(self):
        self.assertEqual(validate_ingredient_copy(Ingredient(**ORIGINAL), {1: ORIGINAL}, set()), ORIGINAL)

    def test_actual_dose_does_not_replace_reference_and_roundtrips_json(self):
        actual = Ingredient(**ORIGINAL, prescribedAmount=" 0.5 ", prescribedUnit=" mL ")
        saved = validate_ingredient_copy(actual, {1: ORIGINAL}, set())
        restored = Ingredient(**json.loads(json.dumps(saved)))
        self.assertEqual(restored.amount, "9.0")
        self.assertEqual(restored.unit, "L")
        self.assertEqual(restored.prescribedAmount, "0.5")
        self.assertEqual(restored.prescribedUnit, "mL")
        corrected = restored.model_copy(update={"prescribedAmount": "0.75"})
        self.assertEqual(validate_ingredient_copy(corrected, {1: ORIGINAL}, set())["prescribedAmount"], "0.75")

    def test_missing_reference_and_manual_items_can_have_actual_dose(self):
        for source in (MANUAL, {**ORIGINAL, "amount": None, "unit": None}):
            item = Ingredient(**source, prescribedAmount="1.25", prescribedUnit="g")
            originals = {1: source} if source["compositionId"] else {}
            saved = validate_ingredient_copy(item, originals, set())
            self.assertIsNone(saved["amount"])
            self.assertEqual(saved["prescribedAmount"], "1.25")

    def test_reference_tampering_and_duplicates_are_rejected(self):
        for change in ({"amount": "1"}, {"unit": "g"}, {"originalDoseInfo": "changed"}):
            with self.subTest(change=change), self.assertRaises(HTTPException):
                validate_ingredient_copy(Ingredient(**{**ORIGINAL, **change}), {1: ORIGINAL}, set())
        seen = set()
        validate_ingredient_copy(Ingredient(**ORIGINAL), {1: ORIGINAL}, seen)
        with self.assertRaises(HTTPException):
            validate_ingredient_copy(Ingredient(**ORIGINAL), {1: ORIGINAL}, seen)

    def test_manual_original_fields_are_still_rejected(self):
        with self.assertRaises(HTTPException):
            validate_ingredient_copy(Ingredient(**{**MANUAL, "amount": "2"}), {}, set())

    def test_dose_pair_and_positive_finite_decimal_are_required(self):
        invalid = [("1", None), (None, "g"), ("0", "g"), ("-1", "g"),
                   ("NaN", "g"), ("Infinity", "g"), ("1e6", "g"), ("1,000", "g"),
                   ("1", "a" * 33), ("1" * 33, "g"), (1.5, "g"), ("1", "g\nx")]
        for amount, unit in invalid:
            with self.subTest(amount=amount, unit=unit), self.assertRaises(ValidationError):
                Ingredient(**MANUAL, prescribedAmount=amount, prescribedUnit=unit)

    def test_blank_optional_dose_and_decimal_are_accepted(self):
        self.assertIsNone(Ingredient(**MANUAL, prescribedAmount=" ", prescribedUnit=" ").prescribedAmount)
        self.assertEqual(Ingredient(**MANUAL, prescribedAmount=".5", prescribedUnit="g").prescribedAmount, ".5")


if __name__ == "__main__":
    unittest.main()
