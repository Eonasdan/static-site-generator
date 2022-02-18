import {IncomingMessage, ServerResponse} from 'http';
import formidable from 'formidable';

const chokidar = require('chokidar');
import * as path from 'path';
import PicoServer from '../server/pico-server';
import {Next} from '../server/middleware';
import Build from './build';
import PostMeta from './PostMeta';
import PostAuthor from './PostAuthor';
import Utilities from './utilities';

export class Watcher {
    private pico: PicoServer;
    private builder: Build;

    constructor(builder: Build) {
        this.builder = builder;
        this.startAsync().then();
    }

    async startAsync() {
        this.builder.updateAll();
        this.pico = new PicoServer({
            port: this.builder.siteConfig.port,
            directory: '../site',
            middlewares: [
                {
                    middleware: this.uploadMiddlewareAsync,
                    route: '/editor/uploadFile'
                },
                {
                    middleware: this.editorSaveAsync,
                    route: '/editor/save'
                },
                {
                    middleware: this.loadEditorAsync.bind(this),
                    route: '/editor/*'
                },
                {
                    middleware: this.loadTemporaryImagesAsync.bind(this),
                    route: '/img_temp/*'
                }
            ]
        });
        await this.pico.startAsync();
        this.startFileWatcher();
    }

    refreshBrowser() {
        this.pico.refreshBrowser();
    }

    async uploadMiddlewareAsync(req: IncomingMessage, res: ServerResponse) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        try {
            const form = formidable({multiples: true, keepExtensions: true, uploadDir: './img_temp'});
            form.parse(req, (err, fields, files) => {
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
            debugger;
            console.log('Failed to upload file', e);
            res.writeHead(500);
            res.end(JSON.stringify({
                'success': 0
            }));
        }
    }

    async editorSaveAsync(req: IncomingMessage, res: ServerResponse, next: Next) {
        const form = formidable({multiples: true, keepExtensions: true, uploadDir: './img_temp'});
        form.parse(req, (err, fields, files) => {
            const slug = fields.title.toLowerCase().replace(/ /g, '-')
                .replace(/[^\w-]+/g, '');

            const editor = JSON.parse(fields.editor);
            const postDate = new Date(fields.postDate);

            const result = this.builder.save(new PostMeta(slug, fields.title,
                '', postDate, postDate, files.thumbnail.path,
                fields.excerpt, fields.tags, new PostAuthor(fields.postAuthorName, fields.postAuthorUrl)
            ), editor);

            res.end(JSON.stringify(result));
        });
    }

    async loadEditorAsync(req: IncomingMessage, res: ServerResponse) {
        await this.pico.defaultHandler(req, res, '../', false);
    }

    async loadTemporaryImagesAsync(req: IncomingMessage, res: ServerResponse) {
        await this.pico.defaultHandler(req, res, '../', false);
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

        let lastChange = '';
        let lastChangeFile = '';

        const handleChange = (event, path) => {
            Utilities.log(`${event}: ${path}`);
            if (path.startsWith(partials)) {
                this.builder.updatePosts();
            }
            if (path.startsWith(styles)) {
                this.builder.updateCss();
            }
            if (path.startsWith(templates)) {
                this.builder.updateAll();
            }
            if (path.startsWith(js)) {
                this.builder.minifyJs().then();
            }
            if (path.startsWith(copy)) {
                const destination = path.replace(copy, main)
                switch (event) {
                    case 'add':
                        this.builder.copyFile(path, destination);
                        break;
                    case 'unlink':
                        this.builder.removeFile(destination);
                        break;
                }
            }
            Utilities.log('Update successful');
            this.cleanTimer(this.refreshBrowser.bind(this));
            lastChange = Utilities.formatter.format(new Date());
            lastChangeFile = path;
            console.log('');
        }

        watcher
            .on('all', handleChange)
            .on('ready', () => console.log('[Make] Watching files...'));
    }

    private cleanTimer(callback: () => void, delay = 1000) {
        let timer = setTimeout(() => {
            callback();
            timer = null;
        }, delay);
    }
}