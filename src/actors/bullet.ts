import { Actor, CollisionType, Entity, Vector } from "excalibur";
import { UuidComponent } from "~/ecs/UuidComponent";
import { netClient } from "~/network/NetClient";
import { GameLevel } from "~/scenes/GameLevel";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { Animations } from "../resources";
import { Player } from "./player";

export interface BulletOptions {
    uuid?: string;
    actor: Entity;
    pos: Vector;
    vel: Vector;
}

export class Bullet extends Actor {
    public static readonly energyCost: number = 30;

    public readonly actor: Entity;

    get uuid() {
        return this.get(UuidComponent).uuid;
    }

    constructor(options: BulletOptions) {
        super({
            pos: options.pos,
            vel: options.vel,
            rotation: options.vel.toAngle(),
            radius: 3,
            collisionType: CollisionType.Passive,
        });

        this.addComponent(new UuidComponent(options.uuid));

        this.actor = options.actor;
    }

    onInitialize(): void {
        const animation = Animations.Bullet;
        animation.scale.setTo(1.5, 1.1);

        this.graphics.use(animation);

        this.on("collisionstart", (evt) => {
            const canHit = evt.other.has(SolidBodyComponent) || evt.other instanceof Bullet;
            if (evt.other === this.actor || !canHit) {
                return;
            }

            this.kill();
            evt.other.kill();

            if (this.actor.hasTag(Player.Tag)) {
                netClient.send({
                    type: "entity",
                    action: "remove",
                    target: evt.other.get(UuidComponent).uuid,
                    time: netClient.getTime(),
                });
            }
        });

        this.on("kill", () => {
            if (!netClient.isHost && !this.actor.hasTag(Player.Tag)) {
                return;
            }

            netClient.send({
                type: "entity",
                action: "remove",
                target: this.uuid,
                time: netClient.getTime(),
            });
        });

        this.on("postupdate", () => {
            if (!GameLevel.inBounds(this.pos)) {
                this.kill();
            }
        });

        this.actions.delay(5000).die();
    }
}
