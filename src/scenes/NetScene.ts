import { Engine, Scene, vec } from "excalibur";
import { Player } from "~/actors/Player";
import { NetPhysicsSystem } from "~/ecs/physics.ecs";
import { NetSystem } from "~/network/NetSystem";
import { rand } from "~/utils/math";

export class NetScene extends Scene {
    public static readonly Key = "net-scene";

    constructor() {
        super();
    }

    onInitialize(_engine: Engine): void {
        this.world.add(new NetSystem(this.world, this));
        this.world.add(NetPhysicsSystem)

        this.add(
            new Player({
                pos: vec(rand.integer(50, 350), rand.integer(50, 350)),
            })
        );
    }
}
