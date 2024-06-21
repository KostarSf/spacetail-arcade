import { Scene, System, SystemType } from "excalibur";
import { Player } from "~/actors/Player";
import { Asteroid } from "~/actors/asteroid";
import { NetActor } from "./NetActor";
import { NetStateComponent } from "./NetStateComponent";
import Network from "./Network";
import { EntityWithStateNetEvent } from "./events";
import { NetEntityType } from "./types";

export class NetSystem extends System {
    systemType: SystemType = SystemType.Update;

    private netActorsMap: Map<string, NetActor>;
    private scene: Scene;

    constructor(scene: Scene) {
        super();

        this.netActorsMap = new Map();
        this.scene = scene;
    }

    update(_elapsedMs: number): void {
        const netState = Network.sliceState();

        netState.killedEntities.forEach((uuid) => {
            const actor = this.netActorsMap.get(uuid);

            if (actor) {
                this.netActorsMap.delete(uuid);
                actor.kill();
            }
        });

        netState.updateEntityEvents.forEach((event) => {
            const actor = this.netActorsMap.get(event.uuid);

            if (!actor) {
                const newActor = NetSystem.instantiateNetActor(event);
                if (newActor) {
                    this.netActorsMap.set(event.uuid, newActor);
                    this.scene.add(newActor);
                }

                return;
            }

            if (actor.isReplica !== event.isReplica) {
                const netState = new NetStateComponent({
                    uuid: event.uuid,
                    isReplica: event.isReplica,
                });
                actor.addComponent(netState, true);
            }
            actor.updateState(event.state, event.latency);
        });

        netState.createEntityEvents.forEach((event) => {
            const existedActor = this.netActorsMap.get(event.uuid);
            if (existedActor) {
                this.netActorsMap.delete(event.uuid);
                existedActor.kill();
            }

            const newActor = NetSystem.instantiateNetActor(event);
            if (newActor) {
                this.netActorsMap.set(event.uuid, newActor);
                this.scene.add(newActor);
            }
        });
    }

    public static instantiateNetActor(event: EntityWithStateNetEvent): NetActor | null {
        switch (event.entityType as NetEntityType) {
            case NetEntityType.Player:
                const player = new Player({ uuid: event.uuid, isReplica: event.isReplica });
                player.updateState(event.state as any, event.latency);

                return player;

            case NetEntityType.Bullet:
                return null;

            case NetEntityType.Asteroid:
                const asteroid = new Asteroid({ uuid: event.uuid, isReplica: event.isReplica });
                asteroid.updateState(event.state as any, event.latency);

                return asteroid;
        }

        return null;
    }
}
