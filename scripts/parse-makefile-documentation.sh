#!/usr/bin/env bash

# Parse Makefile and display help in a formatted way
# Usage: ./scripts/makefile-help.sh [makefile_path]

MAKEFILE="${1:-Makefile}"

# ANSI color codes
CYAN='\033[36m'
RESET='\033[0m'
BOLD='\033[1m'

# Check if Makefile exists
if [ ! -f "$MAKEFILE" ]; then
    echo "Error: $MAKEFILE not found"
    exit 1
fi

# Extract and format help
echo -e "\n${BOLD}Transpoze - Available Commands${RESET}\n"

# Parse sections and commands
current_section=""
while IFS= read -r line; do
    # Check for section headers (lines starting with ##)
    if [[ "$line" =~ ^##[[:space:]](.+)$ ]]; then
        current_section="${BASH_REMATCH[1]}"
        echo -e "\n${BOLD}${current_section}${RESET}"
        echo "$(echo "$current_section" | sed 's/./-/g')"
    # Check for target with help text
    elif [[ "$line" =~ ^([a-zA-Z_-]+):[[:space:]]*##[[:space:]](.+)$ ]]; then
        target="${BASH_REMATCH[1]}"
        help_text="${BASH_REMATCH[2]}"
        printf "  ${CYAN}%-20s${RESET} %s\n" "$target" "$help_text"
    fi
done < "$MAKEFILE"

echo ""
