import {
    Component,
    MotionComponent, TransformComponent,
    Vector
} from "excalibur";


export class ShipComponent extends Component {
    accelerated: boolean = false;

    rotationTarget: Vector | null = null;

    readonly dependencies = [TransformComponent, MotionComponent];

    constructor() {
        super();
    }
}
