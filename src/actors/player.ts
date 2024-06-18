import { Engine, Keys, PointerButton } from "excalibur";
import { netClient } from "../network/NetClient";
import { easeOut, lerp, round, vecToArray } from "../utils/math";
import { Bullet } from "./bullet";
import { Ship, ShipOptions } from "./ship";

export class Player extends Ship {
    public static readonly Tag: string = "client-player";

    private isMouseControl: boolean = true;

    constructor(options: ShipOptions) {
        super({ ...options, name: options.name ?? "Player" });
        this.addTag("player");
        this.addTag(Player.Tag);
    }

    override set accelerated(value: boolean) {
        if (value !== this.accelerated) {
            netClient.send({
                type: "player",
                target: this.uuid,
                action: "accelerated",
                time: netClient.getTime(),
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
            time: netClient.getTime(),
            data: {
                object: "Bullet",
                objectUuid: bullet.uuid,
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

        engine.currentScene.camera.strategy.radiusAroundActor(this, 50);
    }

    onPostUpdate(engine: Engine, elapsedMs: number): void {
        super.onPostUpdate(engine, elapsedMs);

        const delta = elapsedMs / 1000;
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
            newRotation = this.rotation + rotationMoment * delta * 4;
        }

        this.rotation = newRotation;

        if (Math.abs(this.rotation - this.oldSendedRotation) > 0.01) {
            this.oldSendedRotation = this.rotation;
            netClient.send({
                type: "player",
                target: this.uuid,
                action: "rotated",
                time: netClient.getTime(),
                data: this.serialize(),
            });
        }
    }

    private updateCameraZoom(engine: Engine, delta: number) {
        const speed = this.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        const newZoom = 1.1 - zoomFactor * 0.4;

        const lastZoom = engine.currentScene.camera.zoom;
        engine.currentScene.camera.zoom = lastZoom + (newZoom - lastZoom) * delta * 2;
    }

    public serialize() {
        return {
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            rotation: round(this.rotation, 2),
        };
    }
}
