import {
    clamp,
    Color,
    Engine,
    Entity,
    ExcaliburGraphicsContext,
    GraphicsComponent,
    Scene,
    TransformComponent,
    vec,
    Vector,
} from "excalibur";
import { rand } from "~/utils/math";

export interface DebreeOptions {
    pos: Vector;
    vel: Vector;
    timeToLive: number;
    size: number;
    blinkSpeed: number;
    blinkDelta?: number;
    initialOpacity?: number;
}

export class Debree extends Entity {
    private vel: Vector;

    private size: number;
    private timeToLive: number;
    private timeRemain: number;
    private blinkSpeed: number;
    private timeAfterLastBlink: number;
    private initialOpacity;

    private color: Color;
    private origin: Vector;
    private blinkDelta: number;

    public get pos() {
        return this.get(TransformComponent).pos;
    }

    public set pos(value: Vector) {
        this.get(TransformComponent).pos = value;
    }

    constructor(options: DebreeOptions) {
        const transform = new TransformComponent();
        const graphics = new GraphicsComponent({
            onPostDraw: (ex) => this.onPostDraw(ex),
        });

        super([transform, graphics]);

        this.pos = options.pos;
        this.vel = options.vel;

        this.size = Math.abs(options.size);
        this.origin = vec(-this.size / 2, -this.size / 2);

        this.timeToLive = Math.round(options.timeToLive);
        this.timeRemain = this.timeToLive;

        this.blinkSpeed = Math.abs(Math.round(options.blinkSpeed));
        this.timeAfterLastBlink = 0;

        this.color = Color.White;
        this.blinkDelta = options.blinkDelta ?? 0.3;
        this.initialOpacity = clamp(options.initialOpacity ?? 1, 0, 1);
    }

    public get isOffScreen(): boolean {
        return this.hasTag("ex.offscreen");
    }

    onPostUpdate(_engine: Engine, delta: number): void {
        this.timeRemain -= delta;
        if (this.timeRemain <= 0 || this.isOffScreen) {
            this.kill();
            return;
        }

        this.pos.addEqual(this.vel.scale(delta / 1000));

        this.timeAfterLastBlink += delta;
        if (this.timeAfterLastBlink > this.blinkSpeed) {
            this.timeAfterLastBlink = 0;
            this.blinkDelta = -this.blinkDelta;
        }

        const rawOpacity =
            (this.timeRemain / this.timeToLive) * this.initialOpacity - this.blinkDelta;
        this.color.a = clamp(rawOpacity, 0, 1);
    }

    private onPostDraw(ex: ExcaliburGraphicsContext) {
        ex.drawRectangle(this.origin, this.size, this.size, this.color);
    }

    public static emit(args: {
        scene: Scene;
        size: number;
        sizeSpread?: number;
        pos: Vector;
        vel: Vector;
        posSpread?: number;
        speedSpread?: number;
        angleSpread?: number;
        amount?: number;
        opacity?: number;
        opacitySpread?: number;
        timeToLive: number;
        timeToLiveSpread?: number;
        blinkSpeed?: number;
        blinkSpeedSpread?: number;
        blinkDelta?: number;
        blinkDeltaSpread?: number;
    }) {
        const {
            scene,
            size: initialSize,
            sizeSpread = 0,
            pos: initialPos,
            posSpread = 0,
            vel: initialVel,
            speedSpread = 0,
            angleSpread = 0,
            amount = 1,
            opacity: initialOpacity = 1,
            opacitySpread = 0,
            timeToLive: initialTimeToLive,
            timeToLiveSpread = 0,
            blinkSpeed: initialBlinkSpeed = 1000,
            blinkSpeedSpread = 0,
            blinkDelta: initialBlinkDelta = 0,
            blinkDeltaSpread = 0,
        } = args;

        let pos: Vector;
        let vel: Vector;
        for (let i = 0; i < amount; i++) {
            pos = initialPos.add(
                vec(
                    rand.floating(-posSpread * 0.5, posSpread * 0.5),
                    rand.floating(-posSpread * 0.5, posSpread * 0.5)
                )
            );

            vel = initialVel.clone();
            const speedDelta = rand.floating(-speedSpread * 0.5, speedSpread * 0.5);
            vel.x += vel.x * speedDelta;
            vel.y += vel.y * speedDelta;

            vel = vel.rotate(rand.floating(-angleSpread * 0.5, angleSpread * 0.5));

            const opacity =
                initialOpacity + rand.floating(-opacitySpread * 0.5, opacitySpread * 0.5);
            const timeToLive =
                initialTimeToLive + rand.floating(-timeToLiveSpread * 0.5, timeToLiveSpread * 0.5);

            const blinkSpeed =
                initialBlinkSpeed + rand.floating(-blinkSpeedSpread * 0.5, blinkSpeedSpread * 0.5);
            const blinkDelta =
                initialBlinkDelta + rand.floating(-blinkDeltaSpread * 0.5, blinkDeltaSpread * 0.5);
            const size = initialSize + rand.floating(-sizeSpread * 0.5, sizeSpread * 0.5);

            scene.add(
                new Debree({
                    pos,
                    vel,
                    blinkSpeed,
                    timeToLive,
                    blinkDelta,
                    initialOpacity: opacity,
                    size,
                })
            );
        }
    }
}
