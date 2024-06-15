import { Color, DisplayMode, Engine, vec } from "excalibur";
import { Asteroid } from "./actors/asteroid";
import { Decal } from "./actors/decal";
import { Player } from "./actors/player";
import { ShipSystem } from "./ecs/ship.ecs";
import { Resources, loader } from "./resources";

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

        const space = new Decal({ image: Resources.Space, pos: vec(100, 100) });
        this.add(space);

        const player = new Player({ pos: vec(150, 150) });
        this.add(player);

        const asteroid = new Asteroid({ pos: vec(200, 300), mass: 50 });
        this.add(asteroid);

        this.start(loader);
    }
}

export const game = new Game();
game.initialize();
