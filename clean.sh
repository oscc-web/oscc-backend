#!/bin/bash

UPLOAD_DIR="/home/server/oscc-backend/var/upload"
DEPLOY_DIR="/home/server/oscc-backend/var/deploy"

if [ ! -d "$UPLOAD_DIR" ]; then
    echo "错误：目录 $UPLOAD_DIR 不存在"
    exit 1
fi

if [ ! -d "$DEPLOY_DIR" ]; then
    echo "错误：目录 $DEPLOY_DIR 不存在"
    exit 1
fi

echo "正在扫描upload目录..."
upload_basenames=()
while IFS= read -r -d '' file; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        basename="${filename%.*}"
        upload_basenames+=("$basename")
        echo "找到文件: $filename (基础名: $basename)"
    fi
done < <(find "$UPLOAD_DIR" -maxdepth 1 -type f -print0 2>/dev/null)

echo "在upload目录中找到 ${#upload_basenames[@]} 个文件"

declare -A upload_basename_map
for basename in "${upload_basenames[@]}"; do
    upload_basename_map["$basename"]=1
done

echo "开始清理deploy目录..."
deleted_count=0
while IFS= read -r -d '' item; do
    if [ "$item" = "$DEPLOY_DIR" ]; then
        continue
    fi

    item_name=$(basename "$item")

    if [ -z "${upload_basename_map[$item_name]}" ]; then
        if [ -f "$item" ]; then
            echo "删除文件: $item_name"
            rm -f -- "$item"
            ((deleted_count++))
        elif [ -d "$item" ]; then
            echo "删除目录: $item_name"
            rm -rf -- "$item"
            ((deleted_count++))
        fi
    else
        echo "保留: $item_name"
    fi
done < <(find "$DEPLOY_DIR" -maxdepth 1 -print0 2>/dev/null)

echo "清理完成。共删除了 $deleted_count 个项目"
