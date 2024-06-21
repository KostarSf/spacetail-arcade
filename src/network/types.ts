export type SerializedVector = [x: number, y: number];

export enum NetEntityType {
    Player,
    Bullet,
    Asteroid,
}

export enum NetEventType {
    ServiceClientPing,
    ServiceServerPong,
    ServiceEntitiesList,
    EntityCreate,
    EntityUpdate,
    EntityKill,
    EntityAction,
}

export enum NetReceiverType {
    AllClients,
    NotSender,
}

export enum ActionEventType {
    ShipFire,
    Damage,
}
