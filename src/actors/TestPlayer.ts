import { Color, Engine, Keys, Vector, vec } from "excalibur";
import { NetActor } from "~/network/NetActor";
import { NetEntityType, SerializedVector } from "~/network/types";
import { vecToArray } from "~/utils/math";

export interface TestPlayerState {
    pos: SerializedVector;
    direction: SerializedVector;
    isMoving: boolean;
}

export interface TestPlayerOptions {
    pos: Vector;
}

export class TestPlayer extends NetActor<TestPlayerState> {
    public isMoving = false;
    public direction = vec(0, 0);

    private speed = 200;

    public type: NetEntityType = NetEntityType.TestPlayer;

    constructor(options?: TestPlayerOptions) {
        super({
            pos: options?.pos,
            width: 20,
            height: 20,
            color: Color.White,
            x: 200,
            y: 200,
        });
    }

    onInitialize(engine: Engine<any>): void {
        this.color = this.isReplica ? Color.Red : Color.White;
    }

    public serializeState(): TestPlayerState {
        return {
            isMoving: this.isMoving,
            pos: vecToArray(this.pos, 2),
            direction: vecToArray(this.direction, 2),
        };
    }

    public updateState(state: TestPlayerState, latency: number): void {
        this.pos = vec(...state.pos);
        this.direction = vec(...state.direction);
        this.isMoving = state.isMoving;

        this.vel = this.direction.scale(this.speed)
        this.pos.addEqual(this.vel.scale(latency / 1000))
    }

    onPostUpdate(engine: Engine<any>, deltaMs: number): void {
        if (!this.isReplica) {
            const left = engine.input.keyboard.isHeld(Keys.A) ? -1 : 0;
            const right = engine.input.keyboard.isHeld(Keys.D) ? 1 : 0;
            const top = engine.input.keyboard.isHeld(Keys.W) ? -1 : 0;
            const bottom = engine.input.keyboard.isHeld(Keys.S) ? 1 : 0;

            const newDirection = vec(left + right, top + bottom);
            if (newDirection.x !== this.direction.x || newDirection.y !== this.direction.y) {
                this.markStale();
            }

            this.direction = newDirection;
        }

        const speed = this.speed;

        this.vel = this.direction.scale(speed);
    }
}
