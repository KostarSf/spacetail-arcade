import { EntityWithStateEvent, EntityWithStateEventOptions } from "./EntityWithStateEvent";
import { EventType, SerializableObject } from "./types";

export class CreateEntityEvent<
    TSerializedState extends SerializableObject = never
> extends EntityWithStateEvent<TSerializedState> {
    public readonly type: EventType = EventType.EntityCreate;

    constructor(data: EntityWithStateEventOptions<TSerializedState>) {
        super(data);
    }
}
