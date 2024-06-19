import {
    BodyComponent,
    Collider,
    ColliderComponent,
    CollisionType,
    Component,
    Entity,
    MotionComponent,
    PreCollisionEvent,
    Query,
    System,
    SystemPriority,
    SystemType,
    TransformComponent,
    Vector,
    World,
    vec,
} from "excalibur";
import { Player } from "~/actors/player";
import { Explosion } from "~/entities/Explosion";
import { GameLevel } from "~/scenes/GameLevel";
import { netClient } from "../network/NetClient";
import { linInt, round, vecToArray } from "../utils/math";
import { UuidComponent } from "./UuidComponent";
import { HealthComponent } from "./health.ecs";

export interface SolidBodyOptions {
    mass: number;
}

export class SolidBodyComponent extends Component {
    public mass: number;

    public nextVel: Vector | null = null;

    get pos() {
        return this.owner?.get(TransformComponent).pos!;
    }

    get vel() {
        return this.owner?.get(MotionComponent).vel!;
    }

    readonly dependencies = [MotionComponent, BodyComponent, ColliderComponent, UuidComponent];

    constructor(options: SolidBodyOptions) {
        super();

        this.mass = options.mass;
    }

    onAdd(owner: Entity<BodyComponent | ColliderComponent | TransformComponent>): void {
        owner.get(BodyComponent).collisionType = CollisionType.Passive;

        owner.get(ColliderComponent).events.on("precollision", (evt: any) => {
            const precollision = evt as PreCollisionEvent<Collider>;

            if (precollision.other.owner.hasTag("border")) {
                const transform = precollision.target.owner.get(TransformComponent);
                const motion = precollision.target.owner.get(MotionComponent);

                const left = transform.pos.x <= -GameLevel.worldSize;
                const right = transform.pos.x >= GameLevel.worldSize;
                const top = transform.pos.y >= GameLevel.worldSize;
                const bottom = transform.pos.y <= -GameLevel.worldSize;

                let hit = false;

                if ((left && motion.vel.x < 0) || (right && motion.vel.x > 0)) {
                    motion.vel = motion.vel.scale(vec(-1, 1));
                    hit = true;
                }

                if ((top && motion.vel.y > 0) || (bottom && motion.vel.y < 0)) {
                    motion.vel = motion.vel.scale(vec(1, -1));
                    hit = true;
                }

                if (hit) {
                    motion.vel.scaleEqual(0.3);
                }

                transform.pos.x = Math.max(
                    -GameLevel.worldSize,
                    Math.min(transform.pos.x, GameLevel.worldSize)
                );
                transform.pos.y = Math.max(
                    -GameLevel.worldSize,
                    Math.min(transform.pos.y, GameLevel.worldSize)
                );

                return;
            }

            if (!precollision.other.owner.has(SolidBodyComponent)) {
                return;
            }

            if (precollision.target.owner.hasTag(Player.Tag)) {
                const player = precollision.target.owner as Player;
                const relativeVelocity = precollision.other.owner
                    .get(MotionComponent)
                    .vel.sub(player.vel);

                const scale = linInt(relativeVelocity.squareDistance(), 0, 100_000, 0, 1);
                const power = scale * 10;
                const duration = 100 + scale * 400;

                player.scene?.camera.shake(power, power, duration);
            }

            const target = precollision.target.owner;
            const other = precollision.other.owner;

            if (!netClient.isHost) {
                return;
            }

            const thisBody = target.get(SolidBodyComponent);
            const otherBody = other.get(SolidBodyComponent);

            const collisionDirection = otherBody.pos.sub(thisBody.pos);
            if (collisionDirection.squareDistance() === 0) {
                return;
            }

            const collisionNormal = collisionDirection.normalize();

            const relativeVelocity = otherBody.vel.sub(thisBody.vel);
            const velocityAlongNormal = relativeVelocity.dot(collisionNormal);

            if (velocityAlongNormal > 0) {
                return;
            }

            const restitution = 0.2;
            const impulseScalar =
                (-(1 + restitution) * velocityAlongNormal) /
                (1 / thisBody.mass + 1 / otherBody.mass);

            const impulse = collisionNormal.scale(impulseScalar);

            thisBody.nextVel = thisBody.vel.sub(impulse.scale(1 / thisBody.mass));
        });

        owner.on("kill", () => {
            const pos = owner.get(TransformComponent).pos;
            owner.scene?.add(new Explosion(pos));
        });

        owner.on("initialize", () => {
            const motion = owner.get(MotionComponent)!;
            const health = owner.get(HealthComponent);
            const body = owner.get(BodyComponent);

            health?.events.on("damage", (evt) => {
                if (!evt.damager) {
                    return;
                }

                motion.vel.addEqual(
                    evt.damager.vel.normalize().scale((evt.amount * 5) / body.mass)
                );
            });
        });
    }
}

export class PhysicsSystem extends System {
    public systemType: SystemType = SystemType.Update;
    public priority: number = SystemPriority.Average;

    private query: Query<
        | typeof SolidBodyComponent
        | typeof MotionComponent
        | typeof UuidComponent
        | typeof TransformComponent
    >;

    constructor(world: World) {
        super();
        this.query = world.query([SolidBodyComponent]);
    }

    update(_elapsedMs: number): void {
        let body: SolidBodyComponent;
        let motion: MotionComponent;
        let transform: TransformComponent;
        let uuid: UuidComponent;

        const offset = GameLevel.worldSize - 16;

        const entities = this.query.entities;
        for (let i = 0; i < entities.length; i++) {
            body = entities[i].get(SolidBodyComponent);

            motion = entities[i].get(MotionComponent);
            transform = entities[i].get(TransformComponent);
            uuid = entities[i].get(UuidComponent);

            const inBounds = GameLevel.inBounds(transform.pos, -8);

            if (body.nextVel === null && inBounds) {
                continue;
            }

            if (body.nextVel !== null) {
                motion.vel = body.nextVel;
                body.nextVel = null;
            }

            if (!inBounds) {
                transform.pos.x = Math.max(-offset, Math.min(transform.pos.x, offset));
                transform.pos.y = Math.max(-offset, Math.min(transform.pos.y, offset));
            }

            const isPlayer = entities[i].hasTag("player");

            netClient.send({
                type: isPlayer ? "player" : "entity",
                action: "update",
                target: uuid.uuid,
                time: netClient.getTime(),
                data: {
                    pos: vecToArray(transform.pos, 2),
                    vel: vecToArray(motion.vel, 2),
                    rotation: round(transform.rotation, 2),
                },
            });
        }
    }
}
