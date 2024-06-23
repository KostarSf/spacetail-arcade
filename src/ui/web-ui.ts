class WebUiElement {
    public htmlElement: HTMLElement;

    constructor(id: string) {
        this.htmlElement = document.getElementById(id)!;
    }

    setText(text: string) {
        this.htmlElement.innerHTML = text;
    }
}

export const UI = {
    debugText: new WebUiElement("debug-text"),
};
