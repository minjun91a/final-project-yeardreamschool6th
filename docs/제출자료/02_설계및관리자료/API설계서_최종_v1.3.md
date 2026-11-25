# 한의결 API 설계서 v1.3

2026-11-14 · 구현 기준

적용 범위: 인증 연동·접수/상담·AI 검색/설명·기업 항목 조회·처방전 저장/조회/전달.

## 1. 담당자

| 담당 | 구현 범위 |
|---|---|
| 상준 | 화면, 인증·권한 공통부, DB 연결, 방문 접수·상담·처방전·정정·전달·조회 API |
| 민준 | 기업 자료·벡터 적재, 병증·처방 검색, 기업 항목 조회, 원문 조회, AI 설명·검사·중단, 검색 이력 |
| 공동 | 요청·응답 자료형 연결, 상담·검색·처방전 ID 연결, 통합 확인 |

## 2. 공통 규칙

- 경로는 /api로 시작한다. 화면은 상대 경로로 호출한다. 요청·응답은 application/json을 사용한다.
- 모든 보호 API는 동일한 로그인 세션을 사용한다. 인증·권한 검사는 서버에서 수행한다.
- 작성자·소속 한의원은 로그인 계정에서 조회한다. 요청 본문에 accountId·clinicId를 받아 권한을 결정하지 않는다.
- 계정 비활성·세션 만료·한의원 이용 중지는 다음 요청부터 차단한다. 서비스 운영 관리자는 한의원 소속 없이 인증한다.
- 입력·출력 필드는 아래 이름을 사용한다. 필수 키 누락·잘못된 자료형·정의되지 않은 요청 키는 400으로 처리한다.
- 날짜는 YYYY-MM-DD, 시각은 시간대가 포함된 ISO 8601 문자열로 반환한다. 당일 기준은 Asia/Seoul이다.
- 저장되지 않은 선택값·없는 원문·없는 수치는 null, 빈 목록은 []로 반환한다. 누락을 0·안전·해당 없음으로 대체하지 않는다.
- 목록은 items 또는 records와 total을 사용한다. 검색 후보는 candidates를 사용한다. total은 해당 응답 배열의 길이다.
- 본문 없는 요청은 바디를 보내지 않는다. 변경·이력 저장은 하나의 트랜잭션으로 처리하고 실패 시 함께 롤백한다.

### 2.1 권한

| 대상 | 허용 |
|---|---|
| 당일 현황 조회 | 같은 한의원 원장·한의사·안내데스크 |
| 접수·대기 등록·접수 취소 | 같은 한의원 안내데스크 |
| 상담 시작·중단·재개·시작 오처리 정정·완료 | 해당 건을 담당하는 한의사. 원장도 본인 담당 건만 |
| 상담·처방·검색·원문 조회 | 같은 한의원 원장·한의사 |
| 상담·처방 수정, AI 검색·설명 작업 변경 | 해당 상담 또는 처방의 작성 한의사 |
| 전달된 처방 버전 조회 | 같은 한의원 원장·한의사·안내데스크 |
| 서비스 운영 관리자 | 아래 진료자료 API 접근 금지. 인증 API만 사용 |

다른 한의원 자료는 모두 차단한다. 안내데스크에는 상담일지·AI 검색기록·미전달 처방 수정본을 제공하지 않는다.

### 2.2 식별번호

| 필드 | 자료형 | 발급·전달 |
|---|---|---|
| patientId·visitId | integer | 서버가 발급한 환자·방문 접수 식별번호 |
| caseId | integer | 상담 시작 응답 record.caseId. CASE_RECORD의 식별번호 |
| searchId | string | 검색마다 발급한 SEARCH_UNIQN의 10진수 문자열 |
| diseaseSearchId | string | 병증 검색 응답 searchId를 그대로 처방 요청에 전달 |
| prescriptionSearchId | string 또는 null | 처방 검색 응답 searchId를 그대로 처방전 저장 요청에 전달 |
| selectedDiseases | integer[] | 기업 병증 식별번호 한 개만 담는 배열 |
| selectedDiseaseId·prescriptionId | integer 또는 null | 선택한 기업 병증·처방 식별번호 |
| rxId·versionId·deliveryId | integer | 서버가 발급한 처방전·버전·전달 기록 식별번호 |
| sourceId | string | 검색 당시 원문과 버전에 연결된 근거 식별자 |

식별번호는 화면에서 만들지 않는다. 예: 상담 시작의 caseId=101 → 병증 응답 searchId="7001" → 처방 요청 diseaseSearchId="7001" → 처방 응답 searchId="8001" → 처방 저장 prescriptionSearchId="8001".

### 2.3 공통 객체

아래 객체의 키는 모두 반환한다. `?`가 붙은 요청 필드만 생략 가능하다. `T|null`은 키를 포함하되 null을 허용한다.

**Account**

| 필드 | 자료형 |
|---|---|
| id | integer |
| name·email | string |
| role | DOCTOR / DESK / SERVICE_ADMIN |
| isOwner | boolean |
| clinicId | integer 또는 null |

원장은 role=DOCTOR·isOwner=true로 반환한다. SERVICE_ADMIN은 clinicId=null·isOwner=false로 반환한다.

**Visit**

| 필드 | 자료형 |
|---|---|
| id·patientId | integer |
| patientName·birthDate | string |
| status | REGISTERED / WAITING / IN_PROGRESS / COMPLETED / CANCELLED / INTERRUPTED |
| registeredAt | 시각 문자열 |
| waitingAt·startedAt·completedAt | 시각 문자열 또는 null |
| doctorId·caseId | integer 또는 null |
| doctorName | string 또는 null |

**Diagnosis**

| 필드 | 자료형 |
|---|---|
| diseaseSearchId | string 또는 null |
| selectedDiseaseId | integer 또는 null |
| selectedDiseaseName·manualDiseaseText | string 또는 null |

후보 선택은 diseaseSearchId·selectedDiseaseId를 함께 지정하고 manualDiseaseText=null로 한다. selectedDiseaseName은 서버가 기업 원본에서 조회한다. 직접 기록은 manualDiseaseText만 지정한다. 미선택은 모든 항목을 null로 한다.

**ConsultationWrite: 상담 저장·완료·중단의 요청 항목**

| 필드 | 자료형 | 필수·처리 |
|---|---|---|
| operation | SAVE / CORRECT | 필수 |
| symptoms·consultationText | string | 필수 키. 작성 중에는 빈 문자열 허용 |
| additionalNotes | string 또는 null | 필수 키. 미입력은 null |
| diseaseSearchId | string 또는 null | 필수 키 |
| selectedDiseaseId | integer 또는 null | 필수 키 |
| manualDiseaseText | string 또는 null | 필수 키 |
| reason | string 또는 null | 필수 키. CORRECT는 공백 아닌 사유 필수 |

- SAVE는 상담 중 작성 내용 저장에 사용한다. 기존 저장내용 정정은 상태와 관계없이 CORRECT로 요청한다.
- CORRECT는 변경 항목·전후 값·처리자·시각·사유를 보존한다. 완료된 상담도 작성자만 정정한다.
- 기업 후보 선택과 직접 기록을 동시에 보내면 400이다. 병증 선택·직접 병명은 상담 저장·완료의 필수값으로 강제하지 않는다.
- 상담기록 본문과 병명은 별도 항목으로 저장한다. 미입력 특이사항을 ‘해당 없음’으로 저장하지 않는다.

**ConsultationSummary**

| 필드 | 자료형 |
|---|---|
| id·visitId·patientId·authorId | integer |
| patientName·birthDate·authorName | string |
| registeredAt·createdAt·updatedAt | 시각 문자열 |
| startedAt·completedAt | 시각 문자열 또는 null |
| status | Visit.status |
| diagnosis | Diagnosis |
| prescriptionNames | string[] |

**ConsultationDetail**：ConsultationSummary에 symptoms: string, consultationText: string, additionalNotes: string|null, searchIds: string[], prescriptionIds: integer[]를 추가한다.

**ChangeRecord**

| 필드 | 자료형 |
|---|---|
| id·changedBy | integer |
| changedByName | string |
| changedAt | 시각 문자열 |
| changedFields | string[] |
| beforeValues·afterValues | 변경 필드명과 저장값의 객체 |
| reason | 공백 아닌 string |

## 3. 인증 연동 — 상준

| 방식·경로 | 요청 | 성공 응답 |
|---|---|---|
| POST /api/auth/login | email: string, password: string | 200, {account: Account, expiresAt: 시각} + 세션 쿠키 |
| GET /api/auth/me | 없음 | 200, {account: Account, expiresAt: 시각} |
| POST /api/auth/logout | 없음 | 200, {loggedOut: true} + 세션 쿠키 만료 |

- 비밀번호 해시·계정 상태·승인 여부·한의원 상태를 검사한다. 실패는 401 또는 계정 이용 제한 403으로 반환한다.
- 세션 토큰은 예측 불가능한 난수로 발급하고 서버에는 해시·계정·만료·무효화 상태를 저장한다.
- 쿠키 이름은 session, HttpOnly·SameSite=Lax·Path=/로 설정한다. HTTPS 배포에서는 Secure를 적용한다.
- 세션 만료는 저장된 만료시각으로 검사한다. 유지시간은 배포 설정 SESSION_TTL_SECONDS의 필수값을 사용한다.
- 화면 요청은 credentials: include를 적용한다. 쓰기 요청은 허용한 Origin인지 서버에서 검사한다.
- 직무 변경은 다음 요청부터 반영하고 이용 중지·로그아웃 시 대상 세션을 무효화한다.
- auth/me가 반환한 직무로 화면 메뉴를 구성한다. 화면 메뉴 숨김으로 서버 권한 검사를 대체하지 않는다.

## 4. 방문 접수·상담대기현황판 — 상준

### 4.1 접수 — POST /api/visits

| 요청 | 성공 응답 |
|---|---|
| patientId: integer | 201, {record: Visit} |

- 동일인 확인·등록이 끝난 같은 한의원 환자만 접수한다.
- REGISTERED·접수시각·로그인 처리 계정을 저장하고 최초 상태 이력을 함께 저장한다.
- 접수 완료만으로 대기 목록에 포함하지 않는다. 최초 이력의 변경 전 상태만 null을 허용한다.

### 4.2 당일 현황 — GET /api/visits

| 쿼리 | 성공 응답 |
|---|---|
| scope?: all / waiting, 기본 all | 200, {records: Visit[], total: integer, message: string|null} |

- 당일·같은 한의원의 접수만 제공한다. all은 접수시각·visitId 순으로 정렬한다.
- waiting은 WAITING만 제공하고 대기등록시각·접수시각·visitId 순으로 정렬한다.
- 취소·중단·완료 건도 all에는 남긴다. 없는 담당자·대기시각은 화면에서 미등록으로 표시한다.
- 0건은 “당일 접수 내역이 없습니다”, 조회 실패는 “접수 현황을 불러오지 못했습니다”로 구분한다.
- 현황판 실시간 자동 갱신은 추가하지 않는다. 변경 후 재조회한다.

### 4.3 상태 변경 — PATCH /api/visits/{visitId}/status

| 요청 필드 | 자료형 |
|---|---|
| action | REGISTER_WAITING / START / CANCEL / PAUSE / RESUME / CORRECT_START |
| reason | string 또는 null |
| consultation | ConsultationWrite 또는 null |

성공: 200, {record: Visit}.

| action | 담당 직무·상태 전환 | 처리 규칙 |
|---|---|---|
| REGISTER_WAITING | 안내데스크, REGISTERED → WAITING | 대기시각 저장. 이미 WAITING이면 기존 시각을 유지해 200 반환 |
| START | 한의사, WAITING → IN_PROGRESS | 로그인 한의사를 담당자로 저장. 시작시각·상태 이력·빈 상담기록을 함께 저장하고 caseId 반환 |
| CANCEL | 안내데스크, REGISTERED 또는 WAITING → CANCELLED | reason 필수. consultation=null |
| PAUSE | 담당 한의사, IN_PROGRESS → INTERRUPTED | reason·consultation 필수. 진행 내용·중단 상태·이력 함께 저장 |
| RESUME | 담당 한의사, 당일 INTERRUPTED → IN_PROGRESS | reason 필수. 기존 caseId와 최초 시작시각 유지 |
| CORRECT_START | 담당 한의사, IN_PROGRESS → WAITING | 실제 상담 전 오처리 사유 필수. 상담 내용·처방 저장·전달 전만 허용. 기존 대기시각 유지 |

- START는 중복 시작을 409로 거절한다. 현재 상태를 조건으로 잠금·갱신해 동시에 두 담당자가 시작하지 못하게 한다.
- 상태 변경·처리 계정·시각·사유를 이력으로 함께 저장한다. 정상 대기 등록·시작의 사유는 null을 허용한다.
- START에서 같은 방문·작성자의 빈 상담기록이 이미 있으면 재사용한다. 다른 작성자의 기록·이력은 덮어쓰거나 삭제하지 않는다.
- CORRECT_START는 담당자를 해제한다. 새 START는 해당 로그인 한의사의 상담기록을 연결한다.
- 상담 완료 후 이전 상태 복귀는 허용하지 않는다. 취소 복구·다른 날 재방문은 새 접수로 처리한다.
- 잠시 자리 비움은 별도 상태를 만들지 않는다. 중단·재개만으로 완료·처방 전달을 실행하지 않는다.
- consultation은 PAUSE에서만 사용하고 나머지 action에서는 null로 보낸다. 중단 입력의 정정 사유는 ConsultationWrite 규칙을 적용한다.

## 5. 상담기록 — 상준

상담기록 생성은 4.3 START에서 수행한다. 별도 POST /api/consultations로 새 기록을 생성하지 않는다.

### 5.1 저장 — PATCH /api/consultations/{caseId}

| 요청 | 성공 응답 |
|---|---|
| ConsultationWrite | 200, {record: ConsultationDetail} |

- 작성자·방문 연결을 확인한다. SAVE는 본인 IN_PROGRESS 건에 허용한다.
- CORRECT는 본인 저장 기록에 허용한다. 상담 상태를 되돌리지 않는다.
- 후보 선택은 해당 caseId·증상·기업 병증 ID와 diseaseSearchId의 실제 후보 연결을 검사한다. 가장 최근 검색 번호만 사용하도록 제한하지 않는다.
- 선택·직접 기록·검색 실행 연결을 상담에 저장한다. 다른 검색의 근거를 섞지 않는다.
- 저장 실패 시 기존 저장본을 유지하고 “상담기록을 저장하지 못했습니다”로 안내한다.

### 5.2 완료 — POST /api/consultations/{caseId}/complete

| 요청 | 성공 응답 |
|---|---|
| ConsultationWrite | 200, {record: ConsultationDetail} |

- 본인 담당 IN_PROGRESS만 허용한다. 중복 완료·이전 상태 복귀는 409다.
- symptoms·consultationText는 공백 아닌 문자열로 받는다. 특이사항·병증 선택·직접 병명은 없을 수 있다.
- 상담 내용·선택 저장과 COMPLETED·완료시각·상태 이력을 한 트랜잭션으로 처리한다.
- 처방전 저장·전달은 실행하지 않는다.

### 5.3 목록·상세·정정 이력

| 방식·경로 | 요청 | 성공 응답 |
|---|---|---|
| GET /api/consultations | patientId?: integer, visitId?: integer | 200, {records: ConsultationSummary[], total: integer} |
| GET /api/consultations/{caseId} | 없음 | 200, {record: ConsultationDetail} |
| GET /api/consultations/{caseId}/revisions | 없음 | 200, {records: ChangeRecord[], total: integer} |

- 두 필터가 있으면 모두 일치하는 기록만 조회한다. 필터가 없으면 같은 한의원의 기록을 제공한다.
- 목록은 접수일시 내림차순·상담기록 ID 내림차순, 정정 이력은 정정시각·이력 ID 오름차순으로 반환한다.
- 다른 작성자의 기록도 원장·한의사가 조회할 수 있다. 수정 권한은 부여하지 않는다.

## 6. 검색·근거 응답 객체

### 6.1 Evidence

| 필드 | 자료형 | 반환 규칙 |
|---|---|---|
| sourceId·sourceTitle·dataVersion | string | 실제 원문과 검색 당시 버전에 연결 |
| sourceUrl | string | AI 근거는 8.4 경로, 일반 기업 조회 근거는 9.3 경로 |
| fileName·sheet·column·sourceLocation | string | 실제 출처 파일·시트·컬럼·원문 위치 |
| itemId·row | integer | 기업 항목 식별번호·엑셀 행번호. 서로 대체하지 않음 |
| excerpt | string | 실제 원문 발췌 |

원문·검색용 가공문·AI 요약을 구분한다. 누락된 출처를 LLM으로 생성하지 않는다. 확인 가능한 근거만 evidence에 넣고 근거가 없으면 []와 사유를 제공한다.

### 6.2 Explanation

| 필드 | 자료형 |
|---|---|
| status | NOT_REQUESTED / QUEUED / RUNNING / READY / WITHHELD / INCOMPLETE |
| text·message | string 또는 null |
| checkedItems·uncheckedItems·unexplainedSymptoms | string[] |

| status | 제공 내용 |
|---|---|
| NOT_REQUESTED | 더보기 전 추가 후보. 설명 작업 미등록 |
| QUEUED | “관련 이유 생성 대기 중”과 확인된 원문 |
| RUNNING | “관련 이유를 생성·확인 중”과 확인된 원문 |
| READY | 관련 이유·미설명 증상·확인 범위·원문 |
| WITHHELD | “설명 보류”와 사유·확인된 등록정보·원문·출처 |
| INCOMPLETE | “확인 미완료”와 사유·확인된 등록정보·원문·출처 |

- text는 READY에서만 반환한다. 나머지는 null이다. 검사 전 생성문을 반환하지 않는다.
- 원문·관계·인용 불일치 또는 설명의 모순·근거 부족은 WITHHELD다.
- 필수 검사 누락·형식 오류·판단 불가·시간 초과·분량 초과·답변 잘림은 INCOMPLETE다.
- 원문 없음은 “등록된 설명 원문이 없어 AI 설명을 제공할 수 없습니다”, 출처 미확인은 “출처 확인을 완료하지 못해 AI 설명을 제공하지 않습니다”로 알린다.
- 원문이 아예 없거나 출처를 확인하지 못한 항목은 설명 작업을 등록하지 않고 INCOMPLETE로 반환한다.
- 미설명 증상을 알리는 것 자체는 실패가 아니다. 검사 완료를 진단 확정·안전 보장으로 표시하지 않는다.

### 6.3 Ingredient

| 필드 | 자료형 |
|---|---|
| compositionId·id | integer 또는 null |
| name | 공백 아닌 string |
| amount | 소수 문자열 또는 null |
| unit·preparation·originalDoseInfo | string 또는 null |

| 구성 | id | compositionId | 용량·단위·가공법 |
|---|---|---|---|
| 원본 처방 구성 복사 | 원본 약재 ID | 원본 구성 행 ID | 원본값 보존 |
| 등록 약재 추가·교체 | 선택 약재 ID | null | 확인 가능한 등록정보만 사용. 확인할 수 없는 수치·단위는 null |
| 미등록 약재 직접 입력 | null | null | 없는 값을 생성하지 않고 null로 보존 |

원본 구성 행 ID가 있는 값은 해당 원본과 대조한다. 별도 수량·단위 변경 요청은 거절한다. 같은 약재라도 가공법 등이 다르면 구성 행을 합치지 않는다.

### 6.4 Caution

| 필드 | 자료형 |
|---|---|
| status | RULES_NOT_REVIEWED / PATIENT_INFO_INSUFFICIENT / SOURCE_NOT_REGISTERED / CHECKED / INCOMPLETE |
| registeredTexts | string[] |
| message | string 또는 null |

- 검토된 규칙으로만 등록 주의·부작용·금기를 대조한다.
- 검사 오류는 INCOMPLETE, 규칙 미검토는 RULES_NOT_REVIEWED, 필요한 환자정보 부족은 PATIENT_INFO_INSUFFICIENT, 등록 주의 원문 없음은 SOURCE_NOT_REGISTERED로 반환한다.
- 복수 사유가 있으면 위 순서의 첫 상태를 status로 하고 message에 확인된 사유를 모두 제공한다.
- CHECKED는 적용할 규칙과 자료의 대조 완료다. 안전 판정으로 표시하지 않는다.
- 자동 감점·제외·새로운 처방 조합은 하지 않는다.

### 6.5 Candidate·PrescriptionCandidate

| Candidate 필드 | 자료형 |
|---|---|
| id | integer |
| name | string |
| score | number 또는 null |
| rank | integer 또는 null |
| evidence | Evidence[] |
| explanation | Explanation |

PrescriptionCandidate는 Candidate에 evaluationStatus: SCORED / INSUFFICIENT_DATA / POLICY_NOT_CONFIGURED, ingredients: Ingredient[], caution: Caution을 추가한다.

- 병증 score는 RRF, 처방 score는 처방 자체 설명의 코사인 유사도다. 확률·백분율로 변환하지 않는다.
- rank는 1부터 시작한다. 평가하지 않은 처방의 score·rank는 null이다.

### 6.6 검색 응답

**DiseaseSearchResult**

| 필드 | 자료형 |
|---|---|
| kind | DISEASE |
| caseId | integer |
| searchId | string |
| symptoms | string |
| candidates | Candidate[] |
| total | integer |
| hasPendingExplanations·cancelRequested | boolean |
| message | string 또는 null |

**PrescriptionSearchResult**

| 필드 | 자료형 |
|---|---|
| kind | PRESCRIPTION |
| caseId·selectedDiseaseId | integer |
| diseaseSearchId·searchId·symptoms | string |
| candidates·unscoredCandidates | PrescriptionCandidate[] |
| summary | {connectedCount: integer, scoredCount: integer, insufficientCount: integer, policyUnconfiguredCount: integer} |
| hasPendingExplanations·cancelRequested | boolean |
| message | string 또는 null |

## 7. 병증·처방 검색 — 민준

### 7.1 병증 검색 — POST /api/ai/symptoms

| 요청 | 성공 응답 |
|---|---|
| caseId: integer, symptoms: 공백 아닌 string | 200, DiseaseSearchResult |

- 해당 상담의 작성자·접수 연결·소속을 검사한다. 앞뒤 공백을 제거한 증상 입력을 검색 스냅샷에 저장한다.
- 화면은 마지막 입력 변경 후 0.8초 동안 추가 입력이 없으면 요청한다. 빈 입력은 요청하지 않고 이전 결과·선택을 해제한다.
- 초기 병증 범위는 감기 7·두통 20·소화불량 17의 세부 병증 44개다.
- 기업 키워드·원문 대조 일상어에서 입력 문자열이 연속해서 포함되는 항목을 찾는다. 글자를 분리한 일부 일치는 사용하지 않는다.
- 키워드 경로는 연결 병증 ID를 중복 제거하고 병증명 가나다순으로 최대 30개를 확보한다.
- 의미 경로는 같은 병증에 속한 조각들의 코사인 유사도 최댓값을 대표 점수로 삼아 최대 30개를 확보한다.
- RRF는 각 경로의 1/(60+순위)를 합산한다. 순위는 1부터, 경로 가중치는 동일하게 적용한다. 정상 경로에서 미등장한 병증의 해당 경로 기여는 0이다.
- 통합점수 내림차순, 실제 동점은 병증명 가나다순으로 정렬한다. 표시용 반올림 전 점수로 비교한다. 이름까지 같으면 ID 오름차순으로 정렬한다.
- 한 경로라도 실행 오류이면 정상 통합 결과로 반환하지 않는다. 실패 이력을 저장하고 503 또는 예상 외 오류 500으로 반환한다.
- 후보 전체·전체 건수·새 searchId를 반환한다. 화면은 searchId를 diseaseSearchId로 보관한다.
- 정상 0건은 candidates=[], total=0, “현재 검색 범위에서 관련 병증을 찾지 못했습니다”로 안내한다.
- 결과 없음만으로 검색 범위 밖·기업 원본 부재를 단정하지 않는다. 임의 유사도 임계값을 추가하지 않는다.

### 7.2 연결 처방 검색 — POST /api/ai/prescriptions

요청

```json
{
  "caseId": 101,
  "diseaseSearchId": "7001",
  "symptoms": "기침이 나고 목이 간질간질해요.",
  "selectedDiseases": [260]
}
```

성공: 200, PrescriptionSearchResult.

- 해당 상담의 작성자·접수 연결·소속을 검사한다.
- diseaseSearchId의 상담·작성자·검색 종류가 일치하는지 검사한다.
- 앞뒤 공백 제거 후 symptoms가 해당 병증 검색의 입력과 같고 selectedDiseases가 해당 결과에 포함된 ID 한 개인지 검사한다.
- 가장 최근 검색 번호만 허용하는 제한을 두지 않는다. 과거 번호라도 위 연결을 모두 확인하고 해당 검색 스냅샷으로 처리한다.
- 선택을 상담·병증 검색 이력에 저장하고 선택 병증에 기업 원본으로 연결된 처방만 조회한다.
- 자체 설명이 있는 처방은 조각별 코사인 유사도 최댓값으로 평가한다. 병증 RRF와 합치지 않는다.
- 점수 내림차순·실제 동점 처방명 가나다순·이름까지 같으면 ID 오름차순으로 정렬한다.
- SCORED는 candidates에, INSUFFICIENT_DATA·POLICY_NOT_CONFIGURED는 unscoredCandidates에 넣는다. 미평가 목록은 처방명 가나다순으로 반환한다.
- 자체 설명 없음은 INSUFFICIENT_DATA, 평가 정책 미설정은 POLICY_NOT_CONFIGURED로 구분한다. 두 경우 모두 점수·순위는 null이다.
- connectedCount = scoredCount + insufficientCount + policyUnconfiguredCount로 반환한다. 설정은 정상인데 실행이 실패하면 자료 부족으로 바꾸지 않고 503 또는 500으로 반환한다.
- 연결 0건은 “기업 자료에 연결된 처방이 없습니다”, 연결은 있으나 전부 자체 설명이 없으면 “연결 처방은 있으나 설명 평가 자료가 없습니다”로 안내한다.
- 새 처방 검색 searchId를 발급한다. 화면은 이를 prescriptionSearchId로 보관한다.
- 직접 기록한 병명에 임의 기업 ID를 만들어 보내지 않는다. 일반 기업 처방 조회·직접 작성으로 연결한다.

### 7.3 화면 적용 — 상준

- 후보는 서버의 최종 순서대로 상위 3개를 먼저 표시한다. 3개 이하면 모두 표시한다.
- 더보기 선택 시 이번 검색의 전체 결과를 표시한다. 최대 10개 제한을 적용하지 않는다.
- 자료 부족·정책 미설정 처방은 정상 순위 목록과 구분하고 처방명·건수·사유를 표시한다.
- 병증은 기업 ID 한 개를 선택한다. 이름을 식별번호처럼 사용하지 않는다.
- 입력 변경 시 같은 caseId는 유지하고 이전 병증·처방 선택 및 현재 검색 번호를 해제한다.
- 화면의 요청 순번을 비교해 이전 입력의 늦은 응답을 적용하지 않는다. 늦게 받은 이전 searchId의 작업에도 중단 요청을 보낸다.

## 8. 설명·원문·검색 이력 — 민준

### 8.1 검색 결과·설명 상태 — GET /api/ai/searches/{searchId}

| 요청 | 성공 응답 |
|---|---|
| 없음 | 200, 해당 검색 종류의 DiseaseSearchResult 또는 PrescriptionSearchResult |

- 저장된 순위·근거 스냅샷과 최신 설명 상태를 반환한다. 검색을 재실행하거나 현재 데이터로 재순위를 매기지 않는다.
- 같은 한의원 원장·한의사에게 조회를 허용한다. 작업 추가·중단은 작성자만 허용한다.
- 목록 검색 자체가 실패한 기록은 해당 실패의 Error와 HTTP 500/503을 반환한다. 빈 정상 결과로 반환하지 않는다.
- hasPendingExplanations는 등록된 작업 중 QUEUED·RUNNING이 하나라도 있을 때만 true다.
- 화면은 작업 등록 후 hasPendingExplanations=true 동안만 조회한다. 초기 조회 간격은 설정값 EXPLANATION_POLL_INTERVAL_MS=2000을 사용한다.
- false·화면 이탈·입력 변경 시 조회를 중단한다. 2초는 변경 가능한 조회 설정이며 검색 성능 목표로 사용하지 않는다.

### 8.2 추가 설명 — POST /api/ai/searches/{searchId}/explanations

| 요청 | 성공 응답 |
|---|---|
| candidateIds: 중복 없는 integer[] | 202, {searchId: string, acceptedCandidateIds: integer[], existingCandidateIds: integer[]} |

- 최초 검색 직후 평가 가능한 상위 3개 설명을 서버가 자동 등록한다.
- 화면은 더보기로 추가 표시된 평가 가능 후보 ID를 이 API에 전달한다.
- 요청 ID가 해당 검색의 실제 후보이며 원문·출처를 사용할 수 있는지 검사한다. 자료 부족·정책 미설정 후보는 설명 요청 대상에서 제외한다.
- 새 작업은 acceptedCandidateIds, 이미 등록됐거나 종료된 작업은 existingCandidateIds로 반환한다. 후보당 작업은 한 번만 등록한다.
- WITHHELD·INCOMPLETE도 자동 재시도하지 않는다. 새 검색 실행은 새 searchId로 처리한다.
- cancelRequested=true인 작업의 추가 등록은 409로 거절한다.
- 후보 한 개의 생성·검사 종료 후 다음 후보를 처리한다. 완료한 결과부터 제공한다.

### 8.3 작업 중단 — POST /api/ai/searches/{searchId}/cancel

| 요청 | 성공 응답 |
|---|---|
| 없음 | 200, {searchId: string, cancelRequested: true} |

- 입력 변경·비움·화면 이탈 시 작성자의 기존 검색 작업에 요청한다. 반복 요청은 같은 200 응답을 반환한다.
- 대기 작업을 해제하고 미시작 작업은 INCOMPLETE·입력 변경/이탈에 따른 중단 사유로 종료한다.
- 실행 중인 모델 호출에 중단을 요청한다. 즉시 중단이 지원되지 않으면 종료 또는 호출 제한시간까지 기다려 자원을 정리한다. 정리 전에 다음 모델 작업을 시작하지 않는다.
- 취소 요청 접수·실제 호출 종료·자원 정리를 구분해 기록한다. 200을 실제 GPU 실행 종료의 보장으로 사용하지 않는다.
- 검사 완료된 과거 결과·원문·검색 이력은 삭제하지 않는다. 중단된 호출의 생성문은 새 검색 결과로 제공하지 않는다.

### 8.4 원문 조회 — GET /api/ai/sources/{sourceId}

| 쿼리 | 성공 응답 |
|---|---|
| searchId: string, 필수 | 200, {record: SourceDetail} |

SourceDetail은 Evidence에 originalText: string을 추가한다.

- 검색 소속과 sourceId가 그 검색에 제공된 근거인지 검사한다.
- 검색 당시 저장한 원문 버전·원문 위치의 내용을 반환한다. 현재 원본의 수정값으로 과거 원문을 바꾸지 않는다.
- 실제 원문이 저장되지 않았으면 404와 사유를 반환한다. 허위 원문·URL을 생성하지 않는다.
- 화면은 제목·원문 위치·발췌·전체 원문을 제공한다. 로컬 엑셀 경로를 외부 원문 URL로 사용하지 않는다.

### 8.5 상담별 검색 목록 — GET /api/consultations/{caseId}/searches

| 요청 | 성공 응답 |
|---|---|
| 없음 | 200, {records: SearchSummary[], total: integer} |

| SearchSummary 필드 | 자료형 |
|---|---|
| searchId | string |
| kind | DISEASE / PRESCRIPTION |
| caseId | integer |
| symptoms | string |
| diseaseSearchId | string 또는 null |
| selectedDiseaseId | integer 또는 null |
| status | RUNNING / COMPLETED / FAILED |
| cancelRequested | boolean |
| createdAt | 시각 문자열 |
| elapsedMs | integer 또는 null |
| failureReason | string 또는 null |

- 검색 생성시각·검색 ID 오름차순으로 반환한다. RUNNING/COMPLETED/FAILED는 후보 목록 검색의 상태다. AI 설명 상태와 구분한다.
- 목록 검색시간 elapsedMs는 설명 생성·검토 대기시간과 분리한다.
- 상세 후보·설명·근거는 8.1을 사용한다. 실패 기록도 목록에서 실패 원인을 확인할 수 있게 한다.

## 9. 기업 처방·약재·효능 조회 — 민준 API·상준 화면

### 9.1 검색 — GET /api/catalog/search

| 쿼리 | 성공 응답 |
|---|---|
| type: prescription / herb / efficacy, query: string | 200, {items: CatalogItem[], total: integer, message: string|null} |

CatalogItem: {id: integer, name: string}.

- 같은 기업 항목의 ID를 중복 제거한다. 검색어 앞뒤 공백을 제거한 연속 포함으로 찾고 이름 가나다순·같은 이름 ID순으로 반환한다.
- 빈 검색어는 items=[]로 반환한다. 약재명 일부 일치를 허용한다.
- 이 조회는 기업 원본 항목을 조회한다. 환자 처방 저장본 조회와 구분한다.
- 처방 자체 설명이 없어도 검색 결과에 포함한다. 일반 기업 조회를 AI 병증 검색 44개 범위로 제한하지 않는다.
- 조회 결과 없음은 200, 조회 장애는 500/503으로 구분한다.

### 9.2 상세 — GET /api/catalog/{type}/{itemId}

| 쿼리 | 성공 응답 |
|---|---|
| selectedDiseaseId?: integer | 200, {record: CatalogDetail} |

| CatalogDetail 공통 필드 | 자료형 |
|---|---|
| id | integer |
| type | prescription / herb / efficacy |
| name | string |
| description | string 또는 null |
| evidence | Evidence[] |
| registeredCautionTexts | string[] |
| relations | CatalogRelations |
| messages | string[] |

CatalogRelations는 diseases·prescriptions·herbs·efficacies를 모두 CatalogItem[]로 반환한다. 원본 관계가 없는 배열은 []다.

처방 상세는 usageText: string|null, ingredients: Ingredient[], connectedToSelectedDisease: boolean|null을 추가한다. 약재·효능 상세는 공통 필드를 반환한다.

- description·조제/용법·약재·주의 원문을 저장 자료에서 반환한다. 원문·관계·출처를 생성하지 않는다.
- selectedDiseaseId는 처방 상세에서만 사용한다. 있으면 실제 병증-처방 연결 여부를 반환하고 없으면 null로 한다.
- description=null이면 “등록된 설명 없음”, 주의 원문이 없으면 “등록된 주의정보 없음”을 messages에 제공한다.
- 주의정보 없음과 환자정보 부족을 혼동하지 않는다. 일반 조회 자체로 환자에게 안전하다고 판단하지 않는다.
- 조제/용법·구성·다른 등록정보가 있으면 설명 원문이 없어도 제공한다.
- 원문 근거 클릭에 필요한 sourceUrl·sourceId는 기업 항목 상세용 경로 /api/catalog/{type}/{itemId}/sources/{sourceId}로 반환한다.

### 9.3 일반 조회 원문 — GET /api/catalog/{type}/{itemId}/sources/{sourceId}

요청: 없음. 성공: 200, {record: SourceDetail}.

- 해당 기업 항목의 실제 원문인지 검사하고 상세에 사용한 버전의 원문을 반환한다.
- 검색 이력이 없는 일반 조회에 임의 searchId를 발급하거나 다른 상담 검색 ID를 사용하지 않는다.
- SourceDetail의 sourceUrl은 이 경로를 사용한다. 실제 원문이 없으면 404로 반환한다.

## 10. 처방전 저장·정정·전달 — 상준

### 10.1 PrescriptionWrite

| 요청 필드 | 자료형 | 규칙 |
|---|---|---|
| caseId | integer | 필수. 연결 상담 |
| diagnosisText | string 또는 null | 필수 키. 이번 처방에 기록할 병명. 미기록은 null |
| prescriptionId | integer 또는 null | 필수 키. 복사한 기업 처방 ID |
| prescriptionSearchId | string 또는 null | 필수 키. AI 추천을 사용한 처방 검색 번호 |
| prescriptionName | 공백 아닌 string | 필수. 최종 처방명 |
| prescriptionText | string 또는 null | 필수 키. 작성한 처방 내용 |
| ingredients | Ingredient[] | 필수. 최종 구성 전체 |

| 작성 경로 | prescriptionId | prescriptionSearchId |
|---|---|---|
| AI 처방 추천 선택 후 편집 | 선택 기업 처방 ID | 해당 처방 검색 searchId |
| 일반 기업 처방 조회 선택 후 편집 | 선택 기업 처방 ID | null |
| 직접 작성 | null | null |

- AI 추천은 같은 caseId의 처방 검색과 실제 후보 ID인지 검사한다. 일반 조회는 기업 원본 ID 존재를 검사한다.
- prescriptionId=null인데 prescriptionSearchId가 있으면 400이다.
- 기업 원본은 수정하지 않는다. 최종 처방명·처방 내용·구성은 환자별 저장본으로 보존한다.
- 원본 구성 복사·등록 약재 추가/교체·직접 약재 입력은 6.3의 ID·원문 규칙을 적용한다.
- 약재 추가·삭제·교체는 허용하고 별도 수량·단위 편집은 허용하지 않는다. 기존 원본 구성의 수치·단위·가공법을 무조건 클라이언트 값으로 덮어쓰지 않는다.
- 병명은 해당 버전의 값으로 저장한다. 후속 상담 정정으로 이미 저장·전달된 버전의 병명을 변경하지 않는다.

### 10.2 저장 — POST /api/prescriptions

| 요청 | 성공 응답 |
|---|---|
| PrescriptionWrite | 201, {record: PrescriptionVersion} |

- 상담 소속·로그인 작성자를 확인한다. 환자·방문은 caseId에서 조회해 연결한다.
- 처방전·버전 1·구성·작성자·저장시각을 한 트랜잭션으로 저장한다.
- 선택 처방의 검색 ID·원본 처방 ID를 검색 선택 이력과 연결한다. 검색 이력을 덮어쓰지 않는다.
- 저장 성공만으로 안내데스크에 전달하지 않는다.
- 실패 시 기존 기록을 유지하고 “처방을 저장하지 못했습니다”로 안내한다.

### 10.3 정정 — PATCH /api/prescriptions/{rxId}

| 요청 | 성공 응답 |
|---|---|
| PrescriptionWrite + versionId: integer + reason: 공백 아닌 string | 200, {record: PrescriptionVersion} |

- 작성자만 허용한다. caseId 변경은 거절한다. 요청 versionId가 해당 처방의 현재 버전과 다르면 409다.
- 변경 항목·전후 값·처리자·시각·사유와 기존 버전을 보존한다.
- 현재 처방 연결·새 버전·구성·변경 이력을 한 트랜잭션으로 저장한다.
- 전달된 처방도 작성자는 새 버전으로 정정할 수 있다. 이전 전달본은 유지하고 수정본은 별도로 전달한다.
- 저장본·버전·전달 이력을 삭제하는 API는 제공하지 않는다.

### 10.4 전달 — PATCH /api/prescriptions/{rxId}/send

| 요청 | 성공 응답 |
|---|---|
| versionId: integer | 200, {record: DeliverySummary} |

- 로그인 작성자·처방전·지정 저장 버전의 연결을 검사한다.
- 지정한 버전의 전달 기록·상태·전달시각을 저장한다. 미저장 화면 편집 내용을 전송하지 않는다.
- 같은 버전의 반복 전송 요청은 기존 전달 기록을 반환한다. 새 버전 전송은 새 전달 기록을 만든다.
- 전달 저장 실패는 “처방전 전달을 완료하지 못했습니다”로 알리고 이전 전달본·저장본을 유지한다.
- 업무채팅을 공식 전달로 처리하지 않는다. 전달본은 같은 한의원 안내데스크에 제공한다.

### 10.5 처방 응답 객체

**PrescriptionSummary**

| 필드 | 자료형 |
|---|---|
| id·caseId·visitId·patientId·authorId | integer |
| patientName·birthDate·authorName | string |
| registeredAt·createdAt·updatedAt | 시각 문자열 |
| diagnosisText | string 또는 null |
| prescriptionName | string |
| currentVersionId·currentVersionNo | integer |
| lastDeliveredVersionId | integer 또는 null |
| lastDeliveredAt | 시각 문자열 또는 null |

**PrescriptionVersion**

| 필드 | 자료형 |
|---|---|
| rxId·versionId·versionNo | integer |
| caseId·visitId·patientId·authorId | integer |
| patientName·birthDate·authorName | string |
| registeredAt | 시각 문자열 |
| diagnosisText·prescriptionText | string 또는 null |
| prescriptionName | string |
| prescriptionId | integer 또는 null |
| prescriptionSearchId | string 또는 null |
| ingredients | Ingredient[] |
| savedBy | integer |
| savedByName | string |
| savedAt | 시각 문자열 |
| change | ChangeRecord 또는 null |

- 신규 저장의 change는 null이다. 정정 버전은 해당 변경 이력을 포함한다.
- 처방명·병명·내용·구성·저장자·저장시각·원본/검색 연결은 버전별로 보존한다.

**DeliverySummary**

| 필드 | 자료형 |
|---|---|
| id·rxId·versionId·versionNo·caseId·visitId·patientId·authorId | integer |
| patientName·birthDate·authorName | string |
| diagnosisText | string 또는 null |
| prescriptionName | string |
| registeredAt·savedAt·sentAt | 시각 문자열 |
| sentBy | integer |
| sentByName | string |

**DeliveryDetail**：DeliverySummary에 version: PrescriptionVersion을 추가한다. version은 전달 기록에 연결된 버전으로 조회한다.

## 11. 처방전·전달본 조회 — 상준

| 방식·경로 | 요청 | 성공 응답 |
|---|---|---|
| GET /api/prescriptions | caseId?: integer, patientId?: integer | 200, {records: PrescriptionSummary[], total: integer} |
| GET /api/prescriptions/{rxId}/versions | 없음 | 200, {records: PrescriptionVersion[], total: integer} |
| GET /api/prescriptions/{rxId}/versions/{versionId} | 없음 | 200, {record: PrescriptionVersion} |
| GET /api/prescription-deliveries | patientId?: integer, caseId?: integer | 200, {records: DeliverySummary[], total: integer} |
| GET /api/prescription-deliveries/{deliveryId} | 없음 | 200, {record: DeliveryDetail} |

- 필터가 여러 개이면 모두 일치하는 기록을 조회한다. 필터 소속·권한도 검사한다.
- 처방 목록은 최근 저장시각 내림차순·처방전 ID 내림차순, 버전 목록은 버전 번호 오름차순으로 반환한다.
- 전달 목록은 전달시각 내림차순·전달 ID 내림차순으로 반환한다.
- 안내데스크는 전달 API 목록·상세만 사용한다. 일반 처방전 목록·버전 API 접근은 차단한다.
- 전달 목록의 병명·처방명·내용·구성은 전달 버전에서 조회한다. 현재 최신 수정본으로 대체하지 않는다.
- 원장·한의사는 같은 한의원의 기록·버전을 조회할 수 있으나 다른 작성자의 수정·전송은 할 수 없다.

## 12. AI 생성·검사·저장 내부 규칙 — 민준

### 12.1 자료와 모델

| 항목 | 적용 규칙 |
|---|---|
| 기업 자료 | 원본 ID·기존 관계·원문·출처·버전 보존. 원본에 없는 항목·관계 생성 금지 |
| 일상어 연결 | 원문 대조 연결 40건을 키워드 경로에 사용. 같은 표현의 여러 병증 연결 보존 |
| 의미 검색 입력 | 병증 기업 설명·사용 키워드와 처방 자체 원문. 조사·평가 문장을 기업 원문처럼 적재하지 않음 |
| 임베딩 | intfloat/multilingual-e5-small, 384차원, 입력 query:·자료 passage:, 동일 모델·정규화 |
| 청킹 | 짧은 원문 유지. 긴 원문은 문장 경계 우선, E5 토크나이저 기준 조각 최대 300토큰. 필요 시 최대 50토큰 중첩, 중첩도 300토큰에 포함 |
| 자료 구분 | 다른 병증·처방의 원문을 한 조각에 혼합하지 않음 |
| 재변환 | 모델·분할 변경 시 재임베딩. 다른 모델/차원/버전·미완료 벡터는 정상 검색에 사용하지 않음 |
| LLM | 초기 Qwen3.5 4B. 지원 확인 후 긴 사고 생성을 끄는 일반 응답 모드 |
| 역할 | 생성과 보조 검토는 별도 지시문·호출. 같은 모델 두 호출을 독립 정답 검증으로 취급하지 않음 |
| 일반 설명 근거 | 후보에 연결된 유사도 상위 최대 3조각. 등록 주의·금기·서버 대조 결과는 별도 전달 |
| 요청 분량 | 모델 토크나이저 기준 전체 입력 최대 3,072토큰·출력 최대 1,024토큰. 검토 입력은 생성 설명도 포함 |
| 실행 | 후보 한 개씩 생성·검사 순차 처리. 설명용 모델은 한 개씩 메모리에 적재 |
| 호출 제한 | 생성 최대 60초·보조 검토 별도 최대 60초. 실제 호출 시작부터 측정하며 대기열 시간은 별도 기록 |
| 실패 | 자동 재시도 없음. 생성 실패 시 검토 생략·작업 정리 후 다음 후보 진행 |
| 개인정보 | 이름·연락처·주소를 LLM 요청에 전달하지 않음 |

필수 자료가 입력 한도를 넘으면 몰래 잘라 정상 설명으로 제공하지 않는다. 입력 초과·출력 잘림·응답 파싱 오류는 INCOMPLETE로 처리한다.

### 12.2 생성 JSON

```json
{
  "candidateId": 260,
  "sentences": [
    {
      "sentenceNo": 1,
      "text": "제공된 원문 안에서 작성한 관련 이유",
      "references": [
        {"sourceId": "현재_요청의_근거_ID", "quote": "실제 원문에 포함된 인용"}
      ]
    }
  ],
  "unexplainedSymptoms": []
}
```

- candidateId는 요청 대상과 같아야 한다. sentences는 하나 이상의 문장, sentenceNo는 1부터 중복 없이 연속한 정수로 한다.
- 각 설명 문장은 하나 이상의 references를 가진다. text·quote는 공백 아닌 문자열이다.
- sourceId는 현재 요청에 제공한 자료만 허용하고 quote는 그 원문에 존재해야 한다.
- 미설명 증상은 unexplainedSymptoms: string[]로 별도 반환한다. 근거 밖 진단·원인·안전 판단을 생성하지 않는다.

### 12.3 서버 검사와 보조 검토 JSON

- 서버는 검색 범위·등록 항목·해당 대상에 적용되는 표현-병증·병증-처방·처방-약재·약재-효능 관계와 현재 제공 근거·인용을 실제 자료에 대조한다.
- 검사별 내부 기록: {checkType: string, target: object, required: boolean, status: PASS/FAIL/NOT_CHECKED/ERROR, reason: string|null}.
- 적용하지 않는 관계 검사는 required=false로 기록한다. 필수 검사 누락·실행 오류를 PASS로 처리하지 않는다.
- 보조 검토에는 같은 증상·후보·원문·계산 근거·생성 문장을 전달한다. 점수·순위·검사 기준 변경 권한은 주지 않는다.

```json
{
  "candidateId": 260,
  "reviews": [
    {
      "sentenceNo": 1,
      "verdict": "GROUNDED",
      "reason": "제공된 근거와 설명을 대조한 이유",
      "sourceIds": ["현재_요청의_근거_ID"]
    }
  ]
}
```

| verdict | 판정 |
|---|---|
| GROUNDED | 근거 부합 |
| CONTRADICTED | 모순 |
| INSUFFICIENT_EVIDENCE | 근거 부족 |
| UNDETERMINED | 판단 불가 |

- 생성된 모든 문장에 판정이 정확히 하나 있어야 한다. 다른 후보·문장·근거 ID, 누락·중복은 형식 오류다.
- 필수 서버 검사 완료·불일치 없음·모든 문장 GROUNDED이면 READY로 제공한다.
- 서버 항목/관계/인용 불일치 또는 문장 모순/근거 부족이 확인되면 후보의 설명 전체를 WITHHELD로 한다.
- 판단 불가·필수 검사/형식 오류·시간 초과는 INCOMPLETE로 한다. 확정된 불일치와 미완료가 함께 있으면 WITHHELD로 보류하고 미완료 사유도 알린다.
- 자유 해석을 원문 인용 일치만으로 통과시키지 않는다. 같은 LLM의 판정을 임상 정답·안전 보장으로 표시하지 않는다.
- READY의 text는 검사 완료 문장을 번호순으로 연결해 작성한다. 사용자에게 내부 JSON·식별번호 대신 관련 이유·근거·미설명 증상·확인 범위를 표시한다.

### 12.4 이력 저장

| 대상 | 저장 항목 |
|---|---|
| 검색 연결 | caseId·searchId·검색 종류·작성자·입력·생성시각·참조 병증 검색·선택 ID |
| 검색 결과 | 경로별 후보·근거·점수·순위, RRF·처방 평가 결과, 주의정보 대조·선택 |
| 근거 | 원문 스냅샷·파일·시트·기업 항목 ID·행·컬럼·원문 위치·버전 |
| 설명·검사 | 후보·문장별 생성·보조 검토 결과, 서버 검사별 대상·판정·사유·제공 상태 |
| 실행 | 대기열 시간·호출시간·토큰·시간 초과·중단 요청/종료·실패/미완료 사유 |
| 버전 | 데이터·검색 범위·표현 연결·검색/평가/검사 정책·임베딩/생성/검토 모델·지시문·실제 배포본·양자화·Ollama |

재실행은 새 searchId로 저장하고 이전 실행·선택·원문을 덮어쓰지 않는다. 클라이언트 연결이 끊겨도 완료된 DB 기록을 삭제하지 않는다.

## 13. 오류 응답 — 상준 공통부·민준 AI 처리

```json
{
  "error": {
    "code": "INVALID_SELECTED_DISEASE",
    "message": "병증은 한 개만 선택해주세요.",
    "field": "selectedDiseases"
  }
}
```

error.code·message는 string, field는 string 또는 null이다. 화면은 error.message를 표시하고 실패한 저장·완료·전달을 성공으로 표시하지 않는다.

| HTTP | code | 조건 |
|---|---|---|
| 400 | INVALID_INPUT | 필수 키·자료형·쿼리·조합 오류, 빈 필수 문자열 |
| 400 | INVALID_SELECTED_DISEASE | 병증 선택 개수 오류·참조 검색 후보가 아닌 병증 |
| 401 | AUTH_REQUIRED | 세션 없음·만료·무효·잘못된 로그인 정보 |
| 403 | FORBIDDEN | 이용 중지·승인 전 계정·한의원 이용 중지·타 한의원·직무/작성 권한 없음 |
| 404 | NOT_FOUND | 상담·검색·기업 항목·처방전·버전·전달 기록·원문 없음 |
| 409 | STATE_CONFLICT | 허용되지 않은 방문 상태, 중복 시작/완료, 상담·입력 연결 불일치, 현재 처방 버전 불일치, 중단 작업에 추가 설명 요청 |
| 500 | INTERNAL_ERROR | 예상하지 못한 서버 오류 |
| 503 | SERVICE_UNAVAILABLE | DB·필수 검색 경로·임베딩 실행 등 서비스 의존성 장애 |

- 기본 입력 검증의 422는 공통 처리에서 위 400 형식으로 통일한다.
- 정상 0건·등록 설명 없음·정책 미설정은 정상 200 응답으로 구분한다. 실제 실행 장애를 이 상태로 숨기지 않는다.
- 후보 목록 성공 후 개별 AI 설명 실패는 전체 목록의 HTTP 오류로 바꾸지 않고 해당 Explanation에 기록한다.
- 다른 작성자 기록의 조회 권한과 수정 권한을 분리한다. 존재하지만 접근 권한이 없으면 403을 반환한다.
- 서버 내부 오류·접속 비밀·비밀번호·세션 토큰을 message에 포함하지 않는다.

