import {
    Actor,
    CollisionType,
    Color,
    DisplayMode,
    Engine,
    vec,
} from "excalibur";
import { ShipSystem } from "./ecs/ship/ship.ecs";
import { Player } from "./player";
import { loader } from "./resources";
import { SolidBodyComponent } from "./ecs/physics/physics.ecs";

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

        const asteroid = new Actor({
            radius: 10,
            color: Color.LightGray,
            pos: vec(200, 300),
            collisionType: CollisionType.Passive,
        });
        asteroid.addComponent(new SolidBodyComponent({ mass: 50 }));

        this.add(asteroid);

        this.start(loader);
    }
}

export const game = new Game();
game.initialize();
