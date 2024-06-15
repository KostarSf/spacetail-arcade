import { Actor, Engine, Keys, PointerButton, PolygonCollider, Vector, vec } from "excalibur";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { ShipComponent } from "../ecs/ship.ecs";
import { Resources } from "../resources";
import { easeOut, lerp } from "../utils/interpolate";
import { Bullet } from "./bullet";

export interface PlayerOptions {
    pos: Vector;
}

export class Player extends Actor {
    private isMouseControl: boolean = true;

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

        engine.input.pointers.primary.on("move", () => {
            this.isMouseControl = true;
        });
        engine.input.pointers.primary.on("down", (evt) => {
            if (evt.button === PointerButton.Right) {
                this.ship.accelerated = true;
            }

            if (evt.button === PointerButton.Left) {
                this.fire();
            }
        });
        engine.input.pointers.primary.on("up", (evt) => {
            if (evt.button === PointerButton.Right) {
                this.ship.accelerated = false;
            }
        });
        engine.input.keyboard.on("press", (evt) => {
            if (evt.key === Keys.W) {
                this.ship.accelerated = true;
            }

            if (evt.key === Keys.Space) {
                this.fire();
            }
        });
        engine.input.keyboard.on("release", (evt) => {
            if (evt.key === Keys.W) {
                this.ship.accelerated = false;
            }
        });

        // engine.currentScene.camera.strategy.elasticToActor(this, 0.1, 0.8);
        engine.currentScene.camera.strategy.radiusAroundActor(this, 50);
    }

    private fire() {
        if (!this.scene) {
            return;
        }

        const pos = this.pos.add(Vector.fromAngle(this.rotation).scale(15));
        const vel = this.vel.add(Vector.fromAngle(this.rotation).scale(350));

        const bullet = new Bullet({ actor: this, pos, vel });
        this.scene.add(bullet);
    }

    onPostUpdate(engine: Engine, delta: number): void {
        this.updateInputControlls(engine, delta);
        this.updateCameraZoom(engine, delta);
    }

    private updateInputControlls(engine: Engine, delta: number) {
        let rotationMoment = 0;
        if (engine.input.keyboard.isHeld(Keys.A)) {
            this.isMouseControl = false;
            rotationMoment -= 1;
        }
        if (engine.input.keyboard.isHeld(Keys.D)) {
            this.isMouseControl = false;
            rotationMoment += 1;
        }

        if (this.isMouseControl) {
            const cursorScreenPos = engine.input.pointers.primary.lastScreenPos;
            this.ship.rotationTarget = engine.screenToWorldCoordinates(cursorScreenPos);
        } else {
            this.ship.rotationTarget = null;
            const newRotation = this.rotation + (rotationMoment / delta) * 0.2;
            this.rotation = newRotation;
        }
    }

    private updateCameraZoom(engine: Engine, delta: number) {
        const speed = this.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        const newZoom = 1.1 - zoomFactor * 0.4;

        const lastZoom = engine.currentScene.camera.zoom;
        engine.currentScene.camera.zoom = lastZoom + (newZoom - lastZoom) / (delta * 5);
    }

    get ship() {
        return this.get(ShipComponent);
    }
}
