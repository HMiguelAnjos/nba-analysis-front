#!/bin/sh
set -eu

envsubst '${VITE_API_URL}' < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js
