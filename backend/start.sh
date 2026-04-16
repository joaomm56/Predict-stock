#!/bin/sh

echo "Starting container..."

if [ ! -z "$DT_TENANT" ]; then
  echo "Installing Dynatrace OneAgent..."
  curl -o oneagent.sh \
    "https://${DT_TENANT}.live.dynatrace.com/api/v1/deployment/installer/agent/unix/default/latest?arch=x86" \
    --header "Authorization: Api-Token ${DT_API_TOKEN}"

  if [ $? -ne 0 ]; then
    echo "WARNING: Failed to download OneAgent installer. Continuing without it..."
  else
    sh oneagent.sh APP_LOG_CONTENT_ACCESS=1 || echo "WARNING: OneAgent install failed. Continuing without it..."
    sleep 5
  fi
fi

echo "Starting FastAPI..."
exec uvicorn main:app --host 0.0.0.0 --port 8000