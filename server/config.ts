import {Stack} from './middleware';

export default interface Config {
    host?: string;
    port?: number;
    sub: string;
    middlewares?: Stack[];
    directory?: string;
}