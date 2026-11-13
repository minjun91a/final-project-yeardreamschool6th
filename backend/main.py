from models import Patient
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sqlalchemy import text
from database import engine


app = FastAPI(title="한의결 API")
@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request, exc):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "데이터베이스 처리 중 오류가 발생했습니다."
        }
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {"message": "한의결 백엔드 서버 실행 성공"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/db-health")
def db_health():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))

            return {
                "status": "ok",
                "database": "connected",
                "result": result.scalar_one(),
                "patient_table": Patient.name
            }
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="데이터베이스 연결에 실패했습니다."
        )



class SymptomRequest(BaseModel):
    symptoms: str


@app.post("/api/diagnosis/recommend")
def recommend_diagnosis(request: SymptomRequest):
    if not request.symptoms.strip():
        return {
            "candidates": [],
            "message": "증상을 입력해 주세요."
        }

    return {
        "candidates": [],
        "message": "AI 병증 추천 기능은 아직 연결되지 않았습니다."
    }

from fastapi import HTTPException

class PatientCreate(BaseModel):
    name: str
    birthDate: str
    phone: str
    address: str
    guardianName: str = ""
    guardianRelation: str = ""
    guardianPhone: str = ""


@app.post("/api/patients", status_code=201)
def create_patient(patient: PatientCreate):
    if not all([
        patient.name.strip(),
        patient.birthDate.strip(),
        patient.phone.strip(),
        patient.address.strip()
    ]):
        raise HTTPException(
            status_code=400,
            detail="필수 환자 정보를 모두 입력해 주세요."
        )

    try:
        birth_date = datetime.strptime(
            patient.birthDate, "%Y-%m-%d"
        ).date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="생년월일 형식이 올바르지 않습니다."
        )

    with engine.begin() as connection:
        patient_id = connection.execute(
            text("""
                INSERT INTO "PATIENT" (
                    "CLINIC_UNIQN",
                    "NAME",
                    "BIRTH_DATE",
                    "PHONE",
                    "ADDRESS",
                    "GUARDIAN_NAME",
                    "GUARDIAN_RELATION",
                    "GUARDIAN_PHONE"
                )
                VALUES (
                    1,
                    :name,
                    :birth_date,
                    :phone,
                    :address,
                    :guardian_name,
                    :guardian_relation,
                    :guardian_phone
                )
                RETURNING "PATIENT_UNIQN"
            """),
            {
                "name": patient.name.strip(),
                "birth_date": birth_date,
                "phone": patient.phone.strip(),
                "address": patient.address.strip(),
                "guardian_name": patient.guardianName.strip() or None,
                "guardian_relation": patient.guardianRelation.strip() or None,
                "guardian_phone": patient.guardianPhone.strip() or None
            }
        ).scalar_one()

    return {
        "message": "환자 등록이 완료되었습니다.",
        "patient": {
            "id": patient_id,
            **patient.model_dump()
        }
    }

@app.get("/api/patients")
def get_patients():
    with engine.connect() as connection:
        rows = connection.execute(
            text("""
                SELECT
                    "PATIENT_UNIQN",
                    "NAME",
                    "BIRTH_DATE",
                    "PHONE",
                    "ADDRESS",
                    "GUARDIAN_NAME",
                    "GUARDIAN_RELATION",
                    "GUARDIAN_PHONE"
                FROM "PATIENT"
                WHERE "CLINIC_UNIQN" = 1
                ORDER BY "PATIENT_UNIQN"
            """)
        ).mappings().all()

    patients = [
        {
            "id": row["PATIENT_UNIQN"],
            "name": row["NAME"],
            "birthDate": row["BIRTH_DATE"].isoformat(),
            "phone": row["PHONE"],
            "address": row["ADDRESS"],
            "guardianName": row["GUARDIAN_NAME"] or "",
            "guardianRelation": row["GUARDIAN_RELATION"] or "",
            "guardianPhone": row["GUARDIAN_PHONE"] or ""
        }
        for row in rows
    ]

    return {"patients": patients}

@app.patch("/api/patients/{patient_id}")
def update_patient(patient_id: int, patient: PatientCreate):
    if not all([
        patient.name.strip(),
        patient.birthDate.strip(),
        patient.phone.strip(),
        patient.address.strip()
    ]):
        raise HTTPException(
            status_code=400,
            detail="필수 환자 정보를 모두 입력해 주세요."
        )

    try:
        birth_date = datetime.strptime(
            patient.birthDate, "%Y-%m-%d"
        ).date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="생년월일 형식이 올바르지 않습니다."
        )

    with engine.begin() as connection:
        updated = connection.execute(
            text("""
                UPDATE "PATIENT"
                SET
                    "NAME" = :name,
                    "BIRTH_DATE" = :birth_date,
                    "PHONE" = :phone,
                    "ADDRESS" = :address,
                    "GUARDIAN_NAME" = :guardian_name,
                    "GUARDIAN_RELATION" = :guardian_relation,
                    "GUARDIAN_PHONE" = :guardian_phone
                WHERE "PATIENT_UNIQN" = :patient_id
                  AND "CLINIC_UNIQN" = 1
                RETURNING "PATIENT_UNIQN"
            """),
            {
                "patient_id": patient_id,
                "name": patient.name.strip(),
                "birth_date": birth_date,
                "phone": patient.phone.strip(),
                "address": patient.address.strip(),
                "guardian_name": patient.guardianName.strip() or None,
                "guardian_relation": patient.guardianRelation.strip() or None,
                "guardian_phone": patient.guardianPhone.strip() or None
            }
        ).scalar_one_or_none()

    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="수정할 환자를 찾을 수 없습니다."
        )

    return {
        "message": "환자 정보가 수정되었습니다.",
        "patient": {
            "id": patient_id,
            **patient.model_dump()
        }
    }

class WaitingPatient(BaseModel):
    id: int
    name: str
    birthDate: str
    phone: str
    address: str

# 임시 대기 목록 (서버 재시작 시 초기화)
waiting_patients = []



@app.get("/api/waiting")
def get_waiting_patients():
    with engine.connect() as connection:
        rows = connection.execute(
            text("""
                SELECT
                    v."VISIT_UNIQN",
                    v."PATIENT_UNIQN",
                    v."STATUS_CD",
                    p."NAME",
                    p."BIRTH_DATE",
                    p."PHONE",
                    p."ADDRESS"
                FROM "VISIT" v
                JOIN "PATIENT" p
                    ON v."PATIENT_UNIQN" = p."PATIENT_UNIQN"
                WHERE p."CLINIC_UNIQN" = 1
                  AND v."STATUS_CD" IN (
                      'WAITING',
                      'IN_PROGRESS',
                      'COMPLETED'
                  )
                ORDER BY v."REGISTERED_AT", v."VISIT_UNIQN"
            """)
        ).mappings().all()

    status_map = {
        "WAITING": "대기",
        "IN_PROGRESS": "진료 중",
        "COMPLETED": "완료"
    }

    patients = [
        {
            "id": row["PATIENT_UNIQN"],
            "visitId": row["VISIT_UNIQN"],
            "name": row["NAME"],
            "birthDate": row["BIRTH_DATE"].isoformat(),
            "phone": row["PHONE"],
            "address": row["ADDRESS"],
            "status": status_map[row["STATUS_CD"]]
        }
        for row in rows
    ]

    return {"patients": patients}






@app.post("/api/waiting")
def register_waiting_patient(patient: WaitingPatient):
    with engine.begin() as connection:
        existing_patient = connection.execute(
            text("""
                SELECT "PATIENT_UNIQN"
                FROM "PATIENT"
                WHERE "PATIENT_UNIQN" = :patient_id
                  AND "CLINIC_UNIQN" = 1
            """),
            {"patient_id": patient.id}
        ).scalar_one_or_none()

        if existing_patient is None:
            raise HTTPException(
                status_code=404,
                detail="등록되지 않은 환자입니다."
            )

        existing_visit = connection.execute(
            text("""
                SELECT "VISIT_UNIQN"
                FROM "VISIT"
                WHERE "PATIENT_UNIQN" = :patient_id
                  AND "STATUS_CD" IN ('WAITING', 'IN_PROGRESS')
                LIMIT 1
            """),
            {"patient_id": patient.id}
        ).scalar_one_or_none()

        if existing_visit is not None:
            raise HTTPException(
                status_code=409,
                detail="이미 상담 대기 또는 진료 중인 환자입니다."
            )

        visit_id = connection.execute(
            text("""
                INSERT INTO "VISIT" (
                    "PATIENT_UNIQN",
                    "REGISTERED_BY",
                    "STATUS_CD",
                    "WAITING_AT"
                )
                VALUES (
                    :patient_id,
                    :registered_by,
                    'WAITING',
                    CURRENT_TIMESTAMP
                )
                RETURNING "VISIT_UNIQN"
            """),
            {
                "patient_id": patient.id,
                "registered_by": 1
            }
        ).scalar_one()

    new_patient = {
        **patient.model_dump(),
        "visitId": visit_id,
        "status": "대기"
    }

    waiting_patients.append(new_patient)

    return {
        "message": "상담 대기 등록이 완료되었습니다.",
        "patient": new_patient
    }



class WaitingStatusUpdate(BaseModel):
    status: str
    doctor: str | None = None



@app.patch("/api/waiting/{patient_id}")
def update_waiting_status(patient_id: int, request: WaitingStatusUpdate):
    if request.status == "진료 중":
        before_status = "WAITING"
        after_status = "IN_PROGRESS"
        error_message = "대기 중인 환자만 상담을 시작할 수 있습니다."

    elif request.status == "대기":
        before_status = "IN_PROGRESS"
        after_status = "WAITING"
        error_message = "진료 중인 환자만 상담을 취소할 수 있습니다."

    else:
        raise HTTPException(
            status_code=400,
            detail="올바르지 않은 상태입니다."
        )

    with engine.begin() as connection:
        row = connection.execute(
            text("""
                UPDATE "VISIT"
                SET
                    "STATUS_CD" = CAST(:after_status AS VARCHAR),
                    "STARTED_AT" = CASE
                        WHEN CAST(:after_status AS VARCHAR) = 'IN_PROGRESS'
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END,
                    "WAITING_AT" = CASE
                        WHEN CAST(:after_status AS VARCHAR) = 'WAITING'
                        THEN CURRENT_TIMESTAMP
                        ELSE "WAITING_AT"
                    END
                WHERE "VISIT_UNIQN" = (
                    SELECT "VISIT_UNIQN"
                    FROM "VISIT"
                    WHERE "PATIENT_UNIQN" = :patient_id
                      AND "STATUS_CD" = :before_status
                    ORDER BY "VISIT_UNIQN" DESC
                    LIMIT 1
                )
                  AND "STATUS_CD" = :before_status
                RETURNING "VISIT_UNIQN"
            """),
            {
                "patient_id": patient_id,
                "before_status": before_status,
                "after_status": after_status
            }
        ).scalar_one_or_none()

    if row is None:
        raise HTTPException(
            status_code=409,
            detail=error_message
        )

    return {
        "message": "환자 상태가 변경되었습니다.",
        "patient": {
            "id": patient_id,
            "visitId": row,
            "status": request.status,
            "doctor": request.doctor if request.status == "진료 중" else None
        }
    }




@app.delete("/api/waiting/{patient_id}")
def cancel_waiting_reception(patient_id: int):
    with engine.begin() as connection:
        visit_id = connection.execute(
            text("""
                UPDATE "VISIT"
                SET "STATUS_CD" = 'CANCELLED'
                WHERE "VISIT_UNIQN" = (
                    SELECT "VISIT_UNIQN"
                    FROM "VISIT"
                    WHERE "PATIENT_UNIQN" = :patient_id
                      AND "STATUS_CD" = 'WAITING'
                    ORDER BY "VISIT_UNIQN" DESC
                    LIMIT 1
                )
                  AND "STATUS_CD" = 'WAITING'
                RETURNING "VISIT_UNIQN"
            """),
            {"patient_id": patient_id}
        ).scalar_one_or_none()

    if visit_id is None:
        raise HTTPException(
            status_code=409,
            detail="대기 중인 환자만 접수를 취소할 수 있습니다."
        )

    return {
        "message": "접수가 취소되었습니다."
    }


from datetime import datetime
from uuid import uuid4


class ConsultationRecord(BaseModel):
    patientId: int
    symptoms: str
    selectedCandidates: list[str]
    additionalNotes: str = ""


consultation_records = []




@app.post("/api/consultations", status_code=201)
def save_consultation(request: ConsultationRecord):
    if not request.symptoms.strip():
        raise HTTPException(
            status_code=400,
            detail="증상을 입력해 주세요."
        )

    with engine.begin() as connection:
        patient = connection.execute(
            text("""
                SELECT
                    p."NAME",
                    v."VISIT_UNIQN"
                FROM "VISIT" v
                JOIN "PATIENT" p
                    ON v."PATIENT_UNIQN" = p."PATIENT_UNIQN"
                WHERE v."PATIENT_UNIQN" = :patient_id
                  AND p."CLINIC_UNIQN" = 1
                  AND v."STATUS_CD" = 'IN_PROGRESS'
                ORDER BY v."VISIT_UNIQN" DESC
                LIMIT 1
                FOR UPDATE OF v
            """),
            {"patient_id": request.patientId}
        ).mappings().first()

        if patient is None:
            raise HTTPException(
                status_code=409,
                detail="진료 중인 환자만 상담일지를 저장할 수 있습니다."
            )

        case_id = connection.execute(
            text("""
                INSERT INTO "CASE_RECORD" (
                    "VISIT_UNIQN",
                    "AUTHOR_UNIQN",
                    "SYMPTOM_TEXT",
                    "CONSULTATION_TEXT",
                    "SPECIAL_NOTE"
                )
                VALUES (
                    :visit_id,
                    :author_id,
                    :symptoms,
                    :consultation_text,
                    :special_note
                )
                RETURNING "CASE_UNIQN"
            """),
            {
                "visit_id": patient["VISIT_UNIQN"],
                "author_id": 2,
                "symptoms": request.symptoms.strip(),
                "consultation_text": ", ".join(request.selectedCandidates),
                "special_note": request.additionalNotes.strip()
            }
        ).scalar_one()

        connection.execute(
            text("""
                UPDATE "VISIT"
                SET
                    "STATUS_CD" = 'COMPLETED',
                    "COMPLETED_AT" = CURRENT_TIMESTAMP
                WHERE "VISIT_UNIQN" = :visit_id
            """),
            {"visit_id": patient["VISIT_UNIQN"]}
        )

    record = {
        "id": str(case_id),
        **request.model_dump(),
        "patientName": patient["NAME"],
        "createdAt": datetime.now().astimezone().isoformat()
    }

    consultation_records.append(record)

    return {
        "message": "상담일지가 저장되었습니다.",
        "record": record
    }







@app.get("/api/consultations")
def get_consultations():
    with engine.connect() as connection:
        rows = connection.execute(
            text("""
                SELECT
                    c."CASE_UNIQN",
                    c."VISIT_UNIQN",
                    c."SYMPTOM_TEXT",
                    c."CONSULTATION_TEXT",
                    c."SPECIAL_NOTE",
                    c."CREATED_AT",
                    v."PATIENT_UNIQN",
                    p."NAME"
                FROM "CASE_RECORD" c
                JOIN "VISIT" v
                    ON c."VISIT_UNIQN" = v."VISIT_UNIQN"
                JOIN "PATIENT" p
                    ON v."PATIENT_UNIQN" = p."PATIENT_UNIQN"
                WHERE p."CLINIC_UNIQN" = 1
                ORDER BY c."CREATED_AT" DESC, c."CASE_UNIQN" DESC
            """)
        ).mappings().all()

    records = [
        {
            "id": str(row["CASE_UNIQN"]),
            "patientId": row["PATIENT_UNIQN"],
            "patientName": row["NAME"],
            "symptoms": row["SYMPTOM_TEXT"] or "",
            "selectedCandidates": [
                candidate.strip()
                for candidate in (row["CONSULTATION_TEXT"] or "").split(",")
                if candidate.strip()
            ],
            "additionalNotes": row["SPECIAL_NOTE"] or "",
            "createdAt": row["CREATED_AT"].isoformat()
        }
        for row in rows
    ]

    return {"records": records}



class HerbItem(BaseModel):
    name: str
    amount: float


class PrescriptionRecord(BaseModel):
    patientId: int
    consultationId: str
    prescriptionName: str
    herbs: list[HerbItem]


# 임시 처방전 목록 (서버 재시작 시 초기화)
prescription_records = []


@app.post("/api/prescriptions", status_code=201)
def save_prescription(request: PrescriptionRecord):
    consultation = next(
        (
            record for record in consultation_records
            if record["id"] == request.consultationId
        ),
        None
    )

    if consultation is None:
        raise HTTPException(
            status_code=404,
            detail="연결된 상담일지를 찾을 수 없습니다."
        )

    if consultation["patientId"] != request.patientId:
        raise HTTPException(
            status_code=400,
            detail="상담일지의 환자 정보가 일치하지 않습니다."
        )

    if not request.prescriptionName.strip():
        raise HTTPException(
            status_code=400,
            detail="처방명을 입력해 주세요."
        )

    if not request.herbs:
        raise HTTPException(
            status_code=400,
            detail="약재를 하나 이상 입력해 주세요."
        )

    for herb in request.herbs:
        if not herb.name.strip() or not 0 < herb.amount < float("inf"):
            raise HTTPException(
                status_code=400,
                detail="약재명과 올바른 용량을 입력해 주세요."
            )

    record = {
        "id": str(uuid4()),
        **request.model_dump(),
        "patientName": consultation["patientName"],
        "status": "미전송",
        "createdAt": datetime.now().astimezone().isoformat(),
    }

    prescription_records.append(record)

    return {
        "message": "처방전이 저장되었습니다.",
        "record": record
    }


@app.get("/api/prescriptions")
def get_prescriptions():
    return {"records": prescription_records}


@app.patch("/api/prescriptions/{prescription_id}")
def update_prescription(
    prescription_id: str,
    request: PrescriptionRecord
):
    prescription = next(
        (
            record for record in prescription_records
            if record["id"] == prescription_id
        ),
        None
    )

    if prescription is None:
        raise HTTPException(
            status_code=404,
            detail="처방전을 찾을 수 없습니다."
        )

    if prescription["status"] != "미전송":
        raise HTTPException(
            status_code=409,
            detail="전송된 처방전은 수정할 수 없습니다."
        )

    if (
        request.patientId != prescription["patientId"]
        or request.consultationId != prescription["consultationId"]
    ):
        raise HTTPException(
            status_code=400,
            detail="처방전의 환자 또는 상담 기록을 변경할 수 없습니다."
        )

    if not request.prescriptionName.strip():
        raise HTTPException(
            status_code=400,
            detail="처방명을 입력해 주세요."
        )

    if not request.herbs:
        raise HTTPException(
            status_code=400,
            detail="약재를 하나 이상 입력해 주세요."
        )

    for herb in request.herbs:
        if not herb.name.strip() or not 0 < herb.amount < float("inf"):
            raise HTTPException(
                status_code=400,
                detail="약재명과 올바른 용량을 입력해 주세요."
            )

    prescription["prescriptionName"] = request.prescriptionName.strip()
    prescription["herbs"] = [
        herb.model_dump() for herb in request.herbs
    ]
    prescription["updatedAt"] = datetime.now().astimezone().isoformat()

    return {
        "message": "처방전이 수정되었습니다.",
        "record": prescription
    }

@app.patch("/api/prescriptions/{prescription_id}/send")
def send_prescription(prescription_id: str):
    prescription = next(
        (
            record for record in prescription_records
            if record["id"] == prescription_id
        ),
        None
    )

    if prescription is None:
        raise HTTPException(
            status_code=404,
            detail="처방전을 찾을 수 없습니다."
        )

    if prescription["status"] != "미전송":
        raise HTTPException(
            status_code=409,
            detail="이미 전송된 처방전입니다."
        )

    prescription["status"] = "전송완료"
    prescription["sentAt"] = datetime.now().astimezone().isoformat()

    return {
        "message": "처방전이 안내데스크로 전송되었습니다.",
        "record": prescription
    }

@app.delete("/api/prescriptions/{prescription_id}")
def delete_prescription(prescription_id: str):
    prescription = next(
        (
            record for record in prescription_records
            if record["id"] == prescription_id
        ),
        None
    )

    if prescription is None:
        raise HTTPException(
            status_code=404,
            detail="처방전을 찾을 수 없습니다."
        )

    if prescription["status"] != "미전송":
        raise HTTPException(
            status_code=409,
            detail="전송된 처방전은 삭제할 수 없습니다."
        )

    prescription_records.remove(prescription)

    return {
        "message": "처방전이 삭제되었습니다."
    }
