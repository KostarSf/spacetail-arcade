import { EventType, ReceiverType, SerializableObject } from "./types";

export interface NetEventOptions {
    receiver?: ReceiverType;
    time?: number;
    latency?: number;
}

export interface NetEventData extends NetEventOptions {
    type: EventType;
}

export abstract class NetEvent<T extends SerializableObject = {}> {
    public abstract readonly type: EventType;

    public receiver: ReceiverType;
    public time: number;
    public latency: number;

    constructor(data: NetEventOptions) {
        this.receiver = data.receiver ?? ReceiverType.NotSender;
        this.time = data.time ?? 0;
        this.latency = data.latency ?? 0;
    }

    protected abstract prepareSerializableData(): T;

    public serialize(): string {
        const eventData: NetEventData = {
            receiver: this.receiver,
            type: this.type,
            time: this.time,
            latency: this.latency,
            ...this.prepareSerializableData(),
        };

        return JSON.stringify(eventData);
    }

    private static registry: Map<
        EventType,
        {
            ctor: new (data: NetEventData) => NetEvent<{}>;
            parser?: (data: any) => NetEventData | null;
        }
    > = new Map();

    public static register<A extends SerializableObject, P extends NetEvent<A>>(
        type: EventType,
        ctor: new (data: any) => P,
        parser?: (data: any) => any
    ) {
        NetEvent.registry.set(type, { ctor, parser } as any);
    }

    public static parse(message: string): NetEvent<{}> | null {
        const data = JSON.parse(message) as NetEventData;

        const event = NetEvent.registry.get(data.type);
        if (!event) {
            console.error(`Unknown event type: ${data.type}`);
            return null;
        }

        let parsedData = event.parser ? event.parser(data) : data;
        if (!parsedData) {
            return null;
        }

        return new event.ctor(parsedData);
    }
}
