import { ActorType } from "../types";
import { NetEvent, NetEventOptions } from "./NetEvent";

export interface EntityEventOptions extends NetEventOptions {
    uuid: string;
    entityType: ActorType;
}

export abstract class EntityEvent<T extends {} = {}> extends NetEvent<
    { uuid: string; entityType: ActorType } & T
> {
    public uuid: string;
    public entityType: ActorType;

    constructor(data: EntityEventOptions) {
        super(data);

        this.uuid = data.uuid;
        this.entityType = data.entityType;
    }

    protected abstract prepareSerializableData(): { uuid: string; entityType: ActorType } & T;
}
