#!/usr/bin/env bash
# Run on Spark: auth proxy in front of Ollama.
set -euo pipefail
if [[ -z "${SPARK_OLLAMA_SECRET:-}" ]]; then
  echo "Set SPARK_OLLAMA_SECRET" >&2
  exit 1
fi
exec python3 "$(dirname "$0")/spark-ollama-proxy.py"
