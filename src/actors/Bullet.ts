import { Actor, clamp, CollisionType, Engine, vec, Vector } from "excalibur";
import { Particle } from "~/entities/Particle";
import { Glare } from "~/graphics/Glare";
import { NetActor } from "~/network/NetActor";
import { DamageAction } from "~/network/events/actions/DamageAction";
import { ReceiverType, SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { rand, round, vecToArray } from "~/utils/math";
import { Animations } from "../resources";
import { XpOrb } from "./XpOrb";

export interface BulletState extends SerializableObject {
    shooter: string | null;
    pos: SerializedVector;
    vel: SerializedVector;
    rotation: number;

    damage: number;
    healthDeflection: number;
    armorDeflection: number;

    timeRemain: number;
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

    private timeToLive = 5000;
    private timeRemain = this.timeToLive;

    private glare!: Actor;

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

    onInitialize(_engine: Engine): void {
        const animation = Animations.Bullet;
        animation.scale.setTo(1.8, 1.3);
        this.graphics.use(animation);

        this.glare = new Actor();
        this.glare.graphics.use(new Glare({ rotationFn: () => -this.rotation - Math.PI }));
        this.addChild(this.glare);

        this.on("collisionstart", (evt) => {
            const other = evt.other;

            if (
                this.shooter === evt.other ||
                !(other instanceof NetActor) ||
                other.hasTag(XpOrb.Tag)
            ) {
                return;
            }

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
                accSpeed: -20,
                accSpeedSpread: 20,
            });

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
    }

    onPostUpdate(engine: Engine, delta: number): void {
        this.timeRemain -= delta;
        if (this.timeRemain <= 0) {
            this.kill();
            Particle.emit({
                scene: this.scene,
                pos: this.pos,
                vel: this.vel.scale(0.6),
                speedSpread: 1,
                angleSpread: 0.3,
                timeToLive: 2000,
                timeToLiveSpread: 2000,
                size: 1,
                sizeSpread: 2,
                opacity: 0.7,
                opacitySpread: 2,
                blinkDelta: 0.1,
                blinkDeltaSpread: 0.1,
                blinkSpeed: 200,
                blinkSpeedSpread: 100,
                amount: rand.integer(15, 20),
                accSpeed: -100,
            });
            return;
        }

        const timeFactor = 0.3 + clamp(this.timeToLive / this.timeRemain, 0, 0.7);

        const sizeFactor =
            0.3 +
            this.scene!.camera.pos.sub(this.pos).squareDistance() * 0.000005 * (timeFactor - 0.25);
        this.glare.scale.setTo(sizeFactor, sizeFactor);
        this.glare.graphics.opacity = clamp(timeFactor + rand.floating(-0.7, 0), 0, 1);

        this.graphics.current!.scale = Vector.One.scale(timeFactor);

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
            accSpeed: -100,
            accSpeedSpread: 50,
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
            timeRemain: this.timeRemain,
        };
    }

    public updateState(state: BulletState, latency: number, actors: Map<string, NetActor>): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;

        this.damage = state.damage;
        this.healthDeflection = state.healthDeflection;
        this.armorDeflection = state.armorDeflection;

        this.timeRemain = state.timeRemain;

        if (state.shooter) {
            this.shooter = actors.get(state.shooter) ?? null;
        }

        const delta = latency / 1000;
        this.pos.addEqual(this.vel.scale(delta));
    }
}
