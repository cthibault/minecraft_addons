import { Player, world } from '@minecraft/server';
import { Logger } from "../System/Logger.js"
import { ChatColorCodes } from "../System/ChatCodes.js"

const commandRegistrations: Map<string, ChatCommandRegistration> = new Map();
let commandInitialized = false;

export interface Argument {
    name: string;
    description?: string;
    type: ("string" | "boolean" | "number");
}

export interface ArgumentSet {
    name: string;
    arguments: Argument[];
}

export interface ChatCommandProps {
    readonly name: string;
    description: string;
    group: string;
    aliases: string[];
    permissions: string[];
    argumentSets: ArgumentSet[];
}

export interface ParsedArgs {
    argumentSet: ArgumentSet;
    [key: string]: any;
}

export interface ChatComandExecutionOptions {
    player: Player;
    chatCommandProps: ChatCommandProps;
    parsedArgs?: ParsedArgs;
}

interface ChatCommandRegistration {
    commandProps: ChatCommandProps;
    onExecute: (options: ChatComandExecutionOptions) => void;
}


export class ChatCommandBuilder {
    private readonly props = {
        name: undefined,
        description: "",
        group: "",
        aliases: [],
        permissions: [],
        argumentSets: []
    };

    constructor(name: string) {
        if (!name) {
            throw new Error("Commands must have a unique name");
        }

        this.props.name = name;
    }

    withDescription(description: string): ChatCommandBuilder {
        this.props.description = description ?? "";
        return this;
    }

    withGroup(group: string): ChatCommandBuilder {
        this.props.group = group ?? "";
        return this;
    }

    withAliases(aliases: string[]): ChatCommandBuilder {
        if (aliases) {
            this.props.aliases = aliases;
        }
        return this;
    }

    withArgumentSet(argumentSet: ArgumentSet): ChatCommandBuilder {
        if (argumentSet !== undefined) {
            if (this.props.argumentSets.some(argSet => argSet.arguments.length === argumentSet.arguments.length)) {
                throw new Error(`An ArgumentSet with length ${argumentSet.arguments.length} already exists on command '${this.props.name}'.`);
            }

            this.props.argumentSets.push(argumentSet);
        }
        return this;
    }

    withPermissions(permissions: string[]): ChatCommandBuilder {
        if (permissions) {
            this.props.permissions = permissions;
        }
        return this;
    }

    build(): ChatCommandProps {
        return this.props;
    }
}

function findCommandRegistration(commandName: string): ChatCommandRegistration {
    let registration = commandRegistrations.get(commandName);
    if (!registration) {
        registration = Array.from(commandRegistrations.values()).find(cr => cr.commandProps.aliases.includes(commandName));
    }

    return registration;
}

Object.defineProperty(globalThis, 'MyChatCommand', {
    get: function () {
        const prefix = '!';

        return {
            register(commandProps: ChatCommandProps, onExecute: (options: ChatComandExecutionOptions) => void) {
                const cmdReg = {
                    commandProps: commandProps,
                    onExecute: onExecute
                };

                Logger.debug(`Registering ${commandProps.name}:\n${JSON.stringify(cmdReg, null, 2)}`);
                commandRegistrations.set(
                    commandProps.name,
                    cmdReg);

                if (commandInitialized) return;
                commandInitialized = true;

                world.beforeEvents.chatSend.subscribe(eventData => {
                    if (!eventData.message.startsWith(prefix)) return;

                    // Since this is one of our commands, cancel any further downstream event handlers
                    eventData.cancel = true;

                    // Parse command
                    const commandString = eventData.message.slice(prefix.length).trim();
                    const commandParts = commandString
                        ?.match(/[^\s"]+|"([^"]*)"/g)
                        ?.map((arg) => arg.replace(/^"|"$/g, ""));

                    // Find command
                    const commandName = commandParts.shift();
                    const commandRegistration = findCommandRegistration(commandName);
                    if (!commandRegistration) {
                        throw new Error(`Unable to find the registered command: ${commandName}.`);
                    }

                    // Check caller's perms against the command
                    // The caller must have all command perms
                    const playerTags = eventData.sender.getTags();
                    if (!commandRegistration.commandProps.permissions.every(p => playerTags.includes(p))) {
                        throw new Error(`The caller doesn't have the required permissions for this command. Permissions: ${commandRegistration.commandProps.permissions.join(',')}.`);
                    }

                    const options: ChatComandExecutionOptions = {
                        player: eventData.sender,
                        chatCommandProps: commandRegistration.commandProps
                    }
                    // Check if any argument set length matches the commandParts length
                    if (commandParts.length > 0) {
                        const argumentSet = commandRegistration.commandProps.argumentSets.find(argSet => argSet.arguments.length === commandParts.length);
                        if (!argumentSet) {
                            throw new Error(`The arguments do not match any signature for this command.  Arguments: ${commandParts.join(" | ")}`);
                        }

                        const errors: string[] = [];
                        options.parsedArgs = {
                            argumentSet: argumentSet
                        };

                        const typeDataErrorMessage = (value: string, index: number, typeName: string) => {
                            return `[${index}] '${argumentSet.arguments[index].name}' expects a ${typeName}. '${value}' is not a valid value.`;
                        };

                        commandParts.forEach((argValue, i) => {
                            const typeData = {
                                'boolean': (value: string) => {
                                    switch (value.toLowerCase()) {
                                        case "true":
                                        case "1":
                                            return true;
                                        case "false":
                                        case "0":
                                            return false;
                                        default:
                                            errors.push(typeDataErrorMessage(value, i, 'boolean'));
                                            return undefined;
                                    }
                                },
                                'number': (value: string) => {
                                    const num = Number(value);
                                    if (isNaN(num)) {
                                        errors.push(typeDataErrorMessage(value, i, 'number'));
                                        return undefined
                                    }
                                    return num;
                                },
                                'string': (value: string) => value
                            }

                            options.parsedArgs[argumentSet.arguments[i].name] = typeData[argumentSet.arguments[i].type](argValue);
                        });

                        if (errors.length > 0) {
                            throw new Error(`There were errors parsing the command: ${commandString}\n  ${errors.join("\n  ")}`);
                        }
                    }

                    commandRegistration.onExecute(options);
                });
            }
        };
    },
});
export default globalThis.MyChatCommand;