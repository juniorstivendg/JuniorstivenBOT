import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import pino from "pino";
import qrcode from "qrcode-terminal";
import { handleCommand } from "./commands.js";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\nESCANEA ESTE QR DESDE WHATSAPP:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("𝗝𝘂𝗻𝗶𝗼𝗿𝘀𝘁𝗶𝘃𝗲𝗻 𝗕𝗢𝗧 CONECTADO CORRECTAMENTE.");
    }

    if (connection === "close") {
      const status = lastDisconnect?.error?.output?.statusCode;

      if (status !== DisconnectReason.loggedOut) {
        console.log("Conexión cerrada. Intentando reconectar...");
        startBot();
      } else {
        console.log("Sesión cerrada. Debes vincular nuevamente.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      if (!text.startsWith(".")) continue;

      const command = text.slice(1).trim().split(/\s+/)[0];

      try {
        const response = await handleCommand(command);

        if (response) {
          await sock.sendMessage(
            msg.key.remoteJid,
            { text: response },
            { quoted: msg }
          );
        }
      } catch (error) {
        console.error("Error ejecutando comando:", error);
      }
    }
  });
}

startBot().catch(console.error);
