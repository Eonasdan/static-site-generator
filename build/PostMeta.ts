import PostAuthor from './PostAuthor';

export default class PostMeta {
    file: string;
    title: string;
    body: string;
    postDate: Date;
    updateDate: Date;
    thumbnail: string;
    excerpt: string;
    tags = '';
    author: PostAuthor;

    constructor(file = '', title = '', body = '', postDate = undefined, updateDate = undefined,
                thumbnail = '', excerpt = '', tags = '', author = new PostAuthor()) {
        this.file = file;
        this.title = title;
        this.body = body;
        this.postDate = postDate;
        this.updateDate = updateDate;
        this.thumbnail = thumbnail;
        this.excerpt = excerpt;
        this.tags = tags;
        this.author = author;
    }

    parse(metaTag: HTMLElement) {
        if (!metaTag) return;
        const title = metaTag.querySelector('#title')?.innerHTML;
        if (title) this.title = title.trim();

        const thumbnail = metaTag.querySelector('#thumbnail')?.innerHTML;
        if (thumbnail) this.thumbnail = thumbnail.trim();

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
}
