/**
 * Marker element to make sanitizer happy
 */
class Marker {
    constructor({_}) {
    }

    /**
     * Specifies Tool as Inline Toolbar Tool
     *
     * @return {boolean}
     */
    static get isInline() {
        return true;
    }

    render() {
        return;
    }
    surround(_) {
    }
    wrap(_) {
    }
    unwrap(_) {
    }
    checkState() {
    }
    get toolboxIcon() {
        return '';
    }

    /**
     * Sanitizer rule
     * @return {{span: {class: string}}}
     */
    static get sanitize() {
        return {
            span: {
                class: true, //'lt-match',
                'data-index': true,
                'data-id': true,
            },
        };
    }
}
