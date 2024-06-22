import { ActorType } from "../types";
import { EntityEvent, EntityEventOptions } from "./EntityEvent";
import { SerializableObject } from "./types";

export interface EntityWithStateEventOptions<TState> extends EntityEventOptions {
    state: TState;
    isReplica?: boolean;
}

export abstract class EntityWithStateEvent<
    TSerializedState extends SerializableObject = {}
> extends EntityEvent<{ state: TSerializedState; isReplica: boolean }> {
    public state: TSerializedState;
    public isReplica: boolean;

    constructor(data: EntityWithStateEventOptions<TSerializedState>) {
        super(data);
        this.state = data.state;
        this.isReplica = data.isReplica ?? true;
    }

    protected prepareSerializableData(): { uuid: string; entityType: ActorType } & {
        state: TSerializedState;
        isReplica: boolean;
    } {
        return {
            uuid: this.uuid,
            entityType: this.entityType,
            isReplica: this.isReplica,
            state: this.state,
        };
    }
}
