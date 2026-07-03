#!/bin/bash

# Script to extract .MOV files into image sequences for a Canvas Flipbook
# Requires ffmpeg-static

FFMPEG_BIN="../../node_modules/ffmpeg-static/ffmpeg"
METADATA_FILE="frames_metadata.json"

echo "{" > $METADATA_FILE

# Process each .MOV file
# Ensure we loop over actual files
shopt -s nullglob
for file in *.MOV; do
  # Get the room id/name (e.g., "1", "suite")
  room_id="${file%.MOV}"
  
  echo "Processing room: $room_id..."

  # Create directories
  mkdir -p "frames/$room_id/desktop"
  mkdir -p "frames/$room_id/mobile"

  # Desktop: 1080p, 15fps, High quality JPEG (q:v 2-5)
  echo "  Extracting desktop frames..."
  $FFMPEG_BIN -y -i "$file" -vf "scale=1920:-1, fps=15" -q:v 3 "frames/$room_id/desktop/frame_%04d.jpg"
  desktop_count=$(ls -1q frames/$room_id/desktop/*.jpg | wc -l)
  desktop_count=$(echo $desktop_count | xargs) # trim whitespace

  # Mobile: 720p, 24fps, Medium quality JPEG (q:v 4-6) to save size
  echo "  Extracting mobile frames..."
  $FFMPEG_BIN -y -i "$file" -vf "scale=1280:-1, fps=24" -q:v 4 "frames/$room_id/mobile/frame_%04d.jpg"
  mobile_count=$(ls -1q frames/$room_id/mobile/*.jpg | wc -l)
  mobile_count=$(echo $mobile_count | xargs) # trim whitespace

  # Append to metadata json
  echo "  \"$room_id\": { \"desktop\": $desktop_count, \"mobile\": $mobile_count }," >> $METADATA_FILE

  echo "  Finished room: $room_id"
done

# Fix the trailing comma in the JSON (simple hack)
sed -i '' '$ s/,$//' $METADATA_FILE
echo "}" >> $METADATA_FILE

echo "Frame extraction complete!"
