'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var supportFileSchema = Schema( {
    name: String, // the name of the skill fitting on one line
    text: String, // the text of the support file
    createdAt: Date,
    courseId: {type: ObjectId, ref:"Course", index:true},
  } );

module.exports = mongoose.model( 'SupportFile', supportFileSchema );
