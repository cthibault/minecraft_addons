import { world, system, Player } from "@minecraft/server";
import { MinecraftBlockTypes } from "./Helpers/vanilla-data.js";
import { Vector3Wrapper } from "./System/Vector3Wrapper.js"
import "./Commands/CommandIndex.js"
import "./Games/CactusWater.js"

function mainTick() {
    if (system.currentTick % 100 === 0) {
        //world.getAllPlayers().forEach(printPlayer);
        //world.sendMessage("[Current Tick: " + system.currentTick + "]");
    }

    system.run(mainTick);
}

system.run(mainTick);


function printPlayer(player: Player) {
    // let playerData: PlayerData;

    // if (PlayerDataMap.has(player.name)) {
    //     playerData = PlayerDataMap.get(player.name);
    // }
    // else {
    //     playerData = new PlayerData();
    //     PlayerDataMap.set(player.name, playerData);
    // }

    // // playerData.displayCurrentTick = !playerData.displayCurrentTick;
    // // player.sendMessage(`Player: ${player.name}. DisplayCurrentTick: ${playerData.displayCurrentTick}.`);
    // player.getProperty()

    // player.sendMessage(`Player Components:`);
    // player.getComponents().forEach(c => {
    //     player.sendMessage(`  ${c.typeId}`);
    // });

    // player.onScreenDisplay.setTitle("Chapter 1", {
    //     stayDuration: 100,
    //     fadeInDuration: 2,
    //     fadeOutDuration: 4,
    //     subtitle: "Trouble in Block Town",
    // });
}


