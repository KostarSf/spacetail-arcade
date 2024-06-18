import { AsteroidSerialize } from "~/actors/asteroid";

export type AsteroidEntityEventData = {
    class: "Asteroid";
    time: number;
    args: AsteroidSerialize;
};

export type EntityEventData = AsteroidEntityEventData;

export type NetEntityEvent = {
    type: "entity";
    target: string;
    time: number;
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
    | {
          action: "spawn";
          data: AsteroidEntityEventData;
      }
);

export type NetPlayerEvent = {
    type: "player";
    target: string;
    time: number;
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
              objectUuid: string;
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
    time: number;
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
    | {
          action: "entities-list";
          data: EntityEventData[];
      }
);

export type NetEvent = NetPlayerEvent | NetEntityEvent | NetServerEvent;
