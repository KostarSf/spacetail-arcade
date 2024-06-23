import { CollisionType, Vector, vec } from "excalibur";
import { NetActor } from "~/network/NetActor";
import { DamageAction } from "~/network/events/actions/DamageAction";
import { ReceiverType, SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { round, vecToArray } from "~/utils/math";
import { Animations } from "../resources";

export interface BulletState extends SerializableObject {
    shooter: string | null;
    pos: SerializedVector;
    vel: SerializedVector;
    rotation: number;

    damage: number;
    healthDeflection: number;
    armorDeflection: number;
}

export interface BulletOptions {
    uuid?: string;
    isReplica?: boolean;

    shooter?: NetActor;
    pos?: Vector;
    vel?: Vector;
    rotation?: number;

    damage?: number;
    healthDeflection?: number;
    armorDeflection?: number;
}

export interface BulletState {}

export class Bullet extends NetActor<BulletState> {
    public static readonly Tag = "bullet";

    public static powerCost = 10;

    public type: ActorType = ActorType.Bullet;

    public shooter: NetActor | null;
    public damage: number;
    public healthDeflection: number;
    public armorDeflection: number;

    constructor(options: BulletOptions) {
        super({
            name: "Bullet",
            uuid: options.uuid,
            isReplica: options.isReplica,

            pos: options.pos,
            vel: options.vel,
            rotation: options.rotation,
            radius: 3,
            collisionType: CollisionType.Passive,
        });

        this.shooter = options.shooter ?? null;
        this.damage = options.damage ?? 1;
        this.healthDeflection = options.healthDeflection ?? 1;
        this.armorDeflection = options.armorDeflection ?? 1;
    }

    onInitialize(): void {
        const animation = Animations.Bullet;
        animation.scale.setTo(1.5, 1.1);

        this.graphics.use(animation);

        this.on("collisionstart", (evt) => {
            const other = evt.other;

            if (this.shooter === evt.other || !(other instanceof NetActor)) {
                return;
            }

            if (!this.isReplica) {
                this.kill();

                other.sendAction(
                    new DamageAction({
                        damage: this.damage,
                        healthDeflection: this.healthDeflection,
                        armorDeflection: this.armorDeflection,
                        direction: this.pos.sub(other.pos).toAngle(),
                    }),
                    { self: false, receiver: ReceiverType.AllClients }
                );
            }
        });

        this.actions.delay(5000).die();
    }

    public serializeState(): BulletState {
        return {
            shooter: this.shooter?.uuid ?? null,
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            rotation: round(this.rotation, 2),
            damage: round(this.damage, 2),
            healthDeflection: round(this.healthDeflection, 2),
            armorDeflection: round(this.armorDeflection, 2),
        };
    }

    public updateState(state: BulletState, latency: number, actors: Map<string, NetActor>): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;

        this.damage = state.damage;
        this.healthDeflection = state.healthDeflection;
        this.armorDeflection = state.armorDeflection;

        if (state.shooter) {
            this.shooter = actors.get(state.shooter) ?? null;
        }

        const delta = latency / 1000;
        this.pos.addEqual(this.vel.scale(delta));
    }
}
