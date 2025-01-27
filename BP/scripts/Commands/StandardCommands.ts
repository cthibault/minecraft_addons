import { Player, system } from "@minecraft/server";
import { ChatCommandExecutionOptions, ChatCommandBuilder, ChatCommands, ChatCommandDefinition } from './ChatCommands.js'
import { Logger } from "../System/Logger.js"
import { ChatColorCodes } from "../System/ChatCodes.js"

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
            //   Command <Arg1Value> <Arg2Value>
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
                }).forEach(a => output.push(`${ChatCommands.COMMAND_PREFIX}${definition.name} ${a.argumentNamesInOrder.map(an => `<${an}Value>`).join(" ")}`));
            }
        }
        else {
            const definitions = ChatCommands.getCommandDefinitions();
            definitions.forEach(d => output.push(cmdAndDescription(d)));
        }

        player.sendMessage(output.join("\n"));
    });



// Debug Mode
ChatCommands.register(
    new ChatCommandBuilder('GetDebug')
        .withDescription('Get the debug flag')
        .withAliases(['gd'])
        .withArgument({ name: "age", type: "number", defaultValue: 10, description: "some age value" })
        .withArgument({ name: "json", type: "string", defaultValue: "", description: "some json value" })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        options.player.sendMessage(`Debug mode is ${Logger.IN_DEBUG_MODE}`);
    });

ChatCommands.register(
    new ChatCommandBuilder('SetDebug')
        .withDescription('Set the debug flag')
        .withAliases(['sd'])
        .withArgument({ name: "isDebug", type: "boolean", defaultValue: false, description: "the debug flag value" })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        Logger.IN_DEBUG_MODE = options.parsedArgs.isDebug;
        options.player.sendMessage(`Debug mode is ${Logger.IN_DEBUG_MODE}`);
    });