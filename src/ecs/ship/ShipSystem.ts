import {
    MotionComponent,
    Query,
    System,
    SystemPriority,
    SystemType,
    TransformComponent,
    Vector,
    World,
} from "excalibur";
import { ShipComponent } from "./ShipComponent";

export class ShipSystem extends System {
    public systemType: SystemType = SystemType.Update;
    public priority: number = SystemPriority.Average;

    private query: Query<typeof ShipComponent | typeof TransformComponent | typeof MotionComponent>;

    constructor(world: World) {
        super();
        this.query = world.query([ShipComponent]);
    }

    update(elapsedMs: number): void {
        let transform: TransformComponent;
        let motion: MotionComponent;
        let ship: ShipComponent;

        const delta = elapsedMs / 1000;
        const decay = Math.pow(0.9, delta);

        const entities = this.query.entities;
        for (let i = 0; i < entities.length; i++) {
            transform = entities[i].get(TransformComponent);
            motion = entities[i].get(MotionComponent);
            ship = entities[i].get(ShipComponent);

            if (ship.rotationTarget) {
                transform.rotation = ship.rotationTarget.sub(transform.globalPos).toAngle();
            }

            if (ship.accelerated) {
                motion.vel.addEqual(Vector.fromAngle(transform.rotation).scale(300 * delta));
            }

            motion.vel.scaleEqual(decay);
        }
    }
}
