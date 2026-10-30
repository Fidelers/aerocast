import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

# Подключаем папку с моделью в sys.path
MODEL_DIR = Path(os.getenv("JEV_MODEL_DIR", "/models/jev-0.8b"))
sys.path.append(str(MODEL_DIR))

try:
    from jev_style_decision_gguf import JevStyleDecisionGGUF, make_question
except ImportError as e:
    print(f"Error importing jev runtime: {e}", flush=True)
    JevStyleDecisionGGUF = None

app = FastAPI(title="AeroCast Jev System 1 Decision Service")

model_engine: Optional[JevStyleDecisionGGUF] = None

@app.on_event("startup")
def load_model():
    global model_engine
    gguf_path = MODEL_DIR / "Jev-Style-0.8B-Decision-v3-Q4_K_M.gguf"
    binary_path = Path("/app/bin/jev-score")
    
    if not gguf_path.exists():
        raise RuntimeError(f"GGUF weights not found at: {gguf_path}")
    if not binary_path.exists():
        raise RuntimeError(f"jev-score binary not found at: {binary_path}")

    gpu_layers = int(os.getenv("JEV_GPU_LAYERS", "99"))
    num_threads = int(os.getenv("OMP_NUM_THREADS", "6"))
    print(f"[JevService] Loading model from {MODEL_DIR} with {num_threads} threads, {gpu_layers} GPU layers (many_mode=batched)...", flush=True)
    model_engine = JevStyleDecisionGGUF(
        model_dir=str(MODEL_DIR),
        quant="Q4_K_M",
        gguf=str(gguf_path),
        binary=str(binary_path),
        n_gpu_layers=gpu_layers,
        threads=num_threads,
        many_mode="batched"
    )
    print("[JevService] Jev-Style-0.8B ready for inference!", flush=True)

@app.on_event("shutdown")
def unload_model():
    global model_engine
    if model_engine:
        model_engine.close()

class ScoreManyRequest(BaseModel):
    state: Dict[str, Any]
    questions: List[Dict[str, Any]]

@app.get("/health")
def health():
    return {"status": "ok", "model": "Jev-Style-0.8B-Decision-v3"}

@app.post("/decide_many")
def decide_many(req: ScoreManyRequest):
    if not model_engine:
        raise HTTPException(status_code=503, detail="Model is not initialized")
    
    try:
        # Валидация вопросов
        formatted_questions = [make_question(q) for q in req.questions]
        
        # Выполнение батч-скоринга за 1 forward-pass
        results = model_engine.decide_many(req.state, formatted_questions)
        
        # Формирование ответа по ID вопросов
        response_data = {}
        for q_meta, res in zip(req.questions, results):
            q_id = q_meta.get("id", q_meta.get("ins"))
            response_data[q_id] = {
                "answer": res.get("answer"),
                "probabilities": res.get("probabilities"),
                "top_probability": res.get("top_probability")
            }
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
