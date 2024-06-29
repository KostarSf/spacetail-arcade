import { Actor, Color, Engine } from "excalibur";

export class BlackHole extends Actor {
    constructor() {
        super({
            radius: 100,
            color: Color.Yellow,
        });
    }

    onInitialize(engine: Engine): void {
        this.graphics.material = engine.graphicsContext.createMaterial({
            name: "bh-mat",
            fragmentSource: bgFragment,
        });

        this.on("postupdate", () => {
            this.pos = engine.input.pointers.primary.lastWorldPos;
        });
    }
}

const bgFragment = `
#version 300 es

precision mediump float;

uniform float u_time_ms;
uniform vec2 u_resolution;
uniform vec2 u_graphic_resolution;
uniform sampler2D u_graphic;
uniform sampler2D u_screen_texture;

in vec2 v_uv;
in vec2 v_screenuv;

out vec4 fragColor;

vec2 warp() {
    vec2 localCenter = v_uv - vec2(0.5);
    float distance = length(localCenter);
    vec2 warpedPos = v_screenuv - (localCenter * distance);
    warpedPos.y = -warpedPos.y;
    return warpedPos;
}

void main() {
    vec4 transparent = vec4(0., 0., 0., 0.);
    vec4 dark = vec4(0.1, 0.1, 0.1, 0.9);
    vec4 black = vec4(0.0, 0.0, 0.0, 1.0);

    vec2 localCenter = v_uv - vec2(0.5);
    float distance = length(localCenter);
    float blend = 1.0 - pow(max(0.0, abs(distance) * 2.0 - 0.5), 0.5) * 1.5;
    float blend2 = 1.0 - pow(max(0.0, abs(distance) * 2.0 - 0.5), 0.3) * 1.5;

    vec2 v2 = v_screenuv + v_uv * 0.1;

    vec2 warpedPos = v2 - (localCenter * distance);
    warpedPos.y = -warpedPos.y;

    vec4 t = texture(u_screen_texture, warpedPos);
    vec4 wt = mix(t, dark, 0.2);

    fragColor = mix(transparent, wt, blend);// mix(mix(transparent, wt, blend), black, blend2);
}
`.trim();
