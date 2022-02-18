import {Stack} from './middleware';

export default interface Config {
    host?: string;
    port?: number;
    middlewares?: Stack[];
    directory?: string;
}