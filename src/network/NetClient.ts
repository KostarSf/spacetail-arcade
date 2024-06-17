import { NetEvent } from "./events";

class NetClient {
    private _isHost: boolean = false;

    public get isHost() {
        return this._isHost;
    }

    private socket: WebSocket;

    private pendingEvents: NetEvent[] = [];

    private onMessageCallback: ((event: NetEvent) => void) | null = null;

    constructor() {
        this.socket = this.openSocket();
    }

    private openSocket() {
        this.socket = new WebSocket("ws://localhost:8080");

        this.socket.onopen = () => {
            for (const event of this.pendingEvents) {
                this.socket.send(JSON.stringify(event));
            }

            this.pendingEvents = [];
        };

        this.socket.onclose = (ev) => {
            console.log(ev);
            setTimeout(() => this.openSocket(), 1000);
        };

        this.socket.onerror = (ev) => {
            console.error(ev);
        };

        this.socket.onmessage = async (message: MessageEvent<Blob | string>) => {
            try {
                const event = await this.parseEvent(message);
                const processed = this.processIfServiceEvent(event);

                if (processed || !this.onMessageCallback) {
                    return;
                }

                this.onMessageCallback(event);
            } catch (error) {
                console.error(error);
            }
        };

        return this.socket;
    }

    private async parseEvent(event: MessageEvent<Blob | string>): Promise<NetEvent> {
        const data = typeof event.data === "string" ? event.data : await event.data.text();
        return JSON.parse(data);
    }

    private processIfServiceEvent(event: NetEvent) {
        if (event.type !== "server" || event.action !== "set-host") {
            return false;
        }

        this._isHost = event.data.isHost;
        return true;
    }

    onMessage(callback: (event: NetEvent) => void) {
        this.onMessageCallback = callback;
    }

    send(event: NetEvent) {
        if (this.socket.readyState !== this.socket.OPEN) {
            this.pendingEvents.push(event);
            return;
        }

        this.socket.send(JSON.stringify(event));
    }
}

export const netClient = new NetClient();
