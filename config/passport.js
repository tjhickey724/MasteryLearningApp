// config/passport.js

// load all the things we need
var LocalStrategy = require("passport-local").Strategy;
//var FacebookStrategy = require('passport-facebook').Strategy;
//var TwitterStrategy  = require('passport-twitter').Strategy;
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

// load up the user model
var User = require("../models/User");

// load the auth variables
//var configAuth = require('./auth');
require("dotenv").config(); //new

module.exports = function (passport) {
  // used to serialize the user for the session
  passport.serializeUser(function (user, done) {
    done(null, user.id);
  });

  // used to deserialize the user
  passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
      done(err, user);
    });
  });

  // code for login (use('local-login', new LocalStategy))
  // code for signup (use('local-signup', new LocalStategy))
  // code for facebook (use('facebook', new FacebookStrategy))
  // code for twitter (use('twitter', new TwitterStrategy))

  // =========================================================================
  // GOOGLE ==================================================================
  // =========================================================================
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL,
      },
      function (token, refreshToken, profile, done) {
        // make the code asynchronous
        // User.findOne won't fire until we have all our data back from Google
        process.nextTick(function () {
          // try to find the user based on their google id
          // User.findOne({ 'googleid' : profile.id }, function(err,
          // CHANGED!  lookup via their email!
          User.findOne({googleemail: profile.emails[0].value}, function (err, user) {
            if (err) return done(err);

            if (user) {
              // if a user is found, log them in
              if (!user.googleid) {
                user.googleid = profile.id;
                user.googletoken = token;
                user.googlename = profile.displayName;
                user.save(function (err) {
                  if (err) throw err;
                  return done(null, user);
                });
              } else {
                return done(null, user);
              }
            } else {

              // if the user isnt in our database, create a new user
              var newUser = new User({googleid: profile.id, googletoken: token, googlename: profile.displayName, googleemail: profile.emails[0].value});

              // set all of the relevant information
              /*
                    newUser.google = {}
                    newUser.google.id    = profile.id;
                    newUser.google.token = token;
                    newUser.google.name  = profile.displayName;
                    newUser.google.email = profile.emails[0].value; // pull the first email
                    */
              // save the user
              newUser.save(function (err) {
                if (err) throw err;
                return done(null, newUser);
              });
            }
          });
        });
      }
    )
  );
  // local
  passport.use(new LocalStrategy(User.authenticate()));
};
