import { world, system, Entity, Player, ScoreboardObjective, DisplaySlotId, ObjectiveSortOrder, DimensionLocation, ItemStack, ItemLockMode, EntityInventoryComponent, ItemUseBeforeEvent, EntityHitEntityAfterEvent, EntityDieAfterEvent, PlayerLeaveAfterEvent, EntityQueryOptions, MolangVariableMap, RawMessage } from "@minecraft/server";
import { MinecraftEntityTypes, MinecraftItemTypes } from "../Helpers/vanilla-data.js";
import { PlayerActor } from "../Helpers/PlayerHelpers.js"
import { Vector3Wrapper } from "../System/Vector3Wrapper.js"
import { Logger } from "../System/Logger.js"



export class ManhuntGame {
    private readonly FINDER: ItemStack;

    private readonly MANHUNT_SCOREBOARD_ID: string = "manhunt_time_score";
    private readonly manhuntTimeScoreboard: ScoreboardObjective = null;

    // TODO: replace after TagArea integration
    private spawnLocation: DimensionLocation = undefined;

    private hunted: string;

    private itemUseBeforeEventHandle: (arg: ItemUseBeforeEvent) => void;
    private playerDieAfterEventHandle: (arg: EntityDieAfterEvent) => void;
    private gameLoopHandle: number = undefined;

    constructor() {
        this.FINDER = new ItemStack(MinecraftItemTypes.BlazeRod, 1);
        this.FINDER.nameTag = "finder"

        this.manhuntTimeScoreboard = world.scoreboard.getObjective(this.MANHUNT_SCOREBOARD_ID);
        if (!this.manhuntTimeScoreboard) {
            this.manhuntTimeScoreboard = world.scoreboard.addObjective(this.MANHUNT_SCOREBOARD_ID, "Alive Time (/30s)");
        }
    }

    public getDataJson(): string {
        return JSON.stringify(
            this,
            null, //(key, value) => this.jsonReplacer(key, value, options),
            2);
    }

    start(player: Player, hunted: string) {
        this.hunted = hunted;

        this.initScoreboards(player);
        this.initPlayers(player);

        this.subscribeToEvents(player);
        this.setupBackgroundActions();
    }

    stop() {
        this.unsubscribeFromEvents();
        this.cleanupBackgroundActions();
    }

    private initScoreboards(player: Player) {
        // initialize scoreboard
        Logger.debug(`Init scoreboard: manhuntTimeScoreboard`, player);
        this.manhuntTimeScoreboard.getParticipants().forEach(participant => {
            Logger.debug(`  removing ${participant}`, player);
            this.manhuntTimeScoreboard.removeParticipant(participant);
        })

        world.scoreboard.setObjectiveAtDisplaySlot(
            DisplaySlotId.Sidebar,
            {
                objective: this.manhuntTimeScoreboard,
                sortOrder: ObjectiveSortOrder.Ascending
            });
    }

    private initPlayers(player: Player) {
        // Setup Tagger and Runner Inventories
        const players = world.getAllPlayers();

        players.forEach(p => {
            const playerActor = new PlayerActor(p);

            let finderItemIndex = -1;
            const inventory = playerActor.getInventory();
            for (let i = 0; i < inventory.inventorySize; i++) {
                const item = inventory.container.getItem(i);
                if (item !== undefined && item.nameTag === this.FINDER.nameTag) {
                    Logger.debug(`Item in slot ${i}: ${item?.amount} x ${item?.typeId} w/ name ${item?.nameTag}`);
                    finderItemIndex = i;
                    break;
                }
            }

            if (p.name !== this.hunted) {
                if (finderItemIndex < 0) {
                    playerActor.getInventory().container.addItem(this.buildFinderItemStack());
                }
            }
            else {
                this.manhuntTimeScoreboard.addScore(p, 0);
                if (finderItemIndex >= 0) {
                    inventory.container.setItem(finderItemIndex, undefined);
                }
            }
        });
    }

    private subscribeToEvents(player: Player) {
        if (this.itemUseBeforeEventHandle === undefined) {
            Logger.debug("subscribing to itemUseBefore event", player);
            this.itemUseBeforeEventHandle = world.beforeEvents.itemUse.subscribe(eventData => {
                const player = eventData.source;

                if (this.isTargetItemType(player, eventData.itemStack, this.FINDER)) {
                    eventData.cancel = true;
                    system.run(() => {
                        this.locateTargetEntity(player);
                    });
                }
            });
        }

        if (this.playerDieAfterEventHandle === undefined) {
            this.playerDieAfterEventHandle = world.afterEvents.entityDie.subscribe(eventData => {
                if (eventData.deadEntity.nameTag === this.hunted) {
                    this.cleanupBackgroundActions();
                }
            }, {
                entityTypes: [MinecraftEntityTypes.Player]
            });
        }
    }

    private unsubscribeFromEvents() {
        if (this.itemUseBeforeEventHandle !== undefined) {
            world.beforeEvents.itemUse.unsubscribe(this.itemUseBeforeEventHandle);
            this.itemUseBeforeEventHandle = undefined;
        }

        if (this.playerDieAfterEventHandle !== undefined) {
            world.afterEvents.entityDie.unsubscribe(this.playerDieAfterEventHandle);
            this.playerDieAfterEventHandle = undefined;
        }
    }

    private setupBackgroundActions() {
        if (this.gameLoopHandle === undefined) {
            this.gameLoopHandle = system.runInterval(() => {
                const huntedPlayer = world.getPlayers().find(p => p.name === this.hunted);
                if (huntedPlayer !== undefined) {
                    this.incrementScore(this.manhuntTimeScoreboard, huntedPlayer);
                }
            }, 20);
        }
    }

    private cleanupBackgroundActions() {
        if (this.gameLoopHandle !== undefined) {
            system.clearRun(this.gameLoopHandle);
            this.gameLoopHandle = undefined;
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

    private getTrackedEntityLocation(player: Player): Vector3Wrapper {
        const queryOptions: EntityQueryOptions = {
            name: this.hunted,
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