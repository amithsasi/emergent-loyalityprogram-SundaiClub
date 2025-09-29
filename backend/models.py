from pydantic import BaseModel, Field
from typing import Optional, List, Annotated
from datetime import datetime
from bson import ObjectId
import uuid

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_json_schema__(cls, _source_type, _handler):
        return {"type": "string"}

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

class Customer(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    phone_number: str
    name: str
    customer_id: str = Field(default_factory=lambda: f"C{str(uuid.uuid4().int)[:4]}")
    stamps: int = 0
    rewards: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    reset_date: datetime
    is_active: bool = True

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class Staff(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    phone_number: str
    name: str
    is_authorized: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class AuditLog(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    staff_phone: str
    customer_id: str
    action: str  # STAMP, REDEEM
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    details: Optional[str] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class IncomingMessage(BaseModel):
    phone_number: str
    message: str
    message_id: str
    timestamp: int

class MessageResponse(BaseModel):
    reply: Optional[str] = None
    success: bool = True

class StaffCreate(BaseModel):
    phone_number: str
    name: str

class CustomerUpdate(BaseModel):
    name: Optional[str] = None