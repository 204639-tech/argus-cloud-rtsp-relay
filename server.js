// ======================================================
// ARGUS RTSP → HLS CLOUD RELAY (Versión estable 2025)
// ======================================================

const express = require("express");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

// Usa el ffmpeg que Railway instala automáticamente
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ======================================================
// CONFIGURACIÓN
// ======================================================

// Lee URL de Railway (variable RTSP_URL)
const RTSP_URL = process.env.RTSP_URL;

// Ruta de salida HLS
const HLS_DIR = path.join(__dirname, "public", "hls");
const PLAYLIST = path.join(HLS_DIR, "index.m3u8");

// Asegurar estructura de carpetas
function ensureHlsFolder() {
    try {
        if (!fs.existsSync("public")) fs.mkdirSync("public");
        if (!fs.existsSync(HLS_DIR)) {
            fs.mkdirSync(HLS_DIR, { recursive: true });
            console.log("📁 Carpeta HLS creada correctamente.");
        }
    } catch (err) {
        console.error("❌ Error creando carpeta HLS:", err);
    }
}

ensureHlsFolder();

// ======================================================
// PROCESO PRINCIPAL FFmpeg
// ======================================================

function startFFmpeg() {
    console.log("🎥 Iniciando transmisión desde cámara RTSP...");
    console.log("🔗 URL:", RTSP_URL);

    ffmpeg(RTSP_URL)
        .addOptions([
            "-rtsp_transport tcp",
            "-preset veryfast",
            "-sc_threshold 0",
            "-g 25",
            "-hls_time 2",
            "-hls_list_size 6",
            "-hls_flags delete_segments+program_date_time",
            "-hls_segment_filename", path.join(HLS_DIR, "segment_%03d.ts")
        ])
        .output(PLAYLIST)
        .on("start", cmd => {
            console.log("✅ FFmpeg iniciado:");
            console.log(cmd);
        })
        .on("stderr", line => {
            if (line.includes("frame")) process.stdout.write(".");
        })
        .on("error", err => {
            console.error("\n❌ Error en FFmpeg:", err.message);
            console.log("🔄 Reintentando en 5 segundos...");
            setTimeout(startFFmpeg, 5000);
        })
        .on("end", () => {
            console.log("\n⛔ FFmpeg terminó. Reiniciando en 5 segundos...");
            setTimeout(startFFmpeg, 5000);
        })
        .run();
}

startFFmpeg();

// ======================================================
// SERVIDOR WEB EXPRESS
// ======================================================

const app = express();
const PORT = process.env.PORT || 8080;

// Servir contenido estático
app.use(express.static(path.join(__dirname, "public")));

// Endpoint para verificar si el stream está activo
app.get("/health", (req, res) => {
    const exists = fs.existsSync(PLAYLIST);
    res.json({
        stream: exists ? "activo" : "inicializando",
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor web
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
