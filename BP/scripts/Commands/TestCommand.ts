import { Player, world, system } from "@minecraft/server";
import ChatCommand from './CommandDefinition.js'
import { TagArea } from "../Games/TagArea.js"
import { TagGame, TagGameStates, TagGameJsonDataOptions } from "../Games/TagGameBase.js"
import { ChatColorCodes } from "../System/ChatCodes.js"
import { Logger } from "../System/Logger.js"

let game: TagGame = new TagGame();

function isTagAdmin(player: Player): boolean {
    const isAdmin = player.hasTag("tagAdmin");
    return isAdmin;
}

ChatCommand.create('test', 'test', ['t'], undefined, false, (player, args) => {
    player.sendMessage(`test command received...`);
    system.run(() => {
        if (game !== null) {
            const message: string = "test command received";
            player.onScreenDisplay.setActionBar([{
                text: message
            }]);
        }
    });
});
ChatCommand.create('SetDebug', 'Set the debug flag', ['d'], { 'isDebug': 'boolean' }, isTagAdmin, (player, args) => {
    player.sendMessage(`SetDebug command received...`);
    system.run(() => {
        Logger.IN_DEBUG_MODE = args['isDebug'];
    });
});

ChatCommand.create('StartGame', 'Start Tag Game', ['ts'], undefined, isTagAdmin, (player, args) => {
    player.sendMessage(`StartGame command received...`);
    system.run(() => {
        if (game !== null) {
            player.sendMessage(`  Start Game...`);
            game.start(player);
        }
    });
});
ChatCommand.create('StopGame', 'Stop Tag Game', ['tstop'], undefined, isTagAdmin, (player, args) => {
    player.sendMessage(`StopGame command received...`);
    system.run(() => {
        if (game !== null) {
            player.sendMessage(`  Stop Game...`);
            game.stop();
        }
    });
});
ChatCommand.create('GetGameData', 'Get Game Data', ['td'], { 'includePlayerData': 'boolean', 'includeTagArea': 'boolean' }, isTagAdmin, (player, args) => {
    player.sendMessage(`GetGameData command received...`);
    system.run(() => {
        if (game !== null) {
            player.sendMessage(`${ChatColorCodes.gray}${game.getDataJson({
                includePlayerData: args['includePlayerData'],
                includeTagArea: args['includeTagArea'],
            })}`);
        }
    });
});

let tagArea: TagArea = new TagArea();

ChatCommand.create('BuildBorder', 'Build the boarder', ['bb'], { 'sideLength': 'number' }, isTagAdmin, (player, args) => {
    player.sendMessage(`Build boarder command received...`);
    system.run(() => {
        if (tagArea === undefined) {
            player.sendMessage(`  New tag area...`);
            tagArea = new TagArea();
        }

        player.sendMessage(`Building a border with a side length of ${args['sideLength']}.`);
        tagArea.build(player, args['sideLength']);
    });
});

ChatCommand.create('ResetBorder', 'Reset the boarder', ['rb'], undefined, isTagAdmin, (player, args) => {
    player.sendMessage(`Reset boarder command received...`);
    system.run(() => {
        tagArea.reset(player);
    });
});

ChatCommand.create('GetTagArea', 'Get tag area data', ['gta'], undefined, isTagAdmin, (player, args) => {
    player.sendMessage(`Get Tag Area data command received...`);
    system.run(() => {
        if (tagArea != undefined) {
            player.sendMessage(`${tagArea} `);
        } else {
            player.sendMessage(`The tag area is undefined.`);
        }
    });
});
