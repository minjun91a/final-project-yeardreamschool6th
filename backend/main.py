

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="한의결 API")

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
    return {"patients": waiting_patients}


@app.post("/api/waiting")
def register_waiting_patient(patient: WaitingPatient):
    for existing in waiting_patients:
        if existing["id"] == patient.id:
            raise HTTPException(
                status_code=409,
                detail="이미 상담 대기 목록에 등록된 환자입니다."
            )

    new_patient = {
        **patient.model_dump(),
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
    for patient in waiting_patients:
        if patient["id"] == patient_id:
            current_status = patient["status"]

            if request.status == "진료 중":
                if current_status != "대기":
                    raise HTTPException(
                        status_code=409,
                        detail="대기 중인 환자만 상담을 시작할 수 있습니다."
                    )
                patient["status"] = "진료 중"
                patient["doctor"] = request.doctor or "담당 한의사"

            elif request.status == "대기":
                if current_status != "진료 중":
                    raise HTTPException(
                        status_code=409,
                        detail="진료 중인 환자만 상담을 취소할 수 있습니다."
                    )
                patient["status"] = "대기"
                patient["doctor"] = None

            else:
                raise HTTPException(
                    status_code=400,
                    detail="올바르지 않은 상태입니다."
                )

            return {
                "message": "환자 상태가 변경되었습니다.",
                "patient": patient
            }

    raise HTTPException(
        status_code=404,
        detail="환자를 찾을 수 없습니다."
    )


@app.delete("/api/waiting/{patient_id}")
def cancel_waiting_reception(patient_id: int):
    for index, patient in enumerate(waiting_patients):
        if patient["id"] == patient_id:
            if patient["status"] != "대기":
                raise HTTPException(
                    status_code=409,
                    detail="대기 중인 환자만 접수를 취소할 수 있습니다."
                )

            waiting_patients.pop(index)

            return {
                "message": "접수가 취소되었습니다."
            }

    raise HTTPException(
        status_code=404,
        detail="환자를 찾을 수 없습니다."
    )

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

    patient = next(
        (p for p in waiting_patients if p["id"] == request.patientId),
        None
    )

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="등록된 환자를 찾을 수 없습니다."
        )

    if patient["status"] != "진료 중":
        raise HTTPException(
            status_code=409,
            detail="진료 중인 환자만 상담일지를 저장할 수 있습니다."
        )

    record = {
        "id": str(uuid4()),
        **request.model_dump(),
        "patientName": patient["name"],
        "createdAt": datetime.now().astimezone().isoformat(),
    }

    consultation_records.append(record)

    patient["status"] = "완료"

    return {
        "message": "상담일지가 저장되었습니다.",
        "record": record
    }


@app.get("/api/consultations")
def get_consultations():
    return {"records": consultation_records}
