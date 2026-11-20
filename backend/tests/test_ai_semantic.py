import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
from ai_semantic import search_semantic, make_semantic_rank

class SemanticTests(unittest.TestCase):
    def setUp(self):
        self.diseases = [{'DIS_UNIQN': 1, 'ATT_DIS_NM': '가'}, {'DIS_UNIQN': 2, 'ATT_DIS_NM': '나'}]
        self.chunks = [
            {'chunk_id': 'a', 'entity_type': 'disease', 'entity_id': 1, 'embedding_row': 0},
            {'chunk_id': 'b', 'entity_type': 'disease', 'entity_id': 1, 'embedding_row': 1},
            {'chunk_id': 'c', 'entity_type': 'disease', 'entity_id': 2, 'embedding_row': 2},
        ]
        self.matrix = np.zeros((3, 384))
        self.matrix[0, 1] = 1
        self.matrix[1, 0] = 1
        self.matrix[2, 0] = .6
        self.matrix[2, 1] = .8
        self.query = np.zeros(384)
        self.query[0] = 1

    def test_max_per_disease(self):
        rows = search_semantic(self.query, self.diseases, self.chunks, self.matrix)
        self.assertEqual([r['id'] for r in rows], [1, 2])
        self.assertEqual(rows[0]['bestChunkId'], 'b')
        self.assertAlmostEqual(rows[0]['semanticScore'], 1)

    def test_bad_query(self):
        with self.assertRaises(ValueError):
            search_semantic(np.zeros(384), self.diseases, self.chunks, self.matrix)

    def test_bad_matrix(self):
        with self.assertRaises(ValueError):
            search_semantic(self.query, self.diseases, self.chunks, np.zeros((3, 383)))

    def test_bad_row_reference(self):
        self.chunks[0]['embedding_row'] = 100
        with self.assertRaises(ValueError):
            search_semantic(self.query, self.diseases, self.chunks, self.matrix)

    def test_nonfinite_vectors(self):
        self.matrix[1, 0] = np.nan
        with self.assertRaises(ValueError):
            search_semantic(self.query, self.diseases, self.chunks, self.matrix)

    def test_adapter_to_pipeline(self):
        class Embedder:
            def encode_query(_, text):
                assert text == '기침'
                return self.query
        self.assertEqual(make_semantic_rank(Embedder(), self.chunks, self.matrix)('기침', self.diseases), [1, 2])

if __name__ == '__main__':
    unittest.main()
