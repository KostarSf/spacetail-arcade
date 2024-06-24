import { CircleCollider, CollisionType, Color, Engine, Shape, TwoPI, Vector } from "excalibur";
import { NetBodyComponent } from "~/ecs/physics.ecs";
import { StatsComponent } from "~/ecs/stats.ecs";
import { ShadowedSprite } from "~/graphics/ShadowedSprite";
import { NetActor } from "~/network/NetActor";
import { SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { rand, vec, vecToArray } from "~/utils/math";
import { Resources } from "../resources";
import { XpOrb } from "./XpOrb";

export enum AsteroidType {
    Small,
    Medium,
    Large,
    Item,
}

export interface AsteroidState extends SerializableObject {
    pos: SerializedVector;
    vel: SerializedVector;
    mass: number;
    health: number;
    asteroidType: AsteroidType;
}

export interface AsteroidOptions {
    uuid?: string;
    isReplica?: boolean;

    pos?: Vector | [number, number];
    vel?: Vector | [number, number];
    asteroidType?: AsteroidType;
}

export class Asteroid extends NetActor<AsteroidState> {
    public static readonly Tag = "asteroid";

    public readonly type: ActorType = ActorType.Asteroid;

    get netBody() {
        return this.get(NetBodyComponent);
    }

    get stats() {
        return this.get(StatsComponent);
    }

    private asteroidCollider: CircleCollider;
    public asteroidType: AsteroidType;

    constructor(options: AsteroidOptions = {}) {
        const collider = Shape.Circle(10);

        super({
            name: "Asteroid",
            uuid: options.uuid,
            isReplica: options.isReplica,

            pos: options.pos ? vec(options.pos) : undefined,
            vel: options.vel ? vec(options.vel) : undefined,
            rotation: rand.floating(0, TwoPI),
            angularVelocity: rand.floating(-1, 1),
            collisionType: CollisionType.Passive,
            collider: collider,
        });

        this.addTag(Asteroid.Tag);

        this.addComponent(new StatsComponent({ health: 50, power: 0, hardness: 20 }));
        this.addComponent(new NetBodyComponent({ mass: 10 }));

        this.asteroidCollider = collider;
        this.asteroidType = options.asteroidType ?? AsteroidType.Medium;
    }

    onInitialize(_engine: Engine): void {
        this.setAsteroidStatsAndVisuals();

        this.on("precollision", (event) => {
            if (!this.isReplica && event.other.hasTag(Asteroid.Tag)) {
                const other = event.other as Asteroid;

                const normal = other.pos.sub(this.pos);
                if (normal.distance() <= this.asteroidCollider.radius + 0.5) {
                    this.vel = this.vel.add(normal.normalize().negate().scale(1));
                }
            }
        });

        this.on("kill", () => {
            if (!this.scene || this.isReplica || this.isKilled()) {
                return;
            }

            if (this.asteroidType !== AsteroidType.Item) {
                let count = 2;
                if (this.asteroidType === AsteroidType.Small) {
                    count = rand.integer(1, 2);
                } else if (this.asteroidType === AsteroidType.Medium) {
                    count = rand.integer(2, 4);
                } else if (this.asteroidType === AsteroidType.Large) {
                    count = rand.integer(6, 10);
                }

                const values = new Array(count).fill(0).map(() => rand.integer(1, 4));

                XpOrb.spawn(this.scene, values, this.pos, this.vel);
            } else {
            }
        });

        this.on("damage", () => {
            if (
                !this.scene ||
                this.isReplica ||
                this.isKilled() ||
                this.asteroidType === AsteroidType.Item
            ) {
                return;
            }

            const chance = rand.floating(0, 1);
            if (chance > 0.3) {
                return;
            }

            const count = rand.integer(0, 2);
            const values = new Array(count).fill(1);

            XpOrb.spawn(this.scene, values, this.pos, this.vel);
        });
    }

    private setAsteroidStatsAndVisuals() {
        let radius = 10;
        let sprite = Resources.AsteroidMedium1;
        let mass = 100;
        let health = 60;

        if (this.asteroidType === AsteroidType.Small) {
            radius = 6;
            sprite = rand.pickOne([Resources.AsteroidSmall1, Resources.AsteroidSmall2]);
            mass = rand.integer(40, 60);
            health = 30;
        }

        if (this.asteroidType === AsteroidType.Medium) {
            radius = 10;
            sprite = rand.pickOne([Resources.AsteroidMedium1, Resources.AsteroidMedium2]);
            mass = rand.integer(100, 200);
            health = 60;
        }

        if (this.asteroidType === AsteroidType.Large) {
            radius = 18;
            sprite = rand.pickOne([Resources.AsteroidLarge1, Resources.AsteroidLarge2]);
            mass = rand.integer(400, 600);
            health = 150;
        }

        if (this.asteroidType === AsteroidType.Item) {
            radius = 10;
            sprite = rand.pickOne([Resources.AsteroidItem1, Resources.AsteroidItem2]);
            mass = rand.integer(60, 100);
            health = 15;
        }

        this.asteroidCollider.radius = radius;
        this.graphics.use(ShadowedSprite.from(sprite, Color.DarkGray));
        this.netBody.mass = mass;
        this.stats.health = health;
        this.stats.maxHealth = health;
    }

    onPostUpdate(engine: Engine<any>, _delta: number): void {
        const tint = engine.isDebug && this.isReplica ? Color.Orange : Color.DarkGray;

        if (this.graphics.current && this.graphics.current.tint !== tint) {
            this.graphics.current.tint = tint;
        }
    }

    public serializeState(): AsteroidState {
        return {
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            mass: this.netBody.mass,
            health: this.stats.health,
            asteroidType: this.asteroidType,
        };
    }

    public updateState(state: AsteroidState, latency: number): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);

        if (this.asteroidType !== state.asteroidType) {
            this.asteroidType = state.asteroidType;
            this.setAsteroidStatsAndVisuals();
            this.stats.health = state.health;
        }

        const delta = latency / 1000;

        this.pos.addEqual(this.vel.scale(delta));
        this.netBody.mass = state.mass;
    }
}
