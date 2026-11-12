import yts from "yt-search";

const API = "https://api-faa.my.id/faa/ytmp3";
const MAX_SECONDS = 20 * 60;
const MAX_BYTES = 20 * 1024 * 1024;

const bold = (text) => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";

  return String(text).replace(/[A-Za-z0-9]/g, (char) => {
    if (upper.includes(char))
      return String.fromCodePoint(0x1D5D4 + upper.indexOf(char));
    if (lower.includes(char))
      return String.fromCodePoint(0x1D5EE + lower.indexOf(char));
    return String.fromCodePoint(0x1D7EC + digits.indexOf(char));
  });
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function request(url, attempts = 2) {
  let lastError;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json, audio/mpeg, */*"
        },
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 250);
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await wait(1500);
    }
  }

  throw lastError;
}

function findAudioUrl(data) {
  if (!data || typeof data !== "object") return null;

  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" &&
      /^https?:\/\//i.test(value) &&
      (
        /^(mp3|audio|audio_url|download|download_url)$/i.test(key) ||
        /\.mp3(?:[?#]|$)/i.test(value)
      )
    ) {
      return value;
    }
  }

  for (const value of Object.values(data)) {
    if (value && typeof value === "object") {
      const found = findAudioUrl(value);
      if (found) return found;
    }
  }

  return null;
}

const cmd = {
  command: ["play", "mp3", "ytmp3", "ytaudio", "playaudio"],
  category: "downloads",
  description: "Descarga audio de YouTube",

  run: async ({ msg, sock, args = [] }) => {
    const jid = msg?.key?.remoteJid;

    const reply = async (text) => {
      await sock.sendMessage(
        jid,
        { text: bold(text) },
        { quoted: msg }
      );
    };

    try {
      const query = Array.isArray(args) ? args.join(" ").trim() : String(args).trim();

      if (!query) {
        return reply("Escribe el nombre de una canción. Ejemplo: .play nombre de la canción");
      }

      await reply("Buscando la canción...");

      const search = await yts(query);
      const video = search?.videos?.[0];

      if (!video?.url || !video?.title) {
        return reply("No encontré esa canción. Intenta con otro nombre.");
      }

      if (video.seconds && video.seconds > MAX_SECONDS) {
        return reply("La canción supera el límite de 20 minutos.");
      }

      const youtubeUrl = video.url;

      await reply("Preparando el audio...");

      const apiUrl = `${API}?url=${encodeURIComponent(youtubeUrl)}`;
      const apiResponse = await request(apiUrl, 2);

      let data;
      try {
        data = await apiResponse.json();
      } catch {
        throw new Error("La API no devolvió una respuesta JSON válida.");
      }

      const audioUrl = findAudioUrl(data);

      if (!audioUrl) {
        throw new Error("La API no entregó un enlace de audio válido.");
      }

      await reply("Descargando y preparando el archivo...");

      const audioResponse = await request(audioUrl, 2);
      const contentType = audioResponse.headers.get("content-type") || "";

      if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
      ) {
        throw new Error("El servidor devolvió una página web en lugar del audio.");
      }

      const declaredSize = Number(audioResponse.headers.get("content-length") || 0);

      if (declaredSize > MAX_BYTES) {
        throw new Error("El audio supera el límite de tamaño permitido.");
      }

      const buffer = Buffer.from(await audioResponse.arrayBuffer());

      if (!buffer.length) {
        throw new Error("El archivo de audio llegó vacío.");
      }

      if (buffer.length > MAX_BYTES) {
        throw new Error("El audio supera el límite de tamaño permitido.");
      }

      const filename = video.title
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .slice(0, 90) + ".mp3";

      await sock.sendMessage(
        jid,
        {
          audio: buffer,
          mimetype: "audio/mpeg",
          fileName: filename,
          ptt: false
        },
        { quoted: msg }
      );

    } catch (error) {
      console.error("[PLAY ERROR]", error);

      let message = "No se pudo descargar la canción.";

      if (/HTTP 403/.test(error.message)) {
        message = "El servidor de descarga rechazó la solicitud (HTTP 403). Intenta nuevamente más tarde.";
      } else if (/HTTP 404/.test(error.message)) {
        message = "El servidor no encontró el audio solicitado.";
      } else if (/timeout|aborted/i.test(error.message)) {
        message = "La descarga tardó demasiado. Intenta nuevamente.";
      } else if (error.message) {
        message += ` ${error.message}`;
      }

      try {
        await reply(message);
      } catch (replyError) {
        console.error("[PLAY REPLY ERROR]", replyError);
      }
    }
  }
};

export default cmd;
