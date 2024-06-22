import { ClientPingEvent } from "./ClientPingEvent";
import { CreateEntityEvent } from "./CreateEntityEvent";
import { EntitiesListEvent } from "./EntitiesListEvent";
import { EntityActionEvent } from "./EntityActionEvent";
import { KillEntityEvent } from "./KillEntityEvent";
import { NetEvent } from "./NetEvent";
import { ServerPongEvent } from "./ServerPongEvent";
import { UpdateEntityEvent } from "./UpdateEntityEvent";
import { DamageAction } from "./actions/DamageAction";
import { NetAction } from "./actions/NetAction";
import { ActionType, EventType } from "./types";

export function registerNetEvents() {
    NetEvent.register(EventType.ServiceClientPing, ClientPingEvent);
    NetEvent.register(EventType.ServiceServerPong, ServerPongEvent);
    NetEvent.register(
        EventType.ServiceEntitiesList,
        EntitiesListEvent,
        EntitiesListEvent.parseState
    );

    NetEvent.register(EventType.EntityCreate, CreateEntityEvent);
    NetEvent.register(EventType.EntityUpdate, UpdateEntityEvent);
    NetEvent.register(EventType.EntityKill, KillEntityEvent);

    NetEvent.register(EventType.EntityAction, EntityActionEvent, EntityActionEvent.parseState);

    NetAction.register(ActionType.Damage, DamageAction);
}
