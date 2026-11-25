import sys
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ai.explanations import MAX_INPUT_TOKENS, explain, prepare_prompt
from ai.evidence_checks import check_record


class ExplanationTests(unittest.TestCase):
    def setUp(self):
        self.candidate = {
            "id": 5, "name": "기업 후보", "rank": 1, "score": 0.01,
            "_sources": [{"itemId": 5, "sourceId": "reference", "dataVersion": "verified",
                          "excerpt": "기침을 기록함", "originalText": "기침을 기록함"}],
        }
        self.generated = {
            "candidateId": 5, "unexplainedSymptoms": [],
            "sentences": [{"sentenceNo": 1, "text": "원문에 기침이 기록되어 있습니다.",
                           "references": [{"sourceId": "reference", "quote": "기침"}]}],
        }
        self.review = {
            "candidateId": 5,
            "reviews": [{"sentenceNo": 1, "verdict": "GROUNDED", "reason": "원문에 기침이 있습니다.",
                         "sourceIds": ["reference"]}],
        }

    def test_ready_requires_both_calls(self):
        with patch("ai.explanations.chat", side_effect=[(self.generated, {}), (self.review, {})]) as chat:
            result, _ = explain(self.candidate, ["기침"], lambda: False)
        self.assertEqual(chat.call_count, 2)
        self.assertEqual(result["status"], "READY")
        self.assertTrue(result["text"])

    def test_fabricated_quote_is_withheld_without_review(self):
        self.generated["sentences"][0]["references"][0]["quote"] = "원문 밖 인용"
        with patch("ai.explanations.chat", return_value=(self.generated, {})) as chat:
            result, _ = explain(self.candidate, ["기침"], lambda: False)
        self.assertEqual(chat.call_count, 1)
        self.assertEqual(result["status"], "WITHHELD")
        self.assertIsNone(result["text"])

    def test_incomplete_review_never_exposes_text(self):
        self.review["reviews"][0]["verdict"] = "UNDETERMINED"
        with patch("ai.explanations.chat", side_effect=[(self.generated, {}), (self.review, {})]):
            result, _ = explain(self.candidate, ["기침"], lambda: False)
        self.assertEqual(result["status"], "INCOMPLETE")
        self.assertIsNone(result["text"])

    def test_cancellation_skips_review(self):
        with patch("ai.explanations.chat", return_value=(self.generated, {})) as chat:
            result, _ = explain(self.candidate, ["기침"], iter((False, True)).__next__)
        self.assertEqual(chat.call_count, 1)
        self.assertEqual(result["status"], "INCOMPLETE")
        self.assertIsNone(result["text"])

    def test_prompt_budget_counts_rendered_prompt_without_truncation(self):
        with patch("ai.explanations.explanation_tokenizer") as load:
            tokenizer = load.return_value
            tokenizer.apply_chat_template.return_value = "rendered Qwen prompt"
            tokenizer.encode.return_value = [0] * MAX_INPUT_TOKENS
            self.assertEqual(prepare_prompt("instruction", {"data": "input"}),
                             ("rendered Qwen prompt", MAX_INPUT_TOKENS))
            tokenizer.encode.assert_called_once_with("rendered Qwen prompt", add_special_tokens=False)
            tokenizer.encode.return_value.append(0)
            with self.assertRaises(ValueError):
                prepare_prompt("instruction", {"data": "input"})

    def test_failed_or_malformed_generation_never_reaches_review(self):
        for response in (
            TimeoutError("timeout"), ValueError("truncated"),
            {"candidateId": 6, "sentences": [], "unexplainedSymptoms": []},
            {**self.generated, "sentences": []},
            {**self.generated, "unexplainedSymptoms": [1]},
            {**self.generated, "sentences": [{**self.generated["sentences"][0], "sentenceNo": 2}]},
            {**self.generated, "sentences": [{**self.generated["sentences"][0], "references": []}]},
        ):
            with self.subTest(response=response):
                side_effect = response if isinstance(response, Exception) else [(response, {})]
                with patch("ai.explanations.chat", side_effect=side_effect) as chat:
                    result, _ = explain(self.candidate, ["기침"], lambda: False)
                self.assertEqual(chat.call_count, 1)
                self.assertEqual((result["status"], result["text"]), ("INCOMPLETE", None))

    def test_review_output_and_precedence(self):
        for changes, status in (
            ({"verdict": "CONTRADICTED"}, "WITHHELD"),
            ({"verdict": "INSUFFICIENT_EVIDENCE"}, "WITHHELD"),
            ({"sourceIds": ["different"]}, "INCOMPLETE"),
            ({"sourceIds": ["reference", "reference"]}, "INCOMPLETE"),
            ({"sentenceNo": 2}, "INCOMPLETE"),
            ({"reason": " "}, "INCOMPLETE"),
        ):
            with self.subTest(changes=changes):
                review = {"candidateId": 5, "reviews": [{**self.review["reviews"][0], **changes}]}
                with patch("ai.explanations.chat", side_effect=[(self.generated, {}), (review, {})]):
                    result, _ = explain(self.candidate, ["기침"], lambda: False)
                self.assertEqual((result["status"], result["text"]), (status, None))
        generated = deepcopy(self.generated)
        generated["sentences"].append({**generated["sentences"][0], "sentenceNo": 2})
        review = {"candidateId": 5, "reviews": [{**self.review["reviews"][0], "verdict": "CONTRADICTED"}]}
        with patch("ai.explanations.chat", side_effect=[(generated, {}), (review, {})]):
            result, _ = explain(self.candidate, ["기침"], lambda: False)
        self.assertEqual((result["status"], result["text"]), ("WITHHELD", None))
        self.assertIn("완료하지 못했습니다", result["message"])

    def test_failed_or_unavailable_required_relation_never_calls_model(self):
        for state, expected in (("FAIL", "WITHHELD"), ("NOT_CHECKED", "INCOMPLETE"), ("ERROR", "INCOMPLETE")):
            with self.subTest(state=state):
                checks = [check_record("DISEASE_PRESCRIPTION", {"id": 5}, True, state, "fixture")]
                with patch("ai.explanations.chat") as chat:
                    result, trace = explain(self.candidate, ["기침"], lambda: False, checks=checks)
                chat.assert_not_called()
                self.assertEqual((result["status"], result["text"]), (expected, None))
                self.assertEqual(trace["checks"], checks)
