const generateWPContent = require("./index");
const API_URL = process.argv.slice(2)[0];
const CONTENT_TYPES = process.argv.slice(3);
generateWPContent(API_URL, CONTENT_TYPES);