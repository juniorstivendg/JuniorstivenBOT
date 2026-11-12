import { font } from "./font.js";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  normalizeMessageContent
} from "@whiskeysockets/baileys";

import pino from "pino";
import { handleCommand, mutedUsers } from "./commands.js";

let reconnectTimer = null;
let starting = false;
let stopped = false;

async function startBot() {
  if (starting) return;
  starting = true;
  stopped = false;

  try {
    console.log("Iniciando JUNIORSTIVEN BOT...");

    const { state, saveCreds } =
      await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "warn" }),
      printQRInTerminal: false,
      browser: ["JUNIORSTIVEN BOT", "Chrome", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    });

    sock.ev.on("creds.update", saveCreds);



    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
      if (connection === "connecting") {
        console.log("Conectando con WhatsApp...");
      }

      if (connection === "open") {
        console.log("JUNIORSTIVEN BOT CONECTADO.");
        console.log("Esperando mensajes y comandos...");
      }

      if (connection === "close") {
        const status = lastDisconnect?.error?.output?.statusCode;

        console.log("CONEXIÓN CERRADA. Código:", status);

        if (status === DisconnectReason.loggedOut) {
          stopped = true;
          console.log("La sesión fue cerrada por WhatsApp.");
          return;
        }

        if (!reconnectTimer && !stopped) {
          console.log("Reconexión programada en 5 segundos...");
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            starting = false;
            startBot();
          }, 5000);
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      console.log("EVENTO DE MENSAJES:", type);

      if (type !== "notify") return;

      for (const msg of messages) {
        try {
          if (!msg.message) continue;

          const content = normalizeMessageContent(msg.message);

          const text =
            content?.conversation ||
            content?.extendedTextMessage?.text ||
            content?.imageMessage?.caption ||
            content?.videoMessage?.caption ||
            content?.documentMessage?.caption ||
            "";

          
const muteJid = msg.key.remoteJid;
const mutedSender = msg.key.participant;
const muteKey = `${muteJid}:${mutedSender}`;
const muteText = typeof text === "string" ? text.trim() : "";

if (
  muteJid?.endsWith("@g.us") &&
  mutedSender &&
  mutedUsers.has(muteKey) &&
  !/^\.unmute(?:\s|$)/i.test(muteText)
) {
  try {
    await sock.sendMessage(muteJid, {
      delete: msg.key
    });
  } catch (error) {
    console.error("ERROR ELIMINANDO MENSAJE:", error);
    continue;
  }
}

if (!text.trim()) continue;

          console.log("MENSAJE RECIBIDO:", text);

          const cleanText = text.trim();

          if (!cleanText.startsWith(".")) continue;

          const command = cleanText.slice(1).trim().split(/\s+/)[0];

          if (!command) continue;

          console.log("COMANDO DETECTADO:", command);

          const response = await handleCommand(command, sock, msg);

          if (response) {
            await sock.sendMessage(
              msg.key.remoteJid,
              { text: font(response) },
              { quoted: msg }
            );

            console.log("RESPUESTA ENVIADA:", command);
          }
        } catch (error) {
          console.error("ERROR PROCESANDO MENSAJE:", error);
        }
      }
    });

  } catch (error) {
    console.error("ERROR DE INICIO:", error);
    starting = false;

    if (!reconnectTimer && !stopped) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot();
      }, 5000);
    }

    return;
  }

  starting = false;
}

process.on("SIGINT", () => {
  stopped = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  console.log("\nBot detenido. La sesión guardada se conserva.");
  process.exit(0);
});

startBot();
