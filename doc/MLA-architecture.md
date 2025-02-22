# MLA Architecture

The current version of the MLA is design to support a Mastery Assessement Pedagogy (MAP) style class which meets the following criteria
* a student's course grade is determined by the number of course skills they master
* there is a weekly exam where each student has a personalized exam with one question for each skill that has been introduced but which they have not yet mastered.
* the exams are printed out on paper with one problem/skill per page. Students write their answers on the exam and upload a picture of each page to the app
* the students' answers are graded on a pass/fail basis where pass means they have demonstrated mastery of the skill

## Current Version
We are currently redesigning the MLA so that it fully supports the Mastery Assessment Protocol  described in Ella Tuson's dissertation
and the MAP-style pre-calculus and Calculus courses that are being taught at Brandeis University by Rebecca Torry and Keith Merrill.

There are three versions of MLA courses the instructor can create:
* MLA1 - this is the full MLA as described below
* MLA0 - this is a version in which grading is done outside the app and the results are uploaded via grades.csv files
* PRA - this is a peer review app mean to be used in class, the instructor creates questions, students answer them, then anonymously view all of their peers answers, and anonymously review some of their peers. We don't describe it on this page as it is pretty self-explanatory!

The rest of this document describes only the MLA1 courses.


## Features
The MLA supports this pedadogy by offering the following features.

## Course Creation
* instructors (who are whitelisted in app.js) can create a class in the MLA 
* instructors upload a roster.csv file to enroll students in the course
* instructors can add Teaching Assistants to a class to help with the grading

## Skill Lists
* instructors create a list of skills for the course
* they can import the skills from an other course
* instructors can add or remove skills from their course

## Exams or Problem Sets
* instructors can create problem sets and make them visible or keep them hidden from the class
* each problem in the exam is designed to test mastery of a single skill 
* instructors can add problems to a problem set by creating a new problem testing a course skill or selecting one from all problems in the system for that skill

## Problems
* instructors can create problems in a problem set by giving it a name, description, rubric, and a set of skills (typically just one skill)
* instructors can import problems from another class by viewing all problems in the system that have that skill

## Grading
* instructors and TAs can review students answers to the problems in a problem set and descide if they jmastered the skill or not. They can also provide feedback.
* students can submit a regrade request if they believe the grading is incorrect

## Dashboards
* students can see which skills they have mastered and which they still need to master
* instructors can see mastery data for all students in the class



  
