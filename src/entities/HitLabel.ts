import {
    ActionsComponent,
    Color,
    Engine,
    Entity,
    Font,
    GraphicsComponent,
    ImageFiltering,
    MotionComponent,
    Text,
    TransformComponent,
    Vector,
    vec,
} from "excalibur";
import { linInt } from "~/utils/math";

export interface HitLabelOptions {
    pos: Vector;
    value: number;
}

export class HitLabel extends Entity {
    private value: number;

    private timeToLive = 700; //ms
    private liveFor = 0;

    constructor(options: HitLabelOptions) {
        const transform = new TransformComponent();
        const motion = new MotionComponent();

        transform.pos = options.pos;
        motion.vel = vec(0, -30);

        super({
            components: [transform, motion, new GraphicsComponent(), new ActionsComponent()],
            name: "Hit Label",
        });

        this.value = options.value;
    }

    onInitialize(_engine: Engine): void {
        const isHeal = this.value > 0;

        this.get(GraphicsComponent).use(
            new Text({
                text: `${isHeal ? "+" : ""}${this.value}`,
                color: isHeal ? Color.Green : Color.Yellow,
                font: new Font({
                    family: "monospace",
                    filtering: ImageFiltering.Pixel,
                    size: 12,
                    bold: true,
                }),
            })
        );

        this.get(ActionsComponent).delay(this.timeToLive).die();
    }

    onPostUpdate(_engine: Engine, _delta: number): void {
        this.get(GraphicsComponent).opacity = linInt(this.liveFor, 0, this.timeToLive, 1, 0);
        this.liveFor += _delta;
    }
}
