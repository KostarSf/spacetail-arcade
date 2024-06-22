import { EntityWithStateEvent } from "./EntityWithStateEvent";
import { NetEvent, NetEventOptions } from "./NetEvent";
import { EventType } from "./types";

export class EntitiesListEvent extends NetEvent<{ entities: string[] }> {
    public readonly type: EventType = EventType.ServiceEntitiesList;

    public entities: EntityWithStateEvent<{}>[];

    constructor(data: NetEventOptions & { entities: EntityWithStateEvent<{}>[] }) {
        super(data);

        this.entities = data.entities;
    }

    protected prepareSerializableData(): { entities: string[] } {
        return {
            entities: this.entities.map((event) => event.serialize()),
        };
    }

    public static parseState(data: { entities: string[] }) {
        const entities = data.entities
            .map((data) => NetEvent.parse(data))
            .filter(Boolean) as NetEvent[];
        if (!entities.length) {
            return null;
        }

        return { ...data, entities };
    }
}
