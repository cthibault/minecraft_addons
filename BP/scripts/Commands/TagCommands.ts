import { Player, world, system } from "@minecraft/server";
import { ChatCommandExecutionOptions, ChatCommandBuilder, ChatCommands } from './ChatCommands.js'
import { TagGame, TagGameStates, TagGameInitOptions, TagGameJsonDataOptions } from "../Games/TagGameBase.js"
import { ChatColorCodes } from "../System/ChatCodes.js"

let gameInstance: TagGame = undefined;

function getCurrentGame(): TagGame {
    if (gameInstance === undefined) {
        gameInstance = new TagGame();
    }

    return gameInstance;
}

ChatCommands.register(
    new ChatCommandBuilder('TagStart')
        .withDescription('Start a new game of tag')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['tstart'])
        .withArgument({ name: "tagger", type: "string", defaultValue: undefined, description: "name of the initial tagger" })
        .withEmptyArgumentSet()
        .withCompleteArgumentSet()
        .build(),
    (options: ChatCommandExecutionOptions) => {
        system.run(() => {
            const game = getCurrentGame();
            if (game !== null) {
                const initOptions: TagGameInitOptions = {
                }

                if (options.parsedArgs.tagger !== undefined) {
                    initOptions.defaultTaggerName = options.parsedArgs.tagger
                }
                game.start(options.player, initOptions);
            }
        });
    });
// 

ChatCommands.register(
    new ChatCommandBuilder('TagStop')
        .withDescription('Stop the current game of tag')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['tstop'])
        .build(),
    (options: ChatCommandExecutionOptions) => {
        system.run(() => {
            const game = getCurrentGame();
            if (game !== null && game.gameState === TagGameStates.Active) {
                options.player.sendMessage(`  Stop Game...`);
                game.stop();
            }
        });
    });

ChatCommands.register(
    new ChatCommandBuilder('TagReset')
        .withDescription('Reset the current game of tag')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['treset'])
        .build(),
    (options: ChatCommandExecutionOptions) => {
        system.run(() => {
            const game = getCurrentGame();
            if (game !== null) {
                game.reset();
                gameInstance = undefined;
            }
        });
    });

ChatCommands.register(
    new ChatCommandBuilder('TagGameData')
        .withDescription('Dump the game data for the current game of tag')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['tdata'])
        .withArgument({ name: "includePlayerData", type: "boolean", description: "flag indicating the player data should be included in the output" })
        .withArgument({ name: "includeTagArea", type: "boolean", description: "flag indicating tag area data should be included in the output" })
        .withEmptyArgumentSet()
        .withCompleteArgumentSet()
        .withArgumentSet({ name: "playerDataOnly", argumentNamesInOrder: ["includePlayerData"] })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        system.run(() => {
            const game = getCurrentGame();
            if (game !== null) {
                options.player.sendMessage(`${ChatColorCodes.gray}${game.getDataJson({
                    includePlayerData: options.parsedArgs?.includePlayerData ?? false,
                    includeTagArea: options.parsedArgs?.includeTagArea ?? false,
                })}`);
            }
        });
    });

ChatCommands.register(
    new ChatCommandBuilder('BuildBorder')
        .withDescription('Build a boarder for a given tag area')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['bb'])
        .withArgument({ name: "sideLength", type: "number", defaultValue: 10, description: "side length of the boundary border" })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        system.run(() => {
            const game = getCurrentGame();
            if (game !== null) {
                options.player.sendMessage(`Building a border with a side length of ${options.parsedArgs.sideLength}.`);
                game.gameTagArea.build(options.player, options.parsedArgs.sideLength)
            }
        });
    });

ChatCommands.register(
    new ChatCommandBuilder('RemoveBorder')
        .withDescription('Remove the boarder for a given tag area')
        .withPermissions(['tagAdmin'])
        .withGroup("tag")
        .withAliases(['rb'])
        .build(),
    (options: ChatCommandExecutionOptions) => {
        system.run(() => {
            const game = getCurrentGame();
            if (game !== null) {
                options.player.sendMessage(`Remove the border for the current tag area.`);
                game.gameTagArea.reset(options.player);
            }
        });
    });