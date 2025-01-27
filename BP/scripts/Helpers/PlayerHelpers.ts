import { Player, EntityInventoryComponent } from "@minecraft/server";

export class PlayerActor {
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