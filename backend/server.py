from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import httpx

from models import IncomingMessage, MessageResponse, Customer, Staff, AuditLog, StaffCreate
from whatsapp_service import WhatsAppCoffeePassportService

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# WhatsApp service URL
WHATSAPP_SERVICE_URL = "http://localhost:3001"

# Create the main app without a prefix
app = FastAPI(title="Coffee Passport API", description="WhatsApp Coffee Loyalty System")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize WhatsApp service
whatsapp_service = WhatsAppCoffeePassportService(db)

# Dependency to get database
async def get_database():
    return db

# WhatsApp Routes
@api_router.post("/whatsapp/message", response_model=MessageResponse)
async def handle_whatsapp_message(
    message_data: IncomingMessage,
    database = Depends(get_database)
):
    """Process incoming WhatsApp messages"""
    service = WhatsAppCoffeePassportService(database)
    return await service.process_message(message_data)

@api_router.post("/whatsapp/send")
async def send_whatsapp_message(phone_number: str, message: str):
    """Send message via WhatsApp service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_SERVICE_URL}/send",
                json={"phone_number": phone_number, "message": message}
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/whatsapp/qr")
async def get_qr_code():
    """Get current QR code for WhatsApp authentication"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/qr")
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/whatsapp/status")
async def get_whatsapp_status():
    """Get WhatsApp connection status"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status")
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Customer Management Routes
@api_router.get("/customers", response_model=List[Customer])
async def get_customers(database = Depends(get_database)):
    """Get all customers"""
    customers = await database.customers.find().to_list(1000)
    return [Customer(**customer) for customer in customers]

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, database = Depends(get_database)):
    """Get customer by ID"""
    customer = await database.customers.find_one({"customer_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return Customer(**customer)

# Staff Management Routes
@api_router.post("/staff", response_model=Staff)
async def create_staff(staff_data: StaffCreate, database = Depends(get_database)):
    """Create new staff member"""
    # Trim spaces and remove '+' symbol for consistent phone number format
    cleaned_phone = staff_data.phone_number.strip().replace(" ", "").replace("+", "")
    cleaned_name = staff_data.name.strip()
    
    # Check if staff already exists
    existing_staff = await database.staff.find_one({"phone_number": cleaned_phone})
    if existing_staff:
        raise HTTPException(status_code=400, detail="Staff member already exists")
    
    # Create staff with cleaned data
    staff_dict = {
        "phone_number": cleaned_phone,
        "name": cleaned_name
    }
    staff_obj = Staff(**staff_dict)
    await database.staff.insert_one(staff_obj.dict())
    return staff_obj

@api_router.get("/staff", response_model=List[Staff])
async def get_staff(database = Depends(get_database)):
    """Get all staff members"""
    staff_members = await database.staff.find().to_list(1000)
    return [Staff(**staff) for staff in staff_members]

@api_router.delete("/staff/{phone_number}")
async def remove_staff(phone_number: str, database = Depends(get_database)):
    """Remove staff member"""
    result = await database.staff.delete_one({"phone_number": phone_number})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return {"message": "Staff member removed successfully"}

# Analytics Routes
@api_router.get("/analytics/stats")
async def get_analytics(database = Depends(get_database)):
    """Get system analytics"""
    service = WhatsAppCoffeePassportService(database)
    return await service.get_customer_stats()

@api_router.get("/analytics/audit")
async def get_audit_logs(database = Depends(get_database)):
    """Get audit logs"""
    logs = await database.audit_logs.find().sort("timestamp", -1).limit(100).to_list(100)
    return [AuditLog(**log) for log in logs]

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Legacy routes (for compatibility)
@api_router.get("/")
async def root():
    return {"message": "Coffee Passport API is running!"}

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)