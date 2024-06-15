import { Actor, Engine, PolygonCollider, Vector, vec } from "excalibur";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { ShipComponent } from "../ecs/ship.ecs";
import { Resources } from "../resources";
import { easeOut, lerp } from "../utils/interpolate";

export interface PlayerOptions {
    pos: Vector;
}

export class Player extends Actor {
    constructor(options: PlayerOptions) {
        super({
            pos: options.pos,

            collider: new PolygonCollider({
                points: [vec(-10, -10), vec(15, 0), vec(-10, 10)],
            }),
        });

        this.addComponent(new ShipComponent());
        this.addComponent(new SolidBodyComponent({ mass: 10 }));
    }

    onInitialize(engine: Engine): void {
        const sprite = Resources.Player.toSprite();
        this.graphics.add(sprite);

        engine.input.pointers.primary.on("down", () => {
            this.ship.accelerated = true;
        });
        engine.input.pointers.primary.on("up", () => {
            this.ship.accelerated = false;
        });

        // engine.currentScene.camera.strategy.elasticToActor(this, 0.1, 0.8);
        engine.currentScene.camera.strategy.radiusAroundActor(this, 50)
    }

    onPostUpdate(engine: Engine<any>, _delta: number): void {
        const cursorScreenPos = engine.input.pointers.primary.lastScreenPos;
        this.ship.rotationTarget = engine.screenToWorldCoordinates(cursorScreenPos);

        const speed = this.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        engine.currentScene.camera.zoom = 1.1 - (zoomFactor * 0.4)
    }

    get ship() {
        return this.get(ShipComponent);
    }
}
