import { menu } from "./menu.js";
import { font } from "./font.js";

export const mutedUsers = new Set();

export async function handleCommand(command, sock, msg) {
  switch (command.toLowerCase()) {

    case "menu":
      return menu;

    case "ping":
      return font("🏓 JUNIORSTIVEN BOT está funcionando.");

    case "info":
      return font(`
🖤 JUNIORSTIVEN BOT

Versión: 1.0.0
Estado: En desarrollo
Lenguaje: JavaScript
Desarrollador: JUNIORSTIVEN
      `);

    case "owner":
      return font("👑 Propietario: JUNIORSTIVEN");

    
case "admins": {
    const jid = msg?.key?.remoteJid;

    if (!jid?.endsWith("@g.us")) {
        return font("❌ Este comando solo funciona en grupos.");
    }

    const group = await sock.groupMetadata(jid);

    const admins = group.participants.filter(
        p => p.admin === "admin" || p.admin === "superadmin"
    );

    if (!admins.length) {
        return font("❌ No hay administradores.");
    }

    const mentions = admins.map(p => p.id).filter(Boolean);

    const texto = mentions.map(
        id => `🥷🏽 @${id.split("@")[0]}`
    ).join("\n");

await sock.sendMessage(jid, {
    text: `👑 𝗔𝗗𝗠𝗜𝗡𝗜𝗦𝗧𝗥𝗔𝗗𝗢𝗥𝗘𝗦 𝗗𝗘𝗟 𝗚𝗥𝗨𝗣𝗢\n\n${texto}`,
    mentions: mentions
});

    return null;
}

case "kick":
case "promote":
case "demote": {
    const jid = msg.key.remoteJid;

    if (!jid.endsWith("@g.us")) {
        return font("❌ Este comando solo funciona en grupos.");
    }

    const group = await sock.groupMetadata(jid);
    const participants = group.participants;

    const cleanJid = id => id?.replace(/:\d+(?=@)/, "");

    const sender = cleanJid(msg.key.participant);
    const bot = cleanJid(sock.user.id);

    const senderData = participants.find(
        p => cleanJid(p.id) === sender
    );

    const botIds = [
    sock.user?.id,
    sock.user?.lid
].filter(Boolean).map(cleanJid);

const botData = participants.find(p =>
    [p.id, p.phoneNumber]
        .filter(Boolean)
        .some(id => botIds.includes(cleanJid(id)))
);

    const isAdmin = p =>
        p?.admin === "admin" || p?.admin === "superadmin";

    if (!isAdmin(senderData)) {
        return font("❌ Solo los administradores pueden usar este comando.");
    }

    if (!isAdmin(botData)) {
        return font("❌ Necesito ser administrador del grupo.");
    }

    const context = msg.message?.extendedTextMessage?.contextInfo;

    const target =
        context?.mentionedJid?.[0] ||
        context?.participant;

    if (!target) {
        return font(
            `❌ Uso correcto:\n.${command} @usuario\n\nTambién puedes responder a su mensaje.`
        );
    }

    const targetData = participants.find(
    p => cleanJid(p.id) === cleanJid(target)
);

if (!targetData) {
    return font("❌ No encontré a ese participante en el grupo.");
}

const actions = {
    kick: "remove",
    promote: "promote",
    demote: "demote"
};

const messages = {
    kick: "🚫 Usuario expulsado correctamente.",
    promote: "👑 Usuario ascendido a administrador.",
    demote: "Se retiró el administrador correctamente."
};

try {
    await sock.groupParticipantsUpdate(
        jid,
        [targetData.id],
        actions[command]
    );
    return font(messages[command]);
} catch (error) {
    console.error("ERROR DE ADMINISTRACIÓN:", error);
    return font("❌ No se pudo realizar la acción. Comprueba los permisos.");
}
}

case "todos": {
      const jid = msg?.key?.remoteJid;

      if (!jid?.endsWith("@g.us")) {
        return font("❌ Este comando solo funciona en grupos.");
      }

      const group = await sock.groupMetadata(jid);
      const participants = group.participants || [];

      if (!participants.length) {
        return font("No se encontraron participantes.");
      }

      const valid = participants
        .map(p => p.phoneNumber || p.id || p.jid)
        .filter(Boolean);

      for (let i = 0; i < valid.length; i += 10) {
        const batch = valid.slice(i, i + 10);

        const lines = batch.map(id => {
          const number = id.split("@")[0].replace(/\D/g, "");
          return `👻 @${number || "participante"}`;
        });

        const header = font(
          "Invocados por Juniorstiven ✌🏽!\n\nEtiquetas:\n\n"
        );

        await sock.sendMessage(jid, {
          text: header + lines.map(line => line.replace(
            /^👻 @(\d+)$/,
            "👻 @$1"
          )).join("\n"),
          mentions: batch
        });
      }

      return null;
    }


    
case "n": {
    const jid = msg?.key?.remoteJid;

    if (!jid || !jid.endsWith("@g.us")) {
        return font("❌ Este comando solo funciona en grupos.");
    }

    const content =
        msg.message?.extendedTextMessage?.text ||
        msg.message?.conversation ||
        "";

    const aviso = content.trim().replace(/^\.n\s*/i, "").trim();

    if (!aviso) {
        return font("Uso: .n Escribe tu anuncio");
    }

    await sock.sendMessage(
        jid,
        { text: aviso },
        { quoted: msg }
    );

    return null;
}



    case "alltag": {
      const jid = msg.key.remoteJid;

      if (!jid || !jid.endsWith("@g.us")) {
        return font("❌ Este comando solo funciona en grupos.");
      }

      const group = await sock.groupMetadata(jid);
      const participants = group.participants || [];
      const ids = participants.map(p => p.id).filter(Boolean);

      if (!ids.length) {
        return font("❌ No se encontraron participantes.");
      }

      const content =
        msg.message?.extendedTextMessage?.text ||
        msg.message?.conversation ||
        "";

      const aviso = content.trim().replace(/^\.alltag\s*/i, "");

      let texto = "📢 MENCIÓN GENERAL\n\n";
      texto += aviso ? aviso + "\n\n" : "¡Atención a todos!\n\n";
      texto += `👥 Miembros: ${ids.length}\n\n`;

      for (const id of ids) {
        texto += `┊ @${id.split("@")[0]}\n`;
      }

      await sock.sendMessage(jid, {
        text: texto,
        mentions: ids
      });

      return null;
    }

    
case "mute":
case "unmute": {
    const jid = msg?.key?.remoteJid;

    if (!jid?.endsWith("@g.us")) {
        return font("❌ Este comando solo funciona en grupos.");
    }

    const context = msg.message?.extendedTextMessage?.contextInfo;
    const target = context?.mentionedJid?.[0] || context?.participant;

    if (!target) {
        return font(`❌ Uso: .${command} @usuario o responde a su mensaje.`);
    }

    const key = `${jid}:${target}`;

    if (command.toLowerCase() === "mute") {
        mutedUsers.add(key);
        return font("🔇 Usuario silenciado.");
    }

    mutedUsers.delete(key);
    return font("🔊 Usuario desilenciado.");
}

default:
      return font("❌ Comando no reconocido. Escribe .menu");
  }
}
