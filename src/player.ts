import { Actor, CollisionType, Engine, PolygonCollider, vec } from "excalibur";
import { SolidBodyComponent } from "./ecs/physics/physics.ecs";
import { ShipComponent } from "./ecs/ship/ship.ecs";
import { Resources } from "./resources";

export class Player extends Actor {
    constructor() {
        super({
            pos: vec(150, 150),

            collider: new PolygonCollider({
                points: [vec(-10, -10), vec(15, 0), vec(-10, 10)],
            }),
            collisionType: CollisionType.Passive,
        });

        this.addComponent(new ShipComponent());
        this.addComponent(new SolidBodyComponent({ mass: 10 }));
    }

    onInitialize(engine: Engine): void {
        const sprite = Resources.Player.toSprite();
        sprite.scale.scaleEqual(1);
        this.graphics.add(sprite);

        engine.input.pointers.on("move", (e) => {
            this.ship.rotationTarget = e.worldPos;
        });
        engine.input.pointers.primary.on("down", () => {
            this.ship.accelerated = true;
        });
        engine.input.pointers.primary.on("up", () => {
            this.ship.accelerated = false;
        });
    }

    get ship() {
        return this.get(ShipComponent);
    }
}
