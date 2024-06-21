import { Query, Scene, System, SystemType, World } from "excalibur";
import { Player } from "~/actors/Player";
import { Asteroid } from "~/actors/asteroid";
import { Bullet } from "~/actors/bullet";
import { NetActor } from "./NetActor";
import { NetStateComponent } from "./NetStateComponent";
import Network from "./Network";
import { EntityWithStateNetEvent } from "./events";
import { NetEntityType } from "./types";

export class NetSystem extends System {
    systemType: SystemType = SystemType.Update;

    private netActors: Map<string, NetActor>;

    private scene!: Scene;
    private query!: Query<typeof NetStateComponent>;

    constructor() {
        super();
        this.netActors = new Map();
    }

    initialize(world: World, scene: Scene<unknown>): void {
        this.scene = scene;
        this.query = world.query([NetStateComponent]);

        this.query.entityAdded$.subscribe((entity) => {
            const actor = entity as NetActor;
            if (!this.netActors.has(actor.uuid)) {
                this.netActors.set(actor.uuid, actor);
            }
        });
        this.query.entityRemoved$.subscribe((entity) => {
            this.netActors.delete(entity.get(NetStateComponent).uuid);
        });
    }

    update(_elapsedMs: number): void {
        const netState = Network.sliceState();

        netState.createEntityEvents.forEach((event) => {
            const existedActor = this.netActors.get(event.uuid);
            if (existedActor) {
                this.netActors.delete(event.uuid);
                existedActor.kill();
            }

            const newActor = this.instantiateNetActor(event);
            if (newActor) {
                this.netActors.set(event.uuid, newActor);
                this.scene.add(newActor);
            }
        });

        netState.updateEntityEvents.forEach((event) => {
            const actor = this.netActors.get(event.uuid);

            if (!actor) {
                const newActor = this.instantiateNetActor(event);
                if (newActor) {
                    this.netActors.set(event.uuid, newActor);
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
            actor.updateState(event.state, event.latency, this.netActors);
        });

        netState.entityActionsEvents.forEach((event) => {
            const actor = this.netActors.get(event.uuid);
            console.log(actor?.isKilled(), actor);

            if (!actor || actor.isKilled()) {
                return;
            }

            actor._receiveAction(event.action, event.latency);
        });

        netState.killedEntities.forEach((uuid) => {
            const actor = this.netActors.get(uuid);

            if (actor) {
                this.netActors.delete(uuid);
                actor.kill();
            }
        });
    }

    private instantiateNetActor(event: EntityWithStateNetEvent): NetActor | null {
        switch (event.entityType as NetEntityType) {
            case NetEntityType.Player:
                const player = new Player({ uuid: event.uuid, isReplica: event.isReplica });
                player.updateState(event.state as any, event.latency);

                return player;

            case NetEntityType.Bullet:
                const bullet = new Bullet({ uuid: event.uuid, isReplica: event.isReplica });
                bullet.updateState(event.state as any, event.latency, this.netActors);

                return bullet;

            case NetEntityType.Asteroid:
                const asteroid = new Asteroid({ uuid: event.uuid, isReplica: event.isReplica });
                asteroid.updateState(event.state as any, event.latency);

                return asteroid;
        }

        return null;
    }
}
