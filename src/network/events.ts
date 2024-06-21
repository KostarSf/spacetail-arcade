import { NetEntityType } from "./types";

export enum NetEventType {
    ServiceClientPing,
    ServiceServerPong,
    ServiceEntitiesList,
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
            case NetEventType.ServiceClientPing:
                return new ClientPingNetEvent(data);
            case NetEventType.ServiceServerPong:
                return new ServerPongNetEvent(data);
            case NetEventType.ServiceEntitiesList:
                const batchData = JSON.parse(data.entities) as { type: NetEventType }[];
                if (batchData.length === 0) {
                    return null;
                }

                let batchEvent: typeof CreateEntityNetEvent | typeof UpdateEntityNetEvent | null =
                    null;

                if (batchData[0].type === NetEventType.EntityCreate) {
                    batchEvent = CreateEntityNetEvent;
                }
                if (batchData[0].type === NetEventType.EntityUpdate) {
                    batchEvent = UpdateEntityNetEvent;
                }
                if (!batchEvent) {
                    return null;
                }

                return new EntitiesListEvent({
                    ...data,
                    entities: batchData.map((data: any) => new batchEvent(data)),
                });
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

export class ClientPingNetEvent extends NetEvent {
    public readonly type: NetEventType = NetEventType.ServiceClientPing;

    constructor(data: { time: number; latency?: number }) {
        super(data.time, data.latency);
    }

    public serialize(): string {
        return JSON.stringify({
            type: this.type,
            time: this.time,
            latency: this.latency,
        });
    }
}

export class ServerPongNetEvent extends NetEvent {
    public readonly type: NetEventType = NetEventType.ServiceServerPong;
    public serverTime: number;

    constructor(data: { time: number; serverTime: number; latency?: number }) {
        super(data.time, data.latency);
        this.serverTime = data.serverTime;
    }

    public serialize(): string {
        return JSON.stringify({
            type: this.type,
            time: this.time,
            serverTime: this.serverTime,
            latency: this.latency,
        });
    }
}

export class EntitiesListEvent extends NetEvent {
    public readonly type: NetEventType = NetEventType.ServiceEntitiesList;
    public entities: EntityWithStateNetEvent[];

    constructor(data: { entities: EntityWithStateNetEvent[]; time: number; latency?: number }) {
        super(data.time, data.latency);
        this.entities = data.entities;
    }

    public serialize(): string {
        return JSON.stringify({
            type: this.type,
            latency: this.latency,
            time: this.time,
            entities: "[" + this.entities.map((entity) => entity.serialize()).join(",") + "]",
        });
    }
}

export abstract class EntityNetEvent extends NetEvent {
    constructor(public uuid: string, public entityType: NetEntityType, latency: number = 0) {
        super(0, latency);
    }
}

export abstract class EntityWithStateNetEvent<T extends {} = {}> extends EntityNetEvent {
    constructor(
        uuid: string,
        entityType: NetEntityType,
        public state: T,
        public isReplica = true,
        latency: number = 0
    ) {
        super(uuid, entityType, latency);
    }
}

export class CreateEntityNetEvent<T extends {} = {}> extends EntityWithStateNetEvent<T> {
    public readonly type: NetEventType = NetEventType.EntityCreate;

    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        state: T;
        isReplica?: boolean;
        time?: number;
        latency?: number;
    }) {
        super(data.uuid, data.entityType, data.state, data.isReplica, data.latency);
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
            isReplica: this.isReplica,
        });
    }
}

export class UpdateEntityNetEvent<T extends {} = {}> extends EntityWithStateNetEvent<T> {
    public readonly type: NetEventType = NetEventType.EntityUpdate;

    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        state: T;
        isReplica?: boolean;
        time?: number;
        latency?: number;
    }) {
        super(data.uuid, data.entityType, data.state, data.isReplica, data.latency);
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
            isReplica: this.isReplica,
        });
    }
}

export class KillEntityNetEvent extends EntityNetEvent {
    public readonly type: NetEventType = NetEventType.EntityKill;

    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        time?: number;
        latency?: number;
    }) {
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
