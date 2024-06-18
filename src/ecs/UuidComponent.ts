import { Component } from "excalibur";
import { v4 } from "uuid";

export class UuidComponent extends Component {
    public readonly uuid: string;

    constructor(uuid?: string) {
        super();
        this.uuid = uuid ?? v4();
    }
}
