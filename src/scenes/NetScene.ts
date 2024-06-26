import {
    Actor,
    Color,
    Engine,
    ExcaliburGraphicsContext,
    Query,
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
import { Decal } from "~/entities/Decal";
import { Particle } from "~/entities/Particle";
import { WorldBorder } from "~/entities/WorldBorder";
import { NetActor } from "~/network/NetActor";
import { NetStateComponent } from "~/network/NetStateComponent";
import { NetSystem } from "~/network/NetSystem";
import Network from "~/network/Network";
import { Resources } from "~/resources";
import { UI } from "~/ui/web-ui";
import { easeIn, easeOut, lerp, linInt, rand } from "~/utils/math";

export class NetScene extends Scene {
    public static readonly Key = "net-scene";

    public player?: Player;
    public graphics: SpaceGraphics;

    public asteroidsQuery!: TagQuery<typeof Asteroid.Tag>;
    public playersQuery!: TagQuery<typeof Player.Tag>;
    public netActorsQuery!: Query<typeof NetStateComponent>;

    public readonly worldSize = 10_000;
    public readonly halfWorldSize = this.worldSize / 2;
    public readonly maxAsteroidsCount = 500;
    public readonly detectRadius = 2500;
    public readonly detectRadiusSquare = Math.pow(this.detectRadius, 2);

    constructor() {
        super();

        this.graphics = new SpaceGraphics(this);
    }

    onInitialize(engine: Engine): void {
        this.playersQuery = this.world.queryTags([Player.Tag]);
        this.asteroidsQuery = this.world.queryTags([Asteroid.Tag]);
        this.netActorsQuery = this.world.query([NetStateComponent]);

        this.world.add(NetSystem);
        this.world.add(NetPhysicsSystem);
        this.world.add(StatsSystem);

        const playerPosLimit = this.halfWorldSize * 0.8;
        this.player = new Player({
            pos: vec(
                rand.integer(-playerPosLimit, playerPosLimit),
                rand.integer(-playerPosLimit, playerPosLimit)
            ),
        });

        this.graphics.initialize(engine);

        const worldBorder = new WorldBorder({ worldSize: this.worldSize });
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

        const posLimit = this.halfWorldSize;
        const velLimit = rand.next() < 0.2 ? 350 : 50;

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

        this.netActorsQuery.entities.forEach((entity) => {
            const actor = entity as NetActor;

            if (this.actorOutOfWorld(actor)) {
                const oldPos = actor.pos.clone();

                this.teleportActorBackToWorld(actor);
                if (actor === this.player) {
                    const posDiff = actor.pos.sub(oldPos);
                    this.camera.pos.addEqual(posDiff);
                    this.camera.drawPos.addEqual(posDiff);
                    this.graphics.translateStars(posDiff);
                }

                actor.markStale();
            }
        });

        const debug =
            `ping: ${Network.ping}ms, ` +
            `clock offset: ${Network.clockOffset}ms, ` +
            `players: ${this.playersQuery.entities.length}, ` +
            `asteroids: ${this.asteroidsQuery.entities.length}`;
        UI.debugText.setText(debug);
    }

    private actorOutOfWorld(actor: Actor) {
        return (
            Math.abs(actor.pos.x) > this.halfWorldSize || Math.abs(actor.pos.y) > this.halfWorldSize
        );
    }

    private teleportActorBackToWorld(actor: Actor) {
        while (actor.pos.x < -this.halfWorldSize) {
            actor.pos.x += this.worldSize;
        }
        while (actor.pos.x > this.halfWorldSize) {
            actor.pos.x -= this.worldSize;
        }
        while (actor.pos.y < -this.halfWorldSize) {
            actor.pos.y += this.worldSize;
        }
        while (actor.pos.y > this.halfWorldSize) {
            actor.pos.y -= this.worldSize;
        }
    }

    onPostDraw(ctx: ExcaliburGraphicsContext, delta: number): void {
        this.graphics.draw(ctx, delta);
    }
}

class SpaceGraphics {
    private readonly bgStarTag = "bgstar";
    private starQuery!: TagQuery<typeof this.bgStarTag>;
    private starsLimit = 500;

    private readonly bgStarDustTag = "bgstardust";
    private starDustQuery!: TagQuery<typeof this.bgStarDustTag>;
    private starDustLimit = 100;

    private scene: NetScene;

    constructor(scene: NetScene) {
        this.scene = scene;
    }

    initialize(_engine: Engine) {
        this.starQuery = this.scene.world.queryManager.createTagQuery([this.bgStarTag]);
        this.starDustQuery = this.scene.world.queryManager.createTagQuery([this.bgStarDustTag]);

        const space = new Decal({
            image: Resources.Space,
            pos: vec(0, 0),
            parallax: 0.1,
            zoomResist: 0.5,
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
        this.spawnStarDust(engine, delta);

        this.updateCamera(engine, delta, this.scene.player);
    }

    draw(ctx: ExcaliburGraphicsContext, _delta: number): void {
        if (!this.scene.player || !this.scene.player.active) {
            return;
        }

        const player = this.scene.player;
        const halfWorldSize = this.scene.halfWorldSize;
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
                linInt(transform.pos.x, -halfWorldSize, halfWorldSize, 0, mapSize - 2),
                linInt(transform.pos.y, -halfWorldSize, halfWorldSize, 0, mapSize - 2)
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
                linInt(transform.pos.x, -halfWorldSize, halfWorldSize, 0, mapSize - 2),
                linInt(transform.pos.y, -halfWorldSize, halfWorldSize, 0, mapSize - 2)
            ).addEqual(offset);

            ctx.drawRectangle(pos, 4, 4, Pallete.gray400);
        });

        pos = vec(
            linInt(player.pos.x, -halfWorldSize, halfWorldSize, 0, mapSize - 2),
            linInt(player.pos.y, -halfWorldSize, halfWorldSize, 0, mapSize - 2)
        ).addEqual(offset);

        ctx.drawRectangle(pos, 2, 2, Color.White);
    }

    public translateStars(vector: Vector) {
        this.starQuery.entities.forEach((entity) => {
            (entity as Particle).translate(vector);
        });
        this.starDustQuery.entities.forEach((entity) => {
            (entity as Particle).translate(vector);
        });
    }

    private updateCamera(engine: Engine, delta: number, player: Player) {
        delta = delta / 1000;

        const speed = player.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        const newZoom = 1.6 - zoomFactor * 0.4;

        const lastZoom = engine.currentScene.camera.zoom;

        this.scene.camera.zoom = lastZoom + (newZoom - lastZoom) * delta * 2;
    }

    private spawnStars(engine: Engine, _delta: number) {
        if (this.starQuery.entities.length >= this.starsLimit || 0.6 < rand.next()) {
            return;
        }

        const largestDimension =
            engine.drawWidth > engine.drawHeight ? engine.drawWidth : engine.drawHeight;

        Particle.emit({
            scene: this.scene,
            pos: this.scene.camera.pos,
            posSpread: largestDimension + 32,
            amount: 3,
            size: 1.5,
            sizeSpread: 2,
            timeToLive: 6000,
            timeToLiveSpread: 3000,
            vel: vec(0.5, 0.5),
            speedSpread: 1,
            angleSpread: TwoPI,
            rotationSpread: TwoPI,
            glareChange: 0.01,
            opacity: 0.4,
            opacitySpread: 0.6,
            blinkSpeed: 800,
            blinkSpeedSpread: 400,
            blinkDelta: 0.05,
            blinkDeltaSpread: 0.05,
            fadeInTime: 1000,
            fadeInTimeSpread: 1000,
            z: -0.8,
            zSpread: 0.3,
            tag: this.bgStarTag,
        });
    }

    private spawnStarDust(engine: Engine, _delta: number) {
        if (this.starDustQuery.entities.length > this.starDustLimit) {
            return;
        }

        const largestDimension =
            engine.drawWidth > engine.drawHeight ? engine.drawWidth : engine.drawHeight;

        const playerSpeed = this.scene.player?.vel.distance() ?? 0;
        const speedCoeff = 0.1 + lerp(playerSpeed, 0, 500, easeIn) * 0.9;

        if (speedCoeff < rand.next()) {
            return;
        }

        Particle.emit({
            scene: this.scene,
            pos: this.scene.camera.pos,
            posSpread: largestDimension + 32,
            amount: Math.round(3 + 3 * speedCoeff),
            size: 0.4 + speedCoeff,
            sizeSpread: 0.6,
            timeToLive: 1000 + 2000 * speedCoeff,
            timeToLiveSpread: 400,
            vel: Vector.Zero,
            opacity: 0.4,
            opacitySpread: 0.4,
            blinkSpeed: 300,
            blinkSpeedSpread: 200,
            blinkDelta: 0.05,
            blinkDeltaSpread: 0.05,
            fadeInTime: 400,
            fadeInTimeSpread: 200,
            z: 0.2,
            zSpread: 0.8,
            tag: this.bgStarDustTag,
        });
    }
}
