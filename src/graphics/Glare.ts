import {
    Camera,
    Color,
    Entity,
    ExcaliburGraphicsContext,
    Sprite,
    TransformComponent,
    vec,
    Vector,
} from "excalibur";
import { Resources } from "~/resources";
import { rand } from "~/utils/math";

export interface GlareOptions {
    rotationFn: () => number;
    scale?: Vector;
}

export class Glare extends Sprite {
    private rotationFn: () => number;

    constructor(options: GlareOptions) {
        super({
            image: Resources.Glare,
            scale: options.scale,
        });

        this.rotationFn = options.rotationFn;
    }

    protected _preDraw(ex: ExcaliburGraphicsContext, x: number, y: number): void {
        super._preDraw(ex, x, y);
        this.rotation = this.rotationFn();
    }
}

const glareColor = Color.White;

export function drawGlare(
    ex: ExcaliburGraphicsContext,
    actor: Entity,
    camera: Camera,
    initialScale: number,
    multiplier: number = 1
) {
    const transform = actor.get(TransformComponent);
    glareColor.a = rand.floating(0.2, 0.95);

    const glareSize =
        initialScale + camera.pos.sub(transform.pos).squareDistance() * (0.00001 * multiplier);
    ex.drawLine(
        vec(-glareSize - 1, 0.5).rotate(-transform.rotation),
        vec(glareSize - 1, 0.5).rotate(-transform.rotation),
        glareColor,
        1
    );
    ex.drawLine(
        vec(-glareSize + 1, -0.5).rotate(-transform.rotation),
        vec(glareSize + 1, -0.5).rotate(-transform.rotation),
        glareColor,
        1
    );
}
