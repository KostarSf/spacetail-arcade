import {
    clamp,
    Color,
    Engine,
    Entity,
    ExcaliburGraphicsContext,
    GraphicsComponent,
    GraphicsGroup,
    ParallaxComponent,
    Scene,
    Sprite,
    TransformComponent,
    vec,
    Vector,
} from "excalibur";
import { Resources } from "~/resources";
import { rand } from "~/utils/math";

export interface ParticleOptions {
    pos: Vector;
    vel: Vector;
    rotation?: number;
    timeToLive: number;
    size: number;
    blinkSpeed: number;
    blinkDelta?: number;
    initialOpacity?: number;
    parallax?: number;
    tag?: string;
    fadeInTime?: number; // TODO
    withGlare?: boolean;
}

export class Particle extends Entity {
    private vel: Vector;

    private size: number;
    private timeToLive: number;
    private timeRemain: number;
    private blinkSpeed: number;
    private timeAfterLastBlink: number;
    private initialOpacity;
    private rotation: number;
    private color: Color;
    private origin: Vector;
    private blinkDelta: number;

    private glare1!: Sprite;
    private glare2!: Sprite;
    private withGlare: boolean = false;

    public get pos() {
        return this.get(TransformComponent).pos;
    }

    public set pos(value: Vector) {
        this.get(TransformComponent).pos = value;
    }

    constructor(options: ParticleOptions) {
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

        this.rotation = options.rotation ?? 0;

        if (options.parallax) {
            const factor = 1 + clamp(options.parallax, -1, 1);
            this.addComponent(new ParallaxComponent(vec(factor, factor)));
        }

        if (options.tag) {
            this.addTag(options.tag);
        }

        if (options.withGlare) {
            this.withGlare = true;

            const glare1 = Resources.Glare.toSprite();
            const glare2 = Resources.Glare.toSprite();

            glare1.opacity = glare2.opacity = 0.2;
            glare1.width = glare2.width = 80;
            glare1.scale = glare2.scale = vec(this.size * 0.2, this.size * 0.2);

            // glare1.rotation = glare2.rotation = this.rotation;
            glare2.rotation += Math.PI * 0.5;
            glare1.origin = glare2.origin = vec(40, 16);

            graphics.use(
                new GraphicsGroup({
                    members: [glare1, glare2],
                })
            );

            this.glare1 = glare1;
            this.glare2 = glare2;
        }
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
        let opacity = clamp(rawOpacity, 0, 1);

        this.color.a = opacity;
        if (this.withGlare) {
            this.glare1.opacity = this.glare2.opacity = opacity;
        }
    }

    private onPostDraw(ex: ExcaliburGraphicsContext) {
        ex.rotate(this.rotation);
        ex.drawRectangle(this.origin, this.size, this.size, this.color);
    }

    public static emit(args: {
        scene: Scene | undefined | null;
        size: number;
        sizeSpread?: number;
        pos: Vector;
        vel: Vector;
        acc?: Vector; // TODO
        accSpeedSpread?: number; // TODO
        posSpread?: number;
        speedSpread?: number;
        angleSpread?: number;
        rotation?: number;
        rotationSpread?: number;
        glareChange?: number;
        amount?: number;
        opacity?: number;
        opacitySpread?: number;
        fadeInTime?: number; // TODO
        fadeInTimeSpread?: number; // TODO
        timeToLive: number;
        timeToLiveSpread?: number;
        blinkSpeed?: number;
        blinkSpeedSpread?: number;
        blinkDelta?: number;
        blinkDeltaSpread?: number;
        z?: number;
        zSpread?: number;
        tag?: string;
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
            rotation: initialRotation = 0,
            rotationSpread = 0,
            amount = 1,
            opacity: initialOpacity = 1,
            opacitySpread = 0,
            timeToLive: initialTimeToLive,
            timeToLiveSpread = 0,
            blinkSpeed: initialBlinkSpeed = 1000,
            blinkSpeedSpread = 0,
            blinkDelta: initialBlinkDelta = 0,
            blinkDeltaSpread = 0,
            z = 0,
            zSpread = 0,
            glareChange = 0,
        } = args;

        if (!scene) {
            return;
        }

        let pos: Vector;
        let vel: Vector;
        for (let i = 0; i < amount; i++) {
            const parallax = clamp(z + rand.floating(-zSpread * 0.5, zSpread * 0.5), -0.95, 0.95);

            pos = initialPos.add(
                vec(
                    rand.floating(-posSpread * 0.5, posSpread * 0.5),
                    rand.floating(-posSpread * 0.5, posSpread * 0.5)
                )
            );

            const parallaxFactor = vec(1 + parallax, 1 + parallax);
            const oneMinusFactor = Vector.One.sub(parallaxFactor);
            const parallaxOffset = scene.camera.pos.scale(oneMinusFactor);
            pos.subEqual(parallaxOffset);

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

            const rotation =
                initialRotation + rand.floating(-rotationSpread * 0.5, rotationSpread * 0.5);
            const withGlare = clamp(glareChange, 0, 1) > rand.next();

            scene.add(
                new Particle({
                    pos,
                    vel,
                    rotation,
                    blinkSpeed,
                    timeToLive,
                    blinkDelta,
                    initialOpacity: opacity,
                    size,
                    parallax,
                    withGlare,
                    tag: args.tag,
                })
            );
        }
    }
}
