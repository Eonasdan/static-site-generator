/* global Header, Checklist, List, ImageTool, CodeTool, InlineCode, Prism, EditorJS, eonasdan, Marker */

/** @typedef {object} SiteConfig
 * @property {object} site
 * @property {string} site.root
 * @property {string} site.subfolder
 * @property {object} output
 * @property {string} output.main
 * @property {string} output.posts
 * @property {string} source
 * @property {object} server
 * @property {string} server.serveFrom
 * @property {number} server.port
 * @property {object} defaultAuthor
 * @property {string} defaultAuthor.name
 * @property {string} defaultAuthor.url
 * @property {string} defaultAuthor.avatar
 * @property {string} defaultAuthor.bio
 * @property {object} services
 * @property {boolean} services.languageTools
 */

/**
 * @typedef {object} BlockLanguageToolData
 * @property {string} id - Editor Js Block Id
 * @property {string} hash - MD5 hash of block text
 */

class Editor {
    previewButton = document.getElementById('previewButton');
    editorDiv = document.getElementById('editorContainer');
    outputDiv = document.getElementById('output');
    tagUl = document.getElementById('tagsContainer');
    form = document.getElementById('postMetaForm');
    postDate = document.getElementById('postDate');
    areYouSureModalConfirm = document.getElementById('areYouSureModalConfirm');
    areYouSureModalClose = document.getElementById('areYouSureModalClose');
    excerpt = document.getElementById('excerpt');
    excerptLow = document.getElementById('excerptLow');
    excerptHigh = document.getElementById('excerptHigh');
    thumbnailHelp = document.getElementById('thumbnailHelp');
    clearButton = document.getElementById('clearButton');
    saveButton = document.getElementById('save');
    runLtButton = document.getElementById('runLt');

    toastyContainer = document.getElementById('toasty');
    toasty = new bootstrap.Toast(this.toastyContainer);
    toastyClasses = [...this.toastyContainer.classList];

    pageId;
    channel;

    /**
     *
     * @type {SiteConfig}
     */
    config = undefined;

    languageTools = new LanguageTools();

    /**
     *
     * @type {BlockLanguageToolData[]}
     */
    blockLanguageToolData = [];
    updatingBlock = false;

    img = new Image();
    fileReader = new FileReader();
    formatter = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    });

    constructor() {
        this.languageTools.ignoreSuggestionHandler =
            this.ignoreSuggestionHandler.bind(this);

        this.languageTools.replaceSuggestionHandler =
            this.replaceSuggestionHandler.bind(this);

        this.languageTools.getActiveMatchHandler =
            this.getActiveMatchHandler.bind(this);

        this.languageTools.setup();

        this.channel = new BroadcastChannel('editor');

        this.channel.onmessage = (event) => {
            console.log('onmessage', event)
            if (event.data === `editorReady`) {
                if (!this.pageId) {
                    this.pageId = 'preview';
                    this.saveButton.classList.add('d-none');
                    this.runLtButton.classList.add('d-none');
                    this.clearButton.classList.add('d-none');
                    document.getElementById('previewGroup').classList.add('d-none');
                    this.toggleShow(this.editorDiv, this.outputDiv);
                }
            }
            if (event.data.html) {
                document.getElementById('previewContent').innerHTML = event.data.html;
                Prism.highlightAll();
            }
        }
    }

    dateForInput = () => {
        return new Date().toISOString().slice(0, -14)
    }

    areYouSureModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('areYouSureModal'));

    editor = undefined

    async readyAsync() {
        this.config = await this.fiddo('/config');
        if (!this.config.services.languageTools) document.getElementById('runLt').classList.add('d-none');

        // noinspection JSValidateTypes
        Prism.plugins.autoloader.languages_path = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.28.0/';

        this.registerEventListeners();

        this.setupEditor();

        this.fileReader.addEventListener("load", (e) => {
            document.querySelector('#post-thumbnail img').src = e.target.result;

            this.img.onload = () => {
                this.thumbnailHelp.classList.remove('show', 'hide');
                if (this.img.width < 1200)
                    this.thumbnailHelp.classList.add('show');
                this.thumbnailHelp.classList.add('hide');
            };

            // noinspection JSValidateTypes
            this.img.src = e.target.result; // is the data URL because called with readAsDataURL

        }, false);

        this.restoreForm();

        if (!this.postDate.value) {
            this.postDate.value = this.dateForInput();
            this.postDate.blur();
        }
    }

    registerEventListeners() {
        this.excerpt.addEventListener('keydown', this.updateExcerpt.bind(this));

        this.previewButton.addEventListener('click', () => {
            if (this.previewButton.innerText === 'Preview') {
                this.editor.save().then(data => {
                    document.getElementById('previewContent').innerHTML = eonasdan.parser(data.blocks);
                    Prism.highlightAll();
                });
            }

            this.previewButton.innerText = this.previewButton.innerText === 'Preview' ? 'Editor' : 'Preview';

            this.toggleShow(this.editorDiv, this.outputDiv);
        });

        document.getElementById('previewNewButton').addEventListener('click', () => {
            this.pageId = 'editor';
            const w = window.open(window.location.href, "_blank");
            w.addEventListener('DOMContentLoaded', () => {
                this.channel.postMessage('editorReady');
            });
            document.getElementById('previewGroup').classList.add('d-none');
        });

        this.clearButton.addEventListener('click', () => {
            this.areYouSureModal.show();

            const cancel = () => {
                this.areYouSureModalClose.removeEventListener('click', cancel);
            }

            this.areYouSureModalConfirm.addEventListener('click', this.clear.bind(this));
            this.areYouSureModalClose.addEventListener('click', cancel);
        });

        document.getElementById('postMeta').querySelectorAll('input, textarea').forEach(e => {
            e.addEventListener('blur', this.metaBlur.bind(this));
        });

        this.saveButton.addEventListener('click', this.savePost.bind(this));

        this.runLtButton.addEventListener('click', async () => {
            const data = await this.editor.save();
            this.languageToolCheck(data);
        });

    }

    setupEditor() {
        const draftEditor = JSON.parse(localStorage.getItem('draft-editor') || '{}');
        this.blockLanguageToolData = JSON.parse(localStorage.getItem('lt-data')) || [];

        // noinspection JSUnusedGlobalSymbols
        this.editor = new EditorJS({
            logLevel: 'ERROR',
            holder: 'editorjs',
            placeholder: 'Let`s write an awesome story!',
            //todo proper async
            onChange: async () => await this.onEditorSave(),
            tools: {
                maker: {
                    class: Marker,
                },
                header: Header,
                checklist: {
                    class: Checklist,
                    inlineToolbar: true,
                },
                list: {
                    class: List,
                    inlineToolbar: true,
                },
                image: {
                    class: ImageTool,
                    config: {
                        endpoints: {
                            byFile: 'build/editor/uploadFile',
                        }
                    }
                },
                code: CodeTool,
                inlineCode: {
                    class: InlineCode
                },
            },
            data: draftEditor,
            onReady: () => {
                this.languageTools.registerMatchClick()
            }
        });
    }

    async onEditorSave() {
        const data = await this.editor.save();
        if (this.pageId === 'editor') {
            this.channel.postMessage({html: eonasdan.parser(data.blocks)});
        }
        if (this.config.services.languageTools && data && !this.updatingBlock) {
            this.ltBounce(data, 3000);
        }
        localStorage.setItem('draft-editor', JSON.stringify(data));
    }

    bounceTimer;

    ltBounce(data, timeOut) {
        clearTimeout(this.bounceTimer);
        this.bounceTimer = setTimeout(() => {
            this.languageToolCheck(data);
        }, timeOut);
    }

    updateExcerpt() {
        const excerptLength = this.excerpt.value.length;
        const colors = ['text-danger', 'text-success'];
        this.excerptLow.classList.remove(...colors);
        this.excerptHigh.classList.remove(...colors);
        if (excerptLength < 50) this.excerptLow.classList.add(colors[0]);
        else this.excerptLow.classList.add(colors[1]);

        if (excerptLength > 160) this.excerptHigh.classList.add(colors[0]);
        else this.excerptHigh.classList.add(colors[1]);
    }

    clear() {
        this.editor.clear();
        this.form.reset();
        this.postDate.value = this.dateForInput();
        this.metaBlur({target: {name: 'postDate', value: this.postDate.value}});
        this.areYouSureModalConfirm.removeEventListener('click', this.clear);
        this.areYouSureModal.hide();
        localStorage.setItem('lt-data', null);
        this.blockLanguageToolData = [];
    }

    toggleShow(...elements) {
        elements.forEach(element => {
            element.classList.toggle('show');
            element.classList.toggle('hide');
        });
    }

    metaBlur(event) {
        const input = event.target;
        switch (input.name) {
            case 'title':
                this.outputDiv.getElementsByClassName('post-title')[0].innerText = input.value;
                break;
            case 'thumbnail':
                if (input?.files?.length === 0) return;

                this.fileReader.readAsDataURL(input.files[0]);
                break;
            case 'postDate':
                this.outputDiv.getElementsByClassName('post-date')[0].innerText = this.formatter.format(new Date(input.value));
                break;
            case 'tags':
                this.tagUl.innerText = '';
                input.value.split(',').map(tag => tag.trim()).forEach(tag => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.setAttribute('href', `/?search=tag:${tag}`);
                    a.innerHTML = tag;
                    li.appendChild(a);
                    this.tagUl.appendChild(li);
                });
                break;
            case 'postAuthorName':
                this.outputDiv.getElementsByClassName('post-author')[0].innerText = input.value;
                break;
            /*case 'postAuthorUrl':
                outputDiv.getElementsByClassName('')[0].innerText = input.value;
                break;*/
            //todo excerpt trigger
        }
        localStorage.setItem('draft-meta', JSON.stringify(
            [...this.form.querySelectorAll('input, textarea')].filter(x => x.id !== 'thumbnail').reduce((object, element) => {
                object[element.id] = element.value;
                return object;
            }, {})
        ));
    }

    restoreForm() {
        const data = JSON.parse(localStorage.getItem('draft-meta') || '{}');

        const author = (s = '') => {
            const a = s.replace('postAuthor', '')
            return (a[0].toLowerCase() + a.slice(1)) || "";
        };

        [...this.form.elements].forEach(field => {
            const value = data[field.name] || this.config.defaultAuthor[author(field.name)];
            if (value) {
                field.value = value
                field.blur();
            }
        })
    }

    async savePost() {
        if (!this.form.checkValidity()) {
            this.form.classList.add('was-validated');
            this.errorToast('Form is invalid.');
            return;
        }
        const outputData = await this.editor.save();
        if (!outputData) return;
        outputData.blocks.forEach(x => x.data.text = this.languageTools.cleanupMarkers(x.data.text));
        this.form.classList.add('was-validated');
        const formData = new FormData(this.form);
        formData.append('editor', JSON.stringify(outputData));

        const savingToast = new bootstrap.Toast(document.getElementById('savingMessage'), {autohide: false});
        savingToast.show();

        try {
            const response = await this.fiddo('/editor/save', 'POST', formData);
            if (response.success) {
                savingToast.hide();
                this.successToast();
                this.clear();
                setTimeout(() => {
                    window.location.href = response.post;
                }, 1.5 * 1000);
            } else {
                savingToast.hide();
                this.errorToast();
            }
        } catch (e) {
            console.log(e);
            this.errorToast();
        }
    }

    languageToolCheck(data) {
        data.blocks
            .filter(
                (block) =>
                    //has text
                    block.data.text &&
                    //is not currently processing
                    //!this.languageTools.processingIds.includes(block.id) &&
                    //doesn't have a hash or the hash is different
                    (!this.blockLanguageToolData.find((x) => x.id === block.id) ||
                        md5(block.data.text) !==
                        this.blockLanguageToolData.find((x) => x.id === block.id).hash)
            )
            .forEach((block) => {
                this.languageTools
                    .process(block.data.text, block.id)
                    .then(async (results) => {
                        if (results.error) {
                            console.log(results.error, results.exception);
                            return;
                        }

                        const currentData = (await this.editor.save())
                            .blocks.find(x => x.id === block.id)
                            .data.text;

                        const currentHash = md5(currentData);
                        //if the user has changed the text since we checked with LT
                        //because of how editor js works, we can't update the block text
                        if (currentHash !== md5(block.data.text)) return;

                        const existing = this.blockLanguageToolData.find(x => x.id === block.id);

                        if (existing) {
                            existing.hash = md5(results.newText);
                            existing.matches = results.matches;
                        } else {
                            this.blockLanguageToolData.push({
                                id: block.id,
                                hash: md5(results.newText),
                                matches: results.matches,
                            });
                        }

                        localStorage.setItem('lt-data', JSON.stringify(this.blockLanguageToolData));

                        this.updateBlockTextAndBreak(block.id, results.newText);
                        this.languageTools.registerMatchClick();
                    });
            });
    }

    getActiveMatchHandler(element) {
        return this.blockLanguageToolData
            .find((x) => x.id === element.dataset.id)
            ?.matches.find((x) => x.id === +element.dataset.index);
    }

    async ignoreSuggestionHandler() {
        const element = this.languageTools.activeMatch.element;
        const blockData = await this.getBlockDataForElement(element);
        let newText = blockData.text.replace(element.outerHTML, element.innerHTML);
        this.updateBlockTextAndBreak(blockData.id, newText);
        this.languageTools.hideAndRegisterClick();
    }

    async replaceSuggestionHandler(element, value) {
        const blockData = await this.getBlockDataForElement(element);
        this.updateBlockTextAndBreak(
            blockData.id,
            blockData.text.replace(element.outerHTML, value)
        );
        this.languageTools.hideAndRegisterClick();
    }

    async getBlockDataForElement(element) {
        const id = element.dataset.id;
        const data = await this.editor.save();
        const block = data.blocks.find((x) => x.id === id);
        return {
            id,
            text: block.data.text,
        };
    }

    updateBlockTextAndBreak(id, newText) {
        this.updatingBlock = true;
        this.editor.blocks.update(id, {
            text: newText,
        });

        setTimeout(() => {
            this.updatingBlock = false;
        }, 300);
    }

    errorToast(message = 'Save failed') {
        this.makeToast(message, 'danger');
    }

    successToast(message = 'Save successful.') {
        this.makeToast(message, 'success');
    }

    /**
     * Shows a toast message
     */
    makeToast(body, style) {
        this.toastyContainer.classList.remove(...this.toastyContainer.classList);
        this.toastyContainer.classList.add(...this.toastyClasses);
        this.toastyContainer.classList.add(`bg-${style}`);
        this.toastyContainer.getElementsByClassName('toast-body')[0].innerHTML = body;

        this.toasty.show();
    }

    /**
     * Get it... it fetches?
     * @param url
     * @param method
     * @param body
     * @return {Promise<any>}
     */
    async fiddo(url, method = 'GET', body = '') {
        const fetchOptions = {
            method: method
        }

        if (method !== 'GET') fetchOptions.body = body;

        return await (await fetch(url, fetchOptions)).json()
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await new Editor().readyAsync();
});
