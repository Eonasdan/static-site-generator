import PostMeta from './PostMeta';
import Utilities from './utilities';
import {SiteConfig} from './site-config';

const fs = require('fs');
const JSDOM = require('jsdom').JSDOM;
const path = require('path');
const minifyHtml = require('html-minifier-terser').minify;
const dropCss = require('dropcss');
const cleanCSS = require('clean-css');
const {minify} = require('terser');
const sass = require('sass');
const edjsParser = require('editorjs-parser');

export default class Build {
    siteConfig: SiteConfig = null;
    shellTemplate = '';
    postTemplate = '';
    postLoopTemplate = '';
    //create meta info
    postsMeta = [];
    usePwa = false;

//prepare the static homepage text
//todo at some point we'll have to deal with paging or infinite scrolls or something
    homePageHtml = [];

// prepare site map
    siteMap = '';

    css = '';
    cssWhitelist = new Set();

    subFolder: string;
    baseUrl: string;

    constructor() {
        this.siteConfig = JSON.parse(fs.readFileSync(`./build/site-config.json`, 'utf8'));
        this.subFolder = this.siteConfig.site.subfolder ? `${this.siteConfig.site.subfolder}/` : '';
        this.baseUrl = `${this.siteConfig.site.root}/${this.subFolder}`;
    }

    updateAll() {
        this.shellTemplate = this.loadTemplate('shell');
        this.postTemplate = this.postDocument;
        this.postLoopTemplate = this.loadTemplate(`post-loop`);
        this.reset();
        this.removeDirectory(`./${this.siteConfig.output.main}`, false);
        this.copyFile();
        this.update404();
        this.prepareCss();
        this.updatePosts();
        this.minifyJs().then();
    }

    reset() {
        this.postsMeta = [];
        this.homePageHtml = [];
        this.siteMap = '';
    }

    loadTemplate(template) {
        return fs.readFileSync(`./${this.siteConfig.source}/templates/${template}.html`, 'utf8')
    }

    getSearchBody(html) {
        const bodyPrep = html.textContent
            .toLowerCase()
            .replace('.', ' ') //replace dots with spaces
            .replace(/((?<=\s)|(?=\s))[^a-z ]*|[^a-z ]*((?<=\s)|(?=\s))/gm, ' ') //remove special characters
            .replace(/\s+/g, ' ').trim() //replace extra white space
            .split(' ');// split at words;
        return Array.from(new Set(bodyPrep)).join(' '); //remove duplicate words
    }

    removeDirectory(directory, removeSelf = true) {
        try {
            const files = fs.readdirSync(directory) || [];
            files.forEach(file => {
                const filePath = path.join(directory, file);
                if (fs.statSync(filePath).isFile())
                    this.removeFile(filePath);
                else
                    this.removeDirectory(filePath);
            })
        } catch (e) {
            return;
        }
        if (removeSelf)
            fs.rmdirSync(directory);
    }

    removeFile(filePath) {
        if (!fs.statSync(filePath).isFile()) return;
        try {
            fs.unlinkSync(filePath);
        } catch (e) {

        }
    }

    copyFile(path?: string, destination?: string) {
        //copy all
        if (!path) {
            fs.cpSync(`./${this.siteConfig.source}/copy`, this.siteConfig.output.main, {recursive: true});
            return;
        }
        fs.copyFileSync(path, destination);
    }

    writeFileAndEnsurePathExists(filePath, content) {
        fs.mkdirSync(path.dirname(filePath), {recursive: true});

        fs.writeFileSync(filePath, content);
    }

    // since everyone has to have their own meta data *rolls eyes* the primary purpose here
    // is to quickly find similar tags and set them all at once
    setMetaContent(rootElement, selector, content) {
        [...rootElement.getElementsByClassName(selector)].forEach(element => {
            if (content) {
                element.setAttribute('content', content);
                element.removeAttribute('class');
            } else rootElement.getElementsByTagName('head')[0].removeChild(element);
        });
    }

    // doing this as a function so I don't have to null check values inline
    setStructuredData(structure, property, value) {
        if (!value) return;

        structure[property] = value;
    }

    createRootHtml(html) {
        html = minifyHtml(html, {
            collapseWhitespace: true,
            removeComments: true
        });

        return `<!DOCTYPE html>
<html lang="en">${html}
</html>`;
    }

    get shellDocument() {
        return new JSDOM(this.shellTemplate).window.document;
    }

    //read css files
    prepareCss() {
        this.cssWhitelist = new Set();

        this.cssWhitelist.add('post-tags');
        this.cssWhitelist.add('mt-30');

        this.css = sass.compile(`./${this.siteConfig.source}/styles/style.scss`).css;
    }

    //read post template
    get postDocument() {
        const indexDocument = new JSDOM(this.loadTemplate('post-template')).window.document;
        const shell = this.shellDocument;
        shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;
        return shell.documentElement.innerHTML;
    }

    updatePosts() {
        this.reset();
        const postOutput = `./${this.siteConfig.output.main}/${this.siteConfig.output.posts}`;
        //remove old stuff
        this.removeDirectory(postOutput, false);

        const posts = fs
            .readdirSync(`./${this.siteConfig.source}/partials`)
            .filter(file => path.extname(file).toLowerCase() === '.html');

        posts.forEach(file => {
            const fullyQualifiedUrl = `${this.baseUrl}${this.siteConfig.output.posts}/${file}`;
            const fullPath = `./${this.siteConfig.source}/partials/${file}`;
            const newPageDocument = new JSDOM(this.postTemplate).window.document;
            const postDocument = new JSDOM(fs.readFileSync(fullPath, 'utf8')).window.document;
            const article = postDocument.querySelector('article');
            if (!article) {
                console.error(`failed to read article body for ${fullPath}`);
                return;
            }

            const fileModified = fs.statSync(fullPath).mtime;

            let postMeta = new PostMeta(file, file.replace(path.extname(file), ''), this.getSearchBody(article), fileModified, fileModified);

            postMeta.parse(postDocument.getElementById('post-meta'));

            const postTagsDiv = postDocument.createElement('div');
            postTagsDiv.classList.add('post-tags', 'mt-30');
            const postTagsUl = postDocument.createElement('ul');

            postMeta.tags?.split(',').map(tag => tag.trim()).forEach(tag => {
                const li = postDocument.createElement('li');
                const a = postDocument.createElement('a');
                a.setAttribute('href', `/${this.subFolder}?search=tag:${tag}`);
                a.innerHTML = tag;
                li.appendChild(a);
                postTagsUl.appendChild(li);
            });

            postTagsDiv.appendChild(postTagsUl);
            article.appendChild(postTagsDiv);

            const loopDocument = new JSDOM(this.postLoopTemplate).window.document;
            newPageDocument.getElementById('post-inner').innerHTML = article.innerHTML;

            const publishDate = new Date(postMeta.postDate);

            // create structured data
            const structuredData = {
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                'author': {
                    '@type': 'Person',
                    'name': postMeta.author.name,
                    'url': postMeta.author.url
                },
            };

            newPageDocument.title = postMeta.title;
            if (postMeta.thumbnail) {
                this.setInnerHtml(newPageDocument.getElementById('post-thumbnail'),
                    `<img src="/${this.subFolder}img/${postMeta.thumbnail}" alt="${postMeta.title}" class="img-fluid" width="1200"/>`);
                this.setInnerHtml(loopDocument.getElementsByClassName('post-thumbnail')[0],
                    `<img src="/${this.subFolder}img/${postMeta.thumbnail}" alt="${postMeta.title}" class="img-fluid" width="530"/>`);

                const fullyQualifiedImage = `${this.baseUrl}/img/${postMeta.thumbnail}`;
                this.setMetaContent(newPageDocument, 'metaImage', fullyQualifiedImage);
                this.setStructuredData(structuredData, 'image', [
                    fullyQualifiedImage
                ]);
            } else {
                this.setInnerHtml(newPageDocument.getElementById('post-thumbnail'), '');
                this.setInnerHtml(loopDocument.getElementsByClassName('post-thumbnail')[0], '');
                this.setMetaContent(newPageDocument, 'metaImage', '');
            }

            this.setMetaContent(newPageDocument, 'metaTitle', postMeta.title);
            this.setStructuredData(structuredData, 'headline', postMeta.title);
            this.setInnerHtml(loopDocument.getElementsByClassName('post-title')[0], postMeta.title);
            loopDocument.getElementsByClassName('post-link')[0].href = `/${this.subFolder}${this.siteConfig.output.posts}/${postMeta.file}`

            this.setMetaContent(newPageDocument, 'metaDescription', postMeta.excerpt);
            this.setMetaContent(newPageDocument, 'metaUrl', fullyQualifiedUrl);
            this.setStructuredData(structuredData, 'mainEntityOfPage', fullyQualifiedUrl);

            this.setMetaContent(newPageDocument, 'metaPublishedTime', publishDate.toISOString());
            this.setStructuredData(structuredData, 'datePublished', publishDate.toISOString());
            this.setInnerHtml(loopDocument.getElementsByClassName('post-date')[0], Utilities.formatter.format(publishDate));

            if (!postMeta.updateDate) postMeta.updateDate = postMeta.postDate;
            const updateDate = new Date(postMeta.updateDate).toISOString();
            this.setMetaContent(newPageDocument, 'metaModifiedTime', updateDate);
            this.setStructuredData(structuredData, 'dateModified', updateDate);

            this.setMetaContent(newPageDocument, 'metaTag', postMeta.tags);
            this.setStructuredData(structuredData, 'keywords', postMeta.tags.split(', '));

            this.setInnerHtml(loopDocument.getElementsByClassName('post-author')[0], postMeta.author.name);
            this.setInnerHtml(loopDocument.getElementsByClassName('post-excerpt')[0], postMeta.excerpt);

            this.postsMeta.push(postMeta);

            // push structured data to body
            const structuredDataTag = newPageDocument.createElement('script');
            structuredDataTag.type = 'application/ld+json';
            structuredDataTag.innerHTML = JSON.stringify(structuredData, null, 2);
            newPageDocument.getElementsByTagName('body')[0].appendChild(structuredDataTag);

            const completeHtml = this.createRootHtml(newPageDocument.documentElement.innerHTML);
            this.writeFileAndEnsurePathExists(`./${postOutput}/${file}`, completeHtml);

            //update pure css
            dropCss({
                css: this.css,
                html: completeHtml
            }).sels.forEach(sel => this.cssWhitelist.add(sel));

            //add to homepage html

            this.homePageHtml.push({
                html: loopDocument.getElementsByTagName('body')[0].innerHTML,
                postDate: postMeta.postDate
            });

            this.siteMap += `<url>
<loc>${fullyQualifiedUrl}</loc>
<lastmod>${updateDate}</lastmod>
<priority>0.80</priority>
</url>`;
        });

        this.postsMeta = this.postsMeta
            .sort((a, b) => {
                return +new Date(a.postDate) > +new Date(b.postDate) ? -1 : 0;
            });

        this.writeFileAndEnsurePathExists(`./${this.siteConfig.output.main}/js/search.json`, JSON.stringify(this.postsMeta, null, 2));

        this.updateSiteMap();
        this.updateHomepage();
        this.cleanCss();
    }

    updateHomepage() {
        const indexDocument = new JSDOM(fs.readFileSync(`./${this.siteConfig.source}/templates/index.html`, 'utf8')).window.document;

        indexDocument.getElementById('post-container').innerHTML = this.homePageHtml.sort((a, b) => {
            return new Date(a.postDate).valueOf() > new Date(b.postDate).valueOf() ? -1 : 0;
        })
            .map(x => x.html).join(' ');

        const shell = this.shellDocument;
        shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;

        if (this.usePwa) {
            const script = shell.createElement('script');
            script.type = 'module'
            script.innerHTML = 'import \'https://cdn.jsdelivr.net/npm/@pwabuilder/pwaupdate\';';

            shell.getElementsByTagName('head')[0].appendChild(script);

            const el = shell.createElement('pwa-update');
            shell.body.appendChild(el);
        }

        const completeHtml = this.createRootHtml(shell.documentElement.innerHTML);
        this.writeFileAndEnsurePathExists(`./${this.siteConfig.output.main}/index.html`, completeHtml);
        dropCss({
            css: this.css,
            html: completeHtml
        }).sels.forEach(sel => this.cssWhitelist.add(sel));
    }

    update404() {
        const indexDocument = new JSDOM(fs.readFileSync(`./${this.siteConfig.source}/templates/404.html`, 'utf8')).window.document;
        const shell = this.shellDocument;
        shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;

        const completeHtml = this.createRootHtml(shell.documentElement.innerHTML);
        this.writeFileAndEnsurePathExists(`./${this.siteConfig.output.main}/404.html`, this.createRootHtml(shell.documentElement.innerHTML));
        dropCss({
            css: this.css,
            html: completeHtml
        }).sels.forEach(sel => this.cssWhitelist.add(sel));
    }

    updateSiteMap() {
        this.siteMap = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>${this.baseUrl}</loc>
<lastmod>${new Date().toISOString()}</lastmod>
<priority>1.00</priority>
</url>
${this.siteMap}
</urlset>`;
        this.writeFileAndEnsurePathExists(`./${this.siteConfig.output.main}/sitemap.xml`, this.siteMap);
    }

    updateCss() {
        this.prepareCss();

        const gatherCss = (fullPath) => {
            const postDocument = new JSDOM(fs.readFileSync(fullPath, 'utf8')).window.document;
            dropCss({
                css: this.css,
                html: postDocument.documentElement.innerHTML
            }).sels.forEach(sel => this.cssWhitelist.add(sel));
        }

        fs
            .readdirSync(`./${this.siteConfig.source}/partials`)
            .filter(file => path.extname(file).toLowerCase() === '.html')
            .map(file => `./${this.siteConfig.source}/partials/${file}`).forEach(gatherCss);

        fs
            .readdirSync(`./${this.siteConfig.source}/templates`)
            .filter(file => path.extname(file).toLowerCase() === '.html')
            .map(file => `./${this.siteConfig.source}/templates/${file}`).forEach(gatherCss);

        this.cleanCss();
    }

    cleanCss() {
        let cleaned = dropCss({
            html: '',
            css: this.css,
            shouldDrop: sel => !this.cssWhitelist.has(sel),
        });
        this.writeFileAndEnsurePathExists(`./${this.siteConfig.output.main}/css/style.min.css`, new cleanCSS().minify(cleaned.css).styles);
    }

    async minifyJs() {
        const loopDocument = new JSDOM(this.postLoopTemplate).window.document;
        const getJs = () => {
            let output = '';

            const files = fs
                .readdirSync(`./${this.siteConfig.source}/js`)
                .filter(file => path.extname(file).toLowerCase() === '.js' && !file.includes('.min.'));

            files.forEach(file => {
                output += fs.readFileSync(`./${this.siteConfig.source}/js/${file}`, 'utf8') + '\r\n';
            });

            return output;
        }

        const js = getJs().replace('[POSTLOOP]', loopDocument.getElementsByTagName('body')[0].innerHTML);

        const uglified = await minify(js);

        this.writeFileAndEnsurePathExists(`./${this.siteConfig.output.main}/js/bundle.min.js`, uglified.code);
    }

    setInnerHtml(element, value) {
        if (!element) return;
        element.innerHTML = value;
    }

    parser = new edjsParser(undefined, {
        code: (data) => {
            if (!data) return '';
            const sanitizeHtml = function (markup) {
                markup = markup.replace(/&/g, '&amp;');
                markup = markup.replace(/</g, '&lt;');
                markup = markup.replace(/>/g, '&gt;');
                return markup;
            }
            let codeClass = '';
            switch (data.languageCode) {
                case 'js':
                    codeClass = 'language-javascript'
                    break;
            }

            return `<pre><code class="${codeClass}">${sanitizeHtml(data.code)}</code></pre>`
        }
    });

    save(postMeta, rawEditor) {
        const postImagePath = `./${this.siteConfig.output.main}/img/${postMeta.file}`;
        const partialPath = `./${this.siteConfig.source}/partials/${postMeta.file}.html`;

        if (fs.existsSync(postImagePath)) {
            return {
                success: false,
                error: 'Post with the same path already exists.'
            }
        }

        try {
            fs.mkdirSync(postImagePath);

            const postImages = rawEditor.blocks.filter(y => y.type === 'image');
            if (postImages.length > 0) {
                postImages.forEach(x => {
                    const newPath = `${postImagePath}/${x.data.file.url.replace('img_temp/', '')}`;
                    fs.renameSync(`.${x.data.file.url}`, newPath);
                    x.data.file.url = newPath.substring(1);
                });
            }

            const body = this.parser.parse(rawEditor);

            const newThumbnailPath = `${postImagePath}/${postMeta.thumbnail.replace('img_temp\\', '')}`;
            fs.renameSync(postMeta.thumbnail, newThumbnailPath);

            let newPost = this.loadTemplate('empty-post')
                .replace(/==title==/g, postMeta.title)
                .replace(/==author-name==/g, postMeta.author.name)
                .replace(/==formatted-date==/g, Utilities.formatter.format(postMeta.postDate))
                .replace(/==body==/g, body)
                .replace(/==thumbnail==/g, newThumbnailPath.replace(`./${this.siteConfig.output.main}/img`, ''))
                .replace(/==raw-post-date==/g, postMeta.postDate)
                .replace(/==tags==/g, postMeta.tags)
                .replace(/==excerpt==/g, postMeta.excerpt)
                .replace(/==author-url==/g, postMeta.author.url);

            this.writeFileAndEnsurePathExists(partialPath, newPost);

            this.removeDirectory('./img_temp', false);
            return {
                success: true,
                post: `/posts/${postMeta.file}.html`
            }

        } catch (e) {
            this.removeDirectory(postImagePath, true);
            this.removeFile(partialPath);
            return {
                success: false,
                error: e
            }
        }
    }


}
