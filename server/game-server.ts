import WebSocket, { WebSocketServer } from "ws";
import { EntityEventData, NetEvent } from "../src/network/events";

export function runGameServer(port?: number) {
    const server = new WebSocketServer({ port: port ?? 8080 });

    type PlayerData = {
        uuid: string;
        pos: [number, number];
        vel: [number, number];
        rotation: number;
        accelerated: boolean;
    };

    let players: {
        socket: WebSocket;
        isHost: boolean;
        data: PlayerData | null;
        lastUpdateTime: number;
        latency: number;
    }[] = [];

    let entities: Map<string, EntityEventData> = new Map();

    server.on("connection", (ws) => {
        const player: (typeof players)[number] = {
            socket: ws,
            data: null,
            isHost: false,
            lastUpdateTime: Date.now(),
            latency: 0,
        };
        players.push(player);

        console.log(`New client connected (${players.length})`);
        setNewHostIfNeeded();

        ws.on("ping", (_data) => {
            // console.log("ping", data);
        });

        ws.on("pong", (_data) => {
            // console.log("pong", data);
        });

        ws.on("message", async (message) => {
            players.forEach(({ socket }) => {
                if (socket !== ws && socket.readyState === WebSocket.OPEN) {
                    socket.send(message);
                }
            });

            const data = JSON.parse(message.toString()) as NetEvent;
            if (data.type === "player") {
                player.data = {
                    uuid: data.target,
                    pos: data.data.pos,
                    vel: data.data.vel,
                    rotation: data.data.rotation,
                    accelerated: player.data?.accelerated ?? false,
                };
                player.lastUpdateTime = data.time;

                if (data.action === "accelerated") {
                    player.data.accelerated = data.data.value;
                }

                if (data.action === "spawn") {
                    const otherPlayers = players.filter(
                        (player) => player.socket !== ws && player.data !== null
                    ) as ((typeof players)[number] & {
                        data: NonNullable<(typeof players)[number]["data"]>;
                    })[];

                    let now = Date.now();

                    ws.send(
                        JSON.stringify({
                            type: "server",
                            action: "players-list",
                            target: player.data.uuid,
                            time: Date.now(),
                            data: otherPlayers.map((player) => {
                                const delta = (now - player.lastUpdateTime) / 1000;
                                const decayFactor = 0.9;
                                const decay = Math.pow(decayFactor, delta);

                                const vel: [number, number] = [
                                    player.data.vel[0] * decay,
                                    player.data.vel[1] * decay,
                                ];

                                const avgVel: [number, number] = [
                                    (player.data.vel[0] + vel[0]) / 2,
                                    (player.data.vel[1] + vel[1]) / 2,
                                ];

                                const pos: [number, number] = [
                                    player.data.pos[0] + avgVel[0] * delta,
                                    player.data.pos[1] + avgVel[1] * delta,
                                ];

                                return { ...player.data, pos, vel };
                            }),
                        } satisfies NetEvent)
                    );

                    now = Date.now();

                    ws.send(
                        JSON.stringify({
                            type: "server",
                            action: "entities-list",
                            target: player.data.uuid,
                            time: Date.now(),
                            data: Array.from(entities.values()).map((entity) => {
                                const delta = (now - entity.time) / 1000;
                                entity.args.pos[0] += entity.args.vel[0] * delta;
                                entity.args.pos[1] += entity.args.vel[1] * delta;
                                entity.args.rotation =
                                    (entity.args.rotation + entity.args.angularVelocity * delta) %
                                    (Math.PI * 2);

                                return entity;
                            }),
                        } satisfies NetEvent)
                    );
                }

                return;
            }

            if (data.type === "entity") {
                if (data.action === "spawn") {
                    entities.set(data.target, {
                        class: data.data.class,
                        time: data.data.time,
                        args: data.data.args,
                    });

                    return;
                }

                if (data.action === "update") {
                    const entity = entities.get(data.target);
                    if (!entity) {
                        return;
                    }

                    entity.args = { ...entity.args, ...data.data };
                    entity.time = data.time;
                    return;
                }

                if (data.action === "remove") {
                    entities.delete(data.target);
                }
            }

            if (data.type === "ping") {
                const now = Date.now();
                player.latency = now - data.time;
                ws.send(
                    JSON.stringify({
                        type: "server",
                        action: "pong",
                        target: player.data?.uuid ?? "none",
                        time: now,
                    } satisfies NetEvent)
                );
            }
        });

        ws.on("close", () => {
            players = players.filter((player) => player.socket !== ws);
            console.log(`Client disconnected. (${players.length})`);

            if (players.length === 0) {
                entities.clear();
            }

            setNewHostIfNeeded();

            if (!player.data) {
                return;
            }

            const message = JSON.stringify({
                type: "entity",
                action: "remove",
                time: Date.now(),
                target: player.data.uuid,
            } satisfies NetEvent);

            players.forEach(({ socket }) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(message);
                }
            });
        });
    });

    const setNewHostIfNeeded = () => {
        const hostPlayer = players.find((player) => player.isHost);
        if (hostPlayer) {
            return;
        }

        const newHost = players.at(0);
        if (!newHost) {
            return;
        }

        newHost.isHost = true;
        newHost.socket.send(
            JSON.stringify({
                type: "server",
                action: "set-host",
                target: "none",
                time: Date.now(),
                data: { isHost: true },
            } satisfies NetEvent)
        );
    };

    const closeAllSockets = () => {
        console.log("Shutting down...");
        players.forEach(({ socket }) => {
            socket.close(1000, "Server shutting down");
        });

        players = [];
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
