import { ActionType, SerializableObject } from "../types";

export abstract class NetAction {
    public abstract readonly type: ActionType;

    public abstract serialize(): SerializableObject;

    private static registry: Map<ActionType, new (data: any) => NetAction> = new Map();

    public static register(type: ActionType, ctor: new (data: any) => NetAction) {
        NetAction.registry.set(type, ctor);
    }

    public static parse(data: SerializableObject, type: ActionType): NetAction | null {
        const ctor = NetAction.registry.get(type);
        if (!ctor) {
            console.error(`Unknown action type: ${type}`);
            return null;
        }

        return new ctor(data);
    }
}
