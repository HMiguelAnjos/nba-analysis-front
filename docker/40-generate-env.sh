#!/bin/sh
set -eu

API_URL="${VITE_API_URL:-${vite_api_url:-http://localhost:8000}}"
API_URL="$(printf '%s' "$API_URL" | sed "s/^['\"]//; s/['\"]$//" | sed 's#/*$##')"

case "$API_URL" in
	http://*|https://*) ;;
	*) API_URL="https://$API_URL" ;;
esac

export API_URL

envsubst '${API_URL}' < /opt/runtime/default.conf.template > /etc/nginx/conf.d/default.conf
envsubst '${API_URL}' < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js
