import { Actor, Color, Engine, Vector } from "excalibur";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { Resources } from "../resources";
import { UuidComponent } from "../ecs/UuidComponent";

export interface AsteroidOptions {
    uuid?: string;
    pos: Vector;
    mass: number;
    angularVelocity?: number;
}

export class Asteroid extends Actor {
    constructor(options: AsteroidOptions) {
        super({
            pos: options.pos,
            radius: 10,
            angularVelocity: options.angularVelocity,
        });

        this.addComponent(new UuidComponent(options.uuid));
        this.addComponent(new SolidBodyComponent({ mass: options.mass }));
    }

    onInitialize(_engine: Engine): void {
        const sprite = Resources.Asteroid.toSprite();
        sprite.tint = Color.Gray;

        this.graphics.add(sprite);
    }
}
