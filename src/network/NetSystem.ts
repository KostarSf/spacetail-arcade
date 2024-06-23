import { Query, Scene, System, SystemType, World } from "excalibur";
import { Asteroid } from "~/actors/Asteroid";
import { Bullet } from "~/actors/Bullet";
import { Player } from "~/actors/Player";
import { NetActor } from "./NetActor";
import { NetStateComponent } from "./NetStateComponent";
import Network from "./Network";
import { EntityWithStateEvent } from "./events/EntityWithStateEvent";
import { ActorType } from "./types";

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

            const newActor = NetSystem.instantiateActor(event, this.netActors);
            if (newActor) {
                this.netActors.set(event.uuid, newActor);
                this.scene.add(newActor);
            }
        });

        netState.updateEntityEvents.forEach((event) => {
            const actor = this.netActors.get(event.uuid);

            if (!actor) {
                const newActor = NetSystem.instantiateActor(event, this.netActors);
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

    private static actorsRegistry: Map<
        ActorType,
        new (data: { uuid?: string; isReplica?: boolean }) => NetActor
    > = new Map();

    public static registerActor(
        type: ActorType,
        ctor: new (data: { uuid?: string; isReplica?: boolean }) => NetActor
    ) {
        this.actorsRegistry.set(type, ctor);
    }

    private static instantiateActor(event: EntityWithStateEvent, netActors: Map<string, NetActor>) {
        const ctor = this.actorsRegistry.get(event.entityType);
        if (!ctor) {
            console.error(`Unknown actor type: ${event.entityType}`);
            return null;
        }

        const actor = new ctor({ uuid: event.uuid, isReplica: event.isReplica });
        actor.updateState(event.state, event.latency, netActors);

        return actor;
    }
}

NetSystem.registerActor(ActorType.Player, Player);
NetSystem.registerActor(ActorType.Asteroid, Asteroid);
NetSystem.registerActor(ActorType.Bullet, Bullet);
