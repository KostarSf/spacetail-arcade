import { EmitterType, Engine, ParticleEmitter, Scene, TagQuery, Timer, vec } from "excalibur";
import { Player } from "~/actors/Player";
import { Asteroid } from "~/actors/asteroid";
import { NetPhysicsSystem } from "~/ecs/physics.ecs";
import { Decal } from "~/entities/Decal";
import { NetSystem } from "~/network/NetSystem";
import Network from "~/network/Network";
import { Resources } from "~/resources";
import { UI } from "~/ui/web-ui";
import { easeOut, lerp, rand } from "~/utils/math";

export class NetScene extends Scene {
    public static readonly Key = "net-scene";

    public player!: Player;
    public graphics: SpaceGraphics;

    private asteroidsQuery!: TagQuery<typeof Asteroid.Tag>;
    private playersQuery!: TagQuery<typeof Player.Tag>;

    constructor() {
        super();

        this.graphics = new SpaceGraphics(this);
    }

    onInitialize(engine: Engine): void {
        this.playersQuery = this.world.queryTags([Player.Tag]);
        this.asteroidsQuery = this.world.queryTags([Asteroid.Tag]);

        this.world.add(new NetSystem(this.world, this));
        this.world.add(NetPhysicsSystem);

        this.player = new Player({
            pos: vec(rand.integer(-150, 150), rand.integer(-150, 150)),
        });

        this.graphics.initialize(engine);

        this.add(this.player);

        const asteroidsSpawnTimer = new Timer({
            random: rand,
            randomRange: [0, 10_000],
            interval: 100,
            repeats: true,
            fcn: () => this.trySpawnAsteroids(),
        });
        this.add(asteroidsSpawnTimer);
        asteroidsSpawnTimer.start();
    }

    private trySpawnAsteroids() {
        const maxAsteroidsCount = 200;

        if (this.asteroidsQuery.entities.length >= maxAsteroidsCount) {
            return;
        }

        const successRate = 1 / this.playersQuery.entities.length;
        if (rand.next() > successRate) {
            return;
        }

        const posLimit = 1500;
        const velLimit = 100;

        const asteroid = new Asteroid({
            pos: vec(rand.floating(-posLimit, posLimit), rand.floating(-posLimit, posLimit)),
            vel: vec(rand.floating(-velLimit, velLimit), rand.floating(-velLimit, velLimit)),
            rotation: rand.floating(0, Math.PI * 2),
            angularVelocity: rand.floating(-1, 1),
            mass: rand.integer(30, 300),
        });
        this.add(asteroid);
    }

    onPostUpdate(engine: Engine<any>, delta: number): void {
        this.graphics.update(engine, delta);

        const debug =
            `ping: ${Network.ping}ms, ` +
            `clock offset: ${Network.clockOffset}ms, ` +
            `players: ${this.playersQuery.entities.length}, ` +
            `asteroids: ${this.asteroidsQuery.entities.length}`;
        UI.debugText.setText(debug);
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

        this.scene.camera.strategy.radiusAroundActor(this.scene.player, 50);
    }

    update(engine: Engine, delta: number) {
        this.starsParticles.transform.pos = this.scene.player.pos.sub(
            vec(engine.halfDrawWidth, engine.halfDrawHeight)
        );

        this.updateCamera(engine, delta);
    }

    private updateCamera(engine: Engine, delta: number) {
        delta = delta / 1000;

        const speed = this.scene.player.vel.distance();

        const zoomFactor = lerp(speed, 0, 1000, easeOut);
        const newZoom = 1.1 - zoomFactor * 0.4;

        const lastZoom = engine.currentScene.camera.zoom;

        this.scene.camera.zoom = lastZoom + (newZoom - lastZoom) * delta * 2;
    }
}
