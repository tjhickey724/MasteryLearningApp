/*
  Authentication Middleware 
  There are five levels of authentication 
  1. not logged in
  2. user: logged in
  3. student: logged in and enrolled in a course
  4. ta: logged in and TA for a course
  5. owner: logged in and owner of a course
We set the authorization checking so that 
the user must be logged in to access any of route except "/login"
*/

const Course = require("../models/Course");
const CourseMember = require("../models/CourseMember");
const Instructor = require("../models/Instructor");
const adminEmail = process.env.ADMIN_EMAIL; // "tjhickey@brandeis.edu"; // the admin email


// route middleware to make sure a user is logged in
const isLoggedIn = async (req, res, next) => {
    res.locals.loggedIn = false;
    if (req.isAuthenticated()) {
      res.locals.loggedIn = true;
      let instructor = await Instructor.findOne({userId: req.user._id});
      res.locals.isInstructor = (instructor && instructor.status == "active")
      res.locals.isAdmin = req.user.googleemail == adminEmail;
      res.locals.admin_email = adminEmail;
      let courseTaMember 
        = await CourseMember.findOne({studentId: req.user._id, role: "ta"});
      res.locals.isTA = courseTaMember != null;
      return next();
    } else {
      res.redirect("/login");
    }
  }

  /* 
  this middleware can be applied to any route that has a courseId parameter.
  If the user is not logged in, it will redirect to the login page.
  Otherwise, it will set the following locals:
  courseInfo: the course object
  isEnrolled: true if the user is enrolled in the course
  isTA: true if the user is a TA for the course
  isOwner: true if the user is the owner of the course
  isAdmin: true if the user is the admin
  isStaff: true if the user is a TA or the owner of the course

  */
  


  const authorize = async (req, res, next) => {
    try {
      // only logged in users on routes with courseId can be authorized
      if (!req.isAuthenticated() || !req.params.courseId) {
        res.redirect("/login");
      } else {
        const id = req.params.courseId;
        const course = await Course.findOne({_id: id});

        res.locals.courseInfo = course; 
        
        res.locals.course = course;

        res.locals.isAdmin = req.user.googleemail == adminEmail;

        const member = 
          await CourseMember.findOne(
              {studentId: req.user._id, 
                courseId: res.locals.courseInfo._id});
         
        const instructor 
                = await Instructor.findOne({userId: req.user._id, status: "active"});
             

        if (!member){
            // these should all be false for new courses
            res.locals.isOwner = false;
            res.locals.isEnrolled = false;
            res.locals.isTA = false;
            if (res.locals.courseInfo.ownerId == req.user._id+"" ){
              // this shouldn't happen unless the owner is accidentally
              // removed from the course, if so then we add them back in!
                res.locals.isOwner = true;
                let registration = {
                  studentId: req.user._id,
                  courseId: course._id,
                  role: "owner",
                  createdAt: new Date(),
                };
                let cm = new CourseMember(registration);
                await cm.save();
            }
        } else {
            res.locals.isOwner 
              = member.role=='owner';
            res.locals.isEnrolled = member.role=='student';         
            res.locals.isTA = member.role=='ta';
        }

        res.locals.isOwner 
                 = res.locals.isOwner
                || res.locals.isAdmin 
                || res.locals.courseInfo.ownerId == req.user._id+""
                || (instructor && res.locals.isTA)
                ;

        res.locals.hasCourseAccess 
            = res.locals.isEnrolled 
              || res.locals.isTA 
              || res.locals.isOwner
              || res.locals.isAdmin;
              
        res.locals.isStaff 
            = res.locals.isTA 
              || res.locals.isOwner
              || res.locals.isAdmin;

        // give Admin access to all courses ...
        //res.locals.isOwner ||= res.locals.isAdmin;
        next()
      }
    } catch (e) {
      next(e);
    }
  }


  
  const hasCourseAccess = async (req, res, next) => {
    // students, TAs, and owners have access to the course
    try {
      if (res.locals.isEnrolled || res.locals.isTA || res.locals.isOwner) {
        next();
      } else {
        res.send("You do not have access to this course.");
      }
    } catch (e) {
      next(e);
    }
  }
  
  const hasStaffAccess = async (req, res, next) => {
    // Teaching Staff and Owners have access to the course route
    try {
      if (res.locals.isOwner || res.locals.isTA) {
        next();
      } else {
        res.send("Only TAs and the owner have access to this page.");
      }
    } catch (e) {
      next(e);
    }
  }

  const isInstructor = async (req, res, next) => {
    try {
      if (!req.user) {
        res.redirect("/login"); 
      } else {
        // only instructors have access to this route
        // if the user is not an instructor, they will be redirected to the home page
        // if they are an instructor, they will be able to access the route
        // and the next() function will be called
        const instructor 
          = await Instructor.findOne({userId: req.user._id, status: "active"});
        if (instructor) {
          next();
        } else {
          res.send("Only the instructors have access to this page.");
        }
      }
    } catch (e) {
      next(e);
    }
  }

  const isOwner = async (req, res, next) => {
    try {
      if (res.locals.isOwner) {
        next();
      } else {
        res.send("Only the owner has access to this page.");
      }
    } catch (e) {
      next(e);
    }
  }
  
  
  const isAdmin = async (req, res, next) => {
    try {
      if (req.user.googleemail == adminEmail){
        res.locals.isAdmin = true;
        next()
      } else {
        res.send("Only the admin has access to this page.");
      }      
    } catch (e) {
      next(e);
    }
  }

    module.exports = {
        authorize,
        isLoggedIn,
        hasCourseAccess,
        hasStaffAccess,
        isOwner,
        isInstructor,
        isAdmin,
    };

