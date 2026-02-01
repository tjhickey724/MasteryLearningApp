# Structure of the Controller code

All of the controller code is in the file app.js consisting of about 5000 lines of nodejs/javascript code.
We use the Mongoose package for accessing the models in the mongodb database. Most of the code is designed to handle
calls to app (i.e. routes) that get their input from an EJS view and that return their results in an EJS view.

Here is the preamble to the app which loads in all of the packages that are used (with a brief explanation of their purpose).
``` javascript
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan"); // to log requests to the console
const showdown  = require('showdown'); // to convert markdown to HTML
const converter = new showdown.Converter({
  literalMidWordUnderscores: true,  // Prevents underscores in the middle of words from being parsed as emphasis
  literalMidWordAsterisks: true,    // Same for asterisks (optional)
  simplifiedAutoLink: true,         // Optional, but useful for other formatting
  strikethrough: true,              // Optional
  tables: true,                     // Optional
  ghCodeBlocks: true                // Optional
});

const multer = require("multer"); // to handle file uploads
const csv = require('csv-parser')
const streamifier = require("streamifier"); // to convert a buffer to a stream for file uploads

const fsPromises = require('fs').promises; // to read files asynchronously

const archiver = require('archiver'); // to create zip files of personalized exams

const aws = require('aws-sdk'); //"^2.2.41" to interact with AWS S3 for file uploads
const multerS3 = require("multer-s3"); // to handle file uploads to AWS S3
const cors = require("cors")(); // to allow cross-origin requests
const ejs = require('ejs'); // to render ejs templates


require("dotenv").config();
```
