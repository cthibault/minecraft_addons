	import { Player, world, system } from "@minecraft/server";
import ChatCommand from './CommandDefinition.js'
import { ChatCommandExecutionOptions, ChatCommandBuilder, ChatCommandManager, ChatCommands } from './MyChatCommand.js'

ChatCommand.create('test', 'test', ['t'], undefined, false, (player, args) => {
    player.sendMessage(`test command received...`);

    system.run(() => {
        const message: string = "test command received";
        player.onScreenDisplay.setActionBar([{
            text: message
        }]);
    });
});

ChatCommand.create('test', 'test', ['t2'], { "name": "string" }, false, (player, args) => {
    player.sendMessage(`test command received...`);

    system.run(() => {
        const message: string = `test command received:\n  ${args["name"]}`;
        player.onScreenDisplay.setActionBar([{
            text: message
        }]);
    });
});

ChatCommands.register(
    new ChatCommandBuilder('MyTest')
        .withDescription('sample test command')
        .withAliases(['myt'])
        .withArgument({ name: "age", type: "number", defaultValue: 10, description: "some age value" })
        .withArgument({ name: "age2", type: "number", defaultValue: 10, description: "some age value" })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        options.player.sendMessage("I made it");
        options.player.sendMessage(JSON.stringify(options, null, 2));
    });