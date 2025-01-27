import { Player, world, system, EntityComponentTypes, ItemStack, DisplaySlotId } from "@minecraft/server";
import { ChatCommandExecutionOptions, ChatCommandBuilder, ChatCommands } from './ChatCommands.js'
import { MinecraftEntityTypes, MinecraftItemTypes } from "../Helpers/vanilla-data.js";

ChatCommands.register(
    new ChatCommandBuilder('TestCommand')
        .withDescription('sample test command')
        .withAliases(['tc'])
        .withGroup("test")
        .withArgument({ name: "age", type: "number", defaultValue: 10, description: "some age value" })
        .build(),
    (options: ChatCommandExecutionOptions) => {
        system.run(() => {
            world.scoreboard.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
        });
        // const c1 = options.player.getComponent(EntityComponentTypes.Health);
        // options.player.sendMessage(`My health is: ${c1.currentValue}`);

        // const components = options.player.getComponents();
        // options.player.sendMessage("Components:");
        // components.forEach(c => options.player.sendMessage(`  ${c.typeId}`));
        // options.player.sendMessage("DynamicProperties:");
        // options.player.getDynamicPropertyIds().forEach(p => options.player.sendMessage(`  ${p}`));

        // system.run(() => {
        //     const beef = new ItemStack(MinecraftItemTypes.CookedBeef, 1);


        //     options.player.eatItem(beef);
        // });
    });