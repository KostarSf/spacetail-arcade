import {
    Engine,
    Entity,
    GraphicsComponent,
    ImageSource,
    TransformComponent,
    Vector,
} from "excalibur";

export interface DecalOptions {
    image: ImageSource;
    pos: Vector;
}

export class Decal extends Entity {
    private image: ImageSource;

    constructor(options: DecalOptions) {
        const transform = new TransformComponent();
        transform.pos = options.pos;

        const graphics = new GraphicsComponent();

        super([transform, graphics]);

        this.image = options.image;
    }

    onInitialize(_engine: Engine): void {
        this.get(GraphicsComponent).add(this.image.toSprite());
    }
}
