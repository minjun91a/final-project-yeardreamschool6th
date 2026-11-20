import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ai_disease_pipeline import search_diseases

DISEASES = [
    {'DIS_UNIQN': 3, 'ATT_DIS_NM': '다'},
    {'DIS_UNIQN': 1, 'ATT_DIS_NM': '가'},
    {'DIS_UNIQN': 2, 'ATT_DIS_NM': '나'},
]


class DiseasePipelineTests(unittest.TestCase):
    def run_search(self, semantic=None, keyword=None):
        rows = [{'DIS_UNIQN': 3}, {'DIS_UNIQN': 2}, {'DIS_UNIQN': 1}]
        return search_diseases('  기침  ', DISEASES, rows,
                               keyword_match=keyword or (lambda query, row: True),
                               semantic_rank=semantic or (lambda query, rows: [3, 2, 1]))

    def test_keyword_name_sort_and_ranked_rrf(self):
        result = self.run_search()
        self.assertEqual([r['id'] for r in result], [1, 3, 2])
        self.assertEqual([r['rank'] for r in result], [1, 2, 3])

    def test_trimmed_query_both_paths(self):
        seen = []
        self.run_search(semantic=lambda q, rows: seen.append(q) or [],
                        keyword=lambda q, row: seen.append(q) or False)
        self.assertTrue(all(q == '기침' for q in seen))

    def test_empty_query_rejected(self):
        with self.assertRaises(ValueError):
            search_diseases('   ', DISEASES, [], keyword_match=lambda q, r: False,
                            semantic_rank=lambda q, rows: [])

    def test_semantic_failure_not_silenced(self):
        def failed(query, rows):
            raise RuntimeError('embedding unavailable')
        with self.assertRaisesRegex(RuntimeError, 'embedding unavailable'):
            self.run_search(semantic=failed)

    def test_keyword_failure_not_silenced(self):
        def failed(query, row):
            raise RuntimeError('keyword unavailable')
        with self.assertRaisesRegex(RuntimeError, 'keyword unavailable'):
            self.run_search(keyword=failed)

    def test_missing_keyword_disease_rejected(self):
        with self.assertRaises(ValueError):
            search_diseases('기침', DISEASES, [{'DIS_UNIQN': 99}],
                            keyword_match=lambda q, r: True,
                            semantic_rank=lambda q, rows: [])

    def test_semantic_results_capped(self):
        diseases = [{'DIS_UNIQN': i, 'ATT_DIS_NM': f'병증{i:02d}'} for i in range(1, 36)]
        result = search_diseases('기침', diseases, [],
                                keyword_match=lambda q, r: False,
                                semantic_rank=lambda q, rows: list(range(1, 36)))
        self.assertEqual(len(result), 30)
        self.assertEqual(result[-1]['id'], 30)

    def test_no_results_is_normal(self):
        result = self.run_search(semantic=lambda q, rows: [],
                                 keyword=lambda q, row: False)
        self.assertEqual(result, [])


if __name__ == '__main__':
    unittest.main()
