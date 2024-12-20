import { Player, world, system } from "@minecraft/server";
import ChatCommand from './CommandDefinition.js'
import MyChatCommand from './MyChatCommand.js'
import { Argument, ArgumentSet, ChatComandExecutionOptions, ChatCommandBuilder, ChatCommandProps } from './MyChatCommand.js'

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

MyChatCommand.register(
    new ChatCommandBuilder('MyTest')
        .withDescription('sample test command')
        .withAliases(['myt'])
        .withArgumentSet({
            name: "default",
            arguments: [
                { name: "age", type: "number", description: "only argument" },
                { name: "name", type: "string", description: "only argument" },
                { name: "inSchool", type: "boolean", description: "only argument" },
            ]
        })
        .build(),
    (options: ChatComandExecutionOptions) => {
        options.player.sendMessage("I made it");
    });