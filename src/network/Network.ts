import { rand } from "~/utils/math";
import {
    ClientPingNetEvent,
    CreateEntityNetEvent,
    KillEntityNetEvent,
    NetEvent,
    NetEventType,
    ServerPongNetEvent,
    UpdateEntityNetEvent,
} from "./events";

export interface NetworkStateSlice {
    createEntityEvents: CreateEntityNetEvent[];
    updateEntityEvents: UpdateEntityNetEvent[];
    killedEntities: Set<string>;
}

class Network {
    private host: string;
    private socket: WebSocket;

    private createEntityEvents: CreateEntityNetEvent[];
    private updateEntityEvents: UpdateEntityNetEvent[];
    private killedEntities: Set<string>;

    private simulatedLatency = rand.integer(0, 30);
    private simulatedClockDrift = rand.integer(-300, 300);

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

        this.host = host;
        this.socket = this.connect();

        setInterval(() => {
            this.sendEvent(new ClientPingNetEvent({ time: this._rawTime }));
        }, 500);
    }

    private connect() {
        const socket = new WebSocket(this.host);

        socket.onmessage = async (message: MessageEvent<Blob | string>) => {
            const data =
                typeof message.data === "string" ? message.data : await message.data.text();
            const event = NetEvent.parse(data);

            if (!event) {
                return;
            }

            event.latency = this.time - event.time;

            switch (event.type) {
                case NetEventType.ServiceServerPong:
                    this._ping = Math.round((this._rawTime - event.time) / 2);
                    const clientTime = Math.round((event.time + this._rawTime) / 2);
                    const serverTime = (event as ServerPongNetEvent).serverTime;
                    this._clockOffset = serverTime - clientTime;
                    break;
                case NetEventType.EntityCreate:
                    this.createEntityEvents.push(event as CreateEntityNetEvent);
                    break;
                case NetEventType.EntityUpdate:
                    this.updateEntityEvents.push(event as UpdateEntityNetEvent);
                    break;
                case NetEventType.EntityKill:
                    this.killedEntities.add((event as KillEntityNetEvent).uuid);
                    break;
            }
        };

        socket.onclose = () => {
            setTimeout(() => {
                this.socket = this.connect();
            });
        };

        return socket;
    }

    public sendEvent(event: NetEvent) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        if (event.type !== NetEventType.ServiceClientPing) {
            event.time = this.time;
        }

        if (this.simulatedLatency > 0) {
            setTimeout(() => {
                this.socket.send(event.serialize());
            }, this.simulatedLatency);
        } else {
            this.socket.send(event.serialize());
        }
    }

    public sliceState(): NetworkStateSlice {
        const killedEntities = new Set(this.killedEntities);
        this.killedEntities.clear();

        const updateEvents = this.updateEntityEvents.splice(0, this.updateEntityEvents.length);
        const createEvents = this.createEntityEvents.splice(0, this.createEntityEvents.length);

        return {
            createEntityEvents: createEvents,
            updateEntityEvents: updateEvents,
            killedEntities: killedEntities,
        };
    }
}

export default new Network(`ws://${document.location.hostname}:8080`);
