# Views

We use the EJS (Embedded Java Script) engine for our views.

To maintain a consistent look on most pages we import 4 files:
* ```bootheader.ejs``` a header to include bootstrap code
* ```menubar.ejs```  a menubar
* ```footer.ejs```  a footer to include bootstrap code
* ```htmlfoot.ejs``` a footer to end the body and html tags

and when appropriate we add breadcrumbs to the top of the page so the user can navigate to previous pages easily.

We can also use the authorization variables ```isAdmin, isOwner, isStaff, hasCourseAccess, isEnrolled, isTA``` which are
initialized by the ```authorize``` middleware

Here is an example with all of these features:
```
<!-- This will only be seen by course teaching staff 
   - TAs, instructors, guest instructors 
   currently, this just shows them the problem text
-->
<%- include('bootheader') -%>
<%- include('menubar') -%>
<div class="p-3 mb-4 bg-light">
  <div class="container-fluid ">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="/">Home</a></li>
          <li class="breadcrumb-item"><a href="/showCourse/<%= courseId%>">
            <%= course.name %>
          </a></li>
          <li class="breadcrumb-item"><a href="/showProblemSet/<%= courseId%>/<%= problemSet._id%>">
            <%= problemSet.name %>
          </a></li>
          <li class="breadcrumb-item active" aria-current="page">
            <%= problem.description %> </li>
      </ol>
    </nav>

    <h3 class="pb-2 border-bottom">
      <%= problem.skills[0].shortName %>::
      <%= problem.description %>
      <% if (isOwner){ %>
        <a href="/editProblem/<%= problem.courseId%>/<%= problem._id %>">
          <i class='fas fa-pen' style='font-size:24px'></i> 
        </a>
      <% } %>
    </h3>
    <div class="p-2">
                mimeType=<%= problem.mimeType %><br>
                answerMimeType=<%= problem.answerMimeType %>
    </div>

      <% if (problem.mimeType=='markdown') { %>
        <div class="bg-default border border-dark rounded border-2 p-3"
        ><%- markdownText %>
        </div>
      <% } else  {%>
        <div class="bg-default border border-dark rounded border-2" 
             style="white-space: pre-wrap; font-family:monospace; padding:10px"
            ><%= problem.problemText %>
        </div>
      <% } %>
      <hr>
      

    <% if (course.courseType=="mla1" ) {%>
      <hr>
      <h3>Plagiarism detection:on</h3>
        <a href="/downloadAnswers/<%= courseId%>/<%= problem.id %>">
          download answers to check for plagiarism</a>
        <br>
    <% } %>



    </div>
  </div>
</div>
<%- include('bootfooter') -%>
<%- include('htmlfoot') -%>
```
