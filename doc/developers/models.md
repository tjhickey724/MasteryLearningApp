# Models used by the MLA

We use MongoDB to store most of the data about each course.

# Toplevel models:
* User (needed for authentication)
* Instructor (needed for determining who can access what data)
* Skill (a particular skill that could be included in any course)
  * skills are created for a particular course but can be copied into other courses
  * skills are either original (meaning they were created by the instructor) or copies

# Storing the skill
We use a hierarchy of models shown below:

* Course
  * CourseMember (a list of the members of the course and their role, e.g. student, instructor, TA, auditor, guest, etc.)
  * CourseSkill (a collection associating skills to courses)
* ProblemSet (an exam consisting of a set of skills and a question for each skill)
* Problem (a hard question to test mastery of a single skill in the course)
* Answer (the student's answer the problem, usually stored as an image in an AWS S3 bucket)
* Review (the teaching assistant's grade for the answer (mastered/not-mastered)
* RegradeRequest (a student's request to have their answer regraded, with a reason for the request

# Hierarchical Properties
Each model contains a reference id to all of the models that it relies on (the ones above it)
For example here is the schema for the model for a RegradeRequest. It allows one to easily access the
course,problemset, problem, answer, review, and id of the reviewer (studentId), in addition to other data
needed for the regrade request itself.  

``` mongodb
'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var regradeRequestSchema = Schema( {
  reviewId: {type:ObjectId,index:true}, 
  courseId: {type:ObjectId,index:true},
  answerId: {type:ObjectId,index:true},
  problemId: {type:ObjectId,index:true}, 
  psetId: ObjectId,
  studentId: {type:ObjectId,index:true},
  reason: String,
  reply: String,
  completed: {type:Boolean, index:true},
  createdAt: Date,
} );


module.exports = mongoose.model( 'RegradeRequest', regradeRequestSchema );

```
