#!/bin/bash

# Sync reviews from Judge.me API (server-side, no CORS)
JUDGEME_TOKEN="eQqnPJZkoTo8DIVtlfIT1O1zHT4"
SHOP_DOMAIN="ejjge0-zf.myshopify.com"

echo "Syncing reviews from Judge.me..."
RAW=$(curl -sf "https://judge.me/api/v1/reviews?api_token=${JUDGEME_TOKEN}&shop_domain=${SHOP_DOMAIN}&per_page=50&page=1")

if [ $? -eq 0 ] && [ -n "$RAW" ]; then
  echo "$RAW" | python3 -c "
import json, sys
data = json.load(sys.stdin)
reviews = [r for r in data.get('reviews', []) if round(r.get('rating', 0)) >= 4]
print(json.dumps(reviews[:12], ensure_ascii=False))
" > assets/reviews-data.json
  COUNT=$(python3 -c "import json; print(len(json.load(open('assets/reviews-data.json'))))" 2>/dev/null || echo "?")
  echo "Reviews synced: ${COUNT} reviews written to assets/reviews-data.json"
else
  echo "Warning: Could not fetch reviews from Judge.me (check token/network). Using existing reviews-data.json if present."
fi

echo "Pushing to DEV theme only..."
shopify theme push --store=ejjge0-zf.myshopify.com --theme=160971161842
echo "Done. Preview: https://ejjge0-zf.myshopify.com/?preview_theme_id=160971161842"

