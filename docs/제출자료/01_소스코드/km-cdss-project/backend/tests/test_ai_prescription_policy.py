import sys
import unittest
from pathlib import Path
from unittest.mock import Mock

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ai.prescription_search import search_prescriptions


class PrescriptionPolicyTests(unittest.TestCase):
    def setUp(self):
        self.embedder = Mock()
        self.diseases = [{"DIS_UNIQN": 1}]
        self.prescriptions = [
            {"PRESP_UNIQN": 5, "PRESP_NM": "나", "PRESP_CONT": "", "TABO_CONT": ""},
            {"PRESP_UNIQN": 6, "PRESP_NM": "가", "PRESP_CONT": "등록 설명", "TABO_CONT": ""},
        ]
        self.relations = [{"DIS_UNIQN": 1, "PRESP_UNIQN": item["PRESP_UNIQN"]}
                          for item in self.prescriptions]

    def search(self, configured):
        return search_prescriptions(
            "기침", 1, self.embedder, self.diseases, self.prescriptions, self.relations,
            [], np.empty((0, 384)), [], [], evaluation_configured=configured,
        )

    def test_missing_policy_retains_connected_rows_and_distinguishes_missing_description(self):
        result = self.search(False)
        self.embedder.encode_query.assert_not_called()
        self.assertEqual(result["candidates"], [])
        self.assertEqual(result["summary"], {
            "connectedCount": 2, "scoredCount": 0, "insufficientCount": 1, "policyUnconfiguredCount": 1,
        })
        self.assertEqual(
            [(row["id"], row["evaluationStatus"], row["score"], row["rank"])
             for row in result["unscoredCandidates"]],
            [(6, "POLICY_NOT_CONFIGURED", None, None), (5, "INSUFFICIENT_DATA", None, None)],
        )

    def test_configured_model_failure_is_not_returned_as_unscored(self):
        self.embedder.encode_query.side_effect = RuntimeError("dependency failed")
        with self.assertRaises(RuntimeError):
            self.search(True)
