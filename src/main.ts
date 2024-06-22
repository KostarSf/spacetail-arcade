import { Color, DisplayMode, Engine } from "excalibur";
import Network from "./network/Network";
import { registerNetEvents } from "./network/events/registry";
import { loader } from "./resources";
import { NetScene } from "./scenes/NetScene";

class Game extends Engine {
    constructor() {
        super({
            width: 400,
            height: 600,
            displayMode: DisplayMode.FitContainerAndFill,
            antialiasing: false,
            backgroundColor: Color.Black,
            canvasElementId: "game",
            scenes: {
                [NetScene.Key]: {
                    scene: NetScene,
                },
            },
            fixedUpdateFps: 50,
        });
    }

    initialize() {
        registerNetEvents();
        this.start(loader).then(async () => {
            await Network.connect();

            this.goToScene(NetScene.Key);
        });
    }
}

export const game = new Game();
game.initialize();
