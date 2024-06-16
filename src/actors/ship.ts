import { Actor, Engine, PolygonCollider, Vector, vec } from "excalibur";
import { UuidComponent } from "../ecs/UuidComponent";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { ShipComponent } from "../ecs/ship.ecs";
import { Resources } from "../resources";
import { Bullet } from "./bullet";

export interface ShipOptions {
    uuid?: string;
    pos?: Vector | [number, number];
    vel?: Vector | [number, number];
    rotation?: number;
}

export class Ship extends Actor {
    get uuid() {
        return this.get(UuidComponent).uuid;
    }

    constructor(options: ShipOptions = {}) {
        super({
            pos: Array.isArray(options.pos) ? vec(...options.pos) : options.pos,
            vel: Array.isArray(options.vel) ? vec(...options.vel) : options.vel,
            rotation: options.rotation,

            collider: new PolygonCollider({
                points: [vec(-10, -10), vec(15, 0), vec(-10, 10)],
            }),
        });

        this.addComponent(new UuidComponent(options.uuid));
        this.addComponent(new ShipComponent());
        this.addComponent(new SolidBodyComponent({ mass: 10 }));
    }

    onInitialize(_engine: Engine): void {
        const sprite = Resources.Player.toSprite();
        this.graphics.add(sprite);
    }

    public fire() {
        if (!this.scene) {
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
