
import { world, system, Entity, Player, ScoreboardObjective, DisplaySlotId, ObjectiveSortOrder, DimensionLocation, ItemStack, ItemLockMode, EntityInventoryComponent, ItemUseBeforeEvent, EntityHitEntityAfterEvent, PlayerLeaveAfterEvent, EntityQueryOptions, MolangVariableMap, RawMessage } from "@minecraft/server";
import { MinecraftEntityTypes, MinecraftItemTypes } from "../Helpers/vanilla-data.js";
import { TagArea } from "./TagArea";
import { Vector3Wrapper } from "../System/Vector3Wrapper.js"
import { Logger } from "../System/Logger.js"
import { MathUtils } from "../System/MathUtils.js"

class PlayerActor {
    player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    getName(): string {
        return this.player.name;
    }

    hasTag(name: string): boolean {
        return this.player.hasTag(name);
    }

    getTags(): string[] {
        return this.player.getTags();
    }

    addTag(name: string): boolean {
        return this.player.addTag(name);
    }

    getInventory(): EntityInventoryComponent {
        return this.player.getComponent("inventory");
    }

    setActionBarText(text: string) {
        if (text === undefined) return;
        this.player.onScreenDisplay.setActionBar(text)
    }
}

enum TagGameModes {
    Standard = "STANDARD",
    Infection = "INFECTION",
    Freeze = "FREEZE"
}

export enum TagGameStates {
    New = "NEW",
    Active = "ACTIVE",
    Stopped = "STOPPED"
}

class TagGameRules {
    becomeTaggerOnDeath: boolean = false;
    taggerSpeedBuffIntervalInSeconds: number = 0;
    teleportOnTag: boolean = true;
}

class PlayerData {
    playerName: string;
    playerActor: PlayerActor;
    isTagger: boolean = false;
    inventoryConfigured: boolean = false;
    targetPlayerName: string = undefined;
    taggerCount: number = 0;
    tagTimeInSeconds: number = 0;

    //TODO: how to get duration of them being a tagger?
    taggerStartTime: number = 0;

    constructor(playerName: string) {
        this.playerName = playerName;
    }

    setPlayerActor(playerActor: PlayerActor): PlayerData {
        this.playerActor = playerActor;
        return this;
    }
}

export interface TagGameJsonDataOptions {
    includePlayerData: boolean;
    includeTagArea: boolean;
}

export interface TagGameInitOptions {
    clearPlayerInventories: boolean;
    defaultTaggerName: string;
    tagAreaSideLength: number,
    defaultInventoryItems: InventoryItem[];
}

interface InventoryItem {
    amount: number,
    typeId: string
}

export class TagGame {
    private readonly FINDER: ItemStack;
    private readonly TAGTIME_SCOREBOARD_ID: string = "tagtime_score";
    private readonly TAGCOUNT_SCOREBOARD_ID: string = "tagcount_score";

    private readonly tagTimeScoreboard: ScoreboardObjective = null;
    private readonly tagCountScoreboard: ScoreboardObjective = null;

    // TODO: replace after TagArea integration
    private spawnLocation: DimensionLocation = undefined;
    // TODO

    private tagArea: TagArea;
    private mode: TagGameModes;
    private rules: TagGameRules;
    private state: TagGameStates;
    private initOptions: TagGameInitOptions = undefined;

    private taggers: string[];
    private runners: string[];

    private playerData: Map<string, PlayerData>;

    private itemUseBeforeEventHandle: (arg: ItemUseBeforeEvent) => void;
    private entityHitEntityEventHandle: (arg: EntityHitEntityAfterEvent) => void;
    private playerLeaveAfterEventHandle: (arg: PlayerLeaveAfterEvent) => void;
    private taggerGameLoopHandle: number = undefined;

    constructor() {
        this.tagArea = new TagArea();
        this.mode = TagGameModes.Standard;
        this.rules = new TagGameRules();
        this.state = TagGameStates.New;

        this.taggers = [];
        this.runners = [];

        // Initialize the player data
        this.playerData = new Map();

        this.FINDER = new ItemStack(MinecraftItemTypes.BlazeRod, 1);
        this.FINDER.nameTag = "finder"

        this.tagTimeScoreboard = world.scoreboard.getObjective(this.TAGTIME_SCOREBOARD_ID);
        if (!this.tagTimeScoreboard) {
            this.tagTimeScoreboard = world.scoreboard.addObjective(this.TAGTIME_SCOREBOARD_ID, "Tag Time (/30s)");
        }

        this.tagCountScoreboard = world.scoreboard.getObjective(this.TAGCOUNT_SCOREBOARD_ID);
        if (!this.tagCountScoreboard) {
            this.tagCountScoreboard = world.scoreboard.addObjective(this.TAGCOUNT_SCOREBOARD_ID, "Tag Count");
        }
    }

    public get gameState(): TagGameStates {
        return this.state;
    }

    public get gameTagArea(): TagArea {
        return this.tagArea;
    }

    public getDataJson(options?: TagGameJsonDataOptions): string {
        return JSON.stringify(
            this,
            (key, value) => this.jsonReplacer(key, value, options),
            2);
    }

    // Exclude some of the data from the toString result
    private jsonReplacer(key: string, value, options?: TagGameJsonDataOptions) {
        switch (key) {
            case "playerData":
                if (!options?.includePlayerData) {
                    return undefined;
                }
                const obj = []
                this.playerData.forEach((value, key) => {
                    obj.push({ key, value });
                });
                return obj;

            case "tagArea":
                if (!options?.includeTagArea) {
                    return undefined;
                }
                return value;

            case "itemUseBeforeEventHandle":
            case "entityHitEntityEventHandle":
            case "playerLeaveAfterEventHandle":
                const result = value !== undefined
                    ? "REGISTERED"
                    : "UNREGISTERED";
                return result;

            default:
                return value;
        }
    }

    start(player: Player, initOptions?: TagGameInitOptions) {
        if (initOptions !== undefined) {
            this.initOptions = initOptions
        }

        if (this.initOptions === undefined) {
            this.initOptions = {
                clearPlayerInventories: true,
                defaultTaggerName: "nulkref", //TODO: undefined,
                tagAreaSideLength: 100,
                defaultInventoryItems: []
            };

            var playerActor = new PlayerActor(player);
            var inventory = playerActor.getInventory();
            for (let i = 0; i < inventory.inventorySize; i++) {
                const itemStack = inventory.container.getItem(i);
                if (itemStack !== undefined && itemStack.nameTag !== this.FINDER.nameTag) {
                    this.initOptions.defaultInventoryItems.push({
                        amount: itemStack.amount,
                        typeId: itemStack.typeId
                    });
                }
            }
        }

        this.spawnLocation = {
            dimension: player.dimension,
            x: player.location.x,
            y: player.location.y,
            z: player.location.z
        };

        this.initScoreboards(player);
        this.initPlayers(player);
        this.subscribeToEvents(player);
        this.setupBackgroundActions();

        this.state = TagGameStates.Active;
    }

    stop() {
        this.state = TagGameStates.Stopped;

        this.unsubscribeFromEvents();
        this.cleanupBackgroundActions();
    }

    private initScoreboards(player: Player) {
        // initialize Tag Count scoreboard
        Logger.debug(`Init scoreboard: tagCountScoreboard`, player);
        this.tagCountScoreboard.getParticipants().forEach(participant => {
            Logger.debug(`  removing ${participant}`, player);
            this.tagCountScoreboard.removeParticipant(participant);
        });

        world.scoreboard.setObjectiveAtDisplaySlot(
            DisplaySlotId.List,
            {
                objective: this.tagCountScoreboard,
                sortOrder: ObjectiveSortOrder.Ascending
            });

        // initialize Tag Time scoreboard
        Logger.debug(`Init scoreboard: tagTimeScoreboard`, player);
        this.tagTimeScoreboard.getParticipants().forEach(participant => {
            Logger.debug(`  removing ${participant}`, player);
            this.tagTimeScoreboard.removeParticipant(participant);
        })

        world.scoreboard.setObjectiveAtDisplaySlot(
            DisplaySlotId.Sidebar,
            {
                objective: this.tagTimeScoreboard,
                sortOrder: ObjectiveSortOrder.Ascending
            });
    }

    private initPlayers(player: Player) {
        // Make sure we're tracking all the players
        world.getAllPlayers().forEach(player => {
            // If we weren't already tracking this player, then add them to the player data and runners list
            if (!this.playerData.has(player.name)) {
                this.playerData.set(player.name, new PlayerData(player.name).setPlayerActor(new PlayerActor(player)));
                this.runners.push(player.name);
            }
        });

        // Random assign a tagger if one isn't already configured
        Logger.debug(`Tagger length: ${this.taggers.length}. PlayerData size: ${this.playerData.size}`, player);
        if (this.taggers.length == 0 && this.playerData.size > 0) {
            let playerData: PlayerData = undefined;

            // Use the default tagger name if one is provided
            if (this.initOptions.defaultTaggerName !== undefined) {
                playerData = this.playerData.get(this.initOptions.defaultTaggerName);
                Logger.debug(`  DefaultTaggerName: ${this.initOptions.defaultTaggerName}.`, player);
            }

            // If we still don't have a playerData object, then get a random one
            if (playerData === undefined) {
                const taggerIdx = MathUtils.getRandomNumber(0, this.playerData.size - 1);
                playerData = Array.from(this.playerData.values())[taggerIdx];
                Logger.debug(`  Min:0, Max:${this.playerData.size - 1}, RandomTaggerIdx:${taggerIdx}.`, player);
            }

            if (playerData !== undefined) {
                Logger.debug(`  PlayerData: ${JSON.stringify(playerData)}`, player);

                playerData.isTagger = true;
                this.taggers.push(playerData.playerName);
                this.runners = this.runners.filter(r => r !== playerData.playerName);
            }
            else {
                Logger.error("Failed to configure a tagger");
                console.error("Failed to configure a tagger");
            }
        }

        // Setup Tagger and Runner Inventories
        this.playerData.forEach(playerData => {
            if (!playerData.inventoryConfigured) {
                if (this.initOptions.clearPlayerInventories) {
                    playerData.playerActor.getInventory().container.clearAll();
                }

                const inventory = playerData.playerActor.getInventory();
                if (this.initOptions.defaultInventoryItems !== undefined) {
                    this.initOptions.defaultInventoryItems.forEach(item => {
                        inventory.container.addItem(new ItemStack(item.typeId, item.amount));
                    })
                }

                // Tagger inventory
                if (playerData.isTagger) {
                    inventory.container.addItem(this.buildFinderItemStack());
                }

                playerData.inventoryConfigured = true;
            }

            this.tagCountScoreboard.addScore(playerData.playerActor.player, 0);
            this.tagTimeScoreboard.addScore(playerData.playerActor.player, 0);
            playerData.playerActor.player.setSpawnPoint(this.spawnLocation);
        });

        //TODO: For debugging, needs to be removed
        if (Logger.IN_DEBUG_MODE) {
            for (const debugEntity of player.dimension.getEntities({
                tags: ["debugEntity"],
                type: MinecraftEntityTypes.Horse
            })) {
                if (!this.playerData.has(debugEntity.nameTag)) {
                    player.sendMessage(`Found debug entity: ${debugEntity.nameTag}`);
                    const pd = new PlayerData(debugEntity.nameTag);
                    pd.inventoryConfigured = true;

                    this.playerData.set(debugEntity.nameTag, pd);
                    this.runners.push(debugEntity.nameTag);
                }
            }
        }
        // DEBUG
    }

    private subscribeToEvents(player: Player) {
        if (this.itemUseBeforeEventHandle === undefined) {
            Logger.debug("subscribing to itemUseBefore event", player);
            this.itemUseBeforeEventHandle = world.beforeEvents.itemUse.subscribe(eventData => {
                const player = eventData.source;

                if (this.isTargetItemType(player, eventData.itemStack, this.FINDER)) {
                    eventData.cancel = true;
                    system.run(() => {
                        if (player.isSneaking) {
                            this.setNextTargetPlayer(player);
                        }
                        else {
                            this.locateTargetEntity(player);
                        }
                    });
                }
            });
        }

        if (this.entityHitEntityEventHandle === undefined) {
            Logger.debug("subscribing to entityHitEntity event", player);
            this.entityHitEntityEventHandle = world.afterEvents.entityHitEntity.subscribe(eventData => {
                Logger.debug("Tagger needs to change!")
                Logger.debug(`## EntityHitEntity event: \n   HEntity: (${eventData.hitEntity.typeId}, ${eventData.hitEntity.nameTag}) \n   DEntity: (${eventData.damagingEntity.typeId}, ${eventData.damagingEntity.nameTag})`);

                // was the damaging entity a tagger and the hit entity a runner?
                const taggingPlayerData = this.playerData.get(eventData.damagingEntity.nameTag);
                const taggedPlayerData = this.playerData.get(eventData.hitEntity.nameTag);

                if (taggingPlayerData.isTagger && !taggedPlayerData.isTagger) {
                    try {
                        // you caught 'em!
                        // - update player data object
                        // - remove the finder item from inventory
                        taggingPlayerData.isTagger = false;
                        taggingPlayerData.targetPlayerName = undefined;
                        const inventoryA = taggingPlayerData.playerActor.getInventory();
                        for (let i = 0; i < inventoryA.inventorySize; i++) {
                            const item = inventoryA.container.getItem(i);
                            if (item !== undefined && item.nameTag === this.FINDER.nameTag) {
                                Logger.debug(`Item in slot ${i}: ${item?.amount} x ${item?.typeId} w/ name ${item?.nameTag}`);
                                inventoryA.container.setItem(i, undefined);
                            }
                        }

                        // you've been caught
                        // - update player data object
                        // - remove the finder item from inventory
                        // - TP them to the center of the tag area
                        taggedPlayerData.isTagger = true;
                        taggedPlayerData.taggerCount++;
                        this.incrementScore(this.tagCountScoreboard, taggedPlayerData.playerActor.player);
                        const inventoryB = taggedPlayerData.playerActor.getInventory();
                        inventoryB.container.addItem(this.buildFinderItemStack());

                        // Update Tagger and Runner lists
                        const runnerIdx = this.runners.indexOf(taggedPlayerData.playerName);
                        if (runnerIdx >= 0) {
                            this.runners[runnerIdx] = taggingPlayerData.playerName;
                        }

                        const taggerIdx = this.taggers.indexOf(taggingPlayerData.playerName);
                        if (taggerIdx >= 0) {
                            this.taggers[taggerIdx] = taggedPlayerData.playerName;
                        }

                        Logger.debug(`Tagger changed to ${taggedPlayerData.playerName}`);

                        taggedPlayerData.playerActor.player.teleport({
                            x: this.spawnLocation.x,
                            y: this.spawnLocation.y,
                            z: this.spawnLocation.z
                        });
                    }
                    catch (error) {
                        Logger.error(`entityHitEntity error: ${typeof error}. Error: ${error}`);
                        console.error(`TagArea.build failed.Type: ${typeof error}. Error: ${error}`);
                    }
                }
            }, {
                entityTypes: [MinecraftEntityTypes.Player]
            });
        }

        if (this.playerLeaveAfterEventHandle === undefined) {
            Logger.debug("subscribing to playerLeaveAfter event", player);
            this.playerLeaveAfterEventHandle = world.afterEvents.playerLeave.subscribe(eventData => {
                const playerName = eventData.playerName;
                // If the player is leaving then we need to remove their information from the game data
                // so we don't have null lookups
                this.playerData.delete(playerName);

                this.playerData.forEach(pd => {
                    if (pd.targetPlayerName === playerName) {
                        pd.targetPlayerName = undefined;
                    }
                })

                const runnerIdx = this.runners.findIndex(r => r === playerName);
                if (runnerIdx >= 0) {
                    this.runners.splice(runnerIdx, 1);
                }

                const taggerIdx = this.taggers.findIndex(r => r === playerName);
                if (runnerIdx >= 0) {
                    this.taggers.splice(taggerIdx, 1);
                }
            });
        }
    }

    private unsubscribeFromEvents() {
        if (this.itemUseBeforeEventHandle !== undefined) {
            world.beforeEvents.itemUse.unsubscribe(this.itemUseBeforeEventHandle);
            this.itemUseBeforeEventHandle = undefined;
        }

        if (this.entityHitEntityEventHandle !== undefined) {
            world.afterEvents.entityHitEntity.unsubscribe(this.entityHitEntityEventHandle);
            this.entityHitEntityEventHandle = undefined;
        }

        if (this.playerLeaveAfterEventHandle !== undefined) {
            world.afterEvents.playerLeave.unsubscribe(this.playerLeaveAfterEventHandle);
            this.playerLeaveAfterEventHandle = undefined;
        }
    }

    private setupBackgroundActions() {
        if (this.taggerGameLoopHandle === undefined) {
            this.taggerGameLoopHandle = system.runInterval(() => {
                this.taggers.forEach(name => {
                    const playerData = this.playerData.get(name);
                    playerData.tagTimeInSeconds++;

                    // Action Bar label
                    const trackingText = playerData?.targetPlayerName ?? "<no one>";
                    const tagTimeText = `${Math.floor(playerData.tagTimeInSeconds / 60)}:${(playerData.tagTimeInSeconds % 60).toString().padStart(2, "0")}`

                    playerData.playerActor.player.onScreenDisplay.setActionBar(`Tracking: ${trackingText}\nTag Time: ${tagTimeText} [${playerData.tagTimeInSeconds}]`);

                    // Scoreboard
                    // Increment score every 30 seconds
                    if (playerData.tagTimeInSeconds > 0 && playerData.tagTimeInSeconds % 30 === 0) {
                        this.incrementScore(this.tagTimeScoreboard, playerData.playerActor.player);
                    }
                });
            }, 20);
        }
    }

    private incrementScore(scoreboard: ScoreboardObjective, player: Player) {
        if (!scoreboard) return;

        try {
            const currentScore = scoreboard.getScore(player);
            scoreboard.setScore(player, currentScore + 1);
        }
        catch (error) {
            Logger.error(`entityHitEntity error: ${typeof error}. Error: ${error}`);
            console.error(`TagArea.build failed.Type: ${typeof error}. Error: ${error}`);
        }
    }

    private cleanupBackgroundActions() {
        if (this.taggerGameLoopHandle !== undefined) {
            system.clearRun(this.taggerGameLoopHandle);
            this.taggerGameLoopHandle = undefined;
        }
    }

    private buildFinderItemStack(): ItemStack {
        const finder = new ItemStack(MinecraftItemTypes.BlazeRod, 1);
        finder.nameTag = this.FINDER.nameTag;
        finder.keepOnDeath = true;
        finder.lockMode = ItemLockMode.inventory;
        return finder;
    }

    private isTargetItemType(player: Player, itemStack: ItemStack, targetItemStack: ItemStack): boolean {
        if (player.hasTag("debugUser")) {
            Logger.debug(`${player.name} interacted with ${itemStack.typeId}`, player);
        }

        const retVal = itemStack.typeId === targetItemStack.typeId && itemStack.nameTag === targetItemStack.nameTag;
        return retVal;
    }

    private getSortedPlayerNames(playerNames?: string[]): string[] {
        if (playerNames === undefined) {
            playerNames = Array.from(this.playerData.keys());
        }

        const sortedNames = playerNames.sort((k1, k2) => {
            if (k1 > k2) return 1;
            if (k1 < k2) return -1;
            return 0;
        });
        return sortedNames;
    }

    private setNextTargetPlayer(player: Player) {
        const playerData = this.playerData.get(player.name);

        let availablePlayerNames = this.getSortedPlayerNames(this.runners);
        if (availablePlayerNames !== undefined && availablePlayerNames.length > 0) {
            for (let i = 0; i < availablePlayerNames.length; i++) {
                // if the current target is undefined, used the current item
                if (playerData.targetPlayerName === undefined) {
                    playerData.targetPlayerName = availablePlayerNames[0];
                    break;
                }

                // if we found the current target:
                //   a) and the item is the last item in the list, then select the first item
                //   b) otherwise select the next item
                if (playerData.targetPlayerName === availablePlayerNames[i]) {
                    playerData.targetPlayerName = (i < availablePlayerNames.length - 1)
                        ? availablePlayerNames[i + 1]
                        : availablePlayerNames[0];
                    break;
                }
            };

            Logger.debug(`${playerData.targetPlayerName}. playerNames = ${availablePlayerNames.join(",")}`, player);
        }
        else {
            Logger.error(`No runners to target. Runners: ${this.runners.join(",")}`);
        }
    }

    private getTrackedEntityLocation(player: Player): Vector3Wrapper {
        const playerData = this.playerData.get(player.name);
        if (playerData === undefined) {
            console.error(`No player data found for ${player.name}.`);
            throw `No player data found for ${player.name}.`;
        }

        if (playerData.targetPlayerName === undefined) {
            this.setNextTargetPlayer(player);
        }

        const queryOptions: EntityQueryOptions = {
            name: playerData.targetPlayerName,
        };

        Logger.debug(JSON.stringify(queryOptions), player);
        let targetEntities = player.dimension.getEntities(queryOptions);
        Logger.debug(`Target Entities: ${JSON.stringify(targetEntities)}`, player);
        if (targetEntities === undefined || targetEntities.length < 1) {
            console.error(`Failed to find target entity.  Query: ${JSON.stringify(queryOptions)}.`);
            throw `Failed to find target entity.  Query: ${JSON.stringify(queryOptions)}.`;
        }

        const targetEntity = targetEntities.shift();
        Logger.debug(`Target Player Name Tag: ${targetEntity.nameTag}.`, player)

        return Vector3Wrapper.createFrom(targetEntity.location);
    }

    private locateTargetEntity(player: Player) {
        const origin = Vector3Wrapper.createFrom(player.location);
        const trackedEntityLocation = this.getTrackedEntityLocation(player);

        const direction = trackedEntityLocation.subtract(origin);
        const directionNormalized = direction.normalize();
        let particleVector = origin.add(directionNormalized);
        particleVector.y = origin.y + 2;

        Logger.debug(`${origin} = O \n${trackedEntityLocation} = T \n${direction} = D\n${directionNormalized} = DN\n${particleVector} = PV`, player);
        player.sendMessage(`y-location: ${trackedEntityLocation.y}`);

        for (let i = 0; i < 100; i++) {
            const mvMap = new MolangVariableMap();
            mvMap.setColorRGB("variable.color", { red: Math.random(), green: Math.random(), blue: Math.random() });
            player.spawnParticle('minecraft:basic_flame_particle', particleVector, mvMap);
        }
    }
}