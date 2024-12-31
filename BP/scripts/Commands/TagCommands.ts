import { Player, world, system } from "@minecraft/server";
//import ChatCommand from './CommandDefinition.js'
import { ChatCommandExecutionOptions, ChatCommandBuilder, ChatCommandManager, ChatCommands } from './MyChatCommand.js'
import { TagGame, TagGameStates, TagGameJsonDataOptions } from "../Games/TagGameBase.js"
import { ChatColorCodes } from "../System/ChatCodes.js"

let game: TagGame = new TagGame();

function isTagAdmin(player: Player): boolean {
    const isAdmin = player.hasTag("tagAdmin");
    return isAdmin;
}

ChatCommands.register(
    new ChatCommandBuilder('StartGame')
        .withDescription('Start a new game of tag')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['ts'])
        .build(),
    (options: ChatCommandExecutionOptions) => {
        options.player.sendMessage(`StartGame command received...`);
        system.run(() => {
            if (game !== null) {
                options.player.sendMessage(`  Start Game...`);
                game.start(options.player);
            }
        });
    });

ChatCommands.register(
    new ChatCommandBuilder('StopGame')
        .withDescription('Start a new game of tag')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['tstop'])
        .build(),
    (options: ChatCommandExecutionOptions) => {
        options.player.sendMessage(`StopGame command received...`);
        system.run(() => {
            if (game !== null) {
                options.player.sendMessage(`  Stop Game...`);
                game.stop();
            }
        });
    });

ChatCommands.register(
    new ChatCommandBuilder('GetGameData')
        .withDescription('Dump the game data for the current game of tag')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['td'])
        .withArgument({ name: "includePlayerData", type: "boolean", description: "flag indicating the player data should be included in the output" })
        .withArgument({ name: "includeTagArea", type: "boolean", description: "flag indicating tag area data should be included in the output" })
        .withEmptyArgumentSet()
        .withCompleteArgumentSet()
        .withArgumentSet({ name: "abc", argumentNamesInOrder: ["includePlayerData"] })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        options.player.sendMessage(`GetGameData command received...`);
        system.run(() => {
            if (game !== null) {
                options.player.sendMessage(`${ChatColorCodes.gray}${game.getDataJson({
                    includePlayerData: options.parsedArgs?.includePlayerData ?? true,
                    includeTagArea: options.parsedArgs?.includeTagArea ?? true,
                })}`);
            }
        });
    });


ChatCommand.create('BuildBorder', 'Build the boarder', ['bb'], { 'sideLength': 'number' }, isTagAdmin, (player, args) => {
    player.sendMessage(`Build boarder command received...`);
    system.run(() => {
        player.sendMessage(`Building a border with a side length of ${args['sideLength']}.`);
        game.gameTagArea.build(player, args['sideLength']);
    });
});

ChatCommand.create('ResetBorder', 'Reset the boarder', ['rb'], undefined, isTagAdmin, (player, args) => {
    player.sendMessage(`Reset boarder command received...`);
    system.run(() => {
        game.gameTagArea.reset(player);
    });
});

ChatCommand.create('GetTagArea', 'Get tag area data', ['gta'], undefined, isTagAdmin, (player, args) => {
    player.sendMessage(`Get Tag Area data command received...`);
    system.run(() => {
        player.sendMessage(`${game.gameTagArea}`);
    });
});
