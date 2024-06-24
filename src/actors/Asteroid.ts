import { CollisionType, Color, Engine, TwoPI, Vector } from "excalibur";
import { NetBodyComponent } from "~/ecs/physics.ecs";
import { StatsComponent } from "~/ecs/stats.ecs";
import { ShadowedSprite } from "~/graphics/ShadowedSprite";
import { NetActor } from "~/network/NetActor";
import { SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { rand, round, vec, vecToArray } from "~/utils/math";
import { Resources } from "../resources";
import { XpOrb } from "./XpOrb";

export interface AsteroidState extends SerializableObject {
    pos: SerializedVector;
    vel: SerializedVector;
    rotation: number;
    angularVelocity: number;
    mass: number;
    health: number;
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

    get stats() {
        return this.get(StatsComponent);
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

        this.addTag(Asteroid.Tag);

        this.addComponent(new StatsComponent({ health: 50, power: 0, hardness: 20 }));
        this.addComponent(new NetBodyComponent({ mass: options.mass ?? 10 }));

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

        this.on("kill", () => {
            if (!this.scene || this.isReplica || this.isKilled()) {
                return;
            }

            const count = rand.integer(2, 4);
            const values = new Array(count).fill(0).map(() => rand.integer(2, 4));

            XpOrb.spawn(this.scene, values, this.pos, this.vel);
        });

        this.on("damage", () => {
            if (!this.scene || this.isReplica || this.isKilled()) {
                return;
            }

            const chance = rand.floating(0, 1);
            if (chance > 0.3) {
                return;
            }

            const count = rand.integer(0, 2);
            const values = new Array(count).fill(1);

            XpOrb.spawn(this.scene, values, this.pos, this.vel);
        });
    }

    onPostUpdate(engine: Engine<any>, _delta: number): void {
        const tint = engine.isDebug && this.isReplica ? Color.Orange : Color.DarkGray;

        if (this.graphics.current && this.graphics.current.tint !== tint) {
            this.graphics.current.tint = tint;
        }
    }

    public serializeState(): AsteroidState {
        return {
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            rotation: round(this.rotation, 2),
            angularVelocity: round(this.angularVelocity, 2),
            mass: this.netBody.mass,
            health: this.stats.health,
        };
    }

    public updateState(state: AsteroidState, latency: number): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;
        this.angularVelocity = state.angularVelocity;

        this.stats.health = state.health;

        const delta = latency / 1000;

        const newRotation = (this.angularVelocity * delta) % TwoPI;
        this.rotation += newRotation + (newRotation < 0 ? TwoPI : 0);
        this.pos.addEqual(this.vel.scale(delta));
        this.netBody.mass = state.mass;
    }
}
