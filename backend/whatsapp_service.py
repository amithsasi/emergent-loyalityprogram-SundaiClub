from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
import re
import logging
from typing import Optional

from models import IncomingMessage, MessageResponse, Customer, Staff, AuditLog

logger = logging.getLogger(__name__)

class WhatsAppCoffeePassportService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.customers_collection = db.customers
        self.staff_collection = db.staff
        self.audit_collection = db.audit_logs

    def clean_phone_number(self, phone_number: str) -> str:
        """Clean phone number by removing spaces, +, and @s.whatsapp.net suffix"""
        cleaned = phone_number.strip().replace(" ", "").replace("+", "")
        if "@s.whatsapp.net" in cleaned:
            cleaned = cleaned.replace("@s.whatsapp.net", "")
        return cleaned

    async def process_message(self, message_data: IncomingMessage) -> MessageResponse:
        """Process incoming WhatsApp message and return appropriate response"""
        try:
            # Debug logging for incoming message
            original_phone = message_data.phone_number
            # Clean phone number using helper function
            phone_number = self.clean_phone_number(message_data.phone_number)
            message_text = message_data.message.strip().upper()
            
            logger.info(f"🐛 DEBUG: Original phone from WhatsApp: '{original_phone}'")
            logger.info(f"🐛 DEBUG: Cleaned phone number: '{phone_number}'")
            logger.info(f"🐛 DEBUG: Message text: '{message_text}'")

            # Handle different commands
            if message_text == "JOIN":
                return await self._handle_join(phone_number)
            
            elif message_text == "STATUS":
                return await self._handle_status(phone_number)
            
            elif message_text.startswith("STAMP "):
                return await self._handle_stamp(phone_number, message_text)
            
            elif message_text == "REWARD":
                return await self._handle_reward(phone_number)
            
            elif message_text.startswith("REDEEM "):
                return await self._handle_redeem(phone_number, message_text)
            
            elif message_text.startswith("UPDATE NAME "):
                return await self._handle_update_name(phone_number, message_text)
            
            elif message_text in ["HELP", "COMMANDS"]:
                return await self._handle_help()
            
            else:
                # Check if this is a name response for new user
                customer = await self.customers_collection.find_one({"phone_number": phone_number})
                if customer and not customer.get("name"):
                    return await self._handle_name_response(phone_number, message_data.message.strip())
                
                return MessageResponse(
                    reply="I didn't understand that command. Send 'HELP' to see available commands.\n\nQuick examples:\n• JOIN - Start your coffee passport\n• STATUS - Check your progress\n• HELP - See all commands"
                )

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return MessageResponse(
                reply="Sorry, I encountered an error processing your request. Please try again.",
                success=False
            )

    async def _handle_join(self, phone_number: str) -> MessageResponse:
        """Handle JOIN command - customer signup"""
        # Clean phone number for consistency (remove spaces, +, and @s.whatsapp.net)
        clean_phone = phone_number.strip().replace(" ", "").replace("+", "")
        if "@s.whatsapp.net" in clean_phone:
            clean_phone = clean_phone.replace("@s.whatsapp.net", "")
        
        # Check if customer already exists
        existing_customer = await self.customers_collection.find_one({"phone_number": clean_phone})
        if existing_customer:
            return MessageResponse(
                reply=f"Welcome back! You already have a passport.\n\nStamps: {existing_customer['stamps']}/10 | Rewards: {existing_customer['rewards']} | ID: #{existing_customer['customer_id']}\n\nSend 'STATUS' for full details."
            )
        
        # Create new customer with temporary entry
        customer_id = f"C{str(abs(hash(phone_number)))[:4]}"
        reset_date = datetime.utcnow() + timedelta(days=90)  # 3 months from now
        
        customer_data = {
            "phone_number": clean_phone,
            "name": None,  # Will be filled when user responds
            "customer_id": customer_id,
            "stamps": 1,  # Welcome stamp
            "rewards": 0,
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow(),
            "reset_date": reset_date,
            "is_active": True
        }
        
        await self.customers_collection.insert_one(customer_data)
        
        return MessageResponse(
            reply="🎉 Welcome to Coffee Passport!\n\nWhat's your first name?"
        )

    async def _handle_name_response(self, phone_number: str, name: str) -> MessageResponse:
        """Handle name response from new customer"""
        # Update customer with name
        result = await self.customers_collection.update_one(
            {"phone_number": phone_number, "name": None},
            {"$set": {"name": name, "last_activity": datetime.utcnow()}}
        )
        
        if result.modified_count > 0:
            customer = await self.customers_collection.find_one({"phone_number": phone_number})
            reset_date = customer['reset_date'].strftime('%d %b %Y')
            
            return MessageResponse(
                reply=f"🎉 Thanks {name}! Passport ready.\n\nStamps: 1/10 | Rewards: 0 | ID: #{customer['customer_id']}\n\nRewards reset every 3 months.\nNext reset: {reset_date}\n\nSend 'STATUS' anytime to check progress!"
            )
        
        return MessageResponse(
            reply="Please send 'JOIN' first to create your passport."
        )

    async def _handle_status(self, phone_number: str) -> MessageResponse:
        """Handle STATUS command - show customer progress"""
        customer = await self.customers_collection.find_one({"phone_number": phone_number})
        if not customer:
            return MessageResponse(
                reply="You don't have a passport yet. Send 'JOIN' to get started!"
            )
        
        reset_date = customer['reset_date'].strftime('%d %b %Y')
        
        return MessageResponse(
            reply=f"☕ Passport for {customer['name']}\n\nStamps: {customer['stamps']}/10\nRewards: {customer['rewards']}\nID: #{customer['customer_id']}\n\nRewards reset on: {reset_date}"
        )

    async def _handle_stamp(self, staff_phone: str, message_text: str) -> MessageResponse:
        """Handle STAMP command - staff adds stamp to customer"""
        # Debug logging for staff authorization
        logger.info(f"🐛 DEBUG STAMP: Received staff_phone: '{staff_phone}'")
        
        # Ensure phone number is cleaned for database comparison (remove spaces, +, and @s.whatsapp.net)
        clean_staff_phone = staff_phone.strip().replace(" ", "").replace("+", "")
        if "@s.whatsapp.net" in clean_staff_phone:
            clean_staff_phone = clean_staff_phone.replace("@s.whatsapp.net", "")
        logger.info(f"🐛 DEBUG STAMP: Cleaned staff_phone: '{clean_staff_phone}'")
        
        # Log all staff in database for comparison
        all_staff = await self.staff_collection.find({"is_authorized": True}).to_list(100)
        logger.info(f"🐛 DEBUG STAMP: All authorized staff in DB:")
        for s in all_staff:
            logger.info(f"🐛 DEBUG STAMP: DB Staff - Phone: '{s['phone_number']}', Name: '{s['name']}'")
        
        # Check if sender is authorized staff - try multiple formats
        logger.info(f"🐛 DEBUG STAMP: Looking for staff with phone: '{clean_staff_phone}'")
        
        # Try exact match first
        staff = await self.staff_collection.find_one({"phone_number": clean_staff_phone, "is_authorized": True})
        
        # If not found, try with country code prefixed
        if not staff and not clean_staff_phone.startswith('91'):
            staff = await self.staff_collection.find_one({"phone_number": f"91{clean_staff_phone}", "is_authorized": True})
            logger.info(f"🐛 DEBUG STAMP: Trying with country code: '91{clean_staff_phone}'")
        
        # If not found, try without country code (if it starts with 91)
        if not staff and clean_staff_phone.startswith('91') and len(clean_staff_phone) > 10:
            without_country_code = clean_staff_phone[2:]  # Remove '91'
            staff = await self.staff_collection.find_one({"phone_number": without_country_code, "is_authorized": True})
            logger.info(f"🐛 DEBUG STAMP: Trying without country code: '{without_country_code}'")
        
        if staff:
            logger.info(f"🐛 DEBUG STAMP: Staff found! Name: '{staff['name']}'")
        else:
            logger.info(f"🐛 DEBUG STAMP: Staff NOT found in database!")
            
        if not staff:
            return MessageResponse(
                reply="You are not authorized to add stamps. Please contact management."
            )
        
        # Extract customer ID from message
        try:
            customer_id = message_text.split(" ")[1]
        except IndexError:
            return MessageResponse(
                reply="Please specify customer ID. Format: STAMP C1234"
            )
        
        # Find customer
        customer = await self.customers_collection.find_one({"customer_id": customer_id})
        if not customer:
            return MessageResponse(
                reply=f"Customer #{customer_id} not found."
            )
        
        # Check for duplicate stamp (within 5 minutes)
        recent_stamp = await self.audit_collection.find_one({
            "staff_phone": clean_staff_phone,
            "customer_id": customer_id,
            "action": "STAMP",
            "timestamp": {"$gte": datetime.utcnow() - timedelta(minutes=5)}
        })
        
        if recent_stamp:
            return MessageResponse(
                reply=f"Duplicate stamp blocked. Last stamp for #{customer_id} was less than 5 minutes ago."
            )
        
        # Add stamp
        new_stamps = customer['stamps'] + 1
        await self.customers_collection.update_one(
            {"customer_id": customer_id},
            {
                "$set": {
                    "stamps": new_stamps,
                    "last_activity": datetime.utcnow()
                }
            }
        )
        
        # Log the action
        audit_log = {
            "staff_phone": clean_staff_phone,
            "customer_id": customer_id,
            "action": "STAMP",
            "timestamp": datetime.utcnow(),
            "details": f"Stamp added by {staff['name']}"
        }
        await self.audit_collection.insert_one(audit_log)
        
        return MessageResponse(
            reply=f"✅ Stamp added for {customer['name']}. Progress: {new_stamps}/10."
        )

    async def _handle_reward(self, phone_number: str) -> MessageResponse:
        """Handle REWARD command - customer claims reward"""
        customer = await self.customers_collection.find_one({"phone_number": phone_number})
        if not customer:
            return MessageResponse(
                reply="You don't have a passport yet. Send 'JOIN' to get started!"
            )
        
        if customer['stamps'] < 10:
            return MessageResponse(
                reply=f"You need 10 stamps to unlock a reward. Current progress: {customer['stamps']}/10\n\nKeep collecting stamps!"
            )
        
        # Grant reward (increment rewards, keep stamps until staff confirms redemption)
        await self.customers_collection.update_one(
            {"phone_number": phone_number},
            {
                "$inc": {"rewards": 1},
                "$set": {"last_activity": datetime.utcnow()}
            }
        )
        
        return MessageResponse(
            reply=f"🎉 Congrats {customer['name']}! Free Coffee unlocked.\n\nShow this message to the staff to redeem your reward.\n\nReward Code: #{customer['customer_id']}-R{customer['rewards'] + 1}"
        )

    async def _handle_redeem(self, staff_phone: str, message_text: str) -> MessageResponse:
        """Handle REDEEM command - staff confirms reward redemption"""
        # Ensure phone number is cleaned for database comparison (remove spaces, +, and @s.whatsapp.net)
        clean_staff_phone = staff_phone.strip().replace(" ", "").replace("+", "")
        if "@s.whatsapp.net" in clean_staff_phone:
            clean_staff_phone = clean_staff_phone.replace("@s.whatsapp.net", "")
        
        # Check if sender is authorized staff - try multiple formats
        staff = await self.staff_collection.find_one({"phone_number": clean_staff_phone, "is_authorized": True})
        
        # If not found, try with country code prefixed
        if not staff and not clean_staff_phone.startswith('91'):
            staff = await self.staff_collection.find_one({"phone_number": f"91{clean_staff_phone}", "is_authorized": True})
        
        # If not found, try without country code (if it starts with 91)
        if not staff and clean_staff_phone.startswith('91') and len(clean_staff_phone) > 10:
            without_country_code = clean_staff_phone[2:]  # Remove '91'
            staff = await self.staff_collection.find_one({"phone_number": without_country_code, "is_authorized": True})
        if not staff:
            return MessageResponse(
                reply="You are not authorized to redeem rewards. Please contact management."
            )
        
        # Extract customer ID from message
        try:
            customer_id = message_text.split(" ")[1]
        except IndexError:
            return MessageResponse(
                reply="Please specify customer ID. Format: REDEEM C1234"
            )
        
        # Find customer
        customer = await self.customers_collection.find_one({"customer_id": customer_id})
        if not customer:
            return MessageResponse(
                reply=f"Customer #{customer_id} not found."
            )
        
        if customer['rewards'] < 1:
            return MessageResponse(
                reply=f"Customer #{customer_id} has no rewards to redeem."
            )
        
        # Reset passport after redemption
        await self.customers_collection.update_one(
            {"customer_id": customer_id},
            {
                "$set": {
                    "stamps": 0,
                    "rewards": customer['rewards'] - 1,
                    "last_activity": datetime.utcnow()
                }
            }
        )
        
        # Log the action
        audit_log = {
            "staff_phone": clean_staff_phone,
            "customer_id": customer_id,
            "action": "REDEEM",
            "timestamp": datetime.utcnow(),
            "details": f"Reward redeemed by {staff['name']}"
        }
        await self.audit_collection.insert_one(audit_log)
        
        return MessageResponse(
            reply=f"✅ Reward redeemed for {customer['name']}. Passport reset to 0/10."
        )

    async def _handle_update_name(self, phone_number: str, message_text: str) -> MessageResponse:
        """Handle UPDATE NAME command"""
        customer = await self.customers_collection.find_one({"phone_number": phone_number})
        if not customer:
            return MessageResponse(
                reply="You don't have a passport yet. Send 'JOIN' to get started!"
            )
        
        # Extract new name
        try:
            new_name = " ".join(message_text.split(" ")[2:])
        except IndexError:
            return MessageResponse(
                reply="Please specify your new name. Format: UPDATE NAME YourName"
            )
        
        if not new_name:
            return MessageResponse(
                reply="Please specify your new name. Format: UPDATE NAME YourName"
            )
        
        # Update name
        await self.customers_collection.update_one(
            {"phone_number": phone_number},
            {
                "$set": {
                    "name": new_name,
                    "last_activity": datetime.utcnow()
                }
            }
        )
        
        return MessageResponse(
            reply=f"✅ Name updated. Welcome back, {new_name}!"
        )

    async def _handle_help(self) -> MessageResponse:
        """Handle HELP command"""
        return MessageResponse(
            reply="🤖 Coffee Passport Commands:\n\n📝 JOIN - Create your passport\n📋 STATUS - Check your progress\n🎁 REWARD - Claim your free coffee\n✏️ UPDATE NAME [name] - Change your name\n❓ HELP - Show this help\n\nStaff Commands:\n• STAMP [customer_id] - Add stamp\n• REDEEM [customer_id] - Confirm redemption\n\nExamples:\n• JOIN\n• STATUS\n• UPDATE NAME John"
        )

    async def get_customer_stats(self):
        """Get overall customer statistics"""
        total_customers = await self.customers_collection.count_documents({})
        active_customers = await self.customers_collection.count_documents({
            "last_activity": {"$gte": datetime.utcnow() - timedelta(days=30)}
        })
        total_stamps = await self.customers_collection.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$stamps"}}}
        ]).to_list(1)
        
        return {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "total_stamps": total_stamps[0]["total"] if total_stamps else 0
        }