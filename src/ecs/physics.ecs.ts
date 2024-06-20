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
} from "excalibur";
import { Explosion } from "~/entities/Explosion";
import { NetComponent } from "~/network/NetComponent";
import { HealthComponent } from "./health.ecs";

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

    readonly dependencies = [MotionComponent, BodyComponent, ColliderComponent, NetComponent];

    constructor(options: NetBodyOptions) {
        super();

        this.mass = options.mass;
    }

    onAdd(
        owner: Entity<
            BodyComponent | ColliderComponent | TransformComponent | NetBodyComponent | NetComponent
        >
    ): void {
        owner.get(BodyComponent).collisionType = CollisionType.Passive;

        owner.get(ColliderComponent).events.on("precollision", (evt: any) => {
            const precollision = evt as PreCollisionEvent<Collider>;

            const target = precollision.target.owner;
            const other = precollision.other.owner;
            if (!other.has(NetBodyComponent)) {
                return;
            }

            const thisBody = target.get(NetBodyComponent);
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
        });

        owner.on("kill", () => {
            const pos = owner.get(TransformComponent).pos;
            owner.scene?.add(new Explosion(pos));
        });

        owner.on("initialize", () => {
            const motion = owner.get(MotionComponent)!;
            const health = owner.get(HealthComponent);
            const body = owner.get(NetBodyComponent);

            health?.events.on("damage", (evt) => {
                if (!evt.damager) {
                    return;
                }

                motion.vel.addEqual(
                    evt.damager.vel.normalize().scale((evt.amount * 5) / body.mass)
                );
                owner.get(NetComponent).actor.markStale();
            });
        });
    }
}

export class NetPhysicsSystem extends System {
    public systemType: SystemType = SystemType.Update;
    public priority: number = SystemPriority.Average;

    private query: Query<
        | typeof NetComponent
        | typeof NetBodyComponent
        | typeof MotionComponent
        | typeof TransformComponent
    >;

    constructor(world: World) {
        super();
        this.query = world.query([NetBodyComponent]);
    }

    update(_elapsedMs: number): void {
        let body: NetBodyComponent;
        let motion: MotionComponent;
        let net: NetComponent;

        const entities = this.query.entities;
        for (let i = 0; i < entities.length; i++) {
            body = entities[i].get(NetBodyComponent);
            motion = entities[i].get(MotionComponent);
            net = entities[i].get(NetComponent);

            if (body.nextVel !== null) {
                motion.vel = body.nextVel;
                body.nextVel = null;
                net.actor.markStale();
            }
        }
    }
}
