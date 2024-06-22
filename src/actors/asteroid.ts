import { CollisionType, Color, Engine, TwoPI, Vector } from "excalibur";
import { NetBodyComponent } from "~/ecs/physics.ecs";
import { ShadowedSprite } from "~/graphics/ShadowedSprite";
import { NetActor } from "~/network/NetActor";
import { NetAction } from "~/network/events/actions/NetAction";
import { ActionType, SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { round, vec, vecToArray } from "~/utils/math";
import { Resources } from "../resources";

export interface AsteroidState extends SerializableObject {
    pos: SerializedVector;
    vel: SerializedVector;
    rotation: number;
    angularVelocity: number;
    mass: number;
}

export interface AsteroidOptions {
    uuid?: string;
    isReplica?: boolean;

    pos?: Vector | [number, number];
    vel?: Vector | [number, number];
    mass?: number;
    rotation?: number;
    angularVelocity?: number;
}

export class Asteroid extends NetActor<AsteroidState> {
    public static readonly Tag = "asteroid";

    public readonly type: ActorType = ActorType.Asteroid;

    private radius: number;

    get netBody() {
        return this.get(NetBodyComponent);
    }

    constructor(options: AsteroidOptions = {}) {
        const radius = 10;

        super({
            name: "Asteroid",
            uuid: options.uuid,
            isReplica: options.isReplica,

            pos: options.pos ? vec(options.pos) : undefined,
            vel: options.vel ? vec(options.vel) : undefined,
            rotation: options.rotation,
            angularVelocity: options.angularVelocity,
            radius: radius,
            collisionType: CollisionType.Passive,
        });

        this.addComponent(new NetBodyComponent({ mass: options.mass ?? 10 }));
        this.addTag(Asteroid.Tag);

        this.radius = radius;
    }

    onInitialize(_engine: Engine): void {
        const tint = this.isReplica ? Color.Orange : Color.DarkGray;
        const sprite = ShadowedSprite.from(Resources.Asteroid, tint);
        this.graphics.add(sprite);

        this.on("precollision", (event) => {
            if (!this.isReplica && event.other.hasTag(Asteroid.Tag)) {
                const other = event.other as Asteroid;

                const normal = other.pos.sub(this.pos);
                if (normal.distance() <= this.radius + 0.5) {
                    this.vel = this.vel.add(normal.normalize().negate().scale(1));
                }
            }
        });
    }

    onPostUpdate(_engine: Engine<any>, _delta: number): void {
        const tint = this.isReplica ? Color.Orange : Color.DarkGray;

        if (this.graphics.current && this.graphics.current.tint !== tint) {
            this.graphics.current.tint = tint;
        }

        const limit = 500;
        if (Math.abs(this.pos.x) > limit || Math.abs(this.pos.y) > limit) {
            this.kill();
        }
    }

    public serializeState(): AsteroidState {
        return {
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            rotation: round(this.rotation, 2),
            angularVelocity: round(this.angularVelocity, 2),
            mass: this.netBody.mass,
        };
    }

    public updateState(state: AsteroidState, latency: number): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;
        this.angularVelocity = state.angularVelocity;

        const delta = latency / 1000;

        const newRotation = (this.angularVelocity * delta) % TwoPI;
        this.rotation += newRotation + (newRotation < 0 ? TwoPI : 0);
        this.pos.addEqual(this.vel.scale(delta));
        this.netBody.mass = state.mass;
    }

    protected receiveAction(action: NetAction, _latency: number): void {
        switch (action.type) {
            case ActionType.Damage:
                this.kill();
        }
    }
}
