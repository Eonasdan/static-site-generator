const rootSite = 'https://localhost:3000';

const fs = require('fs');
const jsdom = require("jsdom");
const {JSDOM} = jsdom;
const path = require('path');
const minifyHtml = require('html-minifier-terser').minify;
const dropCss = require('dropcss');
const cleanCSS = require('clean-css');
const {minify} = require('terser');

class PostMeta {
    file;
    title;
    body;
    postDate;
    updateDate;
    thumbnail;
    excerpt;
    tags;
    author;

    constructor(file = '', title = '', body = '', postDate = '', updateDate = '',
                thumbnail = '', excerpt = '', tags = '', author = new PostAuthor()) {
        this.file = file;
        this.title = title;
        this.body = body;
        this.postDate = postDate;
        this.updateDate = updateDate;
        this.thumbnail = thumbnail;
        this.excerpt = excerpt;
        this.tags = tags;
        this.author = author;
    }

}

class PostAuthor {
    name;
    url;

    constructor(name = '', url = '') {
        this.name = name;
        this.url = url;
    }
}

function stripHtml(html, replaceDoubleSpaceWith) {
    replaceDoubleSpaceWith = replaceDoubleSpaceWith || '';
    return html.textContent.replace(/(\r\n|\n|\r)/gm, '').replace(/\s+/g, replaceDoubleSpaceWith);
}

function removeDirectory(directory, removeSelf) {
    if (removeSelf === undefined) removeSelf = true;
    try {
        const files = fs.readdirSync(directory) || [];
        files.forEach(file => {
            const filePath = path.join(directory, file);
            if (fs.statSync(filePath).isFile())
                fs.unlinkSync(filePath);
            else
                removeDirectory(filePath);
        })
    } catch (e) {
        return;
    }
    if (removeSelf)
        fs.rmdirSync(directory);
}

// since everyone has to have their own meta data *rolls eyes* the primary purpose here
// is to quickly find similar tags and set them all at once
function setMetaContent(rootElement, selector, content) {
    [...rootElement.getElementsByClassName(selector)].forEach(element => {
        if (content) {
            element.setAttribute("content", content);
            element.removeAttribute("class");
        } else rootElement.getElementsByTagName('head')[0].removeChild(element);
    });
}

// doing this as a function so I don't have to null check values inline
function setStructuredData(structure, property, value) {
    if (!value) return;

    structure[property] = value;
}

function createRootHtml(html) {
    html = minifyHtml(html, {
        collapseWhitespace: true,
        removeComments: true
    });

    return `<!DOCTYPE html>
<html lang="en">${html}
</html>`;
}

//read shell template
const shellTemplate = fs.readFileSync(`./build/templates/shell.html`, 'utf8');

function getShellDocument() {
    return new JSDOM(shellTemplate).window.document;
}

//remove old stuff
removeDirectory('./posts', false);

const posts = fs
    .readdirSync('./build/post_partials')
    .filter(file => path.extname(file).toLowerCase() === '.html');

//create meta info
let postsMeta = [];

//prepare the static homepage text
//todo at some point we'll have to deal with paging or infinite scrolls or something
let homePageHtml = '';

// prepare site map
let siteMap = '';

//read css files
function getCss() {
    let output = '';

    const files = fs
        .readdirSync('./css')
        .filter(file => path.extname(file).toLowerCase() === '.css' && !file.includes('.min.'));

    files.forEach(file => {
        output += fs.readFileSync(`./css/${file}`, 'utf8') + '\r\n';
    });

    return output;
}

let css = getCss();
let cssWhitelist = new Set();

//create post files
//read post template
function getPostTemplate() {
    const indexDocument = new JSDOM(fs.readFileSync(`./build/templates/post-template.html`, 'utf8')).window.document;
    const shell = getShellDocument();
    shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;
    return shell.documentElement.innerHTML;
}

const postTemplate = getPostTemplate();

function parseMeta(postMeta, metaTag) {
    if (!metaTag) return;
    const title = metaTag.querySelector('title')?.innerHTML;
    if (title) postMeta.title = title;

    const thumbnail = metaTag.querySelector('thumbnail')?.innerHTML;
    if (thumbnail) postMeta.thumbnail = thumbnail;

    const postDate = metaTag.querySelector('post-date')?.innerHTML;
    if (postDate) postMeta.postDate = postDate;

    const updateDate = metaTag.querySelector('update-date')?.innerHTML;
    if (updateDate) postMeta.updateDate = updateDate;

    const excerpt = metaTag.querySelector('excerpt')?.innerHTML;
    if (excerpt) postMeta.excerpt = excerpt;

    const tags = metaTag.querySelector('tags')?.innerHTML;
    if (tags) postMeta.tags = tags;

    const postAuthor = metaTag.querySelector('post-author')?.innerHTML;
    if (postAuthor) {
        const name = metaTag.querySelector('name')?.innerHTML;
        if (name) postMeta.author.name = name;

        const url = metaTag.querySelector('url')?.innerHTML;
        if (url) postMeta.author.url = url;
    }
}

//read post loop template
const postLoopTemplate = fs.readFileSync(`./build/templates/post-loop.html`, 'utf8');

function setInnerHtml(element, value) {
    if (!element) return;
    element.innerHTML = value;
}

//for each post partial, we create a full html page
posts.forEach(file => {
    const fullyQualifiedUrl = `${rootSite}/posts/${file}`;
    const newPageDocument = new JSDOM(postTemplate).window.document;
    const postDocument = new JSDOM(fs.readFileSync(`./build/post_partials/${file}`, 'utf8')).window.document;
    const article = postDocument.querySelector('article');
    const loopDocument = new JSDOM(postLoopTemplate).window.document;
    newPageDocument.getElementById('post-inner').innerHTML = article.innerHTML;

    const fileModified = fs.statSync(`./build/post_partials/${file}`).mtime;
    let postMeta = new PostMeta(file, file.replace(path.extname(file), ''), stripHtml(article, ' '), fileModified, fileModified);

    parseMeta(postMeta, postDocument.querySelector('post-meta'));

    const publishDate = new Date(postMeta.postDate).toISOString();

    // create structured data
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "author": {
            "@type": "Person",
            "name": postMeta.author.name,
            "url": postMeta.author.url
        },
    };

    newPageDocument.title = postMeta.title;
    if (postMeta.thumbnail) {
        setInnerHtml(newPageDocument.getElementById('post-thumbnail'),
            `<img src="/img/${postMeta.thumbnail}" alt="" class="img-fluid" width="1200"/>`);
        setInnerHtml(loopDocument.getElementsByClassName('post-thumbnail')[0],
            `<img src="/img/${postMeta.thumbnail}" alt="" class="img-fluid" width="530"/>`);

        const fullyQualifiedImage = `${rootSite}/img/${postMeta.thumbnail}`;
        setMetaContent(newPageDocument, 'metaImage', fullyQualifiedImage);
        setStructuredData(structuredData, 'image', [
            fullyQualifiedImage
        ]);
    } else {
        setInnerHtml(newPageDocument.getElementById('post-thumbnail'), '');
        setInnerHtml(loopDocument.getElementsByClassName('post-thumbnail')[0], '');
        setMetaContent(newPageDocument, 'metaImage', '');
    }

    setMetaContent(newPageDocument, 'metaTitle', postMeta.title);
    setStructuredData(structuredData, 'headline', postMeta.title);
    setInnerHtml(loopDocument.getElementsByClassName('post-title')[0], postMeta.title);
    loopDocument.getElementsByClassName('post-link')[0].href = `/posts/${postMeta.file}`

    setMetaContent(newPageDocument, 'metaDescription', postMeta.excerpt);
    setMetaContent(newPageDocument, 'metaUrl', fullyQualifiedUrl);
    setStructuredData(structuredData, 'mainEntityOfPage', fullyQualifiedUrl);

    setMetaContent(newPageDocument, 'metaPublishedTime', publishDate);
    setStructuredData(structuredData, 'datePublished', publishDate);
    setInnerHtml(loopDocument.getElementsByClassName('post-date')[0], postMeta.postDate);

    if (!postMeta.updateDate) postMeta.updateDate = postMeta.postDate;
    const updateDate = new Date(postMeta.updateDate).toISOString();
    setMetaContent(newPageDocument, 'metaModifiedTime', updateDate);
    setStructuredData(structuredData, 'dateModified', updateDate);

    setMetaContent(newPageDocument, 'metaTag', postMeta.tags);
    setStructuredData(structuredData, 'keywords', postMeta.tags.split(', '));

    setInnerHtml(loopDocument.getElementsByClassName('post-author')[0], postMeta.author.name);
    setInnerHtml(loopDocument.getElementsByClassName('post-excerpt')[0], postMeta.excerpt);

    postsMeta.push(postMeta);

    // push structured data to body
    const structuredDataTag = newPageDocument.createElement("script");
    structuredDataTag.type = "application/ld+json";
    structuredDataTag.innerHTML = JSON.stringify(structuredData, null, 2);
    newPageDocument.getElementsByTagName("body")[0].appendChild(structuredDataTag);

    const completeHtml = createRootHtml(newPageDocument.documentElement.innerHTML);
    fs.writeFileSync(`./posts/${file}`, completeHtml);

    //update pure css
    dropCss({
        css,
        html: completeHtml
    }).sels.forEach(sel => cssWhitelist.add(sel));

    //add to homepage html

    homePageHtml += loopDocument.getElementsByTagName('body')[0].innerHTML;

    siteMap += `<url>
<loc>${fullyQualifiedUrl}</loc>
<lastmod>${new Date(postMeta.updateDate).toISOString()}</lastmod>
<priority>0.80</priority>
</url>`;
});

postsMeta = postsMeta
    .sort((a, b) => {
        return +new Date(a.postDate) > +new Date(b.postDate) ? -1 : 0;
    });

fs.writeFileSync('posts/posts.json', JSON.stringify(postsMeta, null, 2));

//set home page html
(function () {
    const indexDocument = new JSDOM(fs.readFileSync(`./build/templates/index.html`, 'utf8')).window.document;
    indexDocument.getElementById('post-container').innerHTML = homePageHtml;

    const shell = getShellDocument();
    shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;

    const script = shell.createElement('script');
    script.type = "module"
    script.innerHTML = "import 'https://cdn.jsdelivr.net/npm/@pwabuilder/pwaupdate';";

    shell.getElementsByTagName('head')[0].appendChild(script);

    const el = shell.createElement('pwa-update');
    shell.body.appendChild(el);

    const completeHtml = createRootHtml(shell.documentElement.innerHTML);
    fs.writeFileSync(`./index.html`, completeHtml);
    dropCss({
        css,
        html: completeHtml
    }).sels.forEach(sel => cssWhitelist.add(sel));
})();

//set 404 html
(function () {
    const indexDocument = new JSDOM(fs.readFileSync(`./build/templates/404.html`, 'utf8')).window.document;
    const shell = getShellDocument();
    shell.getElementById('mainContent').innerHTML = indexDocument.documentElement.innerHTML;

    const completeHtml = createRootHtml(shell.documentElement.innerHTML);
    fs.writeFileSync(`./404.html`, createRootHtml(shell.documentElement.innerHTML));
    dropCss({
        css,
        html: completeHtml
    }).sels.forEach(sel => cssWhitelist.add(sel));
})();

//create sitemap
(function () {
    siteMap = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<url>
<loc>${rootSite}</loc>
<lastmod>${new Date().toISOString()}</lastmod>
<priority>1.00</priority>
</url>
${siteMap}
</urlset>`;
    fs.writeFileSync(`./sitemap.xml`, siteMap);
})();

//prune css
(function () {
    let cleaned = dropCss({
        html: '',
        css,
        shouldDrop: sel => !cssWhitelist.has(sel),
    });
    fs.writeFileSync(`./css/style.min.css`, new cleanCSS().minify(cleaned.css).styles);
})();

//minify javascript
(async function () {
    const loopDocument = new JSDOM(postLoopTemplate).window.document;
    const getJs = () => {
        let output = '';

        const files = fs
            .readdirSync('./js')
            .filter(file => path.extname(file).toLowerCase() === '.js' && !file.includes('.min.'));

        files.forEach(file => {
            output += fs.readFileSync(`./js/${file}`, 'utf8') + '\r\n';
        });

        return output;
    }

    const js = getJs().replace('[POSTLOOP]', loopDocument.getElementsByTagName('body')[0].innerHTML);

    const uglified = await minify(js);

    fs.writeFileSync('./js/bundle.min.js', uglified.code);
})();