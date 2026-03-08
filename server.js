/**
 * Whisk API Web Server
 * 
 * Bọc thư viện whisk-api thành REST API để n8n có thể gọi.
 * 
 * Endpoints:
 *   GET  /health          - Kiểm tra server sống
 *   POST /generate        - Tạo ảnh từ prompt
 *   POST /update-cookie   - Cập nhật cookie không cần restart
 * 
 * Environment Variables:
 *   COOKIE  - Google cookie (lấy từ labs.google)
 *   PORT    - Port server (mặc định 3000)
 */

import express from "express";
import { Whisk } from "@rohitaryal/whisk-api";

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 3000;

// ============================================================
// Cookie Management
// Cookie lưu trong memory, có thể update qua API hoặc env var
// ============================================================
let currentCookie = process.env.COOKIE || "";

// ============================================================
// GET /health
// Dùng để Coolify hoặc n8n kiểm tra server còn sống
// ============================================================
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    hasCookie: currentCookie.length > 0,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// POST /generate
// Tạo ảnh từ prompt, trả về base64
//
// Body:
//   prompt        (required)  - Mô tả ảnh cần tạo
//   cookie        (optional)  - Override cookie mặc định
//   aspect_ratio  (optional)  - LANDSCAPE (default) / SQUARE / PORTRAIT
//   seed          (optional)  - Seed cho ảnh (0 = random)
//
// Response (luôn trả 200 để n8n dễ xử lý với If node):
//   { success: true,  image: "data:image/png;base64,..." }
//   { success: false, error: "lý do lỗi" }
// ============================================================
app.post("/generate", async (req, res) => {
  const startTime = Date.now();

  try {
    const { prompt, cookie, aspect_ratio, seed } = req.body;

    // Ưu tiên cookie trong request, fallback về cookie server
    const useCookie = cookie || currentCookie;

    // Validate input
    if (!useCookie) {
      return res.json({
        success: false,
        error: "No cookie provided. Set COOKIE env var or pass cookie in request body.",
      });
    }

    if (!prompt || !prompt.trim()) {
      return res.json({
        success: false,
        error: "No prompt provided.",
      });
    }

    // Map aspect ratio strings đơn giản sang format Google cần
    const aspectRatioMap = {
      LANDSCAPE: "IMAGE_ASPECT_RATIO_LANDSCAPE",
      SQUARE: "IMAGE_ASPECT_RATIO_SQUARE",
      PORTRAIT: "IMAGE_ASPECT_RATIO_PORTRAIT",
    };

    const resolvedAspect =
      aspectRatioMap[aspect_ratio] ||
      aspect_ratio ||
      "IMAGE_ASPECT_RATIO_LANDSCAPE";

    // Tạo Whisk instance và generate ảnh
    console.log(`[generate] prompt: "${prompt.substring(0, 80)}..." | aspect: ${resolvedAspect}`);

    const whisk = new Whisk(useCookie);
    const images = await whisk.generateImage(
      {
        prompt: prompt.trim(),
        model: "IMAGEN_3_5",
        aspectRatio: resolvedAspect,
        seed: seed || 0,
      },
      1 // count = 1 ảnh
    );

    if (!images || images.length === 0) {
      return res.json({
        success: false,
        error: "Whisk returned no images.",
      });
    }

    const image = images[0];
    const elapsed = Date.now() - startTime;
    console.log(`[generate] SUCCESS in ${elapsed}ms`);

    return res.json({
      success: true,
      image: image.encodedMedia,
      seed: image.seed,
      mediaGenerationId: image.mediaGenerationId,
      elapsed_ms: elapsed,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMsg = error.message || String(error);
    console.error(`[generate] FAILED in ${elapsed}ms: ${errorMsg}`);

    return res.json({
      success: false,
      error: errorMsg,
      elapsed_ms: elapsed,
    });
  }
});

// ============================================================
// POST /update-cookie
// Cập nhật cookie mà không cần restart server
//
// Body:
//   cookie (required) - Cookie mới từ trình duyệt
//
// Khi nào dùng:
//   Cookie Google hết hạn (thường sau vài ngày/tuần)
//   Bạn lấy cookie mới từ Chrome rồi POST vào đây
// ============================================================
app.post("/update-cookie", (req, res) => {
  const { cookie } = req.body;

  if (!cookie || !cookie.trim()) {
    return res.json({ success: false, error: "No cookie provided." });
  }

  currentCookie = cookie.trim();
  console.log("[update-cookie] Cookie updated successfully");

  return res.json({
    success: true,
    message: "Cookie updated. New requests will use the new cookie.",
  });
});

// ============================================================
// Start server
// ============================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Whisk API server running on port ${PORT}`);
  console.log(`Cookie configured: ${currentCookie.length > 0 ? "YES" : "NO"}`);
});
