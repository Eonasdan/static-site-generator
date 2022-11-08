export interface SiteConfig {
  site: {
    root: string;
    subfolder?: string;
  };
  output: {
    main: string;
    posts: string;
  };
  source: string;
  server: {
    serveFrom: string;
    port: number;
  };
  defaultAuthor: {
    name: string;
    url: string;
    avatar: string;
    bio: string;
  };
  services: {
    languageTools: boolean;
    azureSearch: boolean;
  };
}
