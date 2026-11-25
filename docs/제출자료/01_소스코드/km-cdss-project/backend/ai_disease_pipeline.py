"""API v1.3 §7.1 병증 검색의 순수 실행 파이프라인.

DB 저장/권한/설명 생성은 이 모듈의 책임이 아니다. 호출자는 실제 기업
44개 병증 범위와 키워드, 임베딩 검색 함수를 공급해야 한다.
"""
from collections.abc import Callable
from typing import Any

from ai_rrf import fuse_rrf

MAX_PER_PATH = 30


def search_diseases(
    symptoms: str,
    diseases: list[dict],
    keyword_rows: list[dict],
    *,
    keyword_match: Callable[[str, dict], bool],
    semantic_rank: Callable[[str, list[dict]], list[int]],
) -> list[dict[str, Any]]:
    """두 경로 모두 정상 완료해야만 결과를 반환한다.

    semantic_rank는 병증별 조각 코사인 최댓값을 사용해 정렬한 ID를
    반환해야 한다. 어느 경로든 실패하면 예외를 그대로 전파한다.
    """
    query = symptoms.strip()
    if not query:
        raise ValueError('증상 입력이 비어 있습니다.')
    names = {}
    for row in diseases:
        disease_id, name = row['DIS_UNIQN'], row['ATT_DIS_NM']
        if type(disease_id) is not int or not isinstance(name, str) or not name.strip():
            raise ValueError('병증 원본의 ID 또는 이름이 올바르지 않습니다.')
        if disease_id in names:
            raise ValueError(f'중복 병증 ID: {disease_id}')
        names[disease_id] = name

    matched = set()
    for row in keyword_rows:
        if keyword_match(query, row):
            disease_id = row['DIS_UNIQN']
            if disease_id not in names:
                raise ValueError(f'등록되지 않은 병증 ID: {disease_id}')
            matched.add(disease_id)
    keyword_ids = sorted(matched, key=lambda i: (names[i], i))[:MAX_PER_PATH]

    semantic_ids = semantic_rank(query, diseases)
    if not isinstance(semantic_ids, list):
        raise ValueError('의미 검색 결과는 ID 목록이어야 합니다.')
    # 입력 순서가 점수 순서이며 검색 경로 자체에서 최상위 30개를 제공한다.
    return fuse_rrf(keyword_ids, semantic_ids[:MAX_PER_PATH], diseases)
