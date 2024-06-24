import { Actor, Camera, Color, ExcaliburGraphicsContext, vec } from "excalibur";
import { rand } from "~/utils/math";

const glareColor = Color.White;

export function drawGlare(
    ex: ExcaliburGraphicsContext,
    actor: Actor,
    camera: Camera,
    initialScale: number,
    multiplier: number = 1
) {
    glareColor.a = rand.floating(0.2, 0.95);

    const glareSize =
        initialScale + camera.pos.sub(actor.pos).squareDistance() * (0.00001 * multiplier);
    ex.drawLine(
        vec(-glareSize - 1, 0.5).rotate(-actor.rotation),
        vec(glareSize - 1, 0.5).rotate(-actor.rotation),
        glareColor,
        1
    );
    ex.drawLine(
        vec(-glareSize + 1, -0.5).rotate(-actor.rotation),
        vec(glareSize + 1, -0.5).rotate(-actor.rotation),
        glareColor,
        1
    );
}
