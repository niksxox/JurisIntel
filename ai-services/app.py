import time
from typing import Literal
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from nlp.translator import translate
from nlp.intent import detect_intent
from nlp.entity_parser import parse_entities
from nlp.sql_generator import generate_secure_sql
from catalyst import query as catalyst_query
from utils import generate_uuid, get_elapsed_ms

app = FastAPI(title="Crime Analytics Service")

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=5000)
    user_id: str = Field(..., min_length=1)
    role: Literal["Officer", "Investigator", "Admin"]

    @field_validator("query", "user_id")
    @classmethod
    def prevent_null_or_empty(cls, v: str) -> str:
        if v is None or not v.strip():
            raise ValueError("Field cannot be null or empty")
        return v.strip()

class QueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=5000)
    user_id: str = Field(..., min_length=1)
    role: Literal["Officer", "Investigator", "Admin"]

    @field_validator("sql", "user_id")
    @classmethod
    def prevent_null_or_empty(cls, v: str) -> str:
        if v is None or not v.strip():
            raise ValueError("Field cannot be null or empty")
        return v.strip()

def log_audit_trail(request: Request, request_id: str, action: str) -> None:
    client_host = request.client.host if request.client else "unknown"
    print(f"AUDIT: {request_id} | {client_host} | {action}")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "status": "error",
            "request_id": generate_uuid(),
            "message": str(exc.errors())
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "request_id": generate_uuid(),
            "message": exc.detail
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "request_id": generate_uuid(),
            "message": "Internal pipeline or database failure"
        }
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/chat")
async def chat_endpoint(request: Request, payload: ChatRequest):
    request_id = generate_uuid()
    start_time = time.perf_counter()
    log_audit_trail(request, request_id, "CHAT_INITIATED")
    
    translated_text = translate(payload.query)
    intent = detect_intent(translated_text)
    entities = parse_entities(translated_text, intent)
    sql_statement = generate_secure_sql(intent, entities)
    results = catalyst_query(sql_statement)
    
    duration_ms = get_elapsed_ms(start_time)
    log_audit_trail(request, request_id, "CHAT_COMPLETED")
    
    return {
        "status": "success",
        "request_id": request_id,
        "intent": intent,
        "entities": entities,
        "results": results,
        "duration_ms": duration_ms
    }

@app.post("/query")
async def query_endpoint(request: Request, payload: QueryRequest):
    request_id = generate_uuid()
    log_audit_trail(request, request_id, "QUERY_INITIATED")
    
    if payload.role not in ["Investigator", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Forbidden: Insufficient role privileges"
        )
        
    upper_sql = payload.sql.upper()
    dml_keywords = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE"]
    if any(keyword in upper_sql for keyword in dml_keywords):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="DML operations are not permitted"
        )
        
    start_time = time.perf_counter()
    results = catalyst_query(payload.sql)
    duration_ms = get_elapsed_ms(start_time)
    
    log_audit_trail(request, request_id, "QUERY_COMPLETED")
    
    return {
        "status": "success",
        "request_id": request_id,
        "intent": "DIRECT_SQL",
        "entities": {},
        "results": results,
        "duration_ms": duration_ms
    }