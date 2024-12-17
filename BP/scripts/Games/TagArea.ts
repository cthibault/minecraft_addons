import { Player, world, system, Vector3, Block, BlockPermutation } from "@minecraft/server"
import { MinecraftBlockTypes } from "../Helpers/vanilla-data.js";
import { Vector3Wrapper } from "../System/Vector3Wrapper.js"
import { ChatColorCodes } from "../System/ChatCodes.js"
import { Logger } from "../System/Logger.js"


export enum TagAreaStates {
    None = "NONE",
    Building = "BUILDING",
    Built = "BUILT",
    Resetting = "RESETTING"
}

enum ReplaceBlockResult {
    None = "None",
    BlockInUnloadedChunk = "BlockInUnloadedChunk",
    BlockAlreadySet = "BlockAlreadySet",
    BlockReplaced = "BlockReplaced"
}

export class TagArea {
    private static yVector = new Vector3Wrapper(0, 1, 0);
    private static maxYAttempts: number = 100
    private static backgroundProcessRetryInTicks = 20;

    // Debug
    private isDebug: boolean = false;

    //// State variables
    // The length of each edge of the area
    private sideLength: number;
    // The center of the area
    private centerLocation: Vector3Wrapper;
    // The area build state
    private state: TagAreaStates;
    // Locations that are pending action (i.e. build, remove)
    private pendingBorderLocations: Vector3Wrapper[];
    // Locations that have been been built
    private borderLocations: Vector3Wrapper[];
    // Run handle for the active background process
    private backgroundProcessHandle: number;

    constructor() {
        this.state = TagAreaStates.None;
    }

    // Exposes the current state of the tag area
    getState(): TagAreaStates {
        return this.state;
    }

    // Exposes the tag area data for debugging
    toString(): string {
        return JSON.stringify(this, this.jsonReplacer, 2);
    }

    // Exclude some of the data from the toString result
    private jsonReplacer(key: string, value) {

        switch (key) {
            // since we have large arrays, we are only returning their length and not the content
            case "borderLocations":
                return this.borderLocations.length;
            case "pendingBorderLocations":
                return this.pendingBorderLocations.length;

            default:
                return value;
        }
    }

    // Build the tag area
    build(player: Player, sideLength: number) {
        // Make sure the tag area is in a state that can be built
        if (this.state !== TagAreaStates.None) {
            player.sendMessage(`${ChatColorCodes.red}The tag area is not in a state that can be built.  Current state: ${this.state}`);
            return;
        }

        if (sideLength <= 2) {
            player.sendMessage(`${ChatColorCodes.red}The side length must be greater than 2.`);
            return;
        }

        // Initialize the state variables
        this.state = TagAreaStates.Building;
        this.centerLocation = Vector3Wrapper.createFrom(player.location);
        this.sideLength = sideLength;
        this.borderLocations = [];
        this.pendingBorderLocations = [];

        try {
            this.populatePendingBorderLocations(player, sideLength);

            // Build the tag area border in a background process
            system.run(() => {
                Logger.debug("[Background Processing Started] Build border locations", player);
                if (!this.buildTagArea(player)) {
                    this.backgroundProcessHandle = system.runInterval(() => {
                        this.buildTagArea(player);
                    }, TagArea.backgroundProcessRetryInTicks);
                }
            });
        }
        catch (error) {
            player.sendMessage(`TagArea.build failed.Type: ${typeof error}. ${ChatColorCodes.red}Error: ${error}`);
            console.error(`TagArea.build failed.Type: ${typeof error}. Error: ${error}`);
        }
    }

    // Define and Populate the Border Locations to be built within a background process
    private populatePendingBorderLocations(player: Player, sideLength: number) {
        const zeroBasedSideLength = sideLength - 1;
        const halfSideLength = Math.round(sideLength / 2);
        const startLocation = new Vector3Wrapper(
            Math.round(this.centerLocation.x - halfSideLength),
            this.centerLocation.y,
            Math.round(this.centerLocation.z - halfSideLength));

        /* Add target coordinates for the square based on the starting location
                    S---A
                    |   |
                    C---B
           This algorithm adds locations indexed off each corner.  This allows  the locations to be
           defined in a single loop based on the number of blocks to be added per side (SideLength - 1).
        */
        for (let i = 0; i < zeroBasedSideLength; i++) {
            // Location indexed on S
            this.addToArray(this.pendingBorderLocations, new Vector3Wrapper(startLocation.x, startLocation.y, startLocation.z + i));
            // Location indexed on A
            this.addToArray(this.pendingBorderLocations, new Vector3Wrapper(startLocation.x + i, startLocation.y, startLocation.z + zeroBasedSideLength));
            // Location indexed on B
            this.addToArray(this.pendingBorderLocations, new Vector3Wrapper(startLocation.x + zeroBasedSideLength, startLocation.y, startLocation.z + zeroBasedSideLength - i));
            // Location indexed on C
            this.addToArray(this.pendingBorderLocations, new Vector3Wrapper(startLocation.x + zeroBasedSideLength - i, startLocation.y, startLocation.z));
        }
    }

    // This builds the border on a background thread by processing the locations in the pending boarder locations list.  
    // As it completes a location, it should be removed from the pending list.  Once the list is complete, the background 
    // process should be stopped and the TagArea state updated
    private buildTagArea(player: Player): boolean {
        if (this.pendingBorderLocations.length > 0) {
            let idx = this.pendingBorderLocations.length;
            while (idx--) {
                if (this.tryReplaceBlock(player, this.pendingBorderLocations[idx], MinecraftBlockTypes.BorderBlock, [MinecraftBlockTypes.Air], `[${idx}]  `)) {
                    this.pendingBorderLocations.splice(idx, 1);
                }
            }
        }

        // All locations have been processed
        if (this.pendingBorderLocations.length == 0) {
            this.state = TagAreaStates.Built;

            if (this.backgroundProcessHandle !== undefined) {
                system.clearRun(this.backgroundProcessHandle);
                this.backgroundProcessHandle = undefined;
            }

            player.sendMessage(`${ChatColorCodes.green}[Background Processing Complete] TagArea.State: ${this.state}.`);
            return true;
        }

        player.sendMessage(`[Background Processing InProgress] TagArea.State: ${this.state}. PendingItemCount: ${this.pendingBorderLocations.length}.`);
        return false;
    }

    // Reset the tag area
    reset(player: Player) {
        if (this.state === TagAreaStates.None) {
            player.sendMessage(`${ChatColorCodes.red}The tag area is not in a state that can be reset. Current state: ${this.state}.`);
            return;
        }

        try {
            // if the build job is still active, cancel it since we are done building
            if (this.backgroundProcessHandle !== undefined) {
                system.clearRun(this.backgroundProcessHandle);
                this.backgroundProcessHandle = undefined;
            }

            // Update the areas as Resetting and remove pending border locations 
            // since we don't want to process them anymore
            this.state = TagAreaStates.Resetting;
            this.pendingBorderLocations.length = 0;

            // Remove the tag area border and reset the tag area in a background process
            system.run(() => {
                Logger.debug("[Background Processing Started] Remove border location.", player);

                if (!this.resetTagArea(player)) {
                    this.backgroundProcessHandle = system.runInterval(() => {
                        this.resetTagArea(player);
                    }, TagArea.backgroundProcessRetryInTicks);
                }
            });
        } catch (error) {
            player.sendMessage(`TagArea.reset failed.  ${ChatColorCodes.red}Error: ${error}`);
            console.error(`TagArea.reset failed. Error: ${error}`);
        }
    }

    // This removes the borders on a background thread by processing the locations in the boarder locations list.  
    // As it completes a location, it should be removed from the list.  Once the list is complete, the background 
    // process should be stopped and the TagArea state reset
    private resetTagArea(player: Player): boolean {
        let idx = this.borderLocations.length;
        while (idx--) {
            const result = this.tryReplaceBlockUniversal(player, this.borderLocations[idx], MinecraftBlockTypes.Air, [MinecraftBlockTypes.BorderBlock], null, null, `[${idx}]  `);

            if (result === ReplaceBlockResult.BlockAlreadySet || result === ReplaceBlockResult.BlockReplaced) {
                this.borderLocations.splice(idx, 1);
            }
        }

        if (this.borderLocations.length == 0) {
            // Reset the Tag Area state fields
            this.borderLocations.length = 0;
            this.pendingBorderLocations.length = 0;
            this.centerLocation = undefined;
            this.sideLength = undefined;
            this.state = TagAreaStates.None;

            if (this.backgroundProcessHandle !== undefined) {
                system.clearRun(this.backgroundProcessHandle);
                this.backgroundProcessHandle = undefined;
            }

            player.sendMessage(`${ChatColorCodes.green}[Background Processing Complete] TagArea.State: ${this.state}.`);
            return true;
        }

        player.sendMessage(`[Background Processing InProgress] TagArea.State: ${this.state}. PendingItemCount: ${this.borderLocations.length}.`);
        return false;
    }

    // Attempts to replace a block at a given location.  It accepts both the block type to replace with as well
    // as well the type of blocks that can be replaced.
    tryReplaceBlock(player: Player, location: Vector3Wrapper, toBlockTypeId: string, fromBlockTypeIds: string[], debugMessagePrefix: string = ""): boolean {
        // Find the top block for Location.X, Location.Z
        const xzLocation = { x: location.x, z: location.z };
        Logger.debug(`${debugMessagePrefix}TryReplaceBlock at ${JSON.stringify(xzLocation)}`, player);

        const topBlock = player.dimension.getTopmostBlock(xzLocation);
        if (topBlock === undefined) {
            this.addToArray(this.pendingBorderLocations, location);
            return false;
        }

        let result: ReplaceBlockResult = ReplaceBlockResult.None;
        let blockLocation: Vector3Wrapper = undefined;

        // Find the next block on the y-axis that matches a block we want to keep or can replace
        // Process as long as we have found an end-loop result 
        //  - AlreadySet, Replaced, InUnloadedChunk
        for (let y = 0; y <= TagArea.maxYAttempts && result === ReplaceBlockResult.None; y++) {
            blockLocation = Vector3Wrapper.createFrom(topBlock.location).add(TagArea.yVector.multiply(y));

            result = this.tryReplaceBlockUniversal(
                player,
                blockLocation,
                toBlockTypeId,
                fromBlockTypeIds,
                () => this.addToArray(this.pendingBorderLocations, location),
                () => this.borderLocations.push(blockLocation),
                `${debugMessagePrefix}  `);
        }

        return result === ReplaceBlockResult.BlockAlreadySet || result === ReplaceBlockResult.BlockReplaced;
    }

    // Attempts to replace a block at a given location.  It accepts both the block type to replace with as well
    // as well the type of blocks that can be replaced.  The return provides a result that can be used by the
    // caller to deterine if addtional actions are required.
    // The callbacks provided also allow the caller to provide additional actions when the block appears to be
    // outside the loaded chunks or the block was successfully replaced.
    tryReplaceBlockUniversal(
        player: Player,
        location: Vector3Wrapper,
        toBlockTypeId: string,
        fromBlockTypeIds: string[],
        unloadedChunkFailureCallback: () => void,
        blockReplacementSuccessCallback: () => void,
        debugMessagePrefix: string = ""): ReplaceBlockResult {

        let result: ReplaceBlockResult = ReplaceBlockResult.None;
        Logger.debug(`${debugMessagePrefix}TryGet block at ${location}`, player);
        const block = player.dimension.getBlock(location);

        // We weren't able to get the block.  This usually means block is in an unloaded chunk.
        // We are going to capture the coordinates to be populated later when the chunk is loaded.
        if (block === undefined) {
            unloadedChunkFailureCallback?.();
            result = ReplaceBlockResult.BlockInUnloadedChunk;
        }
        else {
            Logger.debug(`${debugMessagePrefix}  Block has typeId: ${block.typeId}`, player);

            if (block.typeId === toBlockTypeId) {
                Logger.debug(`${debugMessagePrefix}  ${ChatColorCodes.blue}Block permutation is already ${toBlockTypeId}`, player);
                result = ReplaceBlockResult.BlockAlreadySet;
            }
            else if (fromBlockTypeIds.includes(block.typeId)) {
                Logger.debug(`${debugMessagePrefix}  ${ChatColorCodes.blue}Setting block permutation to ${toBlockTypeId}`, player);
                block.setPermutation(BlockPermutation.resolve(toBlockTypeId));
                result = ReplaceBlockResult.BlockReplaced;
            }

            if (result !== ReplaceBlockResult.None) {
                blockReplacementSuccessCallback?.();
            }
        }

        Logger.debug(`${debugMessagePrefix}  ReplaceResult: ${result}`, player);
        return result;
    }

    private addToArray(array: Vector3Wrapper[], location: Vector3Wrapper) {
        const alreadyExists = array.some(l =>
            l.x === location.x &&
            l.y === location.y &&
            l.z === location.z);
        if (!alreadyExists) {
            array.push(location);
        }
    }
}