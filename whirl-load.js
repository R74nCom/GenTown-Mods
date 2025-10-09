const toolsInitializedEvent = new CustomEvent("tools-initialized", {bubbles: true});

const $wt = {
    __version__: {major: 1, minor: 0, patch: 0},
    modsLoaded: [],
    /**
     * Binds a function after the original function completes.
     * @param {function} toBind The function that is bound.
     * @param {function} runAfter The function to run after the bound function. Has the result of the original function as the first parameter.
     * @returns The function to set the variable to.
     */
    bindAfter: (toBind, runAfter) => {
        const newFunc = function(...args) {
            const result = toBind(...args);
            runAfter(result, ...args);
            return result;
        };
        return newFunc;
    },
    /**
     * Binds a function before the original function completes.
     * @param {function} toBind The function that is bound.
     * @param {*} runBefore The function to run before the bound function.
     * @returns The function to set the variable to.
     */
    bindBefore: (toBind, runBefore) => {
        const newFunc = function(...args) {
            runBefore(...args);
            return toBind(...args);
        };
        return newFunc;
    },
    /**
     * Adds a button to the executive panel.
     * @param {Boolean} at_top If the button should be at the top or bottom of the panel.
     * @param {Boolean} notify If the button should show as a notified button. You must clear this yourself.
     * @param {String} label The label of the button.
     * @param {String} identifier The id of the button.
     * @param {Element?} before The element to put the button before. 
     * Must be in the top/bottom list depending on the value of `at_top`. 
     * 
     * If this value is null or undefined, it'll be the last element in the tree.
     * @returns The button.
     */
    addExecutiveButton: (at_top, notify, label, identifier, before) => {
        var selector;
        if (at_top) {
            selector = document.querySelector('#actionMainList');
        } else {
            selector = document.querySelector('#actionMain').querySelector('div:not(#actionMainList)');
        }
        const newButton = document.createElement('span');
        newButton.className = 'actionItem clickable' + (notify ? ' notify' : '');
        newButton.id = identifier;
        newButton.role = 'button';
        newButton.textContent = label;
        selector.appendChild(newButton);
        if (before) {
            selector.insertBefore(newButton, before);
        }
        return newButton
    }
}

window.whirlLoaderLoaded = true
window.dispatchEvent(toolsInitializedEvent)