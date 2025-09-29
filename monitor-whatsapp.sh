#!/bin/bash

# WhatsApp Service Monitor and Auto-Restart Script
# This script monitors the WhatsApp service and restarts it if it goes down

LOG_FILE="/tmp/whatsapp-monitor.log"
SERVICE_LOG="/tmp/whatsapp-service.log"
SERVICE_DIR="/app/whatsapp-service"
FASTAPI_URL="https://coffee-passport.preview.emergentagent.com"

echo "$(date): WhatsApp Service Monitor Started" >> $LOG_FILE

while true; do
    # Check if WhatsApp service is responding
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/status 2>/dev/null)
    
    if [ "$HTTP_STATUS" != "200" ]; then
        echo "$(date): WhatsApp service down (HTTP $HTTP_STATUS), restarting..." >> $LOG_FILE
        
        # Kill any existing WhatsApp processes
        pkill -f whatsapp-service.js
        sleep 2
        
        # Start the WhatsApp service
        cd $SERVICE_DIR
        FASTAPI_URL=$FASTAPI_URL nohup npm start > $SERVICE_LOG 2>&1 &
        
        echo "$(date): WhatsApp service restart initiated" >> $LOG_FILE
        
        # Wait for service to come up
        sleep 10
        
        # Verify restart
        NEW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/status 2>/dev/null)
        if [ "$NEW_STATUS" = "200" ]; then
            echo "$(date): WhatsApp service successfully restarted" >> $LOG_FILE
        else
            echo "$(date): WhatsApp service restart failed" >> $LOG_FILE
        fi
    else
        echo "$(date): WhatsApp service healthy" >> $LOG_FILE
    fi
    
    # Check every 30 seconds
    sleep 30
done