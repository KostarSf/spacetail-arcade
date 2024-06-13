import { Engine } from "excalibur";
import { Player } from "./player";
import { loader } from "./resources";
import { ShipSystem } from "./ecs/ship/ship-ecs";

class Game extends Engine {
    constructor() {
        super({ width: 800, height: 600 });
    }
    initialize() {
        this.currentScene.world.add(ShipSystem);

        const player = new Player();
        this.add(player);

        this.start(loader);
    }
}

export const game = new Game();
game.initialize();
