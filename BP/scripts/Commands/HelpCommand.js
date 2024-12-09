import ChatCommand from './CommandDefinition.js'
import { commands } from './CommandDefinition.js';

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