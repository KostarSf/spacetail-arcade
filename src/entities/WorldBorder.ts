import {
    Actor,
    CollisionType,
    Color,
    CompositeCollider,
    Engine,
    GraphicsGroup,
    Line,
    Shape,
    vec,
    Vector,
} from "excalibur";

export class WorldBorder extends Actor {
    public static readonly Tag = "worldborder";

    public readonly worldSize: number;

    constructor(worldSize: number) {
        super({
            collisionType: CollisionType.Fixed,
            collider: new CompositeCollider([
                Shape.Edge(vec(-worldSize, worldSize), vec(worldSize, worldSize)),
                Shape.Edge(vec(-worldSize, -worldSize), vec(worldSize, -worldSize)),
                Shape.Edge(vec(-worldSize, -worldSize), vec(-worldSize, worldSize)),
                Shape.Edge(vec(worldSize, -worldSize), vec(worldSize, worldSize)),
            ]),
        });

        this.addTag(WorldBorder.Tag);

        this.worldSize = worldSize;
    }

    onInitialize(_engine: Engine): void {
        const size = this.worldSize;

        const borders = [
            new Line({
                start: vec(-size, size),
                end: vec(size, size),
                color: Color.Red,
                thickness: 3,
            }),
            new Line({
                start: vec(-size, -size),
                end: vec(size, -size),
                color: Color.Red,
                thickness: 3,
            }),
            new Line({
                start: vec(-size, -size),
                end: vec(-size, size),
                color: Color.Red,
                thickness: 3,
            }),
            new Line({
                start: vec(size, -size),
                end: vec(size, size),
                color: Color.Red,
                thickness: 3,
            }),
        ];

        const bordersGroup = new GraphicsGroup({
            members: borders.map((border) => ({
                graphic: border,
                offset: Vector.One.scale(size),
            })),
        });

        this.graphics.add(bordersGroup);
    }

    public processCollision(pos: Vector, vel: Vector) {
        const left = pos.x <= -this.worldSize;
        const right = pos.x >= this.worldSize;
        const top = pos.y >= this.worldSize;
        const bottom = pos.y <= -this.worldSize;

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
            Math.max(-this.worldSize, Math.min(pos.x, this.worldSize)),
            Math.max(-this.worldSize, Math.min(pos.y, this.worldSize))
        );

        return { pos, vel };
    }
}
