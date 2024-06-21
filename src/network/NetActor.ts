import { Actor, ActorArgs } from "excalibur";
import { NetComponent } from "./NetComponent";
import Network from "./Network";
import {
    CreateEntityNetEvent,
    EntityWithStateNetEvent,
    KillEntityNetEvent,
    UpdateEntityNetEvent,
} from "./events";
import { NetEntityType } from "./types";

export interface NetActorOptions extends ActorArgs {}

export abstract class NetActor<NetState extends {} = {}> extends Actor {
    private _dirty: boolean = false;

    get isStale() {
        return this._dirty;
    }

    public abstract readonly type: NetEntityType;

    constructor(options: NetActorOptions = {}) {
        super(options);
        this.addComponent(new NetComponent());

        this.on("initialize", () => {
            if (!this.isReplica) {
                Network.sendEvent(
                    new CreateEntityNetEvent({
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
                    new UpdateEntityNetEvent({
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
                    new KillEntityNetEvent({
                        uuid: this.uuid,
                        entityType: this.type,
                    })
                );
            }
        });
    }

    get uuid() {
        return this.get(NetComponent).uuid;
    }

    get isReplica() {
        return this.get(NetComponent).isReplica;
    }

    public abstract serializeState(): NetState;
    public abstract updateState(state: NetState, latency: number): void;

    public markStale(state = true) {
        this._dirty = state;
    }

    public static fromEventState<T extends NetActor>(object: T, event: EntityWithStateNetEvent) {
        object.addComponent(
            new NetComponent({ uuid: event.uuid, isReplica: event.isReplica }),
            true
        );
        object.updateState(event.state, event.latency);

        return object;
    }
}
