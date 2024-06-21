import { ActionEventType, NetEntityType, NetEventType, NetReceiverType } from "./types";

export abstract class NetEvent {
    public receiver: NetReceiverType = NetReceiverType.NotSender;

    constructor(
        public readonly type: NetEventType,
        public time: number,
        public latency: number = 0
    ) {}

    public abstract serialize(): string;

    public static parse(message: string) {
        const data = JSON.parse(message);
        const type = data.type as NetEventType;

        let netEvent: NetEvent | null = null;
        switch (type) {
            case NetEventType.ServiceClientPing:
                netEvent = new ClientPingNetEvent(data);
                break;

            case NetEventType.ServiceServerPong:
                netEvent = new ServerPongNetEvent(data);
                break;

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

                netEvent = new EntitiesListEvent({
                    ...data,
                    entities: batchData.map((data: any) => new batchEvent(data)),
                });
                break;

            case NetEventType.EntityCreate:
                netEvent = new CreateEntityNetEvent(data);
                break;

            case NetEventType.EntityUpdate:
                netEvent = new UpdateEntityNetEvent(data);
                break;

            case NetEventType.EntityKill:
                netEvent = new KillEntityNetEvent(data);
                break;

            case NetEventType.EntityAction:
                const actionType = (data as EntityActionNetEvent).actionType;
                let action: ActionEvent | null = null;

                if (actionType === ActionEventType.Damage) {
                    action = new DamageAction(JSON.parse(data.action));
                }

                if (action) {
                    netEvent = new EntityActionNetEvent({ ...data, action });
                }

                break;
        }

        if (!netEvent) {
            return null;
        }

        netEvent.receiver = data.receiver;
        return netEvent;
    }
}

export class ClientPingNetEvent extends NetEvent {
    constructor(data: { time: number; latency?: number }) {
        super(NetEventType.ServiceClientPing, data.time, data.latency);
    }

    public serialize(): string {
        return JSON.stringify({
            receiver: this.receiver,
            type: this.type,
            time: this.time,
            latency: this.latency,
        });
    }
}

export class ServerPongNetEvent extends NetEvent {
    public serverTime: number;

    constructor(data: { time: number; serverTime: number; latency?: number }) {
        super(NetEventType.ServiceServerPong, data.time, data.latency);
        this.serverTime = data.serverTime;
    }

    public serialize(): string {
        return JSON.stringify({
            receiver: this.receiver,
            type: this.type,
            time: this.time,
            serverTime: this.serverTime,
            latency: this.latency,
        });
    }
}

export class EntitiesListEvent extends NetEvent {
    public entities: EntityWithStateNetEvent[];

    constructor(data: { entities: EntityWithStateNetEvent[]; time: number; latency?: number }) {
        super(NetEventType.ServiceEntitiesList, data.time, data.latency);
        this.entities = data.entities;
    }

    public serialize(): string {
        return JSON.stringify({
            receiver: this.receiver,
            type: this.type,
            latency: this.latency,
            time: this.time,
            entities: "[" + this.entities.map((entity) => entity.serialize()).join(",") + "]",
        });
    }
}

export abstract class EntityNetEvent extends NetEvent {
    constructor(
        type: NetEventType,
        public uuid: string,
        public entityType: NetEntityType,
        latency: number = 0
    ) {
        super(type, 0, latency);
    }
}

export abstract class EntityWithStateNetEvent<T extends {} = {}> extends EntityNetEvent {
    constructor(
        type: NetEventType,
        uuid: string,
        entityType: NetEntityType,
        public state: T,
        public isReplica = true,
        latency: number = 0
    ) {
        super(type, uuid, entityType, latency);
    }
}

export class CreateEntityNetEvent<T extends {} = {}> extends EntityWithStateNetEvent<T> {
    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        state: T;
        isReplica?: boolean;
        time?: number;
        latency?: number;
    }) {
        super(
            NetEventType.EntityCreate,
            data.uuid,
            data.entityType,
            data.state,
            data.isReplica,
            data.latency
        );
        this.time = data.time ?? 0;
    }

    public serialize(): string {
        return JSON.stringify({
            receiver: this.receiver,
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
    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        state: T;
        isReplica?: boolean;
        time?: number;
        latency?: number;
    }) {
        super(
            NetEventType.EntityUpdate,
            data.uuid,
            data.entityType,
            data.state,
            data.isReplica,
            data.latency
        );
        this.time = data.time ?? 0;
    }

    public serialize(): string {
        return JSON.stringify({
            receiver: this.receiver,
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
    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        time?: number;
        latency?: number;
    }) {
        super(NetEventType.EntityKill, data.uuid, data.entityType, data.latency);
        this.time = data.time ?? 0;
    }

    public serialize(): string {
        return JSON.stringify({
            receiver: this.receiver,
            type: this.type,
            latency: this.latency,
            time: this.time,
            uuid: this.uuid,
            entityType: this.entityType,
        });
    }
}

export class EntityActionNetEvent<T extends ActionEvent = never> extends EntityNetEvent {
    actionType: ActionEventType;
    action: T;

    constructor(data: {
        uuid: string;
        entityType: NetEntityType;
        action: T;
        time?: number;
        latency?: number;
    }) {
        super(NetEventType.EntityAction, data.uuid, data.entityType, data.latency);
        this.time = data.time ?? 0;
        this.actionType = data.action.type;
        this.action = data.action;
    }

    public serialize(): string {
        return JSON.stringify({
            receiver: this.receiver,
            type: this.type,
            latency: this.latency,
            time: this.time,
            uuid: this.uuid,
            entityType: this.entityType,
            actionType: this.actionType,
            action: this.action.serialize(),
        });
    }
}

export abstract class ActionEvent {
    public abstract readonly type: ActionEventType;

    public abstract serialize(): string;
}

export class DamageAction extends ActionEvent {
    public readonly type: ActionEventType = ActionEventType.Damage;

    public amount: number;
    public direction: number | null;

    constructor(data: { amount: number; direction?: number | null }) {
        super();

        this.amount = data.amount;
        this.direction = data.direction ?? null;
    }

    public serialize(): string {
        return JSON.stringify({
            amount: this.amount,
            direction: this.direction ? Math.round(this.direction * 100) / 100 : null,
        });
    }
}
