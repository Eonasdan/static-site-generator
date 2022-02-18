import {IncomingMessage, ServerResponse} from 'http';

export type Stack = {
    route?: string;
    pattern?: RegExp;
    middleware: Middleware;
}

export type Middleware<
    Rq extends IncomingMessage = IncomingMessage,
    Rs extends ServerResponse = ServerResponse
    > = (
    request: Rq,
    response: Rs,
    next: Next
) => Promise<void>;

export interface Next {
    (): true;
    reset: () => void;
    status: () => boolean;
}

export const generateNext = () => {
    let status = false;

    const next: Next = () => {
        return (status = true);
    };

    next.status = () => {
        return status;
    };

    next.reset = () => {
       status = false;
    };

    return next;
};