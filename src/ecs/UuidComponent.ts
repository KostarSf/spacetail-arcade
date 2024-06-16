import { Component } from "excalibur";

export class UuidComponent extends Component {
    public readonly uuid: string;

    constructor(uuid?: string) {
        super();
        this.uuid = uuid ?? crypto.randomUUID();
    }
}
