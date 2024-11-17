var express = require("express");
var app = express.Router();
const fs = require('fs');
const Answer = require("../models/Answer");

const {hasCourseAccess} = require('./authFunctions.js');

app.get("/downloadAnswers/:courseId/:probId", hasCourseAccess,
  async (req, res, next) => {
    try {
      const probId = req.params.probId;
      res.locals.probId = probId;
      const answers = await Answer.find({problemId: probId}).populate('studentId');
      const csvStream = fs.createWriteStream("private/"+probId+".csv")
      csvStream.write("filename,created_at,full_name\n")
        for(let x of answers) {
            const writeStream = fs.createWriteStream("private/"+probId+"-"+x.studentId.googleemail);
            writeStream.write(x.answer)
            csvStream.write(""+probId+"-"+x.studentId.googleemail+","+x.createdAt+","+x.studentId.googleemail+"\n")
            writeStream.end()
        }
        csvStream.end()

      res.json(['testing']);
    
    } catch (e) {
      console.log("Error in showProblem: " + e);
      next(e);
    }
  });
  

module.exports = app;
