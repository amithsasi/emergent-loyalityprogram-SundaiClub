# WhatsApp Coffee Passport MVP

A WhatsApp-powered digital loyalty program for coffee shops. Customers collect stamps through WhatsApp messages, track their progress, and unlock rewards - all without downloading any apps.

## 🚀 Features

### For Customers
- **JOIN** - Create a coffee passport with welcome stamp
- **STATUS** - Check current stamp progress and rewards
- **REWARD** - Claim free coffee after collecting 10 stamps
- **UPDATE NAME [name]** - Change your profile name
- **HELP** - View all available commands

### For Staff
- **STAMP [customer_id]** - Add stamp after purchase verification
- **REDEEM [customer_id]** - Confirm reward redemption
- Duplicate stamp protection (5-minute cooldown)
- Full audit trail of all actions

### For Administrators
- Staff management (authorize/remove staff members)
- Customer analytics dashboard
- Real-time system statistics
- WhatsApp connection monitoring

## 🏗️ Architecture

### Components
1. **Node.js WhatsApp Service** (Port 3001) - Handles WhatsApp Web protocol using Baileys
2. **FastAPI Backend** (Port 8001) - Processes commands and manages business logic
3. **React Frontend** - Admin dashboard and WhatsApp setup interface
4. **MongoDB** - Customer data, staff records, and audit logs

### Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI, Python, Pydantic
- **WhatsApp:** Baileys (WhatsApp Web API)
- **Database:** MongoDB
- **Communication:** HTTP REST APIs

## 📱 WhatsApp Integration

### Customer Commands
```
JOIN → Create passport and get welcome stamp
STATUS → Check progress (e.g., "Stamps: 3/10")
REWARD → Claim free coffee (when eligible)
UPDATE NAME John → Change profile name
HELP → Show command list
```

### Staff Commands
```
STAMP C1234 → Add stamp to customer C1234
REDEEM C1234 → Confirm reward redemption for C1234
```

## 🛡️ Security Features

- **Staff Authorization:** Only whitelisted phone numbers can add stamps/redeem rewards
- **Duplicate Protection:** Prevents multiple stamps within 5 minutes
- **Audit Logging:** All staff actions are logged with timestamps
- **Data Validation:** Input sanitization and phone number validation

## 📊 Business Rules

- **Reward System:** 10 stamps = 1 free coffee
- **Reset Cycle:** Customer rewards reset every 3 months
- **Staff Verification:** Purchase verification required before adding stamps
- **Single Use:** Each reward can only be redeemed once

This MVP demonstrates a complete WhatsApp-powered loyalty system ready for pilot testing in a single coffee shop location.
