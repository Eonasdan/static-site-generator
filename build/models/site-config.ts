export interface SiteConfig {
    site: {
        root: string;
        subfolder?: string;
    }
    output: {
        main: string;
        posts: string;
    },
    source: string;
    server: {
        serveFrom: string;
        port: number;
    }
}