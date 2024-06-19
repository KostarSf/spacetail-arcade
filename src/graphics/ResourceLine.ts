import { Color, ExcaliburGraphicsContext, Line, Vector, vec } from "excalibur";
import { linInt } from "~/utils/math";

export interface ResourceLineOptions {
    pos: Vector;
    lineWidth: number;
    minValue: number;
    maxValue: number;
    valueFn: () => number;
    color: Color | (() => Color);
    rotationFn: () => number;
    hideOnMaxValue?: boolean;
}

export class ResourceLine extends Line {
    private pos: Vector;
    private lineWidth: number;
    private minValue: number;
    private maxValue: number;
    private valueFn: () => number;
    private colorFn: (() => Color) | null;
    private rotationFn: () => number;
    private shadowColor: Color;
    private hideOnMaxValue: boolean;

    constructor(options: ResourceLineOptions) {
        const colorFn = typeof options.color === "function" ? options.color : null;

        super({
            start: options.pos,
            end: options.pos.add(vec(0, options.lineWidth)),
            color: colorFn?.() ?? (options.color as Color),
            thickness: 3,
        });

        this.pos = options.pos;
        this.lineWidth = options.lineWidth;
        this.minValue = options.minValue;
        this.maxValue = options.maxValue;
        this.valueFn = options.valueFn;
        this.colorFn = colorFn;
        this.rotationFn = options.rotationFn;
        this.shadowColor = Color.fromRGB(50, 50, 50);
        this.hideOnMaxValue = options.hideOnMaxValue ?? false;
    }

    protected _preDraw(ex: ExcaliburGraphicsContext, x: number, y: number): void {
        if (!this.hideOnMaxValue || this.valueFn() < this.maxValue) {
            this.rotation = this.rotationFn();
            const scale = linInt(this.valueFn(), this.minValue, this.maxValue);
            this.end.y = this.pos.y + this.lineWidth * scale;
        }

        super._preDraw(ex, x, y);
    }

    protected _drawImage(ctx: ExcaliburGraphicsContext, _x: number, _y: number): void {
        if (this.hideOnMaxValue && this.valueFn() >= this.maxValue) {
            return;
        }

        const color = this.colorFn?.() ?? this.color;
        const shadowOffset = vec(-1, 1);
        ctx.drawLine(
            this.start.add(shadowOffset),
            this.start.add(vec(0, this.lineWidth)).add(shadowOffset),
            this.shadowColor,
            this.thickness
        );
        ctx.drawLine(this.start, this.end, color, this.thickness);
    }
}
