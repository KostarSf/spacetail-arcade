import {
    Animation,
    CollisionType,
    Color,
    Engine,
    GraphicsGroup,
    Keys,
    PointerButton,
    PolygonCollider,
    TwoPI,
    Vector,
    vec,
} from "excalibur";
import { NetBodyComponent } from "~/ecs/physics.ecs";
import { StatsComponent } from "~/ecs/stats.ecs";
import { ResourceLine } from "~/graphics/ResourceLine";
import { ShadowedSprite } from "~/graphics/ShadowedSprite";
import { NetActor } from "~/network/NetActor";
import { SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { Animations, Resources } from "~/resources";
import { round, vecToArray } from "~/utils/math";
import { Bullet } from "./Bullet";

export interface PlayerState extends SerializableObject {
    pos: SerializedVector;
    vel: SerializedVector;
    accelerated: boolean;
    rotation: number;
    health: number;
    power: number;
}

export interface PlayerOptions {
    uuid?: string;
    isReplica?: boolean;

    pos?: Vector;
}

export class Player extends NetActor<PlayerState> {
    public static readonly Tag = "Player";

    public readonly type: ActorType = ActorType.Player;

    public accelerated = false;

    private shipSprite!: ShadowedSprite;
    private jetGraphics!: Animation;

    private mouseControll = false;

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

        this.addTag(Player.Tag);

        this.addComponent(new StatsComponent({ health: 40, power: 30, powerRecoverySpeed: 10 }));
        this.addComponent(new NetBodyComponent({ mass: 10 }));
    }

    get stats() {
        return this.get(StatsComponent);
    }

    onInitialize(engine: Engine<any>): void {
        this.shipSprite = ShadowedSprite.from(
            this.isReplica ? Resources.Pirate : Resources.Player,
            this.isReplica ? Color.fromHex("#aaaaaa") : undefined
        );
        this.jetGraphics = Animations.JetStream;

        this.graphics.add(
            new GraphicsGroup({
                members: [
                    { graphic: this.shipSprite, offset: Vector.Zero },
                    { graphic: this.jetGraphics, offset: Vector.Zero },
                    {
                        graphic: new ResourceLine({
                            pos: vec(26, 0),
                            lineWidth: 32,
                            color: () => {
                                const lowEnergy = this.stats.power < Bullet.powerCost;
                                return lowEnergy ? Color.Red : Color.Cyan;
                            },
                            minValue: 0,
                            maxValue: this.stats.maxPower,
                            valueFn: () => this.stats.power,
                            rotationFn: () => -this.rotation - Math.PI * 0.5,
                            hideOnMaxValue: true,
                        }),
                        offset: vec(16, 0),
                        useBounds: false,
                    },
                    {
                        graphic: new ResourceLine({
                            pos: vec(22, 0),
                            lineWidth: 32,
                            color: () => {
                                if (this.isReplica) {
                                    return Color.Red;
                                }

                                if (this.stats.health > this.stats.maxHealth * 0.6) {
                                    return Color.Green;
                                }

                                if (this.stats.health > this.stats.maxHealth * 0.3) {
                                    return Color.Yellow;
                                }

                                return Color.Red;
                            },
                            minValue: 0,
                            maxValue: this.stats.maxHealth,
                            valueFn: () => this.stats.health,
                            rotationFn: () => -this.rotation - Math.PI * 0.5,
                        }),
                        offset: vec(16, 0),
                        useBounds: false,
                    },
                ],
            })
        );

        if (this.isReplica) {
            return;
        }

        engine.input.pointers.on("move", () => {
            this.mouseControll = true;
        });
        engine.input.pointers.on("down", (evt) => {
            if (evt.button === PointerButton.Right) {
                if (this.accelerated !== true) {
                    this.accelerated = true;
                    this.markStale();
                }
            }

            if (evt.button === PointerButton.Left) {
                this.fire();
            }
        });
        engine.input.keyboard.on("press", (evt) => {
            if (evt.key === Keys.Space) {
                this.fire();

                return;
            }

            if ((evt.key === Keys.W || evt.key === Keys.Up) && this.accelerated !== true) {
                this.accelerated = true;
                this.markStale();

                return;
            }
        });
        engine.input.keyboard.on("release", (evt) => {
            if ((evt.key === Keys.W || evt.key === Keys.Up) && this.accelerated !== false) {
                this.accelerated = false;
                this.markStale();

                return;
            }
        });
        engine.input.pointers.on("up", (evt) => {
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

    public fire() {
        if (this.isReplica || !this.scene) {
            return;
        }

        const isEnoughPower = this.stats.consumePower(Bullet.powerCost);
        if (!isEnoughPower) {
            return;
        }

        const direction = Vector.fromAngle(this.rotation);
        const pos = this.pos.add(direction.scale(15));
        const vel = this.vel.add(direction.scale(350));

        const bullet = new Bullet({
            shooter: this,
            pos,
            vel,
            rotation: this.rotation,

            damage: 10,
            armorDeflection: 1.5,
        });
        this.scene?.add(bullet);
    }

    onPostUpdate(engine: Engine<any>, delta: number): void {
        delta = delta / 1000;

        if (!this.isReplica) {
            let newRotation = this.rotation;

            const keyboard = engine.input.keyboard;
            const left = keyboard.isHeld(Keys.A) || keyboard.isHeld(Keys.Left) ? -1 : 0;
            const right = keyboard.isHeld(Keys.D) || keyboard.isHeld(Keys.Right) ? 1 : 0;

            const scale = left + right;
            if (scale !== 0) {
                newRotation += TwoPI * scale * delta;
                this.mouseControll = false;
            }

            if (this.mouseControll) {
                const cursorScreenPos = engine.input.pointers.primary.lastScreenPos;
                const rotationTarget = engine.screenToWorldCoordinates(cursorScreenPos);
                newRotation = round(rotationTarget.sub(this.pos).toAngle(), 2);
            }

            if (newRotation !== this.rotation) {
                this.rotation = newRotation;
                this.markStale();
            }
        }

        if (this.stats.health > this.stats.maxHealth * 0.3) {
            this.shipSprite.image = this.isReplica ? Resources.Pirate : Resources.Player;
        } else {
            this.shipSprite.image = this.isReplica
                ? Resources.PirateDamaged
                : Resources.PlayerDamaged;
        }

        this.vel = this.applyMovement(delta);

        this.jetGraphics.opacity = this.accelerated ? 1 : 0;
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
            health: this.stats.health,
            power: this.stats.power,
        };
    }

    public updateState(state: PlayerState, latency: number): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;
        this.accelerated = state.accelerated;

        this.stats.health = state.health;
        this.stats.power = state.power;

        const delta = latency / 1000;

        const newVel = this.applyMovement(delta);
        const avgVel = this.vel.add(newVel).scaleEqual(0.5);

        this.pos.addEqual(avgVel.scaleEqual(delta));
        this.vel = newVel;
    }
}
