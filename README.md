# ⚡ ESTEC Wildfire Warning System — Web Dashboard (FE)

Ứng dụng Frontend Dashboard giám sát và cảnh báo cháy rừng cho tỉnh Thanh Hóa. Xây dựng bằng React 18 + Vite + TypeScript + Tailwind CSS.

Kho lưu trữ này được tách biệt độc lập từ hệ thống monorepo chính để chuyên biệt hóa phát triển Frontend.

## 🏗️ Công nghệ sử dụng
- **Core:** React 18, TypeScript
- **Bundler:** Vite
- **Styling:** Tailwind CSS (v4)
- **State Management:** Zustand (Auth Store)
- **API Client:** Axios (kết nối với Backend qua Proxy `/api` -> `http://localhost:8000`)
- **i18n:** i18next (hỗ trợ Tiếng Việt & Tiếng Anh)
- **Map:** MapLibre GL / OpenLayers

## 🚀 Hướng dẫn phát triển

### Yêu cầu hệ thống
- **Node.js** 20.x trở lên
- **npm** hoặc **yarn**

### Cài đặt và chạy Local

1. Di chuyển vào thư mục dự án và cài đặt dependencies:
   ```bash
   npm install
   ```

2. Chạy ứng dụng ở chế độ phát triển (Development):
   ```bash
   npm run dev
   ```
   *Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000` (hoặc `http://localhost:5173` tùy cấu hình).*

3. Xây dựng phiên bản Production:
   ```bash
   npm run build
   ```
   *Kết quả build sẽ nằm trong thư mục `dist/`.*

### Cấu hình Proxy kết nối Backend
Vite được cấu hình proxy tự động trong file `vite.config.ts`.
- Mọi request bắt đầu bằng `/api` sẽ được chuyển tiếp tới `http://localhost:8000` (Backend API).
- Đảm bảo Backend API đang chạy độc lập trên máy của bạn (qua repo `ESTEC-Wildfire-Warning-System-BE`).

## 🐳 Docker Deployment
Bạn có thể build và chạy Frontend độc lập qua Docker:

```bash
# Build image
docker build -t estec-wildfire/frontend-web .

# Chạy container
docker run -d -p 8082:80 --name wildfire_frontend_container estec-wildfire/frontend-web
```
Ứng dụng sẽ chạy ở cổng `8082`.
