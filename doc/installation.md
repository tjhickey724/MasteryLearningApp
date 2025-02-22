# Installing and Deploying MLA
The Mastery Learning App is open source and you can deploy it yourself if you want.
You run a local version or a cloud-based version (but that requires more setup).

## Deploying MLA locally
This is pretty easy.
1. clone the MLA site
2. startup mongodb
3. get google credentials for authentication
4. create a .env file as described below
5. run nodemon

Same .env file
``` bash
ADMIN_EMAIL=GMAIL OF THE ADMINISTRATOR
CLIENT_ID=GOOGLE_CLIENT_ID_GOES_HERE
CLIENT_SECRET=GOOGLE_SECRET_GOES_HERE
CALLBACK_URL=http://127.0.0.1:5500/login/authorized
MONGODB_URL=mongodb://localhost:27017/PICK_A_DATABASE_NAME
UPLOAD_TO = "LOCAL" # "LOCAL" or "AWS"
```
the administrator has special privileges, including being able to add or remove instructors and to see all courses on the app.

## Deploying to the cloud
We currently use render.com to deploy our app from the github repository.
We use MONGODB Atlas for database access
and we use AWS S3 for storing images. You can specify an AWS S3 bucket by
setting UPLOAD_TO to be "AWS" and adding the following fields to your .env file:
```
ADMIN_EMAIL=GMAIL OF THE ADMINISTRATOR
CLIENT_ID=GOOGLE_CLIENT_ID_GOES_HERE
CLIENT_SECRET=GOOGLE_SECRET_GOES_HERE
CALLBACK_URL=http://127.0.0.1:5500/login/authorized
MONGODB_URL=YOUR MONGODB SERVER 
UPLOAD_TO = "AWS" # "LOCAL" or "AWS"
AWS_SECRET_ACCESS_KEY = 'YOUR KEY GOES HERE'
AWS_ACCESS_KEY = 'YOUR KEY GOES HERE'
AWS_REGION = 'YOUR REGION'
AWS_BUCKET_NAME = 'YOUR BUCKET NAME'   
```
Contact the MLA team if you need some help deploying the app!
