import { Player, world, system } from "@minecraft/server";
import { ChatCommandExecutionOptions, ChatCommandBuilder, ChatCommands } from './ChatCommands.js'
import { ManhuntGame } from "../Games/Manhunt.js"

let manhunt: ManhuntGame = new ManhuntGame();

ChatCommands.register(
    new ChatCommandBuilder('StartManhunt')
        .withDescription("Starts a new manhunt game")
        .withPermissions(['tagAdmin'])
        .withAliases(['smh'])
        .withArgument({ name: "hunted", type: "string", description: "name of the hunted player" })
        .withCompleteArgumentSet()
        .build(),
    (options: ChatCommandExecutionOptions) => {
        options.player.sendMessage(`Manhunt received...`);
        system.run(() => {
            if (manhunt !== null) {
                options.player.sendMessage(`  Start Manhunt...`);

                const huntedName = options.parsedArgs?.hunted ?? options.player.name;
                manhunt.start(options.player, huntedName);
            }
        });
    });