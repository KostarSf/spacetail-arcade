import { ActorType } from "../types";
import { EntityEvent, EntityEventOptions } from "./EntityEvent";
import { EventType } from "./types";

export class KillEntityEvent extends EntityEvent {
    public readonly type: EventType = EventType.EntityKill;

    constructor(data: EntityEventOptions) {
        super(data);
    }

    protected prepareSerializableData(): { uuid: string; entityType: ActorType } {
        return {
            uuid: this.uuid,
            entityType: this.entityType,
        };
    }
}
