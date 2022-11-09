import PostAuthor from './post-author';

interface PostMetaOptions {
  file: string,
  title: string,
  body?: string,
  postDate: string,
  updateDate: string,
  mastImage?: string,
  metaImage?: string,
  excerpt: string,
  tags: string[] ,
  author: PostAuthor
}

export default class PostMeta {
  file: string;
  title: string;
  body: string;
  postDate: Date;
  updateDate: Date;
  mastImage: HTMLElement;
  excerpt: string;
  tags: string[] = [];
  author = new PostAuthor();
  thumbnail: string;
  metaImage: string;
  url: string;

  constructor(meta: PostMetaOptions) {
    Object.assign(this, meta);
  }

  toSearch() {
    return {
      file: this.file,
      title: this.title,
      body: this.body,
      postDate: this.postDate,
      updateDate: this.updateDate,
      excerpt: this.excerpt,
      tags: this.tags,
      thumbnail: this.thumbnail,
      url: this.url,
      author: this.author,
    };
  }
}
