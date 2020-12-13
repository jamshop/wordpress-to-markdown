# WordPress to Markdown
A node script that converts a WordPress API  to Markdown.

There are a bunch of export tools but I wrote this one specifically to be able to point at any WordPress API and get the content.

For now (until I make an NPM package) you can download and modify this script.

It can download anything with `title`, `date`, `permalink` and `content.rendered`, which is most content types by default.

It can also download `media` - which will be treated differently.

## CLI Usage:

args = [siteURL, ...contentTypes]

```
node ./cli "http://wordpress-site.com/" "posts" "pages" "media"
```
Outputs to `wp` folder.

## Node Usage:

```js
const WPtoMD = require("./path/to/index");
const URL = "http://mysite.com";
const contentTypes = ["posts", "media"];
const options = {
  output: "./wp-exports"
  // See default functions below (override if required)
  resolvePermalinks, 
  transformURLs,
};

WPtoMD(URL, contentTypes, options);
```

```js
// Default resolvePermalinks and transformURL functions:

const resolvePermalinks = (slug, contentType) => {
  if ((contentType = "pages")) return `/${slug}/`;
  return `${contentType}/${slug}/`;
};

const transformURLs = (url, baseurl) => {
  url = `${url.replace(baseurl,"/")}`
  if(url.includes("wp-admin")) {
    url = "";
  }
  url = url.replace(RegExp(`\/wp-content\/uploads\/[0-9]{4}/[0-9]{2}\/`), "/assets/");
  return url
};