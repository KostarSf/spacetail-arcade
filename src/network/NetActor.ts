import {
    Actor,
    ActorArgs,
    EventEmitter,
    EventKey,
    GameEvent,
    Handler,
    Subscription,
    vec,
    Vector,
} from "excalibur";
import { ActorEvents } from "excalibur/build/dist/Actor";
import { DamageEvent, StatsComponent } from "~/ecs/stats.ecs";
import { Explosion } from "~/entities/Explosion";
import { HitLabel } from "~/entities/HitLabel";
import { DamageAction } from "./events/actions/DamageAction";
import { NetAction } from "./events/actions/NetAction";
import { StatsChangeAction } from "./events/actions/StatsChangeAction";
import { CreateEntityEvent } from "./events/CreateEntityEvent";
import { EntityActionEvent } from "./events/EntityActionEvent";
import { KillEntityEvent } from "./events/KillEntityEvent";
import { ActionType, ReceiverType, SerializableObject } from "./events/types";
import { UpdateEntityEvent } from "./events/UpdateEntityEvent";
import { NetStateComponent } from "./NetStateComponent";
import Network from "./Network";
import { ActorType } from "./types";

export type NetActorEvents = ActorEvents & {
    action: ActionEvent;
    damage: DamageEvent<NetActor>;
};

export const NetActorEvents = {
    Action: "action",
    Damage: "damage",
};

export class ActionEvent<
    T extends NetActor = NetActor,
    A extends NetAction = NetAction
> extends GameEvent<T> {
    constructor(public action: A, public latency: number) {
        super();
    }
}

export interface NetActorOptions extends ActorArgs {
    uuid?: string;
    isReplica?: boolean;
}

export abstract class NetActor<NetState extends SerializableObject = {}> extends Actor {
    private _dirty: boolean = false;

    public events = new EventEmitter<NetActorEvents>();

    get isStale() {
        return this._dirty;
    }

    public abstract readonly type: ActorType;

    constructor(options: NetActorOptions = {}) {
        super(options);
        this.addComponent(
            new NetStateComponent({ uuid: options.uuid, isReplica: options.isReplica })
        );

        this.on("initialize", () => {
            if (!this.isReplica) {
                Network.sendEvent(
                    new CreateEntityEvent({
                        uuid: this.uuid,
                        entityType: this.type,
                        state: this.serializeState(),
                    })
                );
            }
        });

        this.on("preupdate", () => {
            if (!this.isReplica && this.isStale) {
                Network.sendEvent(
                    new UpdateEntityEvent({
                        uuid: this.uuid,
                        entityType: this.type,
                        state: this.serializeState(),
                    })
                );
            }

            this.markStale(false);
        });

        this.on("kill", () => {
            if (!this.isReplica) {
                Network.sendEvent(
                    new KillEntityEvent({
                        uuid: this.uuid,
                        entityType: this.type,
                    })
                );
            }
        });

        this.on("action", (event) => {
            if (event.action.type === ActionType.StatsChange) {
                const action = event.action as StatsChangeAction;

                const stats = this.get(StatsComponent);
                if (!stats) {
                    return;
                }

                const delta = event.latency / 1000;

                stats.health = action.health + stats.healthRecoverySpeed * delta;
                stats.power = action.power + stats.powerRecoverySpeed * delta;
            }

            if (event.action.type === ActionType.Damage) {
                const action = event.action as DamageAction;

                const stats = this.get(StatsComponent);
                if (!stats) {
                    return;
                }

                const damage = stats.takeDamage({
                    damage: action.damage,
                    armorDeflection: action.armorDeflection,
                    healthDeflection: action.healthDeflection,
                    direction: action.direction,
                });

                if (damage > 0) {
                    const label = new HitLabel({
                        pos: this.pos.add(vec(0, -8)),
                        value: -damage,
                        vel: this.vel.scale(0.2),
                    });
                    const explosion = new Explosion(this.pos);

                    this.scene?.add(explosion);
                    this.scene?.add(label);
                }

                if (stats.isDead) {
                    this.kill();
                    return;
                }

                const delta = event.latency / 1000;
                stats.health += stats.healthRecoverySpeed * delta;
                stats.power += stats.powerRecoverySpeed * delta;

                if (action.direction) {
                    this.vel.subEqual(Vector.fromAngle(action.direction).scale(damage));
                    this.markStale();
                }

                return;
            }
        });
    }

    get uuid() {
        return this.get(NetStateComponent).uuid;
    }

    get isReplica() {
        return this.get(NetStateComponent).isReplica;
    }

    public abstract serializeState(): NetState;
    public abstract updateState(
        state: NetState,
        latency: number,
        actors: Map<string, NetActor>
    ): void;

    public markStale(state = true) {
        this._dirty = state;
    }

    public sendAction(action: NetAction, options?: { self?: false; receiver?: ReceiverType }) {
        if (!this.isReplica && options?.self !== false) {
            this._receiveAction(action, 0);
        }

        const entityActionEvent = new EntityActionEvent({
            uuid: this.uuid,
            entityType: this.type,
            action,
            receiver: options?.receiver,
        });
        Network.sendEvent(entityActionEvent);
    }

    /** @internal */
    public _receiveAction(action: NetAction, latency: number): void {
        this.emit("action", new ActionEvent(action, latency));
        this.receiveAction(action, latency);
    }

    protected receiveAction(_action: NetAction, _latency: number): void {}

    // #region Events
    public emit<TEventName extends EventKey<NetActorEvents>>(
        eventName: TEventName,
        event: NetActorEvents[TEventName]
    ): void;
    public emit(eventName: string, event?: any): void;
    public emit<TEventName extends EventKey<NetActorEvents> | string>(
        eventName: TEventName,
        event?: any
    ): void {
        this.events.emit(eventName, event);
    }

    public on<TEventName extends EventKey<NetActorEvents>>(
        eventName: TEventName,
        handler: Handler<NetActorEvents[TEventName]>
    ): Subscription;
    public on(eventName: string, handler: Handler<unknown>): Subscription;
    public on<TEventName extends EventKey<NetActorEvents> | string>(
        eventName: TEventName,
        handler: Handler<any>
    ): Subscription {
        return this.events.on(eventName, handler);
    }

    public once<TEventName extends EventKey<NetActorEvents>>(
        eventName: TEventName,
        handler: Handler<NetActorEvents[TEventName]>
    ): Subscription;
    public once(eventName: string, handler: Handler<unknown>): Subscription;
    public once<TEventName extends EventKey<NetActorEvents> | string>(
        eventName: TEventName,
        handler: Handler<any>
    ): Subscription {
        return this.events.once(eventName, handler);
    }

    public off<TEventName extends EventKey<NetActorEvents>>(
        eventName: TEventName,
        handler: Handler<NetActorEvents[TEventName]>
    ): void;
    public off(eventName: string, handler: Handler<unknown>): void;
    public off(eventName: string): void;
    public off<TEventName extends EventKey<NetActorEvents> | string>(
        eventName: TEventName,
        handler?: Handler<any>
    ): void {
        this.events.off(eventName as any, handler as any);
    }

    // #endregion
}
