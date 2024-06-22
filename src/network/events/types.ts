export enum EventType {
    ServiceClientPing,
    ServiceServerPong,
    ServiceEntitiesList,
    EntityCreate,
    EntityUpdate,
    EntityKill,
    EntityAction,
}

export enum ReceiverType {
    AllClients,
    NotSender,
}

export enum ActionType {
    ShipFire,
    Damage,
}

export type SerializableValue =
    | null
    | string
    | boolean
    | number
    | SerializableValue[]
    | { [Key: string]: SerializableValue };

export type SerializableObject = { [key: string]: SerializableValue };
