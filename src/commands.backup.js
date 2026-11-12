import { menu } from "./menu.js";
import { font } from "./font.js";

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

    case "admins":
      return font("👑 Próximamente: lista de administradores.");

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

      if (!jid?.endsWith("@g.us")) {
        return font("❌ Este comando solo funciona en grupos.");
      }

      const content = msg.message?.extendedTextMessage?.text
        || msg.message?.conversation
        || "";

      const aviso = content.trim().replace(/^\.n\s*/i, "");

      if (!aviso) {
        return font("Uso: .n Escribe tu anuncio");
      }

      const group = await sock.groupMetadata(jid);
      const participants = group.participants || [];
      const ids = participants.map(p => p.id).filter(Boolean);

      if (!ids.length) {
        return font("No se encontraron participantes.");
      }

      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const tags = batch.map(id => "@" + id.split("@")[0]);

        await sock.sendMessage(jid, {
          text: "📢 AVISO PARA TODOS\n\n" + aviso + "\n\n" + tags.join(" "),
          mentions: batch
        });
      }

      return null;
    }

    default:
      return font("❌ Comando no reconocido. Escribe .menu");
  }
}
