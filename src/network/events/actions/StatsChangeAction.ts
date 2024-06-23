import { ActionType, SerializableObject } from "../types";
import { NetAction } from "./NetAction";

export interface StatsChangeState extends SerializableObject {
    health: number;
    // maxHealth: number;
    // healthRecoverySpeed: number;

    power: number;
    // maxPower: number;
    // powerRecoverySpeed: number;

    // healthResistance: number;
    // armorResistance: number;

    hardness: number;
}

export class StatsChangeAction extends NetAction {
    public type: ActionType = ActionType.StatsChange;

    health: number;
    // maxHealth: number;
    // healthRecoverySpeed: number;

    power: number;
    // maxPower: number;
    // powerRecoverySpeed: number;

    // healthResistance: number;
    // armorResistance: number;

    hardness: number;

    constructor(state: StatsChangeState) {
        super();

        this.health = state.health;
        // this.maxHealth = state.maxHealth;
        // this.healthRecoverySpeed = state.healthRecoverySpeed;

        this.power = state.power;
        // this.maxPower = state.maxPower;
        // this.powerRecoverySpeed = state.powerRecoverySpeed;

        // this.healthResistance = state.healthResistance;
        // this.armorResistance = state.armorResistance;

        this.hardness = state.hardness;
    }

    public serialize(): StatsChangeState {
        return {
            health: this.health,
            // maxHealth: this.maxHealth,
            // healthRecoverySpeed: this.healthRecoverySpeed,

            power: this.power,
            // maxPower: this.maxPower,
            // powerRecoverySpeed: this.powerRecoverySpeed,

            // healthResistance: this.healthResistance,
            // armorResistance: this.armorResistance,

            hardness: this.hardness,
        };
    }
}
