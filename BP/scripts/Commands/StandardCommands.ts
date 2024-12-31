import { Player, system } from "@minecraft/server";
import ChatCommand from './CommandDefinition.js'
import { commands } from './CommandDefinition.js';
import { ChatCommandExecutionOptions, ChatCommandBuilder, ChatCommands, ChatCommandDefinition } from './MyChatCommand.js'
import { Logger } from "../System/Logger.js"
import { ChatColorCodes } from "../System/ChatCodes.js"

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

/*
    help        [list commands + description]
    help cmd    [show command + description + alias + arguments]
*/
ChatCommands.register(
    new ChatCommandBuilder('Help')
        .withDescription('sample test command')
        .withAliases(['h', '?'])
        .withArgument({ name: "command", type: "string", description: "Command name" })
        .withEmptyArgumentSet("List")
        .withArgumentSet({ name: "Details", argumentNamesInOrder: ["command"] })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        const player = options.player;

        const output = []

        // CommandName [Alias, Alias]
        //   Description
        const cmdAndDescription = (cmdDefinition: ChatCommandDefinition) => {
            let result = `${ChatColorCodes.yellow}${cmdDefinition.name} [${cmdDefinition.aliases.join(", ")}]`;
            if (cmdDefinition.description) {
                result += `${ChatColorCodes.gray}\n  ${cmdDefinition.description}`;
            }
            return result;
        };

        if (options.parsedArgs?.command) {
            const definition = ChatCommands.getCommandDefinitions(options.parsedArgs.command)[0];
            // CommandName [Alias, Alias]
            //   Description
            //
            //   == Arguments ==
            //   Name <Type> : Description
            //
            //   == Argument Sets ==
            //   Name : Arg1 Arg2
            // output.push(cmdAndDescription)
            output.push(cmdAndDescription(definition));

            if (definition.arguments.length > 0) {
                output.push("");
                output.push("  == Arguments ==");
                definition.arguments.forEach(a => output.push(`  ${a.name} <${a.type}> : ${a.description}`));

                output.push("");
                output.push("  == Argument Sets ==");
                definition.argumentSets.sort((a, b) => {
                    if (a.argumentNamesInOrder.length > b.argumentNamesInOrder.length) return 1;
                    if (a.argumentNamesInOrder.length < b.argumentNamesInOrder.length) return -11;
                    return 0;
                }).forEach(a => output.push(`  ${a.name} : ${ChatCommands.COMMAND_PREFIX}${definition.name} ${a.argumentNamesInOrder.join(" ")}`));
            }
        }
        else {
            const definitions = ChatCommands.getCommandDefinitions();
            definitions.forEach(d => output.push(cmdAndDescription(d)));
        }

        player.sendMessage(output.join("\n"));
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