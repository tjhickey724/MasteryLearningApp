/*
*********************************************************************
Administrative Upgrades
These upgrades are needed to update the database schema
when we make changes to the app 
that require changes to the database schema.
*********************************************************************
*/


var express = require("express");
var app = express.Router();

const Problem = require("../models/Problem");
const Course = require("../models/Course");
const Skill = require("../models/Skill");
const CourseSkill = require("../models/CourseSkill");
const Review = require("../models/Review");
const Answer = require("../models/Answer");
const User = require("../models/User");
const Update = require("../models/Update");

const {authorize, isAdmin} = require("./authFunctions");



const getCurrentVersion = async () => {
    // get the current version, or create it if it doesn't exist
    updates = await Update.find({}).sort({createdAt: -1});
    if (updates.length == 0) {
        const update = new Update({version: "1.0.0", createdAt: new Date()});
        await update.save();
        return "1.0.0";
    } else {
      return updates[0].version;
    }
    };

const updateToVersion = 
  (version) => async (req, res, next) => {
    // check to see if we have already made this update
    let updates = await Update.find({version: version});
    if (updates.length > 0) {
      res.send(`already updated to version ${version}`);
    } else {
        // add the new version to the database
        const update = new Update({version: version, createdAt: new Date()});
        await update.save();
        next();
    }
  };



  const updateProblemMimeType =
    async (req, res, next) => {
      try {
        const problems = await Problem.find({});
        for (let p of problems) {
          if (!p.mimeType || p.mimeType == "text/plain") {
            p.mimeType = "plain";
          }
          await p.save();
        }
        next();
      } catch (e) {
        next(e);
      }
    };
  
  const createCourseSkills =
    async (req, res, next) => {
      try {
        await CourseSkill.deleteMany({});
        const courses = await Course.find({});
        for (let c of courses) {
          let skills = await Skill.find({courseId: c._id});
          for (let s of skills) {
            const courseSkillData = {
              courseId: c._id,
              skillId: s._id,
              createdAt: new Date(),
            }
            let courseSkill = new CourseSkill(courseSkillData);
            await courseSkill.save();
          }
        }
        next();
      } catch (e) {
        console.error(`error in createCourseSkills: ${e}`);
        next(e);
      }
    };
  
// this route is used to initialize the database to version 1.0.0
  app.get('/upgrade_v1_0_0/',
            isAdmin,
            updateToVersion("1.0.0"),
            (req,res,next) => {
                res.send("upgraded to v1.0.0");
            }
            );

  /*
  this creates the PsetProblem collection
  and it sets all of the problems to have mimeType="plain"
  unless they already have a mimeType.
  This will reset all of the problem mimeTypes to "plain" if called
  a second time.
  */
  app.get('/upgrade_v3_0_0', 
          isAdmin,
          updateProblemMimeType,
          (req,res,next) => {
            res.send("upgraded to v3.0.0");
          }
        );
  
  /*
  this creates the CourseSkill collection by adding every
  skill defined in the course to the CourseSkill collection
  It should only be used to upgrade to v3.1.0 because it will
  delete all of the existing CourseSkill entries including
  skills imported from other courses...
  */
  app.get('/upgrade_v3_1_0', 
          isAdmin,
          createCourseSkills,
          (req,res,next) => {
            res.send("upgraded to v3.1.0");
          }
        )
  

module.exports = app;
