import { menu } from "./menu.js";
import { font } from "./font.js";

export async function handleCommand(command) {
  switch (command.toLowerCase()) {

    case "menu":
      return menu;

    case "ping":
      return font("🏓 JUNIORSTIVEN BOT está funcionando.");

    case "info":
      return font(`
╭━━━━━━━━━━━━━━━━━━╮
     🖤 JUNIORSTIVEN BOT
╰━━━━━━━━━━━━━━━━━━╯

Versión: 1.0.0
Estado: En desarrollo
Lenguaje: JavaScript
Desarrollador: JUNIORSTIVEN
      `);

    case "owner":
      return font("👑 Propietario: JUNIORSTIVEN");

    case "admins":
      return font("👑 Próximamente: lista de administradores.");

    default:
      return font("❌ Comando no reconocido. Escribe .menu");
  }
}
