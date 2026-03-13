#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$ROOT_DIR/skills"
DIST_DIR="$ROOT_DIR/dist"

usage() {
  echo "Usage: bash scripts/package-skill.sh --skill <skill-name>" >&2
  exit 1
}

SKILL_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skill)
      SKILL_NAME="${2:-}"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

if [[ -z "$SKILL_NAME" ]]; then
  usage
fi

SKILL_PATH="$SKILLS_DIR/$SKILL_NAME"
if [[ ! -d "$SKILL_PATH" ]]; then
  echo "Skill not found: $SKILL_NAME" >&2
  exit 1
fi

mkdir -p "$DIST_DIR"
OUTPUT_ZIP="$DIST_DIR/$SKILL_NAME.zip"

cd "$SKILLS_DIR"
zip -r "$OUTPUT_ZIP" "$SKILL_NAME" >/dev/null

echo "Packaged: $OUTPUT_ZIP"
