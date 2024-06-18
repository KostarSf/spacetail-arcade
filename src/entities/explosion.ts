import { ActionsComponent, Entity, GraphicsComponent, TransformComponent, Vector } from "excalibur";
import { Animations } from "~/resources";

export class Explosion extends Entity {
    constructor(pos: Vector) {
        const transform = new TransformComponent();
        transform.pos = pos;

        super([transform, new GraphicsComponent(), new ActionsComponent()]);
    }

    onInitialize(): void {
        const actions = this.get(ActionsComponent);
        const graphics = this.get(GraphicsComponent);

        const animation = Animations.Explosion;
        animation.events.on("end", () => {
            actions.clearActions();
            this.kill();
        });

        graphics.use(animation);
        actions.delay(1500).die();
    }
}
