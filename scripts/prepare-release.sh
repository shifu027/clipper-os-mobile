#!/usr/bin/env bash
# ============================================================
# prepare-release.sh — Clipper OS Mobile
# ============================================================
# Prepares a release build of the Clipper OS app.
# Usage: ./scripts/prepare-release.sh [version]
# Example: ./scripts/prepare-release.sh 1.0.0
# ============================================================

set -euo pipefail

# ---- Colors -----------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ---- Helpers ----------------------------------------------
info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; }

# ---- Validate version argument ----------------------------
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  error "Version argument is required."
  echo -e "Usage: ${BOLD}./scripts/prepare-release.sh <version>${RESET}"
  echo -e "Example: ${BOLD}./scripts/prepare-release.sh 1.0.0${RESET}"
  exit 1
fi

# Basic semver validation
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  error "Version must be in semver format: MAJOR.MINOR.PATCH (e.g. 1.0.0)"
  exit 1
fi

echo ""
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Clipper OS — Release Preparation v${VERSION}${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""

# ---- Check we are in the repo root ------------------------
if [ ! -f "package.json" ]; then
  error "This script must be run from the repository root."
  exit 1
fi

# ---- Step 1: Build web assets ----------------------------
info "Step 1/3 — Building web assets (npm run build)..."
npm run build
success "Web assets built successfully → dist/"

echo ""

# ---- Step 2: Sync Capacitor ------------------------------
info "Step 2/3 — Syncing Capacitor projects (npx cap sync)..."
npx cap sync
success "Capacitor sync completed for Android and iOS."

echo ""

# ---- Step 3: Manual steps reminder -----------------------
info "Step 3/3 — Manual steps (required):"
echo ""

echo -e "${BOLD}  Android (Google Play):${RESET}"
echo -e "  1. Open Android Studio:  ${CYAN}npx cap open android${RESET}"
echo -e "  2. Build → Generate Signed Bundle / APK"
echo -e "  3. Select: Android App Bundle (.aab)"
echo -e "  4. Choose your release keystore"
echo -e "  5. Select build variant: ${BOLD}release${RESET}"
echo -e "  6. Output: android/app/release/app-release.aab"
echo ""

echo -e "${BOLD}  iOS (App Store):${RESET}"
echo -e "  1. Open Xcode:           ${CYAN}npx cap open ios${RESET}"
echo -e "  2. Select your signing team & provisioning profile"
echo -e "  3. Product → Archive"
echo -e "  4. Distribute App → App Store Connect"
echo ""

# ---- Final checklist --------------------------------------
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Release Checklist — v${VERSION}${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""
echo -e "  ${GREEN}✔${RESET}  Web assets built (dist/)"
echo -e "  ${GREEN}✔${RESET}  Capacitor synced (android/ & ios/)"
echo -e "  ${YELLOW}○${RESET}  Bump versionName to ${VERSION} in android/app/build.gradle"
echo -e "  ${YELLOW}○${RESET}  Bump versionCode in android/app/build.gradle"
echo -e "  ${YELLOW}○${RESET}  Update MARKETING_VERSION to ${VERSION} in Xcode"
echo -e "  ${YELLOW}○${RESET}  Sign and build Android AAB via Android Studio"
echo -e "  ${YELLOW}○${RESET}  Archive iOS build via Xcode"
echo -e "  ${YELLOW}○${RESET}  Upload AAB to Google Play Console"
echo -e "  ${YELLOW}○${RESET}  Upload IPA to App Store Connect"
echo -e "  ${YELLOW}○${RESET}  Tag release: git tag v${VERSION} && git push origin v${VERSION}"
echo ""
echo -e "${GREEN}${BOLD}All automated steps complete. Good luck with the release! 🚀${RESET}"
echo ""
