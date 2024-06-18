import { Component, MotionComponent, TransformComponent, Vector } from "excalibur";

export class ShipComponent extends Component {
    accelerated: boolean = false;

    private _energy: number = 100;
    energyRate: number = 40;
    energyLimit: number = 100;

    get energy() {
        return this._energy;
    }

    set energy(value: number) {
        this._energy = Math.max(0, Math.min(value, this.energyLimit));
    }

    rotationTarget: Vector | null = null;

    readonly dependencies = [TransformComponent, MotionComponent];

    constructor() {
        super();
    }

    consumeEnergy(amount: number, params?: { allowPartial?: boolean; force?: boolean }): boolean {
        amount = Math.abs(amount);

        if (params?.force) {
            this.energy -= amount;
            return true;
        }

        if (params?.allowPartial && this.energy > 0) {
            this.energy -= amount;
            return true;
        }

        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }

        return false;
    }
}
