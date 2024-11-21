'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var courseSchema = Schema( {
  name: String,
  ownerId: {type:ObjectId,index:true},
  coursePin: {type:Number,index:true},
  createdAt: Date,
  startDate: Date,
  stopDate: Date,
  active: {type:Boolean, default:true}, // set to false to archive the course
  guestAccess: // who can see the course without joining it
    { type:String,
      enum: ['none','instructors','all'],
      default: 'none'
    },
  courseType: {
    type: String,
    enum: ['mla0',  // skill-based exam generation on paper
           'mla1',  // and with grading in the app
           'sga',   // specs grading, with online quizzes
           'pra',   // peer review assignment of in-class questions
          ],
    default: 'mla0'
    },
} );

module.exports = mongoose.model( 'Course', courseSchema );
