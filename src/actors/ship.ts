import {
    Actor,
    Animation,
    Color,
    Engine,
    GraphicsGroup,
    PolygonCollider,
    Vector,
    vec,
} from "excalibur";
import { HealthComponent } from "~/ecs/health.ecs";
import { ShipComponent } from "~/ecs/ship";
import { Explosion } from "~/entities/Explosion";
import { ResourceLine } from "~/graphics/ResourceLine";
import { ShadowedSprite } from "~/graphics/ShadowedSprite";
import { netClient } from "~/network/NetClient";
import { UuidComponent } from "../ecs/UuidComponent";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { Animations, Resources } from "../resources";
import { Bullet } from "./bullet";

export interface ShipOptions {
    uuid?: string;
    pos?: Vector | [number, number];
    vel?: Vector | [number, number];
    rotation?: number;
    name?: string;
    healthColor?: Color;
}

export class Ship extends Actor {
    private jetGraphics!: Animation;

    get uuid() {
        return this.get(UuidComponent).uuid;
    }

    get health() {
        return this.get(HealthComponent);
    }

    private healthColor: Color;

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
        this.addComponent(new HealthComponent({ health: 100, labelsAnchor: vec(0, -24) }));

        this.healthColor = options.healthColor ?? Color.Red;
    }

    onInitialize(_engine: Engine): void {
        this.jetGraphics = Animations.JetStream;

        this.graphics.add(
            new GraphicsGroup({
                members: [
                    { graphic: ShadowedSprite.from(Resources.Player), offset: Vector.Zero },
                    { graphic: this.jetGraphics, offset: Vector.Zero },
                    {
                        graphic: new ResourceLine({
                            pos: vec(26, 0),
                            lineWidth: 32,
                            color: () => {
                                const lowEnergy = this.ship.energy < Bullet.energyCost;
                                return lowEnergy ? Color.Red : Color.Cyan;
                            },
                            minValue: 0,
                            maxValue: this.ship.energyLimit,
                            valueFn: () => this.ship.energy,
                            rotationFn: () => -this.rotation - Math.PI * 0.5,
                            hideOnMaxValue: true,
                        }),
                        offset: vec(16, 0),
                        useBounds: false,
                    },
                    {
                        graphic: new ResourceLine({
                            pos: vec(22, 0),
                            lineWidth: 32,
                            color: this.healthColor,
                            minValue: 0,
                            maxValue: this.health.maxHealth,
                            valueFn: () => this.health.health,
                            rotationFn: () => -this.rotation - Math.PI * 0.5,
                        }),
                        offset: vec(16, 0),
                        useBounds: false,
                    },
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

        this.health.events.on("damage", () => {
            this.scene?.add(new Explosion(this.pos));
        });

        this.health.events.on("death", () => {
            this.kill();
        });
    }

    onPostUpdate(engine: Engine<any>, delta: number): void {
        super.onPostUpdate(engine, delta);

        this.jetGraphics.opacity = this.ship.accelerated ? 1 : 0;
    }

    public fire() {
        if (!this.scene) {
            return;
        }

        if (!this.ship.consumeEnergy(Bullet.energyCost)) {
            return;
        }

        const direction = Vector.fromAngle(this.rotation);

        const pos = this.pos.add(direction.scale(15));
        const vel = this.vel.add(direction.scale(350));

        const bullet = new Bullet({ actor: this, pos, vel, damage: 25 });
        this.scene.add(bullet);

        this.vel.subEqual(direction.scale(3));

        return bullet;
    }

    get ship() {
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
