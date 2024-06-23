import { ClientPingEvent } from "./events/ClientPingEvent";
import { CreateEntityEvent } from "./events/CreateEntityEvent";
import { EntitiesListEvent } from "./events/EntitiesListEvent";
import { EntityActionEvent } from "./events/EntityActionEvent";
import { KillEntityEvent } from "./events/KillEntityEvent";
import { NetEvent } from "./events/NetEvent";
import { ServerPongEvent } from "./events/ServerPongEvent";
import { UpdateEntityEvent } from "./events/UpdateEntityEvent";
import { EventType } from "./events/types";

export interface NetworkStateSlice {
    createEntityEvents: CreateEntityEvent[];
    updateEntityEvents: UpdateEntityEvent[];
    killedEntities: Set<string>;

    entityActionsEvents: EntityActionEvent[];
}

class Network {
    private host: string;
    private socket: WebSocket | null;
    private scheduledEvents: Map<NetEvent, string>;
    private reconnectInterval?: NodeJS.Timeout;

    private createEntityEvents: CreateEntityEvent[];
    private updateEntityEvents: UpdateEntityEvent[];
    private killedEntities: Set<string>;
    private entityActionsEvents: EntityActionEvent[];

    private simulatedLatency = 0; //rand.integer(0, 50);
    private simulatedClockDrift = 0; //rand.integer(-300, 300);

    private _ping = 0;
    private _clockOffset = 0;

    get ping() {
        return this._ping;
    }

    get clockOffset() {
        return this._clockOffset;
    }

    get time() {
        return this._rawTime + this.clockOffset;
    }

    private get _rawTime() {
        return Date.now() + this.simulatedClockDrift;
    }

    constructor(host: string) {
        this.createEntityEvents = [];
        this.updateEntityEvents = [];
        this.killedEntities = new Set();
        this.entityActionsEvents = [];

        this.host = host;
        this.socket = null;
        this.scheduledEvents = new Map();

        setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.sendEvent(new ClientPingEvent({ time: this._rawTime }));
            }
        }, 500);
    }

    private _connect() {
        const socket = new WebSocket(this.host);

        socket.addEventListener("open", () => {
            this.scheduledEvents.forEach((message) => {
                socket.send(message);
            });
            this.scheduledEvents.clear();
        });

        socket.addEventListener("message", async (message: MessageEvent<Blob | string>) => {
            const data =
                typeof message.data === "string" ? message.data : await message.data.text();
            const event = NetEvent.parse(data);

            if (!event) {
                return;
            }

            event.latency = this.time - event.time;

            switch (event.type) {
                case EventType.ServiceServerPong:
                    this._ping = Math.round((this._rawTime - event.time) / 2);
                    const clientTime = Math.round((event.time + this._rawTime) / 2);
                    const serverTime = (event as unknown as ServerPongEvent).serverTime;
                    this._clockOffset = serverTime - clientTime;

                    break;

                case EventType.ServiceEntitiesList:
                    (event as unknown as EntitiesListEvent).entities.forEach((event) => {
                        event.latency = this.time - event.time;

                        if (event.type === EventType.EntityCreate) {
                            this.createEntityEvents.push(event as any);
                        } else if (event.type === EventType.EntityUpdate) {
                            this.updateEntityEvents.push(event as any);
                        }
                    });

                    break;

                case EventType.EntityCreate:
                    this.createEntityEvents.push(event as any);

                    break;

                case EventType.EntityUpdate:
                    this.updateEntityEvents.push(event as any);

                    break;

                case EventType.EntityKill:
                    this.killedEntities.add((event as unknown as KillEntityEvent).uuid);

                    break;

                case EventType.EntityAction:
                    this.entityActionsEvents.push(event as any);

                    break;
            }
        });

        socket.addEventListener("close", () => {
            this.socket = null;

            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = setTimeout(() => {
                this.socket = this._connect();
            }, 1000);
        });

        return socket;
    }

    public sendEvent(event: NetEvent) {
        if (event.type !== EventType.ServiceClientPing) {
            event.time = this.time;
        }

        if (this.simulatedLatency > 0) {
            setTimeout(() => {
                this._send(event);
            }, this.simulatedLatency);
        } else {
            this._send(event);
        }
    }

    private _send(event: NetEvent) {
        const message = event.serialize();

        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.scheduledEvents.set(event, message);
            return;
        }

        this.socket.send(message);
    }

    public connect(): Promise<void> {
        return new Promise((res, rej) => {
            this.socket = this._connect();
            this.socket.addEventListener("open", () => {
                res();
            });
            this.socket.addEventListener("error", () => {
                rej();
            });
        });
    }

    public sliceState(): NetworkStateSlice {
        const killedEntities = new Set(this.killedEntities);
        this.killedEntities.clear();

        const updateEvents = this.updateEntityEvents.splice(0, this.updateEntityEvents.length);
        const createEvents = this.createEntityEvents.splice(0, this.createEntityEvents.length);
        const actionEvents = this.entityActionsEvents.splice(0, this.entityActionsEvents.length);

        return {
            createEntityEvents: createEvents,
            updateEntityEvents: updateEvents,
            killedEntities: killedEntities,
            entityActionsEvents: actionEvents,
        };
    }
}

export default new Network(`ws://${document.location.hostname}:8080`);
