import sys
import unittest
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai_rrf import fuse_rrf


class RRFV13Tests(unittest.TestCase):
    diseases = [
        {'DIS_UNIQN': 1, 'ATT_DIS_NM': '가'},
        {'DIS_UNIQN': 2, 'ATT_DIS_NM': '나'},
        {'DIS_UNIQN': 3, 'ATT_DIS_NM': '다'},
    ]

    def test_keyword_rank_is_not_tied(self):
        results = fuse_rrf([1, 2], [], self.diseases)
        self.assertEqual([r['id'] for r in results], [1, 2])
        self.assertEqual(results[0]['score'], float(Fraction(1, 61)))
        self.assertEqual(results[1]['score'], float(Fraction(1, 62)))

    def test_two_paths_add_exact_fraction(self):
        results = fuse_rrf([1, 2], [2, 3], self.diseases)
        self.assertEqual([r['id'] for r in results], [2, 1, 3])
        self.assertEqual(results[0]['score'], float(Fraction(1, 62) + Fraction(1, 61)))

    def test_exact_tie_name_then_id(self):
        results = fuse_rrf([2, 1], [1, 2], self.diseases)
        self.assertEqual([r['id'] for r in results], [1, 2])

    def test_invalid_or_duplicate_ids_fail(self):
        with self.assertRaises(ValueError):
            fuse_rrf([1, 1], [], self.diseases)
        with self.assertRaises(ValueError):
            fuse_rrf([99], [], self.diseases)

    def test_empty(self):
        self.assertEqual(fuse_rrf([], [], self.diseases), [])


if __name__ == '__main__':
    unittest.main()
