import {
    Actor,
    CollisionType,
    CompositeCollider,
    Engine,
    GraphicsGroup,
    Line,
    Shape,
    vec,
    Vector,
} from "excalibur";
import { Pallete } from "~/constants";

export interface WorldBorderOptions {
    worldSize: number;
    solidBorders?: boolean;
}

export class WorldBorder extends Actor {
    public static readonly Tag = "worldborder";

    public readonly worldSize: number;
    public readonly halfSize: number;

    constructor(options: WorldBorderOptions) {
        const halfSize = options.worldSize / 2;

        const collider = options.solidBorders
            ? new CompositeCollider([
                  Shape.Edge(vec(-halfSize, halfSize), vec(halfSize, halfSize)),
                  Shape.Edge(vec(-halfSize, -halfSize), vec(halfSize, -halfSize)),
                  Shape.Edge(vec(-halfSize, -halfSize), vec(-halfSize, halfSize)),
                  Shape.Edge(vec(halfSize, -halfSize), vec(halfSize, halfSize)),
              ])
            : undefined;

        super({
            collisionType: collider ? CollisionType.Fixed : undefined,
            collider: collider,
        });

        this.addTag(WorldBorder.Tag);

        this.worldSize = options.worldSize;
        this.halfSize = halfSize;
    }

    onInitialize(_engine: Engine): void {
        const halfSize = this.halfSize;

        const borders = [
            new Line({
                start: vec(-halfSize, halfSize),
                end: vec(halfSize, halfSize),
                color: Pallete.gray800,
                thickness: 3,
            }),
            new Line({
                start: vec(-halfSize, -halfSize),
                end: vec(halfSize, -halfSize),
                color: Pallete.gray800,
                thickness: 3,
            }),
            new Line({
                start: vec(-halfSize, -halfSize),
                end: vec(-halfSize, halfSize),
                color: Pallete.gray800,
                thickness: 3,
            }),
            new Line({
                start: vec(halfSize, -halfSize),
                end: vec(halfSize, halfSize),
                color: Pallete.gray800,
                thickness: 3,
            }),
        ];

        const bordersGroup = new GraphicsGroup({
            members: borders.map((border) => ({
                graphic: border,
                offset: Vector.One.scale(halfSize),
            })),
        });

        this.graphics.add(bordersGroup);
    }

    public processCollision(pos: Vector, vel: Vector) {
        const left = pos.x <= -this.halfSize;
        const right = pos.x >= this.halfSize;
        const top = pos.y >= this.halfSize;
        const bottom = pos.y <= -this.halfSize;

        let hit = false;

        if ((left && vel.x < 0) || (right && vel.x > 0)) {
            vel = vel.scale(vec(-1, 1));
            hit = true;
        }

        if ((top && vel.y > 0) || (bottom && vel.y < 0)) {
            vel = vel.scale(vec(1, -1));
            hit = true;
        }

        if (hit) {
            vel = vel.scale(0.3);
        }

        pos = vec(
            Math.max(-this.halfSize, Math.min(pos.x, this.halfSize)),
            Math.max(-this.halfSize, Math.min(pos.y, this.halfSize))
        );

        return { pos, vel };
    }
}
