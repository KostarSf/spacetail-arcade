import { Actor, Color, Engine, GraphicsGroup, Line, PolygonCollider, Vector, vec } from "excalibur";
import { ShipComponent } from "~/ecs/ship";
import { netClient } from "~/network/NetClient";
import { UuidComponent } from "../ecs/UuidComponent";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { Resources } from "../resources";
import { Bullet } from "./bullet";
import { linInt } from "~/utils/math";

export interface ShipOptions {
    uuid?: string;
    pos?: Vector | [number, number];
    vel?: Vector | [number, number];
    rotation?: number;
    name?: string;
}

export class Ship extends Actor {
    private energyLine: Line;

    get uuid() {
        return this.get(UuidComponent).uuid;
    }

    constructor(options: ShipOptions = {}) {
        super({
            pos: Array.isArray(options.pos) ? vec(...options.pos) : options.pos,
            vel: Array.isArray(options.vel) ? vec(...options.vel) : options.vel,
            rotation: options.rotation,
            name: options.name ?? "Ship",
            collider: new PolygonCollider({
                points: [vec(-10, -10), vec(15, 0), vec(-10, 10)],
            }),
        });

        this.addComponent(new UuidComponent(options.uuid));
        this.addComponent(new ShipComponent());
        this.addComponent(new SolidBodyComponent({ mass: 10 }));

        this.energyLine = new Line({
            start: vec(24, 0),
            end: vec(24, 32),
            color: Color.Cyan,
            thickness: 3,
        });
    }

    onInitialize(_engine: Engine): void {
        const sprite = Resources.Player.toSprite();
        this.graphics.add(
            new GraphicsGroup({
                members: [
                    { graphic: sprite, offset: Vector.Zero },
                    { graphic: this.energyLine, offset: vec(16, 0), useBounds: false },
                ],
            })
        );

        this.on("kill", () => {
            if (!netClient.isHost) {
                return;
            }

            netClient.send({
                type: "entity",
                action: "remove",
                target: this.uuid,
                time: netClient.getTime(),
            });
        });
    }

    onPostUpdate(engine: Engine<any>, delta: number): void {
        super.onPostUpdate(engine, delta);

        const lowEnergy = this.ship.energy < Bullet.energyCost;
        this.energyLine.color = lowEnergy ? Color.Red : Color.Cyan;

        this.energyLine.rotation = -this.rotation - (Math.PI * 0.5);
        this.energyLine.end.y = 32 * linInt(this.ship.energy, 0, this.ship.energyLimit);
    }

    public fire() {
        if (!this.scene) {
            return;
        }

        if (!this.ship.consumeEnergy(Bullet.energyCost)) {
            return;
        }

        const pos = this.pos.add(Vector.fromAngle(this.rotation).scale(15));
        const vel = this.vel.add(Vector.fromAngle(this.rotation).scale(350));

        const bullet = new Bullet({ actor: this, pos, vel });
        this.scene.add(bullet);

        return bullet;
    }

    private get ship() {
        return this.get(ShipComponent);
    }

    get accelerated() {
        return this.ship.accelerated;
    }

    set accelerated(value: boolean) {
        this.ship.accelerated = value;
    }

    get rotationTarget() {
        return this.ship.rotationTarget;
    }

    set rotationTarget(value: Vector | null) {
        this.ship.rotationTarget = value;
    }
}
