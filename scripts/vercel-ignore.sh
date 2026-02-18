#!/bin/bash

# Vercel Ignored Build Step Script
# This script determines whether a build should proceed on Vercel.
# 
# Exit code 1: Proceed with the build
# Exit code 0: Skip the build

echo "VERCEL_GIT_COMMIT_MESSAGE: $VERCEL_GIT_COMMIT_MESSAGE"

if [[ "$VERCEL_GIT_COMMIT_MESSAGE" == *"[deploy]"* ]]; then
  echo "✅ [deploy] keyword found. Proceeding with build."
  exit 1
else
  echo "🛑 [deploy] keyword not found. Skipping build."
  exit 0
fi
