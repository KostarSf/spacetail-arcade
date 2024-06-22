import { WebSocket, WebSocketServer } from "ws";
import { PlayerState } from "~/actors/Player";
import { CreateEntityEvent } from "~/network/events/CreateEntityEvent";
import { EntitiesListEvent } from "~/network/events/EntitiesListEvent";
import { EntityEvent } from "~/network/events/EntityEvent";
import { EntityWithStateEvent } from "~/network/events/EntityWithStateEvent";
import { KillEntityEvent } from "~/network/events/KillEntityEvent";
import { NetEvent } from "~/network/events/NetEvent";
import { ServerPongEvent } from "~/network/events/ServerPongEvent";
import { UpdateEntityEvent } from "~/network/events/UpdateEntityEvent";
import { registerNetEvents } from "~/network/events/registry";
import { EventType, ReceiverType } from "~/network/events/types";
import { ActorType } from "~/network/types";

class PlayerConnection {
    public hostEntities: Map<string, ServerEntity>;

    constructor(public socket: WebSocket, public playerEntity: ServerPlayer | null = null) {
        this.hostEntities = new Map();
    }
}

class ServerEntity<TState = {}> {
    constructor(
        public uuid: string,
        public type: ActorType,
        public state: TState,
        public updateTime: number
    ) {}
}

class ServerPlayer extends ServerEntity<PlayerState> {
    constructor(
        public connection: PlayerConnection,
        uuid: string,
        state: PlayerState,
        updateTime: number
    ) {
        super(uuid, ActorType.Player, state, updateTime);
    }
}

const activePlayers = new Map<string, ServerPlayer>();
const gameEntities = new Map<string, ServerEntity>();

export function runGameServer(port?: number) {
    registerNetEvents();

    const server = new WebSocketServer({ port: port ?? 8080 });

    server.on("connection", (ws) => {
        console.log(`New client connected (${server.clients.size})`);

        const playerConnection = new PlayerConnection(ws);

        const entityEventsList: EntityWithStateEvent[] = [];
        gameEntities.forEach((entity) => {
            const entityEvent = new UpdateEntityEvent({
                uuid: entity.uuid,
                entityType: entity.type,
                state: entity.state,
                time: entity.updateTime,
            });
            entityEventsList.push(entityEvent);
        });
        const entitiesListEvent = new EntitiesListEvent({
            entities: entityEventsList,
            time: Date.now(),
        });
        ws.send(entitiesListEvent.serialize());

        ws.on("message", (message) => {
            const event = NetEvent.parse(message.toString());
            if (!event) {
                return;
            }

            if (event.type === EventType.ServiceClientPing) {
                ws.send(
                    new ServerPongEvent({
                        time: event.time,
                        serverTime: Date.now(),
                        latency: event.latency,
                    }).serialize()
                );
                return;
            }

            if (event instanceof EntityEvent) {
                const isPlayerEvent = event.entityType === ActorType.Player;

                switch (event.type) {
                    case EventType.EntityCreate:
                        if (isPlayerEvent) {
                            const playerEntity = new ServerPlayer(
                                playerConnection,
                                event.uuid,
                                (event as CreateEntityEvent<PlayerState>).state,
                                event.time
                            );

                            activePlayers.set(event.uuid, playerEntity);
                            playerConnection.playerEntity = playerEntity;

                            gameEntities.set(event.uuid, playerEntity);
                        } else {
                            const entity = new ServerEntity(
                                event.uuid,
                                event.entityType,
                                (event as CreateEntityEvent).state,
                                event.time
                            );

                            gameEntities.set(entity.uuid, entity);
                            playerConnection.hostEntities.set(entity.uuid, entity);
                        }

                        break;

                    case EventType.EntityUpdate:
                        if (isPlayerEvent) {
                            let playerEntity = activePlayers.get(event.uuid);

                            if (!playerEntity) {
                                playerEntity = new ServerPlayer(
                                    playerConnection,
                                    event.uuid,
                                    (event as UpdateEntityEvent<PlayerState>).state,
                                    event.time
                                );
                                playerConnection.playerEntity = playerEntity;
                            } else {
                                playerEntity.state = (
                                    event as UpdateEntityEvent<PlayerState>
                                ).state;
                                playerEntity.updateTime = event.time;
                            }

                            activePlayers.set(event.uuid, playerEntity);
                            gameEntities.set(event.uuid, playerEntity);
                        } else {
                            let entity = gameEntities.get(event.uuid);

                            if (!entity) {
                                entity = new ServerEntity(
                                    event.uuid,
                                    event.entityType,
                                    (event as UpdateEntityEvent).state,
                                    event.time
                                );
                            } else {
                                entity.state = (event as UpdateEntityEvent).state;
                                entity.updateTime = event.time;
                            }

                            gameEntities.set(entity.uuid, entity);
                            playerConnection.hostEntities.set(entity.uuid, entity);
                        }

                        break;

                    case EventType.EntityKill:
                        gameEntities.delete(event.uuid);

                        if (isPlayerEvent) {
                            activePlayers.delete(event.uuid);
                            playerConnection.playerEntity = null;
                        } else {
                            playerConnection.hostEntities.delete(event.uuid);
                        }

                        break;
                }
            }

            server.clients.forEach((socket) => {
                if (socket !== ws || event.receiver === ReceiverType.AllClients) {
                    socket.send(event.serialize());
                }
            });
        });

        ws.on("close", () => {
            const player = playerConnection.playerEntity;

            if (player) {
                gameEntities.delete(player.uuid);
                activePlayers.delete(player.uuid);
                playerConnection.playerEntity = null;

                const killEntityEvent = new KillEntityEvent({
                    entityType: ActorType.Player,
                    uuid: player.uuid,
                    time: Date.now(),
                }).serialize();

                server.clients.forEach((socket) => socket.send(killEntityEvent));
            }

            const orphanEntities = Array.from(playerConnection.hostEntities).map(
                (entry) => entry[1]
            );
            if (orphanEntities.length > 0) {
                const entitiesPerPlayer = Math.ceil(orphanEntities.length / activePlayers.size);

                activePlayers.forEach((player) => {
                    const newOwnedEntities = orphanEntities.splice(0, entitiesPerPlayer);
                    const entitiesListEvent = new EntitiesListEvent({
                        entities: newOwnedEntities.map(
                            (entity) =>
                                new UpdateEntityEvent({
                                    uuid: entity.uuid,
                                    entityType: entity.type,
                                    state: entity.state,
                                    isReplica: false,
                                    time: entity.updateTime,
                                })
                        ),
                        time: Date.now(),
                    });

                    newOwnedEntities.forEach((entity) => {
                        player.connection.hostEntities.set(entity.uuid, entity);
                    });
                    player.connection.socket.send(entitiesListEvent.serialize());
                });
            }

            if (activePlayers.size === 0) {
                gameEntities.clear();
            }

            console.log(`Client disconnected (${server.clients.size})`);
        });
    });

    const closeAllSockets = () => {
        console.log("Shutting down...");
        server.clients.forEach((socket) => {
            socket.close(1000, "Server shutting down");
        });
    };

    const handleShutdown = () => {
        closeAllSockets();

        server.close(() => {
            console.log("Server closed.");
            process.exit(0);
        });
    };

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);

    console.log("Ready for conncections on ws://localhost:8080");

    return server;
}
