import { WebSocket, WebSocketServer } from "ws";
import { PlayerState } from "~/actors/Player";
import {
    CreateEntityNetEvent,
    EntitiesListEvent,
    EntityNetEvent,
    KillEntityNetEvent,
    NetEvent,
    NetEventType,
    ServerPongNetEvent,
    UpdateEntityNetEvent,
} from "~/network/events";
import { NetEntityType } from "~/network/types";

class PlayerConnection {
    constructor(public socket: WebSocket, public entity: ServerPlayer | null = null) {}
}

class ServerEntity<TState = {}> {
    constructor(public uuid: string, public type: NetEntityType, public state: TState) {}
}

class ServerPlayer extends ServerEntity<PlayerState> {
    constructor(
        public connection: PlayerConnection,
        public uuid: string,
        public state: PlayerState
    ) {
        super(uuid, NetEntityType.Player, state);
    }
}

const activePlayers = new Map<string, ServerPlayer>();
const gameEntities = new Map<string, ServerEntity>();

export function runGameServer(port?: number) {
    const server = new WebSocketServer({ port: port ?? 8080 });

    server.on("connection", (ws) => {
        console.log(`New client connected (${server.clients.size})`);

        const playerConnection = new PlayerConnection(ws);

        const entityEventsList: CreateEntityNetEvent[] = [];
        gameEntities.forEach((entity) => {
            const entityEvent = new CreateEntityNetEvent({
                uuid: entity.uuid,
                entityType: entity.type,
                state: entity.state,
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

            if (event.type === NetEventType.ServiceClientPing) {
                ws.send(
                    new ServerPongNetEvent({
                        time: event.time,
                        serverTime: Date.now(),
                        latency: event.latency,
                    }).serialize()
                );
                return;
            }

            if (event instanceof EntityNetEvent) {
                const isPlayerEvent = event.entityType === NetEntityType.Player;

                switch (event.type) {
                    case NetEventType.EntityCreate:
                        if (isPlayerEvent) {
                            const playerEntity = new ServerPlayer(
                                playerConnection,
                                event.uuid,
                                (event as CreateEntityNetEvent<PlayerState>).state
                            );

                            activePlayers.set(event.uuid, playerEntity);
                            playerConnection.entity = playerEntity;

                            gameEntities.set(event.uuid, playerEntity);
                        } else {
                            const entity = new ServerEntity(
                                event.uuid,
                                event.entityType,
                                (event as CreateEntityNetEvent).state
                            );

                            gameEntities.set(entity.uuid, entity);
                        }

                        break;

                    case NetEventType.EntityUpdate:
                        if (isPlayerEvent) {
                            let playerEntity = activePlayers.get(event.uuid);

                            if (!playerEntity) {
                                playerEntity = new ServerPlayer(
                                    playerConnection,
                                    event.uuid,
                                    (event as UpdateEntityNetEvent<PlayerState>).state
                                );
                                playerConnection.entity = playerEntity;
                            }

                            activePlayers.set(event.uuid, playerEntity);
                            gameEntities.set(event.uuid, playerEntity);
                        } else {
                            let entity = gameEntities.get(event.uuid);

                            if (!entity) {
                                entity = new ServerEntity(
                                    event.uuid,
                                    event.entityType,
                                    (event as UpdateEntityNetEvent<PlayerState>).state
                                );
                            }

                            gameEntities.set(entity.uuid, entity);
                        }

                        break;

                    case NetEventType.EntityKill:
                        gameEntities.delete(event.uuid);

                        if (isPlayerEvent) {
                            activePlayers.delete(event.uuid);
                            playerConnection.entity = null;
                        }

                        break;
                }
            }

            server.clients.forEach((socket) => {
                if (socket !== ws) {
                    socket.send(event.serialize());
                }
            });
        });

        ws.on("close", () => {
            const player = playerConnection.entity;

            if (player) {
                gameEntities.delete(player.uuid);
                activePlayers.delete(player.uuid);
                playerConnection.entity = null;

                const killEntityEvent = new KillEntityNetEvent({
                    entityType: NetEntityType.Player,
                    uuid: player.uuid,
                    time: Date.now(),
                }).serialize();

                server.clients.forEach((socket) => socket.send(killEntityEvent));
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
