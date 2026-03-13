#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$ROOT_DIR/skills"
DIST_DIR="$ROOT_DIR/dist"

mkdir -p "$DIST_DIR"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "No skills directory found" >&2
  exit 1
fi

cd "$SKILLS_DIR"
for d in */ ; do
  SKILL_NAME="${d%/}"
  zip -r "$DIST_DIR/$SKILL_NAME.zip" "$SKILL_NAME" >/dev/null
  echo "Packaged: $DIST_DIR/$SKILL_NAME.zip"
done
