const fetch = require("node-fetch");
const fs = require("fs-extra");
var path = require("path");
const transformAndWriteToFile = require("json-to-frontmatter-markdown").default;
const TurndownService = require("turndown");
const turndownService = new TurndownService();
const {pipeline} = require('stream');
const {promisify} = require('util');
const streamPipeline = promisify(pipeline);

const resolvePermalinks = (slug, contentType) => {
  if ((contentType = "pages")) return `/${slug}/`;
  return `${contentType}/${slug}/`;
};

const transformURLs = (url, baseurl) => {
  url = `${url.replace(baseurl,"/")}`
  if(url.includes("wp-admin")) {
    url = "";
  }
  url = url.replace(RegExp(`\/wp-content\/uploads\/[0-9]{4}/[0-9]{2}\/`), "/assets/")

  return url
};

const downloadMedia = async ({ guid, slug, media_details }, overrides) => {
  const options = {
    output: "./wp",
    ...overrides,
  };

  const res = await fetch(guid.rendered);
  const ext = path.extname(media_details.file);
  const filePath = path.join(options.output, "media", `${slug}${ext}`);
  await fs.ensureDir(path.join(options.output, "media"));
  const fileStream = fs.createWriteStream(filePath);
  await streamPipeline(res.body, fileStream);
  console.log(`Asset downloaded: ${filePath}`);
};

const getPagedContent = async (endpoint, page = 1) => {
  // Recurse through all the content
  // Super large sites might hit a depth limit in node
  // I'm classifying that as out of scope for this project at the moment
  let content = [];
  const response = await fetch(endpoint + `?page=${page}`);
  const totalPages = parseInt(response.headers.get("x-wp-totalpages"), 10);
  content = await response.json();
  if (page < totalPages) {
    const nextPage = await getPagedContent(endpoint, page + 1);
    content = [...content, ...nextPage];
  }
  return content;
};

const getContent = async (URL, contentTypes) => {
  const content = await Promise.all(
    contentTypes.map(async (type) => {
      const endpoint = `${URL.replace(/\/?$/, "/")}wp-json/wp/v2/${type}`;
      return getPagedContent(endpoint);
    })
  );
  // converts array to object with contentType keys
  return content.reduce(
    (prev, next, index) => ({ ...prev, [contentTypes[index]]: next }),
    {}
  );
};

const generateFiles = (URL, content, overrides) => {
  const options = {
    resolvePermalinks,
    transformURLs,
    output: "./wp",
    ...overrides,
  };

  turndownService.addRule("transformHref", {
    filter: (node) => node.nodeName === "A" && node.getAttribute("href"),
    replacement: (content, node) =>
      `[${content}](${options.transformURLs(node.getAttribute("href"), URL)})`,
  });

  turndownService.addRule("transformSrc", {
    filter: (node) => {
      const isImage = node.nodeName === "IMG" && node.getAttribute("src");
      const isSource = node.nodeName === "SOURCE" && node.getAttribute("src");
      return isImage || isSource;
    },
    replacement: (content, node) =>
      `[${content}](${options.transformURLs(node.getAttribute("src"), URL)})`,
  });

  // ToDo: Add rule for srcSet

  Object.keys(content).forEach((contentType) => {
    content[contentType].forEach((post) => {
      if (!post.content.rendered) return;
      const body = turndownService.turndown(post.content.rendered);
      transformAndWriteToFile({
        frontmatterMarkdown: {
          frontmatter: [
            { title: post.title.rendered },
            { date: post.date.split("T")[0] },
            { permalink: options.resolvePermalinks(post.slug, contentType) }, // Must have trailing slash to if you want pretty URLs
            { layout: `${contentType}` },
          ],
          body,
        },
        path: path.join(options.output, contentType),
        fileName: `${post.slug}.md`,
      });
    });
  });
};

module.exports = (URL, contentTypes, options) => {
  getContent(URL, contentTypes).then((content) => {
    const { media, ...restTypes } = content;
    if (media) {
      media.forEach(m => downloadMedia(m, options));
    }
    generateFiles(URL, restTypes, options);
  });
};
