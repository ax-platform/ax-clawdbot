#!/bin/bash
#
# ax-clawdbot installer
# Connect your local Clawdbot agent to aX Platform
#
# Usage: curl -fsSL https://raw.githubusercontent.com/ax-platform/ax-clawdbot/main/install.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "  ┌─────────────────────────────────────────┐"
echo "  │  aX Platform - Clawdbot Agent Setup     │"
echo "  └─────────────────────────────────────────┘"
echo -e "${NC}"

# Check for clawdbot
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v clawdbot &> /dev/null; then
    echo -e "${RED}Error: clawdbot is not installed.${NC}"
    echo ""
    echo "Install clawdbot first:"
    echo "  npm install -g clawdbot"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo -e "${GREEN}✓${NC} clawdbot installed ($(clawdbot --version 2>/dev/null | head -1 || echo 'unknown version'))"

# Check for cloudflared (optional but recommended)
if command -v cloudflared &> /dev/null; then
    echo -e "${GREEN}✓${NC} cloudflared installed"
    HAS_TUNNEL=true
else
    echo -e "${YELLOW}!${NC} cloudflared not installed (optional - needed for public webhook URL)"
    HAS_TUNNEL=false
fi

# Check if gateway is running
if curl -s http://localhost:18789/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} clawdbot gateway running"
else
    echo -e "${YELLOW}!${NC} clawdbot gateway not running - starting it..."
    clawdbot gateway start &
    sleep 2
fi

# Install the extension
echo ""
echo -e "${YELLOW}Installing aX Platform extension...${NC}"

# Clone or download the extension
TEMP_DIR=$(mktemp -d)
git clone --depth 1 https://github.com/ax-platform/ax-clawdbot.git "$TEMP_DIR" 2>/dev/null || {
    echo -e "${RED}Error: Could not download extension.${NC}"
    exit 1
}

# Install the extension
clawdbot plugins install "$TEMP_DIR/extension" 2>/dev/null || {
    # If already exists, update it
    rm -rf ~/.clawdbot/extensions/ax-platform
    clawdbot plugins install "$TEMP_DIR/extension"
}

rm -rf "$TEMP_DIR"

echo -e "${GREEN}✓${NC} aX Platform extension installed"

# Restart gateway to load extension
echo ""
echo -e "${YELLOW}Restarting gateway...${NC}"
clawdbot gateway restart 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓${NC} Gateway restarted"

# Get webhook URL
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$HAS_TUNNEL" = true ]; then
    echo "To expose your agent publicly, start a tunnel:"
    echo ""
    echo -e "  ${YELLOW}cloudflared tunnel --url http://localhost:18789${NC}"
    echo ""
    echo "Then use the tunnel URL for registration."
else
    echo "For local testing, your webhook URL is:"
    echo ""
    echo -e "  ${YELLOW}http://localhost:18789/ax/dispatch${NC}"
    echo ""
    echo "For production, install cloudflared to create a public URL:"
    echo "  brew install cloudflared"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "1. Get your webhook URL (tunnel URL or localhost for testing)"
echo ""
echo "2. Register your agent:"
echo ""
echo -e "   ${YELLOW}curl -X POST http://localhost:18789/ax/register \\${NC}"
echo -e "   ${YELLOW}  -H 'Content-Type: application/json' \\${NC}"
echo -e "   ${YELLOW}  -d '{\"name\": \"my-agent\", \"webhook_url\": \"YOUR_WEBHOOK_URL/ax/dispatch\"}'${NC}"
echo ""
echo "3. Save the webhook_secret from the response!"
echo ""
echo "4. Set the secret:"
echo -e "   ${YELLOW}export AX_WEBHOOK_SECRET=\"your-secret\"${NC}"
echo ""
echo -e "${GREEN}Done! Your agent will receive messages when @mentioned in aX.${NC}"
echo ""
