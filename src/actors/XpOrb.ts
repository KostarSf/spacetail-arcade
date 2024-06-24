import { CollisionType, Color, Engine, Scene, TwoPI, vec, Vector } from "excalibur";
import { Pallete } from "~/constants";
import { NetBodyComponent } from "~/ecs/physics.ecs";
import { drawGlare } from "~/graphics/Glare";
import { SerializableObject } from "~/network/events/types";
import { NetActor } from "~/network/NetActor";
import { ActorType, SerializedVector } from "~/network/types";
import { easeInOut, lerp, rand, vecToArray } from "~/utils/math";

export interface XpOrbState extends SerializableObject {
    amount: number;
    pos: SerializedVector;
    vel: SerializedVector;
    timeToDie: number;
    timeRemain: number;
}

export interface XpOrbOptions {
    uuid?: string;
    isReplica?: boolean;

    amount?: number;

    pos?: Vector;
    vel?: Vector;

    timeToDie?: number;
}

export class XpOrb extends NetActor<XpOrbState> {
    public static readonly Tag = "xporb";

    public readonly type: ActorType = ActorType.XpOrb;

    public amount: number;

    private timeToDie: number;
    private timeRemain: number;
    private initialScale: number;
    private oldSquareDistance: number;
    private blinking: boolean;

    constructor(options: XpOrbOptions) {
        const initialScale = rand.floating(0.8, 1.2);

        super({
            name: "XP Orb",
            uuid: options.uuid,
            isReplica: options.isReplica,

            pos: options.pos,
            vel: options.vel,

            width: 5,
            height: 5,
            collisionType: CollisionType.Passive,

            scale: Vector.One.scaleEqual(initialScale),
            rotation: rand.floating(0, TwoPI),
            angularVelocity: rand.floating(-3, 3),
        });

        this.addComponent(new NetBodyComponent({ mass: 1 }));
        this.addTag(XpOrb.Tag);

        this.amount = options.amount ?? 1;

        this.timeToDie = options.timeToDie ?? 15_000 * rand.floating(0.8, 1.2);
        this.timeRemain = this.timeToDie;
        this.initialScale = initialScale;
        this.oldSquareDistance = this.vel.squareDistance();
        this.blinking = false;
    }

    onInitialize(engine: Engine): void {
        const square = vec(-3, -3);

        const smallSquare = vec(-1, -1);
        const largeSquare = vec(-2, -2);
        this.on("postdraw", (evt) => {
            drawGlare(evt.ctx, this, engine.currentScene.camera, 6, 4);

            evt.ctx.drawRectangle(square, 6, 6, Color.White);

            if (this.amount >= 25) {
                const large = this.amount >= 100;
                const size = large ? 4 : 2;
                evt.ctx.drawRectangle(
                    large ? largeSquare : smallSquare,
                    size,
                    size,
                    Pallete.gray900
                );
            }
        });
    }

    onPostUpdate(_engine: Engine, delta: number): void {
        this.timeRemain -= delta;
        delta = delta / 1000;

        const scaleBase = this.amount < 10 ? 0.3 : this.amount < 50 ? 0.6 : 1;
        const scale =
            scaleBase +
            lerp(this.timeRemain, 0, this.timeToDie, easeInOut) *
                Math.max(0.4, this.initialScale - 0.4);
        this.scale.setTo(scale, scale);

        if (!this.blinking && this.timeRemain / this.timeToDie < 0.2) {
            this.blinking = true;
            this.actions.blink(250, 250, 10);
        }

        if (this.timeRemain <= 0) {
            this.kill();
            return;
        }

        const squareDistance = this.vel.squareDistance();

        if (squareDistance === 0) {
            return;
        }

        if (squareDistance < 1) {
            this.oldSquareDistance = 0;

            this.vel.setTo(0, 0);
            this.markStale();

            return;
        }

        if (squareDistance < 100) {
            this.vel.scaleEqual(Math.pow(0.99999, delta));

            if (this.oldSquareDistance > 100) {
                this.markStale();
            }

            this.oldSquareDistance = this.vel.squareDistance();

            return;
        }

        this.vel.scaleEqual(Math.pow(0.1, delta));
        this.oldSquareDistance = this.vel.squareDistance();
    }

    public serializeState(): XpOrbState {
        return {
            amount: this.amount,
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            timeToDie: this.timeToDie,
            timeRemain: this.timeRemain,
        };
    }

    public updateState(state: XpOrbState, _latency: number): void {
        this.amount = state.amount;
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.timeToDie = state.timeToDie;
        this.timeRemain = state.timeRemain;
    }

    public static spawn(scene: Scene, values: number[], pos: Vector, vel: Vector = Vector.Zero) {
        values.forEach((amount) => {
            const direction = rand.floating(0, TwoPI);
            const speed = rand.floating(40, 200);
            const velocity = vel.add(Vector.fromAngle(direction).scale(speed));

            scene.add(new XpOrb({ amount, pos, vel: velocity }));
        });
    }
}
