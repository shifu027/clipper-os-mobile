#!/usr/bin/env bash
# ============================================================
# generate-keystore.sh — Clipper OS Mobile
# ============================================================
# Generates an Android release keystore and provides
# instructions to configure the GitHub Secrets for CI/CD.
# Usage: ./scripts/generate-keystore.sh
# ============================================================

set -euo pipefail

# ---- Colors -----------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; }

# ---- Check keytool is available ---------------------------
if ! command -v keytool &>/dev/null; then
  error "'keytool' not found. Please install the JDK (Java Development Kit)."
  echo "  macOS:  brew install openjdk"
  echo "  Ubuntu: sudo apt install default-jdk"
  exit 1
fi

echo ""
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Clipper OS — Android Keystore Generator${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""
warn "Keep this keystore file SAFE and BACKED UP."
warn "If you lose it you will NOT be able to update your app on Google Play."
echo ""

# ---- Collect info interactively ---------------------------
read -rp "$(echo -e "${CYAN}Enter your name or organisation (e.g. Acme Corp):${RESET} ")" DNAME_ORG
if [ -z "$DNAME_ORG" ]; then
  DNAME_ORG="Clipper OS Developer"
fi

KEYSTORE_FILE="clipper-os-release.keystore"
KEY_ALIAS="clipper-os"

echo ""
info "Keystore file : ${BOLD}${KEYSTORE_FILE}${RESET}"
info "Key alias     : ${BOLD}${KEY_ALIAS}${RESET}"
echo ""
echo -e "${YELLOW}You will be prompted to set a keystore password and key password.${RESET}"
echo -e "${YELLOW}Use strong passwords and store them securely (e.g. a password manager).${RESET}"
echo ""

# ---- Generate keystore ------------------------------------
keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=${DNAME_ORG}, OU=Mobile, O=${DNAME_ORG}, L=Unknown, ST=Unknown, C=US"

echo ""
success "Keystore created: ${BOLD}${KEYSTORE_FILE}${RESET}"
echo ""

# ---- Encode to Base64 -------------------------------------
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Encoding keystore to Base64${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""

if command -v pbcopy &>/dev/null; then
  # macOS
  BASE64_VALUE=$(base64 -i "$KEYSTORE_FILE")
  echo "$BASE64_VALUE" | pbcopy
  success "Base64-encoded keystore copied to clipboard (macOS pbcopy)."
elif command -v xclip &>/dev/null; then
  # Linux with xclip
  BASE64_VALUE=$(base64 -w 0 "$KEYSTORE_FILE")
  echo "$BASE64_VALUE" | xclip -selection clipboard
  success "Base64-encoded keystore copied to clipboard (xclip)."
else
  BASE64_VALUE=$(base64 -w 0 "$KEYSTORE_FILE" 2>/dev/null || base64 -i "$KEYSTORE_FILE")
  echo ""
  info "Base64-encoded keystore (copy the full value below):"
  echo ""
  echo "$BASE64_VALUE"
  echo ""
fi

# ---- Instructions -----------------------------------------
echo ""
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Next Steps: GitHub Secrets${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""
echo -e "Go to: ${CYAN}https://github.com/shifu027/clipper-os-mobile/settings/secrets/actions${RESET}"
echo ""
echo -e "Add the following ${BOLD}4 secrets${RESET}:"
echo ""
echo -e "  ${BOLD}KEYSTORE_BASE64${RESET}"
echo -e "  → Paste the Base64 value shown/copied above"
echo ""
echo -e "  ${BOLD}KEYSTORE_PASSWORD${RESET}"
echo -e "  → The keystore password you entered during generation"
echo ""
echo -e "  ${BOLD}KEY_ALIAS${RESET}"
echo -e "  → ${KEY_ALIAS}"
echo ""
echo -e "  ${BOLD}KEY_PASSWORD${RESET}"
echo -e "  → The key password you entered during generation"
echo ""
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Security Reminders${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""
echo -e "  ${RED}✗  Never commit ${KEYSTORE_FILE} to Git${RESET}"
echo -e "  ${RED}✗  Never share your keystore passwords publicly${RESET}"
echo -e "  ${GREEN}✔  Back up ${KEYSTORE_FILE} to a secure location${RESET}"
echo -e "  ${GREEN}✔  Store passwords in a password manager${RESET}"
echo ""

# ---- Add to .gitignore if not already there ---------------
GITIGNORE=".gitignore"
if [ -f "$GITIGNORE" ] && ! grep -q "\.keystore" "$GITIGNORE"; then
  echo "" >> "$GITIGNORE"
  echo "# Android keystores — never commit these" >> "$GITIGNORE"
  echo "*.keystore" >> "$GITIGNORE"
  echo "*.jks" >> "$GITIGNORE"
  success "Added *.keystore and *.jks to .gitignore"
fi

echo ""
success "Done! Your keystore is ready. 🔐"
echo ""
