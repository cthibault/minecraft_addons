import { world, system, Player } from "@minecraft/server";
import { ChatColorCodes } from "./ChatCodes.js"

export class Logger {
    public static IN_DEBUG_MODE: boolean = true;

    static debug(message: string, player?: Player) {
        if (Logger.IN_DEBUG_MODE) {
            const msg = `${ChatColorCodes.gray}[${system.currentTick}]${message}`;
            Logger.print(msg, player);
        }
    }

    static error(message: string, player?: Player) {
        const msg = `${ChatColorCodes.red}[${system.currentTick}]${message}`;
        Logger.print(msg, player);
    }

    private static print(message: string, player?: Player) {
        if (player !== undefined) {
            player.sendMessage(message);
        } else {
            world.sendMessage(message);
        }
    }
}