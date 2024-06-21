import {
    CollisionType,
    Color,
    Engine,
    GraphicsGroup,
    PointerButton,
    PolygonCollider,
    Vector,
    vec,
} from "excalibur";
import { NetBodyComponent } from "~/ecs/physics.ecs";
import { ShadowedSprite } from "~/graphics/ShadowedSprite";
import { NetActor } from "~/network/NetActor";
import { NetEntityType, SerializedVector } from "~/network/types";
import { Resources } from "~/resources";
import { round, vecToArray } from "~/utils/math";

export interface PlayerState {
    pos: SerializedVector;
    vel: SerializedVector;
    accelerated: boolean;
    rotation: number;
}

export interface PlayerOptions {
    uuid?: string;
    isReplica?: boolean;

    pos?: Vector;
}

export class Player extends NetActor<PlayerState> {
    public static readonly Tag = "Player";

    public readonly type: NetEntityType = NetEntityType.Player;

    public accelerated = false;

    constructor(options?: PlayerOptions) {
        super({
            name: "Player",
            uuid: options?.uuid,
            isReplica: options?.isReplica,

            pos: options?.pos,
            collider: new PolygonCollider({
                points: [vec(-10, -10), vec(15, 0), vec(-10, 10)],
            }),
            collisionType: CollisionType.Passive,
        });

        this.addComponent(new NetBodyComponent({ mass: 10 }));
        this.addTag(Player.Tag);
    }

    onInitialize(engine: Engine<any>): void {
        this.graphics.add(
            new GraphicsGroup({
                members: [
                    {
                        graphic: ShadowedSprite.from(
                            this.isReplica ? Resources.Pirate : Resources.Player,
                            this.isReplica ? Color.fromHex("#aaaaaa") : undefined
                        ),
                        offset: Vector.Zero,
                    },
                ],
            })
        );

        if (this.isReplica) {
            return;
        }

        engine.input.pointers.primary.on("down", (evt) => {
            let accelerated = this.accelerated;

            if (evt.button === PointerButton.Right) {
                accelerated = true;
            }

            if (accelerated !== this.accelerated) {
                this.accelerated = accelerated;
                this.markStale();
            }
        });
        engine.input.pointers.primary.on("up", (evt) => {
            let accelerated = this.accelerated;

            if (evt.button === PointerButton.Right) {
                accelerated = false;
            }

            if (accelerated !== this.accelerated) {
                this.accelerated = accelerated;
                this.markStale();
            }
        });
    }

    onPostUpdate(engine: Engine<any>, delta: number): void {
        if (!this.isReplica) {
            const cursorScreenPos = engine.input.pointers.primary.lastScreenPos;
            const rotationTarget = engine.screenToWorldCoordinates(cursorScreenPos);
            const newRotation = round(rotationTarget.sub(this.pos).toAngle(), 2);

            if (newRotation !== this.rotation) {
                this.rotation = newRotation;
                this.markStale();
            }
        }

        this.vel = this.applyMovement(delta / 1000);
    }

    private applyMovement(delta: number) {
        if (this.accelerated) {
            return this.vel.add(Vector.fromAngle(this.rotation).scale(150 * delta));
        }

        const movementDecay = Math.pow(0.9, delta);
        return this.vel.scale(movementDecay);
    }

    public serializeState(): PlayerState {
        return {
            pos: vecToArray(this.pos, 2),
            vel: vecToArray(this.vel, 2),
            rotation: round(this.rotation, 2),
            accelerated: this.accelerated,
        };
    }

    public updateState(state: PlayerState, latency: number): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;
        this.accelerated = state.accelerated;

        const delta = latency / 1000;

        const newVel = this.applyMovement(delta);
        const avgVel = this.vel.add(newVel).scaleEqual(0.5);

        this.pos.addEqual(avgVel.scaleEqual(delta));
        this.vel = newVel;
    }
}
