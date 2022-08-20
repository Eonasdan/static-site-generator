import {IncomingMessage, ServerResponse, request} from 'http';
import formidable from 'formidable';
import * as path from 'path';

const chokidar = require('chokidar');

import {ParvusServer} from '@eonasdan/parvus-server';
import Build from './build';
import PostMeta from './models/post-meta';
import PostAuthor from './models/post-author';
import Utilities from './utilities';
import {EditorModel} from "./models/editor-model";
import {FileHelpers} from "./file-helpers";

export class Watcher {
    private parvusServer: ParvusServer;
    private builder: Build;

    constructor(builder: Build) {
        this.builder = builder;
        this.startAsync().then();
    }

    async startAsync() {
        await this.builder.updateAllAsync();
        this.parvusServer = new ParvusServer({
            port: this.builder.siteConfig.server.port,
            directory: `./${this.builder.siteConfig.server.serveFrom}`,
            subfolder: this.builder.siteConfig.site.subfolder,
            middlewares: [
                {
                    middleware: this.uploadMiddlewareAsync.bind(this),
                    route: '/editor/uploadFile'
                },
                {
                    middleware: this.editorSaveAsync.bind(this),
                    route: '/editor/save'
                },
                {
                    middleware: this.useDefaultHandlerAsync.bind(this),
                    route: '/editor/*'
                },
                {
                    middleware: this.useDefaultHandlerAsync.bind(this),
                    route: '/img_temp/*'
                },
                {
                    middleware: this.languagetoolProxyAsync.bind(this),
                    route: '/lt/*'
                },
                {
                    middleware: this.getConfigAsync.bind(this),
                    route: "/config"
                }
            ]
        });
        await this.parvusServer.startAsync();
        this.startFileWatcher();
    }

    refreshBrowser() {
        this.parvusServer.refreshBrowser();
    }

    async getConfigAsync(req: IncomingMessage, res: ServerResponse) {
        res.write(JSON.stringify(this.builder.siteConfig));
        res.end();
    }

    async languagetoolProxyAsync(req: IncomingMessage, res: ServerResponse) {
        try {
            const options = {
                hostname: 'localhost',
                port: 8010,
                path: '/v2/check',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            };

            const requestBody = await new Promise(resolve => {
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk;
                });
                req.on('end', () => {
                    resolve(body);
                });
            })

            const outbound = request(options, (r) => {
                let body = '';
                r.on('data', (chunk) => {
                    body += chunk;
                });
                r.on('end', () => {
                    if (body.startsWith('{')) res.write(body);
                    else {
                        res.writeHead(500);
                        res.write(JSON.stringify({
                            message: body
                        }))
                    }
                    res.end();
                });
            });
            outbound.write(`language=en-US&text=${requestBody}`);
            outbound.end();
        }
        catch (e) {
            console.log('Failed to call language tools', e);
            res.writeHead(500);
            res.write(JSON.stringify({
                'success': 0
            }));
            res.end();
        }
    }

    async uploadMiddlewareAsync(req: IncomingMessage, res: ServerResponse) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        try {
            const form = formidable({multiples: true, keepExtensions: true, uploadDir: './img_temp'});
            form.parse(req, (err, _, files) => {
                if (err) {
                    res.writeHead(err.httpCode || 400, {'Content-Type': 'text/plain'});
                    res.end(String(err));
                    return;
                }
                let s = path.join(__dirname, '../');
                const imagePath = files.image[0].filepath.replace(s, '').replace('\\', '/');
                res.end(JSON.stringify({
                    'success': 1,
                    'file': {
                        'url': `/${imagePath}`,
                    }
                }));
            });

            return;
        } catch (e) {
            console.log('Failed to upload file', e);
            res.writeHead(500);
            res.end(JSON.stringify({
                'success': 0
            }));
        }
    }

    /*
    Called when clicking save in the editor
     */
    async editorSaveAsync(req: IncomingMessage, res: ServerResponse) {
        const form = formidable({multiples: true, keepExtensions: true, uploadDir: './img_temp'});

        const fields: EditorModel = await new Promise(function (resolve, reject) {
            form.parse(req, function (err, fieldsArray, files) {
                if (err) {
                    reject(err);
                    return;
                }
                const editorModel: EditorModel = {} as EditorModel;
                Object.keys(fieldsArray).forEach(x => (editorModel[x] = fieldsArray[x][0]));
                editorModel.thumbnail = files.thumbnail[0].filepath;
                resolve(editorModel);
            }); // form.parse
        });

        const slug = Utilities.slugify(fields.title);

        const editor = JSON.parse(fields.editor);
        const postDate = new Date(fields.postDate);

        const result = await this.builder.saveAsync(new PostMeta(slug, fields.title, '', postDate, postDate, '', '', fields.excerpt, fields.tags, new PostAuthor(fields.postAuthorName, fields.postAuthorUrl)), fields.thumbnail, fields.thumbnailAlt, editor);

        res.write(JSON.stringify(result));
        res.end();
    }

    async useDefaultHandlerAsync(req: IncomingMessage, res: ServerResponse) {
        await this.parvusServer.defaultHandler(req, res, './', false);
    }

    private startFileWatcher() {
        const {source, output: {main}} = this.builder.siteConfig;
        const partials = `${source}\\partials`;
        const styles = `${source}\\styles`;
        const templates = `${source}\\templates`;
        const js = `${source}\\js`;
        const copy = `${source}\\copy`;
        const watcher = chokidar.watch([
            partials,
            styles,
            templates,
            js,
            copy
        ], {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            ignoreInitial: true
        });

        const handleChange = async (event, change) => {
            if (this.builder.saveInProgress) return;
            Utilities.log(`${event}: ${change}`);
            if (change.startsWith(partials)) {
                await this.builder.updatePostsAsync();
            }
            if (change.startsWith(styles)) {
                await this.builder.updateCssAsync();
            }
            if (change.startsWith(templates)) {
                await this.builder.updateAllAsync();
            }
            if (change.startsWith(js)) {
                await this.builder.minifyJsAsync();
            }
            if (change.startsWith(copy)) {
                const destination = change.replace(copy, main)
                switch (event) {
                    case 'add':
                        await FileHelpers.copyFileAsync(change, destination);
                        break;
                    case 'unlink':
                        await FileHelpers.removeFileAsync(destination);
                        break;
                }
            }
            Utilities.log('Update successful');
            this.cleanTimer(this.refreshBrowser.bind(this));
            console.log('');
        }

        watcher
            .on('all', handleChange)
            .on('ready', () => {
                console.clear();
                console.log(`Serving at http://localhost:${this.builder.siteConfig.server.port}`)
                console.log('[Make] Watching files...');
            });
    }

    private cleanTimer(callback: () => void, delay = 1000) {
        let timer = setTimeout(() => {
            callback();
            clearTimeout(timer);
        }, delay);
    }
}
