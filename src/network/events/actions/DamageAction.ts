import { ActionType, SerializableObject } from "../types";
import { NetAction } from "./NetAction";

export class DamageAction extends NetAction {
    public readonly type: ActionType = ActionType.Damage;

    public damage: number;
    public healthDeflection: number;
    public armorDeflection: number;

    public direction: number | null;

    constructor(data: {
        damage: number;
        healthDeflection?: number;
        armorDeflection?: number;
        direction?: number | null;
    }) {
        super();

        this.damage = data.damage;
        this.healthDeflection = data.healthDeflection ?? 1;
        this.armorDeflection = data.armorDeflection ?? 1;
        this.direction = data.direction ?? null;
    }

    public serialize(): SerializableObject {
        return {
            damage: this.damage,
            healthDeflection: this.healthDeflection,
            armorDeflection: this.armorDeflection,
            direction: this.direction ? Math.round(this.direction * 100) / 100 : null,
        };
    }
}
