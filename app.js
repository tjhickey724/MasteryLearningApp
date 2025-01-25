// Start/restart this with
// pm2 start bin/www -n mastery -i 3
// restart with
// pm2 restart mastery
// get help with
// pm2

// here are the standard requires for an express app
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const showdown  = require('showdown');
const converter = new showdown.Converter();
const multer = require("multer");
const csv = require('csv-parser')
const streamifier = require("streamifier");

const fsPromises = require('fs').promises;

const archiver = require('archiver'); // to create zip files of personalized exams

const aws = require('aws-sdk'); //"^2.2.41"
const multerS3 = require("multer-s3");
const cors = require("cors")();
const ejs = require('ejs');


require("dotenv").config();

let storageAWS = null;

let s3="";

if (process.env.UPLOAD_TO == "AWS") {
  const aws_config = {
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY,
    region: process.env.AWS_REGION,
  };
  aws.config.update(aws_config);

  s3 = new aws.S3();

  storageAWS = multerS3({
    s3: s3,
    //acl: 'public-read',
    bucket: process.env.AWS_BUCKET_NAME,
    key: function (req, file, cb) {
        // req.suffix 
        //     = file.originalname.slice(file.originalname.lastIndexOf('.'))
        //        || '.???';
        
        const extension = path.extname(file.originalname).toLowerCase();
        req.suffix = extension; 
        
        cb(null, req.filepath+req.suffix); //use Date.now() for unique file keys

        //cb(null, file.originalname); //use Date.now() for unique file keys
    }
  })
}

const storageLocal = multer.diskStorage({
  destination: function(req, file, cb) {
      cb(null, 'public')
  },
  filename: function(req, file, cb) {
      // req.suffix 
      //    = file.originalname.slice(file.originalname.lastIndexOf('.'))
      //       || '.???';
      const extension = path.extname(file.originalname).toLowerCase();
      req.suffix = extension; 
      //const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, req.filepath+req.suffix)//+file.originalname)
  }
})

const upload = 
  (process.env.UPLOAD_TO=='AWS')?
    multer({ storage: storageAWS })
    :
    multer({storage: storageLocal});

const memoryStorage = multer.memoryStorage()
const memoryUpload = multer({ storage: memoryStorage })

/*
 here is code we can use to delete an uploaded file
   await unlinkAsync(file_path)
   https://stackoverflow.com/questions/49099744
*/
const fs = require('fs')
const { promisify } = require('util')
const unlinkAsync = promisify(fs.unlink)




// Routes
//const reviews = require('./routes/reviews');
const auth = require('./routes/authRouter');
const similarity = require('./routes/similarity');
const updates = require('./routes/updates');


// Models!
const Course = require("./models/Course");
const CourseSkill = require("./models/CourseSkill");
const ProblemSet = require("./models/ProblemSet");
const Problem = require("./models/Problem");
const Answer = require("./models/Answer");
const Review = require("./models/Review");
const User = require("./models/User");
const CourseMember = require("./models/CourseMember");
const Skill = require("./models/Skill");
const SupportFile = require("./models/SupportFile.js");
const RegradeRequest = require("./models/RegradeRequest");
const PostedGrades = require("./models/PostedGrades.js");
const Instructor = require("./models/Instructor");
//const ejsLint = require("ejs-lint");


const upload_to = process.env.UPLOAD_TO; // AWS or LOCAL

if (process.env.UPLOAD_TO == "AWS") {
  // ...
}



// AUTHENTICATION MODULES
// TJH - why are these not defined with "CONST" declarations??
// TJH - make sure we need all of these ...
(session = require("express-session")), 
(bodyParser = require("body-parser")), 
(flash = require("connect-flash"));
// This allows the session variables to be stored in the database
// so we can use multiple servers with the same session data
const MongoStore = require("connect-mongo")(session);
// END OF AUTHENTICATION MODULES

// INITIALIZING THE MONGOOSE DATABASE CONNECTION
const mongoose = require("mongoose"); 

// we load the mongoose server data from the .env file
mongoose.connect(process.env.MONGODB_URL, {useNewUrlParser: true, useUnifiedTopology: true, family: 4});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("we are connected!!!");
  console.log(`process.env.MONGODB_URL=${process.env.MONGODB_URL}`);
  console.log(`db.name=${db.name}`);
});

/*
  Whitelist of instructors who are able to create courses on the MLA.
  For now it is just me, but we can add more instructors as needed.
*/
const instructors = [
  "tjhickey@brandeis.edu",
  "tjhickey724@gmail.com",
  "timhickey@me.com",
  "jamespetullo@brandeis.edu",
  "rtorrey@brandeis.edu",
  "merrill2@brandeis.edu",
  "ellatuson@brandeis.edu",
];

var app = express();



var http = require("http").Server(app);

// TJH - I don't think we need this any more
var io = require("socket.io")(http);

/*
Authentication middleware:
  isLoggedIn - checks if the user is logged in
  isAdmin - checks if the user is an admin
The rest of these middleware function assume that the user is logged in
and that there is a request parameter named :courseId
and that the authorize middleware has been invoked first.
  hasCourseAccess - checks if the user is enrolled in the course
  hasStaffAccess - checks if the user is a TA or the owner of the course
  isOwner - checks if the user is the owner of the course
This middleware function assumes that the user is logged in
and that there is a courseId parameter in the request
and it sets the local variables in res.locals for
isEnrolled, isTA, isOwner, isStaff, is Admin
  authorize - checks if the user is logged in and has access to the course
Every route that requires authentication for access to a course
should start with the authorize middleware and then will have those
functions available in res.locals.
*/
const {isLoggedIn, hasCourseAccess, hasStaffAccess, isOwner, isInstructor, isAdmin, authorize} = require('./routes/authFunctions.js');


// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// TJH - this needs more explanation ...
app.disable('etag'); // get rid of 304 error?

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors);
/*************************************************************************
     HERE ARE THE AUTHENTICATION ROUTES
**************************************************************************/

// this is used to allow for session variables, which are used for authentication
app.use(session(
  {
    secret: "zzbbyanana",
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 24 * 60 * 60 * 1000}, // allow login for one day...
    store: new MongoStore({mongooseConnection: mongoose.connection}),
  })
);

// TJH - I don't think we are sending flash messages  
app.use(flash());

app.use('/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(auth);
app.use(similarity);
app.use(updates);








app.get('/', (req, res) => {
  res.redirect('/mla_home');
});

app.get("/instructors", isAdmin,
  async (req, res, next) => {
    res.locals.instructors 
       = await Instructor
              .find({})
              .populate('userId');
    res.render("showInstructors");
  }
);

app.get("/removeInstructor/:userId", isAdmin,
  async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const instructor 
        = await Instructor
              .findOneAndUpdate(
                {userId},
                {$set:{status:"inactive"}},
                {new:true});
        res.redirect("/instructors");
    } catch (e) {
      next(e);
    }
  }
);

app.get("/approveInstructor/:userId", isAdmin,
  async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const instructor 
        = await Instructor
              .findOneAndUpdate(
                {userId},
                {$set:{status:"active"}},
                {new:true});
      res.redirect("/instructors");
    } catch (e) {
      next(e);
    }
  }
);

app.post("/addInstructor", isAdmin,
  async (req, res, next) => {
    try {
      const email = req.body.email;
      let user = await User.findOne({googleemail:email});
      if (!user) {
        // create a new user with the email as the googleemail
        const userJSON = {
          googleemail:email,
          createdAt: new Date(),
        }
        user = new User(userJSON);
        user = await user.save();
      }
      const instructor = new Instructor({userId:user._id});
      await instructor.save();
      res.redirect("/instructors");
    } catch (e) {
      next(e);
    }
  }
)
app.get("/deleteCourse/:courseId", isAdmin,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      // 
    } catch (e) {
      next(e);
    }
  }
)

const deleteStudentData = async (courseId) => {
      const answers 
         = await Answer.find({courseId});



      // now delete all of the images in the answers
      for (let answer of answers) {
        if (answer.imageFilePath) {
          if (answer.imageFilePath.startsWith("https://")) {
            try {
                // remove the https://domain_name/ from the imageFilePath to get the key
                const imageKey = answer.imageFilePath.split("/").slice(3).join("/");
                await s3.deleteObject({
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: imageKey
                }).promise();
              } catch (e) {
                console.error(`error deleting AWS file ${answer.imageFilePath}`);
                console.error(`with key ${imageKey}`);
                console.error(`error=${e}`);
            }
          } else {
            const localPath = path.resolve("public"+answer.imageFilePath);
            try{
              // delete the local file
              await unlinkAsync(localPath);  
            } catch (e) {
              console.error(`error deleting file ${answer.imageFilePath}`);
              console.error(`error=${e}`);
            }
          }
        }
      }

}
app.get("/deleteCourse/:courseId", isAdmin,
  // this is dangerous because it might delete skills and problems
  // that are used in other courses ...
  // I should check if the skill or problem is used in another course
  // before deleting...
  // I could also just have an "archive" flag which indicate that the
  // course should not be viewed....
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      res.send("deleting courses is not allowed yet");
    } catch (e) {
      next(e);
    }
  }
)

app.get("/deleteStudentData/:courseId", isAdmin,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;

      await deleteStudentData(courseId);
      
      // now delete all of the grades for the course
      await PostedGrades.deleteMany({courseId: courseId});

      // now delete all of the answers for the course
      await Answer.deleteMany({courseId: courseId});

      // now delete all of the courseMembers for the course, except the owner
      await CourseMember.deleteMany({courseId: courseId, role: {$ne:"owner"}});

      // now delete all of the regradeRequests for the course
      await RegradeRequest.deleteMany({courseId: courseId});

      // now delete all of the reviews for the course
      await Review.deleteMany({courseId: courseId});
      
      
      res.redirect("/showCourse/" + courseId);
    } catch (e) {
      console.error(`error deleting student data ${e}`);
      next(e);
    }
  }
)


//const approvedLogins = ["tjhickey724@gmail.com", "csjbs2018@gmail.com"];

/* 
  this handles all routes dealing with reviews
  the user must have proper authentication to access these routes
*/



app.get("/mla_home", isLoggedIn, (req,res) => {
  res.redirect("/mla_home/showCurrent");
});

app.get("/mla_home/:show", isLoggedIn,
  async (req, res, next) => {
  /*
    this is the main page with links to all of the courses
    the user is enrolled in or teaching. It only requires that
    they be logged in and they can create a new course or join an
    existing course if they have the course pin.
  */
  const user = req.user;
  

  if (!req.user) next();

  const show = (req.params.show=="showAll")?'showAll':'currentOnly';

  const userId = req.user._id;
  const coursesOwned = 
    (show=="showAll"?
       await Course.find({ownerId: userId}) :
       await Course.find({ownerId: userId, active:true}));

  const registrations = await CourseMember.find({studentId: userId,role:'student'}, "courseId");
  const registeredCourses = registrations.map((x) => x.courseId);
  const coursesTaken = await Course.find({_id: {$in: registeredCourses}});
  
  const taRegistrations = await CourseMember.find({studentId: userId,role:'ta'}, "courseId");
  const taRegisteredCourses = taRegistrations.map((x) => x.courseId);
  const coursesTAing = await Course.find({_id: {$in: taRegisteredCourses}});

  const title = "PRA";


  res.locals = {
    ...res.locals,
    user,
    title,
    coursesOwned,coursesTAing,coursesTaken,
    show,
  };

  res.render("index");
});


app.get("/about", isLoggedIn,
  (req, res, next) => {
  res.render("about");
});

app.get("/profile", isLoggedIn,
  async (req, res, next) => {
  if (res.locals.entryNum == undefined) {
    res.locals.entryNum = "all";
  }
  res.render("showProfile");
});

app.post("/profile", isLoggedIn,
  async (req, res, next) => {
  res.locals.entryNum = req.body.enNum;
  res.render("showProfile");
});

app.get("/stats", isLoggedIn,
  async (req, res, next) => {
  let courseCount = await Course.find().count();
  let userCount = await User.find().count();
  let problemCount = await Problem.find().count();
  let answerCount = await Answer.find().count();
  let reviewCount = await Review.find().count();
  let courses = await Course.find({}, {name: 1});
  let googleemail;
  if (typeof req.user !== "undefined") {
    googleemail = req.user.googleemail;
  } else {
    googleemail = "";
  }
  res.render("stats.ejs", {courseCount, userCount, problemCount, answerCount, reviewCount, courses, googleemail});
});




app.get("/createCourse", isLoggedIn, isInstructor,
  (req, res) => {
    res.render('createCourse');
});

// rename this to /createCourse and update the ejs form

app.post("/createNewCourse", isLoggedIn,
  async (req, res, next) => {

  if (false && !req.user.googleemail.endsWith("@brandeis.edu")) {
    res.send("You must log in with an @brandeis.edu account to create a class. <a href='/logout'>Logout</a>");
    return;
  } else if (!(req.body.norobot == "on" && req.body.robot == undefined)) {
    res.send("no robots allowed!");
    return;
  }
  try {
    let coursePin = await getCoursePin();
  
    let newCourse = new Course({
      name: req.body.courseName,
      ownerId: req.user._id,
      startDate: new Date(req.body.startDate),
      stopDate: new Date(req.body.stopDate),
      courseType: req.body.courseType,
      coursePin: coursePin,
      createdAt: new Date(),
      active: true,
    });


    let theCourse = await newCourse.save();
    // create a courseMember entry for the owner
    let registration = {
      studentId: req.user._id,
      courseId: theCourse._id,
      role: "owner",
      createdAt: new Date(),
    };
    let cm = new CourseMember(registration);
    await cm.save();

    const title = await fsPromises.readFile(
      path.join(__dirname, 'public', 'latex','title.tex'), 
      'utf8'
    );

    const preamble = await fsPromises.readFile(
      path.join(__dirname, 'public', 'latex','preamble.tex'), 
      'utf8'
    );


    // store the title and preamble support files
    const titleFile 
     = new SupportFile(
      {name:'title',
       courseId:theCourse._id,
       createdAt: new Date(),
       text:title});

    const preambleFile 
       = new SupportFile(
          {name:'preamble',
           courseId:theCourse._id,
           createdAt: new Date(),
           text:preamble});

    await titleFile.save();
    await preambleFile.save();


    res.redirect("/showCourseToStaff/" + theCourse._id);
  } catch (e) {
    next(e);
  }
});

async function getCoursePin() {
  // this only works if there are many fewer than 10000000 courses
  // but that won't be an issue with this alpha version!
  let coursePin = Math.floor(Math.random() * 10000000);
  let lookupPin = await Course.find({coursePin: coursePin}, "coursePin");

  while (lookupPin.length > 0) {
    coursePin = Math.floor(Math.random() * 10000000);
    lookupPin = await Course.find({coursePin: coursePin}, "coursePin");
  }
  return coursePin;
}

/*
All routes below here must start with a courseId parameter
*/

app.get("/setActive/:courseId/:value", authorize, isOwner,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const value = req.params.value;
    await Course.findOneAndUpdate({_id: courseId}, {active: value=='true'});
    res.redirect("/mla_home");
  } catch (e) {
    next(e);
  }
 }
)

// app.use(reviews);



app.get("/showRoster/:courseId", authorize, hasStaffAccess, 
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    res.locals.courseInfo 
       = await Course.findOne(
                {_id: courseId}, 
                "name coursePin ownerId");

    const memberList = 
        await CourseMember
              .find({courseId,role:{$ne:"dropped"}})
              .populate('studentId');
    const members = memberList.map((x) => x.studentId);

    if (!members.includes(res.locals.courseInfo.ownerId)) {
      // do nothing for now
    }
    res.locals.members = members;//await User.find({_id: {$in: memberIds}});
    res.locals.memberList = memberList;

    res.render("showRoster");
  } catch (e) {
    next(e);
  }
});

app.get("/dumpStats/:courseId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    const memberIds = memberList.map((x) => x.studentId);
    const members = await User.find({_id: {$in: memberIds}});
    const grades = 
        await Answer.find({courseId:id,studentId:{$in: memberIds}})
              .populate('skills')
              .populate('studentId')
              .populate('psetId')
              .populate('problemId')
                ;
    res.json(grades);
  } catch (e) {
    next(e);
  }
});

app.post("/addStudents/:courseId", authorize, isOwner, 
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    let emails = req.body.emails.split("\n").map((x) => x.trim());
    for (let e of emails) {
      let z = await User.findOneAndUpdate({googleemail: e}, {googleemail: e}, {upsert: true, new: true});
      let registration = {
        studentId: z._id,
        courseId: id,
        createdAt: new Date(),
      };
      let cm = await CourseMember.findOneAndUpdate({studentId: z._id, courseId: id}, registration, {upsert: true, new: true});

    }
    let users = await User.find({googleemail: {$in: emails}});

    res.redirect("/showRoster/" + id);
  } catch (e) {
    next(e);
  }
});


const updateCourseMembers = async (sectionDocuments) => {
  try {
      /*
        for each student in the section, update the courseMember collection.
        First lookup their user id in the User collection.
        Then update the courseMember collection with the new section and role.
        and generate a list of their userIds. 
        Finally, change the role of all students in the course
        who are not in the section to "dropped".
        When the sectionData is uploaded this is the official list of students
        in the class.
      */
      let userIds = [];
      let course = {}; // will be the Course object from the section docs
      for (let sectionMember of sectionDocuments) {
        // update section data for existing students
        // and add new students to the CourseMember collection
        const email = sectionMember.email;
        const courseId = sectionMember.courseId;
        course = await Course.findOne({_id:courseId});
        let user = await User.findOne({googleemail:email});
        if (!user) {
          // create a new user with the email as the googleemail
          const userJSON = {
            googleemail:email,
            googlename:sectionMember.name,
            createdAt: new Date(),
          }
          user = new User(userJSON);
          user = await user.save();
        }
        userIds.push(user._id);
        let courseMember 
            = await CourseMember.findOne(
                      {studentId:user._id,
                        courseId:course._id});
        if (courseMember) {
          // update their section and role if they changed
          if ((courseMember.section != sectionMember.section) 
                ||
              (courseMember.role != "student"))
            {
            courseMember.section = sectionMember.section;
            courseMember.role = 'student';
            courseMember.createdAt = new Date();
            courseMember = await courseMember.save();
          }
        } else {
          // add them to the class
          const courseMemberJSON = {
            studentId:user._id,
            courseId:course._id,
            section:sectionMember.section,
            role:"student",
            createdAt: new Date(),
          }
          courseMember = new CourseMember(courseMemberJSON);
          courseMember = await courseMember.save();
        }
      }

      /* all users in the course who are not in the section, 
          are removed from the course.
          They still have ther grades in PostedGrades and can
          easily he re-added to the course.
      */
      //const courseMembers = 
      await CourseMember.deleteMany(
          {courseId:course._id,studentId:{$nin:userIds},role:"student"});

  } catch (e) {
    console.error(`error updating course members ${e}`);
  }

}

app.post("/uploadRoster/:courseId", 
  authorize, hasStaffAccess,
  memoryUpload.single('sections'),
 async (req, res, next) => {

    const courseId = req.params.courseId;
    const course = await Course.findOne({_id:courseId})
    res.locals.course = course;


    /*
    read the uploaded csv file and update the grades
    */

    const { buffer, originalname } = req.file;

  const dataFromRows = [];

  streamifier
    .createReadStream(buffer)
    .pipe(csv()) //.parse({ headers: true, ignoreEmpty: true })) // <== this is @fast-csv/parse!!
    .on("data", (row) => {
      dataFromRows .push(row);
    })
    .on("end", async (rowCount) => {
      try {

        // read section data 
        let documents = []
        dataFromRows.forEach(async (row) => {
            const email = row.email;
            const name = row.name;
            const section = row.section;

            // create new PostedGrades object
            const sectionJSON = {              
                name: name,
                email: email,  
                section: section,
                courseId: courseId,
                createdAt: new Date(),
            }
            if (email && name && section){
                 documents.push(sectionJSON);
            }



        });
        await updateCourseMembers(documents); // use section Data to update CourseMembers
        //res.json({ rowCount, dataFromRows });
        res.redirect(`/showRoster/${courseId}`);
      } catch (error) {
        console.error(error);
        //res.json({ error});
      }
    });

 //res.json({message:"grades uploaded"});
 //res.redirect(`/showRoster/${courseId}`);
});

/*
  showCourse is the main page for a course
  which can only be viewed by course members
  (students, TAs, and the owner)
  it shows the course information, the sets, 
  and the course skills that the user has mastered
*/

app.get("/showCourse/:courseId", authorize, hasCourseAccess,
  // redirect to student view or staff view, depending on user role
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.user._id;
    const courseMember 
        = await CourseMember
               .findOne({studentId, courseId});

    if (res.locals.isAdmin || ["ta","instructor","owner"].includes(courseMember.role)) {
      res.redirect("/showCourseToStaff/" + courseId);
    } else if (["student","guest","audit"].includes(courseMember.role)) {
      res.redirect("/showCourseToStudent/" + courseId);
    } else {
      res.send("You do not have access to this course.");
    }

  } catch (e) {
    next(e);
  }
});


const compareCourseSkills = (a,b) => {
  // compares two courseSkills using the shortNames of the skills

  a = a.skillId;
  b = b.skillId;
  if (a.shortName[0] < b.shortName[0]) {
    return -1;
  }
  if (a.shortName[0] > b.shortName[0]) {
    return 1;
  }
  let aNum = parseInt(a.shortName.slice(1));
  let bNum = parseInt(b.shortName.slice(1));
  return aNum - bNum;
}

app.get("/showCourseToStaff/:courseId", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const courseId = req.params.courseId;
    const course = await Course.findOne({_id: courseId});

    res.locals.courseInfo = course;
    res.locals.courseId = courseId;

    const memberList = await CourseMember.find({studentId: req.user._id, courseId: res.locals.courseInfo._id});
    res.locals.isEnrolled = memberList.length > 0;

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});
    // next we create maps to find the number of problems and user's answers
    // in each problem set so the user will know if they have finished a problemset
    let problems = await Problem.find({courseId: res.locals.courseInfo._id});
    
    let courseSkills = await CourseSkill.find({courseId}).populate('skillId');
    courseSkills.sort((x,y) => compareCourseSkills(x,y)); 
    res.locals.allSkills = courseSkills.map((x) => x.skillId);
    //res.locals.allSkills = await Skill.find({courseId: id});
    res.locals.skills = res.locals.courseSkills;
    res.locals.skillIds = res.locals.allSkills; 
    // skillIds is a list of the ids of the skills the student has mastered

    res.locals.regradeRequests = await RegradeRequest.find({courseId, completed: false});


    let startDate = res.locals.courseInfo.createdAt
    let stopDate = new Date(startDate.getTime() + 1000*3600*24*120);
    if (res.locals.courseInfo.startDate) {
      startDate = res.locals.courseInfo.startDate;
    }
    if (res.locals.courseInfo.stopDate) {
      stopDate = res.locals.courseInfo.stopDate;
    }
    res.locals.startDate = startDate;
    res.locals.stopDate = stopDate;  
    
    if (res.locals.hasCourseAccess) {
      if (course.courseType == 'pra'){
        res.render("showCourseToStaff_PRA");
      } else {
        res.render("showCourseToStaff");
      }
    } else {
      res.send("You do not have access to this course.");
    }
  } catch (e) {
    next(e);
  }
});

app.get("/editCourse/:courseId", authorize, isOwner,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const course = await Course.find({_id: courseId});
      res.render("editCourse", {course});
    } catch (e) {
      next(e);
    }
  }
);

app.post("/editCourse/:courseId", authorize, isOwner,
  async (req, res) => {
    // better to use Course.findOneAndUpdate ...
    const name = req.body.newName;
    const startDate = req.body.startDate;
    const stopDate = req.body.stopDate;
    const guestAccess = req.body.guestAccess;
    const courseType = req.body.courseType;
    const course = await Course.findOne({_id:req.params.courseId});
    course.name = name;
    course.startDate = new Date(startDate);
    course.stopDate = new Date(stopDate);
    course.courseType = courseType;
    course.guestAccess = guestAccess;
    await course.save();
    res.redirect("/showCourse/"+req.params.courseId);
});



app.get('/editSupportFiles/:courseId',authorize,isOwner,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const course = await Course.find({_id: courseId});
      let title = await SupportFile.findOne({courseId,name:'title'});
      let preamble = await SupportFile.findOne({courseId,name:'preamble'});


      const titleData = await fsPromises.readFile(
        path.join(__dirname, 'public', 'latex','title.tex'), 
        'utf8'
      );

      const preambleData = await fsPromises.readFile(
        path.join(__dirname, 'public', 'latex','preamble.tex'), 
        'utf8'
       );

      if (!title) {
        title = new SupportFile({name:'title',courseId,text:titleData});
        await title.save();
      }
      if (!preamble) {
          preamble = new SupportFile({name:'preamble',courseId,text:preambleData});
        await preamble.save();
      }



      res.render("editSupportFiles", 
          {course,courseId,preamble,title});
        //res.json({courseId,supportFiles,course,preamble,title});
    } catch (e) {
      next(e);
    }
  }
);

app.post("/editSupportFiles/:courseId", authorize, isOwner,
  async (req, res) => {
    // better to use Course.findOneAndUpdate ...
    const title = req.body.title;
    const preamble = req.body.preamble;
    const courseId = req.params.courseId;


    await SupportFile.findOneAndUpdate(
      {name:'title',   courseId},{$set:{text:title}},   {upsert:true});
    await SupportFile.findOneAndUpdate(
      {name:'preamble',courseId},{$set:{text:preamble}},{upsert:true});

    res.redirect("/showCourse/"+req.params.courseId);
});

    


/*
This middleware creates res.locals.skillCounts, which is a dictionary
indexed by skill name, whose values are the number of students who have
mastered that skill. It also creates res.locals.studentCount, which is
the number of students who have been graded for the course.
*/
const getClassGrades = async (req,res,next) => {
  const courseId = req.params.courseId;
  const grades = await PostedGrades.find({courseId:courseId});

  /*
    create a dictionary which gives the number of students
    who have mastered each skill, indexed by skill name
  */
  const skillCounts = {};
  const skillMastery = {};  // list of students who have mastered each skill
  let studentCount = 0;
  let studentEmails = [];
  for (let grade of grades) {
    //if (!enrolledStudents.includes(grade.email)) {
    //  continue;}
    // count all students who have been graded for this course
    if (!studentEmails.includes(grade.email)) {
        studentEmails.push(grade.email);
        studentCount += 1;
      }

    for (let skill of grade.skillsMastered) {
      
      if (skillCounts[skill]) {
        if (!skillMastery[skill].includes(grade.email)) {
          skillMastery[skill].push(grade.email);
          skillCounts[skill] += 1;
        }
        
      } else {
        skillMastery[skill] = [grade.email];
        skillCounts[skill] = 1;
      }
    }
  }
  res.locals.skillCounts = skillCounts;
  res.locals.studentCount = studentCount;


  next()
}


app.get("/showCourseToStudent/:courseId", 
  authorize, hasCourseAccess,
  getClassGrades,
  async (req, res, next) => {
  try {
    let theUser = req.user;
    let userQuery = req.query.studentEmail;
    if (userQuery && res.locals.isStaff) {
      theUser = await User({googleemail:userQuery});
    }
    const courseId = req.params.courseId;
    const course =  await Course.findOne({_id: courseId});
    res.locals.courseInfo = course;
    const memberList = await CourseMember.find({studentId: theUser._id, courseId});
    res.locals.isEnrolled = memberList.length > 0;
    const problemSets = await ProblemSet.find({courseId});

    res.locals.problemSets = problemSets;
    // next we create maps to find the number of problems and user's answers
    // in each problem set so the user will know if they have finished a problemset
    
    let grade = await PostedGrades.findOne({email:theUser.googleemail,courseId});
    if (!grade) {
      grade={};
    }

    let grades 
        = await PostedGrades
                .find({courseId,email:theUser.googleemail})
                .populate('examId')
                .sort({'examId.name': 1});
    //res.json(grades);

    if (theUser.googleemail == grade.email) {
      // if the user has been graded in the course
      res.locals.course = course;
      //res.locals.exam = exam;
      //res.locals.grade = grade;
      res.locals.name = grade.name;
      res.locals.email = grade.email;
      res.locals.grades = grades;
      let skillsMastered = [];
      let allSkills = [];
      let numFskills = 0;
      let numGskills = 0;
      for (let grade of grades) {
        skillsMastered = skillsMastered.concat(grade.skillsMastered);
        allSkills = allSkills.concat(grade.skillsMastered).concat(grade.skillsSkipped);       
      }
      allSkills = [...new Set(allSkills)]; //.sort(compareExams);
      res.locals.allSkills = allSkills;

      res.locals.skillsMastered = 
        [...new Set(skillsMastered)];//.sort(compareExams);
      res.locals.numFskills = res.locals.skillsMastered.filter(skill => skill[0] == "F").length;
      res.locals.numGskills = res.locals.skillsMastered.filter(skill => skill[0] == "G").length;
    
      res.locals.course = course;
      res.locals.name=theUser.googlename;
      res.locals.email=theUser.googleemail;

      
    } else {
      res.locals.course = course;
      res.locals.name=theUser.googlename;
      res.locals.email=theUser.googleemail;
      res.locals.grade = grade;
      res.locals.skillsMastered = [];
      res.locals.numFskills = 0;
      res.locals.numGskills = 0;
      res.locals.allSkills = [];
      res.locals.grades = [];

    }
    if (course.courseType == "mla0") {
      res.render("showCourseToStudentMLA0");  
    } else if (course.courseType=='mla1') {
      res.render("showCourseToStudentMLA1");  
    } else if (course.courseType == "pra") {
      res.render("showCourseToStudent_PRA");
    } else {
      res.send(`course type not recognized ${course.courseType}`);
    }
  } catch (e) {
    next(e);
  }
});

const flatten = (vals) => {
  let flist = [];
  for (x of vals) {
    flist = flist.concat(x);
  }
  return flist;
};


/* 
  this route is used to proess a request to join a course 
  by entering the course pin. 
*/

app.post("/joinCourse", isLoggedIn, 
  (req,res,next) => {res.send("joining by PIN is not allowed")}, //comment out this line to enable course joining
  async (req, res, next) => {
  try {
    const userId = req.user._id;
    const coursePin = req.body.coursePin;

    // look up the course with the given course pin
    const course = await Course.findOne({coursePin: coursePin}, "name coursePin ownerId");

    // check if the user is already enrolled in the course
    const memberList = await CourseMember.find({studentId: userId, courseId: course._id});
    const isEnrolled = memberList.length > 0;
    
    if (!isEnrolled) {
      // only enroll the student if they are not already enrolled!
      const registration = {
        studentId: userId,
        courseId: course._id,
        createdAt: new Date(),
        role: "student",
      };
      const newCourseMember = new CourseMember(registration);
      await newCourseMember.save();
    } 
    res.redirect("/showCourse/" + course._id);
  } catch (e) {
    next(e);
  }
});

/* 
*********************************************************************
Skill routes
********************************************************************* 
*/

app.get("/showSkills/:courseId", 
  authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const skills 
       = await Skill.find(
            {courseId: courseId,
              original:{$exists:false},
            });
    let courseSkills = await CourseSkill.find({courseId: courseId}).populate('skillId');
    courseSkills.sort((x,y) => compareCourseSkills(x,y));
    res.locals = {
      ...res.locals,
      courseId,skills,courseSkills
    };
    res.render("showSkills");
  } catch (e) {
    next(e);
  }
});

app.get("/addSkill/:courseId", authorize, isOwner, 
  (req, res) => {
    res.locals.courseId = req.params.courseId;
    res.render("addSkill");
});

/* when a user adds a skill to the course
   it is added to the skills collection and to the courseSkills collection
   skills can be shared by multiple courses, 
   but courseSkills are unique to a course
*/
app.post("/addSkill/:courseId",  authorize, isOwner, 
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;

      const newSkill = new Skill({
        name: req.body.name,
        description: req.body.description,
        shortName:req.body.shortName,
        level: req.body.level,
        createdAt: new Date(),
        courseId: courseId,
      });
      await newSkill.save();

      
      const courseSkill = new CourseSkill({
        courseId: courseId,
        skillId: newSkill._id,
        createdAt: new Date(),
      });
      await courseSkill.save();

      
      res.redirect("/showCourse/" + req.params.courseId);
    } catch (e) {
      next(e);
    }
});

// this removes a skill from the CourseSkill collection
// but does not remove the skill from the Skill collection
// as other course owners might be using the skill in other courses
app.get("/removeSkill/:courseId/:skillId", authorize, isOwner, 
  async (req, res, next) => {
    await CourseSkill.findOneAndDelete({courseId: req.params.courseId, skillId: req.params.skillId});
    res.redirect("/showSkills/"+req.params.courseId);
});

/*
  this route is used to show the details of a skill
  the user must be the owner of the course it was defined in
  to be able to edit the skill.
  TJH - we ought to allow users to edit their own skills...
*/
app.get("/showSkill/:courseId/:skillId", authorize, hasCourseAccess,
  async (req, res, next) => {

  try {
    const skillId = req.params.skillId;
    res.locals.skillId = skillId;
    const skill = await Skill.findOne({_id: skillId});
    res.locals.skill = skill;
    const courseId = res.locals.skill.courseId;
    res.locals.courseInfo = await Course.findOne({_id: courseId}, "name ownerId");
    res.locals.isOwner = res.locals.courseInfo.ownerId == req.user.id;

    res.render("showSkill");
  } catch (e) {
    console.error("Error in showSkill: " + e);
    next(e);
  }
});

app.get("/editSkill/:courseId/:skillId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.skillId;
    res.locals.courseId = req.params.courseId;
    res.locals.skillId = id;
    res.locals.skill = await Skill.findOne({_id: id});
    res.render("editSkill");
  } catch (e) {
    next(e);
  }
});


app.post("/editSkill/:courseId/:skillId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const skill = await Skill.findOne({_id: req.params.skillId});
    const courseId = req.params.courseId;
    skill.name = req.body.name;
    skill.shortName = req.body.shortName;
    skill.level = req.body.level;
    skill.description = req.body.description;
    skill.createdAt = new Date();

    await skill.save();

    res.redirect("/showSkill/" + req.params.courseId+"/"+ req.params.skillId);
  } catch (e) {
    next(e);
  }
}); 

app.get("/importSkills/:courseId", authorize, isOwner,
  async (req, res, next) => {
    res.locals.courseId = req.params.courseId;

    // for now we will let the user see all of the courses..
    // this is not scalable though!!
    res.locals.courses = await Course.find({}).sort({name: 1});


    res.render("importSkills");
});

app.get("/showSkillsToImport/:courseId/:otherCourseId", authorize, isOwner,
  async (req, res, next) => {
    const courseId = req.params.courseId;
    const otherCourseId = req.params.otherCourseId;
    const otherCourse = await Course.findOne({_id: otherCourseId});

    let skills = await Skill.find({courseId: otherCourseId});
    skills.sort((a,b) => compareSkills(a,b));

    res.locals = 
    {...res.locals, 
      courseId,
      otherCourseId,
      otherCourse,
      skills,

    };
    res.render('showSkillsToImport');
});

app.get('/importAllSkills/:courseId/:otherCourseId', authorize, isOwner,
  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const otherCourseId = req.params.otherCourseId;
      const skills = await Skill.find({courseId: otherCourseId});
      for (let skill of skills) {

        // create newSkill which is a copy of the skill
        // we will add the newSkill to our courseSkills collection
        // but when we search the library for problems
        // we will first find ids of all derived skills
        // and then search for problem with skills in that set of Ids.
        const newSkill = skill;
        newSkill.isNew = true;
        newSkill.courseId = courseId;
        newSkill.original = skill.original?skill.original._id:skill._id;  
        newSkill.createdAt = new Date();
        newSkill._id = undefined;
        await newSkill.save();

        let courseSkills = 
           await CourseSkill.find(
               {courseId: req.params.courseId, 
                skillId: newSkill._id});
        if (courseSkills.length == 0) {
          let courseSkill = new CourseSkill({
            courseId: req.params.courseId,
            skillId: newSkill._id,
            createdAt: new Date(),
          });
          await courseSkill.save();
        }

      }
      res.redirect("/showSkills/" + req.params.courseId);
    } catch (e) {
      next(e);
    }
});



/* 
*********************************************************************
ProblemSet routes
********************************************************************* 
*/


app.get("/addProblemSet/:courseId", authorize, isOwner, 
  async (req, res, next) => {
  const courseId = req.params.courseId;
  const makeupId = req.query.makeupId;
  let makeup = null;
  if (makeupId){
    makeup = await ProblemSet.findOne({_id: makeupId});
  }


  const courseInfo = await Course.findOne({_id: courseId}, "name ownerId");
  res.locals = 
    {...res.locals, 
       makeup, 
       name: courseInfo.name, 
       ownerId: courseInfo.ownerId, 
       courseId: courseInfo._id};

  res.render("addProblemSet");
});

app.post("/saveProblemSet/:courseId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    let newProblemSet = new ProblemSet({
      name: req.body.name,
      courseId: id,
      createdAt: new Date(),
      visible: true,
      pendingReviews: [],
      makeupOf: req.body.makeupOf,
    });


    await newProblemSet.save();

    let parentProblemSet = await ProblemSet.findOne({_id: req.body.makeupOf});
    if (parentProblemSet) {
      parentProblemSet.makeup = newProblemSet._id;
      await parentProblemSet.save();
    }

    res.locals.courseInfo = await Course.findOne({_id: id}, "name coursePin ownerId");

    res.locals.problemSets = await ProblemSet.find({courseId: res.locals.courseInfo._id});

    res.redirect(`/showProblemSetToStaff/${res.locals.courseInfo._id}/${newProblemSet._id}`);
  } catch (e) {
    next(e);
  }
});

app.get("/editProblemSet/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  res.render("editProblemSet");
});

app.post("/updateProblemSet/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const id = req.params.psetId;
    const pset = await ProblemSet.findOne({_id: id});
    pset.name = req.body.name;
    pset.visible = req.body.visible == "visible";
    await pset.save();

    res.redirect("/showProblemSet/"+ pset.courseId+"/"+ id);
  } catch (e) {
    next(e);
  }
});

app.post("/uploadProblems/:courseId/:psetId",
  authorize, isOwner,
  memoryUpload.fields(
    [{name:"problems",maxCount:100},
     {name:"skill",maxCount:1},
    ]),
  async (req, res, next) => {
  try {
    const psetId = req.params.psetId;
    const courseId = req.params.courseId;

    const skillId = req.body.skill;
    // get the text of the probems uploaded from the server
    const problemStrings = req.files.problems.map(x=>x.buffer.toString());
    // create a list of Problem objects from the text of the problems
    // with the specified skill
    // and the name is the file name.
    let problemList = [];
    for (problem of req.files.problems) {
      let p = new Problem({
        courseId: courseId,
        psetId: psetId,
        description: problem.originalname,
        problemText: problem.buffer.toString(),
        mimeType: req.body.mimeType,
        answerMimeType: req.body.answerMimeType,
        rubric:"no rubric",
        pendingReviews:[],
        createdAt: new Date(),
        skills: [skillId],
        allowAnswers: false,
        submitable: false,
        answerable: false,
        peerReviewable: false,
        parentProblemId:null,
        variant:false,
      });
      problemList.push(p);
    }

    await Problem.insertMany(problemList);

    res.redirect("/showProblemSet/"+courseId+"/"+psetId);
  } catch (e) {
    next(e);
  }
});

const getStudentSkills = async (courseId,studentId) => {
  try {
    const skills = await Answer.find({courseId:courseId,studentId: studentId}).distinct("skills");
    return skills.map((c) => c.toString());
  } catch (e) {
    console.error("error in skills",error.message);
    throw e;
  }
};


app.get("/uploadProblems/:courseId/:psetId", authorize, hasCourseAccess,
  async (req, res, next) => {

  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  const userId = req.user._id;

  res.locals.psetId = psetId;
  res.locals.courseId = courseId;
  
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems = await Problem.find({psetId: psetId}).sort({description:1});
  res.locals.skills = await Skill.find({courseId: courseId});

  res.render("uploadProblems");
  }
);

app.get("/showProblemSet/:courseId/:psetId", authorize, hasCourseAccess,
  async (req, res, next) => {
    try {
      const studentId = req.user._id;
      const courseId = req.params.courseId;
      const member = await CourseMember.findOne({studentId, courseId});
      const role = member?member.role:"none";
      if (['student','audit','guest'].includes(role)) {
        res.redirect("/showProblemSetToStudent/"+req.params.courseId+"/"+req.params.psetId);
      } else if (['ta','instructor','owner'].includes(role) || isAdmin) {
        res.redirect("/showProblemSetToStaff/"+req.params.courseId+"/"+req.params.psetId);
      } else {
        res.send("You do not have access to this course.");
      }
    } catch (e) {
      next(e);
    }
  }
);


app.get("/showProblemSetToStaff/:courseId/:psetId", authorize, hasStaffAccess,
  async (req, res, next) => {
    try {
      const psetId = req.params.psetId;
      const courseId = req.params.courseId;
      const course = await Course.findOne({_id: courseId});

      if (course.courseType == "pra") {
        res.redirect("/showProblemSetToStaff_PRA/"+courseId+"/"+psetId);
      } else{
        res.redirect("/showProblemSetToStaff_MLA/"+courseId+"/"+psetId);
      }
    } catch(e) {
      next(e);
    } 
  }
)

app.get("/showProblemSetToStaff_PRA/:courseId/:psetId", authorize, hasStaffAccess,
  async (req, res, next) => {

  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  const userId = req.user._id;

  res.locals.psetId = psetId;
  res.locals.courseId = courseId;
  
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems 
      = await Problem.find({psetId: psetId})
                      .populate('skills')
                      .sort({'skills.shortName':1});

  res.locals.courseInfo = await Course.findOne({_id: courseId}, "ownerId");
 
  //const allPsets = await ProblemSet.find({courseId: courseId});
  //res.locals.makeupSets = allPsets.filter((x) => x._id!=psetId).concat({name: "None", _id: null});  
  
  
  res.locals.skills = await Skill.find({courseId: courseId});

  res.render("showProblemSetToStaff_PRA");
});



app.get("/showProblemSetToStaff_MLA/:courseId/:psetId", authorize, hasStaffAccess,
  async (req, res, next) => {

  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  const userId = req.user._id;

  res.locals.psetId = psetId;
  res.locals.courseId = courseId;

  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems 
      = await Problem.find({psetId: psetId})
                      .populate('skills');
  res.locals.problems.sort((a,b) => compareSkills(a.skills[0],b.skills[0]));


  res.locals.courseInfo = await Course.findOne({_id: courseId}, "ownerId");
 
  //const allPsets = await ProblemSet.find({courseId: courseId});
  //res.locals.makeupSets = allPsets.filter((x) => x._id!=psetId).concat({name: "None", _id: null});  
  
  
  res.locals.skills = await Skill.find({courseId: courseId});

  res.render("showProblemSetToStaff_MLA");
});


app.get("/showProblemSetToStudent/:courseId/:psetId", authorize, hasCourseAccess,
  async (req, res, next) => {
    try {
      const psetId = req.params.psetId;
      const courseId = req.params.courseId;
      const course = await Course.findOne({_id: courseId});

      if (course.courseType == "pra") {
        res.redirect("/showProblemSetToStudent_PRA/"+courseId+"/"+psetId);
      } else{
        res.redirect("/showProblemSetToStudent_MLA/"+courseId+"/"+psetId);
      }
    } catch(e) {
      next(e);
    } 
  }
)


app.get("/showProblemSetToStudent_PRA/:courseId/:psetId", authorize, hasCourseAccess,
  async (req, res, next) => {

  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  const userId = req.user._id;

  res.locals.psetId = psetId;
  res.locals.courseId = courseId;
  
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems 
      = await Problem.find({psetId: psetId});

  res.locals.courseInfo = await Course.findOne({_id: courseId}, "ownerId");
  res.locals.myAnswers = await Answer.find({psetId: psetId, studentId: userId});
  res.locals.pids = res.locals.myAnswers.map((x) => {
    if (!x.problemId) {
      res.json(res.locals.myAnswers);
      return;
    }
    x.problemId.toString(); 
  });

  const course = await Course.findOne({_id: courseId});

  res.locals.problemsAnswered = res.locals.myAnswers.map((x) => x.problemId.toString());

  
  res.render("showProblemSetToStudent_PRA");
});



app.get("/showProblemSetToStudent_MLA/:courseId/:psetId", authorize, hasCourseAccess,
  async (req, res, next) => {

  const psetId = req.params.psetId;
  const courseId = req.params.courseId;
  const userId = req.user._id;
  const skillsMastered = await getStudentSkills(courseId,userId);

  res.locals.psetId = psetId;
  res.locals.courseId = courseId;

  
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  res.locals.problems 
      = await Problem.find({psetId: psetId})
                      .populate('skills')
                     .sort({'skills.shortName':1});

  res.locals.courseInfo = await Course.findOne({_id: courseId}, "ownerId");
  res.locals.myAnswers = await Answer.find({psetId: psetId, studentId: userId});
  res.locals.pids = res.locals.myAnswers.map((x) => {
    if (!x.problemId) {
      res.json(res.locals.myAnswers);
      return;
    }
    x.problemId.toString(); 
  });

  const course = await Course.findOne({_id: courseId});

  res.locals.skillsMastered = await getStudentSkills(courseId,req.user._id);
  res.locals.problemsAnswered = res.locals.myAnswers.map((x) => x.problemId.toString());

  res.locals.skills = await Skill.find({courseId: courseId});
  
  res.render("showProblemSetToStudent_MLA");
});



app.post("/setAsMakeup/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const psetId = req.params.psetId;
    const courseId = req.params.courseId;
    const problemSet = await ProblemSet.findOne({_id:psetId});
    let makeupSet = req.body.makeupSet;
    if (makeupSet == "") {
      makeupSet = null;
    }
    problemSet.makeupOf = makeupSet;
    await problemSet.save();
    res.redirect("/showProblemSet/"+courseId+"/"+psetId);
  } catch (e) {
    next(e);
  }
});




const trimSkillString = (skill) => {
  /* The name of the	skill is of the	form:
 "2: F1 (1.0 pts)": "0.0",
 so we can extrat the string from the first ":" to the first "("
 and then trim it to get	the skill name.
*/
  let firstColon = skill.indexOf(":");
  let firstParen = skill.indexOf("(");
  if (firstParen == -1) firstParen=skill.length;

  const skillName = skill.substring(firstColon+1,firstParen).trim();
  if (skillName == ''){
    console.error(`empty skill name for skill:${skill}`);
  }
  return skillName;
}

const processSkills = (grades) => {
  // this has been customized to work with the way grades are downloaded
  // from Becci and Keith's math classes on GradeScope
    const skillsMastered = [];
    const skillsSkipped = [];
    for (let key in grades) {
        if (
                 ((grades[key] === "1.0") || (grades[key] === "1")) 
              && (!key.includes("points"))
              && (!key.includes("Honor Pledge"))
              && (!key.includes("Total Score"))
              && (!key.includes("Max Points"))
              && (!key.includes("Count"))
            ) {
            skillsMastered.push(trimSkillString(key));
        } else if (
                  ((grades[key] === "0.0") || (grades[key] === "0"))
                  && trimSkillString(key) != "" 
                  && (!key.includes("Honor Pledge")) 
                  && (!key.includes("Total Score"))) {
            skillsSkipped.push(trimSkillString(key));
        }
    }
    return {skillsMastered,skillsSkipped};
}

app.post("/updatePsetStatus/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
    try {

      const psetId = req.params.psetId;
      // update the status of the problem set, this will return the old pset    
      await ProblemSet.findOneAndUpdate({_id:psetId},{status:req.body.status});
      // lookup the new pset
      const problemSet = await ProblemSet.findOne({_id:psetId});
      const course = await Course.findOne({_id: req.params.courseId});

      // update the status of all problems in the problem set
      if (problemSet.status == "in-prep") {
        // set the status of all problems in the problem set to "in-prep"
        // visible=false, submitable=false, answerable=false, peerReviewable=false
        await Problem.updateMany({psetId: psetId}, 
          {visible: false, submitable: false, answerable: false, peerReviewable: false});
      } else if (problemSet.status == "released") {
        // set the status of all problems in the problem set to "released"
        // visible=true, submitable=true, answerable=true, peerReviewable=false
        const isPRA = (course.courseType == 'pra');
        await Problem.updateMany({psetId: psetId}, 
          {visible: true, submitable: isPRA, answerable: true, peerReviewable: isPRA});
      } else if (problemSet.status == "grading") {
        // set the status of all problems in the problem set to "grading"
        // visible=true, submitable=false, answerable=false, peerReviewable=false
        await Problem.updateMany({psetId: psetId}, 
          {visible: true, submitable: false, answerable: false, peerReviewable: false});
      } else if (problemSet.status == "graded") {
        // set the status of all problems in the problem set to "graded"
        // visible=true, submitable=false, answerable=false, peerReviewable=false
        await Problem.updateMany({psetId: psetId}, 
          {visible: true, submitable: false, answerable: false, peerReviewable:false});
      }
      
      res.redirect("/showProblemSet/"+req.params.courseId+"/"+psetId);
    }
    catch (e) {
      next(e);
    }
  }
)    


app.get("/updatePsetStatus/:courseId/:psetId/:status", authorize, isOwner,
  async (req, res, next) => {
    try {
      const psetId = req.params.psetId;
      // update the status of the problem set, this will return the old pset    
      await ProblemSet.findOneAndUpdate({_id:psetId},{status:req.params.status});
      // lookup the new pset
      const problemSet = await ProblemSet.findOne({_id:psetId});
      const course = await Course.findOne({_id: req.params.courseId});

      // update the status of all problems in the problem set
      if (problemSet.status == "in-prep") {
        // set the status of all problems in the problem set to "in-prep"
        // visible=false, submitable=false, answerable=false, peerReviewable=false
        await Problem.updateMany({psetId: psetId}, 
          {visible: false, submitable: false, answerable: false, peerReviewable: false});
      } else if (problemSet.status == "released") {
        // set the status of all problems in the problem set to "released"
        // visible=true, submitable=true, answerable=true, peerReviewable=false
        const isPRA = course.courseType == 'pra';
        await Problem.updateMany({psetId: psetId}, 
          {visible: true, submitable: isPRA, answerable: true, peerReviewable: isPRA});
      } else if (problemSet.status == "grading") {
        // set the status of all problems in the problem set to "grading"
        // visible=true, submitable=false, answerable=false, peerReviewable=false
        await Problem.updateMany({psetId: psetId}, 
          {visible: true, submitable: false, answerable: false, peerReviewable: false});
      } else if (problemSet.status == "graded") {
        // set the status of all problems in the problem set to "graded"
        // visible=true, submitable=false, answerable=false, peerReviewable=false
        await Problem.updateMany({psetId: psetId}, 
          {visible: true, submitable: false, answerable: false, peerReviewable:false});
      }
      
      res.redirect("/showProblemSet/"+req.params.courseId+"/"+psetId);
    }
    catch (e) {
      next(e);
    }
  }
)  
/* a typical gradescope row has the form:
Name,SID,Email,Total Score,Max Points,Status,Submission ID,Submission Time,Lateness (H:M:S),View Count,Submission Count,1: Honor Pledge (0.0 pts),2: F1 (1.0\
 pts),3: F2 (1.0 pts),4: F3 (1.0 pts),5: F4 (1.0 pts)
 and we want to transform it to
 name,email,F1,F2,F3,F4
and remove the other columns
*/
const transform_from_gradescope = (row) => {
  let newRow = {};

  for (let key in row) {
    switch (key) {
      case 'Name': newRow['name'] = row['Name']; break;
      case 'Email': newRow['email'] = row['Email']; break;
      default:
        if ("123456789".includes(key[0])) {
          let p1 = key.indexOf(":");
          let p2 = key.indexOf("(");
          let newKey = key.substring(p1+1,p2).trim();
          newRow[newKey] = row[key];
        }  
      }
  }

  return newRow;
}


app.post("/uploadGrades/:courseId", authorize, hasStaffAccess,
  memoryUpload.single('grades'),
 async (req, res, next) => {
  try{


    const courseId = req.params.courseId;
    const csvMode = req.body.csvMode;

    const course = await Course.findOne({_id:courseId})
    res.locals.course = course;


    const psetId = req.body.psetId;
    const problemSet = await ProblemSet.findOne({_id:psetId});
    res.locals.problemSet = problemSet;



    /*
    read the uploaded csv file and update the grades
    */

    const { buffer, originalname } = req.file;

  const dataFromRows = [];

  streamifier
    .createReadStream(buffer)
    .pipe(csv()) //.parse({ headers: true, ignoreEmpty: true })) // <== this is @fast-csv/parse!!
    .on("data", (row) => {
      dataFromRows .push(row);
    })
    .on("end", async (rowCount) => {
      try {
        let documents = []

        dataFromRows.forEach(async (row) => {

            //if (!row.name || !row.Name) return; // skip empty rows
            if (csvMode=='gradescope') {
              row = transform_from_gradescope(row);
            }

            const email = row.email;
            const name = row.name;


            const {skillsMastered,skillsSkipped} = processSkills(row);

            // create new PostedGrades object
            const gradeJSON = {              
                name: name,
                email: email,   
                courseId: courseId,
                examId: psetId,
                skillsMastered: skillsMastered,
                skillsSkipped: skillsSkipped,
                createdAt: new Date(),
                grades: row
            }
            documents.push(gradeJSON);
 

        });
        await PostedGrades.deleteMany({courseId:courseId,examId:psetId});
        await PostedGrades.insertMany(documents); 
        //res.json({ rowCount, dataFromRows });
        problemSet.status = "graded";
        await problemSet.save();
      } catch (error) {
        console.error(error);
        //res.json({ error});
      }
    });

 //res.json({message:"grades uploaded"});
 res.redirect(`/showMastery/${courseId}`);
  } catch (e) {
    next(e);
  }
});

app.get("/gradeProblemSet/:courseId/:psetId", authorize, hasStaffAccess,
  async (req, res, next) => {
  const psetId = req.params.psetId;
  const json = req.query.json;
  res.locals.psetId = psetId;
  res.locals.courseId = req.params.courseId;
  res.locals.problemSet = await ProblemSet.findOne({_id: psetId});
  const problems = await Problem.find({psetId: psetId});

  res.locals.problems = problems;
  res.locals.answers = await Answer.find({psetId: psetId});
  res.locals.courseInfo = await Course.findOne({_id: res.locals.problemSet.courseId}, "ownerId");
  const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id,role:'student'});
  res.locals.students = memberList.map((x) => x.studentId);
  res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}}, {}, {sort: {googleemail: 1}});

  const taList = await CourseMember.find({courseId: res.locals.courseInfo._id, role:{$in:["ta","owner"]}}).populate('studentId');
  const taIds = taList.map((x) => x.studentId._id+"");
  const taReviews = await Review.find({psetId: psetId, reviewerId: {$in: taIds}});

  res.locals.taReviews = taReviews;
  let userIsOwner = req.user._id.equals(res.locals.courseInfo.ownerId);
  if (userIsOwner || taIds.includes(req.user.id+"")){//taIds.filter((x) => x.equals(req.user._id)).length > 0) {
    res.render("gradeProblemSet");
  } else {
    res.send("You are not allowed to grade problem sets.");
  }
});


const preamble =
`

\\thispagestyle{empty}
 \\setcounter{page}{1}\\noindent Name: All Problems \\hfill Section: 0 \\hfill  Math 10a: Friday Assessment \\#1 -- Sep 3

\\input{title.tex}

`;

const personalizedPreamble = (studentName,courseName,examName) =>
`\\newpage
 \\thispagestyle{empty}
 \\setcounter{page}{1}\\noindent ${studentName}: \\hfill  ${courseName}  ${examName}
\\input{title.tex}
`
const generateTex = (problems) => {
  let tex = "\\begin{enumerate}\n";
  for (let p of problems) {
    tex += "\\item\n"
    tex += "\\begin{verbatim}\n"+p.skills[0]['shortName']+"\n\\end{verbatim}\n";

    if (p.mimeType=='plain'){
      tex += '\\begin{verbatim}\n'
    } else if (p.mimeType=='markdown'){
      tex += '\\begin{markdown}\n'
    }
    
    
    

    tex += p.problemText + "\n";
    if (p.mimeType=='plain'){
      tex += '\\end{verbatim}\n'
    } else if (p.mimeType=='markdown'){
      tex += '\\end{markdown}\n'
    }

    tex += `
 \\vfill
{\\small Outcome ${p.skills[0]['shortName']}:${p.skills[0]['name']}}

 
\\hfill Show all your work!

\\pagebreak
`;
     }
  tex += "\\end{enumerate}\n";
  return tex;
};

  /*
    getSkillsMasteredByStudent returns a list of shortnames of the skills mastered by the student
  */
  const getSkillsMasteredByStudent = async (studentEmail,courseId) => {
    const grades = await PostedGrades.find({courseId:courseId,email:studentEmail});
    if (grades.length == 0) return [];
    let skillsMastered = [];
    for (let grade of grades) {
      skillsMastered = skillsMastered.concat(grade.skillsMastered);
    }
    return skillsMastered;
  }





  /*
    This asynchronous function returns a dictionary: masteredSkills
    which maps each studentEmail to a list of skillIds that the student has mastered
  */
  const getSkillsMastered = async (courseId) => {
    const grades = await PostedGrades.find({courseId:courseId});
    const sections 
      = await CourseMember.find({courseId,role:'student'}).populate('studentId');
    const enrolledStudents 
        = sections.map(section => section.studentId.googleemail);
    /*
      create a dictionary, skillMastery, which gives the set of students
      who have mastered each skill, indexed by skill name
    */
    const skillCounts = {};
    const skillMastery = {};  // list of students who have mastered each skill
    let studentCount = 0;
    let studentEmails = [];
    for (let grade of grades) {
      if (!enrolledStudents.includes(grade.email)) {
        continue;
      }
      // count all students who have been graded for this course
      if (!studentEmails.includes(grade.email)) {
          studentEmails.push(grade.email);
          studentCount += 1;
        }
  
      for (let skill of grade.skillsMastered) {
        
        if (skillCounts[skill]) {
          if (!skillMastery[skill].includes(grade.email)) {
            skillMastery[skill].push(grade.email);
            skillCounts[skill] += 1;
          }
          
        } else {
          skillMastery[skill] = [grade.email];
          skillCounts[skill] = 1;
        }
      }
    } // end of for (let grade of grades) ....

    /*
    create a dictionary skillsMastered, indexed by student emails,
    containing a list of the skills that student has mastered.
    We create this from the skillMastery dictinonary: skills->[students]
    to get the "transpose"  students -> [skills]
    */
    const skillsMastered = {};
    for (let skill in skillMastery) {
      for (let student of skillMastery[skill]) {
        if (skillsMastered[student]) {
          skillsMastered[student].push(skill);
        } else {
          skillsMastered[student] = [skill];
        }
      }
    }



    /*
    these skills are just the names of the skills F1, F2, ..., G1, G2, ...
    We need to return instead a list of skillIds. First though we
    create a dictionary from skill names to skillIds
    */
    
    return {skillsMastered,skillCounts,enrolledStudents};

  
  
 
  }



    app.get("/downloadPersonalizedExamsAsZipFile/:courseId/:psetId", authorize, hasStaffAccess,
      /* this route will generate a large latex file with a personalized exam
         for the specified problemset in the specified course with one exam for
         each student in the course. Also each exam has questions only for those skills
         that that particular students has not yet mastered at this point in the course.
    
         The list of mastered skills is obtained from the MGA database!
  
         Currently the latex file requires a few additional tex files:
         preamble.tex  - a latex file importing all necessary packages 
         title.tex - a file containing the first explanation page(s) for the exam,
            for example, the honesty pledge, the instructions, the grading policy, etc. 
            This needs to be customized for each class. 
         
         If this problem set is a makeup, then we only include students who have not
         taken the specified exam for which this is a makeup. 
    
      */
      async (req, res, next) => {
        const courseId = req.params.courseId;
        const course = await Course.findOne({_id: courseId});
          /*
          First we calculate the set of skills that each student has mastered
          and some other things we don't need yet!
          */
          const {skillsMastered,skillCounts,enrolledStudents} 
             = await getSkillsMastered(courseId);

          /*
          We want to use the student's full name,
          with underscores replacing spaces,
          for the filename of the personalized exam.
          So we need to create a dictionary whose keys are emails
          and whose values are the User objects for the students
          */
          const students = await User.find({googleemail: {$in: enrolledStudents}});
          const studentEmailToName = {};
          const studentEmailToFileName = {};
          for (let student of students) {
            studentEmailToFileName[student.googleemail] = student.googlename.replace(/ /g,'_');
            studentEmailToName[student.googleemail] = student.googlename;

          }

  
          /*
          Now we create a dictionary skillIdsMastered: studentEmail -> [skillId]
          which maps each student to a list of skillIds that the student has mastered
          We will use this to create the personalized exams.
          */
          let allSkills = await Skill.find({courseId});
   
          let skillIdMap = {}
          for (let skillName in skillCounts) {
            let skill = await Skill.findOne({courseId,shortName: skillName});
            if (skill) skillIdMap[skillName] = skill._id+"";
          }
  
          let skillIdsMastered = {}
          for (let student in skillsMastered) {
            skillIdsMastered[student] 
              = skillsMastered[student].map((x) => skillIdMap[x]);
          }
  
          /*
          Next we get the problems for this problem set
          */
          const psetId = req.params.psetId;
          const pset = await ProblemSet.findOne({_id: psetId});
          const problems = await Problem.find({psetId: psetId}).populate('skills');
      
  
      
          /* Next, we create a dictionary problemDict indexed by skills which
             maps each skill to the list of problems containing that skill
             In practice each skill will correspond to exactly one problem,
             but we can make this code a little more general.
          */
         let problemDict = {};
         for (let p of problems){
          if (p.skills.length!=1){
            continue; // this shouldn't happen
          } else {
            problemDict[p.skills[0]['_id']] = p;
          }
         }
      
         /*
         This exam might be a makeup of another exam. If so, we need to
         find the students who have already taken the original exam
         and not include them in the makeup exam.
         So studentsWhoCanTakeExam is initially all enrolled students,
         but if this is a makeup exam, then it will be the students
         who skipped the original exam.
         */
  
         let studentsWhoCanTakeExam = enrolledStudents;
         let tookExamEmails=[];
         if (pset.makeupOf) { 
  
           const makeupOf = pset.makeupOf; // the id of the Exam that this exam is a makeup for
           let tookExamEmails0 
               = (await PostedGrades
                        .find({examId: makeupOf}));
           tookExamEmails
               = (await PostedGrades
                        .find({examId: makeupOf})
                        .sort({email:1})) 
                        .map((x) => x.email);
           studentsWhoCanTakeExam 
              = enrolledStudents.filter(x => !(tookExamEmails.includes(x)));
            
          }
        
  
          /*
          Now we process the list of students who can take the exam
          and generate a personalized exam for each student
          but we don't generate exams for students who have mastered
          all of the skills, we put them into a list studentsWithFullMastery
          */
         let studentsWithFullMastery = [];
         let result = [];


          for (let studentEmail of studentsWhoCanTakeExam){
            /* generate a personalized exam for student s with only
               the problems for skills that s has not yet mastered,
               as determined by the skillList.
            */
           
           let studentSkills = 
               skillIdsMastered[studentEmail];
           if (!studentSkills) {
             studentSkills = [];
           }
      
           let testProblems = [];
           for (let p of problems){
            if (studentSkills.includes(p.skills[0]['_id']+"")) {
              // skip the problem if they have mastered it
            } else {
              testProblems = testProblems.concat(p);
            }
          }
        
    
         const startTex = '\\input{preamble.tex}\n\\begin{document}\n';
         const endTex = '\\end{document}\n';
         const studentName = studentEmailToName[studentEmail];

         const exam =  
            personalizedPreamble(studentName+" : "+studentEmail,course.name,(new Date()).toISOString().slice(0,10))
            + generateTex(testProblems);
         
         if (testProblems.length>0) {
            //const filename = studentEmail.replace(/@/g,'_').replace(/\./g,'_')+'.tex';
            const filename = studentEmailToFileName[studentEmail]+'.tex';
            const filecontents = startTex + exam + endTex;
            const fileObject = {filename,filecontents};
            result = result.concat(fileObject);
            //result += exam;
         } else {
            studentsWithFullMastery.push(studentEmail);
         }
        
         
    
          }

          //res.json(result);

         
        // Set headers for zip file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=files.zip');
    

        // Create zip archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });
    
        // Pipe archive data to response
        archive.pipe(res);
    
        // Add each file to the archive
        result.forEach(file => {
            archive.append(file.filecontents, { name: "exam_"+file.filename });
        });

        archive.append(JSON.stringify(studentsWithFullMastery,null,5), { name: "studentsWithFullMastery.json" });  
        // get preamble and title files and add to archive
        const preamble = await SupportFile.findOne({courseId,name:'preamble'});
        const title = await SupportFile.findOne({courseId,name:'title'});
        archive.append( preamble.get('text',""), {name: "preamble.tex"});
        archive.append(title.get('text',""), { name: "title.tex" });

        // add compile shell script to archive
        archive.append(`mkdir originals;mkdir exams;mv *.tex *.txt *.json *.sh originals;cd originals;for file in exam_*.tex; do pdflatex "$file"; done;mv *.pdf ../exams;mv *.tex *.sh *.txt *.json ..; cd ..; rm -r originals`,
          { name: "compile.sh" }
        );
        archive.append(`Instuctions:
          This zip file contains a personalized exam for each student in the course.
          Each exam contains only the problems for the skills that the student has not yet mastered.
          The file studentsWithFullMastery.json contains a list of students who have already mastered all of the skills.
          
          Copy in the files title.tex and preamble.tex from the course directory to the directory where you are compiling the exams.  
          The minimal preamble.tex file should contain the following:
          
          \\documentclass[12pt]{article}

          and title.tex can be empty.
          
          Compile these into LaTeX using the following command:

          for file in exam_*.tex; do pdflatex "$file"; done

          If you have markdown in your code, you will need to use luatex
          to compile, and you'll need to use lualatex instead of pdflatex.
          and you'll need to add the luatexja pacakge to your preamble

          \\documentclass{article}
          \\usepackage{luatexja}

          `, { name: "readme.txt" });
         

        // Handle archive errors
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            res.status(500).end();
        });
    
        // Finalize the archive
        archive.finalize();

      });
  



      app.get("/downloadExamAsZipFile/:courseId/:psetId", authorize, hasStaffAccess,
        /* this route will generate a zipped folder containing
           a latex file with all exam questions
           and a latex file with the answers to all exam questions
           and a command.sh file to generate the pdfs for these two files        
    
           Currently the latex file requires a few additional tex files:
           preamble.tex  - a latex file importing all necessary packages 
           title.tex - a file containing the first explanation page(s) for the exam,
              for example, the honesty pledge, the instructions, the grading policy, etc. 
              This needs to be customized for each class. 
      
        */
        async (req, res, next) => {
          const courseId = req.params.courseId;
          const course = await Course.findOne({_id: courseId});
           
    
    
            /*
            Next we get the problems for this problem set
            */
            const psetId = req.params.psetId;
            const pset = await ProblemSet.findOne({_id: psetId});
            const problems = await Problem.find({psetId: psetId}).populate('skills');
        
    
        
    
          
      
           const startTex = '\\input{preamble.tex}\n\\begin{document}\n';
           const endTex = '\\end{document}\n';
           const showSolutions = '\\newif\\ifsolns\n\\solnstrue\n';
           const hideSolutions = '\\newif\\ifsolns\n\n';
  
           const exam =  
              personalizedPreamble("",course.name,(new Date()).toISOString().slice(0,10))
              + generateTex(problems);
            
           const result = [
              {filename: "exam.tex", filecontents: startTex + hideSolutions+exam + endTex},
              {filename: "answers.tex", filecontents: startTex + showSolutions+exam + endTex}
           ]

           
          // Set headers for zip file download
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', 'attachment; filename=fullExam.zip');
      
  
          // Create zip archive
          const archive = archiver('zip', {
              zlib: { level: 9 } // Maximum compression
          });
      
          // Pipe archive data to response
          archive.pipe(res);
      
          // Add each file to the archive
          result.forEach(file => {
              archive.append(file.filecontents, { name: "exam_"+file.filename });
          });
  
          // get preamble and title files and add to archive
          const preamble = await SupportFile.findOne({courseId,name:'preamble'});
          const title = await SupportFile.findOne({courseId,name:'title'});
          archive.append( preamble.get('text',""), {name: "preamble.tex"});
          archive.append(title.get('text',""), { name: "title.tex" });
  
          // add compile shell script to archive
          archive.append(`mkdir originals;mkdir exams;mv *.tex *.txt *.json *.sh originals;cd originals;for file in exam_*.tex; do pdflatex "$file"; done;mv *.pdf ../exams;mv *.tex *.sh *.txt *.json ..; cd ..; rm -r originals`,
            { name: "compile.sh" }
          );
          archive.append(`Instuctions:
            This zip file contains a personalized exam for each student in the course.
            Each exam contains only the problems for the skills that the student has not yet mastered.
            The file studentsWithFullMastery.json contains a list of students who have already mastered all of the skills.
            
            Copy in the files title.tex and preamble.tex from the course directory to the directory where you are compiling the exams.  
            The minimal preamble.tex file should contain the following:
            
            \\documentclass[12pt]{article}
  
            and title.tex can be empty.
            
            Compile these into LaTeX using the following command:
  
            for file in exam_*.tex; do pdflatex "$file"; done
  
            If you have markdown in your code, you will need to use luatex
            to compile, and you'll need to use lualatex instead of pdflatex.
            and you'll need to add the luatexja pacakge to your preamble
  
            \\documentclass{article}
            \\usepackage{luatexja}
  
            `, { name: "readme.txt" });
           
  
          // Handle archive errors
          archive.on('error', (err) => {
              console.error('Archive error:', err);
              res.status(500).end();
          });
      
          // Finalize the archive
          archive.finalize();
  
        });
    

app.get('/downloadAsTexFile/:courseId/:psetId', authorize, hasStaffAccess,
  async (req, res, next) => {
    const psetId = req.params.psetId;
    const course = await Course.findOne({_id: req.params.courseId});
    const problemSet = await ProblemSet.findOne({_id: psetId});
    //const problems = await Problem.find({psetId: psetId});
    let problems = await Problem.find({psetId: psetId}).populate('skills');  
    //res.setHeader('Content-disposition', 'attachment; filename=problems.tex');
    res.setHeader('Content-type', 'text/plain');
    const startTex = '\\input{preamble.tex}\n\\begin{document}\n';
    const preamble 
     =  personalizedPreamble('studentEmail',
                              course.name,
                              (new Date()).toISOString().slice(0,16));
    
    const endTex = '\\end{document}\n';

    res.send(startTex + preamble+generateTex(problems)+endTex);
    //res.send('downloadAsTexFile not implemented yet');
  });


app.get("/addProblem_PRA/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const pset = await ProblemSet.findOne({_id: req.params.psetId});
    res.locals.psetId = req.params.psetId;
    res.locals.courseId = req.params.courseId;
    //res.locals.skills = await Skill.find({courseId: pset.courseId});
    res.locals.problem={description:"",problemText:"",points:0,rubric:"",skills:[],visible:true,submitable:true,answerable:true,peerReviewable:true};
    res.locals.problemSet = await ProblemSet.findOne({_id: req.params.psetId});


    let problems = await Problem.find({psetId: req.params.psetId}).populate('skills');
    //res.locals.psetSkillIds  = problems.map((x) => x.skills[0]._id.toString());
    res.locals.problems = [];
    //let skills = await CourseSkill.find({courseId: req.params.courseId}).populate('skillId');
    //res.locals.skillIds = skills.map((x) => x.skillId);
    //res.locals.skill = null;
    res.locals.newProblems=[];
    
    res.render("addProblem_PRA");
  } catch (e) {
    next(e);
  }
});

app.get("/addProblem/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const pset = await ProblemSet.findOne({_id: req.params.psetId});
    res.locals.psetId = req.params.psetId;
    res.locals.courseId = req.params.courseId;
    res.locals.skills = await Skill.find({courseId: pset.courseId});
    res.locals.problem={description:"",problemText:"",points:0,rubric:"",skills:[],visible:true,submitable:true,answerable:true,peerReviewable:true};
    res.locals.problemSet = await ProblemSet.findOne({_id: req.params.psetId});


    let problems = await Problem.find({psetId: req.params.psetId}).populate('skills');
    res.locals.psetSkillIds = problems.map((x) => x.skills[0]._id.toString());
    res.locals.problems = [];
    let skills = await CourseSkill.find({courseId: req.params.courseId}).populate('skillId');
    res.locals.skillIds = skills.map((x) => x.skillId);
    res.locals.skill = null;
    res.locals.newProblems=[];
    
    res.render("addProblem_MLA");
  } catch (e) {
    next(e);
  }
});


app.post("/saveProblem_PRA/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;

    let newProblem = new Problem({
      courseId: courseId,
      psetId: psetId,
      description: req.body.description,
      problemText: req.body.problemText,
      mimeType: req.body.mimeType,
      answerMimeType: req.body.answerMimeType,
      rubric: req.body.rubric,
      skills: [],
      pendingReviews: [],
      allowAnswers: true,
      visible: true,
      submitable: true,
      answerable: true,
      peerReviewable: true,
      parentProblemId: null,
      variant: false,
      createdAt: new Date(),
    });

    await newProblem.save();

    res.redirect("/showProblemSetToStaff_PRA/" +courseId+"/"+ psetId);
  } catch (e) {
    next(e);
  }
});


app.post("/saveProblem/:courseId/:psetId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;

    // generate the list of skills from a checkbox widget
    let skills = req.body.skills;
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }

    let newProblem = new Problem({
      courseId: courseId,
      psetId: psetId,
      description: req.body.description,
      problemText: req.body.problemText,
      mimeType: req.body.mimeType,
      answerMimeType: req.body.answerMimeType,
      rubric: req.body.rubric,
      skills: skills,
      pendingReviews: [],
      allowAnswers: true,
      visible: false,//req.body.visible == "visible",
      submitable: false,//req.body.submitable == "submitable",
      answerable: false,//req.body.answerable == "answerable",
      peerReviewable: false,//req.body.peerReviewable == "peerReviewable",
      parentProblemId: null,
      variant: false,
      createdAt: new Date(),
    });

    await newProblem.save();

    res.redirect("/showProblemSet/" +courseId+"/"+ psetId);
  } catch (e) {
    next(e);
  }
});

app.post("/updateProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  try {
    const problem = await Problem.findOne({_id: req.params.probId});
    const courseId = problem.courseId;
    problem.description = req.body.description;
    problem.problemText = req.body.problemText;
    problem.mimeType = req.body.mimeType;
    problem.answerMimeType = req.body.answerMimeType;
    problem.rubric = req.body.rubric;
    problem.createdAt = new Date();

    problem.visible = req.body.visible == "visible";
    problem.answerable = req.body.answerable == "answerable";
    problem.submitable = req.body.submitable == "submitable";
    problem.peerReviewable = req.body.peerReviewable == "peerReviewable";

   
    let skills = req.body.skill;
  
    if (typeof skills == "undefined") {
      skills = [];
    } else if (typeof skills == "string") {
      skills = [skills];
    }
    problem.skills = skills;

    await problem.save();

    res.redirect("/showProblem/" +courseId+"/"+problem.psetId+"/"+ req.params.probId);
  } catch (e) {
    next(e);
  }
});

/*
Refactor notes -- 
this is doing much more work than it needs to.
Students only need to see the problem, not the progress, etc.
*/
app.get("/showProblem/:courseId/:psetId/:probId", 
  authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;
    const probId = req.params.probId;
    const userId = req.user._id;
    
    const problemSet = await ProblemSet.findOne({_id: psetId});
    const problem = await Problem.findOne({_id: probId}).populate('skills');
    const course = await Course.findOne({_id: courseId});

    // get info about answers
      
    const allAnswers = await Answer.find({problemId: probId});
    const answerCount = allAnswers.length; 
    const usersAnswers = 
      await Answer
              .find({psetId:psetId,problemId: probId, studentId: userId})
              .sort({createdAt:-1});
    const theAnswer = (usersAnswers.length==0)?{answer:""}:usersAnswers[0];
    
    const reviews = await Review.find({psetId:psetId, problemId: probId});
    const reviewCount = reviews.length;
    const averageReview = reviews.reduce((t, x) => t + x.points, 0) / reviews.length;
    

    const skills = await Skill.find({_id: {$in: problem.skills}});
    const skillsMastered = await getStudentSkills(courseId,userId);
    
    let markdownText = problem.problemText;
    if (problem.mimeType == 'markdown') {
      markdownText = converter.makeHtml(markdownText);
      const mathjaxScript = `
<script type="text/x-mathjax-config">
  MathJax.Hub.Config({
    tex2jax: {
      inlineMath: [ ['$','$'], ["\\(","\\)"] ],
      processEscapes: true
    },
  });
</script>
<script type="text/javascript"
  src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-AMS-MML_HTMLorMML">
</script>

`;
      markdownText = mathjaxScript + markdownText;

    }


    let status = ""
    if (!problem.visible) {
      status = 'hidden';
    } else if (!problem.answerable) {
      status = 'closed';
    } else if (!problem.submitable) {
      status = 'open';
    } else {
      status = 'submitable';
    }
    res.locals = 
       {...res.locals, 
        status,courseId,psetId,probId,
        problem,problemSet,course,
        markdownText,
        answerCount,allAnswers,usersAnswers,theAnswer,
        skills,skillsMastered,
        reviews, reviewCount, averageReview,
        };
    
    if (!res.locals.isStaff) {
      if (course.courseType == "pra") {
        res.render("showProblemToStudent_PRA");    
      } else {
        res.render("showProblemToStudent_MLA");
      }
    } else {
      if (course.courseType == "pra") {
        const answers = await Answer.find({problemId: probId});
        const reviews = await Review.find({problemId: probId});
        res.locals.numAnswers = answers.length;
        res.locals.numReviews = reviews.length;
        res.render("showProblemToStaff_PRA");    
      } else {
        res.render("showProblemToStaff_MLA");
      }
    }
    
  } catch (e) {
    console.error('Error in showProblem:', e);
    next(e);
  }
});

app.get("/startProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: true});
  const problem = await Problem.findOne({_id: req.params.probId});
  res.redirect("/showProblem/" + problem.courseId+"/"+ req.params.probId);
});

app.get("/stopProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  const result = await Problem.updateOne({_id: req.params.probId}, {allowAnswers: false});
  const problem = await Problem.findOne({_id: req.params.probId});
  res.redirect("/showProblem/" + problem.courseId+"/"+req.params.probId);
});




app.get('/showProblemLibrary/:courseId/:psetId', authorize, hasCourseAccess,
  async (req,res,next) => {
    res.locals.courseId = req.params.courseId;
    res.locals.psetId = req.params.psetId;
    let problems = await Problem.find({psetId: req.params.psetId}).populate('skills');
    res.locals.psetSkillIds = problems.map((x) => x.skills[0]._id.toString());
    res.locals.problems = [];
    let skills = await CourseSkill.find({courseId: req.params.courseId}).populate('skillId');
    res.locals.skills = skills.map((x) => x.skillId);
    res.locals.skill = null;
    res.locals.newProblems=[];
    //res.json(res.locals.skills);
    res.render('showProblemLibrary');
  }
)


app.get('/showProblemsBySkill/:courseId/:psetId/:skillId', authorize, hasCourseAccess,
  async (req,res,next) => {
    /*
      We want to find the list of problems using the specified skill,
      sorted by the last time they were used in any course.
      We also only want original problems not, copies of problems,
      but we want the last time any copy was used in any course.
      We also want the problems whose skill is a variant of the specified skill.
      We keep track of the original skill for each skill that gets duplicated
      in a course, so we can find the list of variants of a skill
      and look for problems with any of those skills.
      So we need to compute a psetMap which maps problemIds to the
      list of dates that copies of that problem were used in a course
      and sort the problems by the first (latest) date in that list.
      Eventually, we will narrow this search to the problems
      used in a set of courses, or in an organization...
    */
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;
    const skillId = req.params.skillId;

    // get the skill object we are interested in
    const skill = await Skill.findOne({_id:  skillId});
    // get the skill variants, i.e. skills with the same original skill
    let variants = [];
    if (skill.original) {
      variants = await Skill.find({original: skill.original});
      variants.push(skill.original._id);
    }else {
      variants = await Skill.find({original: skill._id});
      variants.push(skill._id);
    }
    const variantIds = variants.map((x) => x._id);



    // get the problems that have that skill in their list of skills
    // and for which the user is the owner or is a TA
    // and populate the courseId field
    // we use $elemMatch to find problems whose skills list
    // contains any of the variant skills

    // For now we will show any problems based on that skill
    const problems =
        await Problem
              .find(
                {skills: {$elemMatch:{$in:variantIds}},
                 //courseId: {$in: visibleCourses}
                })
              .populate('courseId')
              .sort({createdAt: -1});

    
    
    // get the list of skills for this course
    let courseSkillObjects = 
      await CourseSkill
            .find({courseId: courseId})
            .populate('skillId');
    const skills = courseSkillObjects.map((x) => x.skillId);



     /*
      psetMap is a dictionary mapping problemIds to lists of dates
      which are the dates the problem or a variant was created in any course.
      for any problemId, the list of dates is sorted in descending order.
      If the problem is a variant, the date is the date the variant was created
      and it is indexed by the parentProblemId field.
    */
    let psetMap = {};
    for (let p of  problems) {
      const originalId = p.parentProblemId || p._id;
      psetMap[originalId] = psetMap[originalId] || [];
      psetMap[originalId].push(p.createdAt);
    }

    // sort the psetMap dates in descending order
    const compDates = (a,b) => {if (a<b){return 1;} else {return -1}};

    for (let p in  psetMap) {
      psetMap[p].sort(compDates);
    }

    const compProbs = (a,b) => {
      let d1 = psetMap[a._id][0];
      let d2 = psetMap[b._id][0];
      if (d1>d2){
        return 1;
      }else{
        return -1;
      };
    }
  
    const newProblems = 
      problems.filter((x) => x.parentProblemId==null);

    newProblems.sort(compProbs);

    let currentProblems = await Problem.find({psetId: req.params.psetId}).populate('skills');
    res.locals.psetSkillIds = currentProblems.map((x) => x.skills[0]._id.toString());
    res.locals.problemSet = await ProblemSet.findOne({_id: req.params.psetId});

    res.locals = 
      {...res.locals, 
        courseId, psetId, skillId, 
        problems, newProblems, 
        psetMap,
        skill, skills};

    res.render('showProblemsBySkill');
  }
)


/*
  This route is used to add a problem to a problem set from the library
  of problems that contain a specified skill. Even though problems can
  contain multiple skills, we are only looking for problems that contain
  a single skill (or a variant) and the new problem will just have that new skill
*/
app.get("/addProblemToPset/:courseId/:psetId/:probId/:skillId", authorize, isOwner,
  async (req, res, next) => {
    const courseId = req.params.courseId;
    const probId = req.params.probId;
    const psetId = req.params.psetId;
    const skillId = req.params.skillId;

    // create a copy of the problem object
    const problem = await Problem.findOne({_id:probId}); 
    const newProblem = problem;
    newProblem.isNew = true;
    newProblem.courseId = courseId;
    newProblem.psetId = psetId;
    newProblem.parentProblemId = problem._id;  
    newProblem.createdAt = new Date();
    newProblem.skills = [skillId];
    newProblem._id = undefined;
    await newProblem.save();


    res.redirect("/addProblem/" + courseId+"/"+ psetId); 
  });

app.get("/removeProblem/:courseId/:psetId/:probId", authorize, isOwner,
  // we don't need to pass the psetId to this route, but it is useful for debugging
  async (req, res, next) => {
    const probId = req.params.probId;
    const psetId = req.params.psetId;

    const deletedCourse = await Problem.deleteOne({_id: probId});
    res.redirect("/showProblemSet/" + req.params.courseId+"/"+ psetId);
  });



function getElementBy_id(id, vals) {
  for (let i = 0; i < vals.length; i++) {
    if (vals[i]["_id"] + "" == id) {
      return vals[i];
    }
  }
  return null;
}

app.get("/showAllAnswers/:courseId/:probId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const userId = req.user._id;
    const courseId = req.params.courseId;
    const probId = req.params.probId;

    const problem = await Problem.findOne({_id: probId});
    const psetId = problem.psetId;

    const course = await Course.findOne({_id: courseId});


    const userReviews = await Review.find({problemId: probId, reviewerId: userId});
    const allSkills = await Skill.find({courseId: courseId});

    const getSkill = (id, vals) => getElementBy_id(probId, vals);
    const numReviews = userReviews.length;
    const canView = numReviews >= 2 || isOwner;
    let answers = []
    let reviews = []
    if (canView) {
      answers = await Answer.find({problemId: probId}).collation({locale: "en", strength: 2}).sort({answer: 1});
      reviews = await Review.find({problemId: probId});
    }
    let taList = await CourseMember.find({courseId: courseId, role: "ta"}).populate('studentId'); 
    taList = taList.map((x) => x.studentId._id);
    res.locals = {
      ...res.locals,
      courseId,probId,psetId, 
      problem,course,
      allSkills,getSkill,
      numReviews,canView,answers,reviews,taList,
    }
    //res.json(res.locals);
    res.render("showAllAnswers");
  } catch (e) {
    next(e);
  }
});

app.get("/editProblem/:courseId/:probId", authorize, isOwner,
  async (req, res, next) => {
  const id = req.params.probId;
  res.locals.probId = id;
  res.locals.problem = await Problem.findOne({_id: id});
  res.locals.course = await Course.findOne({_id: res.locals.problem.courseId}, "ownerId");
  res.locals.skills = await Skill.find({_id: {$in: res.locals.problem.skills}});
  res.locals.allSkills = await Skill.find({courseId: res.locals.problem.courseId});
  res.render("editProblem");
});

/*
  This route has some nuanced behavior.
  If the user tries to save an answer that has already
  been reviewed, then we should not let them do it and
  we should send them to a page that says their answer has
  been reviewed and they can't update it. 
*/
app.post("/saveAnswer/:courseId/:psetId/:probId", 
          authorize, 
          hasCourseAccess,
  async (req, res, next) => {
    try{
      const probId = req.params.probId;
      const psetId = req.params.psetId;
      const courseId = req.params.courseId;

      const answers = await Answer.find({studentId: req.user._id, problemId: probId});

      const answerIds = answers.map((x) => x._id);
      const reviews = await Review.find({answerId: {$in: answerIds}});

      if (reviews.length > 0) {
        res.redirect("/showReviewsOfAnswer/" + courseId +"/" + psetId+"/"+ answerIds[0]);
      } else {
        let newAnswer = new Answer({
          studentId: req.user._id,
          courseId: courseId,
          psetId: psetId,
          problemId: probId,
          answer: req.body.answer,
          reviewers: [],
          numReviews: 0,
          pendingReviewers: [],
          createdAt: new Date(),
        });

        // we need to delete any previous answers for this problem
        // each problem should have at most one answer per student
        await Answer.deleteMany({studentId: req.user._id, problemId: probId});

        await newAnswer.save();

        res.redirect("/showProblem/" +courseId+"/" + psetId+"/"+probId);

    }
  } catch (e) {
      next(e);
    }
  });



const addImageFilePath = (req,res,next) => {
  // this adds a filepath to the request object
  // and is used to upload images in the storage system
  // we append a random number so that a bad actor
  // couldn't find a students answer by getting their
  // user_id and the course,pset, and problem Ids
  // this is a kind of salt.. 
  const uniqueSuffix = //Date.now() + '_' + 
      (Math.round(Math.random() * 1E9)).toString();
      if (process.env.UPLOAD_TO=='AWS'){
        let path = 
        req.filepath =
          "studentImages/"
          +req.user._id+"/"
          +req.params.probId+"/"   
          +uniqueSuffix+"_";
        req.urlpath = 
          "https://" + 
          process.env.AWS_BUCKET_NAME +
          ".s3.us-east-2.amazonaws.com/"+
          req.filepath;
      } else {
        req.filepath=
          "/answerImages/" +
          req.params.probId+"_"
          +req.user._id+"_"
          +uniqueSuffix+"_";
        req.urlpath = req.filepath;
      }

      next();
};


/*
uploadAnswerPhoto is called when a student uploads an image as an answer
and it is also called by a TA when they are reuploading an image for a student.
In the latter case, the new image should simply replace the old image in 
the student's answer and the route should redirect to the showReviewsOfAnswer page.

This is tricky because we are allowing the TA to upload a photo after a review
has been done.  This is not allowed for students, but we are allowing it for TAs

*/

app.post("/uploadAnswerPhoto/:courseId/:psetId/:probId", 
          authorize, hasCourseAccess,
          addImageFilePath,
          upload.single('picture'),
    async (req, res, next) => {
      try {


        const probId = req.params.probId;
        const psetId = req.params.psetId;
        const courseId = req.params.courseId;
        let studentId = req.user._id;
        if (res.locals.isStaff && req.query.theStudentId) {
          studentId = req.query.theStudentId
        }



        // look to see if the user has already uploaded an answer
        // to this problem and if that answer has been reviewed
        const answers = await Answer.find({studentId, problemId: probId});
        const answerIds = answers.map((x) => x._id);
        const reviews = await Review.find({answerId: {$in: answerIds}});
  
        if (reviews.length > 0 && !res.locals.isStaff) {
          // if the answer has already been reviewed, then we can't update it
          // unless the user is a staff member, in which case they can
          // change the image in the answer
          res.redirect("/showReviewsOfAnswer/" + courseId +"/" + psetId+"/"+ answerIds[0]);
        } else {
          // in this case there are either no answers
          // or an answer but no reviews
          // or an answer and reviews but the user is staff

          // before uploading a new answer
          // first look for an old answer 

          if ( answers.length > 0 && (reviews.length==0 || res.locals.isStaff)) {
          // if there is an answer, but no reviews, or the user is staff
          // then replace the image file
          // So first, delete the image file if it exists
          // if the imageFilePath starts with https://
          // then we have to delete it from AWS S3
          // otherwise we delete it from the local filesystem
            if (process.env.UPLOAD_TO=='AWS'){
              try {
                let imageFilePath = answers[0].imageFilePath;
                if (imageFilePath) {
                  let key = imageFilePath.split('//').slice(-1)[0];
                  await s3.deleteObject({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: key
                  }).promise();
                 }
              } catch(e){
                console.error('error deleting AWS file: ', e);
              }
            } else {
              try {
                  let imageFilePath = 
                    __dirname+"/public/"+answers[0].imageFilePath;
                  if (imageFilePath) {
                    try {
                      await unlinkAsync(imageFilePath);
                    } catch (e){
                      console.error('error ulinking file: ',e.message);
                    }
                  }
                } catch (e) {
                  console.error('error deleting LOCAL file: ',e.message);
                }
            }
            // now we can store the new image path in the answer
            
            let imageFilePath = req.urlpath+req.suffix;
            const theAnswer = await Answer.findOneAndUpdate(
              {studentId, problemId: probId},
              {$set:{imageFilePath}});
            if (res.locals.isStaff) {
              res.redirect('/showReviewsOfAnswer/' + courseId + '/' + psetId + '/' + theAnswer._id);
            } else {
              res.redirect('/showProblem/' + courseId + '/' + psetId + '/' + probId);
            }
          } else {
            // in this case either there are no answers, or
            // there is an answer and it has been reviewed and the user is not staff
            // in the later case we should redirect back to showReviewsOfAnswer
            // as we can't have the user changing their answer after it has been reviewed
            // in the former case, we will create a new answer
            if (answers.length > 0) {
              res.redirect("/showReviewsOfAnswer/" + courseId +"/" + psetId+"/"+ answerIds[0]);
            } else {
              if (!req.suffix){
                req.suffix = '.jpg';
              }
              // in this case the user is a student uploading an image
              // so, now create a new answer with the new photo
              // and store in the database
              let newAnswerJSON = {
                studentId: studentId,
                courseId: courseId,
                psetId: psetId,
                problemId: probId,
                imageFilePath: req.urlpath+req.suffix,
                reviewers: [],
                numReviews: 0,
                pendingReviewers: [],
                createdAt: new Date(),
              };
              let newAnswer = new Answer(newAnswerJSON);
      
              // we need to delete any previous answers for this problem
              // each problem should have at most one answer per student
              await Answer.deleteMany({studentId, problemId: probId});
      
              await newAnswer.save();
              res.redirect("/showProblem/" +courseId+"/" + psetId+"/"+probId);
          }
        }
      }
      
    } catch (e) {
      console.error("error in uploadAnswerPhoto: ",e.message);
      next(e);
    }

  }

);
  





app.post("/requestRegrade/:courseId/:reviewId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const review = await Review.findOne({_id: reviewId});
    const regradeRequest = new RegradeRequest({
      reviewId: reviewId,
      answerId: review.answerId,
      problemId: review.problemId,
      psetId: review.psetId,
      courseId: review.courseId,
      studentId: review.studentId,
      reason: req.body.reason,
      reply: "none yet",
      completed: false,
      createdAt: new Date(),
    });
    await regradeRequest.save();

    res.redirect("/showReviewsofAnswer/" 
         + review.courseId+"/"+review.psetId+"/"+review.answerId);
  } catch (e) {
    next(e);
  }
});

app.get("/showRegradeRequests/:courseId", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const regradeRequests = await RegradeRequest.find({courseId: req.params.courseId});
    res.locals.regradeRequests = regradeRequests;
    res.locals.courseId = req.params.courseId;
    res.render("showRegradeRequests");
    //res.json([req.params.courseId,regradeRequests])
  } catch (e) {
    next(e);
  }
});

app.get("/showRegradeRequest/:courseId/:requestId", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const requestId = req.params.requestId;
    const regradeRequest = await RegradeRequest.findOne({_id: requestId});

    res.locals.regradeRequest = regradeRequest;
    res.redirect("/showReviewsOfAnswer" 
              +"/"+regradeRequest.courseId 
              +"/"+regradeRequest.psetId
              +"/"+regradeRequest.answerId);
    //res.json([req.params.requestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});

app.post("/updateRegradeRequest/:courseId/:regradeRequestId", authorize, hasStaffAccess, 
  async (req, res, next) => {
  try {
    let regradeRequest = await RegradeRequest.findOne({_id: req.params.regradeRequestId});
    regradeRequest.reply = req.body.reply;
    regradeRequest.completed = true;
    await regradeRequest.save();
    res.redirect("/showReviewsOfAnswer"
      +"/"+regradeRequest.courseId 
              +"/"+regradeRequest.psetId
              +"/"+regradeRequest.answerId);
    //res.json([req.params.regradeRequestId,regradeRequest])
  } catch (e) {
    next(e);
  }
});



app.get("/thumbsU/:courseId/:mode/:reviewId/:userId", authorize, hasCourseAccess,
  async (req, res, next) => {
  let reviewId = req.params.reviewId;
  let userId = req.params.userId;
  let mode = req.params.mode;
  if (mode == "select") {
    await Review.findOneAndUpdate({_id: reviewId}, {$push: {upvoters: userId}});
  } else {
    await Review.findOneAndUpdate({_id: reviewId}, {$pull: {upvoters: userId}});
  }

  res.json({result: "OK"});
});

app.get("/thumbsD/:courseId/:mode/:reviewId/:userId", authorize, hasCourseAccess,
  async (req, res, next) => {
  let reviewId = req.params.reviewId;
  let userId = req.params.userId;
  let mode = req.params.mode;
  if (mode == "select") {
    await Review.findOneAndUpdate({_id: reviewId}, {$push: {downvoters: userId}});
  } else {
    await Review.findOneAndUpdate({_id: reviewId}, {$pull: {downvoters: userId}});
  }

  res.json({result: "OK"});
});


app.get("/showStudentInfo/:courseId", authorize, hasStaffAccess,
  (req, res) => {
  res.redirect("/showTheStudentInfo/" + req.params.courseId+"/summary");
});

app.get("/showTheStudentInfo/:courseId/:option", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const id = req.params.courseId;
    // get the courseInfo
    res.locals.courseInfo = await Course.findOne({_id: id}, "name ownerId");

    const isOwner = req.user._id.equals(res.locals.courseInfo.ownerId);

    if (!(isOwner || isTA)) {
      
      res.send("only the course owner and TAs can see this page");
      return;
    }

    // get the list of ids of students in the course
    const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
    res.locals.students = memberList.map((x) => x.studentId);

    // student status is a map from id to status
    // we can use this to filter student based on their statue
    // e.g. enrolled, dropped, ta, guest, owner, ...
    // we will need a page to see all students and edit their statuses
    res.locals.studentStatus = new Map();
    memberList.map((x) => {
      res.locals.studentStatus.set(x.studentId, x.status);
    });

    res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}});

    const courseId = res.locals.courseInfo._id;
    res.locals.answers = await Answer.find({courseId: courseId});

    res.locals.problems = await Problem.find({courseId: courseId});

    res.locals.reviews = await Review.find({courseId: courseId});

    const gradeSheet = createGradeSheet(res.locals.studentsInfo, res.locals.problems, res.locals.answers, res.locals.reviews);

    res.locals.gradeSheet = gradeSheet;


    if (req.params.option == "csv") {
      res.render("showStudentInfoCSV");
    } else {
      res.render("showStudentInfo");
    }
  } catch (e) {
    next(e);
  }
});

app.get("/showOneStudentInfo/:courseId/:studentId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const studentId = req.params.studentId;
    const courseInfo = await Course.findOne({_id: courseId}, "name ownerId");
    const studentInfo = await User.findOne({_id: studentId});
    res.locals.courseInfo = courseInfo;
    res.locals.studentInfo = studentInfo;

    const isTheStudent = req.user._id.equals(studentId);

    if (!res.locals.isOwner && !res.locals.isTA && !isTheStudent) {
      res.send("only the course owner and TAs and the student themselves can see this page");
    } else {

      // get the list of ids of students in the course
      const memberList = await CourseMember.find({courseId: res.locals.courseInfo._id});
      res.locals.students = memberList.map((x) => x.studentId);

      res.locals.studentsInfo = await User.find({_id: {$in: res.locals.students}});

      res.locals.answers = 
        await Answer.find({courseId: courseId})
              .populate('skills');

      let problems = await Problem.find({courseId: courseId});
      res.locals.problems = problems;

      // res.locals.problems = 
      //    await Problem.find({courseId: courseId})
      //         .populate('skills');

      res.locals.reviews = await Review.find({courseId: courseId});

      const gradeSheet = createGradeSheet(res.locals.studentsInfo, res.locals.problems, res.locals.answers, res.locals.reviews);

      res.locals.gradeSheet = gradeSheet;
      //res.json(res.locals);
      res.render("showOneStudentInfo");
    }
  } catch (e) {
    next(e);
  }
});

app.post("/addTA/:courseId", authorize, isOwner, 
  async (req, res, next) => {
  try {
    const course = await Course.findOne({_id: req.params.courseId});
    //let ta = await User.findOne({googleemail: req.body.email});
    let email = req.body.email;
    let name = req.body.name;
    let section = req.body.section;

    let user = await User.findOne({googleemail:email});
    if (!user) {
      // create a new user with the email as the googleemail
      const userJSON = {
        googleemail:email,
        googlename:name,
        createdAt: new Date(),
      }
      user = new User(userJSON);
      user = await user.save();
    }
    const ta=user;

    if (ta._id+""==course.ownerId) {
      res.send("You can't add the course owner as a TA");
    } else {
       // add the TA to the CourseMember collection with role TA
      let courseMember = new CourseMember({
        courseId: req.params.courseId,
        studentId: ta._id,
        section: section,
        role: "ta",
        createdAt: new Date(),
      });
      // remove their other roles ....
      // a user can have at most one role in a course....
      // but we can't remove the owner!
      
      await CourseMember.remove({courseId: req.params.courseId, studentId: ta._id});
      await courseMember.save();

      res.redirect("/showTAs/" + req.params.courseId);
    }
   
  } catch (e) {
    next(e);
  }
});

app.post("/removeTAs/:courseId", authorize, isOwner, 
  async (req, res, next) => { 
  try {

    if (req.body.ta == null) {
      // do nothing
    } else if (typeof req.body.ta == "string") {
      await CourseMember.deleteOne({courseId: req.params.courseId, studentId: req.body.ta});
    } else {
      req.body.ta.forEach(async (x) => {
        await CourseMember.deleteOne({courseId: req.params.courseId, studentId: x});
      });
    }

    res.redirect("/showTAs/" + req.params.courseId);
  } catch (e) {
    next(e);
  }
});

app.get("/showTAs/:courseId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    res.locals.courseInfo = await Course.findOne({_id: req.params.courseId}, "name ownerId coursePin");
    const taMembers 
      = await CourseMember
              .find({courseId: req.params.courseId,role:'ta'})
    const taIds = taMembers.map((x) => x.studentId);
    res.locals.tas = await User.find({_id:taIds});

    res.render("showTAs");
  } catch (e) {
    next(e);
  }
});


const compareSkills = (a,b) => {
  return compareSkillShortNames(a.shortName,b.shortName);
} 

const compareSkillShortNames = (a,b) => {
  if (a[0] < b[0]) {
    return -1;
  } else if (a[0] > b[0]) {
    return 1;
  } else {
    let n1 = parseInt(a.slice(1));
    let n2 = parseInt(b.slice(1));
    return n1-n2;

  }
} 


const calculateMastery = (grades) => {
  /* 
  for each student, calculate the set of skills mastered.
  return a dictionary indexed by student emails, 
  whose values are dictionaries of skills mastered by that student,
  indexed by skill name whose values are 1.0 if it was mastered and 0.0
  if it was not mastered
  */
  const mastery = {};
  let skillSet = new Set();
  for (let grade of grades) {
      const email = grade.email;

      

      if (!mastery[email]){
        mastery[email] = {name:grade.name};
      }
      (grade.skillsMastered).forEach(skill => {
        skillSet.add(skill);
        mastery[email][skill] = 1.0;
      }
      );
      (grade.skillsSkipped).forEach(skill => {
        if (!mastery[email][skill]) {
          mastery[email][skill] = 0.0;
        }
      });
  }
  for (let email in mastery) {
    /* calculate number of F skills and G skills and
       add these as keys to the mastery dictionary */
    mastery[email]["Fskills"] = 0;
    mastery[email]["Gskills"] = 0;
    for (let skill in mastery[email]) {
      if ((skill[0] == "F") 
          && (skill != "Fskills")
          && (mastery[email][skill] == 1.0)) {
        mastery[email]["Fskills"] += 1;
      }
      if ((skill[0] == "G")
          && (skill != "Gskills")
          && (mastery[email][skill] == 1.0)) {
        mastery[email]["Gskills"] += 1;
      }
    }
  }
  skillSet = [...skillSet];
  skillSet = skillSet.sort(compareSkillShortNames);
  return [skillSet,mastery];
}

const masteryCSVtemplate =
`name,email,section,Fskills,Gskills,<% for (let skill in skillSet) { %><%= 
    skillSet[skill] %>,<% } %>
<% for (let email in mastery) { %><%= 
    mastery[email]['name'] %>,<%= 
    email %>,<%= 
    sectionDict[email] %>,<%=
    mastery[email]['Fskills'] %>,<%= 
    mastery[email]['Gskills'] %>,<% 
    for (let skill of skillSet) { 
                        let m =mastery[email][skill];
                        if (m === undefined) {
                            m = 0;
                        }
                        %><%= 
        m %>, <% } %>
<% } %>
`;
app.get("/postGrades/:courseId/:psetId", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;
    const course = await Course.findOne({_id: courseId});
    const problemSet = await ProblemSet.findOne({_id: psetId});
    const answers 
      = await Answer
          .find({courseId: courseId, psetId: psetId})
          .populate('skills')
          .populate('studentId');
    
    /*
    First delete all of the PostedGrades for this course and pset.
    Then,for each answer, create a new PostedGrades object which will
    show the skills mastered by each student for the exam.
    We need to iterate through all of the answers and create a dictionary
    of skills mastered by each student.
    We will create a grades object for each student which is a dictionary
    showing for each skill whether it was mastered or not, 
    with 1.0 for mastered and 0.0 for not mastered. The only reason to do this
    is the possibly handle the case where each skill could be mastered
    multiple times by a student on an exam... Once we have this grades object
    we can easily create the PostedGrades object.
    */
   let gradesDict = {};
   let studentDict = {}
    for (let answer of answers) {
      if (!gradesDict[answer.studentId._id]) {
        studentDict[answer.studentId._id] = answer.studentId;
        gradesDict[answer.studentId._id] = {skillsMastered:[],skillsSkipped:[]};
      }
      for (let skill of answer.skills) {
        gradesDict[answer.studentId._id].skillsMastered.push(skill);
      }
    }

    /*
    for each student in the gradesDict, we create a PostedGrades document
    once we have all of the PostedGrades documents, we insert them into the
    database.
    */
    let postedGrades = [];
    for (let id in gradesDict) {
      let pg = {
        courseId: courseId,
        name: studentDict[id].name,
        email: studentDict[id].googleemail,
        examId: psetId,
        skillsMastered: 
            gradesDict[id].skillsMastered.map(x => x.shortName),
        skillsSkipped: 
            gradesDict[id].skillsSkipped.map(x => x.shortName),
        createdAt: new Date(),
      };
      postedGrades.push(pg);
    }
   
    await PostedGrades.deleteMany({courseId,examId:psetId});
    await PostedGrades.insertMany(postedGrades);
    // finally update the probemSet status to "graded"
    await ProblemSet.findOneAndUpdate({_id:psetId},{status:'graded'});

    //res.json([answers,gradesDict,postedGrades])
    res.redirect("/showMastery/" + courseId);
  } catch (e) {
    next(e);
  }
});


app.get("/showMastery/:courseId", 
  authorize, hasStaffAccess, 
  getClassGrades,
 async (req,res,next) => {
  const courseId = req.params.courseId;
  const course = await Course.findOne({_id:courseId});
  const exams = await ProblemSet.find({courseId});
  const csv = req.query.csv;
  res.locals.course = course;
  const grades = await PostedGrades.find({courseId}).sort({email:1});
  const sections = await CourseMember.find({courseId,role:'student'}).populate('studentId');
  const sectionDict = {};
  for (let section of sections) {
    sectionDict[section.studentId.googleemail] = section.section;
  }
  res.locals.sectionDict = sectionDict;
  res.locals.grades = grades;
  res.locals.exams = exams;
  [res.locals.skillSet,res.locals.mastery] = calculateMastery(grades);
  if (csv){ 
    res.set('Content-Type', 'text/csv');
    res.send(ejs.render(masteryCSVtemplate,res.locals));
  } else {
    //res.json([res.locals.skillSet,res.locals.mastery])
    res.render('showMastery'); 
  }
})

app.get('/showStudentsMissingSkill/:courseId/:skill',
  authorize, hasStaffAccess,
  async (req,res,next) => {
    try{
      /*
        This code needs to be cleaned up and refactored and optimized
      */
      const courseId = req.params.courseId;
      const skillName=req.params.skill;
      const skill = await Skill.findOne({courseId,shortName:skillName});
      const studentsWhoMasteredSkill =
        await PostedGrades.distinct("email",{courseId,skillsMastered:skillName});
      const studentIdsWhoMasteredSkillA =
        await User.distinct('_id',{googleemail:{$in:studentsWhoMasteredSkill}});
      const studentIdsWhoMasteredSkill =
        studentIdsWhoMasteredSkillA.map((x) => x+"");
      const studentIdsInClass =
        await CourseMember.distinct('studentId',{courseId,role:'student'});
      const result = studentIdsInClass.filter(x => !studentIdsWhoMasteredSkill.includes(x+""));
      const usersWhoDidNotMasterSkill = 
        await User.find({_id:{$in:result}});
      res.render('showStudentsMissingSkill',{courseId,skill,usersWhoDidNotMasterSkill});
      //res.json('usersWhoDidNotMasterSkill');   
    }
    catch(e){
      next(e);
    }
  }
)

app.get("/showExamMastery/:courseId/:examId", 
  authorize, hasStaffAccess, 
  getClassGrades,
 async (req,res,next) => {
  try {
    const courseId = req.params.courseId;
  const examId = req.params.examId;
  const course = await Course.findOne({_id:courseId});
  const grades = await PostedGrades.find({courseId,examId:examId});
  const exam = await ProblemSet.findOne({_id:examId});
  res.locals.course = course;
  res.locals.exam = exam;
  res.locals.grades = grades;
  res.render('showExam'); 

  } catch(e) {
    next(e);
  }
  

})




const ObjectId = mongoose.Types.ObjectId;

const masteryAgg = (courseId) => [
  {
    $match: {
      courseId: new ObjectId(courseId),
    },
  },
  {
    $group: {
      _id: "$studentId",
      numAns: {
        $sum: 1,
      },
      skills: {
        $addToSet: {
          $arrayElemAt: ["$skills", 0],
        },
      },
    },
  },
];

app.get("/mastery/:courseId", authorize, hasStaffAccess,
  async (req, res, next) => {
  const agg = masteryAgg(req.params.courseId);
  const zz = await Answer.aggregate(agg);
  res.json(zz);
});

const masteryAgg2 = (courseId) => [
  {
    $match: {
      courseId: new ObjectId(courseId),
    },
  },
  {
    $group: {
      _id: "$studentId",
      numAns: {
        $sum: 1,
      },
      skills: {
        $push: "$skills",
      },
    },
  },
];

const skillCount = (skills, skillLists) => {
  skillmap = {};
  for (skill of skills) {
    skillmap[skill] = 0;
  }
  for (skillList of skillLists) {
    for (skill of skillList) {
      skillmap[skill] += 1;
    }
  }
  return skillmap;
};

/*
    This route will analyze the skill mastery for the entire class.
    The main goal is to generate a table which shows for each student
    and for each skill, the number of times that students has demonstrated
    mastery of that skill. We will put the skills in an array and label the
    skill columns with numbers (perhaps with tooltips to see the full name).
  */
app.get("/mastery2/:courseId", authorize, isOwner,
  async (req, res, next) => {
  const courseId = req.params.courseId;
  const agg = masteryAgg2(courseId);
  const mastery = await Answer.aggregate(agg);
  const studentIds = mastery.map((x) => x._id);
  const students = await User.find({_id: {$in: studentIds}});
  const skills = await Skill.find({courseId});
  const skillIds = skills.map((x) => x._id);
  const studentSkillCounts = {};
  for (student of mastery) {
    studentSkillCounts[student["_id"]] = skillCount(skillIds, student["skills"]);
  }
  const studentmap = {};
  for (student of students) {
    studentmap[student.id] = student;
  }

  let skillmap = {}; // this maps the skill id to the skill
  for (skill of skills) {
    skillmap[skill.id] = skill;
  }
  let sum = (vals) => {
    total = 0;
    for (val of vals) {
      total += val;
    }
    return total;
  };

  let sum2 = (vals) => {
    total = 0;
    for (val of vals) {
      total += val > 0 ? 1 : 0;
    }
    return total;
  };

  let data = [];
  for (student in studentSkillCounts) {
    let a = {};
    a["student"] = studentmap[student];
    a["skillCounts"] = studentSkillCounts[student];
    a["total"] = sum2(Object.values(a["skillCounts"]));
    data.push(a);
  }
  data = data.sort((x, y) => (x["total"] < y["total"] ? 1 : -1));

  res.render("summarizeSkills", {courseId, data, mastery, studentIds, students, studentmap, studentSkillCounts, skillIds, skillmap, skills});

  //res.json({data,mastery,studentIds,students,studentSkillCounts,skillIds,skillmap,skills})
});



/*
  This is the most complex of the routes for reviewing...
  The goal is to find and claim the answers with the fewest reviews
  and to pick one of those and mark it as a pending review.
  We also remove any pending reviews that are "too old"
  The challenge is that this is currently done by updating values
  in the "answer" object but it takes so much time that another
  user could update the answer field and then the ".save()" operation
  generates an error since it is updating an old version of the object.
  The solution we use here is to use the findOneAndUpdate method 
  with the $incr and $pull   operators.
*/

app.get("/reviewAnswers/:courseId/:psetId/:probId", authorize, hasCourseAccess,
  async (req, res, next) => {

  try {
    const courseId = req.params.courseId; 
    const probId = req.params.probId;  
    const psetId = req.params.psetId;
    res.locals.courseId = courseId;
    res.locals.psetId = psetId;
    res.locals.probId = probId;

    const course = await Course.findOne({_id: courseId});
    res.locals.course = course;

    let problem = await Problem.findOne({_id: probId});

    //first we remove all pendingReviews that have exceeded
    // the time limit is currently 10 minutes, but could be adjusted
    // e.g. we could be ambitious and keep track of the average
    // time to review the problem and use an adaptive timeout,
    // but let's do that later!

    const tooOld = new Date().getTime() - 1 *1000*60*10; // 10 minutes
    let expiredReviews = [];
    problem.pendingReviews ||= [];
    let pendingReviews = problem.pendingReviews.filter((x) => {
      if (x.timeSent < tooOld) {
        expiredReviews.push(x);
        return false;
      } else {
        return true;
      }
    });
    // we should try to use a $pull instead of $set
    // but first lets see if this works....
    // and I'll set the timeout to be relatively short

    if (expiredReviews.length>0){
      await Problem.findByIdAndUpdate(problem._id,
        {$pullAll:{pendingReviews:expiredReviews}});
    }
    

    // next we use the expiredReviews from the problem object
    // to update the numReviews and pendingReviewers fields of the answers

    expiredReviews.forEach(async function (x) {
      // remove the reviewerId from the list of pendingReviewers
      // and decrement the optimistic numReview field
      // pendingReviews has form x = {answerId,reviewerId,timeSent}

      let tempAnswer = await Answer.findOne({_id: x.answerId});
      let expiredReviewers =  tempAnswer.pendingReviewers.filter((r) => {
        return (r.equals(x.reviewerId))     
      });
      // this will update the answer by removing the 
      // expiredReviewers from the pendingReviewer using $pullAll

      await Answer.findByIdAndUpdate(tempAnswer._id,
        {$inc:{numReviews:-expiredReviewers.length},
         $pullAll:{pendingReviewers:expiredReviewers}})

    });

    const localinfo = JSON.stringify(res.locals,null,5);
    res.locals.localinfo = localinfo;
     

    // next, we look to see if there is an answer which the user is already
    // supposed to be reviewing, i.e. the user is a pendingReviewer
    // if there is such an answer then we return that one to the user.

    let answer = await Answer.findOne({problemId:probId,pendingReviewers:req.user._id});
    if (answer) {
      // send the user the review they were already assigned!
      res.redirect("/showReviewsOfAnswer/" + courseId+"/"+psetId+"/"+answer._id);
    } else {
      // the user has not yet been assigned an answer for this problem
      // next, we find all answers to this Problem, sorted by numReviews
      let answers = await Answer.find({problemId: probId}).sort({numReviews: "asc"});
  
      // find first answer not already reviewed by the user
      let i = 0;
      answer = null;
      while (i < answers.length) {
        answer = answers[i];

        if (!answer.reviewers.find((x) => x.equals(req.user._id)) ) {
          // we found an answer the user hasn't reviewed!

          // update the answer to have the user as a pending reviewer
          await Answer.findByIdAndUpdate(answer._id,
              {$inc:{numReviews:1},
               $push:{pendingReviewers:req.user._id}})


          // update the problem to record this pending review
          let review = {answerId: answer._id, 
                        reviewerId: req.user._id, 
                        timeSent: new Date().getTime()};
          await Problem.findByIdAndUpdate(problem._id,
                  {$push:{pendingReviews:review}});
          break;
        } else {
          answer = null;
        }
        i++;
      }
  
      if (answer) {
        // if we find an answer to review, then we redirect the user to that answer
        res.redirect("/showReviewsOfAnswer/"+courseId+"/"+ psetId+"/"+answer._id);
      } else {
        // this is the case where there is nothing left for the user to review
        // Here we set up the local variables we'll need for rendering:
        res.locals.problem = problem;
        res.render('nothingToReview');
      }
    }
  } catch (e) {
    next(e);
  }
});

/*
this is the route for recording that a student didn't answer a question
*/
app.get("/gradeProblemWithoutAnswer/:courseId/:psetId/:probId/:studentId", authorize, hasStaffAccess,
async (req, res, next) => {
try {
  const courseId = req.params.courseId;
  const probId = req.params.probId;
  const psetId = req.params.psetId;
  const studentId = req.params.studentId;

  let problem = await Problem.findOne({_id: probId});

  const answers = await Answer.find({studentId: studentId, problemId: probId});

  if (!answers){
    res.send("this user already has answered the question")
  }else {
    let answer = await Answer.findOne({problemId: probId, studentId: studentId});
    let newAnswer = new Answer({
      studentId: studentId,
      courseId: problem.courseId,
      psetId: problem.psetId,
      problemId: problem._id,
      answer: "no answer",
      reviewers: [],
      numReviews: 0,
      pendingReviewers: [],
      createdAt: new Date(),
    });

    await newAnswer.save();
    
    res.redirect('/gradeProblem/'+courseId+"/"+psetId+"/"+probId+"/"+studentId)
  }
} catch (e) {
    next(e);
}
 
})



/*
this is the route for writing a review of a particular student's answer to a problem
this is what TAs do when grading a problem set
*/
app.get("/gradeProblem/:courseId/:psetId/:probId/:studentId", authorize, hasCourseAccess,
async (req, res, next) => {
try {
  const courseId = req.params.courseId;
  const psetId = req.params.psetId;
  const probId = req.params.probId;
  const studentId = req.params.studentId;

  let problem = await Problem.findOne({_id: probId});
  res.locals.student = await User.findOne({_id: studentId});

  let answer = await Answer.findOne({problemId: probId, studentId: studentId});


  res.locals.answer = answer;
  res.locals.problem = problem;

  let myReviews = [];
  if (answer != undefined) {
    myReviews = await Review.find({problemId: problem._id, answerId: answer._id, reviewerId: req.user._id});
  }
  res.locals.numReviewsByMe = myReviews.length;
  res.locals.alreadyReviewed = myReviews.length > 0;



  // *** Handle the case where the user hasn't answered this one yet.
  // need a new view "noAnswerToReview"  ***
  if (answer) {
    res.redirect("/showReviewsOfAnswer/" + courseId+"/"+psetId+"/"+answer._id);
  } else {
    // this is ugly and I'll need to fix it soon
    res.send("the user has not yet submitted an answer to this problem")

  }
} catch (e) {
  next(e);
}
});





/*  saveReview
  when we save a review we need to create a new review document
  but also update the corresponding answer and problem documents
  to store the new information about number of reviews and pending reviews
  This is used when we generate an answer for a user to review


*/
app.post("/saveReview2/:courseId/:psetId/:probId/:answerId",authorize, hasCourseAccess,

  async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      const psetId = req.params.psetId;
      const probId = req.params.probId;
      const answerId = req.params.answerId;


      const problem = await Problem.findOne({_id: probId});

      const answer = await Answer.findOne({_id: answerId});

      const courseInfo = await Course.findOne({_id: courseId});

      let skills = req.body.skill;

      if (typeof skills == "undefined") {
        skills = [];
      } else if (typeof skills == "string") {
        skills = [skills];
      }

      const newReview = new Review({
        reviewerId: req.user._id,
        courseId: problem.courseId,
        psetId: problem.psetId,
        problemId: problem._id,
        answerId: req.params.answerId,
        studentId: answer.studentId,
        review: req.body.review,
        points: skills.length, //req.body.points,
        skills: skills,
        goodFaithEffort: (req.body.goodFaithEffort=="yes"),
        upvoters: [],
        downvoters: [],
        createdAt: new Date(),
      });

      const newReviewDoc = await newReview.save();

      let userIsOwner = req.user._id.equals(courseInfo.ownerId);

      // if the user is a TA, then make their review
      // the official review
      if (userIsOwner || res.locals.isTA) {
  
        
        await Answer.findByIdAndUpdate(answer._id,
          {$set:{officialReviewId:newReviewDoc._id,
                review: req.body.review,
                points: req.body.points,
                skills: skills}});      
        
      }


      // next we update the reviewers info in the answer object

      await Answer.findByIdAndUpdate(answer._id,
        {$inc:{numReviews:1},$push:{reviewers:req.user._id}});

      // but we need to adjust numreviews and pendingReviewers
      // if this was a pending review

      if (answer.pendingReviewers.find(
             (x) => x.equals(req.user._id)) ) {
        await Answer.findByIdAndUpdate(answer._id,
          {$inc:{numReviews:-1},
           $pull:{pendingReviewers:req.user._id}});
        }
        

      // redid this using $incr and $pull ***
      let pendingReviews = [];
      for (let i = 0; i < problem.pendingReviews.length; i++) {
        reviewInfo = problem.pendingReviews[i];

        if (reviewInfo.answerId.equals(answer._id) 
          && reviewInfo.reviewerId.equals(req.user._id)) {
          // don't push answer just reviewed by this user back into pendingReviews
          // this update didn't work 
          await Problem.findByIdAndUpdate(problem._id, 
             {$pull:{pendingReviews:reviewInfo}})
        } 
        else {
           pendingReviews.push(reviewInfo);
        }
      }


      if (req.body.destination == "submit and view this again") {
        res.redirect("/showReviewsOfAnswer/" + courseId+"/"+psetId+"/"+answerId);
      } else {
        res.redirect("/reviewAnswers/" +courseId+"/" +  psetId+"/"+probId);
      }

      // we can now redirect them to review more answers
      // res.redirect('/reviewAnswers/'+req.params.probId)
    } catch (e) {
      next(e);
    }
  }
);


/*
I want to get rid of this route and not remove any reviews.
We should just keep a chain or reviews and not allow users to remove them.
For now, I'll leave this and ignore it. 
*/
app.post("/removeReviews/:courseId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    /*
      We need to remove/delete the Review, but also
      to remove the reviewerId from the list of reviewers
      for the answer...
      */
    let deletes = req.body.deletes;

    let reviews = null;

    if (!deletes) {
      res.send("nothing to delete");
      return;
    } else if (typeof deletes == "string") {
      let review = await Review.findOne({_id: deletes});
      reviews = [review];
    } else {
      reviews = await Review.find({_id: {$in: deletes}});
    }

    let answerId = reviews[0].answerId;
    let reviewerIds = reviews.map((r) => r.reviewerId);
    let answer = await Answer.findOne({_id: answerId});


    const newReviewerIds = removeElements(answer.reviewers, reviewerIds);


    // try to use $pull instead of .save() ***
    answer.reviewers = newReviewerIds;
    await answer.save();
    await Review.deleteMany({_id: {$in: deletes}});
    //res.send("just updating answer ...")
    res.redirect(
      "/showReviewsOfAnswer/"
      +answer.courseId +"/"
      +answer.psetId +"/"
      +answerId);

  } catch (e) {
    next(e);
  }
});

function removeElements(slist, rems) {
  for (let i = 0; i < rems.length; i++) {
    slist = slist.filter((s) => {
      const z = !s.equals(rems[i]);
      return z;
    });
  }
  return slist;
}

app.get("/showReviewsOfAnswer/:courseId/:psetId/:answerId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {


    const personal = req.query.personal;
    
    const courseId = req.params.courseId;
    res.locals.courseId = courseId;
    const course = await Course.findOne({_id: courseId});

    const psetId = req.params.psetId;
    res.locals.psetId = psetId;
    res.locals.problemSet = await ProblemSet.findOne({_id: psetId});

    const answerId = req.params.answerId;
    res.locals.answerId = answerId;

    const id = req.params.answerId;
    
    const answer = await Answer.findOne({_id: answerId});
    res.locals.answer = answer;
    res.locals.courseInfo = await Course.findOne({_id: courseId});




    const problem = await Problem.findOne({_id: answer.problemId});
    res.locals.problem = problem;
    res.locals.student = await User.findOne({_id: answer.studentId});
    res.locals.reviews = await Review.find({answerId: answerId}).populate('reviewerId').populate('skills').sort({points: "asc", review: "asc"});
    const taList = await CourseMember.find({courseId: courseId, role: "ta"});
    res.locals.taList = taList.map((x) => x.studentId._id);

        
  let markdownText = problem.problemText;
  if (problem.mimeType == 'markdown') {
    markdownText = converter.makeHtml(markdownText);
    const mathjaxScript = 
    `<script type="text/x-mathjax-config">
MathJax.Hub.Config({
  tex2jax: {
    inlineMath: [ ['$','$'], ["\\(","\\)"] ],
    processEscapes: true
  },
});
</script>
<script type="text/javascript"
src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-AMS-MML_HTMLorMML">
</script>`;
    markdownText = mathjaxScript + markdownText;

  }

  res.locals.markdownText = markdownText;

    res.locals.skills = await Skill.find({_id: {$in: problem.skills}});
    res.locals.allSkills = await Skill.find({courseId: answer.courseId});
    res.locals.regradeRequests = await RegradeRequest.find({answerId: answerId});

    if (res.locals.isStaff || course.courseType=='pra' && !personal) {
      res.render("showReviewsOfAnswer");
    } else {
      res.locals.review 
        = await Review
                .findOne({_id: answer.officialReviewId})
                .populate('skills');
      if (!res.locals.review) {
        res.locals.review = {review: "no review yet!", points: 0, skills: []};
      }
      res.render("showReviewsOfAnswerToStudent");
    }
  } catch (e) {
    next(e);
  }
});

app.get("/showReviewsByUser/:courseId/:psetId/:probId", authorize, hasCourseAccess,
  async (req, res, next) => {
  const probId = req.params.probId;
  res.locals.probId = probId;
  const courseId = req.params.courseId;
  res.locals.courseId = courseId;
  const psetId = req.params.psetId;
  res.locals.psetId = psetId;

  res.locals.problem = await Problem.findOne({_id: probId});
  res.locals.course = await Course.findOne({_id: res.locals.problem.courseId});
  res.locals.usersReviews = await Review.find({reviewerId: req.user._id, problemId: probId});
  res.locals.allReviews = await Review.find({problemId: probId});
  const answerIds = res.locals.usersReviews.map((r) => r.answerId);
  res.locals.usersReviewedAnswers = await Answer.find({_id: {$in: answerIds}});
  res.render("showReviewsByUser");
});






// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.locals.user= req.user||{}
  res.render("error");
});


module.exports = app;
