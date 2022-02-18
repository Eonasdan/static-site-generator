export interface SiteConfig {
    site: {
        root: string;
        subfolder?: string;
    }
    output: {
        main: string,
        posts: string,
    },
    source: string;
    port: number;
}