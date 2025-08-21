#!/bin/bash

# PokéCode CLI Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/justbecauselabs/pokecode/main/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO="justbecauselabs/pokecode"
BINARY_NAME="pokecode"
INSTALL_DIR="/usr/local/bin"

# Detect OS and Architecture
detect_platform() {
    local os
    local arch
    
    case "$(uname -s)" in
        Linux*)     os="linux" ;;
        Darwin*)    os="macos" ;;
        CYGWIN*|MINGW*|MSYS*) os="windows" ;;
        *)          
            echo -e "${RED}Error: Unsupported operating system: $(uname -s)${NC}"
            exit 1
            ;;
    esac
    
    case "$(uname -m)" in
        x86_64|amd64)   arch="x64" ;;
        arm64|aarch64)  arch="arm64" ;;
        *)              
            echo -e "${RED}Error: Unsupported architecture: $(uname -m)${NC}"
            exit 1
            ;;
    esac
    
    # Handle macOS architecture detection
    if [[ "$os" == "macos" && "$arch" == "arm64" ]]; then
        PLATFORM="macos-arm64"
    elif [[ "$os" == "macos" ]]; then
        PLATFORM="macos-x64"
    elif [[ "$os" == "windows" ]]; then
        PLATFORM="windows-x64"
        BINARY_NAME="pokecode.exe"
    else
        PLATFORM="linux-x64"
    fi
    
    echo -e "${BLUE}Detected platform: ${PLATFORM}${NC}"
}

# Get latest release version
get_latest_version() {
    local api_url="https://api.github.com/repos/${REPO}/releases/latest"
    
    if command -v curl >/dev/null 2>&1; then
        VERSION=$(curl -s "${api_url}" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    elif command -v wget >/dev/null 2>&1; then
        VERSION=$(wget -qO- "${api_url}" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    else
        echo -e "${RED}Error: curl or wget is required${NC}"
        exit 1
    fi
    
    if [[ -z "$VERSION" ]]; then
        echo -e "${RED}Error: Could not fetch latest version${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Latest version: ${VERSION}${NC}"
}

# Download binary
download_binary() {
    local download_url="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}-${PLATFORM}"
    local tmp_file="/tmp/${BINARY_NAME}"
    
    echo -e "${YELLOW}Downloading ${BINARY_NAME} ${VERSION} for ${PLATFORM}...${NC}"
    
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL -o "${tmp_file}" "${download_url}"
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "${tmp_file}" "${download_url}"
    else
        echo -e "${RED}Error: curl or wget is required${NC}"
        exit 1
    fi
    
    if [[ ! -f "${tmp_file}" ]]; then
        echo -e "${RED}Error: Failed to download binary${NC}"
        exit 1
    fi
    
    chmod +x "${tmp_file}"
    DOWNLOADED_BINARY="${tmp_file}"
}

# Install binary
install_binary() {
    local install_path="${INSTALL_DIR}/${BINARY_NAME}"
    
    echo -e "${YELLOW}Installing ${BINARY_NAME} to ${install_path}...${NC}"
    
    # Check if we need sudo
    if [[ -w "${INSTALL_DIR}" ]]; then
        mv "${DOWNLOADED_BINARY}" "${install_path}"
    else
        echo -e "${YELLOW}Administrator privileges required for installation...${NC}"
        sudo mv "${DOWNLOADED_BINARY}" "${install_path}"
    fi
    
    # Verify installation
    if command -v "${BINARY_NAME}" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ ${BINARY_NAME} installed successfully!${NC}"
        echo -e "${GREEN}✓ Version: $(${BINARY_NAME} --version)${NC}"
    else
        echo -e "${RED}Error: Installation failed${NC}"
        exit 1
    fi
}

# Check if already installed
check_existing() {
    if command -v "${BINARY_NAME}" >/dev/null 2>&1; then
        local current_version
        current_version=$(${BINARY_NAME} --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        echo -e "${YELLOW}${BINARY_NAME} is already installed (version: ${current_version})${NC}"
        read -p "Do you want to continue with the installation? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Installation cancelled.${NC}"
            exit 0
        fi
    fi
}

# Cleanup
cleanup() {
    if [[ -f "${DOWNLOADED_BINARY}" ]]; then
        rm -f "${DOWNLOADED_BINARY}"
    fi
}

# Main installation flow
main() {
    echo -e "${BLUE}🚀 PokéCode CLI Installer${NC}"
    echo
    
    check_existing
    detect_platform
    get_latest_version
    download_binary
    install_binary
    cleanup
    
    echo
    echo -e "${GREEN}🎉 Installation complete!${NC}"
    echo -e "${BLUE}Get started with: ${BINARY_NAME} --help${NC}"
    echo -e "${BLUE}Start a server with: ${BINARY_NAME} serve${NC}"
}

# Run with error handling
trap cleanup EXIT
main "$@"