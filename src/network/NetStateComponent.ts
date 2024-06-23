import { Component } from "excalibur";
import { v4 } from "uuid";
import type { NetActor } from "~/network/NetActor";

export interface NetComponentOptions {
    uuid?: string;
    isReplica?: boolean;
}

export class NetStateComponent extends Component {
    public readonly uuid: string;
    public readonly isReplica: boolean;

    // Перенести код из NetActor в NetSystem
    // public stale: boolean

    get actor() {
        return this.owner as NetActor;
    }

    constructor(options?: NetComponentOptions) {
        super();

        this.uuid = options?.uuid ?? v4();
        this.isReplica = options?.isReplica ?? false;
    }
}
