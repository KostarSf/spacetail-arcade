import {
    BodyComponent,
    Collider,
    ColliderComponent,
    CollisionType,
    Component,
    Entity,
    MotionComponent,
    PreCollisionEvent,
    TransformComponent,
} from "excalibur";

export interface SolidBodyOptions {
    mass: number;
}

export class SolidBodyComponent extends Component {
    public mass: number;

    readonly dependencies = [MotionComponent, BodyComponent, ColliderComponent];

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

            const thisBody = precollision.target.owner.get(SolidBodyComponent);
            const thisTransform = precollision.target.owner.get(TransformComponent);
            const thisMotion = precollision.target.owner.get(MotionComponent);

            const otherBody = precollision.other.owner.get(SolidBodyComponent);
            const otherTransform = precollision.other.owner.get(TransformComponent);
            const otherMotion = precollision.other.owner.get(MotionComponent);

            const collisionDirection = otherTransform.pos.sub(thisTransform.pos);
            if (collisionDirection.squareDistance() === 0) {
                return;
            }

            const collisionNormal = collisionDirection.normalize();

            const relativeVelocity = otherMotion.vel.sub(thisMotion.vel);
            const velocityAlongNormal = relativeVelocity.dot(collisionNormal);

            if (velocityAlongNormal > 0) {
                return;
            }

            const restitution = 0.5;
            const impulseScalar =
                (-(1 + restitution) * velocityAlongNormal) /
                (1 / thisBody.mass + 1 / otherBody.mass);

            const impulse = collisionNormal.scale(impulseScalar);
            thisMotion.vel = thisMotion.vel.sub(impulse.scale(1 / thisBody.mass));
        });
    }
}
