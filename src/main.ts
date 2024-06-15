import { Color, DisplayMode, Engine, Random, vec } from "excalibur";
import { Asteroid, AsteroidOptions } from "./actors/asteroid";
import { Decal } from "./entities/decal";
import { Player } from "./actors/player";
import { ShipSystem } from "./ecs/ship.ecs";
import { Resources, loader } from "./resources";

const rand = new Random(256);

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

        const space = new Decal({
            image: Resources.Space,
            pos: vec(100, 100),
            parallax: 0.2,
            zoomResist: 1.3,
        });
        this.add(space);

        const player = new Player({ pos: vec(150, 150) });
        this.add(player);

        const asteroidSpawns = [
            vec(10, 30),
            vec(140, -40),
            vec(270, 190),
            vec(100, 300),
            vec(170, 320),
        ];
        const asteroidOptions = asteroidSpawns.map(
            (pos): AsteroidOptions => ({
                pos,
                mass: rand.integer(40, 150),
                angularVelocity: rand.floating(-0.2, 0.2),
            })
        );
        asteroidOptions.forEach((options) => {
            this.add(new Asteroid(options));
        });

        this.start(loader);
    }
}

export const game = new Game();
game.initialize();
