const express = require("express");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const PORT = process.env.PORT || 8090;

// ============================
// CONFIGURACIÓN DEL STREAM
// ============================

// 👉 Cambia esto por tu RTSP real (usa el substream si es Dahua/Hikvision)
const RTSP_URL = "rtsp://admin:Polanco_huamani_3@192.168.0.191:554/cam/realmonitor?channel=1&subtype=1";

const HLS_DIR = path.join(__dirname, "public", "hls");
const PLAYLIST = path.join(HLS_DIR, "index.m3u8");

// Crear carpeta si no existe
if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

// ============================
// INICIO DEL STREAM CON FFMPEG
// ============================

function startFFmpeg() {
  console.log("🎬 Iniciando transmisión desde cámara RTSP...");
  ffmpeg(RTSP_URL)
    .addOptions([
      "-rtsp_transport tcp",
      "-preset veryfast",
      "-g 25",
      "-sc_threshold 0",
      "-hls_time 2",
      "-hls_list_size 6",
      "-hls_flags delete_segments+program_date_time",
      "-hls_segment_filename",
      path.join(HLS_DIR, "segment_%03d.ts")
    ])
    .output(PLAYLIST)
    .on("start", (cmd) => console.log("✅ FFmpeg iniciado:", cmd))
    .on("stderr", (line) => {
      if (line.includes("frame=")) process.stdout.write(".");
    })
    .on("error", (err) => {
      console.error("💥 Error en FFmpeg:", err.message);
      console.log("Reintentando en 5 segundos...");
      setTimeout(startFFmpeg, 5000);
    })
    .on("end", () => {
      console.log("🛑 FFmpeg finalizó. Reiniciando...");
      setTimeout(startFFmpeg, 5000);
    })
    .run();
}

startFFmpeg();

// ============================
// SERVIDOR WEB
// ============================

// Servir archivos estáticos (index.html + video)
app.use(express.static(path.join(__dirname, "public")));

// Endpoint de salud
app.get("/health", (req, res) => {
  const exists = fs.existsSync(PLAYLIST);
  res.json({ stream: exists ? "activo" : "inicializando..." });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
});
