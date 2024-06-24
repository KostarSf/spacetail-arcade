import {
    BodyComponent,
    Collider,
    ColliderComponent,
    CollisionType,
    Component,
    MotionComponent,
    PreCollisionEvent,
    Query,
    System,
    SystemPriority,
    SystemType,
    TransformComponent,
    Vector,
    World,
} from "excalibur";
import { XpOrb } from "~/actors/XpOrb";
import { Explosion } from "~/entities/Explosion";
import { WorldBorder } from "~/entities/WorldBorder";
import { DamageAction } from "~/network/events/actions/DamageAction";
import { ReceiverType } from "~/network/events/types";
import { NetActor } from "~/network/NetActor";
import { NetStateComponent } from "~/network/NetStateComponent";
import { StatsComponent } from "./stats.ecs";

export interface NetBodyOptions {
    mass: number;
}

export class NetBodyComponent extends Component {
    public mass: number;

    public nextVel: Vector | null = null;

    get pos() {
        return this.owner?.get(TransformComponent).pos!;
    }

    get vel() {
        return this.owner?.get(MotionComponent).vel!;
    }

    readonly dependencies = [MotionComponent, BodyComponent, ColliderComponent, NetStateComponent];

    constructor(options: NetBodyOptions) {
        super();

        this.mass = options.mass;
    }

    onAdd(owner: NetActor): void {
        owner.get(BodyComponent).collisionType = CollisionType.Passive;

        owner.get(ColliderComponent).events.on("precollision", (evt: any) => {
            const precollision = evt as PreCollisionEvent<Collider>;

            const target = precollision.target.owner as NetActor;
            const other = precollision.other.owner as NetActor | WorldBorder;

            const thisBody = target.get(NetBodyComponent);

            if (other.hasTag(WorldBorder.Tag)) {
                const border = other as WorldBorder;

                const { pos, vel } = border.processCollision(thisBody.pos, thisBody.vel);

                thisBody.pos.setTo(pos.x, pos.y);
                thisBody.nextVel = vel;

                return;
            }

            if (!other.has(NetBodyComponent)) {
                return;
            }

            if (other.hasTag(XpOrb.Tag)) {
                return;
            }

            const otherBody = other.get(NetBodyComponent);

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

            if (target.hasTag(XpOrb.Tag) || other.hasTag(XpOrb.Tag)) {
                return;
            }

            if (!target.isReplica) {
                const threshhold = Math.max(0, relativeVelocity.distance() - 50);
                if (threshhold > 0 && target.has(StatsComponent)) {
                    const stats = target.get(StatsComponent);
                    const otherStats = other.get(StatsComponent) ?? stats;

                    const alpha = 0.03;
                    const massRatio = thisBody.mass / otherBody.mass;
                    const massInfluence = 1 + Math.tanh(alpha * (1 - massRatio));
                    (target as NetActor).sendAction(
                        new DamageAction({
                            damage:
                                0.5 *
                                (otherStats.hardness / stats.hardness) *
                                threshhold *
                                massInfluence,
                            armorDeflection: 0.5,
                            healthDeflection: 1,
                        }),
                        { self: false, receiver: ReceiverType.AllClients }
                    );
                }
            }
        });

        owner.on("kill", () => {
            if (owner.hasTag(XpOrb.Tag)) {
                return;
            }

            const pos = owner.get(TransformComponent).pos;
            owner.scene?.add(new Explosion(pos));
        });
    }
}

export class NetPhysicsSystem extends System {
    public systemType: SystemType = SystemType.Update;
    public priority: number = SystemPriority.Average;

    private query: Query<
        typeof NetBodyComponent | typeof MotionComponent | typeof TransformComponent
    >;

    constructor(world: World) {
        super();
        this.query = world.query([NetBodyComponent]);
    }

    update(_elapsedMs: number): void {
        let body: NetBodyComponent;
        let motion: MotionComponent;

        const entities = this.query.entities as NetActor[];
        for (let i = 0; i < entities.length; i++) {
            body = entities[i].get(NetBodyComponent);
            motion = entities[i].get(MotionComponent);

            if (body.nextVel !== null) {
                motion.vel = body.nextVel;
                body.nextVel = null;
                entities[i].markStale();
            }
        }
    }
}
