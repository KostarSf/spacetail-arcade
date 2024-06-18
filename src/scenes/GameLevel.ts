import {
    Actor,
    CollisionType,
    Color,
    CompositeCollider,
    Engine,
    Font,
    FontUnit,
    GraphicsGroup,
    ImageFiltering,
    Line,
    MotionComponent,
    Query,
    Scene,
    SceneActivationContext,
    ScreenElement,
    Shape,
    Text,
    TransformComponent,
    Vector,
    vec,
} from "excalibur";
import { ShipSystem } from "~/ecs/ship/ShipSystem";
import { Asteroid, AsteroidOptions } from "../actors/asteroid";
import { Bullet } from "../actors/bullet";
import { Player } from "../actors/player";
import { Ship } from "../actors/ship";
import { UuidComponent } from "../ecs/UuidComponent";
import { PhysicsSystem } from "../ecs/physics.ecs";
import { Decal } from "../entities/decal";
import { netClient } from "../network/NetClient";
import { Resources } from "../resources";
import { rand } from "../utils/math";

export class GameLevel extends Scene {
    public static readonly worldSize: number = 5000;

    public static inBounds(vector: Vector, offset = 0) {
        const size = GameLevel.worldSize + offset;
        return vector.x >= -size && vector.x <= size && vector.y >= -size && vector.y <= size;
    }

    private uuidEntitiesQuery!: Query<typeof UuidComponent>;

    private offlineLabel: Actor;
    private isHostLabel: Actor;
    private latencyLabel: Actor;
    private latencyLabelText: Text;

    constructor() {
        super();

        this.offlineLabel = new ScreenElement({
            pos: vec(-100, 10),
        });

        this.offlineLabel.graphics.use(
            new Text({
                text: "reconnecting...",
                font: new Font({
                    family: "consolas",
                    size: 12,
                    unit: FontUnit.Px,
                    color: Color.Red,
                    filtering: ImageFiltering.Pixel,
                }),
            })
        );

        this.isHostLabel = new ScreenElement({
            pos: vec(0, 10),
        });

        this.isHostLabel.graphics.use(
            new Text({
                text: "host",
                font: new Font({
                    family: "consolas",
                    size: 12,
                    unit: FontUnit.Px,
                    color: Color.Yellow,
                    filtering: ImageFiltering.Pixel,
                }),
            })
        );

        this.latencyLabel = new ScreenElement({
            pos: vec(70, 10),
        });

        this.latencyLabelText = new Text({
            text: "none",
            font: new Font({
                family: "consolas",
                size: 12,
                unit: FontUnit.Px,
                color: Color.Gray,
                filtering: ImageFiltering.Pixel,
            }),
        });
        this.latencyLabel.graphics.use(this.latencyLabelText);
    }

    onActivate(_context: SceneActivationContext<unknown>): void {
        this.world.add(PhysicsSystem);
        this.world.add(ShipSystem);
        this.uuidEntitiesQuery = this.world.query([UuidComponent]);

        netClient.onMessage((event) => {
            if (event.type === "entity" && event.action === "remove") {
                const entity = this.uuidEntitiesQuery.entities.find(
                    (entity) => entity.get(UuidComponent).uuid === event.target
                );

                if (entity) {
                    entity.kill();
                }
            }

            if (event.type === "entity" && event.action === "update") {
                const entity = this.uuidEntitiesQuery.entities.find(
                    (entity) => entity.get(UuidComponent).uuid === event.target
                );

                const transform = entity?.get(TransformComponent);
                const motion = entity?.get(MotionComponent);

                if (!entity || !transform || !motion) {
                    return;
                }

                transform.pos.setTo(...event.data.pos);
                transform.rotation = event.data.rotation;
                motion.vel.setTo(...event.data.vel);
            }

            if (event.type === "entity" && event.action === "spawn") {
                const entityExisted = this.uuidEntitiesQuery.entities.find(
                    (entity) => entity.get(UuidComponent).uuid === event.target
                );
                if (entityExisted) {
                    entityExisted.kill();
                }

                if (event.data.class === "Asteroid") {
                    const asteroid = new Asteroid(event.data.args);
                    this.add(asteroid);
                }
            }

            if (event.type === "player") {
                let otherPlayer = this.uuidEntitiesQuery.entities.find(
                    (entity) =>
                        entity.get(UuidComponent).uuid === event.target && entity instanceof Ship
                ) as Ship | undefined;

                if (event.action === "spawn" && !otherPlayer) {
                    otherPlayer = new Ship({
                        uuid: event.target,
                        pos: vec(...event.data.pos),
                        vel: vec(...event.data.vel),
                        rotation: event.data.rotation,
                    });
                    otherPlayer.addTag("player");
                    this.add(otherPlayer);

                    return;
                }

                if (!otherPlayer) {
                    return;
                }

                otherPlayer.pos.setTo(...event.data.pos);
                otherPlayer.vel.setTo(...event.data.vel);
                otherPlayer.rotation = event.data.rotation;

                if (event.action === "update") {
                    // do nothing here
                }

                if (event.action === "rotated") {
                    // do nothing here
                }

                if (event.action === "fire") {
                    const delta = (netClient.getTime() - event.time) / 1000;
                    const vel = vec(...event.data.objectVel);
                    const pos = vec(...event.data.objectPos).add(vel.scale(delta));
                    this.add(
                        new Bullet({
                            uuid: event.data.objectUuid,
                            actor: otherPlayer,
                            vel: vel,
                            pos: pos,
                        })
                    );
                }

                if (event.action === "accelerated") {
                    otherPlayer.accelerated = event.data.value;
                }
            }

            if (event.type === "server" && event.action === "players-list") {
                const otherPlayers = event.data;

                this.uuidEntitiesQuery.entities.forEach((entity) => {
                    const entityUuid = entity.get(UuidComponent).uuid;
                    if (otherPlayers.findIndex((player) => player.uuid === entityUuid) !== -1) {
                        entity.kill();
                    }
                });

                otherPlayers
                    .map((options) => new Ship(options))
                    .forEach((ship) => {
                        ship.addTag("player");
                        this.add(ship);
                    });
            }

            if (event.type === "server" && event.action === "entities-list") {
                const entitiesForDeletion = this.uuidEntitiesQuery.entities.filter(
                    (existedEntity) =>
                        event.data.findIndex(
                            (entity) => entity.args.uuid === existedEntity.get(UuidComponent).uuid
                        ) !== -1
                );

                entitiesForDeletion.forEach((entity) => entity.kill());

                event.data.forEach((entity) => {
                    if (entity.class === "Asteroid") {
                        this.add(new Asteroid(entity.args));
                    }
                });
            }
        });
    }

    onInitialize(_engine: Engine<any>): void {
        const worldSize = GameLevel.worldSize;

        const space = new Decal({
            image: Resources.Space,
            pos: vec(0, 0),
            parallax: 0.2,
            zoomResist: 1.3,
        });
        this.add(space);

        const bordersEntity = new Actor({
            collisionType: CollisionType.Fixed,
            collider: new CompositeCollider([
                Shape.Edge(vec(-worldSize, worldSize), vec(worldSize, worldSize)),
                Shape.Edge(vec(-worldSize, -worldSize), vec(worldSize, -worldSize)),
                Shape.Edge(vec(-worldSize, -worldSize), vec(-worldSize, worldSize)),
                Shape.Edge(vec(worldSize, -worldSize), vec(worldSize, worldSize)),
            ]),
        });
        bordersEntity.addTag("border");
        const borders = [
            new Line({
                start: vec(-worldSize, worldSize),
                end: vec(worldSize, worldSize),
                color: Color.Red,
                thickness: 3,
            }),
            new Line({
                start: vec(-worldSize, -worldSize),
                end: vec(worldSize, -worldSize),
                color: Color.Red,
                thickness: 3,
            }),
            new Line({
                start: vec(-worldSize, -worldSize),
                end: vec(-worldSize, worldSize),
                color: Color.Red,
                thickness: 3,
            }),
            new Line({
                start: vec(worldSize, -worldSize),
                end: vec(worldSize, worldSize),
                color: Color.Red,
                thickness: 3,
            }),
        ];
        const bordersGroup = new GraphicsGroup({
            members: borders.map((border) => ({
                graphic: border,
                offset: Vector.One.scale(worldSize),
            })),
        });
        bordersEntity.graphics.add(bordersGroup);

        this.add(bordersEntity);

        const randPos = () => -100 + Math.random() * 200;
        const player = new Player({ pos: vec(randPos(), randPos()) });
        this.add(player);

        this.add(this.offlineLabel);
        this.add(this.isHostLabel);
        this.add(this.latencyLabel);

        if (netClient.isHost) {
            this.prepareHostWorld();
        }

        netClient.send({
            type: "player",
            action: "spawn",
            target: player.uuid,
            time: netClient.getTime(),
            data: player.serialize(),
        });
    }

    private prepareHostWorld() {
        const asteroidsCount = 200;

        const asteroidSpawns = [
            vec(-110, -90),
            vec(20, -160),
            vec(150, 70),
            vec(-20, 180),
            vec(50, 200),
        ];

        for (let i = 0; i < asteroidsCount; i++) {
            asteroidSpawns.push(
                rand.pickOne([
                    vec(
                        rand.integer(-GameLevel.worldSize, GameLevel.worldSize),
                        rand.integer(100, GameLevel.worldSize) * rand.pickOne([1, -1])
                    ),
                    vec(
                        rand.integer(100, GameLevel.worldSize) * rand.pickOne([1, -1]),
                        rand.integer(-GameLevel.worldSize, GameLevel.worldSize)
                    ),
                ])
            );
        }

        const asteroidOptions = asteroidSpawns.map(
            (pos): AsteroidOptions => ({
                pos,
                mass: rand.integer(40, 150),
                angularVelocity: rand.floating(-0.2, 0.2),
            })
        );
        asteroidOptions.forEach((options) => {
            this.add(new Asteroid(options));
        });
    }

    onPostUpdate(_engine: Engine<any>, _delta: number): void {
        this.offlineLabel.graphics.visible = netClient.offline;
        this.isHostLabel.graphics.visible = netClient.isHost;
        this.latencyLabelText.text =
            "ping: " +
            netClient.latency +
            "ms, offset: " +
            netClient.timeOffset +
            ", entities: " +
            this.world.entities.length;
    }
}
