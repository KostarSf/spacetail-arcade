import { Color, DisplayMode, Engine } from "excalibur";
import { ShipSystem } from "./ecs/ship/ship-ecs";
import { Player } from "./player";
import { loader } from "./resources";

class Game extends Engine {
    constructor() {
        super({
            width: 400,
            height: 600,
            displayMode: DisplayMode.FitContainerAndFill,
            antialiasing: false,
            backgroundColor: Color.Black,
            canvasElementId: "game",
        });
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
