import PostMeta from './models/post-meta';
import Utilities from './utilities';
import {SiteConfig} from './models/site-config';
import Images, {defaultSizes} from "./images";
import {FileHelpers} from "./file-helpers";

import {promises as fs} from 'fs';
import {JSDOM} from 'jsdom';
import * as path from 'path';
import {minify as minifyHtml} from 'html-minifier-terser';
import {minify} from 'terser';
import * as sass from 'sass';

const {readFileSync} = require('fs')
const dropCss = require('dropcss');
const editorJsParser = require("@eonasdan/editorjs-parser");
const CleanCSS = require('clean-css');

export default class Build {
    saveInProgress = false;
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

    sourceMap = '';
    css = '';
    cssWhitelist = new Set();

    subFolder: string;
    baseUrl: string;
    baseImagePath:string;
    imageProcessor = new Images();

    constructor() {
        this.siteConfig = JSON.parse(readFileSync(`./build/site-config.json`, 'utf8'));
        FileHelpers.siteConfig = this.siteConfig;
        this.subFolder = this.siteConfig.site.subfolder ? `${this.siteConfig.site.subfolder}/` : '';
        this.baseUrl = `${this.siteConfig.site.root}/${this.subFolder}`;
        this.baseImagePath = `/${this.subFolder}img/`;
    }

    async updateAllAsync() {
        this.shellTemplate = await this.loadTemplateAsync('shell');
        this.postTemplate = await this.postDocumentAsync();
        this.postLoopTemplate = await this.loadTemplateAsync(`post-loop`);
        this.reset();
        await FileHelpers.removeDirectoryAsync(`./${this.siteConfig.output.main}`, false);
        await FileHelpers.copyFileAsync();
        await this.update404Async();
        await this.prepareCssAsync();
        await this.updatePostsAsync();
        await this.minifyJsAsync();
    }

    reset() {
        this.postsMeta = [];
        this.homePageHtml = [];
        this.siteMap = '';
    }

    loadTemplateAsync(template) {
        return fs.readFile(`./${this.siteConfig.source}/templates/${template}.html`, 'utf8');
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

    // since everyone has to have their own metadata *rolls eyes* the primary purpose here
    // is to quickly find similar tags and set them all at once
    setMetaContent(rootElement, selector, content) {
        [...rootElement.getElementsByClassName(selector)].forEach(element => {
            if (content) {
                element.setAttribute('content', content);
                element.removeAttribute('class');
            } else rootElement.getElementsByTagName('head')[0].removeChild(element);
        });
    }

    // doing this as a function so that I don't have to null check values inline
    setStructuredData(structure, property, value) {
        if (!value) return;

        structure[property] = value;
    }

    async createRootHtmlAsync(html) {
        html = await minifyHtml(html, {
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
    async prepareCssAsync() {
        this.cssWhitelist = new Set();

        const compileResult = await sass.compileAsync(`./${this.siteConfig.source}/styles/style.scss`, {sourceMap: true});
        this.sourceMap = compileResult.sourceMap.mappings;
        this.css = compileResult.css;
    }

    //read post template
    async postDocumentAsync() {
        const indexDocument = new JSDOM(await this.loadTemplateAsync('post-template')).window.document;
        const shell = this.shellDocument;
        shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;
        return shell.documentElement.innerHTML;
    }

    async updatePostsAsync() {
        this.reset();
        const postOutput = `./${this.siteConfig.output.main}/${this.siteConfig.output.posts}`;
        //remove old stuff
        await FileHelpers.removeDirectoryAsync(postOutput, false);

        const posts = (await fs
            .readdir(`./${this.siteConfig.source}/partials`))
            .filter(file => path.extname(file).toLowerCase() === '.html');

        for (const file of posts) {
            const fullyQualifiedUrl = `${this.baseUrl}${this.siteConfig.output.posts}/${file}`;
            const fullPath = `./${this.siteConfig.source}/partials/${file}`;
            const newPageDocument = new JSDOM(this.postTemplate).window.document;
            const postDocument = new JSDOM((await fs.readFile(fullPath, 'utf8'))).window.document;
            const article = postDocument.querySelector('article');
            if (!article) {
                console.error(`failed to read article body for ${fullPath}`);
                continue;
            }

            const fileModified = (await fs.stat(fullPath)).mtime;

            let postMeta = new PostMeta(file, file.replace(path.extname(file), ''), this.getSearchBody(article), fileModified, fileModified);

            postMeta.parse(postDocument.getElementById('post-meta'));

            const postTagsUl = newPageDocument.querySelector('.post-tags > ul');

            postMeta.tags?.split(',').map(tag => tag.trim()).forEach(tag => {
                const li = postDocument.createElement('li');
                const a = postDocument.createElement('a');
                a.setAttribute('href', `/${this.subFolder}?search=tag:${tag}`);
                a.innerHTML = tag;
                li.appendChild(a);
                postTagsUl.appendChild(li);
            });

            //hack for #22
            postTagsUl.removeChild(postTagsUl.querySelector('#tag-delete'))

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

            let metaImage = '';

            if (postMeta.mastImage) {
                this.setInnerHtml(newPageDocument.getElementById('post-thumbnail'), postMeta.mastImage.innerHTML);
                this.setInnerHtml(loopDocument.getElementsByClassName('post-thumbnail')[0],
                    `<img src="${postMeta.thumbnail}" alt="${postMeta.title}" class="img-fluid" width="530"/>`);

                const fullyQualifiedImage = `${this.baseUrl}${postMeta.mastImage.getElementsByTagName('source')[0].srcset}`;
                metaImage = fullyQualifiedImage;
                this.setStructuredData(structuredData, 'image', [
                    fullyQualifiedImage
                ]);
            } else {
                this.setInnerHtml(newPageDocument.getElementById('post-thumbnail'), '');
                this.setInnerHtml(loopDocument.getElementsByClassName('post-thumbnail')[0], '');
            }

            if (postMeta.metaImage) metaImage = `${this.baseUrl}${postMeta.metaImage}`;

            this.setMetaContent(newPageDocument, 'metaImage', metaImage);

            this.setMetaContent(newPageDocument, 'metaTitle', postMeta.title);
            this.setStructuredData(structuredData, 'headline', postMeta.title);
            this.setInnerHtml(loopDocument.getElementsByClassName('post-title')[0], postMeta.title);
            postMeta.url = `/${this.subFolder}${this.siteConfig.output.posts}/${postMeta.file}`;
            (loopDocument.getElementsByClassName('post-link')[0] as HTMLLinkElement).href = postMeta.url;

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

            const completeHtml = await this.createRootHtmlAsync(newPageDocument.documentElement.innerHTML);
            await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${postOutput}/${file}`, completeHtml);

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
        }

        this.postsMeta
            .sort((a, b) => {
                return +new Date(a.postDate) > +new Date(b.postDate) ? -1 : 0;
            });

        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/js/search.json`, JSON.stringify(this.postsMeta, null, 2));

        await this.updateSiteMapAsync();
        await this.updateHomepageAsync();
        await this.updateCssAsync();
    }

    async updateHomepageAsync() {
        const indexDocument = new JSDOM(await fs.readFile(`./${this.siteConfig.source}/templates/index.html`, 'utf8')).window.document;

        this.homePageHtml.sort((a, b) => {
            return new Date(a.postDate).valueOf() > new Date(b.postDate).valueOf() ? -1 : 0;
        })

        indexDocument.getElementById('post-container').innerHTML = this.homePageHtml.map(x => x.html).join(' ');

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

        const completeHtml = await this.createRootHtmlAsync(shell.documentElement.innerHTML);
        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/index.html`, completeHtml);
        dropCss({
            css: this.css,
            html: completeHtml
        }).sels.forEach(sel => this.cssWhitelist.add(sel));
    }

    async update404Async() {
        const indexDocument = new JSDOM(await fs.readFile(`./${this.siteConfig.source}/templates/404.html`, 'utf8')).window.document;
        const shell = this.shellDocument;
        shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;

        const completeHtml = await this.createRootHtmlAsync(shell.documentElement.innerHTML);
        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/404.html`, await this.createRootHtmlAsync(shell.documentElement.innerHTML));
        dropCss({
            css: this.css,
            html: completeHtml
        }).sels.forEach(sel => this.cssWhitelist.add(sel));
    }

    async updateSiteMapAsync() {
        this.siteMap = `<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>${this.baseUrl}</loc>
<lastmod>${new Date().toISOString()}</lastmod>
<priority>1.00</priority>
</url>
${this.siteMap}
</urlset>`;
        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/sitemap.xml`, this.siteMap);
    }

    async updateCssAsync() {
        await this.prepareCssAsync();

        const gatherCssAsync = async (fullPath) => {
            const postDocument = new JSDOM(await fs.readFile(fullPath, 'utf8')).window.document;
            dropCss({
                css: this.css,
                html: postDocument.documentElement.innerHTML
            }).sels.forEach(sel => this.cssWhitelist.add(sel));
        }

        for (const x of (await fs
                .readdir(`./${this.siteConfig.source}/partials`)
        )
            .filter(file => path.extname(file).toLowerCase() === '.html')
            .map(file => `./${this.siteConfig.source}/partials/${file}`)) {
            await gatherCssAsync(x);
        }

        for (const x of (await fs
                .readdir(`./${this.siteConfig.source}/templates`)
        )
            .filter(file => path.extname(file).toLowerCase() === '.html')
            .map(file => `./${this.siteConfig.source}/templates/${file}`)) {
            await gatherCssAsync(x);
        }

        await this.cleanCssAsync();
    }

    async cleanCssAsync() {
        const sourceMapComment = "/*# sourceMappingURL=style.css.map */"

        // noinspection JSUnusedGlobalSymbols
        let optimized = dropCss({
            html: '',
            css: this.css,
            shouldDrop: sel => !this.cssWhitelist.has(sel),
        }).css;

        optimized += sourceMapComment;

        let cleanedCss = new CleanCSS().minify(optimized).styles;
        cleanedCss += sourceMapComment;

        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/css/style.css`, optimized);
        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/css/style.min.css`, cleanedCss);
        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/css/style.css.map`, this.sourceMap);
    }

    async minifyJsAsync() {
        const loopDocument = new JSDOM(this.postLoopTemplate).window.document;
        const getJsAsync = async () => {
            let output = '';

            const files = (await fs
                .readdir(`./${this.siteConfig.source}/js`))
                .filter(file => path.extname(file).toLowerCase() === '.js' && !file.includes('.min.'));

            for (const file of files) {
                output += (await fs.readFile(`./${this.siteConfig.source}/js/${file}`, 'utf8')) + '\r\n';
            }

            return output;
        }

        const js = (await getJsAsync()).replace('[POSTLOOP]', loopDocument.getElementsByTagName('body')[0].innerHTML);

        const uglified = await minify(js);

        await FileHelpers.writeFileAndEnsurePathExistsAsync(`./${this.siteConfig.output.main}/js/bundle.min.js`, uglified.code);
    }

    async getPictureSet(image: string, destination: string, folder: string, alt: string) {
        return (await this.imageProcessor.generateSourceSetAsync({
            images: [image],
            sizes: defaultSizes,
            destinationDirectory: destination,
            sourceSetPath: `${this.baseImagePath}${folder}`
        }, [alt]))[0];
    }

    setInnerHtml(element, value) {
        if (!element) return;
        element.innerHTML = value;
    }

    async saveAsync(postMeta: PostMeta, thumbnail: string, thumbnailAlt: string, rawEditor) {
        const postImageCopyPath = `./${this.siteConfig.source}/copy/img/${postMeta.file}`;
        const partialPath = `./${this.siteConfig.source}/partials/${postMeta.file}.html`;

        try {
            let exists = await FileHelpers.fileExists(partialPath);
            if (exists) {
                return {
                    success: false,
                    error: 'Post with the same path already exists.'
                }
            }
        } catch {
            return {
                success: false,
                error: 'Something went wrong.'
            }
        }

        this.saveInProgress = true;

        try {
            const postImages = rawEditor.blocks.filter(y => y.type === 'image');

            await fs.mkdir(postImageCopyPath, {recursive: true});

            if (postImages.length > 0) {
                for (const image of postImages) {
                    const url = image.data.file.url;

                    const newName = `${Utilities.slugify(image.data.alt || path.parse(url).name)}${path.extname(url)}`;
                    const oldName = path.basename(url);
                    const newPath = `.${url.replace(oldName, newName)}`;
                    await fs.copyFile(`.${url}`, newPath);

                    const pictureSet = await this.getPictureSet(newPath, postImageCopyPath, postMeta.file, image.data.alt);

                    image.data.pictureSet = pictureSet.pictureTag;
                }
            }

            const body = editorJsParser.parser(rawEditor.blocks);

            const thumbnailName = `${Utilities.slugify(thumbnailAlt || path.parse(thumbnail).name)}${path.extname(thumbnail)}`;
            const oldName = path.basename(thumbnail);
            const newPath = thumbnail.replace(oldName, thumbnailName);
            await fs.copyFile(thumbnail, newPath);

            const thumbnailPictureSet = await this.getPictureSet(newPath, postImageCopyPath, postMeta.file, thumbnailAlt);

            const socialMetaImage = await this.imageProcessor.generateResponsiveImageAsync(newPath, {width: '1200'}, postImageCopyPath, Images.mergeConfig({
                format: 'png',
                animated: false
            }));

            let newPost = (await this.loadTemplateAsync('empty-post'))
                .replace(/==title==/g, postMeta.title)
                .replace(/==author-name==/g, postMeta.author.name)
                .replace(/==formatted-date==/g, Utilities.formatter.format(postMeta.postDate))
                .replace(/==body==/g, body)
                .replace(/==thumbnail==/g, thumbnailPictureSet.pictureTag)
                .replace(/==metaImage==/g, `${this.baseImagePath}${postMeta.file}/${socialMetaImage.file}`)
                .replace(/==raw-post-date==/g, postMeta.postDate.toISOString())
                .replace(/==tags==/g, postMeta.tags)
                .replace(/==excerpt==/g, postMeta.excerpt)
                .replace(/==author-url==/g, postMeta.author.url);

            await FileHelpers.writeFileAndEnsurePathExistsAsync(partialPath, newPost);

            await FileHelpers.removeDirectoryAsync('./img_temp', false);
            await this.updateAllAsync();
            this.saveInProgress = false;
            return {
                success: true,
                post: `/${this.subFolder}posts/${postMeta.file}.html`
            }

        } catch (e) {
            this.saveInProgress = false;
            console.error(e);
            await FileHelpers.removeDirectoryAsync(postImageCopyPath, true);
            await FileHelpers.removeFileAsync(partialPath);
            return {
                success: false,
                error: e
            }
        }
    }
}
