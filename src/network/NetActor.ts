import { Actor, ActorArgs } from "excalibur";
import { NetStateComponent } from "./NetStateComponent";
import Network from "./Network";
import { CreateEntityNetEvent, KillEntityNetEvent, UpdateEntityNetEvent } from "./events";
import { NetEntityType } from "./types";

export interface NetActorOptions extends ActorArgs {
    uuid?: string;
    isReplica?: boolean;
}

export abstract class NetActor<NetState extends {} = {}> extends Actor {
    private _dirty: boolean = false;

    get isStale() {
        return this._dirty;
    }

    public abstract readonly type: NetEntityType;

    constructor(options: NetActorOptions = {}) {
        super(options);
        this.addComponent(new NetStateComponent({ uuid: options.uuid, isReplica: options.isReplica }));

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
        return this.get(NetStateComponent).uuid;
    }

    get isReplica() {
        return this.get(NetStateComponent).isReplica;
    }

    public abstract serializeState(): NetState;
    public abstract updateState(state: NetState, latency: number): void;

    public markStale(state = true) {
        this._dirty = state;
    }
}
