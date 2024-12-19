import { Player, world, system } from "@minecraft/server";
import ChatCommand from './CommandDefinition.js'

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
