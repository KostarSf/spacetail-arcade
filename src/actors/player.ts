import { Engine, Keys, PointerButton, Vector } from "excalibur";
import { netClient } from "../network/NetClient";
import { easeOut, lerp } from "../utils/interpolate";
import { Bullet } from "./bullet";
import { Ship, ShipOptions } from "./ship";

export class Player extends Ship {
    private isMouseControl: boolean = true;

    constructor(options: ShipOptions) {
        super(options);
    }

    override set accelerated(value: boolean) {
        if (value !== this.accelerated) {
            netClient.send({
                type: "player",
                target: this.uuid,
                action: "accelerated",
                data: {
                    value: value,
                    ...this.serialize(),
                },
            });
        }

        super.accelerated = value;
    }

    public override fire(): Bullet | undefined {
        const bullet = super.fire();

        if (!bullet) {
            return;
        }

        netClient.send({
            type: "player",
            target: this.uuid,
            action: "fire",
            data: {
                object: "Bullet",
                objectPos: [bullet.pos.x, bullet.pos.y],
                objectVel: [bullet.vel.x, bullet.vel.y],
                ...this.serialize(),
            },
        });

        return bullet;
    }

    onInitialize(engine: Engine): void {
        super.onInitialize(engine);

        engine.input.pointers.primary.on("move", () => {
            this.isMouseControl = true;
        });
        engine.input.pointers.primary.on("down", (evt) => {
            if (evt.button === PointerButton.Right) {
                this.accelerated = true;
            }

            if (evt.button === PointerButton.Left) {
                this.fire();
            }
        });
        engine.input.pointers.primary.on("up", (evt) => {
            if (evt.button === PointerButton.Right) {
                this.accelerated = false;
            }
        });
        engine.input.keyboard.on("press", (evt) => {
            if (evt.key === Keys.W) {
                this.accelerated = true;
            }

            if (evt.key === Keys.Space) {
                this.fire();
            }
        });
        engine.input.keyboard.on("release", (evt) => {
            if (evt.key === Keys.W) {
                this.accelerated = false;
            }
        });

        // engine.currentScene.camera.strategy.elasticToActor(this, 0.1, 0.8);
        engine.currentScene.camera.strategy.radiusAroundActor(this, 50);
    }

    onPostUpdate(engine: Engine, delta: number): void {
        this.updateInputControlls(engine, delta);
        this.updateCameraZoom(engine, delta);
    }

    private oldSendedRotation: number = 0;

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

        let newRotation = this.rotation;
        if (this.isMouseControl) {
            const cursorScreenPos = engine.input.pointers.primary.lastScreenPos;
            const rotationTarget = engine.screenToWorldCoordinates(cursorScreenPos);
            newRotation = rotationTarget.sub(this.pos).toAngle();
        } else {
            newRotation = this.rotation + (rotationMoment / delta) * 0.2;
        }

        this.rotation = newRotation;

        if (Math.abs(this.rotation - this.oldSendedRotation) > 0.01) {
            this.oldSendedRotation = this.rotation;
            netClient.send({
                type: "player",
                target: this.uuid,
                action: "rotated",
                data: {
                    ...this.serialize(),
                },
            });
        }
    }

    private updateCameraZoom(engine: Engine, delta: number) {
        const speed = this.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        const newZoom = 1.1 - zoomFactor * 0.4;

        const lastZoom = engine.currentScene.camera.zoom;
        engine.currentScene.camera.zoom = lastZoom + (newZoom - lastZoom) / (delta * 5);
    }

    public serialize() {
        return {
            pos: this.vecToArray(this.pos),
            vel: this.vecToArray(this.vel),
            rotation: Number(this.rotation.toFixed(2)),
        };
    }

    private vecToArray(vector: Vector): [number, number] {
        return [Number(vector.x.toFixed(2)), Number(vector.y.toFixed(2))];
    }
}
