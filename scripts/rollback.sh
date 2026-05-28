#!/bin/bash

# =========================================================================
# HƯỚNG DẪN SỬ DỤNG SCRIPT ROLLBACK TỰ ĐỘNG (scripts/rollback.sh)
# 
# 1. Rollback về phiên bản của một Git SHA cụ thể:
#    ./scripts/rollback.sh sha-a1b2c3d
# 
# 2. Tự động rollback về commit liền trước của commit hiện tại:
#    ./scripts/rollback.sh
# 
# Lưu ý: Chạy script này trên máy chủ VPS từ thư mục gốc của dự án.
# =========================================================================

# Khai báo biến đường dẫn docker compose file
COMPOSE_FILE="docker-compose.prod.yml"

# Lấy tham số Git SHA từ người dùng (nếu có)
TARGET_SHA=$1

# Nếu không truyền Git SHA, hệ thống tự động tìm mã SHA của commit liền trước
if [ -z "$TARGET_SHA" ]; then
    echo "⚠️  Không nhận được Git SHA chỉ định. Đang tự động tìm phiên bản liền trước..."
    
    # Kiểm tra xem có đang ở trong git repository không
    if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        echo "❌ Lỗi: Thư mục hiện tại không nằm trong git repository để tự động truy vết."
        echo "Vui lòng truyền thủ công Git SHA: ./scripts/rollback.sh [git-sha]"
        exit 1
    fi
    
    # Lấy short Git SHA (7 ký tự) của commit liền trước (HEAD~1)
    PREV_COMMIT_SHA=$(git log -n 2 --pretty=format:"%h" | tail -n 1)
    
    if [ -z "$PREV_COMMIT_SHA" ]; then
        echo "❌ Lỗi: Không thể tìm thấy commit liền trước trong lịch sử git."
        exit 1
    fi
    
    TARGET_SHA="sha-${PREV_COMMIT_SHA}"
    echo "🔍 Tìm thấy phiên bản liền trước: ${TARGET_SHA}"
else
    # Chuẩn hóa tiền tố tag "sha-" nếu người dùng chỉ nhập SHA thuần túy
    if [[ ! $TARGET_SHA =~ ^sha- ]]; then
        TARGET_SHA="sha-${TARGET_SHA}"
    fi
    echo "🔍 Chuẩn bị Rollback về phiên bản được chỉ định: ${TARGET_SHA}"
fi

# Thiết lập biến môi trường
export API_IMAGE_TAG="${TARGET_SHA}"
export WORKER_IMAGE_TAG="${TARGET_SHA}"

echo "🔄 Đang tải Docker Images tương ứng với tag ${TARGET_SHA}..."
docker compose -f $COMPOSE_FILE pull backend-1 backend-2 worker

if [ $? -ne 0 ]; then
    echo "❌ Lỗi: Không tìm thấy image có tag ${TARGET_SHA} trên GitHub Container Registry (ghcr.io)."
    echo "Vui lòng kiểm tra lại mã Git SHA đã nhập."
    exit 1
fi

echo "🚀 Đang tiến hành Recreate các container với phiên bản ${TARGET_SHA}..."
docker compose -f $COMPOSE_FILE up -d --no-deps --force-recreate backend-1 backend-2 worker

if [ $? -eq 0 ]; then
    echo "========================================================"
    echo "✅ ROLLBACK THÀNH CÔNG!"
    echo "Hệ thống đã phục hồi về phiên bản: ${TARGET_SHA}"
    echo "========================================================"
    echo "📊 TRẠNG THÁI CÁC DỊCH VỤ HIỆN TẠI:"
    docker compose -f $COMPOSE_FILE ps
else
    echo "❌ Lỗi: Có sự cố xảy ra trong quá trình khởi động lại container."
    exit 1
fi
