import WebSocket, { WebSocketServer } from "ws";
import { NetEvent } from "../src/network/events";

export function runGameServer(port?: number) {
    const server = new WebSocketServer({ port: port ?? 8080 });

    let players: {
        socket: WebSocket;
        isHost: boolean;
        data: {
            uuid: string;
            pos: [number, number];
            vel: [number, number];
            rotation: number;
        } | null;
    }[] = [];

    server.on("connection", (ws) => {
        const player: (typeof players)[number] = { socket: ws, data: null, isHost: false };
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
                };

                if (data.action === "spawn") {
                    const otherPlayers = players
                        .filter((player) => player.socket !== ws && player.data !== null)
                        .map((player) => player.data as NonNullable<typeof player.data>);

                    ws.send(
                        JSON.stringify({
                            type: "server",
                            action: "players-list",
                            target: player.data.uuid,
                            data: otherPlayers,
                        } satisfies NetEvent)
                    );
                }
            }
        });

        ws.on("close", () => {
            players = players.filter((player) => player.socket !== ws);
            console.log(`Client disconnected. (${players.length})`);

            setNewHostIfNeeded();

            if (!player.data) {
                return;
            }

            const message = JSON.stringify({
                type: "entity",
                action: "remove",
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
