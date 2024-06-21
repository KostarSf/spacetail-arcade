import {
    Engine,
    Entity,
    GraphicsComponent,
    ImageSource,
    ParallaxComponent,
    TransformComponent,
    Vector,
    vec,
} from "excalibur";

export interface DecalOptions {
    image: ImageSource;
    pos: Vector;
    parallax?: Vector | number;
    /** `[0.0 - 2.0]`. 0 - отдаляется при отдалении камеры. 1 - сохраняет относительный масштаб. 2 - приближается при отдалении камеры */
    zoomResist?: number;
    z?: number;
}

export class Decal extends Entity {
    private image: ImageSource;
    private zoomResist: number;

    constructor(options: DecalOptions) {
        const transform = new TransformComponent();
        transform.pos = options.pos;
        transform.z = options.z ?? transform.z;

        const graphics = new GraphicsComponent();

        super([transform, graphics]);

        if (options.parallax) {
            const factor =
                typeof options.parallax === "number"
                    ? vec(options.parallax, options.parallax)
                    : options.parallax;
            this.addComponent(new ParallaxComponent(factor));
        }

        this.image = options.image;
        this.zoomResist = options.zoomResist ?? 0;
    }

    onInitialize(_engine: Engine): void {
        this.graphics.add(this.image.toSprite());
    }

    update(engine: Engine, _delta: number): void {
        const graphics = this.graphics.current;

        if (!graphics) {
            return;
        }

        const coef = this.zoomResist;

        const scale = 1 + (coef - engine.currentScene.camera.zoom * coef);
        graphics.scale.setTo(scale, scale);
    }

    get graphics() {
        return this.get(GraphicsComponent);
    }
}
