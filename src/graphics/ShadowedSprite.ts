import {
    Color,
    ExcaliburGraphicsContext,
    GraphicOptions,
    ImageSource,
    Logger,
    Sprite,
    SpriteOptions,
    Vector,
    vec,
} from "excalibur";

export interface ShadowedSpriteOptions {
    /** Default is image from sprite */
    shadowImage?: ImageSource;

    /** Default is `vec(0, 4)` */
    shadowOffset?: Vector;

    /** Default is `0.95` */
    shadowScale?: number;

    /** Default is `Color.fromRGB(50, 50, 50)` */
    shadowTint?: Color;

    /** Default is `1` */
    shadowOpacity?: number;

    /** Default is `vec(1, 1)` */
    shadowOrigin?: Vector;
}

export class ShadowedSprite extends Sprite {
    private _shadowLogger = Logger.getInstance();

    public shadowImage: ImageSource;
    public shadowOffset: Vector;
    public shadowScale: number;
    public shadowTint: Color | null;
    public shadowOpacity: number;
    public shadowOrigin: Vector;

    public static from(image: ImageSource): ShadowedSprite {
        return new ShadowedSprite({ image });
    }

    constructor(options: ShadowedSpriteOptions & GraphicOptions & SpriteOptions) {
        super(options);
        this.shadowImage = options.shadowImage ?? options.image;
        this.shadowOffset = options.shadowOffset ?? vec(0, 4);
        this.shadowScale = options.shadowScale ?? 0.95;
        this.shadowTint = options.shadowTint ?? Color.fromRGB(50, 50, 50);
        this.shadowOpacity = options.shadowOpacity ?? 1;
        this.shadowOrigin = options.shadowOrigin ?? vec(1, 1);
    }

    private _logShadowNotLoadedWarning = false;
    public override _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
        if (!this.shadowImage.isLoaded() && !this._logShadowNotLoadedWarning) {
            this._shadowLogger.warn(
                `ImageSource ${this.shadowImage.path}` +
                    ` is not yet loaded and won't be drawn. Please call .load() or include in a Loader.\n\n` +
                    `Read https://excaliburjs.com/docs/imagesource for more information.`
            );
            this._logShadowNotLoadedWarning = true;
        }

        if (this.shadowImage.isLoaded()) {
            ex.save();

            if (this.shadowTint) {
                ex.tint = this.shadowTint;
            }

            const rotation = ex.getTransform().getRotation();
            const rotatedOffset = this.shadowOffset.rotate(-rotation, this.shadowOrigin);

            ex.opacity *= this.shadowOpacity;
            ex.scale(this.shadowScale, this.shadowScale);

            ex.drawImage(
                this.shadowImage.image,
                this.sourceView.x,
                this.sourceView.y,
                this.sourceView.width,
                this.sourceView.height,
                x + rotatedOffset.x,
                y + rotatedOffset.y,
                this.destSize.width,
                this.destSize.height
            );

            ex.restore();
        }

        super._drawImage(ex, x, y);
    }
}
