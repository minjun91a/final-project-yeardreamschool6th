
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="한의결 API")


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
