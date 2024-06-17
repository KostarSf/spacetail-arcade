import { Color, DisplayMode, Engine } from "excalibur";
import { loader } from "./resources";
import { GameLevel } from "./scenes/GameLevel";

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
                "game-level": {
                    scene: GameLevel,
                },
            },
        });
    }

    initialize() {
        this.start(loader).then(() => {
            this.goToScene("game-level");
        });
    }
}

export const game = new Game();
game.initialize();
