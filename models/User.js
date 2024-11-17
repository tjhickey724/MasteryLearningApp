"use strict";
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

var userSchema = Schema({
  googleid: String,
  googletoken: String,
  googlename: String,
  googleemail: String,
});

userSchema.plugin(passportLocalMongoose, {usernameField: "googleemail"});

module.exports = mongoose.model("User", userSchema);


