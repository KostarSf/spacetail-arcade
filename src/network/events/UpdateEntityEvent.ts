import { EntityWithStateEvent, EntityWithStateEventOptions } from "./EntityWithStateEvent";
import { EventType, SerializableObject } from "./types";

export class UpdateEntityEvent<
    TSerializedState extends SerializableObject = never
> extends EntityWithStateEvent<TSerializedState> {
    public readonly type: EventType = EventType.EntityUpdate;

    constructor(data: EntityWithStateEventOptions<TSerializedState>) {
        super(data);
    }
}
