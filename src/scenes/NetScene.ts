import {
    clamp,
    Color,
    Engine,
    ExcaliburGraphicsContext,
    Scene,
    TagQuery,
    Timer,
    TransformComponent,
    TwoPI,
    vec,
    Vector,
} from "excalibur";
import { Asteroid, AsteroidType } from "~/actors/Asteroid";
import { Player } from "~/actors/Player";
import { Pallete } from "~/constants";
import { NetPhysicsSystem } from "~/ecs/physics.ecs";
import { StatsSystem } from "~/ecs/stats.ecs";
import { Debree } from "~/entities/Debree";
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
        const velLimit = rand.next() < 0.2 ? 60 : 15;

        const chanse = rand.next();
        let asteroidType = AsteroidType.Medium;
        if (chanse < 0.1) {
            asteroidType = AsteroidType.Item;
        } else if (chanse < 0.4) {
            asteroidType = AsteroidType.Small;
        } else if (chanse < 0.6) {
            asteroidType = AsteroidType.Large;
        }

        const asteroid = new Asteroid({
            pos: vec(rand.floating(-posLimit, posLimit), rand.floating(-posLimit, posLimit)),
            vel: vec(rand.floating(-velLimit, velLimit), rand.floating(-velLimit, velLimit)),
            asteroidType: asteroidType,
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

        let player: Player;
        const worldBoder = this.worldSize + 16;
        this.playersQuery.entities.forEach((entity) => {
            player = entity as Player;

            if (
                player.pos.x < -worldBoder ||
                player.pos.x > worldBoder ||
                player.pos.y < -worldBoder ||
                player.pos.y > worldBoder
            ) {
                player.pos.setTo(
                    clamp(player.pos.x, -this.worldSize, this.worldSize),
                    clamp(player.pos.y, -this.worldSize, this.worldSize)
                );
                player.vel.setTo(0, 0);
                player.markStale();
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
    private readonly bgStarTag = "bgstar";
    private starQuery!: TagQuery<typeof this.bgStarTag>;
    private starsLimit = 500; // 200

    private scene: NetScene;

    constructor(scene: NetScene) {
        this.scene = scene;
    }

    initialize(_engine: Engine) {
        this.starQuery = this.scene.world.queryManager.createTagQuery([this.bgStarTag]);

        const space = new Decal({
            image: Resources.Space,
            pos: vec(0, 0),
            parallax: 0.1,
            zoomResist: 1.3,
        });
        this.scene.add(space);

        if (this.scene.player) {
            this.scene.camera.strategy.radiusAroundActor(this.scene.player, 50);
            this.scene.player.on("damage", (evt) => {
                if (evt.amount > 0) {
                    this.scene.camera.shake(5, 5, 100);
                }
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
        if (!this.scene.player) {
            return;
        }

        this.spawnStars(engine, delta);

        this.updateCamera(engine, delta, this.scene.player);
    }

    draw(ctx: ExcaliburGraphicsContext, _delta: number): void {
        if (!this.scene.player || !this.scene.player.active) {
            return;
        }

        const player = this.scene.player;
        const worldSize = this.scene.worldSize;
        const detectRadius = this.scene.detectRadiusSquare;

        const mapSize = 128;
        const mapOffset = 32;
        const offset = vec(mapOffset, mapOffset);

        const background = Color.Black;
        background.a = 0.8;

        ctx.drawRectangle(
            offset.sub(vec(4, 4)),
            mapSize + 8,
            mapSize + 8,
            background,
            Color.Transparent
        );
        ctx.drawRectangle(
            offset.sub(vec(2, 2)),
            mapSize + 4,
            mapSize + 4,
            Color.Transparent,
            Color.Gray,
            2
        );

        let transform: TransformComponent;
        let pos: Vector;

        this.scene.asteroidsQuery.entities.forEach((entity) => {
            transform = entity.get(TransformComponent);
            if (player.pos.squareDistance(transform.pos) > detectRadius) {
                return;
            }

            pos = vec(
                linInt(transform.pos.x, -worldSize, worldSize, 0, mapSize - 2),
                linInt(transform.pos.y, -worldSize, worldSize, 0, mapSize - 2)
            ).addEqual(offset);

            const size = (entity as Asteroid).asteroidType === AsteroidType.Large ? 2 : 1;
            const color =
                (entity as Asteroid).asteroidType === AsteroidType.Item
                    ? Pallete.gray200
                    : Pallete.gray800;

            ctx.drawRectangle(pos, size, size, color);
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

            ctx.drawRectangle(pos, 4, 4, Pallete.gray400);
        });

        pos = vec(
            linInt(player.pos.x, -worldSize, worldSize, 0, mapSize - 2),
            linInt(player.pos.y, -worldSize, worldSize, 0, mapSize - 2)
        ).addEqual(offset);

        ctx.drawRectangle(pos, 2, 2, Color.White);
    }

    private updateCamera(engine: Engine, delta: number, player: Player) {
        delta = delta / 1000;

        const speed = player.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        const newZoom = 1.1 - zoomFactor * 0.4;

        const lastZoom = engine.currentScene.camera.zoom;

        this.scene.camera.zoom = lastZoom + (newZoom - lastZoom) * delta * 2;
    }

    private spawnStars(engine: Engine, _delta: number) {
        if (this.starQuery.entities.length >= this.starsLimit || 0.6 < rand.next()) {
            return;
        }

        const largestDimension =
            engine.drawWidth > engine.drawHeight ? engine.drawWidth : engine.drawHeight;

        console.log(this.scene.camera.pos);

        Debree.emit({
            scene: this.scene,
            pos: this.scene.camera.pos,
            posSpread: largestDimension + 32,
            size: 2.5,
            sizeSpread: 2,
            timeToLive: 6000,
            timeToLiveSpread: 3000,
            vel: vec(0.5,0.5),
            speedSpread: 1,
            angleSpread: TwoPI,
            opacity: 0.6,
            opacitySpread: 0.5,
            blinkSpeed: 800,
            blinkSpeedSpread: 400,
            blinkDelta: 0.05,
            blinkDeltaSpread: 0.05,
            z: -0.6,
            zSpread: 0.8,
            tag: this.bgStarTag,
        });
    }
}
