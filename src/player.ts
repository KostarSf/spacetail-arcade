import { Actor, Engine, vec } from "excalibur";
import { Resources } from "./resources";
import { ShipComponent } from "./ecs/ship/ship-ecs";

export class Player extends Actor {
    constructor() {
        super({
            pos: vec(150, 150),
            width: 100,
            height: 100,
        });

        this.addComponent(new ShipComponent());
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
