import { Player, system } from "@minecraft/server";
import ChatCommand from './CommandDefinition.js'
import { commands } from './CommandDefinition.js';
import { Logger } from "../System/Logger.js"

function isTagAdmin(player: Player): boolean {
    const isAdmin = player.hasTag("tagAdmin");
    return isAdmin;
}

// Help Command
ChatCommand.create('Help', 'Help Command: Shows all available commands', ['h', 'help'], false, false, (player) => {
    const helpMessage = commands
        .filter(command => !command.permissions || command.permissions(player))
        .map(command => {
            const alias = command.alias.length > 0 ? `[${command.alias.join(', ')}] ` : '';
            const description = command.description ? command.description : '';

            let cmdArgs = "";
            if (command.args) {
                cmdArgs = Object.entries(command.args)
                    .map(([name, type], index) => `\n  ${name} : ${type}`)
                    .join("");
            }

            return `§7${command.command} - ${alias}${description}${cmdArgs}`;
        })
        .join('\n');
    player.sendMessage(`§aAvailable Commands\n${helpMessage}\n`);
});

// Debug Mode
ChatCommand.create('GetDebug', 'Get the debug flag', ['gd'], undefined, isTagAdmin, (player, args) => {
    player.sendMessage(`GetDebug command received...`);
    system.run(() => {
        player.sendMessage(`  Debug mode is ${Logger.IN_DEBUG_MODE}`)
    });
});
ChatCommand.create('SetDebug', 'Set the debug flag', ['sd'], { 'isDebug': 'boolean' }, isTagAdmin, (player, args) => {
    player.sendMessage(`SetDebug command received...`);
    system.run(() => {
        Logger.IN_DEBUG_MODE = args['isDebug'];
        player.sendMessage(`  Debug mode is ${Logger.IN_DEBUG_MODE}`)
    });
});