(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.eonasdan = {}));
})(this, (function (exports) { 'use strict';

    let value = '';
    const checklist = (param) => {
        value = '';
        param.forEach((items) => {
            value += `<div class="form-check"><input class="form-check-input" type="radio" ${items.checked ? 'checked' : ''}><label class="form-check-label">${items.text}</label></div>`;
        });
        return value;
    };

    const code = (param) => {
        return `<pre><code class="${param.data.languageCode}">${sanitizeHtml(param.data.code)}</code></pre>`;
    };
    const sanitizeHtml = (markup) => {
        markup = markup.replace(/&/g, "&amp;");
        markup = markup.replace(/</g, "&lt;");
        markup = markup.replace(/>/g, "&gt;");
        return markup;
    };

    const delimiter = () => {
        return `<div class="ejs-delimiter"></div>`;
    };

    const embed = (param) => {
        let embedValue = '';
        embedValue += `<div class="ratio ratio-1x1"><iframe loading="lazy" src='${param.embed}'></iframe></div>`;
        return embedValue;
    };

    const header = (param, type) => {
        return `<h${type}>${param}</h${type}>`;
    };

    const image = (param) => {
        if (param.srcSet) {
            return param.srcSet;
        }
        const imgClass = `${param.stretched ? 'img-fullwidth' : ''} ${param.withBorder ? 'image-withBorder' : ''} ${param.withBackground ? 'img-background' : ''}`;
        if (param.caption) {
            return `<figure><img src="${param.file.url}" class="${imgClass}" alt="${param.alt}"><figcaption>${param.caption}</figcaption></figure>`;
        }
        return `<img src="${param.file.url}" class="${imgClass}" alt="${param.alt}">`;
    };

    const link = (param) => {
        return `<a href='${param}' target='_blank'>${param}</a>`;
    };

    const list = (param) => {
        let listValue = '';
        listValue += `<ol>`;
        param.forEach((items) => {
            listValue += `<li>${items}</li>`;
        });
        listValue += `</ol>`;
        return listValue;
    };

    const paragraph = (param) => {
        return `<p>${param}</p>`;
    };

    const quote = (caption, text) => {
        let quoteValue = `<blockquote class="blockquote">${text}`;
        if (caption) {
            quoteValue += `<footer class="blockquote-footer">${caption}</footer>`;
        }
        quoteValue += '</blockquote>';
        return quoteValue;
    };

    const raw = (param) => {
        let rawValue = '';
        rawValue += param;
        return rawValue;
    };

    const table = (params) => {
        let tableHeader = '';
        let tableBody = '';
        params.data.content[0].forEach((header) => {
            tableHeader += `<th>${header}</th>`;
        });
        for (let i = 1; i < params.data.content.length; i++) {
            tableBody += `<tr>`;
            params.data.content[i].forEach((body) => {
                tableBody += `<td>${body}</td>`;
            });
            tableBody += `</tr>`;
        }
        return `
    <table class='table'>
        <thead>
            <tr>
                ${tableHeader}
            <tr>
        </thead>
        <tbody>
            ${tableBody}
        </tbody>
    </table>
  `;
    };

    const warning = (params) => {
        return `<figure id='ejs-warning-figure' class="ejs-warning">
                <figcaption>${params.title}</figcaption>
                <p class="ejs-warning__p">${params.message}</p>
            </figure>`;
    };

    const editorJsParser = (value) => {
        let editorData = '';
        try {
            value.forEach((element) => {
                switch (element.type) {
                    case 'checklist':
                        editorData += checklist(element.data.items);
                        break;
                    case 'code':
                        editorData += code(element);
                        break;
                    case 'delimiter':
                        editorData += delimiter();
                        break;
                    case 'embed':
                        editorData += embed(element.data);
                        break;
                    case 'header':
                        editorData += header(element.data.text, element.data.level);
                        break;
                    case 'image':
                        editorData += image(element.data);
                        break;
                    case 'link':
                        editorData += link(element.data.link);
                        break;
                    case 'list':
                        editorData += list(element.data.items);
                        break;
                    case 'paragraph':
                        editorData += paragraph(element.data.text);
                        break;
                    case 'quote':
                        editorData += quote(element.data.caption, element.data.text);
                        break;
                    case 'raw':
                        editorData += raw(element.data.html);
                        break;
                    case 'table':
                        editorData += table(element);
                        break;
                    case 'warning':
                        editorData += warning(element.data);
                        break;
                    default:
                        editorData += '';
                }
            });
        }
        catch (error) {
            console.error(error);
        }
        return editorData;
    };

    exports.parser = editorJsParser;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=bundle.js.map
