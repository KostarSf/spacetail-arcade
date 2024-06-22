import { NetEvent } from "./NetEvent";
import { EventType } from "./types";

export class ClientPingEvent extends NetEvent {
    public readonly type: EventType = EventType.ServiceClientPing;

    protected prepareSerializableData(): {} {
        return {};
    }
}
