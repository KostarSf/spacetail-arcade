import { ActionType, SerializableObject } from "../types";
import { NetAction } from "./NetAction";

export class DamageAction extends NetAction {
    public readonly type: ActionType = ActionType.Damage;

    public amount: number;
    public direction: number | null;

    constructor(data: { amount: number; direction?: number | null }) {
        super();

        this.amount = data.amount;
        this.direction = data.direction ?? null;
    }

    public serialize(): SerializableObject {
        return {
            amount: this.amount,
            direction: this.direction ? Math.round(this.direction * 100) / 100 : null,
        };
    }
}
