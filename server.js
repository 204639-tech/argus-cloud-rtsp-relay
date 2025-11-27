// ======================================================
// ARGUS RTSP → HLS CLOUD RELAY (VERSIÓN ESTABLE 2025)
// ======================================================

const express = require("express");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

// Usa FFmpeg instalado en Railway
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ======================================================
// CONFIGURACIÓN
// ======================================================

const RTSP_URL = process.env.RTSP_URL;

if (!RTSP_URL) {
    console.error("❌ ERROR: No existe la variable RTSP_URL en Railway.");
    process.exit(1);
}

const HLS_DIR = path.join(__dirname, "public", "hls");
const PLAYLIST = path.join(HLS_DIR, "index.m3u8");

// Crear carpetas necesarias
function ensureHlsFolder() {
    if (!fs.existsSync("public")) fs.mkdirSync("public");
    if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });
}

ensureHlsFolder();

// ======================================================
// FUNCIÓN PRINCIPAL: INICIAR FFMPEG
// ======================================================

function startFFmpeg() {
    console.log("🎥 Iniciando transmisión RTSP → HLS");
    console.log("🔗 URL:", RTSP_URL);

    ffmpeg(RTSP_URL)
        .addOptions([
            "-rtsp_transport", "tcp",
            "-timeout", "7000000",
            "-stimeout", "7000000",
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "4",
            "-preset", "veryfast",
            "-sc_threshold", "0",
            "-g", "25",
            "-hls_time", "2",
            "-hls_list_size", "6",
            "-hls_flags", "delete_segments+program_date_time",
            "-hls_segment_filename", path.join(HLS_DIR, "segment_%03d.ts")
        ])
        .output(PLAYLIST)
        .on("start", cmd => {
            console.log("✅ FFmpeg iniciado correctamente");
            console.log("⚙️  CMD:", cmd);
        })
        .on("stderr", line => {
            if (line.includes("frame")) process.stdout.write(".");
        })
        .on("error", err => {
            console.error("\n❌ ERROR FFMPEG:", err.message);
            console.log("🔄 Reintentando en 5 segundos...");
            setTimeout(startFFmpeg, 5000);
        })
        .on("end", () => {
            console.log("\n⚠️ FFMPEG terminó. Reiniciando...");
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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Endpoint de salud
app.get("/health", (req, res) => {
    res.json({
        estado: fs.existsSync(PLAYLIST) ? "activo" : "inicializando",
        timestamp: new Date().toISOString(),
        rtsp: RTSP_URL
    });
});

// Iniciar servidor web
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en http://localhost:${PORT}`);
});