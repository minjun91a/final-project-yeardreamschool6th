# 실행 조건과 코드 확인 방법

## 공개 소스와 별도 준비 자료

공개 저장소에는 서비스 코드·검사 코드·설계 자료와 가상 데이터 시연 자료가 있습니다. 실제 실행에는 다음 항목을 별도로 준비해야 합니다.

| 항목 | 필요한 이유 |
|---|---|
| PostgreSQL 스키마·초기 데이터 | 계정·한의원·접수·상담·처방 처리 |
| 사용 허가를 받은 기업 원문·조회 자료 | 병증·처방·약재의 검색·근거·구성 조회 |
| 검색용 JSONL·벡터 행렬 | 초기 44개 병증 범위의 검색 런타임 |
| 고정 리비전 E5 모델 캐시 | `local_files_only=True` 임베딩 실행 |
| Qwen GGUF·토크나이저·llama.cpp | 설명 생성과 별도 검토 |
| 환경변수 | DB·자료·모델 경로, 허용 출처, 선택 SMTP 설정 |

기존 개발 DB 환경은 전달받은 자료 기준 PostgreSQL 17.11, `public` 스키마, pgvector 0.8.7입니다. 현재 검색 코드가 사용하는 벡터 행렬 파일 방식과 DB 환경의 pgvector 확장은 구분합니다.

## 환경설정

루트 [`backend/.env.example`](../../backend/.env.example)은 실제 비밀값이 없는 설정 항목 예시입니다. 실행 환경에서 `backend/.env`로 복사하고 실제 값을 채웁니다.

- `DATABASE_URL`: 업무 DB 접속
- `KM_CDSS_DATA_ROOT`: 검색 JSONL·벡터 자료 위치
- `KM_CDSS_CATALOG_ROOT`, `KM_CDSS_CATALOG_WORKBOOK`: 처방·약재 원본 조회 자료
- `KM_CDSS_LLAMA_SERVER_URL`, `KM_CDSS_LLAMA_SERVER_API_KEY`: 상주 설명 서버 연결
- `KM_CDSS_LLAMA_EXECUTABLE`, `KM_CDSS_EXPLANATION_MODEL`, `HF_HOME`: CLI 대체 경로·모델·토크나이저 캐시
- `HANUI_PUBLIC_URL`, `HANUI_SMTP_*`: 직원 초대 링크와 선택적 메일 발송 설정

비밀값은 Git에 추가하지 않습니다. `backend/requirements-local-model.txt`는 토크나이저·모델 전송 관련 고정 목록이며 **백엔드 전체 의존성 잠금 파일이 아닙니다**. FastAPI·SQLAlchemy·PostgreSQL 드라이버·검색 관련 패키지는 프로젝트 실행 환경에 맞춰 별도로 구성해야 합니다.

## 환경이 준비된 경우

프런트엔드:

```bash
cd frontend
npm ci
npm run dev
```

백엔드:

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

실제 DB·원본 자료·모델 없이 위 명령만 실행해 서비스 전체가 동작하는 형태는 아닙니다. 화면 흐름은 [팀 가상 데이터 시연영상](../제출자료/03_최종발표/시연영상/)에서 확인할 수 있습니다. 현재 운영 중인 공개 배포 URL은 이 포트폴리오에서 제공하지 않습니다.

## 검사

프런트엔드 단위 검사와 빌드:

```bash
cd frontend
npm test
npm run build
```

백엔드 DB 비의존 검사 예시(PowerShell, Python 의존성 준비 후):

```powershell
cd backend
$env:HANUI_RUN_POSTGRES_TESTS="0"
python -m unittest discover -s tests -v
```

DB 검사는 준비된 전용 검사 DB와 테스트 코드의 조건을 확인한 뒤 수행합니다. 공개 문서의 과거 통과 수를 현재 환경에서 새로 수행한 검사로 취급하지 않습니다. [기준별 결과](verification.md)

GPU 인스턴스 준비·실행은 [Elice 안내](../elice-gpu-benchmark.md)를 따릅니다. 호환 라이브러리와 모델 경로를 서비스 프로세스에 연결한 뒤 전체 업무 흐름은 별도로 확인해야 합니다.
