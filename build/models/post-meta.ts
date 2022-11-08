import PostAuthor from './post-author';

export default class PostMeta {
  file: string;
  title: string;
  body: string;
  postDate: Date;
  updateDate: Date;
  mastImage: HTMLElement;
  excerpt: string;
  tags = '';
  author: PostAuthor;
  thumbnail: string;
  metaImage: string;
  url: string;

  constructor(
    file = '',
    title = '',
    body = '',
    postDate = undefined,
    updateDate = undefined,
    mastImage = undefined,
    metaImage = '',
    excerpt = '',
    tags = '',
    author = new PostAuthor()
  ) {
    this.metaImage = metaImage;
    this.file = file;
    this.title = title;
    this.body = body;
    this.postDate = postDate;
    this.updateDate = updateDate;
    this.mastImage = mastImage;
    this.excerpt = excerpt;
    this.tags = tags;
    this.author = author;
  }

  parse(metaTag: HTMLElement) {
    if (!metaTag) return;
    const title = metaTag.querySelector('#title')?.innerHTML;
    if (title) this.title = title.trim();

    const mastImage = metaTag.querySelector('#thumbnail');
    if (mastImage.childNodes.length !== 0) {
      this.mastImage = <HTMLElement>mastImage;
      this.thumbnail = this.mastImage.getElementsByTagName('source')[3].srcset;
    }

    const metaImage = metaTag.querySelector('#metaImage')?.innerHTML;
    if (metaImage) this.metaImage = metaImage.trim();

    const postDate = metaTag.querySelector('#post-date')?.innerHTML;
    if (postDate) this.postDate = new Date(postDate.trim());

    const updateDate = metaTag.querySelector('#update-date')?.innerHTML;
    if (updateDate) this.updateDate = new Date(updateDate.trim());

    const excerpt = metaTag.querySelector('#excerpt')?.innerHTML;
    if (excerpt) this.excerpt = excerpt.trim();

    const tags = metaTag.querySelector('#tags')?.innerHTML;
    if (tags) this.tags = tags.trim();

    const postAuthor = metaTag.querySelector('#post-author')?.innerHTML;
    if (postAuthor) {
      const name = metaTag.querySelector('#name')?.innerHTML;
      if (name) this.author.name = name.trim();

      const url = metaTag.querySelector('#url')?.innerHTML;
      if (url) this.author.url = url.trim();
    }
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
