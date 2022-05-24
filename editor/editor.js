/* global Header, Checklist, List, ImageTool, CodeTool, InlineCode, Prism, EditorJS, eonasdan */

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

    dateForInput = () => {
        return new Date().toISOString().slice(0, -14)
    }

    areYouSureModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('areYouSureModal'));

    editor = undefined

    ready() {
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

        document.getElementById('clearButton').addEventListener('click', () => {
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

        document.getElementById('save').addEventListener('click', this.savePost.bind(this));
    }

    setupEditor() {
        const draftEditor = JSON.parse(localStorage.getItem('draft-editor') || '{}');

        // noinspection JSUnusedGlobalSymbols
        this.editor = new EditorJS({
            holder: 'editorjs',
            placeholder: 'Let`s write an awesome story!',
            onChange: () => this.onEditorSave(),
            tools: {
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
            data: draftEditor
        });
    }

    onEditorSave() {
        this.editor.save().then(data => {
            if (data) {
                const rawText = data.blocks
                    .flatMap(x => x.data)
                    .filter(x => x.text)
                    .flatMap(x => x.text)
                    .join(' ')
                    .replaceAll('<code class="inline-code">', '')
                    .replaceAll('</code>', '');
                /* const response = fetch('http://localhost:8010/v2/check', {
                *    method: 'POST',
                     body: JSON.stringify({
                         data: {
                             text: parsed
                         },
                         language: 'en-US'
                     })
                 })
                     .then(response => response.json()).then(x => {
                         debugger;
                     });*/

                localStorage.setItem('draft-editor', JSON.stringify(data));
                //return;
            }
        });
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

        const {elements} = this.form;

        for (const [key, value] of Object.entries(data).filter(x => x[0] !== 'thumbnail')) {
            const field = elements.namedItem(key);
            if (field) {
                field.value = value
                field.blur();
            }

        }
    }

    async savePost() {
        if (!this.form.checkValidity()) {
            this.form.classList.add('was-validated');
            return;
        }
        const outputData = await this.editor.save();
        if (!outputData) return;
        this.form.classList.add('was-validated');
        const formData = new FormData(this.form);
        formData.append('editor', JSON.stringify(outputData));

        const errorToast = new bootstrap.Toast(document.getElementById('errorMessage'));
        const savingToast = new bootstrap.Toast(document.getElementById('savingMessage'), {autohide: false});
        savingToast.show();

        try {
            const response = await (await fetch('/editor/save', {
                method: 'POST',
                body: formData
            })).json();
            if (response.success) {
                savingToast.hide();
                const toast = new bootstrap.Toast(document.getElementById('successMessage'));
                toast.show();
                this.clear();
                setTimeout(() => {
                    window.location.href = response.post;
                }, 1.5 * 1000);
            } else {
                savingToast.hide();
                errorToast.show();
            }
        } catch (e) {
            console.log(e);
            errorToast.show();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Editor().ready();
});
