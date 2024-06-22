import { ActorType } from "../types";
import { EntityEvent, EntityEventOptions } from "./EntityEvent";
import { NetAction } from "./actions/NetAction";
import { ActionType, EventType, SerializableObject } from "./types";

export interface EntityActionEventOptions<T extends NetAction> extends EntityEventOptions {
    entityType: ActorType;
    action: T;
}

export class EntityActionEvent<T extends NetAction = never> extends EntityEvent<{
    actionType: ActionType;
    action: SerializableObject;
}> {
    public readonly type: EventType = EventType.EntityAction;

    actionType: ActionType;
    action: T;

    constructor(data: EntityActionEventOptions<T>) {
        super(data);
        this.actionType = data.action.type;
        this.action = data.action;
    }

    protected prepareSerializableData(): { uuid: string; entityType: ActorType } & {
        actionType: ActionType;
        action: SerializableObject;
    } {
        return {
            uuid: this.uuid,
            entityType: this.entityType,
            actionType: this.actionType,
            action: this.action.serialize(),
        };
    }

    public static parseState<T extends NetAction>(
        data: { uuid: string; entityType: ActorType } & {
            actionType: ActionType;
            action: SerializableObject;
        }
    ): EntityActionEventOptions<T> | null {
        const action = NetAction.parse(data.action, data.actionType);
        if (!action) {
            return null;
        }

        return { ...data, action: action as any };
    }
}
