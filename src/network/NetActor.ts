import { Actor, ActorArgs } from "excalibur";
import { NetStateComponent } from "./NetStateComponent";
import Network from "./Network";
import { NetAction } from "./events/actions/NetAction";
import { EntityActionEvent } from "./events/EntityActionEvent";
import { KillEntityEvent } from "./events/KillEntityEvent";
import { UpdateEntityEvent } from "./events/UpdateEntityEvent";
import { CreateEntityEvent } from "./events/CreateEntityEvent";
import { ActorType } from "./types";
import { SerializableObject } from "./events/types";

export interface NetActorOptions extends ActorArgs {
    uuid?: string;
    isReplica?: boolean;
}

export abstract class NetActor<NetState extends SerializableObject = {}> extends Actor {
    private _dirty: boolean = false;

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

    public sendAction(action: NetAction) {
        if (!this.isReplica) {
            this.receiveAction(action, 0);
        }

        const entityActionEvent = new EntityActionEvent({
            uuid: this.uuid,
            entityType: this.type,
            action,
        });
        Network.sendEvent(entityActionEvent);
    }

    /** @internal */
    public _receiveAction(action: NetAction, latency: number): void {
        this.receiveAction(action, latency);
    }

    protected receiveAction(_action: NetAction, _latency: number): void {}
}
