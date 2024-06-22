import { CollisionType, Vector, vec } from "excalibur";
import { NetActor } from "~/network/NetActor";
import { DamageAction } from "~/network/events/actions/DamageAction";
import { SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { round, vecToArray } from "~/utils/math";
import { Animations } from "../resources";

export interface BulletState extends SerializableObject {
    shooter: string | null;
    pos: SerializedVector;
    vel: SerializedVector;
    rotation: number;
    damage: number;
}

export interface BulletOptions {
    uuid?: string;
    isReplica?: boolean;

    shooter?: NetActor;
    pos?: Vector;
    vel?: Vector;
    rotation?: number;
    damage?: number;
}

export interface BulletState {}

export class Bullet extends NetActor<BulletState> {
    public static readonly Tag = "bullet";

    public type: ActorType = ActorType.Bullet;

    public shooter: NetActor | null;
    public damage: number;

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
                        amount: this.damage,
                        direction: other.pos.sub(this.pos).toAngle(),
                    })
                );
            }
        });

        this.actions.delay(5000).die();
    }

    public serializeState(): BulletState {
        return {
            shooter: this.shooter?.uuid ?? null,
            damage: round(this.damage, 2),
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            rotation: round(this.rotation, 2),
        };
    }

    public updateState(state: BulletState, latency: number, actors: Map<string, NetActor>): void {
        this.damage = state.damage;
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;

        if (state.shooter) {
            this.shooter = actors.get(state.shooter) ?? null;
        }

        const delta = latency / 1000;
        this.pos.addEqual(this.vel.scale(delta));
    }
}
