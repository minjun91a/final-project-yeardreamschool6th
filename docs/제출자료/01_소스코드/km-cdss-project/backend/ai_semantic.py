"""AI 설계서 v1.3: 병증 청크별 코사인 최댓값 검색 (민준님 search_semantic 기반)."""
import numpy as np

EMBEDDING_DIM = 384
MAX_SEMANTIC_CANDIDATES = 30


def search_semantic(query_vector, diseases, chunks, matrix):
    query = np.asarray(query_vector, dtype=np.float64)
    if query.shape != (EMBEDDING_DIM,) or not np.isfinite(query).all():
        raise ValueError('입력 벡터는 유효한 숫자 384개여야 합니다.')
    query_norm = np.linalg.norm(query)
    if not np.isfinite(query_norm) or query_norm == 0:
        raise ValueError('입력 벡터의 길이가 올바르지 않습니다.')
    matrix = np.asarray(matrix)
    if matrix.ndim != 2 or matrix.shape[1] != EMBEDDING_DIM:
        raise ValueError('검색 자료의 벡터 배열 크기가 올바르지 않습니다.')
    names = {row['DIS_UNIQN']: row['ATT_DIS_NM'] for row in diseases}
    if len(names) != len(diseases):
        raise ValueError('병증 ID가 중복됐습니다.')
    disease_chunks = [row for row in chunks if row['entity_type'] == 'disease']
    if not disease_chunks:
        raise ValueError('병증 검색에 사용할 원문 조각이 없습니다.')
    row_numbers = []
    for chunk in disease_chunks:
        disease_id, row_number = chunk['entity_id'], chunk['embedding_row']
        if type(disease_id) is not int or disease_id not in names:
            raise ValueError(f"{chunk['chunk_id']}: 연결된 병증이 없습니다.")
        if type(row_number) is not int or not 0 <= row_number < len(matrix):
            raise ValueError(f"{chunk['chunk_id']}: 벡터 행번호 오류")
        row_numbers.append(row_number)
    vectors = matrix[row_numbers].astype(np.float64)
    if not np.isfinite(vectors).all():
        raise ValueError('병증 벡터에 유효하지 않은 수치가 있습니다.')
    norms = np.linalg.norm(vectors, axis=1)
    if not np.isfinite(norms).all() or np.any(norms == 0):
        raise ValueError('병증 벡터의 길이가 올바르지 않습니다.')
    similarities = np.clip((vectors / norms[:, None]) @ (query / query_norm), -1.0, 1.0)
    best = {}
    for chunk, similarity in zip(disease_chunks, similarities):
        disease_id, score = chunk['entity_id'], float(similarity)
        previous = best.get(disease_id)
        if previous is None or score > previous['semanticScore']:
            best[disease_id] = {'id': disease_id, 'name': names[disease_id], 'semanticScore': score,
                                'bestChunkId': chunk['chunk_id']}
    ranked = sorted(best.values(), key=lambda row: (-row['semanticScore'], row['name'], row['id']))
    return [{**row, 'rank': rank} for rank, row in enumerate(ranked[:MAX_SEMANTIC_CANDIDATES], 1)]


def make_semantic_rank(embedder, chunks, matrix):
    """ai_disease_pipeline.search_diseases의 semantic_rank 콜백 생성."""
    def rank(symptoms, diseases):
        query_vector = embedder.encode_query(symptoms)
        return [row['id'] for row in search_semantic(query_vector, diseases, chunks, matrix)]
    return rank
