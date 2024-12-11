import { Player, world, system } from "@minecraft/server";
import ChatCommand from './CommandDefinition.js'
import { TagArea } from "../Games/TagArea.js"

let tagArea: TagArea = undefined;

ChatCommand.create('BuildBorder', 'Build the boarder', ['bb'], { 'sideLength': 'number' }, false, (player, args) => {
    player.sendMessage(`Build boarder command received...`);
    system.run(() => {
        if (tagArea === undefined) {
            player.sendMessage(`  New tag area...`);
            tagArea = new TagArea();
        }

        player.sendMessage(`Building a border with a side length of ${args['sideLength']}.`);
        tagArea.build(player, args['sideLength']);
    });
});

ChatCommand.create('ResetBorder', 'Reset the boarder', ['rb'], undefined, false, (player, args) => {
    player.sendMessage(`Reset boarder command received...`);
    system.run(() => {
        tagArea.reset(player);
    });
});

ChatCommand.create('GetTagArea', 'Get tag area data', ['gta'], undefined, false, (player, args) => {
    player.sendMessage(`Get Tag Area data command received...`);
    system.run(() => {
        if (tagArea != undefined) {
            player.sendMessage(`${tagArea} `);
        } else {
            player.sendMessage(`The tag area is undefined.`);
        }
    });
});
