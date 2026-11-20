"""feat/ai-search 미리보기 실행 전 필수 자산 검사. 설치/다운로드/DB 변경 없음."""
from __future__ import annotations
import argparse
import importlib.util
import os
from pathlib import Path

REQUIRED = (
    'stage1/검색용/병증원문.jsonl',
    'stage1/검색용/키워드검색항목.jsonl',
    'stage1/검색용/처방원문.jsonl',
    'stage1/조회용/병증처방관계.jsonl',
    'stage2/청킹결과.jsonl',
    'stage2/임베딩결과.jsonl',
    'stage2/벡터행렬.npy',
)
PACKAGES = ('numpy', 'torch', 'transformers', 'huggingface_hub', 'kiwipiepy')

def check(root: Path) -> bool:
    print(f'AI 데이터 경로: {root.resolve()}')
    missing = []
    for relative in REQUIRED:
        file = root / relative
        ok = file.is_file() and file.stat().st_size > 0
        print(f'{"OK" if ok else "MISSING"}: {relative}')
        if not ok:
            missing.append(relative)
    for package in PACKAGES:
        ok = importlib.util.find_spec(package) is not None
        print(f'{"OK" if ok else "MISSING"}: Python 패키지 {package}')
        if not ok:
            missing.append(package)
    if missing:
        print(f'미충족 항목 {len(missing)}개. 처방 원문 data.zip만으로는 병증 미리보기 실행 불가.')
    else:
        print('기본 파일/패키지 확인 통과. 모델 캐시, Ollama, 실제 AI 호출은 별도 확인 필요.')
    return not missing

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-root', default=os.environ.get('KM_CDSS_DATA_ROOT', r'C:\km-cdss-data'))
    args = parser.parse_args()
    raise SystemExit(0 if check(Path(args.data_root)) else 1)
