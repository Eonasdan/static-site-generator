/* global Popper */

class LanguageTools {
    tooltip = document.querySelector('#lt-dialog');
    activeMatch = null;

    popperFactory(element) {
        return Popper.createPopper(element, this.tooltip, {
            modifiers: [
                {
                    name: 'offset',
                    options: {
                        offset: [0, 8],
                    },
                },
            ],
        });
    }

    registerMatchClick() {
        [...document.getElementsByClassName(`lt-match`)].forEach((element) => {
            element.addEventListener('click', () => this.show(element));
        });
    }

    hideAndRegisterClick() {
        this.hide();
        this.registerMatchClick();
    }

    ignoreSuggestionHandler() {
    }

    replaceSuggestionHandler = (_, __) => {
    };

    getActiveMatchHandler = (_) => {
    };

    generateSuggestionButton(element) {
        const fragment = document.createDocumentFragment();
        this.activeMatch.replacements.forEach((replacement) => {
            const value = replacement.value;
            const btn = document.createElement('button');
            btn.classList.add(...['btn', 'btn-primary', 'mb-2', 'me-2']);
            btn.innerHTML = value;
            btn.addEventListener('click', () =>
                this.replaceSuggestionHandler(element, value)
            );
            fragment.appendChild(btn);
        });
        return fragment;
    }

    show(element) {
        this.hide();
        this.activeMatch = this.getActiveMatchHandler(element);
        if (!this.activeMatch) return;
        this.activeMatch.element = element;

        const issueType = this.activeMatch.rule?.issueType;

        const toastHeader = this.tooltip.querySelector('.toast-header');
        toastHeader.classList.remove(...toastHeader.classList);
        toastHeader.classList.add('toast-header');

        if (issueType) toastHeader.classList.add(`lt-${issueType}`);

        this.tooltip.querySelector('#lt-title').innerHTML =
            this.activeMatch.shortMessage || this.activeMatch.rule.category.name;

        this.tooltip.querySelector('#lt-description').innerHTML =
            this.activeMatch.message;

        this.tooltip.querySelector('#lt-suggestions').innerHTML = '';

        if (this.activeMatch.replacements?.length > 0)
            this.tooltip
                .querySelector('#lt-suggestions')
                .appendChild(this.generateSuggestionButton(element));

        // Make the tooltip visible
        this.tooltip.setAttribute('data-show', '');

        if (!this.activeMatch.popperInstance)
            this.activeMatch.popperInstance = this.popperFactory(element);

        // Enable the event listeners
        this.activeMatch.popperInstance.setOptions((options) => ({
            ...options,
            modifiers: [
                ...options.modifiers,
                {name: 'eventListeners', enabled: true},
            ],
        }));

        // Update its position
        this.activeMatch.popperInstance.update();
    }

    hide() {
        // Hide the tooltip
        this.tooltip.removeAttribute('data-show');

        // Disable the event listeners
        this.activeMatch?.popperInstance.setOptions((options) => ({
            ...options,
            modifiers: [
                ...options.modifiers,
                {name: 'eventListeners', enabled: false},
            ],
        }));
        this.activeMatch = undefined;
    }

    markText(data, match, index, id) {
        const start = match.offset;
        const end = start + match.length;

        const replaceBetween = (origin, startIndex, endIndex, insertion) =>
            `${origin.substring(0, startIndex)}${insertion}${origin.substring(endIndex)}`;

        const sub = data.substring(start, end);

        const replacement = `<span class="lt-match lt-${match.rule?.issueType}" data-index="${index}" data-id="${id}">${sub}</span>`;

        return replaceBetween(data, start, end, replacement);
    }

    async process(text, id) {
        //todo maybe this is bad. if the user modifies the text, these results will
        //be invalid anyway
        // if (this.processingIds.includes(id)) {
        //   return {
        //     message: 'This block has a pending request',
        //   };
        // }
        // this.processingIds.push(id);

        text = this.cleanupMarkers(text);

        //todo error handling
        try {
            let results = await (await fetch('/lt/check', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                },
                body: text
            })).json();

            const matches = results.matches.sort((a, b) => a.offset > b.offset ? -1 : 1);

            //todo what if matches is empty?
            matches.forEach((match, index) => {
                match.id = index;
                text = this.markText(text, match, index, id);
            });

            return {
                newText: text,
                matches,
            };
        } catch (e) {
            return {
                error: 'something went wrong',
                exception: e
            }
        }
    }

    setup() {
        document
            .getElementById('lt-close')
            .addEventListener('click', this.hide.bind(this));
        document
            .getElementById('lt-ignore')
            .addEventListener('click', this.ignoreSuggestionHandler.bind(this));
    }

    /**
     * If there are an existing marker elements, this should find and remove them.
     * This will make the text clean and easier to re-analyze
     * @param text
     * @return {*}
     */
    cleanupMarkers(text) {
        const holder = document.createElement('div');
        holder.innerHTML = text;

        [...holder.getElementsByClassName('lt-match')].forEach(element => {
            text = text.replace(element.outerHTML, element.innerHTML);
        });

        return text;
    }
}
