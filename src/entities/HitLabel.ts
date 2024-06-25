import {
    ActionsComponent,
    Color,
    Engine,
    Entity,
    Font,
    GraphicsComponent,
    GraphicsGroup,
    ImageFiltering,
    MotionComponent,
    Text,
    TransformComponent,
    Vector,
    vec,
} from "excalibur";
import { Pallete } from "~/constants";
import { linInt, round } from "~/utils/math";

export interface HitLabelOptions {
    pos: Vector;
    value: number;
    round?: number;
    vel?: Vector;
}

export class HitLabel extends Entity {
    private value: number;

    private timeToLive = 700; //ms
    private liveFor = 0;

    constructor(options: HitLabelOptions) {
        const transform = new TransformComponent();
        const motion = new MotionComponent();

        transform.pos = options.pos;
        motion.vel = vec(0, -30).addEqual(options.vel ?? Vector.Zero);

        super({
            components: [transform, motion, new GraphicsComponent(), new ActionsComponent()],
            name: "Hit Label",
        });

        this.value = options.round
            ? round(options.value, options.round)
            : Math.round(options.value);
    }

    onInitialize(_engine: Engine): void {
        const isHeal = this.value > 0;

        const text = `${isHeal ? "+" : ""}${this.value}`;
        const font = new Font({
            family: "monospace",
            filtering: ImageFiltering.Pixel,
            size: 12,
            bold: true,
        });

        this.get(GraphicsComponent).use(
            new GraphicsGroup({
                members: [
                    {
                        graphic: new Text({ text, color: Pallete.gray900, font }),
                        offset: vec(1, 1),
                    },
                    {
                        graphic: new Text({ text, color: Color.White, font }),
                        offset: Vector.Zero,
                    },
                ],
            })
        );

        this.get(ActionsComponent).delay(this.timeToLive).die();
    }

    onPostUpdate(_engine: Engine, _delta: number): void {
        this.get(GraphicsComponent).opacity = linInt(this.liveFor, 0, this.timeToLive, 1, 0);
        this.liveFor += _delta;
    }
}
