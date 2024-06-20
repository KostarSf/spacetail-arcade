import { Actor, ActorArgs } from "excalibur";
import { NetComponent } from "./NetComponent";
import { CreateEntityNetEvent, KillEntityNetEvent, UpdateEntityNetEvent } from "./events";
import { NetEntityType } from "./types";
import Network from "./Network";

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

    public static fromState<T extends NetActor>(
        object: T,
        uuid: string,
        state: any,
        latency: number
    ) {
        object.addComponent(new NetComponent({ uuid, isReplica: true }), true);
        object.updateState(state, latency);
        return object;
    }
}
