import { Player, world } from '@minecraft/server';
import { Logger } from "../System/Logger.js"
import { ChatColorCodes } from "../System/ChatCodes.js"

export interface Argument {
    name: string;
    description?: string;
    type: ("string" | "boolean" | "number");
    defaultValue?: (string | boolean | number | undefined);
}

export interface ArgumentSet {
    name?: string;
    argumentNamesInOrder: string[];
}

export interface ChatCommandDefinition {
    name: string;
    description: string;
    group: string;
    aliases: string[];
    permissions: string[];
    arguments: Argument[];
    argumentSets?: ArgumentSet[];
}

export interface ParsedArgs {
    argumentSet: ArgumentSet;
    [key: string]: any;
}

export interface ChatCommandExecutionOptions {
    player: Player;
    chatCommandDefinition: ChatCommandDefinition;
    parsedArgs?: ParsedArgs;
}

interface ChatCommandRegistration {
    commandDefinitions: ChatCommandDefinition;
    onExecute: (options: ChatCommandExecutionOptions) => void;
}


export class ChatCommandBuilder {
    private readonly definition: ChatCommandDefinition = {
        name: undefined,
        description: "",
        group: "",
        aliases: [],
        permissions: [],
        arguments: [],
        argumentSets: []
    };

    constructor(name: string) {
        if (!name) {
            throw new Error("Commands must have a unique name");
        }

        this.definition.name = name;
    }

    withDescription(description: string): ChatCommandBuilder {
        this.definition.description = description ?? "";
        return this;
    }

    withGroup(group: string): ChatCommandBuilder {
        this.definition.group = group ?? "";
        return this;
    }

    withAliases(aliases: string[]): ChatCommandBuilder {
        if (aliases) {
            this.definition.aliases = aliases;
        }
        return this;
    }

    withArgument(argument: Argument) {
        if (argument) {
            if (this.definition.arguments.some(a => a.name == argument.name)) {
                throw new Error(`An argument for '${argument.name}' has already been configured on command '${this.definition.name}'.`);
            }

            this.definition.arguments.push(argument);
        }
        return this;
    }

    withArgumentSet(argumentSet: ArgumentSet): ChatCommandBuilder {
        if (argumentSet) {
            if (this.definition.argumentSets.some(argSet => argSet.argumentNamesInOrder.length === argumentSet.argumentNamesInOrder.length)) {
                throw new Error(`An ArgumentSet with length ${argumentSet.argumentNamesInOrder.length} already exists on command '${this.definition.name}'.`);
            }

            this.definition.argumentSets.push(argumentSet);
        }
        return this;
    }

    withEmptyArgumentSet(setName?: string) {
        const argSet: ArgumentSet = {
            name: setName ?? "empty",
            argumentNamesInOrder: []
        };

        return this.withArgumentSet(argSet);
    }

    withCompleteArgumentSet(setName?: string) {
        const argSet: ArgumentSet = {
            name: setName ?? "complete",
            argumentNamesInOrder: this.definition.arguments.map(a => a.name)
        };

        return this.withArgumentSet(argSet);
    }

    withPermission(permission: string): ChatCommandBuilder {
        if (permission) {
            if (!this.definition.permissions.some(p => p == permission)) {
                this.definition.permissions.push(permission);
            }
        }
        return this;
    }

    withPermissions(permissions: string[]): ChatCommandBuilder {
        if (permissions) {
            this.definition.permissions = permissions;
        }
        return this;
    }

    build(): ChatCommandDefinition {
        // if the command has arguments, but no argument set has been defined,
        // then add the complete argument set so the command can handle all the 
        // expected inputs
        if (this.definition.arguments.length > 0 && this.definition.argumentSets.length == 0) {
            this.withCompleteArgumentSet();
        }

        return this.definition;
    }
}

export class ChatCommandManager {
    readonly COMMAND_PREFIX: string;
    private readonly commandRegistrations: Map<string, ChatCommandRegistration> = new Map();
    private commandInitialized = false;

    constructor(prefix?: string) {
        this.COMMAND_PREFIX = prefix ?? '.'
    }

    register(commandDefinitions: ChatCommandDefinition, onExecute: (options: ChatCommandExecutionOptions) => void) {
        const cmdRegistration = {
            commandDefinitions: commandDefinitions,
            onExecute: onExecute
        };

        Logger.debug(`Registering ${commandDefinitions.name}:\n${JSON.stringify(cmdRegistration, null, 2)}`);
        this.commandRegistrations.set(
            commandDefinitions.name.toLowerCase(),
            cmdRegistration);

        if (this.commandInitialized) return;
        this.commandInitialized = true;

        world.beforeEvents.chatSend.subscribe(eventData => {
            if (!eventData.message.startsWith(this.COMMAND_PREFIX)) return;

            // Since this is one of our commands, cancel any further downstream event handlers
            eventData.cancel = true;

            // Parse command
            const commandString = eventData.message.slice(this.COMMAND_PREFIX.length).trim();
            const commandParts = commandString
                ?.match(/[^\s"]+|"([^"]*)"/g)
                ?.map((arg) => arg.replace(/^"|"$/g, ""));

            // Find command
            const commandName = commandParts.shift();
            const commandRegistration = this.findCommandRegistration(commandName);
            if (!commandRegistration) {
                throw new Error(`Unable to find the registered command: ${commandName}.`);
            }

            // Check caller's perms against the command
            // The caller must have all command perms
            const playerTags = eventData.sender.getTags();
            if (!commandRegistration.commandDefinitions.permissions.every(p => playerTags.includes(p))) {
                throw new Error(`The caller doesn't have the required permissions for this command. Permissions: ${commandRegistration.commandDefinitions.permissions.join(',')}.`);
            }

            const options: ChatCommandExecutionOptions = {
                player: eventData.sender,
                chatCommandDefinition: commandRegistration.commandDefinitions
            }

            // Check if any argument set length matches the commandParts length
            if (commandParts.length > 0) {
                const argumentSet = commandRegistration.commandDefinitions.argumentSets.find(argSet => argSet.argumentNamesInOrder.length === commandParts.length);
                if (!argumentSet) {
                    throw new Error(`The arguments do not match any signature for this command.  Arguments: ${commandParts.join(" | ")}`);
                }

                const errors: string[] = [];
                options.parsedArgs = {
                    argumentSet: argumentSet
                };

                const typeDataErrorMessage = (value: string, index: number, typeName: string) => {
                    return `[${index}] '${argumentSet.argumentNamesInOrder[index]}' expects a ${typeName}. '${value}' is not a valid value.`;
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

                    const argument = commandRegistration.commandDefinitions.arguments.find(a => a.name == argumentSet.argumentNamesInOrder[i]);
                    options.parsedArgs[argument.name] = typeData[argument.type](argValue);
                });

                if (errors.length > 0) {
                    throw new Error(`There were errors parsing the command: ${commandString}\n  ${errors.join("\n  ")}`);
                }
            }

            Logger.debug(`${options.chatCommandDefinition.name} command received...`, options.player);
            commandRegistration.onExecute(options);
        });
    }

    getCommandDefinitions(commandName?: string): ChatCommandDefinition[] {
        let registrations: ChatCommandRegistration[] = commandName
            ? [this.findCommandRegistration(commandName)]
            : Array.from(this.commandRegistrations.values());

        return registrations.map(r => r.commandDefinitions);
    }

    private findCommandRegistration(commandName: string): ChatCommandRegistration {
        const commandNameKey = commandName.toLowerCase();

        let registration = this.commandRegistrations.get(commandNameKey);
        if (!registration) {
            registration = Array.from(this.commandRegistrations.values())
                .find(cr => cr.commandDefinitions.aliases.map(a => a.toLowerCase()).includes(commandNameKey));
        }

        return registration;
    }
}

export const ChatCommands = new ChatCommandManager();