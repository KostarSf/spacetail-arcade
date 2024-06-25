import {
    Camera,
    Color,
    Entity,
    ExcaliburGraphicsContext,
    TransformComponent,
    vec,
} from "excalibur";
import { rand } from "~/utils/math";

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
