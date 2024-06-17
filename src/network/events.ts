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

export type NetPlayerEvent = {
    type: "player";
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
} & (
    | {
          action: "set-host";
          data: {
              isHost: boolean;
          };
      }
    | {
          action: "players-list";
          data: { uuid: string; pos: [number, number]; vel: [number, number]; rotation: number }[];
      }
);

export type NetEvent = NetPlayerEvent | NetEntityEvent | NetServerEvent;
