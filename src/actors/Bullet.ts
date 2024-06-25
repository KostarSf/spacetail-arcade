import { CollisionType, Engine, Vector, vec } from "excalibur";
import { drawGlare } from "~/graphics/Glare";
import { NetActor } from "~/network/NetActor";
import { DamageAction } from "~/network/events/actions/DamageAction";
import { ReceiverType, SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { rand, round, vecToArray } from "~/utils/math";
import { Animations } from "../resources";
import { XpOrb } from "./XpOrb";
import { Particle } from "~/entities/Particle";

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

    onInitialize(engine: Engine): void {
        const animation = Animations.Bullet;
        animation.scale.setTo(1.5, 1.1);

        this.graphics.use(animation);

        this.on("collisionstart", (evt) => {
            const other = evt.other;

            if (
                this.shooter === evt.other ||
                !(other instanceof NetActor) ||
                other.hasTag(XpOrb.Tag)
            ) {
                return;
            }

            if (this.scene) {
                Particle.emit({
                    scene: this.scene,
                    pos: this.pos,
                    posSpread: 5,
                    vel: other.vel.sub(this.vel.negate().normalize().scale(50)),
                    speedSpread: 1.2,
                    angleSpread: Math.PI * 0.5,
                    size: 1.5,
                    sizeSpread: 0.5,
                    timeToLive: 1000,
                    timeToLiveSpread: 500,
                    amount: rand.integer(10, 15),
                    blinkDelta: 0.2,
                    blinkDeltaSpread: 0.1,
                    blinkSpeed: 200,
                    blinkSpeedSpread: 50,
                    opacity: 0.8,
                    opacitySpread: 0.2,
                });
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

        this.on("postdraw", (evt) => {
            drawGlare(evt.ctx, this, engine.currentScene.camera, 1, 5);
        });

        this.actions.delay(5000).die();
    }

    onPostUpdate(engine: Engine, _delta: number): void {
        if (0.2 < rand.next()) {
            return;
        }

        Particle.emit({
            scene: engine.currentScene,
            size: 1.2,
            sizeSpread: 0.7,
            pos: this.pos,
            vel: this.vel.scale(0.5),
            speedSpread: 0.3,
            angleSpread: 0.06,
            opacity: 0.8,
            opacitySpread: 0.2,
            timeToLive: 1500,
            timeToLiveSpread: 500,
            blinkSpeed: 300,
            blinkSpeedSpread: 100,
            blinkDelta: 0.1,
            blinkDeltaSpread: 0.2,
        });
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
