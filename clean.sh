#!/bin/bash

UPLOAD_DIR="/home/server/oscc-backend/var/upload"
DEPLOY_DIR="/home/server/oscc-backend/var/deploy"

if [ ! -d "$UPLOAD_DIR" ]; then
    echo "Error: Directory $UPLOAD_DIR doesn't exist"
    exit 1
fi

if [ ! -d "$DEPLOY_DIR" ]; then
    echo "Error: Directory $DEPLOY_DIR doesn't exist"
    exit 1
fi

echo "Scanning upload directory..."
upload_basenames=()
while IFS= read -r -d '' file; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        basename="${filename%.*}"
        upload_basenames+=("$basename")
        echo "Found file: $filename (basename: $basename)"
    fi
done < <(find "$UPLOAD_DIR" -maxdepth 1 -type f -print0 2>/dev/null)

echo "Found ${#upload_basenames[@]} files in the upload directory"

declare -A upload_basename_map
for basename in "${upload_basenames[@]}"; do
    upload_basename_map["$basename"]=1
done

echo "Start cleaning up the deploy directory..."
deleted_count=0
while IFS= read -r -d '' item; do
    if [ "$item" = "$DEPLOY_DIR" ]; then
        continue
    fi

    item_name=$(basename "$item")

    if [ -z "${upload_basename_map[$item_name]}" ]; then
        if [ -f "$item" ]; then
            echo "Delete file: $item_name"
            rm -f -- "$item"
            ((deleted_count++))
        elif [ -d "$item" ]; then
            echo "Delete dirs: $item_name"
            rm -rf -- "$item"
            ((deleted_count++))
        fi
    else
        echo "Reserve: $item_name"
    fi
done < <(find "$DEPLOY_DIR" -maxdepth 1 -print0 2>/dev/null)

echo "Cleanup complete. $deleted_count items deleted"
