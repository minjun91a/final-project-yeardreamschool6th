"""병증 검색의 RRF 병합. API 설계서 v1.3 7.1의 순위 규칙.

feat/ai-search/backend/ai/search.py의 fuse_rrf 계산을 기준으로,
키워드 경로의 공동 1위 처리만 설계서의 1부터 시작하는 개별 순위로 교정.
이 파일은 검색 엔진/DB API를 대신하지 않는다.
"""
from fractions import Fraction

RRF_K = 60


def fuse_rrf(keyword_ids: list[int], semantic_ids: list[int], diseases: list[dict]) -> list[dict]:
    names = {row['DIS_UNIQN']: row['ATT_DIS_NM'] for row in diseases}
    scores: dict[int, Fraction] = {}
    for label, ranked_ids in (("키워드", keyword_ids), ("의미", semantic_ids)):
        seen: set[int] = set()
        for position, disease_id in enumerate(ranked_ids, start=1):
            if type(disease_id) is not int or disease_id not in names:
                raise ValueError(f'{label} 검색의 병증 식별번호 {disease_id!r}가 올바르지 않습니다.')
            if disease_id in seen:
                raise ValueError(f'{label} 검색에 병증 {disease_id}가 중복됐습니다.')
            seen.add(disease_id)
            scores[disease_id] = scores.get(disease_id, Fraction(0, 1)) + Fraction(1, RRF_K + position)
    ordered = sorted(scores, key=lambda disease_id: (-scores[disease_id], names[disease_id], disease_id))
    return [{'id': disease_id, 'name': names[disease_id], 'score': float(scores[disease_id]), 'rank': rank}
            for rank, disease_id in enumerate(ordered, 1)]
