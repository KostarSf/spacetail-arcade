import { NetEvent, NetEventOptions } from "./NetEvent";
import { EventType } from "./types";

export class ServerPongEvent extends NetEvent<{ serverTime: number }> {
    public readonly type: EventType = EventType.ServiceServerPong;

    public serverTime: number;

    constructor(data: NetEventOptions & { serverTime: number }) {
        super(data);
        this.serverTime = data.serverTime;
    }

    protected prepareSerializableData(): { serverTime: number } {
        return { serverTime: this.serverTime };
    }
}
