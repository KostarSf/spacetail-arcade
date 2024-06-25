import {
    Actor,
    Animation,
    CollisionGroup,
    CollisionGroupManager,
    CollisionType,
    Color,
    Engine,
    Font,
    GraphicsGroup,
    Keys,
    Label,
    PointerButton,
    PolygonCollider,
    Sprite,
    TextAlign,
    TwoPI,
    Vector,
    vec,
} from "excalibur";
import { v4 } from "uuid";
import { Pallete } from "~/constants";
import { NetBodyComponent } from "~/ecs/physics.ecs";
import { StatsComponent } from "~/ecs/stats.ecs";
import { ResourceLine } from "~/graphics/ResourceLine";
import { ShadowedSprite } from "~/graphics/ShadowedSprite";
import { NetActor } from "~/network/NetActor";
import { SerializableObject } from "~/network/events/types";
import { ActorType, SerializedVector } from "~/network/types";
import { Animations, Resources } from "~/resources";
import { easeOut, lerp, linear, rand, round, vecToArray } from "~/utils/math";
import { Bullet } from "./Bullet";
import { XpOrb } from "./XpOrb";
import { Particle } from "~/entities/Particle";

export interface PlayerState extends SerializableObject {
    pos: SerializedVector;
    vel: SerializedVector;
    accelerated: boolean;
    rotation: number;
    health: number;
    power: number;
    xp: number;
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
    public xp = 0;

    private shipSprite!: ShadowedSprite;
    private jetGraphics!: Animation;
    private shieldSprite!: Sprite;

    private mouseControll = false;
    private collisionGroup: CollisionGroup;
    private shieldOpacity = 0;

    constructor(options?: PlayerOptions) {
        const collisionGroup = CollisionGroupManager.create(v4());

        super({
            name: "Player",
            uuid: options?.uuid,
            isReplica: options?.isReplica,

            pos: options?.pos,
            collider: new PolygonCollider({
                points: [vec(-10, -10), vec(15, 0), vec(-10, 10)],
            }),
            collisionType: CollisionType.Passive,
            collisionGroup: collisionGroup,
        });

        this.addTag(Player.Tag);

        this.addComponent(
            new StatsComponent({ health: 50, power: 25, powerRecoverySpeed: 10, hardness: 10 })
        );
        this.addComponent(new NetBodyComponent({ mass: 10 }));

        this.collisionGroup = collisionGroup;
    }

    get stats() {
        return this.get(StatsComponent);
    }

    onInitialize(engine: Engine<any>): void {
        this.shipSprite = ShadowedSprite.from(
            this.isReplica ? Resources.Pirate : Resources.Player,
            this.isReplica ? Pallete.gray200 : undefined
        );
        this.jetGraphics = Animations.JetStream;
        this.shieldSprite = this.isReplica
            ? Resources.PirateShield.toSprite()
            : Resources.PlayerShield.toSprite();

        const graphicsGroup = new GraphicsGroup({
            members: [
                { graphic: this.shieldSprite, offset: Vector.Zero },
                { graphic: this.shipSprite, offset: Vector.Zero },
                { graphic: this.jetGraphics, offset: Vector.Zero },
            ],
        });

        if (!this.isReplica) {
            graphicsGroup.members.push(
                ...[
                    {
                        graphic: new ResourceLine({
                            pos: vec(26, 0),
                            lineWidth: 32,
                            color: () => {
                                const lowEnergy = this.stats.power < Bullet.powerCost;
                                return lowEnergy ? Pallete.gray600 : Pallete.gray100;
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
                                    return Pallete.gray400;
                                }

                                if (this.stats.health > this.stats.maxHealth * 0.6) {
                                    return Color.White;
                                }

                                if (this.stats.health > this.stats.maxHealth * 0.3) {
                                    return Pallete.gray200;
                                }

                                return Pallete.gray400;
                            },
                            minValue: 0,
                            maxValue: this.stats.maxHealth,
                            valueFn: () => this.stats.health,
                            rotationFn: () => -this.rotation - Math.PI * 0.5,
                        }),
                        offset: vec(16, 0),
                        useBounds: false,
                    },
                ]
            );
        }

        this.graphics.add(graphicsGroup);

        this.on("collisionstart", (evt) => {
            if (evt.other.hasTag(XpOrb.Tag)) {
                if (!this.isReplica) {
                    this.xp += (evt.other as XpOrb).amount;
                    this.markStale();
                }

                evt.other.kill();
            }
        });

        const gathererSize = 80;
        const gatherPower = 10;
        const xpOrbGatherer = new Actor({
            pos: this.pos,
            radius: gathererSize,
            collisionGroup: this.collisionGroup,
        });
        xpOrbGatherer.on("postupdate", () => {
            xpOrbGatherer.pos = this.pos;
        });
        xpOrbGatherer.on("precollision", (event) => {
            if (!event.other.hasTag(XpOrb.Tag)) {
                return;
            }

            const xpOrb = event.other as XpOrb;
            const koeff = 1 - lerp(this.pos.distance(xpOrb.pos), 0, gathererSize, easeOut);
            const force = this.pos
                .sub(xpOrb.pos)
                .normalize()
                .scale(gatherPower * koeff);

            xpOrb.vel.addEqual(force);
        });
        xpOrbGatherer.on("collisionstart", (event) => {
            if (!event.other.hasTag(XpOrb.Tag)) {
                return;
            }
            const xpOrb = event.other as XpOrb;
            xpOrb.markStale();
        });
        xpOrbGatherer.on("collisionend", (event) => {
            if (!event.other.hasTag(XpOrb.Tag)) {
                return;
            }
            const xpOrb = event.other as XpOrb;
            xpOrb.markStale();
        });

        const xpLabel = new Label({
            color: Pallete.gray200,
            pos: this.pos,
            font: new Font({ textAlign: TextAlign.Center, family: "monospace" }),
        });
        xpLabel.on("postupdate", () => {
            xpLabel.pos = this.pos.add(vec(0, 15));
            xpLabel.text = this.xp.toFixed();
        });

        engine.currentScene.add(xpOrbGatherer);
        engine.currentScene.add(xpLabel);

        this.on("damage", (evt) => {
            if (evt.consumed >= 0) {
                this.shieldOpacity = evt.amount > 0 ? 0.5 : 1;
            }

            if (evt.amount > 0 && this.scene) {
                Particle.emit({
                    scene: this.scene,
                    pos: this.pos,
                    posSpread: 5,
                    vel: Vector.One.scale(20),
                    speedSpread: 1.5,
                    angleSpread: TwoPI,
                    size: 2,
                    sizeSpread: 1,
                    timeToLive: 2000,
                    timeToLiveSpread: 1000,
                    amount: rand.integer(10, 20),
                    blinkDelta: 0.2,
                    blinkDeltaSpread: 0.1,
                    blinkSpeed: 400,
                    blinkSpeedSpread: 200,
                    opacity: 0.9,
                    opacitySpread: 0.1,
                    z: 0.2,
                    zSpread: 0.6,
                });
            }
        });

        this.on("kill", () => {
            xpOrbGatherer.kill();
            xpLabel.kill();

            Particle.emit({
                scene: this.scene,
                pos: this.pos,
                posSpread: 5,
                vel: Vector.One.scale(40),
                speedSpread: 1.7,
                angleSpread: TwoPI,
                size: 3,
                sizeSpread: 4,
                timeToLive: 1000,
                timeToLiveSpread: 500,
                amount: rand.integer(20, 30),
                blinkDelta: 0.2,
                blinkDeltaSpread: 0.1,
                blinkSpeed: 400,
                blinkSpeedSpread: 200,
                opacity: 0.9,
                opacitySpread: 0.1,
                z: 0.2,
                zSpread: 0.6,
            });

            if (this.isReplica || this.isKilled() || !this.scene) {
                return;
            }

            const xpDropped = Math.round(this.xp / 3);

            if (xpDropped < 1) {
                return;
            }

            const orbsCount =
                1 + Math.round(lerp(xpDropped, 1, 200, linear) * rand.integer(29, 49));
            const xpPerOrb = Math.max(1, Math.round(xpDropped / orbsCount));

            const values = new Array(orbsCount).fill(xpPerOrb);

            XpOrb.spawn(this.scene, values, this.pos, this.vel);
        });

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

        this.scene.camera.shake(3, 3, 100);
        this.vel = this.vel.add(direction.negate().scaleEqual(5));
        this.markStale();

        const bullet = new Bullet({
            shooter: this,
            pos,
            vel,
            rotation: this.rotation,

            damage: 15,
            armorDeflection: 1.5,
        });
        this.scene?.add(bullet);
    }

    onPostUpdate(engine: Engine<any>, delta: number): void {
        delta = delta / 1000;

        this.shieldSprite.opacity = this.shieldOpacity;

        if (this.shieldOpacity > 0) {
            this.shieldOpacity = Math.max(0, this.shieldOpacity - 2 * delta);
        }

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

        if (this.stats.health > this.stats.maxHealth * 0.6) {
            this.shipSprite.image = this.isReplica ? Resources.Pirate : Resources.Player;
        } else if (this.stats.health > this.stats.maxHealth * 0.3) {
            this.shipSprite.image = this.isReplica
                ? Resources.PirateDamaged1
                : Resources.PlayerDamaged1;
        } else {
            this.shipSprite.image = this.isReplica
                ? Resources.PirateDamaged2
                : Resources.PlayerDamaged2;
        }

        this.shieldSprite.image = this.isReplica ? Resources.PirateShield : Resources.PlayerShield;

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
            xp: this.xp,
        };
    }

    public updateState(state: PlayerState, latency: number): void {
        this.pos = vec(...state.pos);
        this.vel = vec(...state.vel);
        this.rotation = state.rotation;
        this.accelerated = state.accelerated;
        this.stats.health = state.health;
        this.stats.power = state.power;
        this.xp = state.xp;

        const delta = latency / 1000;

        const newVel = this.applyMovement(delta);
        const avgVel = this.vel.add(newVel).scaleEqual(0.5);

        this.pos.addEqual(avgVel.scaleEqual(delta));
        this.vel = newVel;
    }
}
