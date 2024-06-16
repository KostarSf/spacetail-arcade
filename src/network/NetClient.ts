class NetClient {
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

        this.socket.onmessage = async (event: MessageEvent<Blob | string>) => {
            if (!this.onMessageCallback) {
                return;
            }

            try {
                const data = typeof event.data === "string" ? event.data : await event.data.text();
                this.onMessageCallback(JSON.parse(data));
            } catch (error) {
                console.error(error);
            }
        };

        return this.socket;
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

export type NetEntityEvent = {
    type: "entity";
    target: string;
} & (
    | {
          action: "update";
          data: {
              pos: [number, number];
              vel: [number, number];
              rotation: number;
          };
      }
    | { action: "remove" }
);

export type NetShipEvent = {
    type: "ship";
    target: string;
};
// & (
//     | {
//           action: "fire";
//           data: {
//               object: "Bullet";
//               objectPos: [number, number];
//               objectVel: [number, number];
//               pos: [number, number];
//               vel: [number, number];
//               rotation: number;
//           };
//       }
//     | {
//           action: "accelerated";
//           data: {
//               value: boolean;
//               pos: [number, number];
//               vel: [number, number];
//               rotation: number;
//           };
//       }
//     | {
//           action: "rotated";
//           data: {
//               pos: [number, number];
//               vel: [number, number];
//               rotation: number;
//           };
//       }
// );

export type NetPlayerEvent = {
    type: "player";
    target: string;
} & (
    | {
          action: "spawn";
          data: {
              pos: [number, number];
              vel: [number, number];
              rotation: number;
          };
      }
    | {
          action: "fire";
          data: {
              object: "Bullet";
              objectPos: [number, number];
              objectVel: [number, number];
              pos: [number, number];
              vel: [number, number];
              rotation: number;
          };
      }
    | {
          action: "accelerated";
          data: {
              value: boolean;
              pos: [number, number];
              vel: [number, number];
              rotation: number;
          };
      }
    | {
          action: "rotated";
          data: {
              pos: [number, number];
              vel: [number, number];
              rotation: number;
          };
      }
);

export type NetServerEvent = {
    type: "server";
    target: string;
} & {
    action: "players-list";
    data: { uuid: string; pos: [number, number]; vel: [number, number]; rotation: number }[];
};

export type NetEvent = NetShipEvent | NetPlayerEvent | NetEntityEvent | NetServerEvent;
