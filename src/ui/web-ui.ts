interface WebUiElementOptions {
    color?: string;
    size?: number;
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    align?: "left" | "right" | "center";
}

class WebUiElement {
    public htmlElement: HTMLElement;

    constructor(id: string, options: WebUiElementOptions = {}) {
        let element = document.getElementById(id);
        if (!element) {
            element = document.createElement("p");
            element.id = id;

            this.wrapper.appendChild(element);
        }

        element.style.color = options.color ?? "white";
        element.style.fontSize = `${options.size ?? 16}px`;
        element.style.textAlign = options.align ?? "left";

        element.style.top = options.top !== undefined ? `${options.top}px` : "";
        element.style.right = options.right !== undefined ? `${options.right}px` : "";
        element.style.bottom = options.bottom !== undefined ? `${options.bottom}px` : "";
        element.style.left = options.left !== undefined ? `${options.left}px` : "";

        if (
            options.top !== undefined ||
            options.right !== undefined ||
            options.left !== undefined ||
            options.bottom !== undefined
        ) {
            element.style.position = "absolute";
        }

        this.htmlElement = element;
    }

    setText(text: string) {
        if (this.htmlElement.innerHTML !== text) {
            this.htmlElement.innerHTML = text;
        }
    }

    private get wrapper() {
        return document.getElementById("ui-wrapper")!;
    }
}

export const UI = {
    debugText: new WebUiElement("debug-text", { color: "#5a5a5a" }),
    xpText: new WebUiElement("xp-text", { bottom: 40, left: 20, size: 24 }),
    levelText: new WebUiElement("level-text", { bottom: 40, right: 20, align: "right", size: 32 }),
};
