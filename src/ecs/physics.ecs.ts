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
import { netClient } from "../network/NetClient";
import { round, vecToArray } from "../utils/math";
import { UuidComponent } from "./UuidComponent";

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

    onAdd(owner: Entity<BodyComponent | ColliderComponent>): void {
        owner.get(BodyComponent).collisionType = CollisionType.Passive;

        owner.get(ColliderComponent).events.on("precollision", (evt: any) => {
            const precollision = evt as PreCollisionEvent<Collider>;

            if (!precollision.other.owner.has(SolidBodyComponent)) {
                return;
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

        const entities = this.query.entities;
        for (let i = 0; i < entities.length; i++) {
            body = entities[i].get(SolidBodyComponent);

            if (body.nextVel === null) {
                continue;
            }

            motion = entities[i].get(MotionComponent);
            transform = entities[i].get(TransformComponent);
            uuid = entities[i].get(UuidComponent);

            motion.vel = body.nextVel;
            body.nextVel = null;

            const isPlayer = entities[i].hasTag("player");

            netClient.send({
                type: isPlayer ? "player" : "entity",
                action: "update",
                target: uuid.uuid,
                time: Date.now(),
                data: {
                    pos: vecToArray(transform.pos, 2),
                    vel: vecToArray(motion.vel, 2),
                    rotation: round(transform.rotation, 2),
                },
            });
        }
    }
}
