import { Query, Scene, System, SystemType, World } from "excalibur";
import { Player } from "~/actors/Player";
import { Asteroid } from "~/actors/asteroid";
import { NetActor } from "./NetActor";
import { NetComponent } from "./NetComponent";
import Network from "./Network";
import { EntityWithStateNetEvent } from "./events";
import { NetEntityType } from "./types";

export class NetSystem extends System {
    systemType: SystemType = SystemType.Update;

    private query: Query<typeof NetComponent>;
    private netActorsMap: Map<string, NetActor>;

    private scene: Scene;

    constructor(world: World, scene: Scene) {
        super();
        this.query = world.query([NetComponent]);
        this.netActorsMap = new Map();

        this.scene = scene;

        this.query.entityAdded$.subscribe((actor) => {
            this.netActorsMap.set(actor.get(NetComponent).uuid, actor as NetActor);
        });
        this.query.entityRemoved$.subscribe((actor) => {
            this.netActorsMap.delete(actor.get(NetComponent).uuid);
        });
    }

    update(_elapsedMs: number): void {
        let actor: NetActor;

        const netState = Network.sliceState();

        const actors = this.query.entities as NetActor[];
        for (let i = 0; i < actors.length; i++) {
            actor = actors[i];

            if (netState.killedEntities.has(actor.uuid)) {
                actor.kill();
            }
        }

        netState.updateEntityEvents.forEach((event) => {
            const existedActor = this.netActorsMap.get(event.uuid);
            if (existedActor) {
                existedActor.addComponent(
                    new NetComponent({ uuid: event.uuid, isReplica: event.isReplica }),
                    true
                );
                existedActor.updateState(event.state, event.latency);

                return;
            }

            const newActor = NetSystem.instantiateNetActor(event);
            if (newActor) {
                this.scene.add(newActor);
            }
        });

        netState.createEntityEvents.forEach((event) => {
            const existedActor = this.netActorsMap.get(event.uuid);
            if (existedActor) {
                existedActor.kill();
            }

            const newActor = NetSystem.instantiateNetActor(event);
            if (newActor) {
                this.scene.add(newActor);
            }
        });
    }

    public static instantiateNetActor(event: EntityWithStateNetEvent) {
        let actor: NetActor | null = null;

        switch (event.entityType as NetEntityType) {
            case NetEntityType.Player:
                actor = NetActor.fromEventState(new Player(), event);

                break;

            case NetEntityType.Bullet:
                break;

            case NetEntityType.Asteroid:
                actor = NetActor.fromEventState(new Asteroid(), event);

                break;
        }

        return actor;
    }
}
