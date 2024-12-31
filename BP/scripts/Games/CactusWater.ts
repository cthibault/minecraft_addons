import { world, system, Player } from "@minecraft/server";
import { MinecraftBlockTypes } from "../Helpers/vanilla-data.js";
import { Vector3Wrapper } from "../System/Vector3Wrapper.js"

// 3 seconds in ticks
const timeoutInTicks = 3 * 20;

world.afterEvents.playerBreakBlock.subscribe(eventData => {
    const location = eventData.block.location;
    eventData.dimension.setBlockType(location, MinecraftBlockTypes.Water);

    const handle = system.runTimeout(() => {
        eventData.player.sendMessage(`TryRemove water at ${Vector3Wrapper.createFrom(location)}. Cleanup job: ${handle}`);

        const block = eventData.dimension.getBlock(location);
        if (block !== undefined && block.typeId === MinecraftBlockTypes.Water) {
            eventData.player.sendMessage(`Removed water at ${Vector3Wrapper.createFrom(location)}. Cleanup job: ${handle}`);
            eventData.dimension.setBlockType(location, MinecraftBlockTypes.Air);
        }
    }, timeoutInTicks);

    eventData.player.sendMessage(`Added water at ${Vector3Wrapper.createFrom(location)}. Cleanup job: ${handle}`);
}, {
    blockTypes: ["minecraft:cactus"]
});