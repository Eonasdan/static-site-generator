# Static Blog Generator

The goal of this repo is to provide a simple yet robust static site generator. It is primarily aimed out running a static blog on GitHub Pages. There are two main components: The templates and make.js.

I've setup the make file to do a lot of SEO work for you. The included shell has meta tags for Twitter, Facebook and Google. The index file also includes a PWA script from PWA Builder. Each of the posts will generate structured data tags based on the custom meta tags you provide. The script auto generates a sitemap.xml file each time you run the make file. 

All none-minified (`bootstrap.css` not `bootstrap.min.css`) js/css files in their perspective folders get compressed and combined into a single js and css file.

##Setup

Be sure to run `npm i`.

That's really all you *have* to do. You can now run `npm start` and browser-sync will run usually it will start a dev server at `http://localhost:3000`.

If you want the service worker (PWA) to work locally, you will need to provide a self signed cert to the browser-sync config file (`build/bs-config.js`). Otherwise, the console will complain, however if you deploy this to Github Pages, it will be fine.

###Templates

You will need to update the templates under `/build/templates`.

You can replace all of the html with a theme of your choosing.

#### Shell `build/templates/shell.html`
This is the main layout of your site. The make file will be used to create a live index, 404, and use the `post-template` file in combination with any partial post html files under `build/post_partials`.

Make sure you either remove or replace meta tags marked with `REPLACEME`. Note that some of these tags will get populated from the make script.

#### Post Loop `build/templates/post-loop.html`
This html will be used to display a post list on the home page. It's also used to display search results.
##### Home page display:
The following class names are available for use. 

Note that unless otherwise mentioned the class names can be on any element. The contents of the tag will be replaced. 

|Class|Required|Description
|---|---|---|
|post-link| Yes | This needs to be an `a` tag so that the `href` can be set.|
|post-title| Recommended | Title of the post |
|post-excerpt| Recommended | A short description |
|post-author| No | Post author |
|post-date| No | Post publish date |
|post-thumbnail| No | Thumbnail image. This will create an `img` tag |
  
##### Search
Along with the home page, there is also a search functionality in `/js/post.js`. The post loop html is also injected into this js file to display search results.
This is works slight differently by using javascript template literals e.g. `Hello ${name}`.

|Class|Required|Description
|---|---|---|
|${post.file}| Yes | This needs to be `<a href="/posts/${post.file}"` |
|${post.title}| Recommended | Title of the post |
|${post.excerpt}| Recommended | A short description |
|${post.author.name}| No | Post author |
|${post.postDate}| No | Post publish date |
|${post-thumbnail}| No | Thumbnail image. This needs to be in the src of an `img` tag |


#### Index `build/templates/post-loop.html`
This is the home page. The only requirement here is a div with the id of `post-container`. The post loop above will be injected here.

```html
<div id="post-container">
</div>
``` 

#### Post Template `build/templates/post-template.html`
This what the main post page will look like. Each html file found under `build/post_partials` will use `shell` => `post-template` => `[xyz].html` to generate a complete static html file. 

The only requirement is a div with the id of `post-inner`.

```html
<div id="post-inner">
</div>
``` 

### Make file

You will need to change the first line `const rootSite = 'https://localhost:3000';` to your own site. This is used to the generate site map and meta tags. As long as the template guide works for you, there shouldn't be much you have to change here. I've done my best to make things generic and flexible enough that you don't have to mess with the make file.

## Adding New Posts
To add a new post, create an html file under `build/post_partials`. Do not include a full html document, just the "meat" of the post. See the second above about `post-template`. Once you've created the file run `npm run build`. You can run `npm start` to start a local server that you can browse to your site. Whenever you run the make/build browser-sync will automatically refresh the site for you.

You should provide a custom `post-meta` tag in each posts for example:

```html
<post-meta>
    <title>Man must explore, and this is exploration at its greatest</title>
    <thumbnail>post-bg.jpg</thumbnail>
    <post-date>11/19/2020</post-date>
    <update-date>11/20/2020</update-date>
    <excerpt>Problems look mighty small from 150 miles up
    </excerpt>
    <tags>space, issum, open source, static site</tags>
    <post-author>
        <name>Space Ipsum</name>
        <url>http://spaceipsum.com/</url>
    </post-author>
</post-meta>
```

`thumbnail` assumes images are located in the `/img` folder.

`update-date` is a great way to let the search engines know you've updated your article and can be skipped otherwise.

`tags` should be a comma separated list.
