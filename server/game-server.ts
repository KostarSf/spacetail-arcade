import { WebSocketServer } from "ws";
import { NetEvent, NetEventType, ServerPongNetEvent } from "~/network/events";

export function runGameServer(port?: number) {
    const server = new WebSocketServer({ port: port ?? 8080 });

    server.on("connection", (ws) => {
        console.log(`New client connected (${server.clients.size})`);

        ws.on("message", (message) => {
            const event = NetEvent.parse(message.toString());
            if (!event) {
                return;
            }

            // console.log(event);

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

            server.clients.forEach((socket) => {
                if (socket !== ws) {
                    socket.send(event.serialize());
                }
            });
        });

        ws.on("close", () => {
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
