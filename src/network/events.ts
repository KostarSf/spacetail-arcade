import { NetEntityType } from "./types";

export enum NetEventType {
    EntityCreate,
    EntityUpdate,
    EntityKill,
}

export abstract class NetEvent {
    public abstract readonly type: NetEventType;

    constructor(public time: number, public latency: number = 0) {}

    public abstract serialize(): string;

    public static parse(message: string) {
        const data = JSON.parse(message);
        const type = data.type as NetEventType;

        switch (type) {
            case NetEventType.EntityCreate:
                return new CreateEntityNetEvent(data);
            case NetEventType.EntityUpdate:
                return new UpdateEntityNetEvent(data);
            case NetEventType.EntityKill:
                return new KillEntityNetEvent(data);
            default:
                return null;
        }
    }
}

export abstract class EntityNetEvent extends NetEvent {
    constructor(public uuid: string, public entityType: NetEntityType, latency: number = 0) {
        super(0, latency);
    }
}

export class CreateEntityNetEvent<T extends {} = {}> extends EntityNetEvent {
    public state: T;

    public readonly type: NetEventType = NetEventType.EntityCreate;

    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        state: T;
        time?: number;
        latency?: number;
    }) {
        super(data.uuid, data.entityType, data.latency);
        this.time = data.time ?? 0;
        this.state = data.state;
    }

    public serialize(): string {
        return JSON.stringify({
            type: this.type,
            latency: this.latency,
            time: this.time,
            uuid: this.uuid,
            entityType: this.entityType,
            state: this.state,
        });
    }
}

export class UpdateEntityNetEvent<T extends {} = {}> extends EntityNetEvent {
    public state: T;

    public readonly type: NetEventType = NetEventType.EntityUpdate;

    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        state: T;
        time?: number;
        latency?: number;
    }) {
        super(data.uuid, data.entityType, data.latency);
        this.state = data.state;
        this.time = data.time ?? 0;
    }

    public serialize(): string {
        return JSON.stringify({
            type: this.type,
            latency: this.latency,
            time: this.time,
            uuid: this.uuid,
            entityType: this.entityType,
            state: this.state,
        });
    }
}

export class KillEntityNetEvent extends EntityNetEvent {
    public readonly type: NetEventType = NetEventType.EntityKill;

    constructor(data: { uuid: string; entityType: NetEntityType; time?: number; latency?: number }) {
        super(data.uuid, data.entityType, data.latency);
        this.time = data.time ?? 0;
    }

    public serialize(): string {
        return JSON.stringify({
            type: this.type,
            latency: this.latency,
            time: this.time,
            uuid: this.uuid,
            entityType: this.entityType,
        });
    }
}
