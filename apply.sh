#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Apply the MIE Web template to an existing project.
#
# Usage:
#   bash <(curl -sL https://raw.githubusercontent.com/mieweb/template-mieweb-opensource/main/apply.sh)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="mieweb/template-mieweb-opensource"
BRANCH="main"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

# Template files to apply  —  add new entries here as the template grows.
# Format: "relative/path|Description"
TEMPLATE_FILES=(
  ".github/copilot-instructions.md|GitHub Copilot instructions (code quality, a11y, i18n, docs)"
  ".gitignore|Standard .gitignore for Node.js projects"
)

# ── Helpers ───────────────────────────────────────────────────────────────────

fetch_file() {
  curl -fsSL "$1" 2>/dev/null
}

prompt_choice() {
  local prompt="$1"
  local default="$2"
  local answer
  read -rp "$prompt" answer
  echo "${answer:-$default}"
}

merge_lines() {
  local local_file="$1"
  local remote_content="$2"
  local tmp
  tmp=$(mktemp)

  # Write existing content
  cat "$local_file" > "$tmp"

  # Append only lines not already present
  local added=0
  while IFS= read -r line; do
    if ! grep -qxF "$line" "$local_file" 2>/dev/null; then
      if [ "$added" -eq 0 ]; then
        echo "" >> "$tmp"
        echo "# ── Added by mieweb template ──" >> "$tmp"
        added=1
      fi
      echo "$line" >> "$tmp"
    fi
  done <<< "$remote_content"

  cat "$tmp"
  rm -f "$tmp"
}

# ── Per-file processing ──────────────────────────────────────────────────────

process_file() {
  local entry="$1"
  local file_path="${entry%%|*}"
  local description="${entry#*|}"

  echo ""
  echo "📄  ${file_path}"
  echo "    ${description}"

  local remote_content
  remote_content=$(fetch_file "${RAW_BASE}/${file_path}") || {
    echo "    ❌ Failed to fetch from ${RAW_BASE}/${file_path}"
    return
  }

  if [ -f "$file_path" ]; then
    local local_content
    local_content=$(cat "$file_path")

    if [ "$local_content" = "$remote_content" ]; then
      echo "    ✅ Already up to date"
      return
    fi

    echo "    ⚠️  Local file differs from template"
    local choice
    choice=$(prompt_choice "    (o)verwrite / (a)ppend / (m)erge-dedupe / (s)kip? [s]: " "s")

    case "${choice:0:1}" in
      o|O)
        echo "$remote_content" > "$file_path"
        echo "    ✅ Overwritten"
        ;;
      a|A)
        echo "" >> "$file_path"
        echo "$remote_content" >> "$file_path"
        echo "    ✅ Appended"
        ;;
      m|M)
        local merged
        merged=$(merge_lines "$file_path" "$remote_content")
        echo "$merged" > "$file_path"
        echo "    ✅ Merged (duplicates skipped)"
        ;;
      *)
        echo "    ⏭️  Skipped"
        ;;
    esac
  else
    local choice
    choice=$(prompt_choice "    File does not exist. (c)reate / (s)kip? [c]: " "c")

    case "${choice:0:1}" in
      c|C)
        mkdir -p "$(dirname "$file_path")"
        echo "$remote_content" > "$file_path"
        echo "    ✅ Created"
        ;;
      *)
        echo "    ⏭️  Skipped"
        ;;
    esac
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "🚀 MIE Web Template Applier"
  echo "   Source: github.com/${REPO}"
  echo "   Target: $(pwd)"

  for entry in "${TEMPLATE_FILES[@]}"; do
    process_file "$entry"
  done

  echo ""
  echo "✨ Done!"
  echo ""
}

main
