import { Color, DisplayMode, Engine, Keys } from "excalibur";
import Network from "./network/Network";
import { registerNetEvents } from "./network/events/registry";
import { loader } from "./resources";
import { NetScene } from "./scenes/NetScene";

class Game extends Engine {
    constructor() {
        super({
            width: 400,
            height: 800,
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
            this.input.keyboard.on("press", (evt) => {
                if (evt.key === Keys.P) {
                    this.toggleDebug();
                }
            });

            const wsHost = import.meta.env.PROD ? "wss://ws.spacetail.kostarlab.ru/" : "ws://localhost:8080";httpshttps
            await Network.connect(wsHost);

            this.goToScene(NetScene.Key);
        });
    }
}

export const game = new Game();
game.initialize();
