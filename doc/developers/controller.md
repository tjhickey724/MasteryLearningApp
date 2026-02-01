# Structure of the Controller code

Most of the controller code is in the file app.js consisting of about 5000 lines of nodejs/javascript code.
We use the Mongoose package for accessing the models in the mongodb database. Most of the code is designed to handle
calls to app (i.e. routes) that get their input from an EJS view and that return their results in an EJS view.

Here is the preamble to the app which loads in many of the packages that are used (with a brief explanation of their purpose).
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

# Authorization
When a user connects to the app, we authenticate using google authentication since most people have a gmail account and it is free.
We then run the authorization code in ```routes/authFunctions.js``` to determine what permissions they have.

## Authentication middleware:
*  isLoggedIn - checks if the user is logged in
*  isAdmin - checks if the user is an admin
The rest of these middleware function assume that the user is logged in
and that there is a request parameter named :courseId
and that the authorize middleware has been invoked first.
*  hasCourseAccess - checks if the user is enrolled in the course
*  hasStaffAccess - checks if the user is a TA or the owner of the course
*  isOwner - checks if the user is the owner of the course
This middleware function assumes that the user is logged in
and that there is a courseId parameter in the request
and it sets the local variables in res.locals for
isEnrolled, isTA, isOwner, isStaff, is Admin
*  authorize - checks if the user is logged in and has access to the course
Every route that requires authentication for access to a course
should start with the authorize middleware and then will have those
functions available in res.locals.

Here is an example of using ```isLoggedIn```
```
app.get("/mla_home", isLoggedIn, (req,res) => {
  res.redirect("/mla_home/showCurrent");
});
```

and here is how we use ```isAdmin```
```
app.get("/instructors", isAdmin,
  async (req, res, next) => {
    res.locals.instructors 
       = await Instructor
              .find({})
              .populate('userId');
    res.render("showInstructors");
  }
);
```


