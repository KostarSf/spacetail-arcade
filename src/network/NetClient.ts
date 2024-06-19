import { NetEvent } from "./events";

class NetClient {
    private _latency: number = 0;
    private _lastPingTime: number = 0;
    private _timeOffset: number = 0;

    private _simulatedLatency: number = 0;
    private _clockDesync: number = 0;

    private get _now() {
        return Date.now() + this._clockDesync;
    }

    public get latency() {
        return this._latency;
    }

    public get timeOffset() {
        return this._timeOffset;
    }

    public getTime() {
        return this._now + this.timeOffset;
    }

    private _isHost: boolean = false;

    public get isHost() {
        return this._isHost;
    }

    private _offline: boolean = false;

    public get offline() {
        return this._offline;
    }

    private socket: WebSocket;

    private pendingEvents: NetEvent[] = [];

    private onMessageCallback: ((event: NetEvent) => void) | null = null;

    constructor() {
        this.socket = this.openSocket();

        setInterval(() => {
            this._lastPingTime = this._now;
            this.send({ type: "ping", time: this._lastPingTime + this._timeOffset });
        }, 500);
    }

    private openSocket() {
        this.socket = new WebSocket(`ws://${document.location.hostname}:8080`);

        this.socket.onopen = () => {
            this._offline = false;

            for (const event of this.pendingEvents) {
                this.socket.send(JSON.stringify(event));
            }

            this.pendingEvents = [];
        };

        this.socket.onclose = (ev) => {
            this._offline = true;
            console.log(ev);

            setTimeout(() => this.openSocket(), 1000);
        };

        this.socket.onerror = (ev) => {
            console.error(ev);
            document.location.reload();
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
        if (event.type === "server" && event.action === "set-host") {
            this._isHost = event.data.isHost;
            return true;
        }

        if (event.type === "server" && event.action === "pong") {
            const now = this._now;
            this._latency = Math.round((now - this._lastPingTime) / 2);
            const clientTime = Math.round((this._lastPingTime + now) / 2);
            this._timeOffset = event.time - clientTime;
        }

        return false;
    }

    onMessage(callback: (event: NetEvent) => void) {
        this.onMessageCallback = callback;
    }

    send(event: NetEvent) {
        if (this.socket.readyState !== this.socket.OPEN) {
            this.pendingEvents.push(event);
            return;
        }

        if (this._simulatedLatency > 0) {
            setTimeout(() => this.socket.send(JSON.stringify(event)), this._simulatedLatency);
            return;
        }

        this.socket.send(JSON.stringify(event));
    }
}

export const netClient = new NetClient();
