import { Actor, Color, Engine, Vector } from "excalibur";
import { netClient } from "~/network/NetClient";
import { vec, vecToArray } from "~/utils/math";
import { UuidComponent } from "../ecs/UuidComponent";
import { SolidBodyComponent } from "../ecs/physics.ecs";
import { Resources } from "../resources";

export interface AsteroidOptions {
    uuid?: string;
    pos: Vector | [number, number];
    vel?: Vector | [number, number];
    mass: number;
    rotation?: number;
    angularVelocity?: number;
}

export type AsteroidSerialize = ReturnType<(typeof Asteroid)["prototype"]["serialize"]>;

export class Asteroid extends Actor {
    get uuid() {
        return this.get(UuidComponent).uuid;
    }

    get solidBody() {
        return this.get(SolidBodyComponent);
    }

    constructor(options: AsteroidOptions) {
        super({
            pos: options.pos ? vec(options.pos) : undefined,
            vel: options.vel ? vec(options.vel) : undefined,
            rotation: options.rotation,
            angularVelocity: options.angularVelocity,
            radius: 10,
        });

        this.addComponent(new UuidComponent(options.uuid));
        this.addComponent(new SolidBodyComponent({ mass: options.mass }));
    }

    onInitialize(_engine: Engine): void {
        const sprite = Resources.Asteroid.toSprite();
        sprite.tint = Color.Gray;

        this.graphics.add(sprite);

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

        if (netClient.isHost) {
            netClient.send({
                type: "entity",
                action: "spawn",
                target: this.uuid,
                time: netClient.getTime(),
                data: {
                    class: "Asteroid",
                    time: netClient.getTime(),
                    args: this.serialize(),
                },
            });
        }
    }

    public serialize() {
        return {
            uuid: this.uuid,
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            mass: this.solidBody.mass,
            rotation: this.rotation,
            angularVelocity: this.angularVelocity,
        };
    }
}
