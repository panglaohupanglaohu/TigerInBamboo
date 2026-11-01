#!/bin/bash
# usage: gifs-download.sh < list   (lines: postId key [index])
G="$(dirname "$0")/gifs"; mkdir -p "$G"
while read -r id key idx; do
  [ -z "$id" ] && continue
  name="$id"; [ -n "$idx" ] && [ "$idx" != "1" ] && name="${id}_${idx}"
  f="$G/$name.mp4"; [ -s "$f" ] && { echo "skip $name"; continue; }
  code=$(curl -s -m 60 -o "$f.part" -w "%{http_code}" "https://video.twimg.com/tweet_video/$key.mp4")
  if [ "$code" = "200" ]; then mv "$f.part" "$f"; echo "ok $name $(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")"; else rm -f "$f.part"; echo "fail $name $code"; fi
  echo "$id $key ${idx:-1}" >> "$G/manifest.txt"
done
