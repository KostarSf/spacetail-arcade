import { CreateEntityNetEvent, NetEvent, NetEventType, UpdateEntityNetEvent } from "./events";

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

    private latency = 50;

    constructor(host: string) {
        this.createEntityEvents = [];
        this.updateEntityEvents = [];
        this.killedEntities = new Set();

        this.host = host;
        this.socket = this.connect();
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

            event.latency = Date.now() - event.time;

            switch (event.type) {
                case NetEventType.EntityCreate:
                    this.createEntityEvents.push(event as CreateEntityNetEvent);
                    break;
                case NetEventType.EntityUpdate:
                    this.updateEntityEvents.push(event as UpdateEntityNetEvent);
                    break;
                case NetEventType.EntityKill:
                    this.killedEntities.add(event.uuid);
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
        event.time = Date.now();
        if (this.latency > 0) {
            setTimeout(() => {
                this.socket.send(event.serialize());
            }, this.latency);
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
