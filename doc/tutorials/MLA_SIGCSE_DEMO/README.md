# MLA Demo for SIGCSE2025

In this demo we will show you how to 
* create an MLA0 course,
* upload a roster,
* import skills from another course,
* create an exam
* download personalized exams for each student in the class
* upload the grades
* examine the skill mastery of all students in the class

You can see a video going over these steps at
[SIGCSE2025 MLA Tutorial](https://dl.acm.org/doi/10.1145/3641555.3705053)

and here is a pdf showing the individual steps
[SIGCSE2025 MLA Tutorial Walkthrough](https://drive.google.com/drive/u/2/folders/1kWqh8Y2bQRXNw3PW46Ud8EowzAY7Dhbq)

[Link to a QR code for this page](./QR_Code_MLA_SIGCSE_DEMO.png)

[Link to the MasteryLearning App running on render.com](https://masterylearningapp.onrender.com)

Fill out [this form](https://docs.google.com/forms/d/1Y4rBIQZWcq2Jctvmsae7CVm4SOOBhB7I7V1EtjmCwpg/preview) if you want to be notified of major developments with the Mastery Learning App.

Contact us if you want to talk about the MLA and related pedagogies.
* Tim Hickey tjhickey@brandeis.edu
* Ella Tuson ellatuson@brandeis.edu



# Simple MLA0 Demo

Here is a tutorial in Video and PDF form that you can follow.
You should first ask the administrator (tjhickey@brandeis.edu)
to add you as an instructor so you can create a class.

[Video](https://dl.acm.org/doi/10.1145/3641555.3705053)

[PDF](https://drive.google.com/drive/u/2/folders/1kWqh8Y2bQRXNw3PW46Ud8EowzAY7Dhbq)


0. Start by visiting the app at https://masterylearningapp.onrender.com and logging in
   either with your gmail account or with an email. Currently we only allow emails from the
   domain stemmla.com (which we own) and you can pick any such email, register, and sign in.
   These are temporary accounts and we delete them every few weeks so don't use it for real work.
2. Start by creating a new course, you'll need to send email to the administrator (tjhickey@brandeis.edu)
   to get permission to create courses...
3. Next go to the Enrollment tab and upload roster1-7.csv 
   roster1-7.csv has students 1,2,3,4,5,6,7 in 2 sections
4. Next import all of the skills from the Discrete Math Problem Bank class
5. Next create an exam, with problems for F01 and F02.
6. Next generate personalized exams for your seven students
   in a downloaded zip file. Run the "compile.sh" file to compiled the
   latex into pdfs, which you could then print.
7. Next upload the grades using exam1.csv
   exam1.csv has students 1,2,3 taking an exam with two skills, F01,F02
8. Next look at the Mastery tab to see how they are doing.
9. You can logout and log back in as student1@stemmla.com with password abc123 to see the student view...

You can then create makeup exams or new exams and create corresponding CSV files
to track an entire class.
