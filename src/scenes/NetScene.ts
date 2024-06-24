import {
    Color,
    EmitterType,
    Engine,
    ExcaliburGraphicsContext,
    ParticleEmitter,
    Scene,
    TagQuery,
    Timer,
    TransformComponent,
    vec,
    Vector,
} from "excalibur";
import { Asteroid } from "~/actors/Asteroid";
import { Player } from "~/actors/Player";
import { NetPhysicsSystem } from "~/ecs/physics.ecs";
import { StatsSystem } from "~/ecs/stats.ecs";
import { Decal } from "~/entities/Decal";
import { WorldBorder } from "~/entities/WorldBorder";
import { NetSystem } from "~/network/NetSystem";
import Network from "~/network/Network";
import { Resources } from "~/resources";
import { UI } from "~/ui/web-ui";
import { easeOut, lerp, linInt, rand } from "~/utils/math";

export class NetScene extends Scene {
    public static readonly Key = "net-scene";

    public player?: Player;
    public graphics: SpaceGraphics;

    public asteroidsQuery!: TagQuery<typeof Asteroid.Tag>;
    public playersQuery!: TagQuery<typeof Player.Tag>;

    public readonly worldSize = 5_000;
    public readonly maxAsteroidsCount = 200;
    public readonly detectRadius = 2500;
    public readonly detectRadiusSquare = Math.pow(this.detectRadius, 2);

    constructor() {
        super();

        this.graphics = new SpaceGraphics(this);
    }

    onInitialize(engine: Engine): void {
        this.playersQuery = this.world.queryTags([Player.Tag]);
        this.asteroidsQuery = this.world.queryTags([Asteroid.Tag]);

        this.world.add(NetSystem);
        this.world.add(NetPhysicsSystem);
        this.world.add(StatsSystem);

        const playerPosLimit = this.worldSize * 0.8;
        this.player = new Player({
            pos: vec(
                rand.integer(-playerPosLimit, playerPosLimit),
                rand.integer(-playerPosLimit, playerPosLimit)
            ),
        });

        this.graphics.initialize(engine);

        const worldBorder = new WorldBorder(this.worldSize);
        this.add(worldBorder);

        this.add(this.player);

        const asteroidsSpawnTimer = new Timer({
            random: rand,
            randomRange: [0, 1000],
            interval: 100,
            repeats: true,
            fcn: () => this.trySpawnAsteroids(),
        });
        this.add(asteroidsSpawnTimer);
        asteroidsSpawnTimer.start();
    }

    private trySpawnAsteroids() {
        if (this.asteroidsQuery.entities.length >= this.maxAsteroidsCount) {
            return;
        }

        const successRate = 1 / this.playersQuery.entities.length;
        if (rand.next() > successRate) {
            return;
        }

        const posLimit = this.worldSize;
        const velLimit = 10;

        const asteroid = new Asteroid({
            pos: vec(rand.floating(-posLimit, posLimit), rand.floating(-posLimit, posLimit)),
            vel: vec(rand.floating(-velLimit, velLimit), rand.floating(-velLimit, velLimit)),
            rotation: rand.floating(0, Math.PI * 2),
            angularVelocity: rand.floating(-1, 1),
            mass: rand.integer(100, 300),
        });
        this.add(asteroid);
    }

    onPostUpdate(engine: Engine<any>, delta: number): void {
        this.graphics.update(engine, delta);

        const limit = this.worldSize;
        this.asteroidsQuery.entities.forEach((asteroid) => {
            if (
                Math.abs((asteroid as Asteroid).pos.x) > limit ||
                Math.abs((asteroid as Asteroid).pos.y) > limit
            ) {
                asteroid.kill();
            }
        });

        const debug =
            `ping: ${Network.ping}ms, ` +
            `clock offset: ${Network.clockOffset}ms, ` +
            `players: ${this.playersQuery.entities.length}, ` +
            `asteroids: ${this.asteroidsQuery.entities.length}`;
        UI.debugText.setText(debug);
    }

    onPostDraw(ctx: ExcaliburGraphicsContext, delta: number): void {
        this.graphics.draw(ctx, delta);
    }
}

class SpaceGraphics {
    private starsParticles!: ParticleEmitter;

    private scene: NetScene;

    constructor(scene: NetScene) {
        this.scene = scene;
    }

    initialize(engine: Engine) {
        const space = new Decal({
            image: Resources.Space,
            pos: vec(0, 0),
            parallax: 0.1,
            zoomResist: 1.3,
        });
        this.scene.add(space);

        this.starsParticles = new ParticleEmitter({
            emitterType: EmitterType.Rectangle,
            width: engine.drawWidth * 2,
            height: engine.drawHeight * 2,
            x: -engine.drawWidth,
            y: -engine.drawHeight,
            minAngle: 0,
            maxAngle: Math.PI * 2,
            emitRate: 50,
            fadeFlag: true,
            minSize: 0.8,
            maxSize: 1.2,
            particleLife: 5000,
            isEmitting: true,
            opacity: 0.7,
        });
        this.scene.add(this.starsParticles);

        if (this.scene.player) {
            this.scene.camera.strategy.radiusAroundActor(this.scene.player, 50);
            this.scene.player.on("damage", () => {
                this.scene.camera.shake(5, 5, 100);
            });
            this.scene.player.on("postupdate", (evt) => {
                const player = evt.target as Player;

                if (player.accelerated) {
                    const speed = Math.max(2, player.vel.distance() * 0.003);
                    this.scene.camera.shake(speed, speed, 200);
                }
            });
        }
    }

    update(engine: Engine, delta: number) {
        if (this.scene.player) {
            this.starsParticles.transform.pos = this.scene.player.pos.sub(
                vec(engine.halfDrawWidth, engine.halfDrawHeight)
            );

            this.updateCamera(engine, delta, this.scene.player);
        }
    }

    draw(ctx: ExcaliburGraphicsContext, _delta: number): void {
        if (!this.scene.player || !this.scene.player.active) {
            return;
        }

        const player = this.scene.player;
        const worldSize = this.scene.worldSize;
        const detectRadius = this.scene.detectRadiusSquare;

        const mapSize = 64;
        const mapOffset = 32;
        const offset = vec(mapOffset, mapOffset);

        const background = Color.Black;
        background.a = 0.8;

        ctx.drawRectangle(
            offset.sub(vec(2, 2)),
            mapSize + 4,
            mapSize + 4,
            background,
            Color.Transparent
        );
        ctx.drawRectangle(offset, mapSize, mapSize, Color.Transparent, Color.Gray, 2);

        let transform: TransformComponent;
        let pos: Vector;

        const dark = Color.fromHex("#333333");

        this.scene.asteroidsQuery.entities.forEach((entity) => {
            transform = entity.get(TransformComponent);
            if (player.pos.squareDistance(transform.pos) > detectRadius) {
                return;
            }

            pos = vec(
                linInt(transform.pos.x, -worldSize, worldSize, 0, mapSize - 2),
                linInt(transform.pos.y, -worldSize, worldSize, 0, mapSize - 2)
            ).addEqual(offset);

            ctx.drawRectangle(pos, 1, 1, dark);
        });

        this.scene.playersQuery.entities.forEach((entity) => {
            transform = entity.get(TransformComponent);
            if (entity === player || player.pos.squareDistance(transform.pos) > detectRadius) {
                return;
            }

            pos = vec(
                linInt(transform.pos.x, -worldSize, worldSize, 0, mapSize - 2),
                linInt(transform.pos.y, -worldSize, worldSize, 0, mapSize - 2)
            ).addEqual(offset);

            ctx.drawRectangle(pos, 4, 4, Color.Red);
        });

        pos = vec(
            linInt(player.pos.x, -worldSize, worldSize, 0, mapSize - 2),
            linInt(player.pos.y, -worldSize, worldSize, 0, mapSize - 2)
        ).addEqual(offset);

        ctx.drawRectangle(pos, 2, 2, Color.Cyan);
    }

    private updateCamera(engine: Engine, delta: number, player: Player) {
        delta = delta / 1000;

        const speed = player.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        const newZoom = 1.1 - zoomFactor * 0.4;

        const lastZoom = engine.currentScene.camera.zoom;

        this.scene.camera.zoom = lastZoom + (newZoom - lastZoom) * delta * 2;
    }
}
