import {
    Actor,
    Engine,
    Text,
    MotionComponent,
    Query,
    Scene,
    SceneActivationContext,
    ScreenElement,
    TransformComponent,
    vec,
    Color,
    Font,
    FontUnit,
} from "excalibur";
import { Asteroid, AsteroidOptions } from "../actors/asteroid";
import { Bullet } from "../actors/bullet";
import { Player } from "../actors/player";
import { Ship } from "../actors/ship";
import { UuidComponent } from "../ecs/UuidComponent";
import { PhysicsSystem } from "../ecs/physics.ecs";
import { ShipSystem } from "../ecs/ship.ecs";
import { Decal } from "../entities/decal";
import { netClient } from "../network/NetClient";
import { Resources } from "../resources";
import { rand } from "../utils/math";

export class GameLevel extends Scene {
    private uuidEntitiesQuery!: Query<typeof UuidComponent>;

    private offlineLabel: Actor;

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
                    size: 24,
                    unit: FontUnit.Px,
                    color: Color.Red,
                }),
            })
        );
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
                    this.add(
                        new Bullet({
                            actor: otherPlayer,
                            pos: vec(...event.data.objectPos),
                            vel: vec(...event.data.objectVel),
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
        });
    }

    onInitialize(_engine: Engine<any>): void {
        const space = new Decal({
            image: Resources.Space,
            pos: vec(100, 100),
            parallax: 0.2,
            zoomResist: 1.3,
        });
        this.add(space);

        const randPos = () => 0 + Math.random() * 200;
        const player = new Player({ pos: vec(randPos(), randPos()) });
        this.add(player);

        this.add(this.offlineLabel);

        if (netClient.isHost) {
            this.prepareWorld();
        }

        netClient.send({
            type: "player",
            action: "spawn",
            target: player.uuid,
            data: {
                ...player.serialize(),
            },
        });
    }

    private prepareWorld() {
        const asteroidSpawns = [
            vec(10, 30),
            vec(140, -40),
            vec(270, 190),
            vec(100, 300),
            vec(170, 320),
        ];
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

    onPostUpdate(engine: Engine<any>, delta: number): void {
        this.offlineLabel.graphics.visible = netClient.offline;
    }
}
