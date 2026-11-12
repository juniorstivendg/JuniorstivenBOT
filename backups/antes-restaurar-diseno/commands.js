import fs from "node:fs";
import sharp from "sharp";
import {
  downloadContentFromMessage
} from "@whiskeysockets/baileys";

const DATA_FILE = "data/bot-data.json";

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { mutedUsers: [], activity: {} };
  }
}

const data = loadData();
export const mutedUsers = new Set(data.mutedUsers || []);
const activity = data.activity || {};
const recentImages = new Map();

function saveData() {
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    mutedUsers: [...mutedUsers],
    activity
  }, null, 2));
}

function normalize(jid) {
  return jid ? jid.replace(/:\d+(?=@)/, "") : "";
}

function getContext(msg) {
  return msg.message?.extendedTextMessage?.contextInfo || {};
}

function getTarget(msg) {
  const context = getContext(msg);
  return context.mentionedJid?.[0] || context.participant || null;
}

function getText(msg) {
  const m = msg.message || {};
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption || "";
}

function isAdmin(participant) {
  return participant?.admin === "admin" ||
    participant?.admin === "superadmin";
}

async function groupInfo(sock, jid) {
  const metadata = await sock.groupMetadata(jid);

  const botIds = [
    sock.user?.id,
    sock.user?.lid
  ].filter(Boolean).map(normalize);

  const bot = metadata.participants.find(p =>
    [p.id, p.lid].filter(Boolean).some(id =>
      botIds.includes(normalize(id))
    )
  );

  if (!isAdmin(bot)) {
    console.log("DIAGNÓSTICO DE ADMINISTRADOR:", {
      botIdentificado: Boolean(bot),
      botEsAdmin: isAdmin(bot),
      participantes: metadata.participants.length
    });

    throw new Error("El bot debe ser administrador de este grupo.");
  }

  return metadata;
}

async function issuerIsAdmin(sock, jid, msg, metadata) {
  const sender = msg.key.participant || msg.key.remoteJid;
  const participant = metadata.participants.find(
    p => normalize(p.id) === normalize(sender)
  );
  return isAdmin(participant) || msg.key.fromMe;
}

async function downloadImage(imageMessage) {
  const stream = await downloadContentFromMessage(imageMessage, "image");
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function rememberImage(msg, sock) {
  const image = msg.message?.imageMessage;
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant;

  if (!image || !jid?.endsWith("@g.us") || !sender) return;

  try {
    const buffer = await downloadImage(image);
    recentImages.set(`${jid}:${sender}`, buffer);
  } catch (error) {
    console.error("No se pudo guardar imagen reciente:", error.message);
  }
}

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[c]);
}

function wrapText(text, max = 17) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 7);
}

async function textSticker(text, style) {
  const lines = wrapText(text);
  const color = style === "brat" ? "#8ACF00" : "#FFFFFF";
  const textColor = "#000000";
  const fontSize = lines.length > 4 ? 38 : 48;
  const startY = 256 - ((lines.length - 1) * fontSize * 0.55);

  const textSvg = lines.map((line, i) =>
    `<text x="256" y="${startY + i * fontSize * 1.1}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${textColor}">${escapeXml(line)}</text>`
  ).join("");

  const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="24" fill="${color}"/>${style === "qc" ? '<rect x="20" y="20" width="472" height="472" rx="28" fill="none" stroke="black" stroke-width="8"/>' : ""}${textSvg}</svg>`;

  return sharp(Buffer.from(svg)).webp().toBuffer();
}

export async function handleCommand(command, sock, msg, args = []) {
  const jid = msg.key.remoteJid;

  if (!jid?.endsWith("@g.us")) {
    return "Este comando solo funciona en grupos.";
  }

  let metadata;

  try {
    metadata = await groupInfo(sock, jid);
  } catch (error) {
    return error.message;
  }

  const participants = metadata.participants;
  const ids = participants.map(p => p.id).filter(Boolean);
  const target = getTarget(msg);
  const sender = msg.key.participant || msg.key.remoteJid;
  const admin = await issuerIsAdmin(sock, jid, msg, metadata);

  if (["kick", "promote", "demote", "mute", "unmute", "gon", "goff"].includes(command) && !admin) {
    return "Solo los administradores del grupo pueden usar este comando.";
  }

  try {
    switch (command) {
      case "menu":
        return "JUNIORSTIVEN BOT\n\n.kick\n.todos\n.promote\n.demote\n.mute\n.unmute\n.mutelist\n.gon\n.goff\n.link\n.fantasmas\n.admins\n.s\n.brat texto\n.qc texto";

      case "kick":
        if (!target) return "Uso: .kick @usuario o responde a su mensaje.";
        await sock.groupParticipantsUpdate(jid, [target], "remove");
        return "Usuario expulsado.";

      case "promote":
      case "demote":
        if (!target) return `Uso: .${command} @usuario o responde a su mensaje.`;
        await sock.groupParticipantsUpdate(
          jid,
          [target],
          command === "promote" ? "promote" : "demote"
        );
        return command === "promote" ? "Administrador concedido." : "Administrador retirado.";

      case "todos": {
        const content = getText(msg).replace(/^\.todos\s*/i, "").trim();
        const message = content || "Atención a todos.";
        await sock.sendMessage(jid, {
          text: `📢 MENCIÓN GENERAL\n\n${message}\n\n${ids.map(id => `@${id.split("@")[0]}`).join(" ")}`,
          mentions: ids
        }, { quoted: msg });
        return null;
      }

      case "admins": {
        const admins = participants.filter(isAdmin).map(p => p.id);
        if (!admins.length) return "No se encontraron administradores.";
        await sock.sendMessage(jid, {
          text: `👑 ADMINISTRADORES\n\n${admins.map(id => `@${id.split("@")[0]}`).join("\n")}`,
          mentions: admins
        }, { quoted: msg });
        return null;
      }

      case "mute":
      case "unmute": {
        if (!target) return `Uso: .${command} @usuario o responde a su mensaje.`;
        const key = `${jid}:${target}`;

        if (command === "mute") {
          mutedUsers.add(key);
          saveData();
          return "Usuario silenciado. Sus próximos mensajes serán eliminados.";
        }

        mutedUsers.delete(key);
        saveData();
        return "Usuario desilenciado.";
      }

      case "mutelist": {
        const list = [...mutedUsers]
          .filter(key => key.startsWith(`${jid}:`))
          .map(key => key.slice(jid.length + 1));

        if (!list.length) return "No hay usuarios silenciados.";
        await sock.sendMessage(jid, {
          text: `🔇 USUARIOS SILENCIADOS\n\n${list.map(id => `@${id.split("@")[0]}`).join("\n")}`,
          mentions: list
        }, { quoted: msg });
        return null;
      }

      case "gon":
      case "goff":
        await sock.groupSettingUpdate(
          jid,
          command === "gon" ? "not_announcement" : "announcement"
        );
        return command === "gon" ? "Grupo abierto. Todos pueden enviar mensajes." : "Grupo cerrado. Solo administradores pueden enviar mensajes.";

      case "link": {
        const code = await sock.groupInviteCode(jid);
        return `Enlace del grupo:\nhttps://chat.whatsapp.com/${code}`;
      }

      case "fantasmas": {
        const now = Date.now();
        const limit = 72 * 60 * 60 * 1000;

        const ghosts = participants
          .filter(p => {
            const last = activity[`${jid}:${p.id}`];
            return last && now - last >= limit && !isAdmin(p);
          })
          .map(p => p.id);

        if (!ghosts.length) {
          return "No hay participantes con 3 días de inactividad comprobada. El registro empieza desde que se activa esta función.";
        }

        await sock.sendMessage(jid, {
          text: `👻 INACTIVOS POR 3 DÍAS O MÁS\n\n${ghosts.map(id => `@${id.split("@")[0]}`).join("\n")}`,
          mentions: ghosts
        }, { quoted: msg });
        return null;
      }

      case "s": {
        const context = getContext(msg);
        let buffer = null;

        if (context.quotedMessage?.imageMessage) {
          buffer = await downloadImage(context.quotedMessage.imageMessage);
        } else if (target) {
          buffer = recentImages.get(`${jid}:${target}`);
        }

        if (!buffer) return "Responde a una imagen o menciona a alguien cuya imagen reciente haya sido recibida por el bot.";

        const sticker = await sharp(buffer)
          .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();

        await sock.sendMessage(jid, { sticker }, { quoted: msg });
        return null;
      }

      case "qc": {
        const text = args.join(" ").trim();
        if (!text) return `Uso: .${command} escribe tu texto`;

        const sticker = await textSticker(text, command);
        await sock.sendMessage(jid, { sticker }, { quoted: msg });
        return null;
      }

      default:
        return null;
    }
  } catch (error) {
    console.error(`Error en comando ${command}:`, error);
    return `No se pudo ejecutar el comando: ${error.message}`;
  }
}

export function recordActivity(msg) {
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant;

  if (!jid?.endsWith("@g.us") || !sender || msg.key.fromMe) return;

  activity[`${jid}:${sender}`] = Date.now();
  saveData();
}

export function shouldDeleteMuted(msg) {
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant;
  if (!jid?.endsWith("@g.us") || !sender) return false;
  return mutedUsers.has(`${jid}:${sender}`);
}
